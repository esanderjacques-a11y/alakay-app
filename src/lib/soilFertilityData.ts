import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_SOIL_FERTILITY_REFERENCE,
  EXTRACTANT_OPTIONS,
  IRRIGATION_SYSTEM_OPTIONS,
  type AmendmentMaterialKey,
  type CicCation,
  type CicRatioRangeTable,
  type CicRelationKey,
  type CicSaturationBand,
  type CicSaturationBandTable,
  type CropExtractionCoefficients,
  type Extractant,
  type IrrigationEfficiencyTable,
  type IrrigationNutrientKey,
  type SoilFertilityReference,
  type Table1Parameter,
  type Table1Row,
} from "@/lib/soilFertilityTables";

export const SOIL_FERTILITY_SOURCE_KEY = "sue302_villasenor";
const SOIL_FERTILITY_CACHE_KEY = "cultosol_sf_reference_v1";

type NutrientRow = {
  parameter_key: string;
  label: string;
  unit: string;
  low_max: number | null;
  adequate_min: number;
  adequate_max: number;
  high_min: number | null;
  sort_order: number;
  extractant?: string | null;
};

type ConversionRow = {
  factor_key: string;
  table_number: number;
  factor: number;
};

type CropRow = {
  crop_key: string;
  label: string;
  match_patterns: string[] | null;
  n_kg_per_t: number;
  p2o5_kg_per_t: number;
  k2o_kg_per_t: number;
  cao_kg_per_t: number;
  mgo_kg_per_t: number;
  is_default: boolean;
  sort_order: number;
};

type AmendmentRow = {
  material_key: string;
  label: string;
  cao_percent: number;
  mgo_percent: number;
};

type IrrigationRow = {
  nutrient_key: string;
  irrigation_system: string;
  min_percent: number;
  max_percent: number;
};

type SaturationBandRow = {
  cation: string;
  band: string;
  min_percent: number | null;
  max_percent: number | null;
  range_label: string;
  is_adequate: boolean;
  target_percent: number | null;
};

type RatioRangeRow = {
  relation_key: string;
  optimal_min: number;
  optimal_max: number;
  low_message_key: string | null;
  high_message_key: string | null;
};

const VALID_PARAMETERS = new Set<Table1Parameter>([
  "ph",
  "acidez_extraible",
  "k",
  "ca",
  "mg",
  "na",
  "p",
  "s",
  "fe",
  "cu",
  "zn",
  "mn",
]);

const VALID_AMENDMENTS = new Set<AmendmentMaterialKey>(["cal_agricola", "yeso", "dolomita"]);
const VALID_EXTRACTANTS = new Set<Extractant>(EXTRACTANT_OPTIONS);
const VALID_IRRIGATION_SYSTEMS = new Set(IRRIGATION_SYSTEM_OPTIONS);
const VALID_CATIONS = new Set<CicCation>(["ca", "mg", "k", "na"]);
const VALID_SATURATION_BANDS = new Set<CicSaturationBand>([
  "very_low",
  "low",
  "moderately_low",
  "adequate",
  "moderately_high",
  "high",
  "very_high",
]);
const VALID_RELATIONS = new Set<CicRelationKey>(["ca_mg", "ca_k", "mg_k", "k_na", "ca_na"]);

let cachedReference: SoilFertilityReference | null = null;
let cachedFromSupabase = false;
let inflightFetch: Promise<{ reference: SoilFertilityReference; fromSupabase: boolean }> | null = null;

function mapNutrientRow(row: NutrientRow): (Table1Row & { parameter: Table1Parameter }) | null {
  if (!VALID_PARAMETERS.has(row.parameter_key as Table1Parameter)) return null;
  return {
    parameter: row.parameter_key as Table1Parameter,
    label: row.label,
    unit: row.unit,
    lowMax: row.low_max ?? undefined,
    adequateMin: row.adequate_min,
    adequateMax: row.adequate_max,
    highMin: row.high_min ?? undefined,
  };
}

function mapNutrientRowsByExtractant(
  rows: NutrientRow[]
): Record<Extractant, Table1Row[]> {
  const fallback = DEFAULT_SOIL_FERTILITY_REFERENCE.nutrientInterpretationByExtractant;
  const byExtractant: Record<Extractant, Table1Row[]> = {
    olsen_kcl: [],
    mehlich3: [],
  };

  for (const extractant of EXTRACTANT_OPTIONS) {
    const filtered = rows
      .filter((row) => row.extractant === extractant)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(mapNutrientRow)
      .filter((row): row is Table1Row & { parameter: Table1Parameter } => row !== null);

    byExtractant[extractant] = filtered.length >= 8 ? filtered : fallback[extractant];
  }

  return byExtractant;
}

