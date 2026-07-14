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
  { parameter: "ca", label: "Ca", unit: "cmol(+)/kg", lowMax: 5.9, adequateMin: 6, adequateMax: 16, highMin: 16.1 },
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

function cropExtraction(
  cropKey: string,
  label: string,
  aliases: string[],
  n: number,
  p2o5: number,
  k2o: number,
  cao: number,
  mgo: number,
  yieldMin: number,
  yieldMax: number
): CropExtractionCoefficients {
  return {
    cropKey,
    label,
    patterns: aliases.map(
      (alias) =>
        new RegExp(
          `(?:^|\\b)${normalizeCropName(alias).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\b)`,
          "i"
        )
    ),
    n,
    p2o5,
    k2o,
    cao,
    mgo,
    yieldMin,
    yieldMax,
  };
}

/** Tabla N.° 5 — Extracción nutricional de cultivos (kg/t rendimiento). */
export const TABLE_5_CROP_EXTRACTION: CropExtractionCoefficients[] = [
  cropExtraction("maiz_ensilaje", "Maíz ensilaje", ["maíz ensilaje", "corn silage", "maize silage", "silage corn"], 3.9, 1.6, 2.5, 0.8, 0.4, 70, 90),
  cropExtraction("tomate_industrial", "Tomate industrial", ["tomate industrial", "processing tomato"], 3.3, 0.8, 5, 0.8, 0.6, 45, 80),
  cropExtraction("tomate_invernadero", "Tomate invernadero", ["tomate invernadero", "greenhouse tomato"], 3.3, 0.8, 5, 0.4, 0.4, 80, 200),
  cropExtraction("frijol_negro", "Frijol negro", ["frijol negro", "black bean"], 19.5, 13, 39, 14.5, 9.8, 1.5, 3.5),
  cropExtraction("frijol_rojo", "Frijol rojo", ["frijol rojo", "red bean"], 20.5, 13.5, 40.5, 15, 10, 1.5, 3.5),
  cropExtraction("frijol_blanco", "Frijol blanco", ["frijol blanco", "white bean"], 20, 13.4, 39.5, 15, 10, 1.5, 3.5),
  cropExtraction("frijol_mungo", "Frijol mungo", ["frijol mungo", "mung bean"], 18, 11.5, 30, 10, 7, 1, 2.5),
  cropExtraction("caupi", "Caupí (Frijol de ojo negro)", ["caupí", "frijol de ojo negro", "cowpea", "black eyed pea"], 21, 12, 30, 8, 4, 1, 3),
  cropExtraction("batata", "Batata (Camote)", ["batata", "camote", "sweet potato"], 4.8, 1.8, 8.8, 1.2, 0.8, 15, 35),
  cropExtraction("malanga", "Malanga (Taro)", ["malanga", "taro"], 3.6, 1.4, 6.1, 1.8, 1, 15, 35),
  cropExtraction("coco", "Coco (copra)", ["coco", "copra", "coconut"], 50, 16.5, 11.8, 3.5, 2.8, 1, 4),
  cropExtraction("palma_aceitera", "Palma aceitera (RFF)", ["palma aceitera", "rff", "oil palm"], 6, 2, 9.8, 2.6, 1.3, 15, 30),
  cropExtraction("pepino", "Pepino ensalada", ["pepino ensalada", "pepino", "cucumber"], 1.3, 0.8, 2.8, 0.6, 0.3, 40, 300),
  cropExtraction("maiz_grano", "Maíz grano", ["maíz grano", "maíz", "maize", "corn"], 20, 6.9, 14, 4.5, 2.2, 12, 20),
  cropExtraction("tomate_campo", "Tomate campo", ["tomate campo", "tomate", "field tomato", "tomato"], 3.3, 0.8, 5, 1.2, 0.6, 45, 80),
  cropExtraction("frejoles", "Frejoles", ["frejoles", "frejol", "frijol", "habichuela", "beans"], 20, 13.7, 40, 15, 10, 2, 4),
  cropExtraction("naranja", "Naranja", ["naranja", "orange"], 2.7, 0.6, 4.2, 1.1, 0.6, 40, 70),
  cropExtraction("limon", "Limón", ["limón", "lemon", "lime"], 2.7, 0.6, 4.2, 1, 0.6, 40, 80),
  cropExtraction("aguacate", "Aguacate", ["aguacate", "avocado", "palta"], 6.2, 2.9, 18.2, 4.8, 2.5, 10, 15),
  cropExtraction("papaya", "Papaya", ["papaya"], 6, 2.3, 7, 3, 1.5, 15, 25),
  cropExtraction("arandano", "Arándano", ["arándano", "blueberry"], 4.7, 0.8, 5.2, 2, 1.2, 10, 35),
  cropExtraction("frambuesa", "Frambuesa", ["frambuesa", "raspberry"], 16.9, 3.6, 10.4, 8, 3.7, 8, 20),
  cropExtraction("frutilla", "Frutilla", ["frutilla", "fresa", "strawberry"], 2.5, 1.3, 4.5, 1.6, 0.9, 25, 60),
  cropExtraction("papa", "Papas", ["papas", "papa", "potato", "patata"], 3.8, 1, 4, 1.6, 0.9, 25, 50),
  cropExtraction("trigo", "Trigo", ["trigo", "wheat"], 24.3, 7.3, 24, 7, 4.3, 5, 9),
  cropExtraction("cebada", "Cebada", ["cebada", "barley"], 22.2, 7.1, 22, 8.6, 5.4, 4, 7),
  cropExtraction("avena", "Avena", ["avena", "oat", "oats"], 22.2, 7.6, 20, 8.5, 5.4, 4, 7),
  cropExtraction("arroz", "Arroz", ["arroz", "rice"], 21.4, 7.1, 27, 6.6, 4, 6, 9),
  cropExtraction("girasol", "Girasol", ["girasol", "sunflower"], 34.5, 11, 37.4, 15, 8, 3, 4),
  cropExtraction("cebolla", "Cebolla", ["cebolla", "onion"], 3.1, 1.2, 4, 1.6, 0.9, 25, 50),
  cropExtraction("coliflor", "Coliflor", ["coliflor", "cauliflower"], 4.5, 1.4, 5, 2.7, 1.5, 15, 30),
  cropExtraction("brocoli", "Brócoli", ["brócoli", "broccoli"], 4.5, 1.4, 5, 2.7, 1.5, 15, 30),
  cropExtraction("sandia", "Sandía", ["sandía", "watermelon"], 3.5, 1.2, 4.5, 1.7, 0.9, 20, 50),
  cropExtraction("melon", "Melón", ["melón", "cantaloupe"], 4.5, 1.6, 6.5, 1.3, 0.7, 25, 70),
  cropExtraction("lechuga", "Lechuga", ["lechuga", "lettuce"], 2.7, 0.9, 4.5, 1.7, 1, 18, 50),
  cropExtraction("arvejas", "Arvejas", ["arvejas", "arveja", "guisantes", "peas"], 8, 4.2, 8, 7.5, 3.8, 6, 10),
  cropExtraction("zanahoria", "Zanahoria", ["zanahoria", "carrot"], 4, 1.4, 6.5, 2, 1, 25, 35),
  cropExtraction("banano", "Banano", ["banano", "banana"], 1.9, 0.5, 5.4, 2.3, 3, 20, 60),
  cropExtraction("platano", "Plátano", ["plátano", "plantain"], 1.8, 0.5, 5, 2, 2.7, 15, 40),
  cropExtraction("pina", "Piña", ["piña", "pineapple"], 0.7, 0.5, 2.8, 0.4, 0.2, 40, 90),
  cropExtraction("yuca", "Yuca", ["yuca", "cassava", "manioca"], 4, 2.9, 6.2, 2.8, 1.7, 15, 40),
  cropExtraction("name", "Ñame", ["ñame", "yam"], 3.8, 1.8, 6.5, 1.9, 1.1, 12, 30),
  cropExtraction("yautia", "Yautía", ["yautía", "tannia"], 3.5, 1.5, 6.3, 1.9, 1, 15, 30),
  cropExtraction("cana_azucar", "Caña de azúcar", ["caña de azúcar", "caña", "sugarcane"], 0.8, 0.5, 1.4, 0.4, 0.2, 70, 150),
  cropExtraction("cacao", "Cacao", ["cacao", "cocoa"], 10, 5, 23, 1.4, 1.7, 0.5, 2.5),
  cropExtraction("cafe", "Café", ["café", "coffee"], 25, 6, 20.2, 1.4, 3.3, 0.8, 3.5),
  cropExtraction("mango", "Mango", ["mango"], 1.5, 0.5, 2.4, 0.8, 0.5, 8, 25),
  cropExtraction("guayaba", "Guayaba", ["guayaba", "guava"], 2, 0.7, 3.5, 1, 0.6, 10, 35),
  cropExtraction("maracuya", "Maracuyá", ["maracuyá", "passion fruit"], 3.5, 1.5, 6.5, 2, 1, 15, 35),
  cropExtraction("guanabana", "Guanábana", ["guanábana", "soursop"], 2.2, 0.8, 3.8, 1.2, 0.8, 8, 20),
  cropExtraction("pitahaya", "Pitahaya", ["pitahaya", "dragon fruit"], 2.8, 1, 4.5, 1.3, 0.8, 10, 30),
  cropExtraction("soya", "Soya", ["soya", "soja", "soybean"], 65, 15, 22, 6, 3.5, 2, 5),
  cropExtraction("garbanzo", "Garbanzo", ["garbanzo", "chickpea"], 32, 8.5, 12, 4, 2, 1, 3),
  cropExtraction("lenteja", "Lenteja", ["lenteja", "lentil"], 36, 10, 13, 5, 2.5, 1, 2.5),
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

function patternSearchText(pattern: unknown) {
  if (pattern instanceof RegExp) {
    return normalizeCropName(
      pattern.source
        .replace(/^\(\?:\^\|\\b\)/, "")
        .replace(/\(\?:\$\|\\b\)$/, "")
        .replace(/\\([-.*+?^${}()|[\]\\])/g, "$1")
    );
  }
  if (typeof pattern === "string") return normalizeCropName(pattern);
  return "";
}

function significantCropTokens(normalized: string) {
  const stop = new Set(["de", "del", "la", "el", "los", "las", "the", "and", "y", "of", "a"]);
  return normalized
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stop.has(token))
    .sort((a, b) => b.length - a.length);
}

