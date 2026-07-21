"use client";

import { useEffect, useMemo, useState } from "react";
import FertilizerCostScenarios, {
  type FertilizerCostViewMode,
} from "@/components/FertilizerCostScenarios";
import MenuSelect from "@/components/ui/MenuSelect";
import {
  COMMERCIAL_FERTILIZERS,
  DEFAULT_FERTILIZER_BAG_KG,
  FERTILIZER_CURRENCIES,
  fertilizersForNutrient,
  matchCatalogProductKey,
  pricePerBagFromTonne,
  type FertilizerNutrient,
} from "@/lib/fertilizerCatalog";
import {
  buildCostScenarios,
  missingPreferredPrices,
  resolveProductPrices,
} from "@/lib/fertilizerCostOptimize";
import {
  listAllBodegaItems,
  listBodegaItems,
  listUserFarms,
} from "@/lib/farmRepository";
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
  userId?: string | null;
  farmName?: string | null;
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
  userId = null,
  farmName = null,
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
  const [viewMode, setViewMode] = useState<FertilizerCostViewMode>("prices");
  const [applyNote, setApplyNote] = useState("");
  const [stockProductKeys, setStockProductKeys] = useState<string[]>([]);

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
    if (!userId) {
      setStockProductKeys([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const farmToken = (farmName || "").trim().toLocaleLowerCase();
        let items = farmToken
          ? []
          : await listAllBodegaItems(userId);
        if (farmToken) {
          const farms = await listUserFarms(userId);
          const farm = farms.find(
            (row) =>
              row.farm_name.trim().toLocaleLowerCase() === farmToken
          );
          items = farm
            ? await listBodegaItems(userId, farm.farm_id)
            : await listAllBodegaItems(userId);
        }
        if (cancelled) return;
        const keys = new Set<string>();
        for (const item of items) {
          if (!(item.quantity > 0)) continue;
          const key =
            item.product_key || matchCatalogProductKey(item.product_name);
          if (key) keys.add(key);
        }
        setStockProductKeys([...keys]);
      } catch {
        if (!cancelled) setStockProductKeys([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, farmName]);

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

  const missingPrices = useMemo(
    () => missingPreferredPrices(productPrices, selectedProducts),
    [productPrices, selectedProducts]
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
        stockProductKeys,
      }),
    [
      doses,
      productPrices,
      effectiveBagKg,
      selectedProducts,
      irrigationSystem,
      irrigationTable,
      stockProductKeys,
    ]
  );

  const activeScenario =
    scenarios.find((s) => s.id === activeScenarioId) ||
    scenarios.find((s) => s.recommended) ||
    scenarios[0] ||
    null;

  const activePlan = activeScenario?.plan || null;

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
    const blendLine = activePlan?.lines.find(
      (line) => line.productKey === product?.key
    );
    const onlineRow = prices?.products.find((item) => item.key === product?.key);
    const onlinePricePerBag = pricePerBagFromTonne(
      onlineRow?.pricePerMetricTonne || 0,
      effectiveBagKg
    );
    const manualKey = `saco:${effectiveBagKg}:${displayCurrency}:${product?.key || ""}`;
    const manualValue = Number(
      String(manualPrices[manualKey] || "").replace(",", ".")
    );
    const pricePerBag = manualValue > 0 ? manualValue : onlinePricePerBag;

    return {
      dose,
      nutrient,
      availableProducts,
      product,
      blendLine,
      onlineRow,
      onlinePricePerBag,
      manualKey,
      pricePerBag,
      manual: manualValue > 0,
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
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {t.fertilizerProductsBlendHint ||
              "Edit products and bag prices for My selection. Amounts follow the active mix above (nutrient credits included)."}
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
                const next = Number(String(event.target.value).replace(",", "."));
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
        <p className="fertilizer-cost-alert rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
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
              [`${product.key}`, `${product.label} · ${product.analysis}`] as [
                string,
                string,
              ]
          );
          return (
            <article
              key={row.dose.key}
              className="rounded-2xl border border-emerald-900/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <MenuSelect
                  label={row.dose.nutrientOxide}
                  value={row.product.key}
                  options={productOptions}
                  onChange={(value) => {
                    setSelectedProducts((previous) => ({
                      ...previous,
                      [row.dose.key]: value,
                    }));
                    setActiveScenarioId("current_selection");
                    setApplyNote("");
                  }}
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
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                {viewMode === "quantity" ? (
                  <>
                    <Metric
                      label={t.fertilizerProductAmountHa || "Product / ha"}
                      value={
                        row.blendLine
                          ? `${row.blendLine.kgHa.toFixed(1)} kg · ${row.blendLine.bagsHa.toFixed(1)} ${t.fertilizerBags || "bags"}`
                          : t.fertilizerBlendCovered ||
                            "Covered in mix / not primary"
                      }
                    />
                    <Metric
                      label={t.fertilizerProductAmountPlot || "Product / plot"}
                      value={
                        row.blendLine
                          ? `${(row.blendLine.kgHa * areaHa).toFixed(1)} kg · ${(row.blendLine.bagsHa * areaHa).toFixed(1)} ${t.fertilizerBags || "bags"}`
                          : "—"
                      }
                    />
                    <Metric
                      label={t.fertilizerQuantityPlot || "Plot quantity"}
                      value={
                        row.blendLine
                          ? `${(row.blendLine.kgHa * areaHa).toFixed(1)} kg`
                          : "—"
                      }
                    />
                  </>
                ) : (
                  <>
                    <Metric
                      label={t.fertilizerCostHa || "Cost / ha"}
                      value={
                        row.blendLine
                          ? formatMoney(row.blendLine.costHa, displayCurrency)
                          : t.fertilizerBlendCovered ||
                            "Covered in mix / not primary"
                      }
                    />
                    <Metric
                      label={t.fertilizerCostPlot || "Plot cost"}
                      value={
                        row.blendLine
                          ? formatMoney(
                              row.blendLine.costHa * areaHa,
                              displayCurrency
                            )
                          : "—"
                      }
                    />
                    <Metric
                      label={t.fertilizerPricePerBag || "Price / bag (saco)"}
                      value={
                        row.pricePerBag != null
                          ? formatMoney(row.pricePerBag, displayCurrency)
                          : "—"
                      }
                    />
                  </>
                )}
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
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

      {/* Price editors for blend products not tied to a dose picker */}
      {activePlan
        ? activePlan.lines
            .filter(
              (line) =>
                !plannedRows.some((row) => row.product?.key === line.productKey)
            )
            .map((line) => {
              const manualKey = `saco:${effectiveBagKg}:${displayCurrency}:${line.productKey}`;
              const onlineRow = prices?.products.find(
                (item) => item.key === line.productKey
              );
              const onlinePricePerBag = pricePerBagFromTonne(
                onlineRow?.pricePerMetricTonne || 0,
                effectiveBagKg
              );
              return (
                <article
                  key={line.productKey}
                  className="rounded-2xl border border-dashed border-emerald-900/15 bg-emerald-50/40 p-3 dark:border-white/15 dark:bg-white/5"
                >
                  <p className="text-sm font-semibold text-green-950 dark-text-primary">
                    {line.label} · {line.analysis}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {viewMode === "quantity"
                      ? `${(line.kgHa * areaHa).toFixed(1)} kg ${t.fertilizerPerPlot || "per plot"} · ${line.kgHa.toFixed(1)} kg/ha · ${(line.bagsHa * areaHa).toFixed(1)} ${t.fertilizerBags || "bags"}`
                      : `${formatMoney(line.costHa * areaHa, displayCurrency)} ${t.fertilizerCostPlot || "plot"} · ${line.kgHa.toFixed(1)} kg/ha`}
                  </p>
                  <label className="calc-field-label mt-2 grid gap-1">
                    {`${t.fertilizerPricePerBag || "Price / bag (saco)"} (${displayCurrency})`}
                    <input
                      className="calc-field-input"
                      inputMode="decimal"
                      value={manualPrices[manualKey] || ""}
                      onChange={(event) =>
                        setManualPrices((previous) => ({
                          ...previous,
                          [manualKey]: event.target.value,
                        }))
                      }
                      placeholder={
                        onlinePricePerBag != null
                          ? String(onlinePricePerBag)
                          : t.fertilizerManualPrice || "Manual price"
                      }
                    />
                  </label>
                </article>
              );
            })
        : null}

      {prices ? (
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
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
      {applyNote ? (
        <p className="mb-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {applyNote}
        </p>
      ) : null}
      <FertilizerCostScenarios
        scenarios={scenarios}
        activeId={activeScenarioId}
        onSelect={(id) => {
          setActiveScenarioId(id);
          setApplyNote("");
        }}
        onApply={({ primaryByDose, snappedFromIrrigation }) => {
          setSelectedProducts((previous) => ({
            ...previous,
            ...primaryByDose,
          }));
          setActiveScenarioId("current_selection");
          setApplyNote(
            snappedFromIrrigation
              ? t.fertilizerScenarioAppliedIrrig ||
                  "Mix applied to your current plan doses. Compare-by-irrigation rates stay for comparison only."
              : t.fertilizerScenarioApplied ||
                  "Mix applied. Totals now follow My selection with nutrient credits."
          );
        }}
        areaHa={areaHa}
        currency={displayCurrency}
        missingPrices={missingPrices}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        t={t}
      />
    </div>
  );

  return (
    <div className="grid gap-4">
      {showAsPage ? (
        <section className="calc-surface space-y-3 p-4">
          <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.fertilizerCostMixTitle || "Recommended mixes"}
          </h3>
          {scenariosBody}
        </section>
      ) : (
        <details className="fertilizer-plan__interpretation calc-surface" open>
          <summary className="fertilizer-plan__recommendations-summary">
            {t.fertilizerCostMixTitle || "Recommended mixes"}
          </summary>
          {scenariosBody}
        </details>
      )}

      {showAsPage ? (
        <section className="calc-surface space-y-4 p-4">
          <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.fertilizerProductsTitle || "Products & bag prices"}
          </h3>
          {productsBody}
        </section>
      ) : (
        <details className="fertilizer-plan__interpretation calc-surface">
          <summary className="fertilizer-plan__recommendations-summary">
            {t.fertilizerProductsTitle || "Products & bag prices"}
          </summary>
          {productsBody}
        </details>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="calc-metric p-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
        {label}
      </p>
      <p className="mt-1 font-semibold text-green-950 dark-text-primary">{value}</p>
    </div>
  );
}
