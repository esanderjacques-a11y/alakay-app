export type FertilizerNutrient =
  | "n"
  | "p2o5"
  | "k2o"
  | "cao"
  | "mgo"
  | "s"
  | "zn"
  | "b"
  | "fe"
  | "mn"
  | "cu"
  | "mo";

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
  /** User-created product or saved formulation. */
  custom?: boolean;
};

export type InertFiller = {
  key: string;
  label: string;
  description: string;
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
  {
    key: "zinc_sulfate",
    label: "Zinc sulfate",
    analysis: "35% Zn + 17% S",
    grade: { zn: 35, s: 17 },
  },
  {
    key: "borax",
    label: "Borax",
    analysis: "11% B",
    grade: { b: 11 },
  },
  {
    key: "solubor",
    label: "Solubor",
    analysis: "20% B",
    grade: { b: 20 },
  },
  {
    key: "ferrous_sulfate",
    label: "Ferrous sulfate",
    analysis: "20% Fe + 11% S",
    grade: { fe: 20, s: 11 },
  },
  {
    key: "manganese_sulfate",
    label: "Manganese sulfate",
    analysis: "32% Mn + 18% S",
    grade: { mn: 32, s: 18 },
  },
  {
    key: "copper_sulfate",
    label: "Copper sulfate",
    analysis: "25% Cu + 12% S",
    grade: { cu: 25, s: 12 },
  },
  {
    key: "sodium_molybdate",
    label: "Sodium molybdate",
    analysis: "39% Mo",
    grade: { mo: 39 },
  },
];

/** Inert carriers that do not change nutrient composition. */
export const INERT_FILLERS: InertFiller[] = [
  {
    key: "silica_sand",
    label: "Silica sand",
    description: "Neutral mineral filler; no nutrients.",
  },
  {
    key: "bentonite",
    label: "Bentonite clay",
    description: "Common granulation binder/filler; inert for NPK grades.",
  },
  {
    key: "vermiculite",
    label: "Vermiculite",
    description: "Lightweight inert carrier for blends.",
  },
  {
    key: "diatomaceous_earth",
    label: "Diatomaceous earth",
    description: "Inert mineral filler for dry mixes.",
  },
  {
    key: "rice_husk",
    label: "Rice husk",
    description: "Low-cost organic inert filler.",
  },
];

export const DEFAULT_FILLER_KEY = "bentonite";

const MICRO_NUTRIENTS: FertilizerNutrient[] = [
  "zn",
  "b",
  "fe",
  "mn",
  "cu",
  "mo",
];

/**
 * Pick an inert filler for the target grade.
 * - Micros → vermiculite (lightweight carrier)
 * - High NPK (≥45) → bentonite (granulation binder)
 * - Low NPK (≤20) → silica sand (bulk mineral filler)
 * - Otherwise → bentonite default
 */
export function recommendFiller(
  preferredKey?: string | null,
  targetGrade?: Partial<Record<FertilizerNutrient, number>> | null
): InertFiller {
  if (preferredKey) {
    const match = INERT_FILLERS.find((item) => item.key === preferredKey);
    if (match) return match;
  }

  const grade = targetGrade || {};
  const hasMicros = MICRO_NUTRIENTS.some((key) => (grade[key] || 0) > 0);
  const npkSum = (grade.n || 0) + (grade.p2o5 || 0) + (grade.k2o || 0);

  let key = DEFAULT_FILLER_KEY;
  if (hasMicros) key = "vermiculite";
  else if (npkSum >= 45) key = "bentonite";
  else if (npkSum > 0 && npkSum <= 20) key = "silica_sand";

  return (
    INERT_FILLERS.find((item) => item.key === key) ||
    INERT_FILLERS.find((item) => item.key === DEFAULT_FILLER_KEY) ||
    INERT_FILLERS[0]
  );
}

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

const CUSTOM_FERTILIZER_STORAGE_KEY = "cultosol_custom_fertilizers_v1";

