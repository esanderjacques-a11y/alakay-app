export type DocumentUnitContext = {
  defaultMassUnit?: "ppm" | "mg/kg";
  defaultCationUnit?: "cmol(+)/kg" | "meq/100g";
  source?: string;
};

const CATION_PARAMETER_KEYS = new Set([
  "calcium",
  "magnesium",
  "potassium",
  "sodium",
  "aluminum",
  "exchangeable_acidity",
  "cec",
]);

const PERCENT_LIKE_KEYS = new Set([
  "ph",
  "organic_matter",
  "organic_carbon",
  "base_saturation",
  "sand",
  "silt",
  "clay",
  "moisture",
  "humidity",
]);

export function detectDocumentUnitContext(text: string): DocumentUnitContext {
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return {};

  const context: DocumentUnitContext = {};

  const massStatement =
    /(?:results?|values?|nutrients?|data|analyses)\s+(?:are\s+)?(?:provided|reported|expressed|shown|given|listed|displayed)\s+(?:in|as)\s+(?:parts per million|\bppm\b)/.test(
      normalized
    ) ||
    /(?:provided|reported|expressed|shown)\s+(?:in|as)\s+(?:parts per million|\bppm\b)/.test(
      normalized
    ) ||
    /(?:all|every)\s+(?:values?|results?|nutrients?)\s+(?:are\s+)?(?:in|as|expressed as)\s+(?:\bppm\b|mg\s*\/?\s*kg|parts per million)/.test(
      normalized
    ) ||
    /(?:a\s+)?closer\s+look[\s\S]{0,80}\bppm\b/.test(normalized);

  const mgKgStatement =
    /(?:results?|values?|nutrients?)\s+(?:are\s+)?(?:provided|reported|expressed|shown|given)\s+(?:in|as)\s+mg\s*\/?\s*kg/.test(
      normalized
    );

  if (massStatement || mgKgStatement) {
    context.defaultMassUnit = massStatement ? "ppm" : "mg/kg";
    context.source = "document unit statement";
  }

  const cationStatement =
    /(?:results?|values?|(?:exchangeable\s+)?(?:ca|mg|k|na|bases?))\s+(?:are\s+)?(?:provided|reported|expressed|shown|given)\s+(?:in|as)\s+(?:cmol|meq)/.test(
      normalized
    ) ||
    /(?:in|as)\s+cmol\s*[\(+]?\+?\)?\s*\/\s*kg/.test(normalized);

  if (cationStatement) {
    context.defaultCationUnit = /meq/.test(normalized) ? "meq/100g" : "cmol(+)/kg";
    if (!context.source) context.source = "document unit statement";
  }

  return context;
}

export function documentContextFromMetadata(
  defaultUnitSystem?: string
): DocumentUnitContext {
  const raw = String(defaultUnitSystem || "")
    .trim()
    .toLowerCase();
  if (!raw) return {};
  if (raw === "ppm" || raw.includes("part per million")) {
    return { defaultMassUnit: "ppm", source: "AI metadata" };
  }
  if (raw.includes("mg/kg") || raw.includes("mg kg")) {
    return { defaultMassUnit: "mg/kg", source: "AI metadata" };
  }
  if (raw.includes("cmol") || raw.includes("meq")) {
    return {
      defaultCationUnit: raw.includes("meq") ? "meq/100g" : "cmol(+)/kg",
      source: "AI metadata",
    };
  }
  return {};
}

export function mergeDocumentUnitContext(
  ...contexts: DocumentUnitContext[]
): DocumentUnitContext {
  const merged: DocumentUnitContext = {};
  for (const context of contexts) {
    if (context.defaultMassUnit && !merged.defaultMassUnit) {
      merged.defaultMassUnit = context.defaultMassUnit;
    }
    if (context.defaultCationUnit && !merged.defaultCationUnit) {
      merged.defaultCationUnit = context.defaultCationUnit;
    }
    if (context.source && !merged.source) merged.source = context.source;
  }
  return merged;
}

export function isCationParameterKey(parameterKey: string) {
  return CATION_PARAMETER_KEYS.has(parameterKey);
}

export function looksLikeMassConcentrationValue(parameterKey: string, value: number) {
  if (!Number.isFinite(value)) return false;
  if (parameterKey === "calcium") return value > 50;
  if (parameterKey === "magnesium") return value > 30;
  if (parameterKey === "potassium" || parameterKey === "sodium") return value > 10;
  if (parameterKey === "aluminum") return value > 5;
  if (parameterKey === "cec") return value > 15;
  return false;
}

export function shouldSkipMassUnitDefault(parameterKey: string) {
  return PERCENT_LIKE_KEYS.has(parameterKey);
}

/**
 * When a row has no explicit unit, infer what the lab report likely used.
 */
export function inferRowReportUnit(
  rowUnit: string | undefined,
  parameterKey: string | undefined,
  numericValue: number | undefined,
  documentContext: DocumentUnitContext
): string | undefined {
  if (rowUnit?.trim()) return rowUnit.trim();
  if (!parameterKey || shouldSkipMassUnitDefault(parameterKey)) return undefined;

  const isCation = isCationParameterKey(parameterKey);

  if (documentContext.defaultMassUnit) {
    if (!isCation || looksLikeMassConcentrationValue(parameterKey, numericValue ?? NaN)) {
      return documentContext.defaultMassUnit;
    }
  }

  if (
    isCation &&
    numericValue !== undefined &&
    looksLikeMassConcentrationValue(parameterKey, numericValue)
  ) {
    return "ppm";
  }

  if (isCation && documentContext.defaultCationUnit) {
    return documentContext.defaultCationUnit;
  }

  if (documentContext.defaultMassUnit && !isCation) {
    return documentContext.defaultMassUnit;
  }

  return undefined;
}

export function formatReportReferenceRange(range?: string | null) {
  const trimmed = String(range || "").trim();
  return trimmed || null;
}
