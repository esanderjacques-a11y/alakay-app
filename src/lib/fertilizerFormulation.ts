import {
  DEFAULT_FERTILIZER_BAG_KG,
  INERT_FILLERS,
  listAllFertilizers,
  recommendFiller,
  type CommercialFertilizer,
  type FertilizerNutrient,
  type InertFiller,
} from "@/lib/fertilizerCatalog";

export type FormulationMassUnit = "kg" | "lb" | "t";

export type FormulationFinishMode = "filler" | "no_filler";

export type FormulationGrade = Partial<Record<FertilizerNutrient, number>>;

export type FormulationLine = {
  productKey: string;
  label: string;
  analysis: string;
  /** Mass in kg (internal). */
  kg: number;
  isFiller: boolean;
};

export type FormulationResult = {
  feasible: boolean;
  /** True when the finished bag matches the requested target grade. */
  exactMatch: boolean;
  /** Full catalog (Best mix) can hit the exact target. */
  autoCanSolve: boolean;
  lines: FormulationLine[];
  /** Nutrient kg delivered by active products (before scale). */
  nutrientsDelivered: FormulationGrade;
  /** Total active product mass before filler / scale (kg). */
  productMassKg: number;
  /** Filler mass when finishMode is filler (kg); else 0. */
  fillerMassKg: number;
  /** Final batch mass after filler or scale (kg). */
  batchMassKg: number;
  targetGrade: FormulationGrade;
  /** Printed grade for the finished bag. */
  outputGrade: FormulationGrade;
  /** Classic N-P-K label string. */
  gradeLabel: string;
  /** desiredBatchKg / productMassKg when no filler; 1 with filler. */
  scaleFactor: number;
  unmet: FormulationGrade;
  /** Human-readable unmet nutrient labels (e.g. "N", "P₂O₅"). */
  unmetLabels: string[];
  estimatedCost: number | null;
  /** Selected inert fillers used to top up mass (may be several). */
  fillers: InertFiller[];
};

export type FormulationOptimizeFor = "mix" | "value" | "random";

export type BuildFormulationInput = {
  targetGrade: FormulationGrade;
  /** Desired finished batch size in the selected unit. */
  batchSize: number;
  unit: FormulationMassUnit;
  finishMode: FormulationFinishMode;
  /** null/empty = full catalog (auto). */
  allowedProductKeys?: string[] | null;
  /** One or more inert filler keys; mass is split evenly when several are selected. */
  fillerKeys?: string[] | null;
  /** @deprecated Prefer fillerKeys. */
  fillerKey?: string | null;
  /** Price per bag for products (same map as cost page). */
  prices?: Record<string, number>;
  /** Optional catalog override (defaults to built-in + custom fertilizers). */
  catalog?: CommercialFertilizer[];
  bagKg?: number;
  /**
   * mix = fewest products then cost (Best mix).
   * value = lowest estimated cost (Best value).
   * random = pick a random exact mix (uses randomUnit).
   */
  optimizeFor?: FormulationOptimizeFor;
  /** Unit interval [0, 1) used to pick among exact mixes when optimizeFor is random. */
  randomUnit?: number;
};

const FORMULATION_NUTRIENTS: FertilizerNutrient[] = [
  "n",
  "p2o5",
  "k2o",
  "mgo",
  "cao",
  "s",
  "zn",
  "b",
  "fe",
  "mn",
  "cu",
  "mo",
];

const COMPOUND_PREFERRED = ["npk_15_15_15", "npk_10_30_10", "dap", "map"];

const COST_NEAR_PCT = 0.05;
const KG_PER_LB = 0.45359237;
const LB_PER_KG = 2.2046226218;
const KG_PER_T = 1000;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function resolveSelectedFillers(input: BuildFormulationInput): InertFiller[] {
  const keys = [
    ...(input.fillerKeys || []),
    ...(input.fillerKey ? [input.fillerKey] : []),
  ].filter(Boolean);
  const unique = [...new Set(keys)];
  const selected = unique
    .map((key) => INERT_FILLERS.find((item) => item.key === key))
    .filter((item): item is InertFiller => Boolean(item));
  if (selected.length > 0) return selected;
  return [recommendFiller(null, input.targetGrade)];
}

export function toKg(value: number, unit: FormulationMassUnit) {
  if (!(value > 0)) return 0;
  if (unit === "lb") return value * KG_PER_LB;
  if (unit === "t") return value * KG_PER_T;
  return value;
}

export function fromKg(valueKg: number, unit: FormulationMassUnit) {
  if (!(valueKg > 0)) return 0;
  if (unit === "lb") return valueKg * LB_PER_KG;
  if (unit === "t") return valueKg / KG_PER_T;
  return valueKg;
}

export function cleanGrade(grade: FormulationGrade): FormulationGrade {
  const next: FormulationGrade = {};
  for (const key of FORMULATION_NUTRIENTS) {
    const value = grade[key];
    if (value != null && value > 0) next[key] = value;
  }
  return next;
}

