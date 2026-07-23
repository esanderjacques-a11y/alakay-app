import {
  TABLE_1_BY_EXTRACTANT,
  TABLE_6_CMOL_TO_MGKG,
  type Extractant,
  type Table1Parameter,
} from "@/lib/soilFertilityTables";
import { canConvertLabUnit, convertLabUnit } from "@/lib/unitConversions";

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

const SYMBOL_TO_TABLE1: Record<string, Table1Parameter> = {
  ph: "ph",
  "ph h2o": "ph",
  "ph water": "ph",
  ca: "ca",
  mg: "mg",
  k: "k",
  na: "na",
  p: "p",
  s: "s",
  fe: "fe",
  cu: "cu",
  zn: "zn",
  mn: "mn",
  ae: "acidez_extraible",
  "h+al": "acidez_extraible",
  "al+h": "acidez_extraible",
};

/** Map a lab parameter to a Tabla N.° 1 row key, if any. */
export function resolveTable1Parameter(
  parameter: ParameterLike
): Table1Parameter | null {
  const key = normalizeToken(parameter.parameter_key || "").replace(/\s+/g, "_");
  if (key && PARAMETER_KEY_TO_TABLE1[key]) {
    return PARAMETER_KEY_TO_TABLE1[key];
  }

  const symbol = normalizeToken(parameter.symbol || "");
  if (symbol && SYMBOL_TO_TABLE1[symbol]) {
    return SYMBOL_TO_TABLE1[symbol];
  }

  const haystack = normalizeToken(
    `${parameter.parameter_name} ${parameter.display_name} ${parameter.parameter_key || ""}`
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

  // Prefer full nutrient names before single-letter matches to avoid
  // mangling unrelated parameters (OM, BS, Al, CEC, etc.).
  if (/\b(phosphorus|fosforo|phosphore|phosphate|fosfato)\b/.test(haystack)) {
    return "p";
  }
  if (/\b(potassium|potasio|potassium exchangeable)\b/.test(haystack)) {
    return "k";
  }
  if (/\b(calcium|calcio)\b/.test(haystack)) return "ca";
  if (/\b(magnesium|magnesio)\b/.test(haystack)) return "mg";
  if (/\b(sodium|sodio)\b/.test(haystack)) return "na";
  if (
    !/\b(saturation|saturacion|base)\b/.test(haystack) &&
    /\b(sulfur|azufre|soufre|sulphate|sulfate)\b/.test(haystack)
  ) {
    return "s";
  }
  if (/\b(iron|hierro|fer)\b/.test(haystack)) return "fe";
  if (/\b(copper|cobre|cuivre)\b/.test(haystack)) return "cu";
  if (/\b(zinc)\b/.test(haystack)) return "zn";
  if (/\b(manganese|manganeso)\b/.test(haystack)) return "mn";

  // Single-letter tokens only when they stand alone as the main label.
  if (/^(p|phosphorus)$/.test(haystack) || haystack === "p") return "p";
  if (/^(k|potassium|potasio)$/.test(haystack)) return "k";
  if (/^(ca|calcium|calcio)$/.test(haystack)) return "ca";
  if (/^(mg|magnesium|magnesio)$/.test(haystack)) return "mg";
  if (/^(na|sodium|sodio)$/.test(haystack)) return "na";
  if (/^(s|sulfur|azufre)$/.test(haystack)) return "s";
  if (/^(fe|iron|hierro)$/.test(haystack)) return "fe";
  if (/^(cu|copper|cobre)$/.test(haystack)) return "cu";
  if (/^(zn|zinc)$/.test(haystack)) return "zn";
  if (/^(mn|manganese|manganeso)$/.test(haystack)) return "mn";

  return null;
}

function cleanUnitToken(unit: string) {
  return unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u00b5\u03bc]/g, "u");
}

function isCmolUnit(unit: string) {
  const u = cleanUnitToken(unit);
  return (
    u.includes("cmol") ||
    u.includes("meq/100g") ||
    u.includes("meq100g") ||
    u === "meq/100g"
  );
}

function isMgPerKgUnit(unit: string) {
  const u = cleanUnitToken(unit);
  return (
    u === "mg/kg" ||
    u === "mgkg-1" ||
    u === "mg.kg-1" ||
    u === "ppm" ||
    u === "ug/g"
  );
}

/**
 * Convert a Tabla N.° 1 band into the user's display unit.
 * Returns null when conversion is impossible so callers can fall back to
 * crop / general sufficiency ranges.
 */
export function convertTable1RangeToDisplayUnit(
  range: {
    min: number;
    max: number;
    unit: string;
    table1Parameter: Table1Parameter;
  },
  displayUnit: string
): { min: number; max: number; unit: string } | null {
  const fromUnit = range.unit || "";
  const toUnit = displayUnit || "";

  if (!toUnit || !fromUnit || cleanUnitToken(fromUnit) === cleanUnitToken(toUnit)) {
    return { min: range.min, max: range.max, unit: toUnit || fromUnit };
  }

  if (canConvertLabUnit(fromUnit, toUnit)) {
    const minConverted = convertLabUnit(range.min, fromUnit, toUnit);
    const maxConverted = convertLabUnit(range.max, fromUnit, toUnit);
    if (!minConverted || !maxConverted) return null;
    return {
      min: minConverted.value,
      max: maxConverted.value,
      unit: toUnit,
    };
  }

  const factor =
    range.table1Parameter === "ca" ||
    range.table1Parameter === "mg" ||
    range.table1Parameter === "k" ||
    range.table1Parameter === "na"
      ? TABLE_6_CMOL_TO_MGKG[range.table1Parameter]
      : null;

  if (factor && isCmolUnit(fromUnit) && isMgPerKgUnit(toUnit)) {
    return {
      min: range.min * factor,
      max: range.max * factor,
      unit: toUnit,
    };
  }

  if (factor && isMgPerKgUnit(fromUnit) && isCmolUnit(toUnit)) {
    return {
      min: range.min / factor,
      max: range.max / factor,
      unit: toUnit,
    };
  }

  return null;
}

export function getDefaultExtractionMethod(input: {
  isGeneralCrop: boolean;
  sampleType: "soil" | "foliar";
}): ExtractionMethod {
  // Foliar has no soil extractant; interpretation uses crop sufficiency ranges.
  if (input.sampleType === "foliar") return "general";
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
    ? "Olsen Modified / KCl 1N"
    : "Mehlich III";
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
