/**
 * CIC / base saturation interpretation ranges.
 * Source: Tutoría Plan nutricional (SUE302, Diego R. Villaseñor-Ortiz)
 * Tabla N.° 2 (p. 11): cation % saturation bands (Ca, Mg, K, Na, Al)
 * Tabla N.° 3 (p. 11): cationic ratios (Ca/Mg, Ca/K, Mg/K, (Ca+Mg)/K)
 * V% note (p. 3): 75–80% adequate for tropical crops
 *
 * K/Na and Ca/Na are not in Tabla N.° 3; thresholds follow the same
 * deficiency-risk logic as Ca/K (Tabla N.° 3) combined with Na % bands (Tabla N.° 2).
 */

import type { BaseRelationKey } from "@/lib/baseSaturation";

export type CicSaturationBand =
  | "very_low"
  | "low"
  | "moderately_low"
  | "adequate"
  | "moderately_high"
  | "high"
  | "very_high";

export type CicRatioBand = "low" | "optimal" | "high" | "unknown";

export type CicSaturationInterpretation = {
  band: CicSaturationBand;
  rangeLabel: string;
};

export type CicRatioInterpretation = {
  band: CicRatioBand;
  optimalMin: number;
  optimalMax: number;
  messageKey: string;
};

type SaturationBandRow = {
  band: CicSaturationBand;
  min?: number;
  max?: number;
  rangeLabel: string;
};

/** Tabla N.° 2 — adequate (Adecuado) columns used as primary targets elsewhere. */
export const CIC_ADEQUATE_SATURATION = {
  ca: { min: 61, max: 75, target: 68 },
  mg: { min: 11, max: 15, target: 13 },
  k: { min: 3.1, max: 4, target: 3.55 },
  na: { min: 3.1, max: 5, target: 4 },
  totalBases: { min: 75, max: 80, target: 77.5 },
} as const;

const K_BANDS: SaturationBandRow[] = [
  { band: "very_low", min: 0, max: 1, rangeLabel: "<1%" },
  { band: "low", min: 1.01, max: 2, rangeLabel: "1.1–2%" },
  { band: "moderately_low", min: 2.01, max: 3, rangeLabel: "2.1–3%" },
  { band: "adequate", min: 3.01, max: 4, rangeLabel: "3.1–4%" },
  { band: "moderately_high", min: 4.01, max: 6, rangeLabel: "4.1–6%" },
  { band: "high", min: 6.01, max: 10, rangeLabel: "6.1–10%" },
  { band: "very_high", min: 10.01, max: Infinity, rangeLabel: ">10%" },
];

const CA_BANDS: SaturationBandRow[] = [
  { band: "very_low", min: 0, max: 25, rangeLabel: "<25%" },
  { band: "low", min: 25.01, max: 40, rangeLabel: "26–40%" },
  { band: "moderately_low", min: 40.01, max: 60, rangeLabel: "41–60%" },
  { band: "adequate", min: 60.01, max: 75, rangeLabel: "61–75%" },
  { band: "moderately_high", min: 75.01, max: 80, rangeLabel: "76–80%" },
  { band: "high", min: 80.01, max: 85, rangeLabel: "81–85%" },
  { band: "very_high", min: 85.01, max: Infinity, rangeLabel: ">85%" },
];

const MG_BANDS: SaturationBandRow[] = [
  { band: "very_low", min: 0, max: 3, rangeLabel: "<3%" },
  { band: "low", min: 3.01, max: 5, rangeLabel: "4–5%" },
  { band: "moderately_low", min: 5.01, max: 10, rangeLabel: "6–10%" },
  { band: "adequate", min: 10.01, max: 15, rangeLabel: "11–15%" },
  { band: "moderately_high", min: 15.01, max: 20, rangeLabel: "16–20%" },
  { band: "high", min: 20.01, max: 30, rangeLabel: "21–30%" },
  { band: "very_high", min: 30.01, max: Infinity, rangeLabel: ">30%" },
];

const NA_BANDS: SaturationBandRow[] = [
  { band: "very_low", min: 0, max: 1, rangeLabel: "<1%" },
  { band: "low", min: 1.01, max: 2, rangeLabel: "1–2%" },
  { band: "moderately_low", min: 2.01, max: 3, rangeLabel: "2.1–3%" },
  { band: "adequate", min: 3.01, max: 5, rangeLabel: "3.1–5%" },
  { band: "moderately_high", min: 5.01, max: 10, rangeLabel: "5.1–10%" },
  { band: "high", min: 10.01, max: 20, rangeLabel: "10.1–20%" },
  { band: "very_high", min: 20.01, max: Infinity, rangeLabel: ">20%" },
];