export function gradeLabelFrom(grade: FormulationGrade) {
  const n = grade.n || 0;
  const p = grade.p2o5 || 0;
  const k = grade.k2o || 0;
  const extras: string[] = [];
  if ((grade.mgo || 0) > 0) extras.push(`${round1(grade.mgo!)} MgO`);
  if ((grade.cao || 0) > 0) extras.push(`${round1(grade.cao!)} CaO`);
  if ((grade.s || 0) > 0) extras.push(`${round1(grade.s!)} S`);
  if ((grade.zn || 0) > 0) extras.push(`${round1(grade.zn!)} Zn`);
  if ((grade.b || 0) > 0) extras.push(`${round1(grade.b!)} B`);
  if ((grade.fe || 0) > 0) extras.push(`${round1(grade.fe!)} Fe`);
  if ((grade.mn || 0) > 0) extras.push(`${round1(grade.mn!)} Mn`);
  if ((grade.cu || 0) > 0) extras.push(`${round1(grade.cu!)} Cu`);
  if ((grade.mo || 0) > 0) extras.push(`${round1(grade.mo!)} Mo`);
  const base = `${round1(n)}-${round1(p)}-${round1(k)}`;
  return extras.length ? `${base} + ${extras.join(", ")}` : base;
}

function cloneTargets(targets: FormulationGrade): FormulationGrade {
  return cleanGrade(targets);
}

function targetSum(targets: FormulationGrade) {
  return FORMULATION_NUTRIENTS.reduce((sum, key) => sum + (targets[key] || 0), 0);
}

function nutrientsCovered(product: CommercialFertilizer): FertilizerNutrient[] {
  return FORMULATION_NUTRIENTS.filter((n) => (product.grade[n] || 0) > 0);
}

function massToCloseBinding(
  product: CommercialFertilizer,
  remaining: FormulationGrade,
  options?: { exact?: boolean }
): number {
  const exact = options?.exact === true;
  let massNeeded = Infinity;
  let helps = false;
  for (const nutrient of FORMULATION_NUTRIENTS) {
    const pct = product.grade[nutrient] || 0;
    if (pct <= 0) continue;
    const need = remaining[nutrient] || 0;
    if (need <= 0.05) {
      // Product still carries this nutrient — any added mass oversupplies.
      if (exact) return 0;
      continue;
    }
    helps = true;
    const kg = need / (pct / 100);
    massNeeded = Math.min(massNeeded, kg);
  }
  return helps && Number.isFinite(massNeeded) ? massNeeded : 0;
}

/** Delivered nutrient kg must match targets (no shortfall or oversupply). */
function nutrientsMatchTargets(
  delivered: FormulationGrade,
  targetsKg: FormulationGrade,
  tol = 0.45
) {
  for (const nutrient of FORMULATION_NUTRIENTS) {
    const want = targetsKg[nutrient] || 0;
    const have = delivered[nutrient] || 0;
    if (want <= 0) {
      if (have > tol) return false;
      continue;
    }
    if (Math.abs(have - want) > tol) return false;
  }
  return true;
}

function scoreProduct(
  product: CommercialFertilizer,
  remaining: FormulationGrade,
  prices: Record<string, number>,
  bagKg: number,
  bias: "value" | "compound" | "single",
  exact = false
): number {
  const covered = nutrientsCovered(product).filter((n) => (remaining[n] || 0) > 0);
  if (covered.length === 0) return -Infinity;

  const mass = massToCloseBinding(product, remaining, { exact });
  if (mass <= 0) return -Infinity;

  let usefulKg = 0;
  for (const n of covered) {
    usefulKg += Math.min(
      remaining[n] || 0,
      mass * ((product.grade[n] || 0) / 100)
    );
  }

  const price = prices[product.key] || 0;
  const hasPrice = price > 0 && bagKg > 0;
  let score = hasPrice
    ? usefulKg / ((mass / bagKg) * price)
    : usefulKg / Math.max(mass, 0.001);

  if (bias === "compound") {
    score *= 1 + covered.length * 0.45;
    if (COMPOUND_PREFERRED.includes(product.key)) score *= 1.25;
  } else if (bias === "single") {
    score *= covered.length === 1 ? 1.4 : 0.55;
  } else {
    // Prefer multi-nutrient products: they credit several oxides at once.
    score *= 1 + (covered.length - 1) * 0.55;
    if (covered.length >= 2) score *= 1.15;
  }

  // Exact mixes: prefer products that close more of the remaining demand
  // without locking unbalanced N-P-K ratios (e.g. 15-15-15 for 10-30-10).
  if (exact && covered.length >= 2) {
    const ratios: number[] = [];
    for (const n of covered) {
      const need = remaining[n] || 0;
      const pct = product.grade[n] || 0;
      if (need > 0.05 && pct > 0) ratios.push(need / pct);
    }
    if (ratios.length >= 2) {
      const minR = Math.min(...ratios);
      const maxR = Math.max(...ratios);
      if (maxR > minR * 1.35) score *= 0.35;
    }
  }

  return score;
}

type RawLine = {
  product: CommercialFertilizer;
  kg: number;
};

