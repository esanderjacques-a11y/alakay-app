"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMemoryNumber, useMemoryString } from "@/hooks/useCalculatorMemory";
import FertilizerCostScenarios, {
  type FertilizerCostViewMode,
} from "@/components/FertilizerCostScenarios";
import MenuSelect from "@/components/ui/MenuSelect";
import {
  DEFAULT_FERTILIZER_BAG_KG,
  FERTILIZER_CURRENCIES,
  fertilizerShortLabel,
  fertilizersForNutrient,
  listAllFertilizers,
  matchCatalogProductKey,
  pricePerBagFromTonne,
  roundBagsForPurchase,
  type FertilizerNutrient,
} from "@/lib/fertilizerCatalog";
import AddCustomFertilizerForm from "@/components/AddCustomFertilizerForm";
import {
  buildCostScenarios,
  missingPreferredPrices,
  resolveProductPrices,
  withFallbackBagPrices,
} from "@/lib/fertilizerCostOptimize";
import {
  listAllBodegaItems,
  listBodegaItems,
  listUserFarms,
} from "@/lib/farmRepository";
import {
  areaUnitLabel,
  convertAreaToHa,
  type AreaUnit,
  type CalculationOutput,
} from "@/lib/agronomicCalculators";
import {
  pickScenarioForReport,
  scenarioToReportPayload,
  type PdfFertilizerProduct,
} from "@/lib/fertilizerReportPayload";
import {
  buildManualDosePlan,
  type DoseNutrientKey,
  type FertilityDoseResult,
} from "@/lib/soilFertilityPlan";
import type {
  IrrigationEfficiencyTable,
  IrrigationSystem,
} from "@/lib/soilFertilityTables";

const AREA_UNITS: AreaUnit[] = ["ha", "acre", "carreau", "m2"];

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

type DoseDraft = {
  n: number;
  p: number;
  k: number;
  mg: number;
  ca: number;
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
  onDosesChange?: (doses: FertilityDoseResult[], areaHa: number) => void;
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
  ca: "cao",
};

const defaultProductByDose: Partial<Record<DoseNutrientKey, string>> = {
  n: "urea",
  p: "dap",
  k: "mop",
  mg: "kieserite",
  ca: "calcium_nitrate",
};

const DOSE_FIELDS: Array<{
  key: keyof DoseDraft;
  doseKey: DoseNutrientKey;
  label: string;
}> = [
  { key: "n", doseKey: "n", label: "N" },
  { key: "p", doseKey: "p", label: "P₂O₅" },
  { key: "k", doseKey: "k", label: "K₂O" },
  { key: "mg", doseKey: "mg", label: "MgO" },
  { key: "ca", doseKey: "ca", label: "CaO" },
];

const FERTILIZER_PLANNER_STORAGE_KEY = "cultosol_fertilizer_products_v2";

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatNumberInput(value: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return String(value);
}

