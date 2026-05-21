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
    confidence?: number;
  }>;
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
      model: process.env.OPENAI_IMPORT_MODEL || "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: [
                "Read this soil or foliar lab report for ALAKAY.",
                "Return only strict JSON with keys text and rows.",
                "rows must be an array of {parameter,value,unit,sample,confidence}.",
                "Use only actual lab result values.",
                "Do not use reference ranges, dates, phone numbers, page numbers, addresses, invoices, recommendations, legal text, chart axes, or status/rating values as results.",
                "If the report has several plots, lots, or samples, keep the sample name on every row.",
                "If a table has Resultado/Result/Value columns, prefer those columns over nearby numbers.",
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

function normalizeAiImportPayload(payload: unknown): Pick<AiImportPayload, "text" | "rows"> {
  if (!payload || typeof payload !== "object") {
    return { text: "", rows: [] };
  }

  const record = payload as Record<string, unknown>;
  const text = typeof record.text === "string" ? record.text : "";
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
        confidence: Number.isFinite(confidenceRaw)
          ? confidenceRaw > 1
            ? confidenceRaw / 100
            : confidenceRaw
          : undefined,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  return { text, rows };
}
