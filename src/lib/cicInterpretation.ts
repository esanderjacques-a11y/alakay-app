/**
 * CIC / base saturation interpretation ranges.
 * Source: Tutoría Plan nutricional (SUE302, Diego R. Villaseñor-Ortiz)
 * Tabla N.° 2 (p. 11): cation % saturation bands (Ca, Mg, K, Na, Al)
 * Tabla N.° 3 (p. 11): cationic ratios (Ca/Mg, Ca/K, Mg/K, (Ca+Mg)/K)
 * V% note (p. 3): 75–80% adequate for tropical crops
 *
 * K/Na and Ca/Na are not in Tabla N.° 3; thresholds follow the same
 * deficiency-risk logic as Ca/K (Tabla N.° 3) combined with Na % bands (Tabla N.° 2).
 *
 * Bands and ratio ranges default to the hardcoded Tabla N.° 2 / N.° 3 values but can
 * be overridden with data fetched from `sf_cic_saturation_band` / `sf_cic_ratio_range`
 * (see soilFertilityData.ts) so edits made in Supabase propagate without a code change.
 */

import type { BaseRelationKey } from "@/lib/baseSaturation";
import {
  TABLE_2_ADEQUATE_SATURATION,
  TABLE_2_CIC_SATURATION_BANDS,
  TABLE_3_CIC_RATIO_RANGES,
  type CicCation,
  type CicRatioRangeTable,
  type CicSaturationBand,
  type CicSaturationBandRow,
  type CicSaturationBandTable,
} from "@/lib/soilFertilityTables";

export type { CicSaturationBand };

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

/** Tabla N.° 2 — adequate (Adecuado) columns used as primary targets elsewhere. */
export const CIC_ADEQUATE_SATURATION = TABLE_2_ADEQUATE_SATURATION;

/** Tabla N.° 3 optimal ranges and deficiency-risk thresholds (hardcoded fallback). */
export const CIC_RATIO_RANGES = TABLE_3_CIC_RATIO_RANGES;

function matchSaturationBand(value: number, bands: CicSaturationBandRow[]): CicSaturationInterpretation {
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
  cation: CicCation,
  percent: number,
  bands: CicSaturationBandTable = TABLE_2_CIC_SATURATION_BANDS
): CicSaturationInterpretation {
  return matchSaturationBand(percent, bands[cation]);
}

export function interpretCationRatio(
  relation: Exclude<BaseRelationKey, "all">,
  value: number | null,
  ranges: CicRatioRangeTable = TABLE_3_CIC_RATIO_RANGES
): CicRatioInterpretation {
  const config = ranges[relation];
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
