import {
  COMMERCIAL_FERTILIZERS,
  DEFAULT_FERTILIZER_BAG_KG,
} from "@/lib/fertilizerCatalog";
import {
  buildCostScenarios,
  resolveProductPrices,
  type BlendLine,
  type BlendPlan,
  type CostScenario,
  type ProductPriceMap,
} from "@/lib/fertilizerCostOptimize";
import type { CalculationOutput } from "@/lib/agronomicCalculators";
import type { DoseNutrientKey, FertilityDoseResult } from "@/lib/soilFertilityPlan";
import type {
  IrrigationEfficiencyTable,
  IrrigationSystem,
} from "@/lib/soilFertilityTables";
export type PdfFertilizerProduct = {
  name: string;
  analysis: string;
  nutrient: string;
  rateKgHa: number;
  bagsHa?: number;
  pricePerBag?: number | null;
  pricePerTonne?: number | null;
  currency: string;
  costPerHa?: number | null;
  source: string;
  productKey?: string;
};

const NUTRIENT_LABEL: Record<string, string> = {
  n: "N",
  p2o5: "P₂O₅",
  k2o: "K₂O",
  mgo: "MgO",
  s: "S",
  cao: "CaO",
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function primaryNutrientFromLine(line: BlendLine): string {
  const entries = Object.entries(line.supplied || {}).filter(
    ([, kg]) => typeof kg === "number" && kg > 0
  );
  if (entries.length === 0) return "";
  entries.sort((a, b) => (b[1] || 0) - (a[1] || 0));
  return NUTRIENT_LABEL[entries[0][0]] || entries[0][0];
}

export function blendPlanToFertilizerProducts(
  plan: BlendPlan,
  options: {
    currency: string;
    source?: string;
    bagKg?: number;
    pricesTonne?: ProductPriceMap;
  }
): PdfFertilizerProduct[] {
  const bagKg = options.bagKg && options.bagKg > 0 ? options.bagKg : DEFAULT_FERTILIZER_BAG_KG;
  return plan.lines.map((line) => {
    const tonne =
      options.pricesTonne?.[line.productKey] ??
      (line.pricePerBag > 0 ? (line.pricePerBag * 1000) / bagKg : null);
    return {
      name: line.label,
      analysis: line.analysis,
      nutrient: primaryNutrientFromLine(line),
      rateKgHa: round2(line.kgHa),
      bagsHa: round2(line.bagsHa),
      pricePerBag: line.pricePerBag > 0 ? round2(line.pricePerBag) : null,
      pricePerTonne: tonne != null && tonne > 0 ? round2(tonne) : null,
      currency: options.currency,
      costPerHa: line.costHa > 0 ? round2(line.costHa) : null,
      source: options.source || "benchmark",
      productKey: line.productKey,
    };
  });
}

export function fertilizerProductsToCalculationOutputs(
  products: PdfFertilizerProduct[],
  t: Record<string, string> = {}
): CalculationOutput[] {
  const money = (value: number | null | undefined, currency: string) => {
    if (value == null || !Number.isFinite(value)) return "—";
    try {
      return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency}`;
    }
  };

  return products.map((product) => {
    const priceText =
      product.pricePerBag != null
        ? money(product.pricePerBag, product.currency)
        : product.pricePerTonne != null
          ? `${money(product.pricePerTonne, product.currency)}/t`
          : "—";
    const costText = money(product.costPerHa, product.currency);
    return {
      value: product.rateKgHa,
      unit: "kg/ha",
      label: `${product.name} (${product.analysis})`,
      formula: "",
      notes: [
        `${t.fertilizerProductAmountHa || "Product / ha"}: ${product.rateKgHa.toFixed(1)} kg · ${(product.bagsHa ?? 0).toFixed(1)} ${t.fertilizerBags || "bags"}`,
        `${t.fertilizerPricePerBag || "Price / bag"}: ${priceText}`,
        `${t.fertilizerCostHa || "Cost / ha"}: ${costText}`,
        product.nutrient
          ? `${t.exportFertilizerNutrient || "Nutrient"}: ${product.nutrient}`
          : "",
      ].filter(Boolean),
    };
  });
}

export function fertilizerApplyRecommendations(
  products: PdfFertilizerProduct[],
  t: Record<string, string> = {}
): string[] {
  return products.map((product) => {
    const rate = `${product.rateKgHa.toFixed(1)} kg/ha`;
    const bags =
      product.bagsHa != null
        ? ` (${product.bagsHa.toFixed(1)} ${t.fertilizerBags || "bags"}/ha)`
        : "";
    const nutrient = product.nutrient ? ` · ${product.nutrient}` : "";
    const template =
      t.exportFertilizerApplyLine ||
      "Apply {name} ({analysis}){nutrient}: {rate}{bags}";
    return template
      .replace("{name}", product.name)
      .replace("{analysis}", product.analysis)
      .replace("{nutrient}", nutrient)
      .replace("{rate}", rate)
      .replace("{bags}", bags);
  });
}

export function pickScenarioForReport(
  scenarios: CostScenario[],
  activeId?: string | null
): CostScenario | null {
  if (scenarios.length === 0) return null;
  const active = activeId
    ? scenarios.find((s) => s.id === activeId && s.plan)
    : null;
  if (active?.plan) return active;
  const recommended = scenarios.find((s) => s.recommended && s.plan);
  if (recommended) return recommended;
  return scenarios.find((s) => s.plan) || null;
}

export function scenarioToReportPayload(
  scenario: CostScenario,
  options: {
    currency: string;
    source?: string;
    bagKg?: number;
    t?: Record<string, string>;
  }
): {
  products: PdfFertilizerProduct[];
  outputs: CalculationOutput[];
  applyLines: string[];
} {
  if (!scenario.plan) {
    return { products: [], outputs: [], applyLines: [] };
  }
  const products = blendPlanToFertilizerProducts(scenario.plan, {
    currency: options.currency,
    source: options.source,
    bagKg: options.bagKg,
  });
  return {
    products,
    outputs: fertilizerProductsToCalculationOutputs(products, options.t),
    applyLines: fertilizerApplyRecommendations(products, options.t),
  };
}

type PriceApiRow = {
  key: string;
  pricePerMetricTonne: number | null;
};

/**
 * Build recommended fertilizer products + prices from doses when the cost
 * planner was never opened. Uses online benchmarks when available.
 */
export async function buildRecommendedFertilizerReport(args: {
  doses: FertilityDoseResult[];
  country?: string | null;
  irrigationSystem?: IrrigationSystem;
  irrigationTable?: IrrigationEfficiencyTable;
  selectedProducts?: Partial<Record<DoseNutrientKey, string>>;
  bagKg?: number;
  currency?: string;
  t?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<{
  products: PdfFertilizerProduct[];
  outputs: CalculationOutput[];
  applyLines: string[];
  currency: string;
  source: string;
}> {
  const bagKg =
    args.bagKg && args.bagKg > 0 ? args.bagKg : DEFAULT_FERTILIZER_BAG_KG;
  const params = new URLSearchParams();
  if (args.country) params.set("country", args.country);
  if (args.currency) params.set("currency", args.currency);

  let currency = args.currency || "USD";
  let source = "benchmark";
  const onlineByKey: Record<string, number | null | undefined> = {};

  try {
    const response = await fetch(`/api/fertilizer-prices?${params.toString()}`, {
      signal: args.signal,
    });
    if (response.ok) {
      const data = (await response.json()) as {
        currency?: string;
        source?: string;
        products?: PriceApiRow[];
      };
      currency = data.currency || currency;
      source = data.source || source;
      for (const row of data.products || []) {
        onlineByKey[row.key] = row.pricePerMetricTonne;
      }
    }
  } catch {
    // Offline / API failure: still try with empty online map if manuals exist.
  }

  // Seed synthetic prices from catalog so a blend is always feasible offline:
  // use a neutral 1.0 currency unit/bag when no benchmark exists so products
  // still appear (price shown as null when only synthetic).
  const realPrices = resolveProductPrices({
    bagKg,
    currency,
    manualPrices: {},
    onlineByKey,
  });
  const prices: ProductPriceMap = { ...realPrices };
  const usedSynthetic = new Set<string>();
  for (const product of COMMERCIAL_FERTILIZERS) {
    if (!(prices[product.key] > 0)) {
      prices[product.key] = 1;
      usedSynthetic.add(product.key);
    }
  }

  const scenarios = buildCostScenarios({
    doses: args.doses,
    prices,
    bagKg,
    selectedProducts: args.selectedProducts,
    irrigationSystem: args.irrigationSystem,
    irrigationTable: args.irrigationTable,
  });
  const scenario = pickScenarioForReport(scenarios, "recommended");
  if (!scenario?.plan) {
    return {
      products: [],
      outputs: [],
      applyLines: [],
      currency,
      source,
    };
  }

  const products = blendPlanToFertilizerProducts(scenario.plan, {
    currency,
    source,
    bagKg,
  }).map((product) => {
    if (usedSynthetic.has(product.productKey || "")) {
      return {
        ...product,
        pricePerBag: realPrices[product.productKey || ""]
          ? product.pricePerBag
          : null,
        pricePerTonne: onlineByKey[product.productKey || ""] ?? null,
        costPerHa: realPrices[product.productKey || ""]
          ? product.costPerHa
          : null,
        source: realPrices[product.productKey || ""] ? source : "estimate",
      };
    }
    return product;
  });

  // Recompute costs only for real prices
  const pricedProducts = products.map((product) => {
    const key = product.productKey || "";
    const bagPrice = realPrices[key];
    if (!(bagPrice > 0)) return product;
    const bagsHa = product.bagsHa ?? 0;
    return {
      ...product,
      pricePerBag: round2(bagPrice),
      costPerHa: round2(bagsHa * bagPrice),
      source,
    };
  });

  return {
    products: pricedProducts,
    outputs: fertilizerProductsToCalculationOutputs(pricedProducts, args.t),
    applyLines: fertilizerApplyRecommendations(pricedProducts, args.t),
    currency,
    source,
  };
}