function allocateRecipe(
  targetsKg: FormulationGrade,
  catalog: CommercialFertilizer[],
  prices: Record<string, number>,
  bagKg: number,
  options: {
    bias: "value" | "compound" | "single";
    forceOrder?: string[];
    /** When false, return a partial recipe even if some nutrients remain unmet. */
    requireExact?: boolean;
  }
): { lines: RawLine[]; unmet: FormulationGrade } | null {
  const remaining = cloneTargets(targetsKg);
  if (targetSum(remaining) <= 0) {
    return { lines: [], unmet: {} };
  }
  if (catalog.length === 0) return null;

  const byKey = new Map(catalog.map((p) => [p.key, p]));
  const lines: RawLine[] = [];
  const forceQueue = [...(options.forceOrder || [])];
  const maxSteps = 32;
  const requireExact = options.requireExact !== false;
  const bindOpts = { exact: requireExact };

  for (let step = 0; step < maxSteps && targetSum(remaining) > 0.05; step++) {
    let product: CommercialFertilizer | undefined;

    while (forceQueue.length > 0 && !product) {
      const key = forceQueue.shift()!;
      const candidate = byKey.get(key);
      if (candidate && massToCloseBinding(candidate, remaining, bindOpts) > 0) {
        product = candidate;
      }
    }

    if (!product) {
      let bestScore = -Infinity;
      for (const candidate of catalog) {
        const score = scoreProduct(
          candidate,
          remaining,
          prices,
          bagKg,
          options.bias,
          requireExact
        );
        if (score > bestScore) {
          bestScore = score;
          product = candidate;
        }
      }
    }

    if (!product) break;

    const mass = massToCloseBinding(product, remaining, bindOpts);
    if (!(mass > 0.05)) break;

    // Credit every nutrient the product carries (multi-nutrient sources).
    for (const nutrient of FORMULATION_NUTRIENTS) {
      const pct = product.grade[nutrient] || 0;
      if (pct <= 0) continue;
      const amount = mass * (pct / 100);
      const need = remaining[nutrient] || 0;
      if (need > 0) {
        const used = Math.min(need, amount);
        remaining[nutrient] = round2(need - used);
        if (remaining[nutrient]! <= 0.005) delete remaining[nutrient];
      }
    }

    const existing = lines.find((line) => line.product.key === product!.key);
    if (existing) existing.kg = round2(existing.kg + mass);
    else lines.push({ product, kg: round2(mass) });
  }

  const unmet = cloneTargets(remaining);
  if (requireExact && targetSum(unmet) > 0.5) return null;
  if (lines.length === 0) return null;
  if (requireExact && !nutrientsMatchTargets(nutrientsFromLines(lines), targetsKg)) {
    return null;
  }
  return { lines, unmet };
}

function pickBestRecipe(
  candidates: Array<{ lines: RawLine[]; unmet: FormulationGrade; cost: number } | null>,
  optimizeFor: FormulationOptimizeFor = "mix",
  batchMassKg?: number
): { lines: RawLine[]; unmet: FormulationGrade; cost: number } | null {
  const feasible = candidates.filter(
    (c): c is { lines: RawLine[]; unmet: FormulationGrade; cost: number } =>
      Boolean(c)
  );
  if (feasible.length === 0) return null;

  feasible.sort((a, b) => {
    const aUnmet = targetSum(a.unmet);
    const bUnmet = targetSum(b.unmet);
    // Prefer recipes that leave less unmet nutrient mass.
    if (Math.abs(aUnmet - bUnmet) > 0.25) return aUnmet - bUnmet;

    // When nutrient targets are met, prefer bag-fitting mixes; otherwise the
    // lowest product mass (scales down less → closest grade from below).
    if (batchMassKg != null && aUnmet <= 0.5 && bUnmet <= 0.5) {
      const aMass = recipeProductMass(a.lines);
      const bMass = recipeProductMass(b.lines);
      const aFit = recipeFitsBatch(a.lines, batchMassKg);
      const bFit = recipeFitsBatch(b.lines, batchMassKg);
      if (aFit !== bFit) return aFit ? -1 : 1;
      if (!aFit && !bFit && Math.abs(aMass - bMass) > 0.25) {
        return aMass - bMass;
      }
    }

    if (optimizeFor === "value") {
      // Best value: lowest cost first, then fewer products.
      if (a.cost > 0 && b.cost > 0 && Math.abs(a.cost - b.cost) > 0.01) {
        return a.cost - b.cost;
      }
      if (a.cost > 0 && !(b.cost > 0)) return -1;
      if (b.cost > 0 && !(a.cost > 0)) return 1;
      return a.lines.length - b.lines.length;
    }

    // Best mix: fewest products, then cost.
    if (a.lines.length !== b.lines.length) return a.lines.length - b.lines.length;
    const near =
      Math.abs(a.cost - b.cost) <= Math.max(a.cost, b.cost, 1) * COST_NEAR_PCT;
    if (near) return a.lines.length - b.lines.length;
    if (a.cost > 0 && b.cost > 0) return a.cost - b.cost;
    if (a.cost > 0) return -1;
    if (b.cost > 0) return 1;
    return 0;
  });
  return feasible[0];
}

const NUTRIENT_DISPLAY: Record<FertilizerNutrient, string> = {
  n: "N",
  p2o5: "P₂O₅",
  k2o: "K₂O",
  mgo: "MgO",
  cao: "CaO",
  s: "S",
  zn: "Zn",
  b: "B",
  fe: "Fe",
  mn: "Mn",
  cu: "Cu",
  mo: "Mo",
};

function unmetLabelsFrom(unmet: FormulationGrade): string[] {
  return FORMULATION_NUTRIENTS.filter((n) => (unmet[n] || 0) > 0.05).map(
    (n) => NUTRIENT_DISPLAY[n]
  );
}

function gradesClose(a: FormulationGrade, b: FormulationGrade, tol = 0.6) {
  for (const nutrient of FORMULATION_NUTRIENTS) {
    if (Math.abs((a[nutrient] || 0) - (b[nutrient] || 0)) > tol) return false;
  }
  return true;
}

