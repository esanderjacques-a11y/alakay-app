import {
  COMMERCIAL_FERTILIZERS,
  DEFAULT_FERTILIZER_BAG_KG,
  type CommercialFertilizer,
  type FertilizerNutrient,
} from "@/lib/fertilizerCatalog";
import {
  IRRIGATION_SYSTEM_OPTIONS,
  irrigationEfficiencyDefaults,
  type IrrigationEfficiencyTable,
  type IrrigationSystem,
} from "@/lib/soilFertilityTables";
import type { DoseNutrientKey } from "@/lib/soilFertilityPlan";

/** Nutrients the cost optimizer covers (Ca is liming-only). */
export type OptimizeNutrient = "n" | "p2o5" | "k2o" | "mgo";

export type NutrientTargets = Partial<Record<OptimizeNutrient, number>>;

export type ProductPriceMap = Record<string, number>;

export type BlendLine = {
  productKey: string;
  label: string;
  analysis: string;
  kgHa: number;
  bagsHa: number;
  pricePerBag: number;
  costHa: number;
  /** Nutrients supplied by this line (kg oxide / ha). */
  supplied: Partial<Record<OptimizeNutrient | "s" | "cao", number>>;
};

export type NutrientCredit = {
  fromProductKey: string;
  fromLabel: string;
  nutrient: OptimizeNutrient;
  kgHa: number;
};

export type BlendPlan = {
  lines: BlendLine[];
  costHa: number;
  productCount: number;
  credits: NutrientCredit[];
  /** Remaining unmet demand after allocation (should be ~0 when feasible). */
  unmet: NutrientTargets;
  surplus: Partial<Record<OptimizeNutrient | "s" | "cao", number>>;
  /** Dose key → primary product used to cover that nutrient (for UI apply). */
  primaryByDose: Partial<Record<DoseNutrientKey, string>>;
};

export type ScenarioKind =
  | "recommended"
  | "fewest_products"
  | "compound_first"
  | "singles_only"
  | "current_selection"
  | "irrigation";

export type CostScenario = {
  id: string;
  kind: ScenarioKind;
  labelKey: string;
  /** Extra label params, e.g. irrigation system id. */
  irrigationSystem?: IrrigationSystem;
  isCurrentIrrigation?: boolean;
  recommended: boolean;
  feasible: boolean;
  plan: BlendPlan | null;
  /** Oxide targets used for this scenario. */
  targets: NutrientTargets;
};

const OPTIMIZE_NUTRIENTS: OptimizeNutrient[] = ["n", "p2o5", "k2o", "mgo"];

const DOSE_BY_NUTRIENT: Record<OptimizeNutrient, DoseNutrientKey> = {
  n: "n",
  p2o5: "p",
  k2o: "k",
  mgo: "mg",
};

const NUTRIENT_BY_DOSE: Partial<Record<DoseNutrientKey, OptimizeNutrient>> = {
  n: "n",
  p: "p2o5",
  k: "k2o",
  mg: "mgo",
};

const SINGLES_PREFERRED: Partial<Record<OptimizeNutrient, string[]>> = {
  n: ["urea", "ammonium_nitrate", "ammonium_sulfate", "calcium_nitrate"],
  p2o5: ["tsp", "dap", "map"],
  k2o: ["mop", "sop"],
  mgo: ["kieserite", "magnesium_sulfate"],
};

const COMPOUND_PREFERRED = ["npk_15_15_15", "npk_10_30_10", "dap", "map"];

const COST_NEAR_PCT = 0.05;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function cloneTargets(targets: NutrientTargets): NutrientTargets {
  const next: NutrientTargets = {};
  for (const key of OPTIMIZE_NUTRIENTS) {
    const value = targets[key];
    if (value != null && value > 0) next[key] = value;
  }
  return next;
}

function targetSum(targets: NutrientTargets) {
  return OPTIMIZE_NUTRIENTS.reduce((sum, key) => sum + (targets[key] || 0), 0);
}

function nutrientsCovered(product: CommercialFertilizer): OptimizeNutrient[] {
  return OPTIMIZE_NUTRIENTS.filter((n) => (product.grade[n] || 0) > 0);
}

function pricedCatalog(prices: ProductPriceMap): CommercialFertilizer[] {
  return COMMERCIAL_FERTILIZERS.filter((p) => (prices[p.key] || 0) > 0);
}