function parseNumberInput(text: string) {
  const cleaned = text.replace(",", ".").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

/** Keeps draft text so comma/dot decimals can be typed without being stripped. */
function DecimalField({
  value,
  onChange,
  className,
  placeholder,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  className?: string;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [text, setText] = useState(() => formatNumberInput(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(formatNumberInput(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      className={className}
      value={text}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        const next = parseNumberInput(text);
        const clamped = next > 0 ? next : 0;
        setText(formatNumberInput(clamped));
        onChange(clamped);
      }}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        if (
          nextText.trim() === "" ||
          nextText.endsWith(".") ||
          nextText.endsWith(",")
        ) {
          return;
        }
        const parsed = parseNumberInput(nextText);
        onChange(parsed > 0 ? parsed : 0);
      }}
    />
  );
}

function doseDraftFromDoses(doses: FertilityDoseResult[]): DoseDraft {
  const read = (key: DoseNutrientKey) => {
    const dose = doses.find((row) => row.key === key);
    if (!dose || dose.notRequired || dose.viaEncalado) return 0;
    return Math.max(0, dose.dosisOxideKgHa ?? 0);
  };
  return {
    n: read("n"),
    p: read("p"),
    k: read("k"),
    mg: read("mg"),
    ca: read("ca"),
  };
}

function dosesSignature(doses: FertilityDoseResult[]) {
  return doses
    .map(
      (dose) =>
        `${dose.key}:${dose.dosisOxideKgHa ?? 0}:${dose.notRequired ? 1 : 0}:${dose.viaEncalado ? 1 : 0}`
    )
    .join("|");
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
  onDosesChange,
  onReportData,
}: Props) {
  const [currency, setCurrency] = useState("");
  const [prices, setPrices] = useState<PriceResponse | null>(null);
  const [priceError, setPriceError] = useState("");
  const [, setLoadingPrices] = useState(false);
  const [bagKg, setBagKg] = useState(DEFAULT_FERTILIZER_BAG_KG);
  const [selectedProducts, setSelectedProducts] = useState<
    Partial<Record<DoseNutrientKey, string>>
  >(defaultProductByDose);
  const [manualPrices, setManualPrices] = useState<Record<string, string>>({});
  const [storageReady, setStorageReady] = useState(false);
  const [activeScenarioId, setActiveScenarioId] = useState("recommended");
  const [viewMode, setViewMode] = useState<FertilizerCostViewMode>("quantity");
  const [quantityUnit, setQuantityUnit] = useState<"kg" | "bags">("kg");
  const [applyNote, setApplyNote] = useState("");
  const [stockProductKeys, setStockProductKeys] = useState<string[]>([]);
  const [catalogVersion, setCatalogVersion] = useState(0);
  const [showAddFertilizer, setShowAddFertilizer] = useState(false);
  const [selectionEditorOpen, setSelectionEditorOpen] = useState(true);
  const initialDose = doseDraftFromDoses(doses);
  const [doseN, setDoseN] = useMemoryNumber("fertilizerCost", "doseN", initialDose.n);
  const [doseP, setDoseP] = useMemoryNumber("fertilizerCost", "doseP", initialDose.p);
  const [doseK, setDoseK] = useMemoryNumber("fertilizerCost", "doseK", initialDose.k);
  const [doseMg, setDoseMg] = useMemoryNumber("fertilizerCost", "doseMg", initialDose.mg);
  const [doseCa, setDoseCa] = useMemoryNumber("fertilizerCost", "doseCa", initialDose.ca);
  const doseDraft = useMemo<DoseDraft>(
    () => ({
      n: doseN,
      p: doseP,
      k: doseK,
      mg: doseMg,
      ca: doseCa,
    }),
    [doseN, doseP, doseK, doseMg, doseCa]
  );
  const [doseSyncKey, setDoseSyncKey] = useState(() => dosesSignature(doses));
  const [dosesEditedRaw, setDosesEditedRaw] = useMemoryString(
    "fertilizerCost",
    "dosesEdited",
    "0"
  );
  const dosesEdited = dosesEditedRaw === "1";
  const setDosesEdited = (next: boolean) => setDosesEditedRaw(next ? "1" : "0");
  const [plotArea, setPlotArea] = useMemoryNumber(
    "fertilizerCost",
    "plotArea",
    areaHa > 0 ? areaHa : 1
  );
  const [plotAreaUnitRaw, setPlotAreaUnitRaw] = useMemoryString(
    "fertilizerCost",
    "plotAreaUnit",
    "ha"
  );
  const plotAreaUnit = plotAreaUnitRaw as AreaUnit;
  const setPlotAreaUnit = (next: AreaUnit) => setPlotAreaUnitRaw(next);

  useEffect(() => {
    const nextKey = dosesSignature(doses);
    if (nextKey === doseSyncKey) return;
    const next = doseDraftFromDoses(doses);
    const silent = { recordHistory: false } as const;
    setDoseN(next.n, silent);
    setDoseP(next.p, silent);
    setDoseK(next.k, silent);
    setDoseMg(next.mg, silent);
    setDoseCa(next.ca, silent);
    setDoseSyncKey(nextKey);
    setDosesEditedRaw("0", { recordHistory: false });
  }, [doses, doseSyncKey, setDoseN, setDoseP, setDoseK, setDoseMg, setDoseCa, setDosesEditedRaw]);

  useEffect(() => {
    if (dosesEdited || plotAreaUnit !== "ha" || !(areaHa > 0)) return;
    setPlotArea(areaHa, { recordHistory: false });
  }, [areaHa, dosesEdited, plotAreaUnit, setPlotArea]);

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

  const effectiveAreaHa = useMemo(() => {
    if (!showAsPage) return areaHa > 0 ? areaHa : 1;
    const area = plotArea > 0 ? plotArea : 1;
    const ha = convertAreaToHa(area, plotAreaUnit);
    return ha > 0 ? ha : 1;
  }, [areaHa, plotArea, plotAreaUnit, showAsPage]);

  const effectiveDoses = useMemo(() => {
    if (!showAsPage) return doses;
    if (!dosesEdited && doses.length > 0) return doses;
    return buildManualDosePlan({
      nOxideKgHa: doseDraft.n,
      p2o5KgHa: doseDraft.p,
      k2oKgHa: doseDraft.k,
      mgoKgHa: doseDraft.mg,
      caoKgHa: doseDraft.ca,
      area: plotArea > 0 ? plotArea : 1,
      areaUnit: plotAreaUnit,
    }).doses;
  }, [doseDraft, doses, dosesEdited, plotArea, plotAreaUnit, showAsPage]);

  const activeRows = useMemo(
    () =>
      effectiveDoses.filter(
        (dose) =>
          Boolean(nutrientByDose[dose.key]) &&
          !dose.notRequired &&
          !dose.viaEncalado &&
          (dose.dosisOxideKgHa || 0) > 0
      ),
    [effectiveDoses]
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

  // Quantity view: always fill missing quotes so mixes/kg still compute.
  // Prices view: use real + nutrient-estimated quotes only (no neutral dummy).
  const scenarioPrices = useMemo(
    () =>
      viewMode === "quantity"
        ? withFallbackBagPrices(productPrices)
        : productPrices,
    [productPrices, viewMode]
  );

  const scenarios = useMemo(
    () =>
      buildCostScenarios({
        doses: effectiveDoses,
        prices: scenarioPrices,
        bagKg: effectiveBagKg,
        selectedProducts,
        irrigationSystem,
        irrigationTable,
        stockProductKeys,
      }),
    [
      effectiveDoses,
      scenarioPrices,
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
  const isMySelection = activeScenarioId === "current_selection";

  useEffect(() => {
    if (!scenarios.some((s) => s.id === activeScenarioId)) {
      const fallback =
        scenarios.find((s) => s.recommended)?.id || scenarios[0]?.id;
      if (fallback) setActiveScenarioId(fallback);
    }
  }, [activeScenarioId, scenarios]);

  const lastReportSignatureRef = useRef("");
  useEffect(() => {
    if (!onReportData) return;
    const scenario = pickScenarioForReport(scenarios, activeScenarioId);
    if (!scenario) {
      if (lastReportSignatureRef.current === "empty") return;
      lastReportSignatureRef.current = "empty";
      onReportData({ products: [], outputs: [], applyLines: [] });
      return;
    }
    const payload = scenarioToReportPayload(scenario, {
      currency: displayCurrency,
      source: prices?.source || "benchmark",
      bagKg: effectiveBagKg,
      t,
    });
    const signature = JSON.stringify(payload);
    if (signature === lastReportSignatureRef.current) return;
    lastReportSignatureRef.current = signature;
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

  function commitDoseDraft(
    next: DoseDraft,
    nextArea = plotArea,
    nextUnit = plotAreaUnit
  ) {
    setDosesEdited(true);
    setDoseN(next.n);
    setDoseP(next.p);
    setDoseK(next.k);
    setDoseMg(next.mg);
    setDoseCa(next.ca);
    setPlotArea(nextArea);
    setPlotAreaUnit(nextUnit);
    const plan = buildManualDosePlan({
      nOxideKgHa: next.n,
      p2o5KgHa: next.p,
      k2oKgHa: next.k,
      mgoKgHa: next.mg,
      caoKgHa: next.ca,
      area: nextArea > 0 ? nextArea : 1,
      areaUnit: nextUnit,
    });
    setDoseSyncKey(dosesSignature(plan.doses));
    onDosesChange?.(plan.doses, plan.areaHa);
  }

  function updateDoseField(key: keyof DoseDraft, value: number) {
    commitDoseDraft({ ...doseDraft, [key]: value > 0 ? value : 0 });
  }

  function updatePlotArea(value: number) {
    commitDoseDraft(doseDraft, value > 0 ? value : 0, plotAreaUnit);
  }

  function updatePlotAreaUnit(unit: AreaUnit) {
    commitDoseDraft(doseDraft, plotArea, unit);
  }

  const plannedRows = activeRows.map((dose) => {
    const nutrient = nutrientByDose[dose.key]!;
    const availableProducts = fertilizersForNutrient(nutrient);
    const selectedKey =
      selectedProducts[dose.key] ||
      defaultProductByDose[dose.key] ||
      availableProducts[0]?.key;
    const product =
      listAllFertilizers().find((item) => item.key === selectedKey) ||
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

  const setupControls = (
    <div className="fertilizer-setup-row">
      <label className="fertilizer-setup-field fertilizer-setup-field--bag">
        <span className="fertilizer-setup-field__label">
          {t.fertilizerBagKgShort || t.fertilizerBagKg || "Bag size"}
        </span>
        <span className="fertilizer-bag-weight">
          <DecimalField
            className="calc-field-input fertilizer-bag-weight__input"
            value={bagKg}
            onChange={setBagKg}
            placeholder={String(DEFAULT_FERTILIZER_BAG_KG)}
            ariaLabel={t.fertilizerBagKg || "Bag weight (kg)"}
          />
        </span>
        <span className="fertilizer-bag-weight__unit" aria-hidden>
          kg
        </span>
      </label>
      <div className="fertilizer-setup-field fertilizer-setup-field--currency">
        <MenuSelect
          label={t.currency || "Currency"}
          value={displayCurrency}
          options={currencyOptions}
          onChange={setCurrency}
          compact
          variant="field"
          className="fertilizer-setup-currency"
        />
      </div>
    </div>
  );

  const viewModeRow = (
    <div className="fertilizer-view-mode">
      <p className="fertilizer-view-mode__label">
        {t.fertilizerViewLabel || "View as"}
      </p>
      <div
        className="app-segmented-control fertilizer-view-mode__control"
        role="group"
        aria-label={t.fertilizerViewLabel || "View as"}
      >
        <button
          type="button"
          onClick={() => setViewMode("quantity")}
          aria-pressed={viewMode === "quantity"}
          className={`app-segmented-control__btn${
            viewMode === "quantity" ? " app-segmented-control__btn--active" : ""
          }`}
        >
          {t.fertilizerViewQuantity || "Quantity"}
        </button>
        <button
          type="button"
          onClick={() => setViewMode("prices")}
          aria-pressed={viewMode === "prices"}
          className={`app-segmented-control__btn${
            viewMode === "prices" ? " app-segmented-control__btn--active" : ""
          }`}
        >
          {t.fertilizerViewPrices || "Prices"}
        </button>
      </div>
    </div>
  );

  const productCards = (
    <div className="fertilizer-pick-list" key={catalogVersion}>
      <div className="fertilizer-pick-row fertilizer-pick-row--head">
        <span className="fertilizer-pick-row__nutrient" aria-hidden />
        <span className="fertilizer-pick-row__product">
          {t.fertilizerPickColProduct || "Products"}
        </span>
        {viewMode === "quantity" ? (
          <button
            type="button"
            className="fertilizer-pick-row__metric fertilizer-pick-row__metric-toggle"
            aria-label={t.fertilizerPickColUnitToggle || "Switch quantity unit"}
            title={t.fertilizerPickColUnitToggle || "Switch quantity unit"}
            onClick={() =>
              setQuantityUnit((previous) => (previous === "kg" ? "bags" : "kg"))
            }
          >
            {quantityUnit === "kg"
              ? t.fertilizerPickColQty || "kg"
              : t.fertilizerPickColBags || t.fertilizerBags || "bags"}
          </button>
        ) : (
          <span className="fertilizer-pick-row__metric">
            {t.fertilizerPickColCost || t.fertilizerViewPrices || "Cost"}
          </span>
        )}
        <span className="fertilizer-pick-row__price">
          {t.fertilizerPickColPrice || "Price"}
        </span>
      </div>
      {plannedRows.map((row) => {
        if (!row.product) return null;
        const productOptions = row.availableProducts.map((product) => ({
          value: product.key,
          label: `${product.label}${
            product.custom ? ` · ${t.fertilizerCustomTag || "custom"}` : ""
          }`,
          shortLabel: fertilizerShortLabel(product),
        }));
        const metric = !row.blendLine
          ? "—"
          : viewMode === "quantity"
            ? quantityUnit === "bags"
              ? String(
                  roundBagsForPurchase(row.blendLine.bagsHa * effectiveAreaHa)
                )
              : (row.blendLine.kgHa * effectiveAreaHa).toFixed(1)
            : formatMoney(
                row.blendLine.costHa * effectiveAreaHa,
                displayCurrency
              );
        return (
          <div key={row.dose.key} className="fertilizer-pick-row">
            <span className="fertilizer-pick-row__nutrient">
              {row.dose.nutrientOxide}
            </span>
            <div className="fertilizer-pick-row__product">
              <MenuSelect
                label=""
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
                compact
                shortTrigger
                searchable
                searchPlaceholder={
                  t.fertilizerSearchPlaceholderShort ||
                  t.fertilizerSearchPlaceholder ||
                  "Search…"
                }
              />
            </div>
            <span className="fertilizer-pick-row__metric">{metric}</span>
            <label className="fertilizer-pick-row__price">
              <span className="sr-only">
                {t.fertilizerPricePerBag || "Price / bag"}
              </span>
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
                    : displayCurrency
                }
              />
            </label>
          </div>
        );
      })}
    </div>
  );

  const orphanBlendLines = activePlan
    ? activePlan.lines.filter(
        (line) =>
          !plannedRows.some((row) => row.product?.key === line.productKey)
      )
    : [];

  /** Products in the mix that aren't assigned to a nutrient row — only show when pricing them matters. */
  const extraBlendPriceEditors =
    orphanBlendLines.length > 0 ? (
      <div className="fertilizer-pick-extras">
        <p className="fertilizer-pick-extras__note">
          {t.fertilizerExtraInMix ||
            "Also in this mix (covers another nutrient as a credit)"}
        </p>
        <div className="fertilizer-pick-list fertilizer-pick-list--extras">
          {orphanBlendLines.map((line) => {
            const manualKey = `saco:${effectiveBagKg}:${displayCurrency}:${line.productKey}`;
            const onlineRow = prices?.products.find(
              (item) => item.key === line.productKey
            );
            const onlinePricePerBag = pricePerBagFromTonne(
              onlineRow?.pricePerMetricTonne || 0,
              effectiveBagKg
            );
            const metric =
              viewMode === "quantity"
                ? quantityUnit === "bags"
                  ? String(roundBagsForPurchase(line.bagsHa * effectiveAreaHa))
                  : (line.kgHa * effectiveAreaHa).toFixed(1)
                : formatMoney(line.costHa * effectiveAreaHa, displayCurrency);
            return (
              <div key={line.productKey} className="fertilizer-pick-row">
                <span className="fertilizer-pick-row__nutrient" aria-hidden>
                  +
                </span>
                <div className="fertilizer-pick-row__product">
                  <p className="fertilizer-pick-extras__name">
                    {line.label}
                    <span className="fertilizer-pick-extras__analysis">
                      {" "}
                      · {line.analysis}
                    </span>
                  </p>
                </div>
                <span className="fertilizer-pick-row__metric">{metric}</span>
                <label className="fertilizer-pick-row__price">
                  <span className="sr-only">
                    {t.fertilizerPricePerBag || "Price / bag"}
                  </span>
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
                      onlinePricePerBag != null && onlinePricePerBag > 0
                        ? String(onlinePricePerBag)
                        : displayCurrency
                    }
                  />
                </label>
              </div>
            );
          })}
        </div>
      </div>
    ) : null;

  const addFertilizerControls = (
    <>
      <div className="flex justify-end">
        <button
          type="button"
          className="text-xs font-semibold text-emerald-800 underline"
          onClick={() => setShowAddFertilizer((open) => !open)}
        >
          {showAddFertilizer
            ? t.fertilizerAddProductCancel || "Cancel"
            : t.fertilizerAddProduct || "Add fertilizer"}
        </button>
      </div>
      {showAddFertilizer ? (
        <AddCustomFertilizerForm
          t={t}
          onSaved={() => {
            setCatalogVersion((version) => version + 1);
            setShowAddFertilizer(false);
            setApplyNote(
              t.fertilizerAddProductSaved ||
                "Fertilizer added to your lists."
            );
          }}
          onCancel={() => setShowAddFertilizer(false)}
        />
      ) : null}
    </>
  );

  const selectionSummary = plannedRows
    .map((row) =>
      row.product ? fertilizerShortLabel(row.product) || row.product.label : null
    )
    .filter(Boolean)
    .join(" · ");

  const selectionPanel =
    activeRows.length === 0 ? (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {t.fertilizerCostNeedDoses ||
          "Enter doses above to choose fertilizers."}
      </p>
    ) : selectionEditorOpen ? (
      <div className="grid gap-2">
        {addFertilizerControls}
        {productCards}
        {extraBlendPriceEditors}
        <button
          type="button"
          className="fertilizer-selection-ok"
          onClick={() => setSelectionEditorOpen(false)}
        >
          {t.fertilizerFormulationDoneSelecting || t.ok || "OK"}
        </button>
      </div>
    ) : (
      <div className="fertilizer-selection-collapsed">
        <p className="fertilizer-selection-collapsed__summary">
          {selectionSummary ||
            t.fertilizerScenarioCurrent ||
            "My selection"}
        </p>
        <button
          type="button"
          className="fertilizer-selection-collapsed__change"
          onClick={() => setSelectionEditorOpen(true)}
        >
          {t.fertilizerFormulationChangeSelection || "Change"}
        </button>
      </div>
    );

  const scenariosBody = (
    <div className={showAsPage ? undefined : "px-0 pb-4 pt-2"}>
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
          if (id === "current_selection") setSelectionEditorOpen(true);
        }}
        onApply={({ primaryByDose, snappedFromIrrigation, scenario }) => {
          setSelectedProducts((previous) => ({
            ...previous,
            ...primaryByDose,
          }));
          setActiveScenarioId("current_selection");
          setSelectionEditorOpen(false);
          setApplyNote(
            snappedFromIrrigation
              ? t.fertilizerScenarioAppliedIrrig ||
                  "Mix applied to your current plan doses. Compare-by-irrigation rates stay for comparison only."
              : t.fertilizerScenarioApplied ||
                  "Mix applied. Totals now follow My selection with nutrient credits."
          );
          void (async () => {
            try {
              const { getSettings } = await import("@/lib/appSettings");
              if (!getSettings().inventory.consumeStockOnPlanApply) return;
              if (!userId || !scenario.plan?.lines?.length) return;
              const farms = await listUserFarms(userId);
              const farmToken = (farmName || "").trim().toLocaleLowerCase();
              const farm =
                farms.find(
                  (f) => f.farm_name.trim().toLocaleLowerCase() === farmToken
                ) || farms[0];
              if (!farm) return;
              const { consumeStockForProducts } = await import(
                "@/lib/inventoryRepository"
              );
              await consumeStockForProducts({
                userId,
                farmId: farm.farm_id,
                lines: scenario.plan.lines.map((line) => ({
                  productKey: line.productKey,
                  productName: line.label,
                  quantity: line.kgHa * effectiveAreaHa,
                  unit: "kg",
                })),
              });
            } catch (err) {
              console.warn("inventory consume on apply:", err);
            }
          })();
        }}
        areaHa={effectiveAreaHa}
        currency={displayCurrency}
        missingPrices={missingPrices}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        selectionPanel={selectionPanel}
        showViewMode={!showAsPage}
        showIrrigationCompare={!showAsPage}
        t={t}
      />
    </div>
  );

  const doseSummary = DOSE_FIELDS.filter((field) => doseDraft[field.key] > 0)
    .map((field) => `${field.label} ${doseDraft[field.key]}`)
    .join(" · ");

  if (showAsPage) {
    return (
      <div className="grid gap-3">
        <section className="calc-surface space-y-3 p-4">
          <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.fertilizerCost || "Fertilizers & cost"}
          </h2>

          <details className="fertilizer-cost-doses">
            <summary>
              <span className="fertilizer-cost-doses__label">
                {t.fertilizerCostDosesToggle ||
                  "Tap to add or review doses"}
                {doseSummary ? (
                  <span className="fertilizer-cost-doses__summary">
                    · {doseSummary}
                  </span>
                ) : null}
              </span>
              <span className="fertilizer-cost-doses__chevron" aria-hidden />
            </summary>
            <div className="fertilizer-cost-doses__fields calc-form-fields calc-form-fields--grid grid grid-cols-3 gap-3">
              {DOSE_FIELDS.map((field) => (
                <label key={field.key} className="calc-field-label grid gap-1">
                  {`${field.label} (kg/ha)`}
                  <DecimalField
                    className="calc-field-input"
                    value={doseDraft[field.key]}
                    onChange={(value) => updateDoseField(field.key, value)}
                    placeholder="0"
                  />
                </label>
              ))}
              <div className="fertilizer-cost-doses__area-unit">
                <label className="fertilizer-cost-doses__area-field">
                  <span className="fertilizer-cost-doses__area-label">
                    {t.area || "Area"}
                  </span>
                  <DecimalField
                    className="calc-field-input fertilizer-cost-doses__area-input"
                    value={plotArea}
                    onChange={updatePlotArea}
                    placeholder="1"
                    ariaLabel={t.area || "Area"}
                  />
                </label>
                <div className="fertilizer-cost-doses__unit-field">
                  <span className="fertilizer-cost-doses__area-label">
                    {t.areaUnit || t.unit || "Unit"}
                  </span>
                  <MenuSelect
                    label=""
                    value={plotAreaUnit}
                    options={AREA_UNITS.map(
                      (unit) =>
                        [
                          unit,
                          t[`areaUnit_${unit}`] || areaUnitLabel(unit),
                        ] as [AreaUnit, string]
                    )}
                    onChange={updatePlotAreaUnit}
                    compact
                    variant="field"
                    className="fertilizer-cost-doses__unit-select"
                  />
                </div>
              </div>
            </div>
          </details>

          <div className="fertilizer-cost-toolbar">
            {setupControls}
            {viewModeRow}
          </div>

          {priceError ? (
            <p className="fertilizer-cost-alert rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {priceError}
            </p>
          ) : null}

          {scenariosBody}

          {!isMySelection && missingPrices.length > 0 && activeRows.length > 0 ? (
            <details className="fertilizer-cost-doses">
              <summary>
                <span className="fertilizer-cost-doses__label">
                  {t.fertilizerProductsTitle || "Fertilizers & prices"}
                </span>
                <span className="fertilizer-cost-doses__chevron" aria-hidden />
              </summary>
              <div className="mt-2 grid gap-2">
                {addFertilizerControls}
                {productCards}
                {extraBlendPriceEditors}
              </div>
            </details>
          ) : null}
        </section>
      </div>
    );
  }

  const productsBody = (
    <div className="grid gap-3 px-0 pb-4 pt-2">
      {setupControls}
      {priceError ? (
        <p className="fertilizer-cost-alert rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {priceError}
        </p>
      ) : null}
      {addFertilizerControls}
      {productCards}
      {extraBlendPriceEditors}
    </div>
  );

  return (
    <div className="grid gap-4">
      <details className="fertilizer-plan__interpretation calc-surface" open>
        <summary className="fertilizer-plan__recommendations-summary">
          {t.fertilizerCostMixTitle || "Recommended mixes"}
        </summary>
        {scenariosBody}
      </details>

      {!isMySelection ? (
        <details className="fertilizer-plan__interpretation calc-surface">
          <summary className="fertilizer-plan__recommendations-summary">
            {t.fertilizerProductsTitle || "Products & bag prices"}
          </summary>
          {productsBody}
        </details>
      ) : null}
    </div>
  );
}