function mapConversionRows(rows: ConversionRow[]) {
  const fallback = DEFAULT_SOIL_FERTILITY_REFERENCE;
  const byKey = new Map(rows.map((row) => [row.factor_key, row.factor]));

  return {
    oxideFactors: {
      pToP2o5: byKey.get("p_to_p2o5") ?? fallback.oxideFactors.pToP2o5,
      kToK2o: byKey.get("k_to_k2o") ?? fallback.oxideFactors.kToK2o,
      caToCao: byKey.get("ca_to_cao") ?? fallback.oxideFactors.caToCao,
      mgToMgo: byKey.get("mg_to_mgo") ?? fallback.oxideFactors.mgToMgo,
      nToN: byKey.get("n_to_n") ?? fallback.oxideFactors.nToN,
    },
    cmolToMgKg: {
      ca: byKey.get("cmol_ca_to_mgkg") ?? fallback.cmolToMgKg.ca,
      mg: byKey.get("cmol_mg_to_mgkg") ?? fallback.cmolToMgKg.mg,
      k: byKey.get("cmol_k_to_mgkg") ?? fallback.cmolToMgKg.k,
      na: byKey.get("cmol_na_to_mgkg") ?? fallback.cmolToMgKg.na,
    },
  };
}

function mapCropRows(rows: CropRow[]) {
  const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order);
  const defaultRow = sorted.find((row) => row.is_default) || sorted[sorted.length - 1];
  const cropExtraction: CropExtractionCoefficients[] = sorted
    .filter((row) => !row.is_default)
    .map((row) => ({
      cropKey: row.crop_key,
      label: row.label,
      patterns: (row.match_patterns || [])
        .map((pattern) => {
          try {
            return new RegExp(pattern, "i");
          } catch {
            return null;
          }
        })
        .filter((pattern): pattern is RegExp => pattern instanceof RegExp),
      n: row.n_kg_per_t,
      p2o5: row.p2o5_kg_per_t,
      k2o: row.k2o_kg_per_t,
      cao: row.cao_kg_per_t,
      mgo: row.mgo_kg_per_t,
    }));

  const defaultExtraction = defaultRow
    ? {
        label: defaultRow.label,
        n: defaultRow.n_kg_per_t,
        p2o5: defaultRow.p2o5_kg_per_t,
        k2o: defaultRow.k2o_kg_per_t,
        cao: defaultRow.cao_kg_per_t,
        mgo: defaultRow.mgo_kg_per_t,
      }
    : DEFAULT_SOIL_FERTILITY_REFERENCE.defaultExtraction;

  return { cropExtraction, defaultExtraction };
}

function mapAmendmentRows(rows: AmendmentRow[]) {
  const fallback = DEFAULT_SOIL_FERTILITY_REFERENCE.amendments;
  const mapped = { ...fallback };

  for (const row of rows) {
    if (!VALID_AMENDMENTS.has(row.material_key as AmendmentMaterialKey)) continue;
    const key = row.material_key as AmendmentMaterialKey;
    mapped[key] = {
      key,
      label: row.label,
      caoPercent: row.cao_percent,
      mgoPercent: row.mgo_percent,
    };
  }

  return mapped;
}

function mapIrrigationRows(rows: IrrigationRow[]): IrrigationEfficiencyTable {
  const fallback = DEFAULT_SOIL_FERTILITY_REFERENCE.irrigationEfficiency;
  const mapped: IrrigationEfficiencyTable = {
    surco_inundacion: { ...fallback.surco_inundacion },
    aspersion_pivote: { ...fallback.aspersion_pivote },
    goteo_microaspersion: { ...fallback.goteo_microaspersion },
  };

  for (const row of rows) {
    if (!VALID_IRRIGATION_SYSTEMS.has(row.irrigation_system as (typeof IRRIGATION_SYSTEM_OPTIONS)[number])) continue;
    const system = row.irrigation_system as (typeof IRRIGATION_SYSTEM_OPTIONS)[number];
    const nutrient = row.nutrient_key as IrrigationNutrientKey;
    mapped[system] = {
      ...mapped[system],
      [nutrient]: { min: row.min_percent, max: row.max_percent },
    };
  }

  return mapped;
}

function mapSaturationBandRows(rows: SaturationBandRow[]): CicSaturationBandTable {
  const fallback = DEFAULT_SOIL_FERTILITY_REFERENCE.cicSaturationBands;
  const grouped: CicSaturationBandTable = {
    ca: [],
    mg: [],
    k: [],
    na: [],
  };

  for (const cation of VALID_CATIONS) {
    const rowsForCation = rows.filter((row) => row.cation === cation && VALID_SATURATION_BANDS.has(row.band as CicSaturationBand));
    if (rowsForCation.length < 5) {
      grouped[cation] = fallback[cation];
      continue;
    }
    grouped[cation] = rowsForCation.map((row) => ({
      band: row.band as CicSaturationBand,
      min: row.min_percent ?? undefined,
      max: row.max_percent ?? undefined,
      rangeLabel: row.range_label,
      isAdequate: row.is_adequate,
      target: row.target_percent ?? undefined,
    }));
  }

  return grouped;
}

