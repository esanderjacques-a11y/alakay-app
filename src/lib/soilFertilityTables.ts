/**
 * Reference tables — Tutoría Plan nutricional (SUE302, Diego R. Villaseñor-Ortiz).
 * Tablas N.° 1, 4, 5, 6, 7 y enmiendas (Secciones 12–14).
 */

export type NutrientClass = "bajo" | "adecuado" | "exceso";

export type Table1Parameter =
  | "ph"
  | "acidez_extraible"
  | "k"
  | "ca"
  | "mg"
  | "na"
  | "p"
  | "s"
  | "fe"
  | "cu"
  | "zn"
  | "mn";

/** Extractante de laboratorio usado para el análisis de suelo (Tabla N.° 1). */
export type Extractant = "olsen_kcl" | "mehlich3";

export const EXTRACTANT_OPTIONS: Extractant[] = ["olsen_kcl", "mehlich3"];

export type Table1Row = {
  parameter: Table1Parameter;
  label: string;
  unit: string;
  lowMax?: number;
  adequateMin: number;
  adequateMax: number;
  highMin?: number;
};

/** Tabla N.° 1 — Olsen Modificado / KCl 1N. */
export const TABLE_1_OLSEN_KCL: Table1Row[] = [
  { parameter: "ph", label: "pH", unit: "", lowMax: 5.4, adequateMin: 5.5, adequateMax: 6.5, highMin: 6.6 },
  { parameter: "acidez_extraible", label: "Acidez extraíble (H+Al)", unit: "cmol(+)/kg", adequateMin: 0, adequateMax: 0.5, highMin: 0.51 },
  { parameter: "ca", label: "Ca", unit: "cmol(+)/kg", lowMax: 3.9, adequateMin: 4, adequateMax: 20, highMin: 20.1 },
  { parameter: "k", label: "K", unit: "cmol(+)/kg", lowMax: 0.19, adequateMin: 0.2, adequateMax: 0.6, highMin: 0.61 },
  { parameter: "mg", label: "Mg", unit: "cmol(+)/kg", lowMax: 0.9, adequateMin: 1, adequateMax: 5, highMin: 5.1 },
  { parameter: "p", label: "P", unit: "mg/kg", lowMax: 9, adequateMin: 10, adequateMax: 20, highMin: 21 },
  { parameter: "fe", label: "Fe", unit: "mg/kg", lowMax: 9, adequateMin: 10, adequateMax: 100, highMin: 101 },
  { parameter: "cu", label: "Cu", unit: "mg/kg", lowMax: 1.9, adequateMin: 2, adequateMax: 20, highMin: 20.1 },
  { parameter: "mn", label: "Mn", unit: "mg/kg", lowMax: 4, adequateMin: 5, adequateMax: 50, highMin: 51 },
  { parameter: "zn", label: "Zn", unit: "mg/kg", lowMax: 1.9, adequateMin: 2, adequateMax: 10, highMin: 10.1 },
];

