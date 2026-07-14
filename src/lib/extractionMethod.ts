import {
  TABLE_1_BY_EXTRACTANT,
  type Extractant,
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
};

const EXTRACTOR_KEYWORDS: Record<Exclude<ExtractionMethod, "general">, string[]> = {
  olsen: ["olsen", "p-olsen", "fosforo olsen", "phosphorus olsen"],
  mehlich: ["mehlich", "melich", "p-mehlich", "fosforo mehlich"],
  bray: ["bray", "p-bray", "fosforo bray"],
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

export function getDefaultExtractionMethod(input: {
  isGeneralCrop: boolean;
  sampleType: "soil" | "foliar";
}): ExtractionMethod {
  // Prefer method-specific P ranges by default for foliar and for General soil.
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

/** Tabla N.° 1 phosphate adequate band for the selected extractant. */
export function table1PhosphorusSufficientRange(method: ExtractionMethod): {
  min: number;
  max: number;
  unit: string;
  extractant: Extractant;
  sourceName: string;
} | null {
  const extractant = extractionMethodToExtractant(method);
  if (!extractant) return null;
  const row = TABLE_1_BY_EXTRACTANT[extractant].find(
    (item) => item.parameter === "p"
  );
  if (!row) return null;
  return {
    min: row.adequateMin,
    max: row.adequateMax,
    unit: row.unit || "mg/kg",
    extractant,
    sourceName:
      extractant === "olsen_kcl"
        ? "Tabla N.° 1 — Olsen Modificado / KCl 1N"
        : "Tabla N.° 1 — Mehlich III",
  };
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
 * Prefer Tabla 1 Olsen/Mehlich P bands for soil when the crop is General or the
 * method-specific catalog parameter has no dedicated range.
 * Foliar keeps DB / method-specific catalog ranges only (no soil Tabla 1).
 */
export function shouldApplyTable1PhosphorusRange(input: {
  extractionMethod: ExtractionMethod;
  isGeneralCrop: boolean;
  parameter: ParameterLike;
  resolved: ParameterLike;
  sampleType?: "soil" | "foliar";
}) {
  if (input.sampleType === "foliar") return false;
  if (!isPhosphorusParameter(input.parameter)) return false;
  if (!extractionMethodToExtractant(input.extractionMethod)) return false;
  if (input.isGeneralCrop) return true;
  return extractionMethodUsesGeneralFallback(input.parameter, input.resolved);
}