/** Tabla N.° 3 optimal ranges and deficiency-risk thresholds. */
export const CIC_RATIO_RANGES: Record<
  Exclude<BaseRelationKey, "all">,
  { optimalMin: number; optimalMax: number; lowMessageKey: string; highMessageKey: string }
> = {
  ca_mg: {
    optimalMin: 3,
    optimalMax: 5,
    lowMessageKey: "cicRatioCaMgLow",
    highMessageKey: "cicRatioCaMgHigh",
  },
  ca_k: {
    optimalMin: 9,
    optimalMax: 25,
    lowMessageKey: "cicRatioCaKLow",
    highMessageKey: "cicRatioCaKHigh",
  },
  mg_k: {
    optimalMin: 2,
    optimalMax: 7,
    lowMessageKey: "cicRatioMgKLow",
    highMessageKey: "cicRatioMgKHigh",
  },
  k_na: {
    optimalMin: 1,
    optimalMax: 15,
    lowMessageKey: "cicRatioKNaLow",
    highMessageKey: "cicRatioKNaHigh",
  },
  ca_na: {
    optimalMin: 9,
    optimalMax: 25,
    lowMessageKey: "cicRatioCaNaLow",
    highMessageKey: "cicRatioCaNaHigh",
  },
};

function matchSaturationBand(value: number, bands: SaturationBandRow[]): CicSaturationInterpretation {
  const ordered = [...bands].sort((a, b) => (a.min ?? -Infinity) - (b.min ?? -Infinity));
  for (const row of ordered) {
    const min = row.min ?? -Infinity;
    const max = row.max ?? Infinity;
    if (value >= min && value <= max) {
      return { band: row.band, rangeLabel: row.rangeLabel };
    }
  }
  const last = ordered[ordered.length - 1];
  return { band: last?.band ?? "very_high", rangeLabel: last?.rangeLabel ?? "" };
}

export function interpretCationSaturation(
  cation: "ca" | "mg" | "k" | "na",
  percent: number
): CicSaturationInterpretation {
  const table = { ca: CA_BANDS, mg: MG_BANDS, k: K_BANDS, na: NA_BANDS }[cation];
  return matchSaturationBand(percent, table);
}

export function interpretCationRatio(
  relation: Exclude<BaseRelationKey, "all">,
  value: number | null
): CicRatioInterpretation {
  const config = CIC_RATIO_RANGES[relation];
  if (value === null || !Number.isFinite(value)) {
    return {
      band: "unknown",
      optimalMin: config.optimalMin,
      optimalMax: config.optimalMax,
      messageKey: "cicRatioUnknown",
    };
  }

  if (value < config.optimalMin) {
    return {
      band: "low",
      optimalMin: config.optimalMin,
      optimalMax: config.optimalMax,
      messageKey: config.lowMessageKey,
    };
  }

  if (value > config.optimalMax) {
    return {
      band: "high",
      optimalMin: config.optimalMin,
      optimalMax: config.optimalMax,
      messageKey: config.highMessageKey,
    };
  }

  return {
    band: "optimal",
    optimalMin: config.optimalMin,
    optimalMax: config.optimalMax,
    messageKey: "cicRatioOptimal",
  };
}

export function saturationBandMessageKey(band: CicSaturationBand): string {
  const map: Record<CicSaturationBand, string> = {
    very_low: "cicSatVeryLow",
    low: "cicSatLow",
    moderately_low: "cicSatModeratelyLow",
    adequate: "cicSatAdequate",
    moderately_high: "cicSatModeratelyHigh",
    high: "cicSatHigh",
    very_high: "cicSatVeryHigh",
  };
  return map[band];
}

export function ratioBandLabelKey(band: CicRatioBand): string {
  const map: Record<Exclude<CicRatioBand, "unknown">, string> = {
    low: "cicBandLow",
    optimal: "cicBandOptimal",
    high: "cicBandHigh",
  };
  return band === "unknown" ? "cicBandUnknown" : map[band];
}
