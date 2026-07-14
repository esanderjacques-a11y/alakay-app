import {
  TABLE_1_BY_EXTRACTANT,
  type Extractant,
  type Table1Parameter,
} from "@/lib/soilFertilityTables";

export type ExtractionMethod = "general" | "olsen" | "mehlich" | "bray";

export const EXTRACTION_METHOD_OPTIONS: ExtractionMethod[] = [
  "general",
  "olsen",
  "mehlich",
  "bray",
];

/**
 * Soil / foliar setup & values — always available for every crop (including General):
 * crop-specific sufficiency ranges (`general`), Olsen, Mehlich.
 */
export const SOIL_EXTRACTION_OPTIONS: ExtractionMethod[] = [
  "general",
  "olsen",
  "mehlich",
];

/** Same chips for foliar analyses. */
export const FOLIAR_EXTRACTION_OPTIONS: ExtractionMethod[] = SOIL_EXTRACTION_OPTIONS;

/** @deprecated Prefer SOIL_EXTRACTION_OPTIONS — same list, kept for callers. */
export const GENERAL_CROP_EXTRACTION_OPTIONS = SOIL_EXTRACTION_OPTIONS;

/** @deprecated Prefer FOLIAR_EXTRACTION_OPTIONS (includes General too). */
export const FOLIAR_SKIP_CROP_EXTRACTION_OPTIONS: ExtractionMethod[] = [
  "olsen",
  "mehlich",
];

type ParameterLike = {
  parameter_id: number | null;
  parameter_name: string;
  display_name: string;
  symbol: string | null;
  parameter_key?: string | null;
};

const EXTRACTOR_KEYWORDS: Record<Exclude<ExtractionMethod, "general">, string[]> = {
  olsen: ["olsen", "p-olsen", "fosforo olsen", "phosphorus olsen"],
  mehlich: ["mehlich", "melich", "p-mehlich", "fosforo mehlich"],
  bray: ["bray", "p-bray", "fosforo bray"],
};

const PARAMETER_KEY_TO_TABLE1: Record<string, Table1Parameter> = {
  ph: "ph",
  ph_h2o: "ph",
  ph_water: "ph",
  ph_agua: "ph",
  calcium: "ca",
  ca: "ca",
  magnesium: "mg",
  mg: "mg",
  potassium: "k",
  k: "k",
  sodium: "na",
  na: "na",
  phosphorus: "p",
  p: "p",
  phosphorus_olsen: "p",
  phosphorus_mehlich: "p",
  phosphorus_bray: "p",
  sulfur: "s",
  s: "s",
  sulphate: "s",
  sulfate: "s",
  iron: "fe",
  fe: "fe",
  copper: "cu",
  cu: "cu",
  zinc: "zn",
  zn: "zn",
  manganese: "mn",
  mn: "mn",
  exchangeable_acidity: "acidez_extraible",
  acidez_extraible: "acidez_extraible",
  acidez_intercambiable: "acidez_extraible",
  h_al: "acidez_extraible",
};

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().:/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isPhosphorusParameter(parameter: ParameterLike) {
  const haystack = normalizeToken(
    `${parameter.parameter_name} ${parameter.display_name} ${parameter.symbol || ""}`
  );
  return /\b(p|phosphorus|fosforo|phosphore)\b/.test(haystack);
}

/** Map a lab parameter to a Tabla N.° 1 row key, if any. */
export function resolveTable1Parameter(
  parameter: ParameterLike
): Table1Parameter | null {
  const key = normalizeToken(parameter.parameter_key || "").replace(/\s+/g, "_");
  if (key && PARAMETER_KEY_TO_TABLE1[key]) {
    return PARAMETER_KEY_TO_TABLE1[key];
  }

  const haystack = normalizeToken(
    `${parameter.parameter_name} ${parameter.display_name} ${parameter.symbol || ""} ${parameter.parameter_key || ""}`
  );

  if (
    /\b(acidez extraible|acidez intercambiable|exchangeable acidity|extractable acidity|h\+al|h al)\b/.test(
      haystack
    ) ||
    haystack === "ae"
  ) {
    return "acidez_extraible";
  }

  // Word-boundary \bph\b — must not match "phosphorus".
  if (
    /\bph\b/.test(haystack) &&
    !/\b(phosphorus|phosphate|phosphore|fosforo|fosfato)\b/.test(haystack)
  ) {
    return "ph";
  }

  if (/\b(p|phosphorus|fosforo|phosphore)\b/.test(haystack)) return "p";
  if (/\b(k|potassium|potasio)\b/.test(haystack)) return "k";
  if (/\b(ca|calcium|calcio)\b/.test(haystack)) return "ca";
  if (/\b(mg|magnesium|magnesio)\b/.test(haystack)) return "mg";
  if (/\b(na|sodium|sodio)\b/.test(haystack)) return "na";
  if (!/\b(saturation|saturacion|base)\b/.test(haystack)) {
    if (/\b(sulfur|azufre|soufre|sulphate|sulfate)\b/.test(haystack)) return "s";
    if (
      haystack === "s" ||
      /\bs\b/.test(normalizeToken(parameter.symbol || ""))
    ) {
      return "s";
    }
  }
  if (/\b(fe|iron|hierro|fer)\b/.test(haystack)) return "fe";
  if (/\b(cu|copper|cobre|cuivre)\b/.test(haystack)) return "cu";
  if (/\b(zn|zinc)\b/.test(haystack)) return "zn";
  if (/\b(mn|manganese|manganeso)\b/.test(haystack)) return "mn";

  return null;
}

