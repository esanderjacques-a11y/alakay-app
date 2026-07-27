/** Canonical sample-type codes used across UI, settings, and DB. */
export type SampleTypeCode = "soil" | "foliar" | "water";

export const SAMPLE_TYPE_IDS = {
  soil: 1,
  foliar: 2,
  water: 3,
} as const;

export function sampleTypeToId(code: SampleTypeCode | string | null | undefined): number {
  if (code === "foliar") return SAMPLE_TYPE_IDS.foliar;
  if (code === "water") return SAMPLE_TYPE_IDS.water;
  return SAMPLE_TYPE_IDS.soil;
}

export function sampleTypeFromId(
  id: number | null | undefined
): SampleTypeCode {
  if (id === SAMPLE_TYPE_IDS.foliar) return "foliar";
  if (id === SAMPLE_TYPE_IDS.water) return "water";
  return "soil";
}

export function isSampleTypeCode(value: unknown): value is SampleTypeCode {
  return value === "soil" || value === "foliar" || value === "water";
}

/** Normalize import/OCR labels into a sample type code. */
export function detectSampleTypeFromLabel(
  raw: string | null | undefined
): SampleTypeCode | null {
  const text = String(raw || "")
    .trim()
    .toLowerCase();
  if (!text) return null;
  if (
    /\b(water|agua|irrigation|riego|hydropon|hidropon|nutrient\s*solution|soluci[oó]n\s*nutritiva)\b/.test(
      text
    )
  ) {
    return "water";
  }
  if (/\b(foliar|leaf|tejido|tissue|folha|feuille)\b/.test(text)) {
    return "foliar";
  }
  if (/\b(soil|suelo|sol|terre|solo)\b/.test(text)) {
    return "soil";
  }
  return null;
}
