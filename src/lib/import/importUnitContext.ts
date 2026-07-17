export type DocumentUnitContext = {
  defaultMassUnit?: "ppm" | "mg/kg";
  defaultCationUnit?: "cmol(+)/kg" | "meq/100g";
  source?: string;
};

/** Bases that labs often report in both mg/kg and meq/cmol. */
const MASS_OR_EXCHANGE_BASE_KEYS = new Set([
  "calcium",
  "magnesium",
  "potassium",
  "sodium",
]);

const CATION_PARAMETER_KEYS = new Set([
  ...MASS_OR_EXCHANGE_BASE_KEYS,
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

function normalizeUnitToken(unit: string) {
  return unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u00b5\u03bc]/g, "u")
    .replace(/\u207b/g, "-");
}

export function isExchangeCationUnit(unit: string | undefined) {
  if (!unit?.trim()) return false;
  const raw = normalizeUnitToken(unit);
  return (
    raw.includes("cmol") ||
    raw.includes("meq") ||
    raw === "cmol(+)/kg" ||
    raw === "meq/100g"
  );
}

export function isMassConcentrationUnit(unit: string | undefined) {
  if (!unit?.trim()) return false;
  const raw = normalizeUnitToken(unit);
  return (
    raw === "ppm" ||
    raw === "mg/kg" ||
    raw === "mgkg-1" ||
    raw === "mg.kg-1" ||
    raw === "ug/g" ||
    raw === "µg/g"
  );
}

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

export function isMassOrExchangeBaseKey(parameterKey: string) {
  return MASS_OR_EXCHANGE_BASE_KEYS.has(parameterKey);
}

/**
 * Typical exchangeable Ca/Mg/K/Na in cmol(+)/kg or meq/100g stay modest.
 * Values like Ca 620, Mg 120, K 156 are almost always mg/kg (ppm).
 */
export function looksLikeMassConcentrationValue(parameterKey: string, value: number) {
  if (!Number.isFinite(value)) return false;
  if (parameterKey === "calcium") return value > 40;
  if (parameterKey === "magnesium") return value > 20;
  if (parameterKey === "potassium" || parameterKey === "sodium") return value > 8;
  if (parameterKey === "aluminum") return value > 20;
  return false;
}

export function shouldSkipMassUnitDefault(parameterKey: string) {
  return PERCENT_LIKE_KEYS.has(parameterKey);
}

/**
 * Correct mismatched unit labels: e.g. AI labeled a mg/kg base value as cmol/meq.
 */
export function reconcileReportedUnit(
  rowUnit: string | undefined,
  parameterKey: string | undefined,
  numericValue: number | undefined,
  documentContext: DocumentUnitContext = {}
): string | undefined {
  const trimmed = rowUnit?.trim() || undefined;
  if (!parameterKey) return trimmed;

  const prefersMassDefault = Boolean(documentContext.defaultMassUnit);
  const massDefault = documentContext.defaultMassUnit || "mg/kg";

  if (
    isMassOrExchangeBaseKey(parameterKey) &&
    numericValue !== undefined &&
    looksLikeMassConcentrationValue(parameterKey, numericValue)
  ) {
    if (!trimmed || isExchangeCationUnit(trimmed)) {
      return isMassConcentrationUnit(trimmed) ? trimmed : massDefault;
    }
  }

  if (
    prefersMassDefault &&
    isMassOrExchangeBaseKey(parameterKey) &&
    isExchangeCationUnit(trimmed) &&
    numericValue !== undefined &&
    looksLikeMassConcentrationValue(parameterKey, numericValue)
  ) {
    return massDefault;
  }

  return trimmed;
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
  const reconciled = reconcileReportedUnit(
    rowUnit,
    parameterKey,
    numericValue,
    documentContext
  );
  if (reconciled?.trim()) return reconciled.trim();
  if (!parameterKey || shouldSkipMassUnitDefault(parameterKey)) return undefined;

  const isCation = isCationParameterKey(parameterKey);
  const isBase = isMassOrExchangeBaseKey(parameterKey);

  if (documentContext.defaultMassUnit) {
    if (!isCation || looksLikeMassConcentrationValue(parameterKey, numericValue ?? NaN)) {
      return documentContext.defaultMassUnit;
    }
    // Bases with small values under a mass document default still use mass when
    // the report's primary system is ppm/mg/kg (dual-column labs).
    if (isBase && documentContext.defaultMassUnit) {
      return documentContext.defaultMassUnit;
    }
  }

  if (
    isBase &&
    numericValue !== undefined &&
    looksLikeMassConcentrationValue(parameterKey, numericValue)
  ) {
    return "mg/kg";
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

export type ParsedReportRange = {
  min: number | null;
  max: number | null;
  raw: string;
};

/**
 * Parse lab-report optimal/reference range text into min/max for interpretation.
 * Supports "10-20", "10 – 20", "10 a 20", "<5", ">10", and two numbers in a phrase.
 */
export function parseReportReferenceRange(
  range?: string | null
): ParsedReportRange | null {
  const raw = String(range || "").trim();
  if (!raw) return null;

  const normalized = raw
    .replace(/,/g, ".")
    .replace(/[–—−]/g, "-")
    .replace(/\b(mg\/kg|mg\s*kg-?1|ppm|ug\/g|cmol(?:\(\+\)|\+)?\/kg|meq\/100\s*g|%|ds\/m|ms\/cm|mmhos\/cm)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  const lessThan = normalized.match(/^(?:<|≤|<=)\s*([+-]?\d+(?:\.\d+)?)\s*$/);
  if (lessThan) {
    const max = Number(lessThan[1]);
    return Number.isFinite(max) ? { min: null, max, raw } : null;
  }

  const greaterThan = normalized.match(/^(?:>|≥|>=)\s*([+-]?\d+(?:\.\d+)?)\s*$/);
  if (greaterThan) {
    const min = Number(greaterThan[1]);
    return Number.isFinite(min) ? { min, max: null, raw } : null;
  }

  const spanned = normalized.match(
    /([+-]?\d+(?:\.\d+)?)\s*(?:-|to|a|até|hasta|au|à)\s*([+-]?\d+(?:\.\d+)?)/i
  );
  if (spanned) {
    const left = Number(spanned[1]);
    const right = Number(spanned[2]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) return null;
    return { min: Math.min(left, right), max: Math.max(left, right), raw };
  }

  const numbers = [...normalized.matchAll(/[+-]?\d+(?:\.\d+)?/g)]
    .map((match) => Number(match[0]))
    .filter((value) => Number.isFinite(value));
  if (numbers.length >= 2) {
    return {
      min: Math.min(numbers[0], numbers[1]),
      max: Math.max(numbers[0], numbers[1]),
      raw,
    };
  }

  return null;
}
