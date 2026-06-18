export type ExtractionMethod = "general" | "olsen" | "mehlich" | "bray";

export const EXTRACTION_METHOD_OPTIONS: ExtractionMethod[] = [
  "general",
  "olsen",
  "mehlich",
  "bray",
];

/** General crop (999) on setup — no Bray */
export const GENERAL_CROP_EXTRACTION_OPTIONS: ExtractionMethod[] = [
  "general",
  "olsen",
  "mehlich",
];

/** Skip crop + foliar on values — Olsen or Mehlich only */
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

function isPhosphorusParameter(parameter: ParameterLike) {
  const haystack = normalizeToken(
    `${parameter.parameter_name} ${parameter.display_name} ${parameter.symbol || ""}`
  );
  return /\b(p|phosphorus|fosforo|phosphore)\b/.test(haystack);
}

export function getDefaultExtractionMethod(input: {
  isGeneralCrop: boolean;
  sampleType: "soil" | "foliar";
}): ExtractionMethod {
  if (!input.isGeneralCrop) return "general";
  return input.sampleType === "foliar" ? "mehlich" : "olsen";
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