/**
 * How many kg of product are needed to meet the binding remaining nutrient.
 * Returns 0 if the product cannot help any remaining target.
 */
function massToCloseBinding(
  product: CommercialFertilizer,
  remaining: NutrientTargets
): number {
  let massNeeded = 0;
  let helps = false;
  for (const nutrient of OPTIMIZE_NUTRIENTS) {
    const need = remaining[nutrient] || 0;
    const pct = product.grade[nutrient] || 0;
    if (need <= 0 || pct <= 0) continue;
    helps = true;
    const kg = need / (pct / 100);
    massNeeded = massNeeded === 0 ? kg : Math.min(massNeeded, kg);
  }
  return helps ? massNeeded : 0;
}

function bindingNutrient(
  product: CommercialFertilizer,
  remaining: NutrientTargets
): OptimizeNutrient | null {
  let best: OptimizeNutrient | null = null;
  let bestMass = Infinity;
  for (const nutrient of OPTIMIZE_NUTRIENTS) {
    const need = remaining[nutrient] || 0;
    const pct = product.grade[nutrient] || 0;
    if (need <= 0 || pct <= 0) continue;
    const kg = need / (pct / 100);
    if (kg < bestMass) {
      bestMass = kg;
      best = nutrient;
    }
  }
  return best;
}

function applyProduct(
  product: CommercialFertilizer,
  kgHa: number,
  remaining: NutrientTargets,
  surplus: Partial<Record<OptimizeNutrient | "s" | "cao", number>>,
  credits: NutrientCredit[],
  primaryByDose: Partial<Record<DoseNutrientKey, string>>,
  pricePerBag: number,
  bagKg: number
): BlendLine {
  const binding = bindingNutrient(product, remaining);
  const supplied: BlendLine["supplied"] = {};
  for (const nutrient of [
    ...OPTIMIZE_NUTRIENTS,
    "s" as const,
    "cao" as const,
  ]) {
    const pct = product.grade[nutrient as FertilizerNutrient] || 0;
    if (pct <= 0) continue;
    const amount = kgHa * (pct / 100);
    supplied[nutrient] = round2(amount);

    if (OPTIMIZE_NUTRIENTS.includes(nutrient as OptimizeNutrient)) {
      const key = nutrient as OptimizeNutrient;
      const need = remaining[key] || 0;
      if (need > 0) {
        const used = Math.min(need, amount);
        remaining[key] = round2(need - used);
        if (remaining[key]! <= 0.005) delete remaining[key];
        const doseKey = DOSE_BY_NUTRIENT[key];
        if (!primaryByDose[doseKey]) primaryByDose[doseKey] = product.key;
        if (binding && key !== binding && used > 0.5) {
          credits.push({
            fromProductKey: product.key,
            fromLabel: product.label,
            nutrient: key,
            kgHa: round2(used),
          });
        }
      }
      const leftover = amount - need;
      if (leftover > 0.05) {
        surplus[key] = round2((surplus[key] || 0) + leftover);
      }
    } else {
      surplus[nutrient] = round2((surplus[nutrient] || 0) + amount);
    }
  }

  const bagsHa = bagKg > 0 ? kgHa / bagKg : 0;
  return {
    productKey: product.key,
    label: product.label,
    analysis: product.analysis,
    kgHa: round2(kgHa),
    bagsHa: round2(bagsHa),
    pricePerBag,
    costHa: round2(bagsHa * pricePerBag),
    supplied,
  };
}

function scoreProduct(
  product: CommercialFertilizer,
  remaining: NutrientTargets,
  prices: ProductPriceMap,
  bagKg: number,
  bias: "value" | "compound" | "single"
): number {
  const covered = nutrientsCovered(product).filter((n) => (remaining[n] || 0) > 0);
  if (covered.length === 0) return -Infinity;

  const mass = massToCloseBinding(product, remaining);
  if (mass <= 0) return -Infinity;

  const price = prices[product.key] || 0;
  const cost = (mass / bagKg) * price;
  if (!(cost > 0)) return -Infinity;

  // Useful nutrient kg delivered per currency unit
  let usefulKg = 0;
  for (const n of covered) {
    usefulKg += Math.min(
      remaining[n] || 0,
      mass * ((product.grade[n] || 0) / 100)
    );
  }
  let score = usefulKg / cost;

  if (bias === "compound") {
    score *= 1 + covered.length * 0.35;
    if (COMPOUND_PREFERRED.includes(product.key)) score *= 1.25;
  } else if (bias === "single") {
    score *= covered.length === 1 ? 1.4 : 0.55;
  } else {
    // value: reward multi-nutrient efficiency lightly
    score *= 1 + (covered.length - 1) * 0.2;
  }

  return score;
}