function runAttempts(
  targetsKg: FormulationGrade,
  catalog: CommercialFertilizer[],
  effectivePrices: Record<string, number>,
  bagKg: number,
  prices: Record<string, number>,
  requireExact: boolean,
  optimizeFor: FormulationOptimizeFor = "mix"
) {
  const biases: Array<"value" | "compound" | "single"> =
    optimizeFor === "value"
      ? ["value", "compound"]
      : ["value", "compound", "single"];

  return biases
    .map((bias) =>
      allocateRecipe(targetsKg, catalog, effectivePrices, bagKg, {
        bias,
        requireExact,
      })
    )
    .map((result) =>
      result
        ? {
            ...result,
            cost: recipeCost(result.lines, prices, bagKg),
          }
        : null
    );
}

type CostedRecipe = {
  lines: RawLine[];
  unmet: FormulationGrade;
  cost: number;
};

function recipeSignature(lines: RawLine[]) {
  return lines
    .map((line) => `${line.product.key}:${line.kg.toFixed(2)}`)
    .sort()
    .join("|");
}

/**
 * Build a recipe from single-nutrient products only (one source per oxide).
 * Always meets target nutrient kg when each required nutrient has a mono source;
 * the blend may still exceed the bag mass for high grades.
 */
function buildSingleNutrientCoveringRecipe(
  targetsKg: FormulationGrade,
  catalog: CommercialFertilizer[]
): { lines: RawLine[]; unmet: FormulationGrade } | null {
  const lines: RawLine[] = [];
  const remaining = cloneTargets(targetsKg);

  for (const nutrient of FORMULATION_NUTRIENTS) {
    const need = remaining[nutrient] || 0;
    if (need <= 0.05) continue;

    const monos = catalog
      .filter((product) => {
        const covered = nutrientsCovered(product);
        return covered.length === 1 && covered[0] === nutrient;
      })
      .sort(
        (a, b) => (b.grade[nutrient] || 0) - (a.grade[nutrient] || 0)
      );

    if (monos.length === 0) return null;

    const product = monos[0];
    const pct = product.grade[nutrient] || 0;
    if (!(pct > 0)) return null;
    const mass = round2(need / (pct / 100));
    if (!(mass > 0.05)) return null;

    const existing = lines.find((line) => line.product.key === product.key);
    if (existing) existing.kg = round2(existing.kg + mass);
    else lines.push({ product, kg: mass });
    delete remaining[nutrient];
  }

  if (lines.length === 0) return null;
  if (targetSum(remaining) > 0.5) return null;
  if (!nutrientsMatchTargets(nutrientsFromLines(lines), targetsKg)) {
    return null;
  }
  return { lines, unmet: {} };
}

/** Collect distinct exact recipes by varying bias and forced first product. */
function collectExactRecipes(
  targetsKg: FormulationGrade,
  catalog: CommercialFertilizer[],
  effectivePrices: Record<string, number>,
  bagKg: number,
  prices: Record<string, number>
): CostedRecipe[] {
  const biases: Array<"value" | "compound" | "single"> = [
    "value",
    "compound",
    "single",
  ];
  const seen = new Set<string>();
  const recipes: CostedRecipe[] = [];

  const tryAdd = (
    result: { lines: RawLine[]; unmet: FormulationGrade } | null
  ) => {
    if (!result || result.lines.length === 0) return;
    if (targetSum(result.unmet) > 0.5) return;
    if (!nutrientsMatchTargets(nutrientsFromLines(result.lines), targetsKg)) {
      return;
    }
    const sig = recipeSignature(result.lines);
    if (seen.has(sig)) return;
    seen.add(sig);
    recipes.push({
      lines: result.lines,
      unmet: result.unmet,
      cost: recipeCost(result.lines, prices, bagKg),
    });
  };

  // Guaranteed mono-nutrient cover when single-oxide sources exist.
  tryAdd(buildSingleNutrientCoveringRecipe(targetsKg, catalog));

  for (const bias of biases) {
    tryAdd(
      allocateRecipe(targetsKg, catalog, effectivePrices, bagKg, {
        bias,
        requireExact: true,
      })
    );
  }

  for (const product of catalog) {
    if (!nutrientsCovered(product).some((n) => (targetsKg[n] || 0) > 0)) {
      continue;
    }
    for (const bias of biases) {
      tryAdd(
        allocateRecipe(targetsKg, catalog, effectivePrices, bagKg, {
          bias,
          forceOrder: [product.key],
          requireExact: true,
        })
      );
    }
  }

  return recipes;
}

function pickRandomExactRecipe(
  targetsKg: FormulationGrade,
  catalog: CommercialFertilizer[],
  effectivePrices: Record<string, number>,
  bagKg: number,
  prices: Record<string, number>,
  randomUnit: number,
  batchMassKg?: number
): CostedRecipe | null {
  const recipes = collectExactRecipes(
    targetsKg,
    catalog,
    effectivePrices,
    bagKg,
    prices
  );
  const pool =
    batchMassKg != null
      ? recipes.filter((recipe) => recipeFitsBatch(recipe.lines, batchMassKg))
      : recipes;
  if (pool.length === 0) return null;
  const unit =
    Number.isFinite(randomUnit) && randomUnit >= 0 && randomUnit < 1
      ? randomUnit
      : Math.random();
  return pool[Math.floor(unit * pool.length)] || pool[0];
}