export function getDefaultExtractionMethod(input: {
  isGeneralCrop: boolean;
  sampleType: "soil" | "foliar";
}): ExtractionMethod {
  // Prefer method-specific ranges by default for foliar and for General soil.
  if (input.sampleType === "foliar") return "mehlich";
  if (input.isGeneralCrop) return "olsen";
  return "general";
}

export function extractionMethodToExtractant(
  method: ExtractionMethod
): Extractant | null {
  if (method === "olsen") return "olsen_kcl";
  if (method === "mehlich") return "mehlich3";
  return null;
}

function table1SourceName(extractant: Extractant) {
  return extractant === "olsen_kcl"
    ? "Tabla N.° 1 — Olsen Modificado / KCl 1N"
    : "Tabla N.° 1 — Mehlich III";
}

/** Tabla N.° 1 adequate band for the selected extractant + parameter, if present. */
export function table1SufficientRange(
  method: ExtractionMethod,
  parameter: ParameterLike
): {
  min: number;
  max: number;
  unit: string;
  extractant: Extractant;
  sourceName: string;
  table1Parameter: Table1Parameter;
} | null {
  const extractant = extractionMethodToExtractant(method);
  if (!extractant) return null;
  const table1Key = resolveTable1Parameter(parameter);
  if (!table1Key) return null;
  const row = TABLE_1_BY_EXTRACTANT[extractant].find(
    (item) => item.parameter === table1Key
  );
  if (!row) return null;
  return {
    min: row.adequateMin,
    max: row.adequateMax,
    unit: row.unit || (table1Key === "ph" ? "" : "mg/kg"),
    extractant,
    sourceName: table1SourceName(extractant),
    table1Parameter: table1Key,
  };
}

/** @deprecated Prefer table1SufficientRange — P-only helper kept for callers. */
export function table1PhosphorusSufficientRange(method: ExtractionMethod): {
  min: number;
  max: number;
  unit: string;
  extractant: Extractant;
  sourceName: string;
} | null {
  return table1SufficientRange(method, {
    parameter_id: null,
    parameter_name: "phosphorus",
    display_name: "P",
    symbol: "P",
    parameter_key: "phosphorus",
  });
}

export function resolveInterpretationParameter(
  parameter: ParameterLike,
  allParameters: ParameterLike[],
  extractionMethod: ExtractionMethod
): ParameterLike {
  if (extractionMethod === "general" || !isPhosphorusParameter(parameter)) {
    return parameter;
  }

  const keywords = EXTRACTOR_KEYWORDS[extractionMethod];
  const match = allParameters.find((candidate) => {
    if (candidate.parameter_id === parameter.parameter_id) return false;
    const haystack = normalizeToken(
      `${candidate.parameter_name} ${candidate.display_name} ${candidate.symbol || ""}`
    );
    return keywords.some((keyword) => haystack.includes(keyword));
  });

  return match || parameter;
}

export function extractionMethodUsesGeneralFallback(
  parameter: ParameterLike,
  resolved: ParameterLike
) {
  return isPhosphorusParameter(parameter) && resolved.parameter_id === parameter.parameter_id;
}

/**
 * Prefer Tabla 1 Olsen/Mehlich bands for soil whenever Olsen or Mehlich is
 * selected and the parameter exists in that extractant's Tabla N.° 1 column —
 * overrides crop sufficiency (including named crops and General).
 * Crop-specific (`general`) keeps DB crop sufficiency ranges.
 * Foliar keeps DB / method-specific catalog ranges only (no soil Tabla 1).
 * Parameters absent from Tabla 1 for that extractant (e.g. Na/S under Olsen, OM)
 * keep crop/general ranges.
 */
export function shouldApplyTable1Range(input: {
  extractionMethod: ExtractionMethod;
  parameter: ParameterLike;
  sampleType?: "soil" | "foliar";
}): boolean {
  if (input.sampleType === "foliar") return false;
  return table1SufficientRange(input.extractionMethod, input.parameter) != null;
}

/** @deprecated Prefer shouldApplyTable1Range — P-only gate kept for callers. */
export function shouldApplyTable1PhosphorusRange(input: {
  extractionMethod: ExtractionMethod;
  parameter: ParameterLike;
  sampleType?: "soil" | "foliar";
  isGeneralCrop?: boolean;
  resolved?: ParameterLike;
}) {
  if (!isPhosphorusParameter(input.parameter)) return false;
  return shouldApplyTable1Range(input);
}
