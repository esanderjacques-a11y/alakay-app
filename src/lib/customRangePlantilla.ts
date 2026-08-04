/**
 * Custom range plantillas (named sets of Parameter | Min | Max rows)
 * plus optional CIC adequate-band overrides.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  TABLE_2_ADEQUATE_SATURATION,
  TABLE_2_CIC_SATURATION_BANDS,
  TABLE_3_CIC_RATIO_RANGES,
  type CicCation,
  type CicRatioRangeTable,
  type CicSaturationBandTable,
  type CicRelationKey,
} from "@/lib/soilFertilityTables";

export const ACTIVE_RANGE_SET_STORAGE_KEY = "cultosol_active_range_set_id";

export type RangeBoundMode = "min_max" | "max_only" | "min_only";

export type CicOverrideBand = {
  min: number | null;
  max: number | null;
};

export type CicOverrides = {
  ca?: CicOverrideBand;
  mg?: CicOverrideBand;
  k?: CicOverrideBand;
  na?: CicOverrideBand;
  totalBases?: CicOverrideBand;
  ca_mg?: CicOverrideBand;
  ca_k?: CicOverrideBand;
  mg_k?: CicOverrideBand;
  k_na?: CicOverrideBand;
  ca_na?: CicOverrideBand;
};

export type CustomRangeSet = {
  range_set_id: number;
  user_id: string;
  name: string;
  sample_type: "soil" | "foliar" | "water";
  crop_id: number | null;
  cic_overrides: CicOverrides;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  deleted_at: string | null;
};

export type PlantillaRowDraft = {
  key: string;
  kind: "official" | "custom";
  parameterId: number;
  name: string;
  symbol: string | null;
  unitId: number | null;
  unitSymbol: string;
  boundMode: RangeBoundMode;
  min: string;
  max: string;
  existingRangeId: number | null;
};

export type CicPlantillaRow = {
  key: keyof CicOverrides;
  label: string;
  unit: string;
  min: string;
  max: string;
};

export const CIC_PLANTILLA_KEYS: Array<{
  key: keyof CicOverrides;
  labelEn: string;
  labelEs: string;
  unit: string;
}> = [
  { key: "ca", labelEn: "Ca saturation", labelEs: "Saturación Ca", unit: "%" },
  { key: "mg", labelEn: "Mg saturation", labelEs: "Saturación Mg", unit: "%" },
  { key: "k", labelEn: "K saturation", labelEs: "Saturación K", unit: "%" },
  { key: "na", labelEn: "Na saturation", labelEs: "Saturación Na", unit: "%" },
  { key: "totalBases", labelEn: "Total bases (V%)", labelEs: "Bases totales (V%)", unit: "%" },
  { key: "ca_mg", labelEn: "Ca/Mg ratio", labelEs: "Relación Ca/Mg", unit: "" },
  { key: "ca_k", labelEn: "Ca/K ratio", labelEs: "Relación Ca/K", unit: "" },
  { key: "mg_k", labelEn: "Mg/K ratio", labelEs: "Relación Mg/K", unit: "" },
  { key: "k_na", labelEn: "K/Na ratio", labelEs: "Relación K/Na", unit: "" },
  { key: "ca_na", labelEn: "Ca/Na ratio", labelEs: "Relación Ca/Na", unit: "" },
];

function normalizeToken(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().:/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Bound mode for plantilla rows — max-only thresholds vs full bands. */
export function getParameterBoundMode(input: {
  parameter_name: string;
  symbol?: string | null;
  category?: string | null;
}): RangeBoundMode {
  const haystack = normalizeToken(
    `${input.parameter_name} ${input.symbol || ""} ${input.category || ""}`
  );

  if (
    /\b(al|aluminum|aluminium|aluminio)\b/.test(haystack) ||
    haystack.includes("acidez extraible") ||
    haystack.includes("acidez intercambiable") ||
    haystack.includes("exchangeable acidity") ||
    haystack.includes("extractable acidity") ||
    /\bh\s*\+\s*al\b/.test(haystack) ||
    haystack.includes("electrical conductivity") ||
    haystack === "ec" ||
    haystack.includes("conductividad electrica") ||
    haystack.includes("bulk density") ||
    haystack.includes("densidad aparente")
  ) {
    return "max_only";
  }

  return "min_max";
}

export function parseOptionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : Number.NaN;
}

export function rowHasValues(min: string, max: string): boolean {
  return min.trim() !== "" || max.trim() !== "";
}

export function classifyFromPlantillaBand(
  value: number,
  min: number | null,
  max: number | null
): "bajo" | "adecuado" | "alto" {
  if (min !== null && value < min) return "bajo";
  if (max !== null && value > max) return "alto";
  return "adecuado";
}

export function getActiveRangeSetId(): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(ACTIVE_RANGE_SET_STORAGE_KEY);
    if (!raw) return null;
    const id = Number(raw);
    return Number.isFinite(id) ? id : null;
  } catch {
    return null;
  }
}

