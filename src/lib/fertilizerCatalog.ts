export type FertilizerNutrient =
  | "n"
  | "p2o5"
  | "k2o"
  | "cao"
  | "mgo"
  | "s";

export type FertilizerBenchmarkKey =
  | "urea"
  | "dap"
  | "tsp"
  | "potassium_chloride";

export type CommercialFertilizer = {
  key: string;
  label: string;
  analysis: string;
  grade: Partial<Record<FertilizerNutrient, number>>;
  benchmarkKey?: FertilizerBenchmarkKey;
  benchmarkProxy?: boolean;
};

/** Common commercial fertilizers. Grades are percentages by product mass. */
export const COMMERCIAL_FERTILIZERS: CommercialFertilizer[] = [
  {
    key: "urea",
    label: "Urea",
    analysis: "46-0-0",
    grade: { n: 46 },
    benchmarkKey: "urea",
  },
  {
    key: "dap",
    label: "DAP",
    analysis: "18-46-0",
    grade: { n: 18, p2o5: 46 },
    benchmarkKey: "dap",
  },
  {
    key: "map",
    label: "MAP",
    analysis: "11-52-0",
    grade: { n: 11, p2o5: 52 },
    benchmarkKey: "dap",
    benchmarkProxy: true,
  },
  {
    key: "ammonium_nitrate",
    label: "Ammonium nitrate",
    analysis: "34-0-0",
    grade: { n: 34 },
  },
  {
    key: "calcium_nitrate",
    label: "Calcium nitrate",
    analysis: "15.5-0-0 + 26.5% CaO",
    grade: { n: 15.5, cao: 26.5 },
  },
  {
    key: "ammonium_sulfate",
    label: "Ammonium sulfate",
    analysis: "21-0-0 + 24% S",
    grade: { n: 21, s: 24 },
  },
  {
    key: "tsp",
    label: "Triple superphosphate (TSP)",
    analysis: "0-46-0",
    grade: { p2o5: 46 },
    benchmarkKey: "tsp",
  },
  {
    key: "mop",
    label: "Muriate of potash (MOP/KCl)",
    analysis: "0-0-60",
    grade: { k2o: 60 },
    benchmarkKey: "potassium_chloride",
  },
  {
    key: "sop",
    label: "Sulfate of potash (SOP)",
    analysis: "0-0-50 + 18% S",
    grade: { k2o: 50, s: 18 },
  },
  {
    key: "npk_15_15_15",
    label: "NPK 15-15-15",
    analysis: "15-15-15",
    grade: { n: 15, p2o5: 15, k2o: 15 },
  },
  {
    key: "npk_10_30_10",
    label: "NPK 10-30-10",
    analysis: "10-30-10",
    grade: { n: 10, p2o5: 30, k2o: 10 },
  },
  {
    key: "kieserite",
    label: "Kieserite",
    analysis: "27% MgO + 22% S",
    grade: { mgo: 27, s: 22 },
  },
  {
    key: "magnesium_sulfate",
    label: "Magnesium sulfate",
    analysis: "16% MgO + 13% S",
    grade: { mgo: 16, s: 13 },
  },
];

export const FERTILIZER_CURRENCIES = [
  "USD",
  "EUR",
  "HTG",
  "DOP",
  "CRC",
  "CAD",
  "MXN",
  "BRL",
  "GBP",
  "XOF",
  "XAF",
  "KES",
  "TZS",
  "ZAR",
] as const;

/** Most common commercial bag size in retailer markets. */
export const DEFAULT_FERTILIZER_BAG_KG = 50;

export function pricePerBagFromTonne(
  pricePerMetricTonne: number,
  bagKg: number = DEFAULT_FERTILIZER_BAG_KG
) {
  if (!(pricePerMetricTonne > 0) || !(bagKg > 0)) return null;
  return Math.round(pricePerMetricTonne * (bagKg / 1000) * 100) / 100;
}

export function fertilizersForNutrient(nutrient: FertilizerNutrient) {
  return COMMERCIAL_FERTILIZERS.filter(
    (product) => (product.grade[nutrient] || 0) > 0
  );
}