function normalizeProductToken(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function slugifyFertilizerKey(label: string) {
  const slug = normalizeProductToken(label).replace(/\s+/g, "_");
  return slug || "custom";
}

export function analysisFromGrade(
  grade: Partial<Record<FertilizerNutrient, number>>
) {
  const n = grade.n || 0;
  const p = grade.p2o5 || 0;
  const k = grade.k2o || 0;
  const extras: string[] = [];
  if ((grade.mgo || 0) > 0) extras.push(`${grade.mgo}% MgO`);
  if ((grade.cao || 0) > 0) extras.push(`${grade.cao}% CaO`);
  if ((grade.s || 0) > 0) extras.push(`${grade.s}% S`);
  if ((grade.zn || 0) > 0) extras.push(`${grade.zn}% Zn`);
  if ((grade.b || 0) > 0) extras.push(`${grade.b}% B`);
  if ((grade.fe || 0) > 0) extras.push(`${grade.fe}% Fe`);
  if ((grade.mn || 0) > 0) extras.push(`${grade.mn}% Mn`);
  if ((grade.cu || 0) > 0) extras.push(`${grade.cu}% Cu`);
  if ((grade.mo || 0) > 0) extras.push(`${grade.mo}% Mo`);
  const base = `${n}-${p}-${k}`;
  return extras.length ? `${base} + ${extras.join(", ")}` : base;
}

export function loadCustomFertilizers(): CommercialFertilizer[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_FERTILIZER_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CommercialFertilizer[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item) =>
          item &&
          typeof item.key === "string" &&
          typeof item.label === "string" &&
          item.grade &&
          typeof item.grade === "object"
      )
      .map((item) => ({
        ...item,
        custom: true,
        analysis: item.analysis || analysisFromGrade(item.grade),
      }));
  } catch {
    return [];
  }
}

function persistCustomFertilizers(products: CommercialFertilizer[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CUSTOM_FERTILIZER_STORAGE_KEY,
      JSON.stringify(products.map((item) => ({ ...item, custom: true })))
    );
  } catch {
    // Ignore quota/privacy errors.
  }
}

/** Built-in catalog plus user-saved custom fertilizers / formulas. */
export function listAllFertilizers(): CommercialFertilizer[] {
  const custom = loadCustomFertilizers();
  const customKeys = new Set(custom.map((item) => item.key));
  return [
    ...custom,
    ...COMMERCIAL_FERTILIZERS.filter((item) => !customKeys.has(item.key)),
  ];
}

export function upsertCustomFertilizer(input: {
  label: string;
  grade: Partial<Record<FertilizerNutrient, number>>;
  analysis?: string;
  key?: string;
}): CommercialFertilizer {
  const grade: Partial<Record<FertilizerNutrient, number>> = {};
  for (const [key, value] of Object.entries(input.grade)) {
    if (typeof value === "number" && value > 0) {
      grade[key as FertilizerNutrient] = value;
    }
  }
  const key =
    input.key ||
    `custom_${slugifyFertilizerKey(input.label)}_${Date.now().toString(36)}`;
  const product: CommercialFertilizer = {
    key,
    label: input.label.trim() || "Custom fertilizer",
    analysis: input.analysis || analysisFromGrade(grade),
    grade,
    custom: true,
  };
  const existing = loadCustomFertilizers().filter((item) => item.key !== key);
  persistCustomFertilizers([product, ...existing]);
  return product;
}

export function removeCustomFertilizer(key: string) {
  persistCustomFertilizers(
    loadCustomFertilizers().filter((item) => item.key !== key)
  );
}

export function pricePerBagFromTonne(
  pricePerMetricTonne: number,
  bagKg: number = DEFAULT_FERTILIZER_BAG_KG
) {
  if (!(pricePerMetricTonne > 0) || !(bagKg > 0)) return null;
  return Math.round(pricePerMetricTonne * (bagKg / 1000) * 100) / 100;
}

export function fertilizersForNutrient(nutrient: FertilizerNutrient) {
  return listAllFertilizers().filter(
    (product) => (product.grade[nutrient] || 0) > 0
  );
}

/** Map free-text bodega names to catalog keys when possible. */
export function matchCatalogProductKey(
  name: string | null | undefined
): string | null {
  const token = normalizeProductToken(name || "");
  if (!token) return null;
  for (const product of listAllFertilizers()) {
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
  if (/zinc sulfate|sulfato de zinc/.test(token)) return "zinc_sulfate";
  if (/\bborax\b/.test(token)) return "borax";
  if (/solubor/.test(token)) return "solubor";
  if (/ferrous sulfate|sulfato ferroso/.test(token)) return "ferrous_sulfate";
  if (/manganese sulfate|sulfato de manganeso/.test(token)) {
    return "manganese_sulfate";
  }
  if (/copper sulfate|sulfato de cobre/.test(token)) return "copper_sulfate";
  if (/molybdate|molibdato/.test(token)) return "sodium_molybdate";
  if (/npk\s*15/.test(token)) return "npk_15_15_15";
  if (/npk\s*10/.test(token)) return "npk_10_30_10";
  return null;
}