function filterCatalog(
  sourceCatalog: CommercialFertilizer[],
  allowed: string[] | null,
  targetsKg: FormulationGrade,
  _targetGrade: FormulationGrade
) {
  // Keep finished-grade matches (e.g. NPK 10-30-10 for a 10-30-10 target):
  // Best mix prefers the fewest products that hit the exact formula.
  return sourceCatalog
    .filter((product) => {
      if (allowed && allowed.length > 0) return allowed.includes(product.key);
      return true;
    })
    .filter((product) =>
      nutrientsCovered(product).some((n) => (targetsKg[n] || 0) > 0)
    );
}

function recipeProductMass(lines: RawLine[]) {
  return round2(lines.reduce((sum, line) => sum + line.kg, 0));
}

/** Allow ~1.2% overflow so 1-decimal grades still count as bag-fitting. */
function recipeFitsBatch(lines: RawLine[], batchMassKg: number) {
  return recipeProductMass(lines) <= batchMassKg * 1.012 + 0.05;
}

/** Among bag-fitting exact recipes, prefer fewest products, then cost. */
function compareExactMixRecipes(a: CostedRecipe, b: CostedRecipe) {
  if (a.lines.length !== b.lines.length) return a.lines.length - b.lines.length;
  const near =
    Math.abs(a.cost - b.cost) <= Math.max(a.cost, b.cost, 1) * COST_NEAR_PCT;
  if (near) return a.lines.length - b.lines.length;
  if (a.cost > 0 && b.cost > 0) return a.cost - b.cost;
  if (a.cost > 0) return -1;
  if (b.cost > 0) return 1;
  return 0;
}

/**
 * Rank exact nutrient recipes for the bag.
 * Fitting recipes first (fewest products). If none fit, lowest product mass
 * first — that mix scales down the least and is the closest achievable grade
 * that still supplies the target nutrient quantities before bag trim.
 */
function rankExactMixRecipes(
  recipes: CostedRecipe[],
  batchMassKg: number
): CostedRecipe[] {
  if (recipes.length === 0) return [];
  const fitting = recipes.filter((recipe) =>
    recipeFitsBatch(recipe.lines, batchMassKg)
  );
  if (fitting.length > 0) {
    return [...fitting].sort(compareExactMixRecipes);
  }
  return [...recipes].sort((a, b) => {
    const massDelta =
      recipeProductMass(a.lines) - recipeProductMass(b.lines);
    if (Math.abs(massDelta) > 0.25) return massDelta;
    return compareExactMixRecipes(a, b);
  });
}

/** Exact target grade in the finished bag (product mass ≤ batch). */
function pickBestExactMix(
  recipes: CostedRecipe[],
  batchMassKg: number
): CostedRecipe | null {
  const fitting = recipes.filter((recipe) =>
    recipeFitsBatch(recipe.lines, batchMassKg)
  );
  if (fitting.length === 0) return null;
  return [...fitting].sort(compareExactMixRecipes)[0] || null;
}

/**
 * When the exact grade cannot fit in the bag, pick the nutrient-exact recipe
 * with the lowest product mass so bag scale-down minimizes shortfall.
 */
function pickClosestCoveringMix(
  recipes: CostedRecipe[],
  batchMassKg: number
): CostedRecipe | null {
  return rankExactMixRecipes(recipes, batchMassKg)[0] || null;
}

function scaleRawLines(lines: RawLine[], factor: number): RawLine[] {
  return lines.map((line) => ({
    product: line.product,
    kg: round2(line.kg * factor),
  }));
}

function recipeCost(
  lines: RawLine[],
  prices: Record<string, number>,
  bagKg: number
) {
  if (!(bagKg > 0)) return 0;
  return round2(
    lines.reduce((sum, line) => {
      const price = prices[line.product.key] || 0;
      if (!(price > 0)) return sum;
      return sum + (line.kg / bagKg) * price;
    }, 0)
  );
}

function nutrientsFromLines(lines: RawLine[]): FormulationGrade {
  const delivered: FormulationGrade = {};
  for (const line of lines) {
    for (const nutrient of FORMULATION_NUTRIENTS) {
      const pct = line.product.grade[nutrient] || 0;
      if (pct <= 0) continue;
      delivered[nutrient] = round2(
        (delivered[nutrient] || 0) + line.kg * (pct / 100)
      );
    }
  }
  return delivered;
}

function gradeFromNutrients(
  nutrients: FormulationGrade,
  massKg: number
): FormulationGrade {
  if (!(massKg > 0)) return {};
  const grade: FormulationGrade = {};
  for (const nutrient of FORMULATION_NUTRIENTS) {
    const kg = nutrients[nutrient] || 0;
    if (kg > 0) grade[nutrient] = round1((kg / massKg) * 100);
  }
  return grade;
}