function allocateBlend(
  targets: NutrientTargets,
  prices: ProductPriceMap,
  bagKg: number,
  options: {
    bias: "value" | "compound" | "single";
    allowedKeys?: string[];
    forceOrder?: string[];
  }
): BlendPlan | null {
  const remaining = cloneTargets(targets);
  if (targetSum(remaining) <= 0) {
    return {
      lines: [],
      costHa: 0,
      productCount: 0,
      credits: [],
      unmet: {},
      surplus: {},
      primaryByDose: {},
    };
  }

  const catalog = pricedCatalog(prices).filter((p) =>
    options.allowedKeys ? options.allowedKeys.includes(p.key) : true
  );
  if (catalog.length === 0) return null;

  const byKey = new Map(catalog.map((p) => [p.key, p]));
  const lines: BlendLine[] = [];
  const credits: NutrientCredit[] = [];
  const surplus: BlendPlan["surplus"] = {};
  const primaryByDose: BlendPlan["primaryByDose"] = {};
  const maxSteps = 24;

  // Forced products first (e.g. NPK, then fillers)
  const forceQueue = [...(options.forceOrder || [])];

  for (let step = 0; step < maxSteps && targetSum(remaining) > 0.05; step++) {
    let product: CommercialFertilizer | undefined;

    while (forceQueue.length > 0 && !product) {
      const key = forceQueue.shift()!;
      const candidate = byKey.get(key);
      if (candidate && massToCloseBinding(candidate, remaining) > 0) {
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
          options.bias
        );
        if (score > bestScore) {
          bestScore = score;
          product = candidate;
        }
      }
    }

    if (!product) break;

    const mass = massToCloseBinding(product, remaining);
    if (!(mass > 0.05)) break;

    // Merge into existing line if same product already applied
    const price = prices[product.key];
    const line = applyProduct(
      product,
      mass,
      remaining,
      surplus,
      credits,
      primaryByDose,
      price,
      bagKg
    );
    const existing = lines.find((l) => l.productKey === product!.key);
    if (existing) {
      existing.kgHa = round2(existing.kgHa + line.kgHa);
      existing.bagsHa = round2(existing.bagsHa + line.bagsHa);
      existing.costHa = round2(existing.costHa + line.costHa);
      for (const [k, v] of Object.entries(line.supplied)) {
        const key = k as keyof BlendLine["supplied"];
        existing.supplied[key] = round2(
          (existing.supplied[key] || 0) + (v || 0)
        );
      }
    } else {
      lines.push(line);
    }
  }

  const unmet = cloneTargets(remaining);
  if (targetSum(unmet) > 0.5) return null;

  // Deduplicate noisy credits (same product+nutrient)
  const creditMap = new Map<string, NutrientCredit>();
  for (const credit of credits) {
    const key = `${credit.fromProductKey}:${credit.nutrient}`;
    const prev = creditMap.get(key);
    if (prev) prev.kgHa = round2(prev.kgHa + credit.kgHa);
    else creditMap.set(key, { ...credit });
  }

  // Keep credits that are meaningful secondary contributions
  const cleanedCredits = [...creditMap.values()].filter((c) => c.kgHa >= 0.5);

  const costHa = round2(lines.reduce((sum, l) => sum + l.costHa, 0));
  return {
    lines,
    costHa,
    productCount: lines.length,
    credits: cleanedCredits,
    unmet,
    surplus,
    primaryByDose,
  };
}

/**
 * Enumerate blends: try value / compound / singles strategies and pick the best.
 */
