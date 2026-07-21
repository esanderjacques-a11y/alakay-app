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
    key: "nitrato_de_calcio",
    label: "Nitrato de calcio",
    analysis: "15.5-0-0 + 26.5% CaO",
    grade: { n: 15.5, cao: 26.5 },
  },
  {
    key: "gypsum",
    label: "Gypsum",
    analysis: "14% CaO + 18% S",
    grade: { cao: 14, s: 18 },
  },
  {
    key: "agricultural_lime",
    label: "Agricultural lime",
    analysis: "40% CaO",
    grade: { cao: 40 },
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

function normalizeProductToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Map free-text bodega names to catalog keys when possible. */
export function matchCatalogProductKey(
  name: string | null | undefined
): string | null {
  const token = normalizeProductToken(name || "");
  if (!token) return null;
  for (const product of COMMERCIAL_FERTILIZERS) {
    const keyToken = normalizeProductToken(product.key.replace(/_/g, " "));
    const labelToken = normalizeProductToken(product.label);
    if (
      token === keyToken ||
      token === labelToken ||
      token.includes(keyToken) ||
      labelToken.includes(token) ||
      token.includes(labelToken.split(" ")[0] || "")
    ) {
      return product.key;
    }
  }
  // Common aliases
  if (/\burea\b/.test(token)) return "urea";
  if (/\bdap\b/.test(token)) return "dap";
  if (/\bmap\b/.test(token)) return "map";
  if (/\bmop\b|\bkcl\b|muriate/.test(token)) return "mop";
  if (/\bsop\b|sulfate of potash|sulphate of potash/.test(token)) return "sop";
  if (/\btsp\b|triple super/.test(token)) return "tsp";
  if (/kieserite/.test(token)) return "kieserite";
  if (/\bgypsum\b|\byeso\b/.test(token)) return "gypsum";
  if (/\blime\b|cal agricola|agricultural lime|calcit/.test(token)) {
    return "agricultural_lime";
  }
  if (/nitrato de calcio|nitrato_de_calcio/.test(token)) {
    return "nitrato_de_calcio";
  }
  if (/calcium nitrate|calcium_nitrate/.test(token)) {
    return "calcium_nitrate";
  }
  if (/npk\s*15/.test(token)) return "npk_15_15_15";
  if (/npk\s*10/.test(token)) return "npk_10_30_10";
  return null;
}

