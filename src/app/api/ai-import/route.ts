export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AiImportPayload = {
  engine: "ai";
  text: string;
  rows?: Array<{
    parameter: string;
    symbol?: string;
    value: string;
    unit?: string;
    sample?: string;
    method?: string;
    source?: string;
    confidence?: number;
    reportRange?: string;
    reportRating?: string;
  }>;
  metadata?: Record<string, string>;
  warning?: string;
};

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  fr: "French",
  ht: "Haitian Creole",
  pt: "Portuguese",
  sw: "Swahili",
};

export async function GET() {
  return Response.json({ ok: true });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const image = formData.get("image");
    const text = formData.get("text");
    const table = formData.get("table");
    const language = normalizeLanguage(formData.get("language"));

    if (image instanceof File) {
      const bytes = Buffer.from(await image.arrayBuffer());
      const payload = await readImageWithAi(bytes, image.type, language);

      return Response.json(payload);
    }

    const textPayload = typeof text === "string" ? text.trim() : "";
    const tablePayload = typeof table === "string" ? table.trim() : "";

    if (!textPayload && !tablePayload) {
      return Response.json(
        { error: "No report image, text, or table was received." },
        { status: 400 }
      );
    }

    const payload = await readTextWithAi(textPayload, tablePayload, language);
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

async function readImageWithAi(
  bytes: Buffer,
  mimeType: string,
  language: string
): Promise<AiImportPayload> {
  const imageUrl = `data:${mimeType || "image/png"};base64,${bytes.toString("base64")}`;
  return requestAiImport([
    {
      type: "input_text",
      text: buildAiImportInstructionsForLanguage(language),
    },
    {
      type: "input_image",
      image_url: imageUrl,
      detail: "high",
    },
  ]);
}

async function readTextWithAi(
  text: string,
  table: string,
  language: string
): Promise<AiImportPayload> {
  const content = [
    buildAiImportInstructionsForLanguage(language),
    text ? `Extracted report text:\n${text}` : "",
    table ? `Extracted table/cell data as JSON:\n${table}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return requestAiImport([
    {
      type: "input_text",
      text: content,
    },
  ]);
}

function normalizeLanguage(value: FormDataEntryValue | null) {
  const raw = typeof value === "string" ? value : "en";
  return LANGUAGE_NAMES[raw] ? raw : "en";
}

function buildAiImportInstructionsForLanguage(language: string) {
  const languageName = LANGUAGE_NAMES[language] || LANGUAGE_NAMES.en;
  return [
    "Read this soil or foliar lab report for CULTOSOL.",
    "Return strict JSON only. Do not include markdown.",
    `Use ${languageName} for parameter names when writing rows.parameter. Keep names short and lab-style.`,
    "Return rows.symbol separately with the exact detected symbol when available (for example K, Ca, Mg, Na, Fe, Zn, Cu, B, pH, EC, CEC, CIC, CICE).",
    "Prefer concise parameter names plus symbols over long descriptions. Do not use prose sentences as parameter names.",
    "If symbol and parameter text disagree, trust the symbol visible next to the value column.",
    "The text field must be a faithful row-by-row transcription of useful result tables and nearby sample metadata, not a summary or explanation.",
    "The rows field must contain lab results only: {parameter,value,unit,sample,method,source,confidence}.",
    "Rows are required when result tables are visible. Extract every real numeric result row that belongs to the lab analysis tables.",
    "Do not infer, calculate, translate, or convert units. Keep the reported value and reported unit exactly as printed.",
    "If the document states that results are in ppm, parts per million, or mg/kg (for example a note above a table), set metadata.defaultUnitSystem to ppm or mg/kg accordingly.",
    "When a table has an Optimal Range, Target Value, Reference Range, or similar column, put that text in rows.reportRange for the matching parameter. Do not put range text in rows.value.",
    "When a table has a Rating column (Optimal, High, Low, etc.), put that label in rows.reportRating.",
    "If a global unit statement applies to the whole table and individual rows have no unit column, leave rows.unit empty but still set metadata.defaultUnitSystem.",
    "If a result value has a rating suffix attached, such as 23M, 110L, 992VL, or 357H, put only the numeric part in value and mention the suffix in source. Do not import rating suffixes as values.",
    "Keep sample/lot/plot names on every row when several plots, lots, or samples appear.",
    "For wide multi-sample reports, sample IDs belong in sample and lab numbers belong in source or metadata; neither is a lab result value.",
    "If a table has Result, Resultado, Resultados, Valor, Concentracion, or Current columns, use those columns as the true values.",
    "If a table has two result columns for the same variable, such as mg/kg and meq/100g, prefer the column that matches a document-level unit statement. When the report says results are in ppm or mg/kg, use that column. When no document unit statement exists, prefer meq/100g or cmol(+)/kg for exchangeable bases. Do not convert.",
    "Include texture rows when present: Sand/Arena, Silt/Limo, Clay/Arcilla, and texture class when shown.",
    "If a wide table has sample rows and parameter columns, create one row per sample and parameter.",
    "Do not mix two parameters in one row. One row must contain one parameter and one numeric value.",
    "If headers include method or unit, carry that method/unit into each row.",
    "Do not import dates, phone numbers, page numbers, addresses, invoice/payment numbers, legal text, chart axes, recommendation kg/ha values, rating letters, status words, or reference ranges as results.",
    "Treat Low/Medium/High, Bajo/Medio/Alto, Target, Guide, Optimum, Range, Rango, Reference, and bar/scale numbers as reference information, not result values.",
    "Preserve different methods separately, for example P Olsen, P Bray, P Mehlich, pH H2O, pH KCl, nitrate-N, ammonium-N.",
    "If carbon, organic carbon, sodium, or sodio appears as a real result, include it as a row even if it may need manual review in the app.",
    "Use confidence from 0 to 1. Use lower confidence when OCR or layout is uncertain.",
    "Rows.value must be numeric only (digits with optional decimal separator and optional sign). Do not include units, words, or symbols in rows.value.",
  ].join(" ");
}

async function requestAiImport(
  content: Array<Record<string, unknown>>
): Promise<AiImportPayload> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("AI import needs OPENAI_API_KEY in .env.local.");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_IMPORT_MODEL || "gpt-4o-mini",
      max_output_tokens: 6000,
      temperature: 0,
      text: {
        format: {
          type: "json_schema",
          name: "cultosol_lab_import",
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
                  defaultUnitSystem: { type: "string" },
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
                  "defaultUnitSystem",
                ],
              },
              rows: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: {
                    parameter: { type: "string" },
                    symbol: { type: "string" },
                    value: { type: "string" },
                    unit: { type: "string" },
                    sample: { type: "string" },
                    method: { type: "string" },
                    source: { type: "string" },
                    confidence: { type: "number" },
                    reportRange: { type: "string" },
                    reportRating: { type: "string" },
                  },
                  required: [
                    "parameter",
                    "symbol",
                    "value",
                    "unit",
                    "sample",
                    "method",
                    "source",
                    "confidence",
                    "reportRange",
                    "reportRating",
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
          content,
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

function parseNumericString(value: string) {
  const matched = String(value || "").match(/[+-]?\d+(?:[.,]\d+)?/);
  if (!matched) return null;
  const parsed = Number(matched[0].replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeParameterLabel(value: string) {
  return String(value || "")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImportedRowShape(
  parameterRaw: string,
  valueRaw: string,
  unitRaw: string,
  symbolRaw = ""
) {
  let parameter = normalizeParameterLabel(parameterRaw);
  let value = String(valueRaw || "").trim();
  let unit = String(unitRaw || "").trim();
  const symbol = String(symbolRaw || "").trim().toLowerCase();

  const merged = parameter.match(/^([<>]?\s*[+-]?\d+(?:[.,]\d+)?)(?:\s*[-_:]?\s*)(.+)$/);
  const parsedValue = parseNumericString(value);
  const parameterLower = parameter.toLowerCase();
  const looksLikePh = /\bph\b/.test(parameterLower) || symbol === "ph";

  if (merged && /\bph\b/.test(merged[2].toLowerCase())) {
    const mergedValue = parseNumericString(merged[1]);
    const suspiciousCurrent =
      parsedValue === null || parsedValue < 2 || parsedValue > 12;
    if (mergedValue !== null && suspiciousCurrent) {
      parameter = "pH";
      value = String(mergedValue);
      if (!unit) unit = "pH";
    }
  }

  if (looksLikePh && parameter !== "pH") {
    parameter = "pH";
    if (!unit) unit = "pH";
  }

  return { parameter, value, unit };
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
      const rawParameter = String(
        item.parameter ?? item.name ?? item.label ?? item.nutrient ?? ""
      ).trim();
      const rawValue = String(item.value ?? item.result ?? item.concentration ?? "").trim();
      const rawUnit = String(item.unit ?? item.units ?? "").trim();
      const rawSymbol = String(item.symbol ?? "").trim();
      const normalized = normalizeImportedRowShape(
        rawParameter,
        rawValue,
        rawUnit,
        rawSymbol
      );
      const parameter = normalized.parameter;
      const value = normalized.value;
      if (!parameter || !value) return null;

      const confidenceRaw = Number(item.confidence);
      const inlineSymbolMatch = parameter.match(/\(([A-Za-z][A-Za-z0-9+\-]{0,5})\)/);
      return {
        parameter,
        symbol: rawSymbol || inlineSymbolMatch?.[1] || "",
        value,
        unit: normalized.unit,
        sample: String(item.sample ?? item.lot ?? item.plot ?? item.sampleName ?? "").trim(),
        method: String(item.method ?? item.extractionMethod ?? "").trim(),
        source: String(item.source ?? item.reason ?? item.location ?? "").trim(),
        reportRange: String(
          item.reportRange ?? item.referenceRange ?? item.optimalRange ?? item.range ?? ""
        ).trim(),
        reportRating: String(
          item.reportRating ?? item.rating ?? item.interpretation ?? ""
        ).trim(),
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