function searchBestBlend(
  targets: NutrientTargets,
  prices: ProductPriceMap,
  bagKg: number,
  mode: "recommended" | "fewest" | "compound" | "singles"
): BlendPlan | null {
  const candidates: (BlendPlan | null)[] = [];

  if (mode === "singles") {
    const allowed = new Set<string>();
    for (const nutrient of OPTIMIZE_NUTRIENTS) {
      if (!(targets[nutrient]! > 0)) continue;
      for (const key of SINGLES_PREFERRED[nutrient] || []) {
        if (prices[key] > 0) allowed.add(key);
      }
    }
    // Prefer true singles: urea, tsp, mop, kieserite when priced
    const singlesOnly = COMMERCIAL_FERTILIZERS.filter(
      (p) =>
        allowed.has(p.key) &&
        nutrientsCovered(p).filter((n) => (targets[n] || 0) > 0).length <= 1
    ).map((p) => p.key);
    const pool = singlesOnly.length > 0 ? singlesOnly : [...allowed];
    candidates.push(
      allocateBlend(targets, prices, bagKg, { bias: "single", allowedKeys: pool })
    );
    // Also try with DAP/MAP allowed as P source (but still single-bias)
    candidates.push(
      allocateBlend(targets, prices, bagKg, {
        bias: "single",
        allowedKeys: [...allowed],
      })
    );
  } else if (mode === "compound") {
    candidates.push(
      allocateBlend(targets, prices, bagKg, {
        bias: "compound",
        forceOrder: COMPOUND_PREFERRED.filter((k) => prices[k] > 0),
      })
    );
    candidates.push(
      allocateBlend(targets, prices, bagKg, { bias: "compound" })
    );
  } else if (mode === "fewest") {
    // Try forcing NPK first, then DAP, then free search; rank by product count
    candidates.push(
      allocateBlend(targets, prices, bagKg, {
        bias: "compound",
        forceOrder: ["npk_15_15_15", "npk_10_30_10", "dap", "map"].filter(
          (k) => prices[k] > 0
        ),
      })
    );
    candidates.push(
      allocateBlend(targets, prices, bagKg, { bias: "compound" })
    );
    candidates.push(
      allocateBlend(targets, prices, bagKg, { bias: "value" })
    );
  } else {
    // recommended: search several strategies
    candidates.push(allocateBlend(targets, prices, bagKg, { bias: "value" }));
    candidates.push(
      allocateBlend(targets, prices, bagKg, {
        bias: "compound",
        forceOrder: COMPOUND_PREFERRED.filter((k) => prices[k] > 0),
      })
    );
    candidates.push(allocateBlend(targets, prices, bagKg, { bias: "compound" }));
    candidates.push(allocateBlend(targets, prices, bagKg, { bias: "single" }));
  }

  const feasible = candidates.filter((c): c is BlendPlan => Boolean(c));
  if (feasible.length === 0) return null;

  if (mode === "fewest") {
    feasible.sort((a, b) => {
      if (a.productCount !== b.productCount) return a.productCount - b.productCount;
      return a.costHa - b.costHa;
    });
    return feasible[0];
  }

  feasible.sort((a, b) => {
    const near =
      Math.abs(a.costHa - b.costHa) <=
      Math.max(a.costHa, b.costHa) * COST_NEAR_PCT;
    if (near && a.productCount !== b.productCount) {
      return a.productCount - b.productCount;
    }
    return a.costHa - b.costHa;
  });
  return feasible[0];
}

/**
 * Evaluate user's current per-dose product picks with full nutrient credit.
 * Applies products in dose order N → P → K → Mg; each product credits all nutrients.
 */