/** Tabla N.° 1 — Mehlich III. */
export const TABLE_1_MEHLICH3: Table1Row[] = [
  { parameter: "ph", label: "pH", unit: "", lowMax: 5.4, adequateMin: 5.5, adequateMax: 6.5, highMin: 6.6 },
  { parameter: "acidez_extraible", label: "Acidez extraíble (H+Al)", unit: "cmol(+)/kg", adequateMin: 0, adequateMax: 0.5, highMin: 0.51 },
  { parameter: "ca", label: "Ca", unit: "cmol(+)/kg", lowMax: 3.9, adequateMin: 4, adequateMax: 16, highMin: 16.1 },
  { parameter: "k", label: "K", unit: "cmol(+)/kg", lowMax: 0.49, adequateMin: 0.5, adequateMax: 0.8, highMin: 0.81 },
  { parameter: "mg", label: "Mg", unit: "cmol(+)/kg", lowMax: 2.9, adequateMin: 3, adequateMax: 6, highMin: 6.1 },
  { parameter: "na", label: "Na", unit: "cmol(+)/kg", lowMax: 0.29, adequateMin: 0.3, adequateMax: 0.7, highMin: 0.71 },
  { parameter: "p", label: "P", unit: "mg/kg", lowMax: 19, adequateMin: 20, adequateMax: 50, highMin: 51 },
  { parameter: "s", label: "S", unit: "mg/kg", lowMax: 19, adequateMin: 20, adequateMax: 50, highMin: 51 },
  { parameter: "fe", label: "Fe", unit: "mg/kg", lowMax: 49, adequateMin: 50, adequateMax: 100, highMin: 101 },
  { parameter: "cu", label: "Cu", unit: "mg/kg", lowMax: 1.9, adequateMin: 2, adequateMax: 20, highMin: 20.1 },
  { parameter: "mn", label: "Mn", unit: "mg/kg", lowMax: 9, adequateMin: 10, adequateMax: 50, highMin: 51 },
  { parameter: "zn", label: "Zn", unit: "mg/kg", lowMax: 1.9, adequateMin: 2, adequateMax: 10, highMin: 10.1 },
];

export const TABLE_1_BY_EXTRACTANT: Record<Extractant, Table1Row[]> = {
  olsen_kcl: TABLE_1_OLSEN_KCL,
  mehlich3: TABLE_1_MEHLICH3,
};

/** Backward-compatible flat export (defaults to Olsen Modificado/KCl 1N). */
export const TABLE_1_NUTRIENT_INTERPRETATION: Table1Row[] = TABLE_1_OLSEN_KCL;

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
  /** kg nutriente / t producto (P/K/Ca/Mg stored as oxides per Tabla N.° 5). */
  n: number;
  p2o5: number;
  k2o: number;
  cao: number;
  mgo: number;
  /** Optional yield guidance range from Tabla N.° 5 (t/ha). */
  yieldMin?: number;
  yieldMax?: number;
};

