/**
 * Reference tables — Tutoría Fertilidad de Suelos (SUE302, Diego R. Villaseñor-Ortiz).
 * Tablas N.° 1, 4, 5, 6 y enmiendas (Secciones 12–14).
 */

export type NutrientClass = "bajo" | "adecuado" | "exceso";

export type Table1Parameter =
  | "ph"
  | "acidez_extraible"
  | "k"
  | "ca"
  | "mg"
  | "p"
  | "fe"
  | "cu"
  | "zn"
  | "mn";

export type Table1Row = {
  parameter: Table1Parameter;
  label: string;
  unit: string;
  lowMax?: number;
  adequateMin: number;
  adequateMax: number;
  highMin?: number;
};

/** Tabla N.° 1 — Interpretación de nutrientes (suelo tropical, unidades de laboratorio). */
export const TABLE_1_NUTRIENT_INTERPRETATION: Table1Row[] = [
  { parameter: "ph", label: "pH", unit: "", lowMax: 5.4, adequateMin: 5.5, adequateMax: 6.5, highMin: 6.6 },
  { parameter: "acidez_extraible", label: "Acidez extraíble (H+Al)", unit: "cmol(+)/kg", lowMax: 0.5, adequateMin: 0.5, adequateMax: 2.5, highMin: 2.51 },
  { parameter: "k", label: "K", unit: "cmol(+)/kg", lowMax: 0.15, adequateMin: 0.16, adequateMax: 0.40, highMin: 0.41 },
  { parameter: "ca", label: "Ca", unit: "cmol(+)/kg", lowMax: 2.0, adequateMin: 2.1, adequateMax: 8.0, highMin: 8.1 },
  { parameter: "mg", label: "Mg", unit: "cmol(+)/kg", lowMax: 0.4, adequateMin: 0.5, adequateMax: 2.0, highMin: 2.1 },
  { parameter: "p", label: "P", unit: "mg/kg", lowMax: 9, adequateMin: 10, adequateMax: 25, highMin: 26 },
  { parameter: "fe", label: "Fe", unit: "mg/kg", lowMax: 4, adequateMin: 5, adequateMax: 50, highMin: 51 },
  { parameter: "cu", label: "Cu", unit: "mg/kg", lowMax: 0.4, adequateMin: 0.5, adequateMax: 2.0, highMin: 2.1 },
  { parameter: "zn", label: "Zn", unit: "mg/kg", lowMax: 0.8, adequateMin: 1.0, adequateMax: 3.0, highMin: 3.1 },
  { parameter: "mn", label: "Mn", unit: "mg/kg", lowMax: 4, adequateMin: 5, adequateMax: 30, highMin: 31 },
];

/** Tabla N.° 4 — Factores de conversión elemento → óxido. */
export const TABLE_4_OXIDE_FACTORS = {
  pToP2o5: 2.29,
  kToK2o: 1.2,
  caToCao: 1.4,
  mgToMgo: 1.66,
  nToN: 1,
} as const;

/** Tabla N.° 6 — cmol(+)/kg → mg/kg. */
export const TABLE_6_CMOL_TO_MGKG = {
  ca: 200.4,
  mg: 121.5,
  k: 391,
  na: 229.9,
} as const;

export type CropExtractionCoefficients = {
  cropKey: string;
  patterns: RegExp[];
  label: string;
  /** kg nutriente / t producto */
  n: number;
  p2o5: number;
  k2o: number;
  cao: number;
  mgo: number;
};

/** Tabla N.° 5 — Extracción nutricional de cultivos (kg/t rendimiento). */
export const TABLE_5_CROP_EXTRACTION: CropExtractionCoefficients[] = [
  { cropKey: "maiz", patterns: [/\b(maiz|maize|corn)\b/], label: "Maíz", n: 22, p2o5: 4.3, k2o: 5.6, cao: 2.0, mgo: 0.9 },
  { cropKey: "arroz", patterns: [/\b(arroz|rice)\b/], label: "Arroz", n: 15, p2o5: 3.5, k2o: 4.5, cao: 0.5, mgo: 0.4 },
  { cropKey: "frijol", patterns: [/\b(frijol|bean|frejol|habichuela)\b/], label: "Frijol", n: 35, p2o5: 6.0, k2o: 8.0, cao: 3.0, mgo: 1.5 },
  { cropKey: "papa", patterns: [/\b(papa|potato|patata)\b/], label: "Papa", n: 4.0, p2o5: 1.5, k2o: 6.0, cao: 0.5, mgo: 0.3 },
  { cropKey: "cana", patterns: [/\b(cana|caña|sugarcane)\b/], label: "Caña de azúcar", n: 1.8, p2o5: 0.4, k2o: 2.0, cao: 0.5, mgo: 0.3 },
  { cropKey: "tomate", patterns: [/\b(tomate|tomato)\b/], label: "Tomate", n: 3.5, p2o5: 0.8, k2o: 5.0, cao: 2.0, mgo: 0.5 },
  { cropKey: "banano", patterns: [/\b(banano|banana|platano|plantain)\b/], label: "Banano / plátano", n: 2.5, p2o5: 0.6, k2o: 8.0, cao: 0.8, mgo: 0.4 },
  { cropKey: "cafe", patterns: [/\b(cafe|coffee)\b/], label: "Café", n: 8.0, p2o5: 1.5, k2o: 10.0, cao: 1.5, mgo: 0.8 },
  { cropKey: "soya", patterns: [/\b(soya|soja|soybean)\b/], label: "Soya", n: 55, p2o5: 10.0, k2o: 18.0, cao: 4.0, mgo: 2.0 },
  { cropKey: "trigo", patterns: [/\b(trigo|wheat)\b/], label: "Trigo", n: 25, p2o5: 5.0, k2o: 6.0, cao: 1.0, mgo: 0.5 },
  { cropKey: "yuca", patterns: [/\b(yuca|cassava|manioca)\b/], label: "Yuca", n: 2.5, p2o5: 0.5, k2o: 3.5, cao: 0.4, mgo: 0.2 },
];

