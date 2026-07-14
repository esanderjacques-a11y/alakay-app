import type { CalculatorValue } from "@/lib/agronomicCalculators";
import {
  DEFAULT_SOIL_FERTILITY_REFERENCE,
  mgKgToCmol,
  type CmolToMgKgFactors,
} from "@/lib/soilFertilityTables";
import { convertLabUnit } from "@/lib/unitConversions";

export type LabNutrientKey =
  | "ph"
  | "nitrogen"
  | "phosphorus"
  | "potassium"
  | "calcium"
  | "magnesium"
  | "sulfur"
  | "sodium"
  | "iron"
  | "zinc"
  | "manganese"
  | "copper"
  | "boron"
  | "organic_matter"
  | "organic_carbon"
  | "exchangeable_acidity"
  | "bulk_density"
  | "cec"
  | "base_saturation"
  | "aluminum";

type ParameterLite = {
  parameter_key: string;
  parameter_name: string;
  display_name: string;
  symbol: string | null;
};

type ResultLite = {
  parameter_key?: string;
  parameter_name: string;
  display_parameter_name?: string;
  value: number;
  unit_symbol?: string;
};

/** Canonical parameter_key / alias → calculator nutrient key. */
const PARAMETER_KEY_TO_NUTRIENT: Record<string, LabNutrientKey> = {
  ph: "ph",
  ph_h2o: "ph",
  ph_water: "ph",
  ph_agua: "ph",
  nitrogen: "nitrogen",
  n: "nitrogen",
  nitrate: "nitrogen",
  nitrate_n: "nitrogen",
  no3: "nitrogen",
  no3_n: "nitrogen",
  phosphorus: "phosphorus",
  p: "phosphorus",
  phosphorus_olsen: "phosphorus",
  phosphorus_mehlich: "phosphorus",
  phosphorus_bray: "phosphorus",
  potassium: "potassium",
  k: "potassium",
  calcium: "calcium",
  ca: "calcium",
  magnesium: "magnesium",
  mg: "magnesium",
  sulfur: "sulfur",
  s: "sulfur",
  sulphate: "sulfur",
  sulfate: "sulfur",
  sodium: "sodium",
  na: "sodium",
  iron: "iron",
  fe: "iron",
  zinc: "zinc",
  zn: "zinc",
  manganese: "manganese",
  mn: "manganese",
  copper: "copper",
  cu: "copper",
  boron: "boron",
  b: "boron",
  organic_matter: "organic_matter",
  materia_organica: "organic_matter",
  mo: "organic_matter",
  om: "organic_matter",
  organic_carbon: "organic_carbon",
  carbono_organico: "organic_carbon",
  exchangeable_acidity: "exchangeable_acidity",
  acidez_extraible: "exchangeable_acidity",
  acidez_intercambiable: "exchangeable_acidity",
  h_al: "exchangeable_acidity",
  bulk_density: "bulk_density",
  densidad_aparente: "bulk_density",
  da: "bulk_density",
  cec: "cec",
  cice: "cec",
  cic: "cec",
  ctc: "cec",
  base_saturation: "base_saturation",
  saturacion_bases: "base_saturation",
  v_percent: "base_saturation",
  aluminum: "aluminum",
  aluminium: "aluminum",
  al: "aluminum",
};

const NAME_PATTERNS: Array<[LabNutrientKey, RegExp]> = [
  ["ph", /\bph\b/],
  ["nitrogen", /\b(n|nitrogen|nitrogeno|azote|nitrate|nitrato|no3)\b/],
  ["phosphorus", /\b(p|phosphorus|fosforo|phosphore)\b/],
  ["potassium", /\b(k|potassium|potasio)\b/],
  ["calcium", /\b(ca|calcium|calcio)\b/],
  ["magnesium", /\b(mg|magnesium|magnesio)\b/],
  ["sulfur", /\b(s|sulfur|azufre|soufre|sulphate|sulfate)\b/],
  ["sodium", /\b(na|sodium|sodio)\b/],
  ["iron", /\b(fe|iron|hierro|fer)\b/],
  ["zinc", /\b(zn|zinc)\b/],
  ["manganese", /\b(mn|manganese|manganeso)\b/],
  ["copper", /\b(cu|copper|cobre|cuivre)\b/],
  ["boron", /\b(b|boron|boro|bore)\b/],
  ["organic_matter", /\b(organic matter|materia organica|matiere organique|om|mo)\b/],
  ["organic_carbon", /\b(organic carbon|carbono organico)\b/],
  ["exchangeable_acidity", /\b(acidity|acidez|h\+al|h al)\b/],
  ["bulk_density", /\b(bulk density|densidad aparente|da)\b/],
  ["cec", /\b(cec|cice|cic|ctc|cation exchange capacity|capacidad de intercambio cationico)\b/],
  ["base_saturation", /\b(base saturation|saturacion de bases|saturacao de bases|v%|sb)\b/],
  ["aluminum", /\b(al|aluminum|aluminium|aluminio)\b/],
];