export function setActiveRangeSetId(id: number | null) {
  if (typeof window === "undefined") return;
  if (id === null) {
    window.localStorage.removeItem(ACTIVE_RANGE_SET_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_RANGE_SET_STORAGE_KEY, String(id));
}

export function emptyCicPlantillaRows(language: string): CicPlantillaRow[] {
  return CIC_PLANTILLA_KEYS.map((item) => ({
    key: item.key,
    label: language === "es" ? item.labelEs : item.labelEn,
    unit: item.unit,
    min: "",
    max: "",
  }));
}

export function cicOverridesToRows(
  overrides: CicOverrides | null | undefined,
  language: string
): CicPlantillaRow[] {
  const base = emptyCicPlantillaRows(language);
  if (!overrides) return base;
  return base.map((row) => {
    const band = overrides[row.key];
    return {
      ...row,
      min: band?.min == null ? "" : String(band.min),
      max: band?.max == null ? "" : String(band.max),
    };
  });
}

export function rowsToCicOverrides(rows: CicPlantillaRow[]): CicOverrides {
  const out: CicOverrides = {};
  for (const row of rows) {
    if (!rowHasValues(row.min, row.max)) continue;
    const min = parseOptionalNumber(row.min);
    const max = parseOptionalNumber(row.max);
    if (Number.isNaN(min as number) || Number.isNaN(max as number)) continue;
    out[row.key] = { min, max };
  }
  return out;
}

function mid(min: number, max: number) {
  return (min + max) / 2;
}

function applyAdequateBand(
  bands: CicSaturationBandTable[CicCation],
  override: CicOverrideBand | undefined
): CicSaturationBandTable[CicCation] {
  if (!override) return bands;
  const min = override.min;
  const max = override.max;
  if (min === null && max === null) return bands;
  const adequateMin = min ?? max ?? 0;
  const adequateMax = max ?? min ?? adequateMin;
  const target = mid(adequateMin, adequateMax);

  return bands.map((row) => {
    if (!row.isAdequate && row.band !== "adequate") return row;
    return {
      ...row,
      band: "adequate",
      min: adequateMin,
      max: adequateMax,
      rangeLabel: `${adequateMin}–${adequateMax}%`,
      isAdequate: true,
      target,
    };
  });
}

/** Merge plantilla CIC overrides into Tabla 2 saturation bands. */
export function mergeCicSaturationBands(
  overrides: CicOverrides | null | undefined,
  base: CicSaturationBandTable = TABLE_2_CIC_SATURATION_BANDS
): CicSaturationBandTable {
  if (!overrides || Object.keys(overrides).length === 0) return base;
  return {
    ca: applyAdequateBand(base.ca, overrides.ca),
    mg: applyAdequateBand(base.mg, overrides.mg),
    k: applyAdequateBand(base.k, overrides.k),
    na: applyAdequateBand(base.na, overrides.na),
  };
}

/** Merge plantilla CIC ratio overrides into Tabla 3. */
export function mergeCicRatioRanges(
  overrides: CicOverrides | null | undefined,
  base: CicRatioRangeTable = TABLE_3_CIC_RATIO_RANGES
): CicRatioRangeTable {
  if (!overrides || Object.keys(overrides).length === 0) return base;
  const next = { ...base };
  const keys: CicRelationKey[] = ["ca_mg", "ca_k", "mg_k", "k_na", "ca_na"];
  for (const key of keys) {
    const band = overrides[key];
    if (!band) continue;
    const min = band.min;
    const max = band.max;
    if (min === null && max === null) continue;
    next[key] = {
      ...base[key],
      optimalMin: min ?? base[key].optimalMin,
      optimalMax: max ?? base[key].optimalMax,
    };
  }
  return next;
}

type AdequateSaturationTargets = {
  ca: { min: number; max: number; target: number };
  mg: { min: number; max: number; target: number };
  k: { min: number; max: number; target: number };
  na: { min: number; max: number; target: number };
  totalBases: { min: number; max: number; target: number };
};

/** Adequate saturation targets used by amendments / base saturation helpers. */
export function mergeCicAdequateSaturation(
  overrides: CicOverrides | null | undefined
): AdequateSaturationTargets {
  const base: AdequateSaturationTargets = {
    ca: { ...TABLE_2_ADEQUATE_SATURATION.ca },
    mg: { ...TABLE_2_ADEQUATE_SATURATION.mg },
    k: { ...TABLE_2_ADEQUATE_SATURATION.k },
    na: { ...TABLE_2_ADEQUATE_SATURATION.na },
    totalBases: { ...TABLE_2_ADEQUATE_SATURATION.totalBases },
  };
  if (!overrides) return base;

  const apply = (
    key: keyof AdequateSaturationTargets,
    band: CicOverrideBand | undefined
  ) => {
    if (!band) return;
    const min = band.min ?? base[key].min;
    const max = band.max ?? base[key].max;
    base[key] = { min, max, target: mid(min, max) };
  };

  apply("ca", overrides.ca);
  apply("mg", overrides.mg);
  apply("k", overrides.k);
  apply("na", overrides.na);
  apply("totalBases", overrides.totalBases);
  return base;
}

export async function fetchCustomRangeSets(
  client: SupabaseClient,
  userId: string,
  sampleType: "soil" | "foliar" | "water",
  includeDeleted = false
): Promise<CustomRangeSet[]> {
  let query = client
    .from("user_custom_range_sets")
    .select(
      "range_set_id, user_id, name, sample_type, crop_id, cic_overrides, created_at, updated_at, is_deleted, deleted_at"
    )
    .eq("user_id", userId)
    .eq("sample_type", sampleType)
    .order("updated_at", { ascending: false });

  if (!includeDeleted) {
    query = query.eq("is_deleted", false);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data || []) as CustomRangeSet[]).map((row) => ({
    ...row,
    cic_overrides: (row.cic_overrides || {}) as CicOverrides,
  }));
}