function finalizeFormulationResult(args: {
  best: CostedRecipe;
  exactMatch: boolean;
  autoCanSolve: boolean;
  input: BuildFormulationInput;
  targetGrade: FormulationGrade;
  batchMassKg: number;
  bagKg: number;
  prices: Record<string, number>;
  empty: FormulationResult;
}): FormulationResult {
  const {
    best,
    autoCanSolve,
    input,
    targetGrade,
    batchMassKg,
    bagKg,
    prices,
    empty,
  } = args;
  let exactMatch = args.exactMatch;
  let workingLines = best.lines;
  let nutrientsDelivered = nutrientsFromLines(workingLines);
  let productMassKg = round2(
    workingLines.reduce((sum, line) => sum + line.kg, 0)
  );

  if (!(productMassKg > 0)) {
    return { ...empty, autoCanSolve };
  }

  const finishMode = input.finishMode;
  const fillers =
    finishMode === "filler" ? resolveSelectedFillers(input) : [];

  // Over-mass: scale down proportionally so the bag still fits.
  // Tiny overflow (rounding) keeps exactMatch when the trimmed grade still
  // matches the target; larger overflow is the "closest covering" path.
  if (productMassKg > batchMassKg + 0.05) {
    const overflowPct =
      (productMassKg - batchMassKg) / Math.max(batchMassKg, 1);
    const factor = batchMassKg / productMassKg;
    workingLines = scaleRawLines(workingLines, factor);
    nutrientsDelivered = nutrientsFromLines(workingLines);
    productMassKg = round2(
      workingLines.reduce((sum, line) => sum + line.kg, 0)
    );
    const scaledGrade = gradeFromNutrients(nutrientsDelivered, batchMassKg);
    if (exactMatch && overflowPct <= 0.012 && gradesClose(scaledGrade, targetGrade)) {
      exactMatch = true;
    } else {
      exactMatch = false;
    }
  }

  if (finishMode === "filler") {
    const fillerMassKg = Math.max(0, round2(batchMassKg - productMassKg));
    const lines: FormulationLine[] = workingLines.map((line) => ({
      productKey: line.product.key,
      label: line.product.label,
      analysis: line.product.analysis,
      kg: line.kg,
      isFiller: false,
    }));

    if (fillerMassKg > 0.05 && fillers.length > 0) {
      const share = round2(fillerMassKg / fillers.length);
      let assigned = 0;
      fillers.forEach((filler, index) => {
        const kg =
          index === fillers.length - 1
            ? round2(fillerMassKg - assigned)
            : share;
        assigned = round2(assigned + kg);
        if (kg > 0.005) {
          lines.push({
            productKey: filler.key,
            label: filler.label,
            analysis: filler.description,
            kg,
            isFiller: true,
          });
        }
      });
    }

    const finalMass = round2(productMassKg + fillerMassKg);
    const outputGrade = gradeFromNutrients(nutrientsDelivered, finalMass);
    if (!gradesClose(outputGrade, targetGrade)) exactMatch = false;

    const unmet = exactMatch ? {} : cloneTargets(best.unmet);
    if (!exactMatch) {
      for (const nutrient of FORMULATION_NUTRIENTS) {
        const want = targetGrade[nutrient] || 0;
        const have = outputGrade[nutrient] || 0;
        if (want > have + 0.3) {
          unmet[nutrient] = round2(((want - have) / 100) * batchMassKg);
        } else {
          delete unmet[nutrient];
        }
      }
    }

    return {
      feasible: true,
      exactMatch,
      autoCanSolve,
      lines,
      nutrientsDelivered,
      productMassKg,
      fillerMassKg,
      batchMassKg: finalMass,
      targetGrade,
      outputGrade: exactMatch ? targetGrade : outputGrade,
      gradeLabel: gradeLabelFrom(exactMatch ? targetGrade : outputGrade),
      scaleFactor: 1,
      unmet,
      unmetLabels: unmetLabelsFrom(unmet),
      estimatedCost: best.cost > 0 ? best.cost : null,
      fillers,
    };
  }

  const adjustedGrade = gradeFromNutrients(nutrientsDelivered, productMassKg);
  const scaleFactor = round2(batchMassKg / productMassKg);
  const scaledLines: FormulationLine[] = workingLines.map((line) => ({
    productKey: line.product.key,
    label: line.product.label,
    analysis: line.product.analysis,
    kg: round2(line.kg * scaleFactor),
    isFiller: false,
  }));
  const scaledMass = round2(
    scaledLines.reduce((sum, line) => sum + line.kg, 0)
  );
  const scaledNutrients = nutrientsFromLines(
    workingLines.map((line) => ({
      product: line.product,
      kg: line.kg * scaleFactor,
    }))
  );
  const costBase = recipeCost(workingLines, prices, bagKg);
  const estimatedCost =
    costBase > 0 ? round2(costBase * scaleFactor) : null;
  const unmet = exactMatch ? {} : cloneTargets(best.unmet);

  return {
    feasible: true,
    exactMatch,
    autoCanSolve,
    lines: scaledLines,
    nutrientsDelivered: scaledNutrients,
    productMassKg,
    fillerMassKg: 0,
    batchMassKg: scaledMass,
    targetGrade,
    outputGrade: adjustedGrade,
    gradeLabel: gradeLabelFrom(adjustedGrade),
    scaleFactor,
    unmet,
    unmetLabels: unmetLabelsFrom(unmet),
    estimatedCost,
    fillers: [],
  };
}

/**
 * Build a bag formulation for a target grade and batch size.
 * Best mix searches exact recipes and prefers the fewest products that truly
 * hit the grade inside the bag. When the exact grade cannot fit, returns the
 * closest covering blend (lowest product mass that still supplies the target
 * nutrient quantities, then scaled into the bag) with exactMatch: false so the
 * UI can ask before accepting an adjusted formula.
 */