const CATION_KEYS = new Set<LabNutrientKey>([
  "calcium",
  "magnesium",
  "potassium",
  "sodium",
  "exchangeable_acidity",
  "cec",
  "aluminum",
]);

const MASS_KEYS = new Set<LabNutrientKey>([
  "phosphorus",
  "sulfur",
  "iron",
  "zinc",
  "manganese",
  "copper",
  "boron",
  "nitrogen",
]);

function cleanUnit(unit: string) {
  return unit
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[\u00b5\u03bc]/g, "u")
    .replace(/\u207b/g, "-")
    .replace(/\u00b7/g, ".");
}

function isCmolUnit(unit: string) {
  const u = cleanUnit(unit);
  return (
    u.includes("cmol") ||
    u.includes("meq/100g") ||
    u.includes("meq100g") ||
    u === "meq/100g" ||
    u.includes("cmolc")
  );
}

function isMassUnit(unit: string) {
  const u = cleanUnit(unit);
  return (
    u === "ppm" ||
    u === "mg/kg" ||
    u === "mgkg-1" ||
    u === "mg.kg-1" ||
    u === "ug/g"
  );
}

function isPercentUnit(unit: string) {
  const u = cleanUnit(unit);
  return u === "%" || u === "percent" || u === "g/100g" || u === "dag/kg";
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().:/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveNutrientFromKey(parameterKey: string | undefined): LabNutrientKey | null {
  if (!parameterKey) return null;
  const normalized = parameterKey
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().:/_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  return PARAMETER_KEY_TO_NUTRIENT[normalized] || null;
}

function resolveNutrientFromLabel(
  label: string,
  symbol?: string | null
): LabNutrientKey | null {
  const normalized = normalizeName(`${label} ${symbol || ""}`);
  for (const [key, pattern] of NAME_PATTERNS) {
    if (pattern.test(normalized)) return key;
  }
  return null;
}

function cationFactorKey(
  key: LabNutrientKey
): keyof CmolToMgKgFactors | null {
  if (key === "calcium") return "ca";
  if (key === "magnesium") return "mg";
  if (key === "potassium") return "k";
  if (key === "sodium") return "na";
  return null;
}

/** When unit is missing, guess cmol vs mg/kg from typical soil ranges. */
function looksLikeMassConcentration(key: LabNutrientKey, value: number) {
  if (key === "calcium") return value > 50;
  if (key === "magnesium") return value > 30;
  if (key === "potassium" || key === "sodium") return value > 10;
  if (key === "exchangeable_acidity" || key === "cec" || key === "aluminum") return false;
  return false;
}

/**
 * Normalize a lab entry to the unit expected by SUE302 / CIC calculators.
 * Cations & CEC → cmol(+)/kg; P/micros/N → mg/kg; OM → %.
 */
export function normalizeLabValue(
  key: LabNutrientKey,
  value: number,
  unit: string | undefined,
  factors: CmolToMgKgFactors = DEFAULT_SOIL_FERTILITY_REFERENCE.cmolToMgKg
): { value: number; unit: string; converted: boolean } {
  if (!Number.isFinite(value)) {
    return { value, unit: unit || "", converted: false };
  }

  if (key === "ph") {
    return { value, unit: "", converted: false };
  }

  if (key === "organic_matter" || key === "organic_carbon" || key === "base_saturation") {
    if (unit && !isPercentUnit(unit)) {
      const converted = convertLabUnit(value, unit, "%");
      if (converted) return { value: converted.value, unit: "%", converted: true };
    }
    return { value, unit: "%", converted: false };
  }

  if (key === "bulk_density") {
    if (unit) {
      const converted = convertLabUnit(value, unit, "g/cm3");
      if (converted) return { value: converted.value, unit: "g/cm³", converted: converted.note !== "Same unit; no conversion was needed." };
    }
    return { value, unit: "g/cm³", converted: false };
  }

  if (CATION_KEYS.has(key)) {
    const cation = cationFactorKey(key);
    const unitHint = unit || "";
    const treatAsMass =
      (unitHint && isMassUnit(unitHint)) ||
      (!unitHint && looksLikeMassConcentration(key, value));

    if (treatAsMass && cation) {
      return {
        value: mgKgToCmol(cation, value, factors),
        unit: "cmol(+)/kg",
        converted: true,
      };
    }

    if (unitHint && isCmolUnit(unitHint)) {
      return { value, unit: "cmol(+)/kg", converted: false };
    }

    if (unitHint && isMassUnit(unitHint) && !cation) {
      // Acidity / Al / CEC reported as mass — cannot convert without valence table; keep raw.
      return { value, unit: unitHint, converted: false };
    }

    return { value, unit: "cmol(+)/kg", converted: false };
  }

  if (MASS_KEYS.has(key)) {
    if (unit && !isMassUnit(unit)) {
      const converted = convertLabUnit(value, unit, "mg/kg");
      if (converted) return { value: converted.value, unit: "mg/kg", converted: true };
    }
    return { value, unit: "mg/kg", converted: false };
  }

  return { value, unit: unit || "", converted: false };
}

function setLabEntry(
  map: Map<string, CalculatorValue>,
  key: LabNutrientKey,
  label: string,
  value: number,
  unit: string | undefined,
  preferExisting = true
) {
  if (preferExisting && map.has(key)) return;
  const normalized = normalizeLabValue(key, value, unit);
  map.set(key, {
    key,
    label,
    value: normalized.value,
    unit: normalized.unit || unit,
  });
}

export function buildLabValueIndex(
  parameters: ParameterLite[],
  values: Record<string, string>,
  results: ResultLite[],
  parameterUnits: Record<string, string> = {}
) {
  const map = new Map<string, CalculatorValue>();

  for (const parameter of parameters) {
    const numericValue = Number(String(values[parameter.parameter_key] || "").replace(",", "."));
    if (!Number.isFinite(numericValue)) continue;

    const nutrient =
      resolveNutrientFromKey(parameter.parameter_key) ||
      resolveNutrientFromKey(parameter.parameter_name) ||
      resolveNutrientFromKey(parameter.symbol || "") ||
      resolveNutrientFromLabel(
        parameter.display_name || parameter.parameter_name,
        parameter.symbol
      );
    if (!nutrient) continue;

    setLabEntry(
      map,
      nutrient,
      parameter.symbol || parameter.display_name || parameter.parameter_name,
      numericValue,
      parameterUnits[parameter.parameter_key],
      true
    );
  }

  for (const result of results) {
    const nutrient =
      resolveNutrientFromKey(result.parameter_key) ||
      resolveNutrientFromKey(result.parameter_name) ||
      resolveNutrientFromLabel(
        result.display_parameter_name || result.parameter_name
      );
    if (!nutrient) continue;

    // Values screen (with selected units) wins over interpretation results.
    setLabEntry(
      map,
      nutrient,
      result.display_parameter_name || result.parameter_name,
      result.value,
      result.unit_symbol,
      true
    );
  }

  return map;
}

export function labHasUsefulSoilData(lab: Map<string, CalculatorValue>) {
  return (
    lab.has("ph") ||
    lab.has("phosphorus") ||
    lab.has("potassium") ||
    lab.has("calcium") ||
    lab.has("magnesium") ||
    lab.has("organic_matter") ||
    lab.has("cec") ||
    lab.has("exchangeable_acidity")
  );
}
