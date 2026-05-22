export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AiImportPayload = {
  engine: "ai";
  text: string;
  rows?: Array<{
    parameter: string;
    value: string;
    unit?: string;
    sample?: string;
    method?: string;
    source?: string;
    confidence?: number;
  }>;
  metadata?: Record<string, string>;
  warning?: string;
};

export async function GET() {
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");

    if (!(image instanceof File)) {
      return Response.json({ error: "No image was received." }, { status: 400 });
    }

    const bytes = Buffer.from(await image.arrayBuffer());
    const payload = await readWithAi(bytes, image.type);

    return Response.json(payload);
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "The report image could not be analyzed.",
      },
      { status: 500 }
    );
  }
}

async function readWithAi(bytes: Buffer, mimeType: string): Promise<AiImportPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI import needs OPENAI_API_KEY in .env.local.");
  }

  const imageUrl = `data:${mimeType || "image/png"};base64,${bytes.toString("base64")}`;
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMPORT_MODEL || "gpt-4o-mini",
      max_output_tokens: 2400,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "alakay_lab_import",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              text: { type: "string" },
              metadata: {
                type: "object",
                additionalProperties: false,
                properties: {
                  labName: { type: "string" },
                  clientName: { type: "string" },
                  farmName: { type: "string" },
                  lotName: { type: "string" },
                  cropName: { type: "string" },
                  reportDate: { type: "string" },
                  sampleId: { type: "string" },
                  analysisType: { type: "string" },
                },
                required: [
                  "labName",
                  "clientName",
                  "farmName",
                  "lotName",
                  "cropName",
                  "reportDate",
                  "sampleId",
                  "analysisType",
                ],
              },
              rows: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    parameter: { type: "string" },
                    value: { type: "string" },
                    unit: { type: "string" },
                    sample: { type: "string" },
                    method: { type: "string" },
                    source: { type: "string" },
                    confidence: { type: "number" },
                  },
                  required: [
                    "parameter",
                    "value",
                    "unit",
                    "sample",
                    "method",
                    "source",
                    "confidence",
                  ],
                },
              },
              warning: { type: "string" },
            },
            required: ["text", "metadata", "rows", "warning"],
          },
        },
      },
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Read this soil or foliar lab report for ALAKAY.",
                "Return strict JSON only. Do not include markdown.",
                "The text field should contain a compact transcription of the useful report text.",
                "The rows field must contain lab results only: {parameter,value,unit,sample,method,source,confidence}.",
                "Keep sample/lot/plot names on every row when several plots, lots, or samples appear.",
                "If a table has Result, Resultado, Resultados, Valor, Concentracion, or Current columns, use those columns as the true values.",
                "If a wide table has sample rows and parameter columns, create one row per sample and parameter.",
                "If headers include method or unit, carry that method/unit into each row.",
                "Do not import dates, phone numbers, page numbers, addresses, invoice/payment numbers, legal text, chart axes, recommendation kg/ha values, rating letters, status words, or reference ranges as results.",
                "Treat Low/Medium/High, Bajo/Medio/Alto, Target, Guide, Optimum, Range, Rango, Reference, and bar/scale numbers as reference information, not result values.",
                "Preserve different methods separately, for example P Olsen, P Bray, P Mehlich, pH H2O, pH KCl, nitrate-N, ammonium-N.",
                "Use confidence from 0 to 1. Use lower confidence when OCR or layout is uncertain.",
              ].join(" "),
            },
            {
              type: "input_image",
              image_url: imageUrl,
              detail: "high",
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || "AI import request failed.");
  }

  const payload = await response.json();
  const outputText = extractResponseText(payload);
  const parsed = parseAiImportJson(outputText);

  return {
    engine: "ai",
    text: parsed.text || outputText,
    rows: parsed.rows || [],
    metadata: parsed.metadata || {},
    warning: parsed.warning || "",
  };
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const record = payload as Record<string, unknown>;
  if (typeof record.output_text === "string") return record.output_text;

  const chunks: string[] = [];
  const output = Array.isArray(record.output) ? record.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const content = Array.isArray((item as Record<string, unknown>).content)
      ? ((item as Record<string, unknown>).content as unknown[])
      : [];
    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const partRecord = part as Record<string, unknown>;
      if (typeof partRecord.text === "string") chunks.push(partRecord.text);
    }
  }

  return chunks.join("\n").trim();
}

function parseAiImportJson(rawText: string) {
  const jsonText = rawText.match(/\{[\s\S]*\}/)?.[0] || rawText;
  try {
    return normalizeAiImportPayload(JSON.parse(jsonText));
  } catch {
    return { text: rawText, rows: [] };
  }
}

function normalizeAiImportPayload(
  payload: unknown
): Pick<AiImportPayload, "text" | "rows" | "metadata" | "warning"> {
  if (!payload || typeof payload !== "object") {
    return { text: "", rows: [] };
  }

  const record = payload as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text : "";
  const metadata =
    record.metadata && typeof record.metadata === "object"
      ? Object.fromEntries(
          Object.entries(record.metadata as Record<string, unknown>)
            .filter(([, value]) => typeof value === "string")
            .map(([key, value]) => [key, value as string])
        )
      : {};
  const warning = typeof record.warning === "string" ? record.warning : "";
  const rawRows = Array.isArray(record.rows)
    ? record.rows
    : Array.isArray(record.values)
      ? record.values
      : [];

  const rows = rawRows
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const item = row as Record<string, unknown>;
      const parameter = String(
        item.parameter ?? item.name ?? item.label ?? item.nutrient ?? ""
      ).trim();
      const value = String(item.value ?? item.result ?? item.concentration ?? "").trim();
      if (!parameter || !value) return null;

      const confidenceRaw = Number(item.confidence);
      return {
        parameter,
        value,
        unit: String(item.unit ?? item.units ?? "").trim(),
        sample: String(item.sample ?? item.lot ?? item.plot ?? item.sampleName ?? "").trim(),
        method: String(item.method ?? item.extractionMethod ?? "").trim(),
        source: String(item.source ?? item.reason ?? item.location ?? "").trim(),
        confidence: Number.isFinite(confidenceRaw)
          ? confidenceRaw > 1
            ? confidenceRaw / 100
            : confidenceRaw
          : undefined,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return { text, rows, metadata, warning };
}