export function buildFormulation(
  input: BuildFormulationInput
): FormulationResult {
  const targetGrade = cleanGrade(input.targetGrade);
  const batchMassKg = toKg(input.batchSize, input.unit);
  const bagKg =
    input.bagKg && input.bagKg > 0 ? input.bagKg : DEFAULT_FERTILIZER_BAG_KG;
  const prices = input.prices || {};
  const empty: FormulationResult = {
    feasible: false,
    exactMatch: false,
    autoCanSolve: false,
    lines: [],
    nutrientsDelivered: {},
    productMassKg: 0,
    fillerMassKg: 0,
    batchMassKg: batchMassKg,
    targetGrade,
    outputGrade: targetGrade,
    gradeLabel: gradeLabelFrom(targetGrade),
    scaleFactor: 1,
    unmet: targetGrade,
    unmetLabels: unmetLabelsFrom(targetGrade),
    estimatedCost: null,
    fillers: [],
  };

  if (!(batchMassKg > 0) || targetSum(targetGrade) <= 0) return empty;

  const targetsKg: FormulationGrade = {};
  for (const nutrient of FORMULATION_NUTRIENTS) {
    const pct = targetGrade[nutrient];
    if (pct != null && pct > 0) {
      targetsKg[nutrient] = round2((pct / 100) * batchMassKg);
    }
  }

  const allowed = input.allowedProductKeys?.filter(Boolean) || null;
  const sourceCatalog = input.catalog?.length
    ? input.catalog
    : listAllFertilizers();
  const catalog = filterCatalog(
    sourceCatalog,
    allowed,
    targetsKg,
    targetGrade
  );

  const effectivePrices: Record<string, number> = { ...prices };
  for (const product of catalog) {
    if (!(effectivePrices[product.key] > 0)) effectivePrices[product.key] = 1;
  }

  const optimizeFor: FormulationOptimizeFor =
    input.optimizeFor === "value"
      ? "value"
      : input.optimizeFor === "random"
        ? "random"
        : "mix";

  // Can Best mix (full catalog) hit the exact target inside the bag?
  const fullCatalog = filterCatalog(sourceCatalog, null, targetsKg, targetGrade);
  const fullPrices: Record<string, number> = { ...effectivePrices };
  for (const product of fullCatalog) {
    if (!(fullPrices[product.key] > 0)) fullPrices[product.key] = 1;
  }
  const fullExactRecipes = collectExactRecipes(
    targetsKg,
    fullCatalog,
    fullPrices,
    bagKg,
    prices
  );
  const autoCanSolve = Boolean(
    pickBestExactMix(fullExactRecipes, batchMassKg)
  );

  let best: CostedRecipe | null = null;
  let exactMatch = false;

  if (optimizeFor === "random") {
    best = pickRandomExactRecipe(
      targetsKg,
      fullCatalog,
      fullPrices,
      bagKg,
      prices,
      input.randomUnit ?? Math.random(),
      batchMassKg
    );
    exactMatch = Boolean(best);
    if (!best) {
      // Prefer a nutrient-covering mix (scaled into the bag) over a partial one.
      best = pickClosestCoveringMix(fullExactRecipes, batchMassKg);
      if (!best) {
        best = pickBestRecipe(
          runAttempts(
            targetsKg,
            fullCatalog,
            fullPrices,
            bagKg,
            prices,
            false,
            "mix"
          ),
          "mix",
          batchMassKg
        );
      }
    }
  } else if (optimizeFor === "mix") {
    const exactRecipes = collectExactRecipes(
      targetsKg,
      catalog,
      effectivePrices,
      bagKg,
      prices
    );
    best = pickBestExactMix(exactRecipes, batchMassKg);
    exactMatch = Boolean(best);
    if (!best) {
      // Closest = nutrient-exact recipe with lowest mass, then scale to bag.
      // Never prefer a dilute single compound (e.g. 133 kg of 15-15-15 for
      // a 20-20-20 target) over a denser multi-product cover.
      best = pickClosestCoveringMix(exactRecipes, batchMassKg);
      if (!best) {
        best = pickBestRecipe(
          runAttempts(
            targetsKg,
            catalog,
            effectivePrices,
            bagKg,
            prices,
            false,
            "mix"
          ),
          "mix",
          batchMassKg
        );
      }
    }
  } else {
    const exactValueRecipes = collectExactRecipes(
      targetsKg,
      catalog,
      effectivePrices,
      bagKg,
      prices
    );
    best = pickBestRecipe(
      exactValueRecipes.map((recipe) =>
        recipeFitsBatch(recipe.lines, batchMassKg) ? recipe : null
      ),
      optimizeFor,
      batchMassKg
    );
    exactMatch = Boolean(best);

    if (!best) {
      best = pickClosestCoveringMix(exactValueRecipes, batchMassKg);
      if (!best) {
        best = pickBestRecipe(
          runAttempts(
            targetsKg,
            catalog,
            effectivePrices,
            bagKg,
            prices,
            false,
            optimizeFor
          ),
          optimizeFor,
          batchMassKg
        );
      }
    }
  }

  if (!best) {
    return { ...empty, autoCanSolve };
  }

  return finalizeFormulationResult({
    best,
    exactMatch,
    autoCanSolve,
    input,
    targetGrade,
    batchMassKg,
    bagKg,
    prices,
    empty,
  });
}