/** Tabla N.° 5 — Extracción nutricional de cultivos (kg/t rendimiento). */
export const TABLE_5_CROP_EXTRACTION: CropExtractionCoefficients[] = [
  { cropKey: "maiz", patterns: [/\bmaiz ensilaje\b/i, /\b(corn|maize) silage\b/i], label: "Maíz ensilaje", n: 3.9, p2o5: 1.6, k2o: 2.5, cao: 0.8, mgo: 0.4, yieldMin: 70, yieldMax: 90 },
  { cropKey: "maiz_grano", patterns: [/\b(maiz|maize|corn)\b/i], label: "Maíz grano", n: 20.0, p2o5: 6.9, k2o: 14.0, cao: 4.5, mgo: 2.2, yieldMin: 12, yieldMax: 20 },
  { cropKey: "arroz", patterns: [/\b(arroz|rice)\b/i], label: "Arroz", n: 21.4, p2o5: 7.1, k2o: 27.0, cao: 6.6, mgo: 4.0, yieldMin: 6, yieldMax: 9 },
  { cropKey: "frijol", patterns: [/\b(frijol|bean|frejol|habichuela)/i], label: "Frejoles", n: 20.0, p2o5: 13.7, k2o: 40.0, cao: 15.0, mgo: 10.0, yieldMin: 2, yieldMax: 4 },
  { cropKey: "papa", patterns: [/\b(papa|potato|patata)/i], label: "Papas", n: 3.8, p2o5: 1.0, k2o: 4.0, cao: 1.6, mgo: 0.9, yieldMin: 25, yieldMax: 50 },
  { cropKey: "cana", patterns: [/\b(cana|caña|sugarcane)/i], label: "Caña de azúcar", n: 1.8, p2o5: 0.4, k2o: 2.0, cao: 0.5, mgo: 0.3 },
  { cropKey: "tomate_industrial", patterns: [/\btomate industrial\b/i, /\bprocessing tomato\b/i], label: "Tomate industrial", n: 3.3, p2o5: 0.8, k2o: 5.0, cao: 0.8, mgo: 0.6, yieldMin: 45, yieldMax: 80 },
  { cropKey: "tomate_invernadero", patterns: [/\btomate invernadero\b/i, /\bgreenhouse tomato\b/i], label: "Tomate invernadero", n: 3.3, p2o5: 0.8, k2o: 5.0, cao: 0.4, mgo: 0.4, yieldMin: 80, yieldMax: 200 },
  { cropKey: "tomate", patterns: [/\btomate\b/i, /\btomato\b/i], label: "Tomate campo", n: 3.3, p2o5: 0.8, k2o: 5.0, cao: 1.2, mgo: 0.6, yieldMin: 45, yieldMax: 80 },
  { cropKey: "banano", patterns: [/\b(banano|banana|platano|plantain)/i], label: "Banano / plátano", n: 2.5, p2o5: 0.6, k2o: 8.0, cao: 0.8, mgo: 0.4 },
  { cropKey: "cafe", patterns: [/\b(cafe|coffee)\b/i], label: "Café", n: 8.0, p2o5: 1.5, k2o: 10.0, cao: 1.5, mgo: 0.8 },
  { cropKey: "soya", patterns: [/\b(soya|soja|soybean)/i], label: "Soya", n: 55, p2o5: 10.0, k2o: 18.0, cao: 4.0, mgo: 2.0 },
  { cropKey: "trigo", patterns: [/\b(trigo|wheat)\b/i], label: "Trigo", n: 24.3, p2o5: 7.3, k2o: 24.0, cao: 7.0, mgo: 4.3, yieldMin: 5, yieldMax: 9 },
  { cropKey: "cebada", patterns: [/\b(cebada|barley)\b/i], label: "Cebada", n: 22.2, p2o5: 7.1, k2o: 22.0, cao: 8.6, mgo: 5.4, yieldMin: 4, yieldMax: 7 },
  { cropKey: "avena", patterns: [/\b(avena|oats?)\b/i], label: "Avena", n: 22.2, p2o5: 7.6, k2o: 20.0, cao: 8.5, mgo: 5.4, yieldMin: 4, yieldMax: 7 },
  { cropKey: "girasol", patterns: [/\b(girasol|sunflower)/i], label: "Girasol", n: 34.5, p2o5: 11.0, k2o: 37.4, cao: 15.0, mgo: 8.0, yieldMin: 3, yieldMax: 4 },
  { cropKey: "yuca", patterns: [/\b(yuca|cassava|manioca)/i], label: "Yuca", n: 2.5, p2o5: 0.5, k2o: 3.5, cao: 0.4, mgo: 0.2 },
  { cropKey: "naranja", patterns: [/\b(naranja|orange)/i], label: "Naranja", n: 2.7, p2o5: 0.6, k2o: 4.2, cao: 1.1, mgo: 0.6, yieldMin: 40, yieldMax: 70 },
  { cropKey: "limon", patterns: [/\b(limon|lemon|lime)/i], label: "Limón", n: 2.7, p2o5: 0.6, k2o: 4.2, cao: 1.0, mgo: 0.6, yieldMin: 40, yieldMax: 80 },
  { cropKey: "aguacate", patterns: [/\b(aguacate|avocado|palta)/i], label: "Aguacate", n: 6.2, p2o5: 2.9, k2o: 18.2, cao: 4.8, mgo: 2.5, yieldMin: 10, yieldMax: 15 },
  { cropKey: "papaya", patterns: [/\bpapaya\b/i], label: "Papaya", n: 6.0, p2o5: 2.3, k2o: 7.0, cao: 3.0, mgo: 1.5, yieldMin: 15, yieldMax: 25 },
  { cropKey: "arandano", patterns: [/\b(arandano|blueberry)/i], label: "Arándano", n: 4.7, p2o5: 0.8, k2o: 5.2, cao: 2.0, mgo: 1.2, yieldMin: 10, yieldMax: 35 },
  { cropKey: "frambuesa", patterns: [/\b(frambuesa|raspberry)/i], label: "Frambuesa", n: 16.9, p2o5: 3.6, k2o: 10.4, cao: 8.0, mgo: 3.7, yieldMin: 8, yieldMax: 20 },
  { cropKey: "frutilla", patterns: [/\b(frutilla|fresa|strawberry)/i], label: "Frutilla", n: 2.5, p2o5: 1.3, k2o: 4.5, cao: 1.6, mgo: 0.9, yieldMin: 25, yieldMax: 60 },
  { cropKey: "cebolla", patterns: [/\b(cebolla|onion)/i], label: "Cebolla", n: 3.1, p2o5: 1.2, k2o: 4.0, cao: 1.6, mgo: 0.9, yieldMin: 25, yieldMax: 50 },
  { cropKey: "coliflor", patterns: [/\b(coliflor|cauliflower)/i], label: "Coliflor", n: 4.5, p2o5: 1.4, k2o: 5.0, cao: 2.7, mgo: 1.5, yieldMin: 15, yieldMax: 30 },
  { cropKey: "brocoli", patterns: [/\b(brocoli|broccoli)/i], label: "Brócoli", n: 4.5, p2o5: 1.4, k2o: 5.0, cao: 2.7, mgo: 1.5, yieldMin: 15, yieldMax: 30 },
  { cropKey: "sandia", patterns: [/\b(sandia|watermelon)/i], label: "Sandía", n: 3.5, p2o5: 1.2, k2o: 4.5, cao: 1.7, mgo: 0.9, yieldMin: 20, yieldMax: 50 },
  { cropKey: "melon", patterns: [/\b(melon|cantaloupe)\b/i], label: "Melón", n: 4.5, p2o5: 1.6, k2o: 6.5, cao: 1.3, mgo: 0.7, yieldMin: 25, yieldMax: 70 },
  { cropKey: "pepino", patterns: [/\b(pepino|cucumber)/i], label: "Pepino ensalada", n: 1.3, p2o5: 0.8, k2o: 2.8, cao: 0.6, mgo: 0.3, yieldMin: 40, yieldMax: 300 },
  { cropKey: "lechuga", patterns: [/\b(lechugas?|lettuce)/i], label: "Lechugas", n: 2.7, p2o5: 0.9, k2o: 4.5, cao: 1.7, mgo: 1.0, yieldMin: 18, yieldMax: 50 },
  { cropKey: "arveja", patterns: [/\b(arvejas?|guisantes?|peas?)\b/i], label: "Arvejas", n: 8.0, p2o5: 4.2, k2o: 8.0, cao: 7.5, mgo: 3.8, yieldMin: 6, yieldMax: 10 },
  { cropKey: "zanahoria", patterns: [/\b(zanahoria|carrot)/i], label: "Zanahoria", n: 4.0, p2o5: 1.4, k2o: 6.5, cao: 2.0, mgo: 1.0, yieldMin: 25, yieldMax: 35 },
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

/** Tabla N.° 7 — sistemas de riego considerados para la eficiencia de nutrientes. */
export type IrrigationSystem = "surco_inundacion" | "aspersion_pivote" | "goteo_microaspersion";

export const IRRIGATION_SYSTEM_OPTIONS: IrrigationSystem[] = [
  "surco_inundacion",
  "aspersion_pivote",
  "goteo_microaspersion",
];

export type IrrigationNutrientKey = "n" | "p" | "k" | "mg" | "ca" | "s" | "b" | "zn";

export type IrrigationEfficiencyRange = { min: number; max: number };

export type IrrigationEfficiencyTable = Record<
  IrrigationSystem,
  Partial<Record<IrrigationNutrientKey, IrrigationEfficiencyRange>>
>;

/** Tabla N.° 7 — % de eficiencia de uso de nutrientes según sistema de riego (Vidal-Parra, 2008/2022). */
export const TABLE_7_IRRIGATION_EFFICIENCY: IrrigationEfficiencyTable = {
  surco_inundacion: {
    n: { min: 40, max: 60 },
    p: { min: 10, max: 20 },
    k: { min: 60, max: 75 },
    mg: { min: 60, max: 75 },
    ca: { min: 60, max: 75 },
    s: { min: 40, max: 60 },
    b: { min: 40, max: 60 },
    zn: { min: 40, max: 60 },
  },
  aspersion_pivote: {
    n: { min: 60, max: 70 },
    p: { min: 15, max: 25 },
    k: { min: 70, max: 80 },
    mg: { min: 70, max: 80 },
    ca: { min: 70, max: 80 },
    s: { min: 50, max: 50 },
    b: { min: 50, max: 50 },
    zn: { min: 50, max: 50 },
  },
  goteo_microaspersion: {
    n: { min: 75, max: 85 },
    p: { min: 25, max: 45 },
    k: { min: 85, max: 85 },
    mg: { min: 85, max: 85 },
    ca: { min: 85, max: 85 },
    s: { min: 70, max: 85 },
    b: { min: 70, max: 85 },
    zn: { min: 70, max: 85 },
  },
};

export function irrigationEfficiencyAverage(
  system: IrrigationSystem,
  nutrient: IrrigationNutrientKey,
  table: IrrigationEfficiencyTable = TABLE_7_IRRIGATION_EFFICIENCY
): number | null {
  const range = table[system]?.[nutrient];
  if (!range) return null;
  return Math.round(((range.min + range.max) / 2) * 10) / 10;
}

/** Tabla N.° 7 — promedios de eficiencia N/P/K/Mg para un sistema de riego. */
export function irrigationEfficiencyDefaults(
  system: IrrigationSystem,
  table: IrrigationEfficiencyTable = TABLE_7_IRRIGATION_EFFICIENCY
) {
  const fallback = { n: 60, p: 20, k: 70, mg: 70 };
  return {
    n: irrigationEfficiencyAverage(system, "n", table) ?? fallback.n,
    p: irrigationEfficiencyAverage(system, "p", table) ?? fallback.p,
    k: irrigationEfficiencyAverage(system, "k", table) ?? fallback.k,
    mg: irrigationEfficiencyAverage(system, "mg", table) ?? fallback.mg,
  };
}

/** Tabla N.° 2 — bandas de saturación de cationes (% CIC). */
export type CicCation = "ca" | "mg" | "k" | "na";

export type CicSaturationBand =
  | "very_low"
  | "low"
  | "moderately_low"
  | "adequate"
  | "moderately_high"
  | "high"
  | "very_high";

export type CicSaturationBandRow = {
  band: CicSaturationBand;
  min?: number;
  max?: number;
  rangeLabel: string;
  isAdequate?: boolean;
  target?: number;
};

export type CicSaturationBandTable = Record<CicCation, CicSaturationBandRow[]>;

export const TABLE_2_CIC_SATURATION_BANDS: CicSaturationBandTable = {
  ca: [
    { band: "very_low", min: 0, max: 25, rangeLabel: "<25%" },
    { band: "low", min: 25.01, max: 40, rangeLabel: "26–40%" },
    { band: "moderately_low", min: 40.01, max: 60, rangeLabel: "41–60%" },
    { band: "adequate", min: 60.01, max: 75, rangeLabel: "61–75%", isAdequate: true, target: 68 },
    { band: "moderately_high", min: 75.01, max: 80, rangeLabel: "76–80%" },
    { band: "high", min: 80.01, max: 85, rangeLabel: "81–85%" },
    { band: "very_high", min: 85.01, rangeLabel: ">85%" },
  ],
  mg: [
    { band: "very_low", min: 0, max: 3, rangeLabel: "<3%" },
    { band: "low", min: 3.01, max: 5, rangeLabel: "4–5%" },
    { band: "moderately_low", min: 5.01, max: 10, rangeLabel: "6–10%" },
    { band: "adequate", min: 10.01, max: 15, rangeLabel: "11–15%", isAdequate: true, target: 13 },
    { band: "moderately_high", min: 15.01, max: 20, rangeLabel: "16–20%" },
    { band: "high", min: 20.01, max: 30, rangeLabel: "21–30%" },
    { band: "very_high", min: 30.01, rangeLabel: ">30%" },
  ],
  k: [
    { band: "very_low", min: 0, max: 1, rangeLabel: "<1%" },
    { band: "low", min: 1.01, max: 2, rangeLabel: "1.1–2%" },
    { band: "moderately_low", min: 2.01, max: 3, rangeLabel: "2.1–3%" },
    { band: "adequate", min: 3.01, max: 4, rangeLabel: "3.1–4%", isAdequate: true, target: 3.55 },
    { band: "moderately_high", min: 4.01, max: 6, rangeLabel: "4.1–6%" },
    { band: "high", min: 6.01, max: 10, rangeLabel: "6.1–10%" },
    { band: "very_high", min: 10.01, rangeLabel: ">10%" },
  ],
  na: [
    { band: "very_low", min: 0, max: 1, rangeLabel: "<1%" },
    { band: "low", min: 1.01, max: 2, rangeLabel: "1–2%" },
    { band: "moderately_low", min: 2.01, max: 3, rangeLabel: "2.1–3%" },
    { band: "adequate", min: 3.01, max: 5, rangeLabel: "3.1–5%", isAdequate: true, target: 4 },
    { band: "moderately_high", min: 5.01, max: 10, rangeLabel: "5.1–10%" },
    { band: "high", min: 10.01, max: 20, rangeLabel: "10.1–20%" },
    { band: "very_high", min: 20.01, rangeLabel: ">20%" },
  ],
};

/** Tabla N.° 2 adequate targets, denormalized for quick access (Ca/Mg/K/Na/V%). */
export const TABLE_2_ADEQUATE_SATURATION = {
  ca: { min: 61, max: 75, target: 68 },
  mg: { min: 11, max: 15, target: 13 },
  k: { min: 3.1, max: 4, target: 3.55 },
  na: { min: 3.1, max: 5, target: 4 },
  totalBases: { min: 75, max: 80, target: 77.5 },
} as const;

/** Tabla N.° 3 — relaciones catiónicas óptimas. */
export type CicRelationKey = "ca_mg" | "ca_k" | "mg_k" | "k_na" | "ca_na";

export type CicRatioRangeRow = {
  optimalMin: number;
  optimalMax: number;
  lowMessageKey: string;
  highMessageKey: string;
};

export type CicRatioRangeTable = Record<CicRelationKey, CicRatioRangeRow>;

export const TABLE_3_CIC_RATIO_RANGES: CicRatioRangeTable = {
  ca_mg: { optimalMin: 3, optimalMax: 5, lowMessageKey: "cicRatioCaMgLow", highMessageKey: "cicRatioCaMgHigh" },
  ca_k: { optimalMin: 9, optimalMax: 25, lowMessageKey: "cicRatioCaKLow", highMessageKey: "cicRatioCaKHigh" },
  mg_k: { optimalMin: 2, optimalMax: 7, lowMessageKey: "cicRatioMgKLow", highMessageKey: "cicRatioMgKHigh" },
  k_na: { optimalMin: 1, optimalMax: 15, lowMessageKey: "cicRatioKNaLow", highMessageKey: "cicRatioKNaHigh" },
  ca_na: { optimalMin: 9, optimalMax: 25, lowMessageKey: "cicRatioCaNaLow", highMessageKey: "cicRatioCaNaHigh" },
};

/** Bundled reference data for the fertility plan engine (hardcoded fallback). */
export type SoilFertilityReference = {
  nutrientInterpretation: Table1Row[];
  nutrientInterpretationByExtractant: Record<Extractant, Table1Row[]>;
  oxideFactors: OxideFactors;
  cmolToMgKg: CmolToMgKgFactors;
  cropExtraction: CropExtractionCoefficients[];
  defaultExtraction: Omit<CropExtractionCoefficients, "cropKey" | "patterns">;
  amendments: Record<AmendmentMaterialKey, AmendmentMaterialSpec>;
  irrigationEfficiency: IrrigationEfficiencyTable;
  cicSaturationBands: CicSaturationBandTable;
  cicRatioRanges: CicRatioRangeTable;
};

export const DEFAULT_SOIL_FERTILITY_REFERENCE: SoilFertilityReference = {
  nutrientInterpretation: TABLE_1_NUTRIENT_INTERPRETATION,
  nutrientInterpretationByExtractant: TABLE_1_BY_EXTRACTANT,
  oxideFactors: TABLE_4_OXIDE_FACTORS,
  cmolToMgKg: TABLE_6_CMOL_TO_MGKG,
  cropExtraction: TABLE_5_CROP_EXTRACTION,
  defaultExtraction: TABLE_5_DEFAULT_EXTRACTION,
  amendments: TABLE_12_AMENDMENTS,
  irrigationEfficiency: TABLE_7_IRRIGATION_EFFICIENCY,
  cicSaturationBands: TABLE_2_CIC_SATURATION_BANDS,
  cicRatioRanges: TABLE_3_CIC_RATIO_RANGES,
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
  if (row.lowMax === undefined && value < row.adequateMin) return "adecuado";
  return "exceso";
}

function normalizeCropName(cropName?: string | null) {
  return (cropName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function matchesCropPattern(pattern: unknown, normalized: string): boolean {
  if (pattern instanceof RegExp) return pattern.test(normalized);
  if (typeof pattern === "string" && pattern.trim()) {
    try {
      return new RegExp(pattern, "i").test(normalized);
    } catch {
      return normalized.includes(pattern.toLowerCase());
    }
  }
  return false;
}

/** Exact Tabla N.° 5 match, or null when the crop is unknown (caller should collect manual extraction). */
export function findCropExtraction(
  cropName?: string | null,
  refs: Pick<SoilFertilityReference, "cropExtraction"> = DEFAULT_SOIL_FERTILITY_REFERENCE
): CropExtractionCoefficients | null {
  const normalized = normalizeCropName(cropName);
  if (!normalized) return null;
  for (const crop of refs.cropExtraction) {
    const patterns = crop.patterns || [];
    if (patterns.some((pattern) => matchesCropPattern(pattern, normalized))) {
      return crop;
    }
  }
  return null;
}

export function matchCropExtraction(
  cropName?: string | null,
  refs: Pick<SoilFertilityReference, "cropExtraction" | "defaultExtraction"> = DEFAULT_SOIL_FERTILITY_REFERENCE
) {
  return findCropExtraction(cropName, refs) ?? { ...refs.defaultExtraction, cropKey: "general" };
}

export function cmolToMgKg(
  cation: keyof CmolToMgKgFactors,
  cmolKg: number,
  factors: CmolToMgKgFactors = DEFAULT_SOIL_FERTILITY_REFERENCE.cmolToMgKg
) {
  return cmolKg * factors[cation];
}

/** Inverse of Tabla N.° 6 — mg/kg → cmol(+)/kg. */
export function mgKgToCmol(
  cation: keyof CmolToMgKgFactors,
  mgKg: number,
  factors: CmolToMgKgFactors = DEFAULT_SOIL_FERTILITY_REFERENCE.cmolToMgKg
) {
  const factor = factors[cation];
  if (!(factor > 0) || !Number.isFinite(mgKg)) return 0;
  return mgKg / factor;
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