export function blendFromSelection(
  targets: NutrientTargets,
  selectedProducts: Partial<Record<DoseNutrientKey, string>>,
  prices: ProductPriceMap,
  bagKg: number = DEFAULT_FERTILIZER_BAG_KG
): BlendPlan | null {
  const remaining = cloneTargets(targets);
  if (targetSum(remaining) <= 0) {
    return {
      lines: [],
      costHa: 0,
      productCount: 0,
      credits: [],
      unmet: {},
      surplus: {},
      primaryByDose: {},
    };
  }

  const order: DoseNutrientKey[] = ["n", "p", "k", "mg"];
  const uniqueKeys: string[] = [];
  for (const doseKey of order) {
    const nutrient = NUTRIENT_BY_DOSE[doseKey];
    if (!nutrient || !(targets[nutrient]! > 0)) continue;
    const productKey = selectedProducts[doseKey];
    if (!productKey || !(prices[productKey] > 0)) continue;
    if (!uniqueKeys.includes(productKey)) uniqueKeys.push(productKey);
  }

  if (uniqueKeys.length === 0) return null;

  const credits: NutrientCredit[] = [];
  const surplus: BlendPlan["surplus"] = {};
  const primaryByDose: BlendPlan["primaryByDose"] = {};
  const lines: BlendLine[] = [];

  for (const productKey of uniqueKeys) {
    const product = COMMERCIAL_FERTILIZERS.find((p) => p.key === productKey);
    if (!product) continue;
    const mass = massToCloseBinding(product, remaining);
    if (!(mass > 0.05)) continue;
    const line = applyProduct(
      product,
      mass,
      remaining,
      surplus,
      credits,
      primaryByDose,
      prices[productKey],
      bagKg
    );
    lines.push(line);
  }

  // Fill residuals with best singles if selection didn't cover everything
  if (targetSum(remaining) > 0.5) {
    const fill = allocateBlend(remaining, prices, bagKg, { bias: "single" });
    if (!fill) return null;
    for (const line of fill.lines) {
      const existing = lines.find((l) => l.productKey === line.productKey);
      if (existing) {
        existing.kgHa = round2(existing.kgHa + line.kgHa);
        existing.bagsHa = round2(existing.bagsHa + line.bagsHa);
        existing.costHa = round2(existing.costHa + line.costHa);
      } else {
        lines.push(line);
      }
    }
    for (const [k, v] of Object.entries(fill.primaryByDose)) {
      const doseKey = k as DoseNutrientKey;
      if (!primaryByDose[doseKey]) primaryByDose[doseKey] = v;
    }
    credits.push(...fill.credits);
    Object.assign(remaining, fill.unmet);
  }

  const unmet = cloneTargets(remaining);
  if (targetSum(unmet) > 0.5) return null;

  return {
    lines,
    costHa: round2(lines.reduce((s, l) => s + l.costHa, 0)),
    productCount: lines.length,
    credits,
    unmet,
    surplus,
    primaryByDose,
  };
}

/** Build oxide targets from dose results (current irrigation / efficiencies). */
export function targetsFromDoses(
  doses: Array<{
    key: DoseNutrientKey;
    notRequired?: boolean;
    viaEncalado?: boolean;
    dosisOxideKgHa?: number | null;
  }>
): NutrientTargets {
  const targets: NutrientTargets = {};
  for (const dose of doses) {
    const nutrient = NUTRIENT_BY_DOSE[dose.key];
    if (!nutrient) continue;
    if (dose.notRequired || dose.viaEncalado) continue;
    const kg = dose.dosisOxideKgHa || 0;
    if (kg > 0) targets[nutrient] = round2(kg);
  }
  return targets;
}

/**
 * Rebuild oxide targets for another irrigation system.
 * gap = currentDose × currentEfficiency; newDose = gap / newEfficiency.
 */
export function targetsForIrrigation(
  doses: Array<{
    key: DoseNutrientKey;
    notRequired?: boolean;
    viaEncalado?: boolean;
    dosisOxideKgHa?: number | null;
    eficiencia?: number;
  }>,
  system: IrrigationSystem,
  table?: IrrigationEfficiencyTable
): NutrientTargets {
  const defaults = irrigationEfficiencyDefaults(system, table);
  const effByDose: Record<string, number> = {
    n: defaults.n / 100,
    p: defaults.p / 100,
    k: defaults.k / 100,
    mg: defaults.mg / 100,
  };

  const targets: NutrientTargets = {};
  for (const dose of doses) {
    const nutrient = NUTRIENT_BY_DOSE[dose.key];
    if (!nutrient || dose.viaEncalado) continue;

    const oldEff = dose.eficiencia && dose.eficiencia > 0 ? dose.eficiencia : 0;
    const oldDose = dose.dosisOxideKgHa;

    // Recover gap; if not required / null dose, gap <= 0 when oldEff known
    let gap = 0;
    if (oldDose != null && oldDose > 0 && oldEff > 0) {
      gap = oldDose * oldEff;
    } else if (dose.notRequired) {
      gap = 0;
    } else {
      continue;
    }

    const newEff = effByDose[dose.key] || oldEff;
    if (!(newEff > 0)) continue;
    const newDose = gap / newEff;
    if (newDose > 0.05) targets[nutrient] = round2(newDose);
  }
  return targets;
}

export type OptimizeInput = {
  doses: Array<{
    key: DoseNutrientKey;
    notRequired?: boolean;
    viaEncalado?: boolean;
    dosisOxideKgHa?: number | null;
    eficiencia?: number;
  }>;
  prices: ProductPriceMap;
  bagKg?: number;
  selectedProducts?: Partial<Record<DoseNutrientKey, string>>;
  irrigationSystem?: IrrigationSystem;
  irrigationTable?: IrrigationEfficiencyTable;
};

