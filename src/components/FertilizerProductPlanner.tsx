"use client";

import { useEffect, useMemo, useState } from "react";
import FertilizerCostScenarios from "@/components/FertilizerCostScenarios";
import MenuSelect from "@/components/ui/MenuSelect";
import {
  COMMERCIAL_FERTILIZERS,
  DEFAULT_FERTILIZER_BAG_KG,
  FERTILIZER_CURRENCIES,
  fertilizersForNutrient,
  pricePerBagFromTonne,
  type FertilizerNutrient,
} from "@/lib/fertilizerCatalog";
import {
  buildCostScenarios,
  resolveProductPrices,
} from "@/lib/fertilizerCostOptimize";
import type { CalculationOutput } from "@/lib/agronomicCalculators";
import {
  pickScenarioForReport,
  scenarioToReportPayload,
  type PdfFertilizerProduct,
} from "@/lib/fertilizerReportPayload";
import type {
  DoseNutrientKey,
  FertilityDoseResult,
} from "@/lib/soilFertilityPlan";
import type {
  IrrigationEfficiencyTable,
  IrrigationSystem,
} from "@/lib/soilFertilityTables";

type PriceRow = {
  key: string;
  pricePerMetricTonne: number | null;
  online: boolean;
  proxy: boolean;
};

type PriceResponse = {
  currency: string;
  period: string;
  updatedAt: string;
  source: string;
  sourceUrl: string;
  priceBasis: string;
  products: PriceRow[];
  error?: string;
};

type Props = {
  doses: FertilityDoseResult[];
  areaHa: number;
  country?: string | null;
  irrigationSystem?: IrrigationSystem;
  irrigationTable?: IrrigationEfficiencyTable;
  t: Record<string, string>;
  /** When true, render as page sections (no collapsible nesting under the plan). */
  showAsPage?: boolean;
  onReportData?: (payload: {
    products: PdfFertilizerProduct[];
    outputs: CalculationOutput[];
    applyLines: string[];
  }) => void;
};

const nutrientByDose: Partial<Record<DoseNutrientKey, FertilizerNutrient>> = {
  n: "n",
  p: "p2o5",
  k: "k2o",
  mg: "mgo",
};

const defaultProductByDose: Partial<Record<DoseNutrientKey, string>> = {
  n: "urea",
  p: "dap",
  k: "mop",
  mg: "kieserite",
};

const FERTILIZER_PLANNER_STORAGE_KEY = "cultosol_fertilizer_products_v2";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

