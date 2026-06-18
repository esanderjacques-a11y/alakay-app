import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  DEFAULT_SOIL_FERTILITY_REFERENCE,
  type AmendmentMaterialKey,
  type CropExtractionCoefficients,
  type SoilFertilityReference,
  type Table1Parameter,
  type Table1Row,
} from "@/lib/soilFertilityTables";

export const SOIL_FERTILITY_SOURCE_KEY = "sue302_villasenor";

type NutrientRow = {
  parameter_key: string;
  label: string;
  unit: string;
  low_max: number | null;
  adequate_min: number;
  adequate_max: number;
  high_min: number | null;
  sort_order: number;
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

const VALID_PARAMETERS = new Set<Table1Parameter>([
  "ph",
  "acidez_extraible",
  "k",
  "ca",
  "mg",
  "p",
  "fe",
  "cu",
  "zn",
  "mn",
]);

const VALID_AMENDMENTS = new Set<AmendmentMaterialKey>(["cal_agricola", "yeso", "dolomita"]);

let cachedReference: SoilFertilityReference | null = null;
let cachedFromSupabase = false;
let inflightFetch: Promise<{ reference: SoilFertilityReference; fromSupabase: boolean }> | null = null;

function mapNutrientRows(rows: NutrientRow[]): Table1Row[] {
  return rows
    .filter((row): row is NutrientRow & { parameter_key: Table1Parameter } =>
      VALID_PARAMETERS.has(row.parameter_key as Table1Parameter)
    )
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((row) => ({
      parameter: row.parameter_key,
      label: row.label,
      unit: row.unit,
      lowMax: row.low_max ?? undefined,
      adequateMin: row.adequate_min,
      adequateMax: row.adequate_max,
      highMin: row.high_min ?? undefined,
    }));
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
      patterns: (row.match_patterns || []).map((pattern) => new RegExp(pattern, "i")),
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

function isCompleteReference(refs: SoilFertilityReference) {
  return (
    refs.nutrientInterpretation.length >= 10 &&
    refs.cropExtraction.length >= 1 &&
    Object.keys(refs.amendments).length >= 3
  );
}

export async function fetchSoilFertilityReference(
  sourceKey = SOIL_FERTILITY_SOURCE_KEY
): Promise<{ reference: SoilFertilityReference; fromSupabase: boolean }> {
  if (cachedReference) {
    return { reference: cachedReference, fromSupabase: cachedFromSupabase };
  }
  if (inflightFetch) return inflightFetch;

  inflightFetch = (async () => {
    try {
      const [nutrientsRes, factorsRes, cropsRes, amendmentsRes] = await Promise.all([
        supabase
          .from("sf_nutrient_interpretation")
          .select("parameter_key, label, unit, low_max, adequate_min, adequate_max, high_min, sort_order")
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
      ]);

      const firstError =
        nutrientsRes.error || factorsRes.error || cropsRes.error || amendmentsRes.error;

      if (firstError) {
        console.warn("Soil fertility reference fetch failed, using hardcoded fallback:", firstError.message);
        return { reference: DEFAULT_SOIL_FERTILITY_REFERENCE, fromSupabase: false };
      }

      const { oxideFactors, cmolToMgKg } = mapConversionRows((factorsRes.data || []) as ConversionRow[]);
      const { cropExtraction, defaultExtraction } = mapCropRows((cropsRes.data || []) as CropRow[]);

      const refs: SoilFertilityReference = {
        nutrientInterpretation: mapNutrientRows((nutrientsRes.data || []) as NutrientRow[]),
        oxideFactors,
        cmolToMgKg,
        cropExtraction,
        defaultExtraction,
        amendments: mapAmendmentRows((amendmentsRes.data || []) as AmendmentRow[]),
      };

      if (!isCompleteReference(refs)) {
        console.warn("Soil fertility reference incomplete in Supabase, using hardcoded fallback.");
        return { reference: DEFAULT_SOIL_FERTILITY_REFERENCE, fromSupabase: false };
      }

      cachedReference = refs;
      cachedFromSupabase = true;
      return { reference: refs, fromSupabase: true };
    } catch (error) {
      console.warn("Soil fertility reference fetch error, using hardcoded fallback:", error);
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