function textHasCropToken(text: string, token: string) {
  return new RegExp(
    `(?:^|\\b)${token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:$|\\b)`,
    "i"
  ).test(text);
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

function cropMatchedViaSpecificAlias(
  crop: CropExtractionCoefficients,
  normalized: string
) {
  return (crop.patterns || []).some((pattern) => {
    if (!matchesCropPattern(pattern, normalized)) return false;
    return significantCropTokens(patternSearchText(pattern)).length > 1;
  });
}

function findCropFamilyByToken(
  token: string,
  refs: Pick<SoilFertilityReference, "cropExtraction">
) {
  return refs.cropExtraction.filter((crop) => {
    const haystacks = [
      normalizeCropName(crop.label),
      normalizeCropName(crop.cropKey.replace(/_/g, " ")),
      ...(crop.patterns || []).map(patternSearchText),
    ];
    return haystacks.some((text) => textHasCropToken(text, token));
  });
}

/** Exact Tabla N.° 5 match, or null when the crop is unknown (caller should collect manual extraction). */
export function findCropExtraction(
  cropName?: string | null,
  refs: Pick<SoilFertilityReference, "cropExtraction"> = DEFAULT_SOIL_FERTILITY_REFERENCE
): CropExtractionCoefficients | null {
  const variants = findCropExtractionVariants(cropName, refs);
  return variants.length === 1 ? variants[0] : null;
}

/**
 * Returns Tabla N.° 5 forms for a setup crop name.
 * A generic name like "maíz" / "tomate" expands to all related forms;
 * a specific name like "maíz grano" returns only that row.
 */
export function findCropExtractionVariants(
  cropName?: string | null,
  refs: Pick<SoilFertilityReference, "cropExtraction"> = DEFAULT_SOIL_FERTILITY_REFERENCE
): CropExtractionCoefficients[] {
  const normalized = normalizeCropName(cropName);
  if (!normalized) return [];

  const exactMatches = refs.cropExtraction.filter((crop) =>
    (crop.patterns || []).some((pattern) => matchesCropPattern(pattern, normalized))
  );

  if (exactMatches.length === 1) {
    const crop = exactMatches[0];
    if (cropMatchedViaSpecificAlias(crop, normalized)) return [crop];

    const primaryToken = significantCropTokens(normalized)[0];
    if (!primaryToken) return [crop];

    const family = findCropFamilyByToken(primaryToken, refs);
    return family.length > 1 ? family : [crop];
  }

  if (exactMatches.length > 1) return exactMatches;

  const primaryToken = significantCropTokens(normalized)[0];
  if (!primaryToken) return [];
  const family = findCropFamilyByToken(primaryToken, refs);
  return family.length > 1 ? family : [];
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