export const TABLE_5_DEFAULT_EXTRACTION: Omit<CropExtractionCoefficients, "cropKey" | "patterns"> = {
  label: "Cultivo general",
  n: 25,
  p2o5: 5,
  k2o: 6,
  cao: 2,
  mgo: 1,
};

export type AmendmentMaterialKey = "cal_agricola" | "yeso" | "dolomita";

export type AmendmentMaterialSpec = {
  key: AmendmentMaterialKey;
  label: string;
  caoPercent: number;
  mgoPercent: number;
};

/** Sección 12 — Enmiendas agrícolas (base interna). */
export const TABLE_12_AMENDMENTS: Record<AmendmentMaterialKey, AmendmentMaterialSpec> = {
  cal_agricola: { key: "cal_agricola", label: "Cal agrícola", caoPercent: 40, mgoPercent: 0 },
  yeso: { key: "yeso", label: "Yeso", caoPercent: 14, mgoPercent: 0 },
  dolomita: { key: "dolomita", label: "Dolomita", caoPercent: 30, mgoPercent: 14 },
};

export type OxideFactors = {
  pToP2o5: number;
  kToK2o: number;
  caToCao: number;
  mgToMgo: number;
  nToN: number;
};

export type CmolToMgKgFactors = {
  ca: number;
  mg: number;
  k: number;
  na: number;
};

/** Bundled reference data for the fertility plan engine (hardcoded fallback). */
export type SoilFertilityReference = {
  nutrientInterpretation: Table1Row[];
  oxideFactors: OxideFactors;
  cmolToMgKg: CmolToMgKgFactors;
  cropExtraction: CropExtractionCoefficients[];
  defaultExtraction: Omit<CropExtractionCoefficients, "cropKey" | "patterns">;
  amendments: Record<AmendmentMaterialKey, AmendmentMaterialSpec>;
};

export const DEFAULT_SOIL_FERTILITY_REFERENCE: SoilFertilityReference = {
  nutrientInterpretation: TABLE_1_NUTRIENT_INTERPRETATION,
  oxideFactors: TABLE_4_OXIDE_FACTORS,
  cmolToMgKg: TABLE_6_CMOL_TO_MGKG,
  cropExtraction: TABLE_5_CROP_EXTRACTION,
  defaultExtraction: TABLE_5_DEFAULT_EXTRACTION,
  amendments: TABLE_12_AMENDMENTS,
};

const VALENCE: Record<"ca" | "mg" | "k" | "na", number> = {
  ca: 2,
  mg: 2,
  k: 1,
  na: 1,
};

const MOLAR_MASS: Record<"ca" | "mg" | "k" | "na", number> = {
  ca: 40.078,
  mg: 24.305,
  k: 39.098,
  na: 22.99,
};

export function classifyTable1(value: number, row: Table1Row): NutrientClass {
  if (!Number.isFinite(value)) return "bajo";
  if (row.lowMax !== undefined && value <= row.lowMax) return "bajo";
  if (row.highMin !== undefined && value >= row.highMin) return "exceso";
  if (value >= row.adequateMin && value <= row.adequateMax) return "adecuado";
  if (row.lowMax !== undefined && value < row.adequateMin) return "bajo";
  return "exceso";
}

export function matchCropExtraction(
  cropName?: string | null,
  refs: Pick<SoilFertilityReference, "cropExtraction" | "defaultExtraction"> = DEFAULT_SOIL_FERTILITY_REFERENCE
) {
  const normalized = (cropName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!normalized) return { ...refs.defaultExtraction, cropKey: "general" };
  for (const crop of refs.cropExtraction) {
    if (crop.patterns.some((pattern) => pattern.test(normalized))) {
      return crop;
    }
  }
  return { ...refs.defaultExtraction, cropKey: "general" };
}

export function cmolToMgKg(
  cation: keyof CmolToMgKgFactors,
  cmolKg: number,
  factors: CmolToMgKgFactors = DEFAULT_SOIL_FERTILITY_REFERENCE.cmolToMgKg
) {
  return cmolKg * factors[cation];
}

export function cmolToKgHa(input: {
  cation: keyof typeof TABLE_6_CMOL_TO_MGKG;
  cmolKg: number;
  soilMassKgHa: number;
}) {
  const valence = VALENCE[input.cation];
  const moles = (input.cmolKg * 0.01) / valence;
  const gramsPerKg = moles * MOLAR_MASS[input.cation];
  const kgHa = (gramsPerKg * input.soilMassKgHa) / 1000;
  return { moles, gramsPerKg, kgHa };
}