function mapRatioRangeRows(rows: RatioRangeRow[]): CicRatioRangeTable {
  const fallback = DEFAULT_SOIL_FERTILITY_REFERENCE.cicRatioRanges;
  const mapped = { ...fallback };

  for (const row of rows) {
    if (!VALID_RELATIONS.has(row.relation_key as CicRelationKey)) continue;
    const key = row.relation_key as CicRelationKey;
    mapped[key] = {
      optimalMin: row.optimal_min,
      optimalMax: row.optimal_max,
      lowMessageKey: row.low_message_key || fallback[key].lowMessageKey,
      highMessageKey: row.high_message_key || fallback[key].highMessageKey,
    };
  }

  return mapped;
}

function isCompleteReference(refs: SoilFertilityReference) {
  return (
    refs.nutrientInterpretationByExtractant.olsen_kcl.length >= 8 &&
    refs.nutrientInterpretationByExtractant.mehlich3.length >= 8 &&
    refs.cropExtraction.length >= 1 &&
    Object.keys(refs.amendments).length >= 3
  );
}

/** RegExp cannot survive JSON.stringify — store source strings instead. */
function patternSource(pattern: unknown): string | null {
  if (pattern instanceof RegExp) return pattern.source;
  if (typeof pattern === "string" && pattern.trim()) return pattern;
  return null;
}

function revivePattern(pattern: unknown): RegExp | null {
  if (pattern instanceof RegExp) return pattern;
  const source = patternSource(pattern);
  if (!source) return null;
  try {
    return new RegExp(source, "i");
  } catch {
    return null;
  }
}

function serializeReferenceForCache(refs: SoilFertilityReference) {
  return {
    ...refs,
    cropExtraction: refs.cropExtraction.map((crop) => ({
      ...crop,
      patterns: crop.patterns
        .map((pattern) => patternSource(pattern))
        .filter((source): source is string => Boolean(source)),
    })),
  };
}

function reviveStoredReference(raw: unknown): SoilFertilityReference | null {
  if (!raw || typeof raw !== "object") return null;
  const parsed = raw as SoilFertilityReference;
  if (!Array.isArray(parsed.cropExtraction)) return null;

  const cropExtraction = parsed.cropExtraction.map((crop) => ({
    ...crop,
    patterns: (crop.patterns || [])
      .map((pattern) => revivePattern(pattern))
      .filter((pattern): pattern is RegExp => pattern instanceof RegExp),
  }));

  const hadStoredPatterns = parsed.cropExtraction.some(
    (crop) => Array.isArray(crop.patterns) && crop.patterns.length > 0
  );
  const revivedAnyPattern = cropExtraction.some((crop) => crop.patterns.length > 0);
  // Older caches JSON.stringified RegExp as {} — discard and refetch.
  if (hadStoredPatterns && !revivedAnyPattern) return null;

  const revived = { ...parsed, cropExtraction };
  return isCompleteReference(revived) ? revived : null;
}

function readStoredReference(): SoilFertilityReference | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(SOIL_FERTILITY_CACHE_KEY);
    if (!raw) return null;
    return reviveStoredReference(JSON.parse(raw));
  } catch {
    return null;
  }
}

function persistReference(reference: SoilFertilityReference) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      SOIL_FERTILITY_CACHE_KEY,
      JSON.stringify(serializeReferenceForCache(reference))
    );
  } catch {
    /* Storage may be full or unavailable. */
  }
}