function recipeProductKeySet(recipe: CostedRecipe) {
  return recipe.lines
    .map((line) => line.product.key)
    .sort()
    .join("+");
}

/** True when every line is a single-oxide fertilizer. */
function isMonoNutrientRecipe(recipe: CostedRecipe) {
  return (
    recipe.lines.length > 0 &&
    recipe.lines.every(
      (line) => nutrientsCovered(line.product).length === 1
    )
  );
}

/**
 * Distinct covering recipes for the closest-mix carousel: lowest product mass
 * first (closest grade after bag scale), one entry per product set.
 */
function rankClosestCoveringRecipes(recipes: CostedRecipe[]): CostedRecipe[] {
  const sorted = [...recipes].sort((a, b) => {
    const massDelta =
      recipeProductMass(a.lines) - recipeProductMass(b.lines);
    if (Math.abs(massDelta) > 0.25) return massDelta;
    return compareExactMixRecipes(a, b);
  });
  const seen = new Set<string>();
  const unique: CostedRecipe[] = [];
  for (const recipe of sorted) {
    const key = recipeProductKeySet(recipe);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(recipe);
  }
  return unique;
}

/**
 * Keep the strongest closest mixes, and always reserve a slot for the
 * single-nutrient blend when it exists (even if it ranks outside the top N).
 */
function selectClosestScenarioRecipes(
  recipes: CostedRecipe[],
  limit: number
): CostedRecipe[] {
  const ranked = rankClosestCoveringRecipes(recipes);
  if (ranked.length <= limit) return ranked;

  const mono = ranked.find(isMonoNutrientRecipe);
  const top = ranked.slice(0, limit);
  if (!mono) return top;
  if (top.some((recipe) => recipeProductKeySet(recipe) === recipeProductKeySet(mono))) {
    return top;
  }
  return [...top.slice(0, limit - 1), mono];
}

/**
 * Top Best mix scenarios for the carousel UI.
 * Prefers exact bag-fitting recipes (fewest products). When the target cannot
 * fit the bag, returns the closest covering alternatives (including mono-nutrient
 * mixes), ranked by how little they must be scaled down.
 */
export function listBestMixScenarios(
  input: BuildFormulationInput,
  limit = 3
): FormulationResult[] {
  const targetGrade = cleanGrade(input.targetGrade);
  const batchMassKg = toKg(input.batchSize, input.unit);
  const bagKg =
    input.bagKg && input.bagKg > 0 ? input.bagKg : DEFAULT_FERTILIZER_BAG_KG;
  const prices = input.prices || {};
  const empty: FormulationResult = {
    feasible: false,
    exactMatch: false,
    autoCanSolve: false,
    lines: [],
    nutrientsDelivered: {},
    productMassKg: 0,
    fillerMassKg: 0,
    batchMassKg,
    targetGrade,
    outputGrade: targetGrade,
    gradeLabel: gradeLabelFrom(targetGrade),
    scaleFactor: 1,
    unmet: targetGrade,
    unmetLabels: unmetLabelsFrom(targetGrade),
    estimatedCost: null,
    fillers: [],
  };

  if (!(batchMassKg > 0) || targetSum(targetGrade) <= 0 || limit <= 0) {
    return [];
  }

  const targetsKg: FormulationGrade = {};
  for (const nutrient of FORMULATION_NUTRIENTS) {
    const pct = targetGrade[nutrient];
    if (pct != null && pct > 0) {
      targetsKg[nutrient] = round2((pct / 100) * batchMassKg);
    }
  }

  const sourceCatalog = input.catalog?.length
    ? input.catalog
    : listAllFertilizers();
  const catalog = filterCatalog(sourceCatalog, null, targetsKg, targetGrade);
  const effectivePrices: Record<string, number> = { ...prices };
  for (const product of catalog) {
    if (!(effectivePrices[product.key] > 0)) effectivePrices[product.key] = 1;
  }

  const exactRecipes = collectExactRecipes(
    targetsKg,
    catalog,
    effectivePrices,
    bagKg,
    prices
  );
  const fitting = exactRecipes.filter((recipe) =>
    recipeFitsBatch(recipe.lines, batchMassKg)
  );
  const usingClosest = fitting.length === 0;
  const ranked = usingClosest
    ? selectClosestScenarioRecipes(exactRecipes, Math.max(limit, 4))
    : [...fitting].sort(compareExactMixRecipes);

  const autoCanSolve = fitting.length > 0;
  const seenGrades = new Set<string>();
  const results: FormulationResult[] = [];

  for (const best of ranked) {
    if (results.length >= limit) break;
    const result = finalizeFormulationResult({
      best,
      exactMatch: !usingClosest,
      autoCanSolve,
      input: { ...input, optimizeFor: "mix" },
      targetGrade,
      batchMassKg,
      bagKg,
      prices,
      empty,
    });
    if (!result.feasible) continue;
    if (!usingClosest && !result.exactMatch) continue;
    // Drop scaled duplicates that print as the same closest grade.
    if (usingClosest) {
      if (seenGrades.has(result.gradeLabel)) continue;
      seenGrades.add(result.gradeLabel);
    }
    results.push(result);
  }

  return results;
}

export function listFormulationProducts() {
  return listAllFertilizers();
}

export function listFillers() {
  return INERT_FILLERS;
}

export { FORMULATION_NUTRIENTS };