export default function FertilizerProductPlanner({
  doses,
  areaHa,
  country,
  irrigationSystem,
  irrigationTable,
  t,
  showAsPage = false,
  onReportData,
}: Props) {
  const [currency, setCurrency] = useState("");
  const [prices, setPrices] = useState<PriceResponse | null>(null);
  const [priceError, setPriceError] = useState("");
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [bagKg, setBagKg] = useState(DEFAULT_FERTILIZER_BAG_KG);
  const [selectedProducts, setSelectedProducts] = useState<
    Partial<Record<DoseNutrientKey, string>>
  >(defaultProductByDose);
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState("recommended");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(FERTILIZER_PLANNER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as {
          selectedProducts?: Partial<Record<DoseNutrientKey, string>>;
          manualPrices?: Record<string, string>;
          bagKg?: number;
        };
        if (parsed.selectedProducts) {
          setSelectedProducts({
            ...defaultProductByDose,
            ...parsed.selectedProducts,
          });
        }
        if (parsed.manualPrices) setManualPrices(parsed.manualPrices);
        if (parsed.bagKg && parsed.bagKg > 0) setBagKg(parsed.bagKg);
      }
    } catch {
      // Storage is optional; the planner remains usable without it.
    }
    setStorageReady(true);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(
        FERTILIZER_PLANNER_STORAGE_KEY,
        JSON.stringify({ selectedProducts, manualPrices, bagKg })
      );
    } catch {
      // Ignore storage quota/privacy errors.
    }
  }, [bagKg, manualPrices, selectedProducts, storageReady]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (country) params.set("country", country);
    if (currency) params.set("currency", currency);
    setLoadingPrices(true);
    setPriceError("");
    void fetch(`/api/fertilizer-prices?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const data = (await response.json()) as PriceResponse;
        if (!response.ok) throw new Error(data.error || "Unable to load online prices");
        setPrices(data);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setPriceError(
          error instanceof Error ? error.message : "Unable to load online prices"
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingPrices(false);
      });
    return () => controller.abort();
  }, [country, currency]);

  const activeRows = useMemo(
    () =>
      doses.filter(
        (dose) =>
          Boolean(nutrientByDose[dose.key]) &&
          !dose.notRequired &&
          !dose.viaEncalado &&
          (dose.dosisOxideKgHa || 0) > 0
      ),
    [doses]
  );

  const displayCurrency = prices?.currency || currency || "USD";
  const currencyOptions = [
    ...new Set([displayCurrency, ...FERTILIZER_CURRENCIES]),
  ].map((code) => [code, code] as [string, string]);
  const effectiveBagKg = bagKg > 0 ? bagKg : DEFAULT_FERTILIZER_BAG_KG;

  const onlineByKey = useMemo(() => {
    const map: Record<string, number | null | undefined> = {};
    for (const row of prices?.products || []) {
      map[row.key] = row.pricePerMetricTonne;
    }
    return map;
  }, [prices]);

  const productPrices = useMemo(
    () =>
      resolveProductPrices({
        bagKg: effectiveBagKg,
        currency: displayCurrency,
        manualPrices,
        onlineByKey,
      }),
    [displayCurrency, effectiveBagKg, manualPrices, onlineByKey]
  );

  const scenarios = useMemo(
    () =>
      buildCostScenarios({
        doses,
        prices: productPrices,
        bagKg: effectiveBagKg,
        selectedProducts,
        irrigationSystem,
        irrigationTable,
      }),
    [
      doses,
      productPrices,
      effectiveBagKg,
      selectedProducts,
      irrigationSystem,
      irrigationTable,
    ]
  );

  useEffect(() => {
    if (!scenarios.some((s) => s.id === activeScenarioId)) {
      const fallback =
        scenarios.find((s) => s.recommended)?.id || scenarios[0]?.id;
      if (fallback) setActiveScenarioId(fallback);
    }
  }, [activeScenarioId, scenarios]);

  useEffect(() => {
    if (!onReportData) return;
    const scenario = pickScenarioForReport(scenarios, activeScenarioId);
    if (!scenario) {
      onReportData({ products: [], outputs: [], applyLines: [] });
      return;
    }
    const payload = scenarioToReportPayload(scenario, {
      currency: displayCurrency,
      source: prices?.source || "benchmark",
      bagKg: effectiveBagKg,
      t,
    });
    onReportData(payload);
  }, [
    activeScenarioId,
    displayCurrency,
    effectiveBagKg,
    onReportData,
    prices?.source,
    scenarios,
    t,
  ]);

  if (activeRows.length === 0) return null;

  const plannedRows = activeRows.map((dose) => {
    const nutrient = nutrientByDose[dose.key]!;
    const availableProducts = fertilizersForNutrient(nutrient);
    const selectedKey =
      selectedProducts[dose.key] ||
      defaultProductByDose[dose.key] ||
      availableProducts[0]?.key;
    const product =
      COMMERCIAL_FERTILIZERS.find((item) => item.key === selectedKey) ||
      availableProducts[0];
    const grade = product?.grade[nutrient] || 0;
    const productKgHa =
      grade > 0 ? (dose.dosisOxideKgHa || 0) / (grade / 100) : 0;
    const bagsHa = productKgHa / effectiveBagKg;
    const onlineRow = prices?.products.find((item) => item.key === product?.key);
    const onlinePricePerBag = pricePerBagFromTonne(
      onlineRow?.pricePerMetricTonne || 0,
      effectiveBagKg
    );
    const manualKey = `saco:${effectiveBagKg}:${displayCurrency}:${product?.key || ""}`;
    const manualValue = Number(
      String(manualPrices[manualKey] || "").replace(",", ".")
    );
    const pricePerBag =
      manualValue > 0 ? manualValue : onlinePricePerBag;
    const costHa =
      pricePerBag == null ? null : bagsHa * pricePerBag;

    return {
      dose,
      nutrient,
      availableProducts,
      product,
      productKgHa,
      bagsHa,
      onlineRow,
      onlinePricePerBag,
      manualKey,
      pricePerBag,
      manual: manualValue > 0,
      costHa,
    };
  });

  const productsBody = (
    <div className={`grid gap-4 ${showAsPage ? "" : "px-4 pb-4 pt-2"}`.trim()}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-green-950 dark-text-primary">
            {country ||
              t.fertilizerPriceNoCountry ||
              "Select a country in the report details for local currency."}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {t.fertilizerPriceBasisBag ||
              "Enter the price per bag (saco). Online placeholders are benchmarks converted from tonne prices."}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label className="calc-field-label grid gap-1">
            {t.fertilizerBagKg || "Bag weight (kg)"}
            <input
              className="calc-field-input w-24"
              inputMode="decimal"
              value={bagKg || ""}
              onChange={(event) => {
                const next = Number(
                  String(event.target.value).replace(",", ".")
                );
                setBagKg(Number.isFinite(next) && next > 0 ? next : 0);
              }}
              placeholder={String(DEFAULT_FERTILIZER_BAG_KG)}
            />
          </label>
          <MenuSelect
            label={t.currency || "Currency"}
            value={displayCurrency}
            options={currencyOptions}
            onChange={setCurrency}
            compact
            variant="field"
          />
        </div>
      </div>

      {priceError ? (
        <p className="fertilizer-cost-alert rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {priceError}.{" "}
          {t.fertilizerManualFallback ||
            "Enter a known supplier price manually below."}
        </p>
      ) : null}

      <div className="grid gap-3">
        {plannedRows.map((row) => {
          if (!row.product) return null;
          const productOptions = row.availableProducts.map(
            (product) =>
              [
                product.key,
                `${product.label} · ${product.analysis}`,
              ] as [string, string]
          );
          return (
            <article
              key={row.dose.key}
              className="rounded-2xl border border-emerald-900/10 bg-white/60 p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MenuSelect
                  label={row.dose.nutrientOxide}
                  value={row.product.key}
                  options={productOptions}
                  onChange={(value) =>
                    setSelectedProducts((previous) => ({
                      ...previous,
                      [row.dose.key]: value,
                    }))
                  }
                  fullWidth
                  variant="field"
                />
                <label className="calc-field-label grid gap-1">
                  {`${t.fertilizerPricePerBag || "Price / bag (saco)"} (${displayCurrency})`}
                  <input
                    className="calc-field-input"
                    inputMode="decimal"
                    value={manualPrices[row.manualKey] || ""}
                    onChange={(event) =>
                      setManualPrices((previous) => ({
                        ...previous,
                        [row.manualKey]: event.target.value,
                      }))
                    }
                    placeholder={
                      row.onlinePricePerBag != null
                        ? String(row.onlinePricePerBag)
                        : t.fertilizerManualPrice || "Manual price"
                    }
                  />
                </label>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
                <Metric
                  label={t.fertilizerProductAmountHa || "Product / ha"}
                  value={`${row.productKgHa.toFixed(1)} kg · ${row.bagsHa.toFixed(1)} ${t.fertilizerBags || "bags"}`}
                />
                <Metric
                  label={t.fertilizerProductAmountPlot || "Product / plot"}
                  value={`${(row.productKgHa * areaHa).toFixed(1)} kg · ${(row.bagsHa * areaHa).toFixed(1)} ${t.fertilizerBags || "bags"}`}
                />
                <Metric
                  label={t.fertilizerCostHa || "Cost / ha"}
                  value={
                    row.costHa == null
                      ? "—"
                      : formatMoney(row.costHa, displayCurrency)
                  }
                />
                <Metric
                  label={t.fertilizerCostPlot || "Plot cost"}
                  value={
                    row.costHa == null
                      ? "—"
                      : formatMoney(row.costHa * areaHa, displayCurrency)
                  }
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                {row.manual
                  ? t.fertilizerManualPrice || "Manual supplier price"
                  : row.onlineRow?.proxy
                    ? `${t.fertilizerProxyPrice || "Online proxy"}: DAP`
                    : row.pricePerBag != null
                      ? `${t.fertilizerOnlinePrice || "Online benchmark"} · ${prices?.period || ""} · ${effectiveBagKg} kg/${t.fertilizerBag || "bag"}`
                      : t.fertilizerManualRequired ||
                        "No public benchmark is available; enter a supplier price."}
              </p>
            </article>
          );
        })}
      </div>

      {prices ? (
        <p className="text-[11px] text-slate-500">
          {loadingPrices ? `${t.loading || "Loading"}… ` : ""}
          <a
            href={prices.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline"
          >
            {prices.source}
          </a>
          {prices.updatedAt ? ` · ${prices.updatedAt}` : ""}
        </p>
      ) : null}
    </div>
  );

  const scenariosBody = (
    <div className={showAsPage ? undefined : "px-4 pb-4 pt-2"}>
      <FertilizerCostScenarios
        scenarios={scenarios}
        activeId={activeScenarioId}
        onSelect={setActiveScenarioId}
        onApply={(primaryByDose) => {
          setSelectedProducts((previous) => ({
            ...previous,
            ...primaryByDose,
          }));
          setActiveScenarioId("current_selection");
        }}
        areaHa={areaHa}
        currency={displayCurrency}
        t={t}
      />
    </div>
  );

  return (
    <div className="grid gap-4">
      {showAsPage ? (
        <section className="calc-surface space-y-4 p-4">
          <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.fertilizerProductsTitle || "Commercial fertilizers and prices"}
          </h3>
          {productsBody}
        </section>
      ) : (
        <details className="fertilizer-plan__interpretation calc-surface" open>
          <summary className="fertilizer-plan__recommendations-summary">
            {t.fertilizerProductsTitle || "Commercial fertilizers and prices"}
          </summary>
          {productsBody}
        </details>
      )}

      {showAsPage ? (
        <section className="calc-surface space-y-3 p-4">
          <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.fertilizerCostScenariosTitle || "Cost scenarios"}
          </h3>
          {scenariosBody}
        </section>
      ) : (
        <details className="fertilizer-plan__interpretation calc-surface" open>
          <summary className="fertilizer-plan__recommendations-summary">
            {t.fertilizerCostScenariosTitle || "Cost scenarios"}
          </summary>
          {scenariosBody}
        </details>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-emerald-50/80 p-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
        {label}
      </p>
      <p className="mt-1 font-semibold text-green-950 dark-text-primary">
        {value}
      </p>
    </div>
  );
}