export async function fetchSoilFertilityReference(
  sourceKey = SOIL_FERTILITY_SOURCE_KEY
): Promise<{ reference: SoilFertilityReference; fromSupabase: boolean }> {
  if (cachedReference) {
    return { reference: cachedReference, fromSupabase: cachedFromSupabase };
  }
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    const storedReference = readStoredReference();
    if (storedReference) {
      cachedReference = storedReference;
      cachedFromSupabase = false;
    }

    try {
      const [
        nutrientsRes,
        factorsRes,
        cropsRes,
        amendmentsRes,
        irrigationRes,
        saturationBandsRes,
        ratioRangesRes,
      ] = await Promise.all([
        supabase
          .from("sf_nutrient_interpretation")
          .select("parameter_key, label, unit, low_max, adequate_min, adequate_max, high_min, sort_order, extractant")
          .eq("source_key", sourceKey)
          .order("sort_order"),
        supabase
          .from("sf_conversion_factor")
          .select("factor_key, table_number, factor")
          .eq("source_key", sourceKey),
        supabase
          .from("sf_crop_extraction")
          .select(
            "crop_key, label, match_patterns, n_kg_per_t, p2o5_kg_per_t, k2o_kg_per_t, cao_kg_per_t, mgo_kg_per_t, is_default, sort_order"
          )
          .eq("source_key", sourceKey)
          .order("sort_order"),
        supabase
          .from("sf_amendment_material")
          .select("material_key, label, cao_percent, mgo_percent")
          .eq("source_key", sourceKey),
        supabase
          .from("sf_irrigation_efficiency")
          .select("nutrient_key, irrigation_system, min_percent, max_percent")
          .eq("source_key", sourceKey),
        supabase
          .from("sf_cic_saturation_band")
          .select("cation, band, min_percent, max_percent, range_label, is_adequate, target_percent, sort_order")
          .eq("source_key", sourceKey)
          .order("sort_order"),
        supabase
          .from("sf_cic_ratio_range")
          .select("relation_key, optimal_min, optimal_max, low_message_key, high_message_key")
          .eq("source_key", sourceKey),
      ]);

      const firstError =
        nutrientsRes.error || factorsRes.error || cropsRes.error || amendmentsRes.error;

      if (firstError) {
        console.warn("Soil fertility reference fetch failed, using hardcoded fallback:", firstError.message);
        if (storedReference) {
          return { reference: storedReference, fromSupabase: false };
        }
        return { reference: DEFAULT_SOIL_FERTILITY_REFERENCE, fromSupabase: false };
      }

      const { oxideFactors, cmolToMgKg } = mapConversionRows((factorsRes.data || []) as ConversionRow[]);
      const { cropExtraction, defaultExtraction } = mapCropRows((cropsRes.data || []) as CropRow[]);
      const nutrientInterpretationByExtractant = mapNutrientRowsByExtractant(
        (nutrientsRes.data || []) as NutrientRow[]
      );
      const irrigationEfficiency = irrigationRes.error
        ? DEFAULT_SOIL_FERTILITY_REFERENCE.irrigationEfficiency
        : mapIrrigationRows((irrigationRes.data || []) as IrrigationRow[]);
      const cicSaturationBands = saturationBandsRes.error
        ? DEFAULT_SOIL_FERTILITY_REFERENCE.cicSaturationBands
        : mapSaturationBandRows((saturationBandsRes.data || []) as SaturationBandRow[]);
      const cicRatioRanges = ratioRangesRes.error
        ? DEFAULT_SOIL_FERTILITY_REFERENCE.cicRatioRanges
        : mapRatioRangeRows((ratioRangesRes.data || []) as RatioRangeRow[]);

      const refs: SoilFertilityReference = {
        nutrientInterpretation: nutrientInterpretationByExtractant.olsen_kcl,
        nutrientInterpretationByExtractant,
        oxideFactors,
        cmolToMgKg,
        cropExtraction,
        defaultExtraction,
        amendments: mapAmendmentRows((amendmentsRes.data || []) as AmendmentRow[]),
        irrigationEfficiency,
        cicSaturationBands,
        cicRatioRanges,
      };

      if (!isCompleteReference(refs)) {
        console.warn("Soil fertility reference incomplete in Supabase, using hardcoded fallback.");
        if (storedReference) {
          return { reference: storedReference, fromSupabase: false };
        }
        return { reference: DEFAULT_SOIL_FERTILITY_REFERENCE, fromSupabase: false };
      }

      cachedReference = refs;
      cachedFromSupabase = true;
      persistReference(refs);
      return { reference: refs, fromSupabase: true };
    } catch (error) {
      console.warn("Soil fertility reference fetch error, using hardcoded fallback:", error);
      if (storedReference) {
        return { reference: storedReference, fromSupabase: false };
      }
      return { reference: DEFAULT_SOIL_FERTILITY_REFERENCE, fromSupabase: false };
    } finally {
      inflightFetch = null;
    }
  })();

  return inflightFetch;
}

export function useSoilFertilityReference() {
  const [reference, setReference] = useState<SoilFertilityReference>(DEFAULT_SOIL_FERTILITY_REFERENCE);
  const [loading, setLoading] = useState(true);
  const [fromSupabase, setFromSupabase] = useState(false);

  useEffect(() => {
    let cancelled = false;

    fetchSoilFertilityReference()
      .then(({ reference: refs, fromSupabase: loadedFromSupabase }) => {
        if (cancelled) return;
        setReference(refs);
        setFromSupabase(loadedFromSupabase);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { reference, loading, fromSupabase };
}