export function buildCostScenarios(input: OptimizeInput): CostScenario[] {
  const bagKg = input.bagKg && input.bagKg > 0 ? input.bagKg : DEFAULT_FERTILIZER_BAG_KG;
  const baseTargets = targetsFromDoses(input.doses);
  const prices = input.prices;
  const scenarios: CostScenario[] = [];

  const recommendedPlan = searchBestBlend(baseTargets, prices, bagKg, "recommended");
  const fewestPlan = searchBestBlend(baseTargets, prices, bagKg, "fewest");
  const compoundPlan = searchBestBlend(baseTargets, prices, bagKg, "compound");
  const singlesPlan = searchBestBlend(baseTargets, prices, bagKg, "singles");
  const currentPlan = input.selectedProducts
    ? blendFromSelection(baseTargets, input.selectedProducts, prices, bagKg)
    : null;

  scenarios.push({
    id: "recommended",
    kind: "recommended",
    labelKey: "fertilizerScenarioBestValue",
    recommended: true,
    feasible: Boolean(recommendedPlan),
    plan: recommendedPlan,
    targets: baseTargets,
  });
  scenarios.push({
    id: "fewest_products",
    kind: "fewest_products",
    labelKey: "fertilizerScenarioFewest",
    recommended: false,
    feasible: Boolean(fewestPlan),
    plan: fewestPlan,
    targets: baseTargets,
  });
  scenarios.push({
    id: "compound_first",
    kind: "compound_first",
    labelKey: "fertilizerScenarioCompounds",
    recommended: false,
    feasible: Boolean(compoundPlan),
    plan: compoundPlan,
    targets: baseTargets,
  });
  scenarios.push({
    id: "singles_only",
    kind: "singles_only",
    labelKey: "fertilizerScenarioSingles",
    recommended: false,
    feasible: Boolean(singlesPlan),
    plan: singlesPlan,
    targets: baseTargets,
  });
  scenarios.push({
    id: "current_selection",
    kind: "current_selection",
    labelKey: "fertilizerScenarioCurrent",
    recommended: false,
    feasible: Boolean(currentPlan),
    plan: currentPlan,
    targets: baseTargets,
  });

  // Re-tag recommended: among strategy scenarios with same irrigation, prefer
  // lowest cost / fewer products when close
  const strategy = scenarios.filter((s) => s.kind !== "irrigation" && s.plan);
  if (strategy.length > 0) {
    strategy.sort((a, b) => {
      const ca = a.plan!.costHa;
      const cb = b.plan!.costHa;
      const near = Math.abs(ca - cb) <= Math.max(ca, cb) * COST_NEAR_PCT;
      if (near && a.plan!.productCount !== b.plan!.productCount) {
        return a.plan!.productCount - b.plan!.productCount;
      }
      return ca - cb;
    });
    for (const s of scenarios) s.recommended = false;
    const best = strategy[0];
    best.recommended = true;
  }

  for (const system of IRRIGATION_SYSTEM_OPTIONS) {
    const targets = targetsForIrrigation(
      input.doses,
      system,
      input.irrigationTable
    );
    const plan = searchBestBlend(targets, prices, bagKg, "recommended");
    scenarios.push({
      id: `irrigation_${system}`,
      kind: "irrigation",
      labelKey: `irrigation_${system}`,
      irrigationSystem: system,
      isCurrentIrrigation: system === input.irrigationSystem,
      recommended: false,
      feasible: Boolean(plan),
      plan,
      targets,
    });
  }

  return scenarios;
}

export function resolveProductPrices(args: {
  bagKg: number;
  currency: string;
  manualPrices: Record<string, string>;
  onlineByKey: Record<string, number | null | undefined>;
}): ProductPriceMap {
  const map: ProductPriceMap = {};
  for (const product of COMMERCIAL_FERTILIZERS) {
    const manualKey = `saco:${args.bagKg}:${args.currency}:${product.key}`;
    const manual = Number(String(args.manualPrices[manualKey] || "").replace(",", "."));
    if (manual > 0) {
      map[product.key] = manual;
      continue;
    }
    const tonne = args.onlineByKey[product.key];
    if (tonne != null && tonne > 0) {
      const bag = (tonne * args.bagKg) / 1000;
      if (bag > 0) map[product.key] = round2(bag);
    }
  }
  return map;
}

export { NUTRIENT_BY_DOSE, DOSE_BY_NUTRIENT, OPTIMIZE_NUTRIENTS };
