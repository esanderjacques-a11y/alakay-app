"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowDownWideNarrow,
  ArrowUpNarrowWide,
  BarChart3,
  Calculator,
  CalendarDays,
  CircleDollarSign,
  Droplets,
  FileText,
  FlaskConical,
  Beaker,
  RefreshCcw,
  Leaf,
  Percent,
  Sprout,
} from "lucide-react";
import {
  calculateCNRatio,
  calculateDop,
  calculateGypsumRequirementByPsi,
  calculateLeachingRequirement,
  calculatePorosity,
  calculatePsi,
  calculateSar,
  calculateTotalWaterFromLeaching,
  type CalculationOutput,
  type CalculatorValue,
} from "@/lib/agronomicCalculators";
import type { CalculatorOutputPack, PdfFertilizerProduct } from "@/lib/pdfReport";
import { buildRecommendedFertilizerReport } from "@/lib/fertilizerReportPayload";
import PhAmendmentCalculator from "@/components/PhAmendmentCalculator";
import FertilizerPlanCalculator from "@/components/FertilizerPlanCalculator";
import FertilizerProductPlanner from "@/components/FertilizerProductPlanner";
import FertilizerFormulationBuilder from "@/components/FertilizerFormulationBuilder";
import MenuSelect from "@/components/ui/MenuSelect";
import type { Language } from "@/lib/translations";
import { calculatorHubText } from "@/lib/i18n/componentText";
import { formatMessage } from "@/lib/i18n/format";
import { getUptakeProfileForCrop } from "@/lib/i18n/uptakeProfiles";
import { buildLabValueIndex, labHasUsefulSoilData } from "@/lib/labValueIndex";
import { toMassPercent } from "@/lib/unitConversions";
import {
  enrichLabWithResolvedCations,
} from "@/lib/resolveCationInputs";
import { useSoilFertilityReference } from "@/lib/soilFertilityData";
import {
  CalculatorMemoryProvider,
  useCalculatorMemory,
  useMemoryNumber,
  calculationOutputsMapSignature,
  useEmitCalculatorOutputs,
  useSharedCationInputs,
} from "@/hooks/useCalculatorMemory";
import {
  buildBaseSaturationOutputs,
  calculateBaseSaturation,
  getCicAcidityContribution,
  type BaseRelationKey,
  type BaseSaturationResult,
} from "@/lib/baseSaturation";
import {
  interpretCationRatio,
  interpretCationSaturation,
  ratioBandLabelKey,
  saturationBandMessageKey,
  type CicRatioBand,
  type CicSaturationBand,
} from "@/lib/cicInterpretation";
import type { FertilityDoseResult } from "@/lib/soilFertilityPlan";
import {
  TABLE_7_IRRIGATION_EFFICIENCY,
  type CicRatioRangeTable,
  type CicSaturationBandTable,
  type IrrigationEfficiencyTable,
  type IrrigationSystem,
} from "@/lib/soilFertilityTables";
import { useViewLayoutPreference } from "@/hooks/useViewLayoutPreference";
import { ViewLayoutToggle } from "@/components/ui/ViewLayoutToggle";
import BackButton from "@/components/ui/BackButton";
import ExportPdfIconButton from "@/components/ExportPdfIconButton";
import ChartExpandShell from "@/components/ui/ChartExpandShell";
import { buildCultosolChartWatermark } from "@/lib/chartPngExport";
import type { ViewLayoutMode } from "@/lib/viewLayoutPreference";

type ParameterLite = {
  parameter_key: string;
  parameter_name: string;
  display_name: string;
  symbol: string | null;
  category: string | null;
};

type ResultLite = {
  parameter_key?: string;
  parameter_name: string;
  display_parameter_name?: string;
  value: number;
  unit_symbol?: string;
  min?: number | null;
  max?: number | null;
  final_group_code?: string;
};

type Props = {
  language: Language;
  parameters: ParameterLite[];
  values: Record<string, string>;
  results: ResultLite[];
  sampleType: "soil" | "foliar";
  selectedCropName?: string | null;
  selectedCountry?: string | null;
  /** Report / sampling date for chart PNG watermarks. */
  reportDate?: string | null;
  /** Selected display unit per parameter_key (from Values). */
  parameterUnits?: Record<string, string>;
  goToValues?: () => void;
  onOpenCalendar?: () => void;
  onBack?: () => void;
  onOutputsChange?: (packs: CalculatorOutputPack[]) => void;
  onReportExtrasChange?: (extras: {
    planRecommendations: string[];
    fertilizerProducts: PdfFertilizerProduct[];
    fertilizerApplyLines: string[];
  }) => void;
  onFertilizerPlanChange?: (plan: FertilizerPlanSnapshot) => void;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
  exportPdfLabel?: string;
  showCalculatorFormulas?: boolean;
  userId?: string | null;
  farmName?: string | null;
  initialActiveKey?: string | null;
  onInitialActiveKeyConsumed?: () => void;
};

type CalculatorKey =
  | "priority"
  | "cic"
  | "amendment"
  | "fertilizer"
  | "fertilizerCost"
  | "fertilizerFormulation"
  | "dop"
  | "uptake"
  | "salinity"
  | "graphs";

export type FertilizerPlanSnapshot = {
  doses: FertilityDoseResult[];
  areaHa: number;
  irrigationSystem: IrrigationSystem;
  irrigationTable: IrrigationEfficiencyTable;
  recommendations: string[];
};

const CalculatorFieldsLayoutContext = createContext<ViewLayoutMode>("grid");

const tabs: Array<{ key: CalculatorKey; icon: ReactNode }> = [
  { key: "priority", icon: <Activity size={17} /> },
  { key: "cic", icon: <Percent size={17} /> },
  { key: "amendment", icon: <FlaskConical size={17} /> },
  { key: "fertilizer", icon: <Leaf size={17} /> },
  { key: "fertilizerCost", icon: <CircleDollarSign size={17} /> },
  { key: "fertilizerFormulation", icon: <Beaker size={17} /> },
  { key: "dop", icon: <Calculator size={17} /> },
  { key: "uptake", icon: <Sprout size={17} /> },
  { key: "salinity", icon: <Droplets size={17} /> },
  { key: "graphs", icon: <BarChart3 size={17} /> },
];

function visibleCalculatorTabs(sampleType: "soil" | "foliar") {
  return tabs.filter(({ key }) => {
    // Foliar-only tools
    if (key === "dop") return sampleType === "foliar";
    // Soil-only tools (lime, CIC, fertilizer plan/cost/formulation, salinity)
    if (
      key === "cic" ||
      key === "amendment" ||
      key === "salinity" ||
      key === "fertilizer" ||
      key === "fertilizerCost" ||
      key === "fertilizerFormulation"
    ) {
      return sampleType === "soil";
    }
    // Shared: Recommended, absorption curve, nutrient graphs
    return true;
  });
}

/** "Guided" mode: recommended calculation order, one calculator screen at a time. */
type HubMode = "guided" | "explorer";

const GUIDED_STEPS: Record<"soil" | "foliar", CalculatorKey[]> = {
  soil: ["cic", "amendment", "fertilizer", "fertilizerCost"],
  foliar: ["dop", "uptake"],
};

function hasActiveFertilizerDoses(doses: FertilityDoseResult[]) {
  return doses.some(
    (dose) =>
      !dose.notRequired &&
      !dose.viaEncalado &&
      (dose.dosisOxideKgHa || 0) > 0
  );
}

export default function CalculatorHub({
  language,
  parameters,
  values,
  results,
  sampleType,
  selectedCropName,
  selectedCountry,
  reportDate = null,
  parameterUnits = {},
  goToValues,
  onOpenCalendar,
  onBack,
  onOutputsChange,
  onReportExtrasChange,
  onFertilizerPlanChange,
  onExportPdf,
  exportingPdf,
  exportPdfLabel,
  showCalculatorFormulas = false,
  userId = null,
  farmName = null,
  initialActiveKey = null,
  onInitialActiveKeyConsumed,
}: Props) {
  const t = calculatorHubText[language] || calculatorHubText.en;
  const defaultCalculatorFilter: CalculatorKey = "priority";
  const lab = useMemo(
    () => buildLabValueIndex(parameters, values, results, parameterUnits),
    [parameters, values, results, parameterUnits]
  );
  const hasLabData = labHasUsefulSoilData(lab);
  const suggestions = getSuggestions(lab, results, t, sampleType);

  return (
    <CalculatorMemoryProvider sampleType={sampleType} lab={lab}>
      <CalculatorHubBody
        t={t}
        language={language}
        lab={lab}
        results={results}
        sampleType={sampleType}
        selectedCropName={selectedCropName}
        selectedCountry={selectedCountry}
        reportDate={reportDate}
        hasLabData={hasLabData}
        suggestions={suggestions}
        goToValues={goToValues}
        onOpenCalendar={onOpenCalendar}
        onBack={onBack}
        onOutputsChange={onOutputsChange}
        onReportExtrasChange={onReportExtrasChange}
        onFertilizerPlanChange={onFertilizerPlanChange}
        onExportPdf={onExportPdf}
        exportingPdf={exportingPdf}
        exportPdfLabel={exportPdfLabel}
        defaultCalculatorFilter={defaultCalculatorFilter}
        showCalculatorFormulas={showCalculatorFormulas}
        userId={userId}
        farmName={farmName}
        initialActiveKey={initialActiveKey}
        onInitialActiveKeyConsumed={onInitialActiveKeyConsumed}
      />
    </CalculatorMemoryProvider>
  );
}

function CalculatorHubBody({
  t,
  language,
  lab,
  results,
  sampleType,
  selectedCropName,
  selectedCountry,
  reportDate = null,
  hasLabData,
  suggestions,
  goToValues,
  onOpenCalendar,
  onBack,
  onOutputsChange,
  onReportExtrasChange,
  onFertilizerPlanChange,
  onExportPdf,
  exportingPdf,
  exportPdfLabel,
  defaultCalculatorFilter,
  showCalculatorFormulas = false,
  userId = null,
  farmName = null,
  initialActiveKey = null,
  onInitialActiveKeyConsumed,
}: {
  t: Record<string, string>;
  language: Language;
  lab: Map<string, CalculatorValue>;
  results: ResultLite[];
  sampleType: "soil" | "foliar";
  selectedCropName?: string | null;
  selectedCountry?: string | null;
  reportDate?: string | null;
  hasLabData: boolean;
  suggestions: Array<{ key: CalculatorKey; title: string; desc: string }>;
  goToValues?: () => void;
  onOpenCalendar?: () => void;
  onBack?: () => void;
  onOutputsChange?: (packs: CalculatorOutputPack[]) => void;
  onReportExtrasChange?: (extras: {
    planRecommendations: string[];
    fertilizerProducts: PdfFertilizerProduct[];
    fertilizerApplyLines: string[];
  }) => void;
  onFertilizerPlanChange?: (plan: FertilizerPlanSnapshot) => void;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
  exportPdfLabel?: string;
  defaultCalculatorFilter: CalculatorKey;
  showCalculatorFormulas?: boolean;
  userId?: string | null;
  farmName?: string | null;
  initialActiveKey?: string | null;
  onInitialActiveKeyConsumed?: () => void;
}) {
  const { importFromValues, valuesOutOfSync } = useCalculatorMemory();
  const sharedCations = useSharedCationInputs(lab);
  const effectiveLab = useMemo(
    () => enrichLabWithResolvedCations(lab, sharedCations),
    [lab, sharedCations]
  );
  const [importMessage, setImportMessage] = useState("");
  // Explore is always the landing mode; Guided is opt-in via the toggle (soil only).
  const [hubMode, setHubMode] = useState<HubMode>("explorer");
  const calculatorTabs = useMemo(
    () => visibleCalculatorTabs(sampleType),
    [sampleType]
  );
  const guidedSteps = useMemo(() => {
    const visibleKeys = new Set(calculatorTabs.map((tab) => tab.key));
    return GUIDED_STEPS[sampleType].filter((key) => visibleKeys.has(key));
  }, [sampleType, calculatorTabs]);
  const showHubModeToggle = sampleType === "soil";
  const effectiveHubMode: HubMode = showHubModeToggle ? hubMode : "explorer";

  useEffect(() => {
    if (sampleType === "foliar" && hubMode !== "explorer") {
      setHubMode("explorer");
    }
  }, [sampleType, hubMode]);
  const [active, setActive] = useState<CalculatorKey>(defaultCalculatorFilter);
  const [browseLayout, setBrowseLayout] = useViewLayoutPreference("calculator-hub");
  const fieldsLayout = browseLayout;

  // Drop removed tabs if a stale selection lingered.
  useEffect(() => {
    if (!calculatorTabs.some((tab) => tab.key === active)) {
      setActive(
        effectiveHubMode === "guided" && guidedSteps[0]
          ? guidedSteps[0]
          : defaultCalculatorFilter
      );
    }
  }, [active, calculatorTabs, defaultCalculatorFilter, guidedSteps, effectiveHubMode]);

  useEffect(() => {
    if (!initialActiveKey) return;
    const key = initialActiveKey as CalculatorKey;
    if (!calculatorTabs.some((tab) => tab.key === key)) {
      onInitialActiveKeyConsumed?.();
      return;
    }
    setHubMode("explorer");
    setActive(key);
    onInitialActiveKeyConsumed?.();
  }, [initialActiveKey, calculatorTabs, onInitialActiveKeyConsumed]);

  const [guidedIndex, setGuidedIndex] = useState(0);
  const [fertilizerPlan, setFertilizerPlan] = useState<FertilizerPlanSnapshot>({
    doses: [],
    areaHa: 0,
    irrigationSystem: "aspersion_pivote",
    irrigationTable: TABLE_7_IRRIGATION_EFFICIENCY,
    recommendations: [],
  });
  const [fertilizerProducts, setFertilizerProducts] = useState<PdfFertilizerProduct[]>(
    []
  );
  const [fertilizerApplyLines, setFertilizerApplyLines] = useState<string[]>([]);
  const costFromPlannerRef = useRef(false);
  const fertilizerPlanRef = useRef(fertilizerPlan);
  fertilizerPlanRef.current = fertilizerPlan;

  const handleDosePlanChange = useCallback(
    (plan: FertilizerPlanSnapshot) => {
      if (sameFertilizerPlan(fertilizerPlanRef.current, plan)) return;
      setFertilizerPlan(plan);
      onFertilizerPlanChange?.(plan);
    },
    [onFertilizerPlanChange]
  );

  function switchHubMode(mode: HubMode) {
    setHubMode(mode);
    if (mode === "guided" && guidedSteps.length > 0) {
      setGuidedIndex(0);
      setActive(guidedSteps[0]);
    } else if (mode === "explorer") {
      setActive(defaultCalculatorFilter);
    }
  }

  function goToGuidedStep(index: number) {
    if (index < 0 || index >= guidedSteps.length) return;
    setGuidedIndex(index);
    setActive(guidedSteps[index]);
  }

  const [calculatorOutputs, setCalculatorOutputs] = useState<Record<string, CalculationOutput[]>>({});

  const canExportReport = useMemo(() => {
    if (hasLabData) return true;
    if (Object.values(calculatorOutputs).some((rows) => rows.length > 0)) return true;
    if (fertilizerProducts.length > 0) return true;
    if (hasActiveFertilizerDoses(fertilizerPlan.doses)) return true;
    return false;
  }, [calculatorOutputs, fertilizerPlan.doses, fertilizerProducts.length, hasLabData]);

  const reportOutputs = useCallback((key: string, outputs: CalculationOutput[]) => {
    const cleanOutputs = outputs.filter(Boolean);
    setCalculatorOutputs((previous) => {
      const current = previous[key] || [];
      if (sameOutputs(current, cleanOutputs)) return previous;
      return {
        ...previous,
        [key]: cleanOutputs,
      };
    });
  }, []);

  const handleCostReportData = useCallback(
    (payload: {
      products: PdfFertilizerProduct[];
      outputs: CalculationOutput[];
      applyLines: string[];
    }) => {
      costFromPlannerRef.current = payload.products.length > 0;
      setFertilizerProducts(payload.products);
      setFertilizerApplyLines(payload.applyLines);
      setCalculatorOutputs((previous) => {
        const nextOutputs = payload.outputs.filter(Boolean);
        const current = previous.fertilizerCost || [];
        if (sameOutputs(current, nextOutputs)) return previous;
        if (nextOutputs.length === 0) {
          const { fertilizerCost: _removed, ...rest } = previous;
          return rest;
        }
        return { ...previous, fertilizerCost: nextOutputs };
      });
    },
    []
  );

  const onOutputsChangeRef = useRef(onOutputsChange);
  onOutputsChangeRef.current = onOutputsChange;
  const calculatorOutputsRef = useRef(calculatorOutputs);
  calculatorOutputsRef.current = calculatorOutputs;
  const calculatorOutputsSignature = useMemo(
    () => calculationOutputsMapSignature(calculatorOutputs),
    [calculatorOutputs]
  );

  useEffect(() => {
    if (!onOutputsChangeRef.current) return;
    const entries = Object.entries(calculatorOutputsRef.current);
    // Skip the empty mount flush so navigating away/back to Calculators
    // does not wipe packs already held by the parent page.
    if (entries.length === 0) return;
    onOutputsChangeRef.current(
      entries.map(([id, outputs]) => ({
        id,
        label: String(t[id as keyof typeof t] || id),
        outputs: outputs.map((output) => translateCalculationOutput(output, t)),
      }))
    );
  }, [calculatorOutputsSignature, t]);

  // Auto-build recommended products + prices when doses exist but cost planner
  // was never opened (or was cleared).
  useEffect(() => {
    if (!hasActiveFertilizerDoses(fertilizerPlan.doses)) {
      costFromPlannerRef.current = false;
      setFertilizerProducts([]);
      setFertilizerApplyLines([]);
      setCalculatorOutputs((previous) => {
        if (!previous.fertilizerCost) return previous;
        const { fertilizerCost: _removed, ...rest } = previous;
        return rest;
      });
      return;
    }
    if (costFromPlannerRef.current) return;

    const controller = new AbortController();
    void buildRecommendedFertilizerReport({
      doses: fertilizerPlan.doses,
      country: selectedCountry,
      irrigationSystem: fertilizerPlan.irrigationSystem,
      irrigationTable: fertilizerPlan.irrigationTable,
      t,
      signal: controller.signal,
    })
      .then((result) => {
        if (controller.signal.aborted || costFromPlannerRef.current) return;
        setFertilizerProducts(result.products);
        setFertilizerApplyLines(result.applyLines);
        setCalculatorOutputs((previous) => {
          const nextOutputs = result.outputs.filter(Boolean);
          const current = previous.fertilizerCost || [];
          if (sameOutputs(current, nextOutputs)) return previous;
          if (nextOutputs.length === 0) {
            const { fertilizerCost: _removed, ...rest } = previous;
            return rest;
          }
          return { ...previous, fertilizerCost: nextOutputs };
        });
      })
      .catch(() => {
        /* offline / API — products stay empty until cost planner opens */
      });

    return () => controller.abort();
  }, [
    fertilizerPlan.doses,
    fertilizerPlan.irrigationSystem,
    fertilizerPlan.irrigationTable,
    selectedCountry,
    t,
  ]);

  useEffect(() => {
    if (!onReportExtrasChange) return;
    onReportExtrasChange({
      planRecommendations: fertilizerPlan.recommendations,
      fertilizerProducts,
      fertilizerApplyLines,
    });
  }, [
    fertilizerApplyLines,
    fertilizerPlan.recommendations,
    fertilizerProducts,
    onReportExtrasChange,
  ]);

  function handleImportFromValues() {
    const { importedCount } = importFromValues();
    setImportMessage(
      importedCount > 0
        ? formatMessage(t.importFromValuesDone || "Imported {count} values from Values.", {
            count: importedCount,
          })
        : t.importFromValuesEmpty || "No Values data to import yet. Enter values first."
    );
  }

  useEffect(() => {
    if (!importMessage) return;
    const timer = window.setTimeout(() => setImportMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [importMessage]);

  // Keep calculators in sync with the Values page: whenever lab values change,
  // they automatically replace remembered calculator inputs (no manual refresh needed).
  useEffect(() => {
    if (!hasLabData) return;
    if (!valuesOutOfSync) return;
    importFromValues();
  }, [hasLabData, valuesOutOfSync, importFromValues]);

  return (
    <section className="animate-slide-up">
      <div className="calculator-hub-panel values-screen-panel--open px-0 pb-8 pt-0">
        {/* Page header — horizontal inset comes from .app-main-shell */}
        <div className="calculator-hub-chrome flex flex-col gap-2 pb-3 pt-1">
          <div className="flex items-center gap-2 min-w-0">
            <BackButton
              variant="icon"
              onClick={() => {
                if (active !== defaultCalculatorFilter) {
                  setActive(defaultCalculatorFilter);
                  return;
                }
                onBack?.();
              }}
              label={active !== defaultCalculatorFilter ? t.backToCalculators : t.back}
            />
            <h1 className="min-w-0 flex-1 truncate text-lg font-bold dark-text-primary">
              {t.title}
            </h1>
            {onExportPdf && canExportReport ? (
              <ExportPdfIconButton
                onClick={onExportPdf}
                busy={exportingPdf}
                label={t.hubModeGenerateReport || exportPdfLabel || "Report"}
              />
            ) : null}
            <ViewLayoutToggle
              value={browseLayout}
              onChange={setBrowseLayout}
              listLabel={t.viewLayoutList}
              gridLabel={t.viewLayoutGrid}
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            {showHubModeToggle ? (
              <div className="hub-mode-toggle inline-flex shrink-0" role="tablist" aria-label={t.hubModeLabel}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={hubMode === "explorer"}
                  onClick={() => switchHubMode("explorer")}
                  className={`hub-mode-toggle__btn ${hubMode === "explorer" ? "hub-mode-toggle__btn--active" : ""}`}
                >
                  {t.hubModeExplorer}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={hubMode === "guided"}
                  onClick={() => switchHubMode("guided")}
                  className={`hub-mode-toggle__btn ${hubMode === "guided" ? "hub-mode-toggle__btn--active" : ""}`}
                >
                  {t.hubModeGuided}
                </button>
              </div>
            ) : (
              <span />
            )}
            <div className="calculator-hub-actions">
              <button
                type="button"
                onClick={handleImportFromValues}
                className={`calculator-hub-action calculator-hub-action--icon ${
                  valuesOutOfSync ? "calculator-hub-action--stale" : ""
                }`}
                title={t.importFromValuesHint}
                aria-label={t.importFromValues || "Refresh"}
              >
                <RefreshCcw size={15} aria-hidden />
                {valuesOutOfSync ? (
                  <span className="calculator-hub-action__dot" aria-hidden />
                ) : null}
              </button>
              {!hasLabData && goToValues ? (
                <button
                  type="button"
                  onClick={goToValues}
                  className="calculator-hub-action calculator-hub-action--secondary"
                >
                  {t.openValues}
                </button>
              ) : null}
            </div>
          </div>
          {importMessage ? (
            <p className="calculator-hub-status calculator-hub-status--success" role="status">
              {importMessage}
            </p>
          ) : null}
        </div>

        {!hasLabData ? (
          <div className="mb-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 dark:border-amber-900/40 dark:bg-amber-950/30" role="status">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {t.labDataRequiredTitle}
            </p>
            {goToValues ? (
              <button
                type="button"
                onClick={goToValues}
                className="calculator-hub-action calculator-hub-action--secondary mt-2"
              >
                {t.openValues}
              </button>
            ) : null}
          </div>
        ) : null}

        <CalculatorFieldsLayoutContext.Provider value={fieldsLayout}>
        {effectiveHubMode === "guided" && guidedSteps.length > 0 ? (
          <div className="calc-guided-stepper calculator-hub-nav pb-4">
            <div className="calc-guided-stepper__track">
              {guidedSteps.map((key, index) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => goToGuidedStep(index)}
                  className={`calc-guided-stepper__step ${
                    index === guidedIndex ? "calc-guided-stepper__step--active" : ""
                  } ${index < guidedIndex ? "calc-guided-stepper__step--done" : ""}`}
                >
                  <span className="calc-guided-stepper__index">{index + 1}</span>
                  <span className="calc-guided-stepper__label">{t[key]}</span>
                </button>
              ))}
            </div>
            <div className="calc-guided-stepper__nav mt-2 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => goToGuidedStep(guidedIndex - 1)}
                disabled={guidedIndex === 0}
                className="calc-guided-stepper__nav-btn"
              >
                {t.hubModePrevStep}
              </button>
              <span className="text-xs font-semibold text-slate-500">
                {formatMessage(t.hubModeStepOf, {
                  current: guidedIndex + 1,
                  total: guidedSteps.length,
                })}
              </span>
              {guidedIndex >= guidedSteps.length - 1 ? (
                <div className="calc-guided-finish flex flex-wrap items-center justify-end gap-1.5">
                  {onOpenCalendar ? (
                    <button
                      type="button"
                      onClick={onOpenCalendar}
                      className="calc-guided-stepper__nav-btn inline-flex items-center gap-1"
                    >
                      <CalendarDays size={13} aria-hidden />
                      {t.hubModeGoCalendar || "Calendar"}
                    </button>
                  ) : null}
                  {onExportPdf ? (
                    <button
                      type="button"
                      onClick={onExportPdf}
                      disabled={exportingPdf}
                      className="calc-guided-stepper__nav-btn calc-guided-stepper__nav-btn--primary inline-flex items-center gap-1"
                    >
                      <FileText size={13} aria-hidden />
                      {t.hubModeGenerateReport || exportPdfLabel || "Report"}
                    </button>
                  ) : null}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => goToGuidedStep(guidedIndex + 1)}
                  className="calc-guided-stepper__nav-btn"
                >
                  {t.hubModeNextStep}
                </button>
              )}
            </div>
          </div>
        ) : null}
        {effectiveHubMode === "explorer" ? (
          <div className="calculator-hub-tabs calculator-hub-nav overflow-x-auto scrollbar-none pb-4">
            <div className="flex w-max min-w-full gap-2">
              {calculatorTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActive(tab.key)}
                  className={`calculator-hub-tab ${
                    active === tab.key ? "calculator-hub-tab--active" : ""
                  }`}
                >
                  {tab.icon}
                  {t[tab.key]}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {active === "priority" ? (
          <PriorityCalculators t={t} suggestions={suggestions} setActive={setActive} />
        ) : null}
        {active === "cic" ? (
          <CicCalculator
            t={t}
            lab={effectiveLab}
            sampleType={sampleType}
            onOutputsChange={(outputs) => reportOutputs("cic", outputs)}
          />
        ) : null}
        {active === "amendment" ? (
          <PhAmendmentCalculator
            t={t}
            lab={effectiveLab}
            selectedCropName={selectedCropName}
            showCalculatorFormulas={showCalculatorFormulas}
            onOutputsChange={(outputs) => reportOutputs("amendment", outputs)}
          />
        ) : null}
        {active === "fertilizer" ? (
          sampleType === "soil" ? (
            <FertilizerPlanCalculator
              t={t}
              lab={effectiveLab}
              selectedCropName={selectedCropName}
              layout={fieldsLayout}
              showCalculatorFormulas={showCalculatorFormulas}
              onOutputsChange={(outputs) => reportOutputs("fertilizer", outputs)}
              onDosePlanChange={handleDosePlanChange}
              onOpenCostPage={() => setActive("fertilizerCost")}
            />
          ) : (
            <CalculatorPage>
              <p className="calc-surface p-4 text-sm font-semibold text-yellow-900">
                {t.fertilizerSoilOnly || "The nutritional plan is available for soil analyses."}
              </p>
            </CalculatorPage>
          )
        ) : null}
        {active === "fertilizerCost" ? (
          sampleType === "soil" ? (
            <CalculatorPage>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActive("fertilizer")}
                  className="calc-guided-stepper__nav-btn text-xs"
                >
                  {t.fertilizerCostBack || "Back to nutritional plan"}
                </button>
              </div>
              {hasActiveFertilizerDoses(fertilizerPlan.doses) ? (
                <div className="fertilizer-cost-page">
                  <FertilizerProductPlanner
                    doses={fertilizerPlan.doses}
                    areaHa={fertilizerPlan.areaHa}
                    country={selectedCountry}
                    irrigationSystem={fertilizerPlan.irrigationSystem}
                    irrigationTable={fertilizerPlan.irrigationTable}
                    t={t}
                    showAsPage
                    userId={userId}
                    farmName={farmName}
                    onReportData={handleCostReportData}
                  />
                </div>
              ) : (
                <div className="calc-surface p-4 space-y-3">
                  <p className="text-sm text-slate-600 dark-text-primary">
                    {t.fertilizerCostNeedPlan ||
                      "Complete the nutritional plan, or switch it to Doses only and enter known rates, to estimate product costs."}
                  </p>
                  <p className="text-xs text-slate-500 dark-text-primary">
                    {t.fertilizerPlanKnownDoseHint ||
                      "Enter the nutrient rates you already know (kg/ha). Leave unused nutrients at 0."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActive("fertilizer")}
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-800"
                  >
                    <Leaf size={14} aria-hidden />
                    {t.fertilizerCostOpenPlan || "Open nutritional plan"}
                  </button>
                </div>
              )}
            </CalculatorPage>
          ) : (
            <CalculatorPage>
              <p className="calc-surface p-4 text-sm font-semibold text-yellow-900">
                {t.fertilizerSoilOnly || "The nutritional plan is available for soil analyses."}
              </p>
            </CalculatorPage>
          )
        ) : null}
        {active === "fertilizerFormulation" ? (
          sampleType === "soil" ? (
            <CalculatorPage>
              <FertilizerFormulationBuilder t={t} country={selectedCountry} />
            </CalculatorPage>
          ) : (
            <CalculatorPage>
              <p className="calc-surface p-4 text-sm font-semibold text-yellow-900">
                {t.fertilizerSoilOnly ||
                  "The nutritional plan is available for soil analyses."}
              </p>
            </CalculatorPage>
          )
        ) : null}
        {active === "dop" ? (
          sampleType === "foliar" ? (
            <DopCalculator
              t={t}
              lab={effectiveLab}
              results={results}
              selectedCropName={selectedCropName}
              reportDate={reportDate}
              onOutputsChange={(outputs) => reportOutputs("dop", outputs)}
            />
          ) : (
            <CalculatorPage>
              <p className="calc-surface p-4 text-sm font-semibold text-yellow-900">{t.dopFoliarOnly}</p>
            </CalculatorPage>
          )
        ) : null}
        {active === "uptake" ? (
          <CropUptakeGuide t={t} language={language} selectedCropName={selectedCropName} />
        ) : null}
        {active === "salinity" ? (
          <SalinityCalculator
            t={t}
            lab={effectiveLab}
            showCalculatorFormulas={showCalculatorFormulas}
            onOutputsChange={(outputs) => reportOutputs("salinity", outputs)}
          />
        ) : null}
        {active === "graphs" ? <NutrientGraphs t={t} lab={effectiveLab} /> : null}
        </CalculatorFieldsLayoutContext.Provider>
      </div>
    </section>
  );
}

function CalcActionCard({
  icon,
  title,
  desc,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="calculator-action-card">
      <span className="calculator-action-card__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="calculator-action-card__copy">
        <span className="calculator-action-card__title">{title}</span>
        {desc ? (
          <span className="calculator-action-card__desc">{desc}</span>
        ) : null}
      </span>
    </button>
  );
}

const tabIconByKey = Object.fromEntries(tabs.map((tab) => [tab.key, tab.icon])) as Record<
  CalculatorKey,
  ReactNode
>;

function CalculatorPage({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`calc-page calculator-hub-page space-y-4 ${className}`.trim()}>
      {children}
    </div>
  );
}

function PriorityCalculators({
  t,
  suggestions,
  setActive,
}: {
  t: Record<string, string>;
  suggestions: Array<{ key: CalculatorKey; title: string; desc: string }>;
  setActive: (key: CalculatorKey) => void;
}) {
  if (suggestions.length === 0) {
    return (
      <CalculatorPage>
        <p className="calc-surface p-4 text-sm text-slate-600">{t.noData}</p>
      </CalculatorPage>
    );
  }

  return (
    <CalculatorPage>
      <div className="calculator-actions-grid">
        {suggestions.map((item) => (
          <CalcActionCard
            key={`${item.key}-${item.title}`}
            icon={tabIconByKey[item.key]}
            title={translateCalculatorText(item.title, t)}
            desc={translateCalculatorText(item.desc, t)}
            onClick={() => setActive(item.key)}
          />
        ))}
      </div>
    </CalculatorPage>
  );
}

function CicCalculator({
  t,
  lab,
  sampleType,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  sampleType: "soil" | "foliar";
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const { reference } = useSoilFertilityReference();
  const shared = useSharedCationInputs(lab);
  const acidityFallback = shared.hAl || shared.aluminum;

  const [cec, setCec] = useMemoryNumber("cic", "cec", shared.cecReported || 0);
  const [ca, setCa] = useMemoryNumber("cic", "ca", shared.ca);
  const [mg, setMg] = useMemoryNumber("cic", "mg", shared.mg);
  const [k, setK] = useMemoryNumber("cic", "k", shared.k);
  const [na, setNa] = useMemoryNumber("cic", "na", shared.na);
  const [hAl, setHAl] = useMemoryNumber("cic", "hAl", acidityFallback);
  const [relationFilter, setRelationFilter] = useState<BaseRelationKey>("all");

  const acidityTerm = useMemo(
    () =>
      getCicAcidityContribution({
        hAl,
        aluminum: shared.aluminum,
        aluminumUnit: shared.aluminumUnit,
      }),
    [hAl, shared.aluminum, shared.aluminumUnit]
  );

  const estimatedCec = useMemo(() => {
    if (shared.cecReported > 0) return shared.cecReported;
    const sum =
      (Number.isFinite(ca) && ca > 0 ? ca : 0) +
      (Number.isFinite(mg) && mg > 0 ? mg : 0) +
      (Number.isFinite(k) && k > 0 ? k : 0) +
      (Number.isFinite(na) && na > 0 ? na : 0) +
      acidityTerm;
    return sum > 0 ? Math.round(sum * 100) / 100 : shared.estimatedCec;
  }, [ca, mg, k, na, acidityTerm, shared.cecReported, shared.estimatedCec]);

  const cecIsEstimated = !(Number.isFinite(cec) && cec > 0) && estimatedCec > 0;

  const baseResult = useMemo(
    () =>
      calculateBaseSaturation({
        cec,
        ca,
        mg,
        k,
        na,
        hAl,
        aluminum: shared.aluminum,
        aluminumUnit: shared.aluminumUnit,
      }),
    [cec, ca, mg, k, na, hAl, shared.aluminum, shared.aluminumUnit]
  );

  const cnRatio = useMemo(
    () =>
      calculateCNRatio(
        lab.get("organic_carbon")?.value || lab.get("organic_matter")?.value || 0,
        lab.get("nitrogen")?.value || 0
      ),
    [lab]
  );

  const outputs = useMemo(() => {
    const fromBases = baseResult ? buildBaseSaturationOutputs(baseResult, relationFilter) : [];
    return cnRatio ? [...fromBases, cnRatio] : fromBases;
  }, [baseResult, relationFilter, cnRatio]);

  useEmitCalculatorOutputs(onOutputsChange, outputs);

  if (sampleType !== "soil") {
    return (
      <CalculatorPage>
        <p className="calc-surface p-4 text-sm font-semibold text-yellow-900">{t.cicSoilOnly}</p>
      </CalculatorPage>
    );
  }

  const relationOptions: Array<[BaseRelationKey, string]> = [
    ["all", t.cicMainResults || "Main results"],
    ["ca_mg", "Ca/Mg"],
    ["mg_k", "Mg/K"],
    ["ca_k", "Ca/K"],
    ["k_na", "K/Na"],
    ["ca_na", "Ca/Na"],
  ];

  const selectedRatio =
    relationFilter !== "all" && baseResult
      ? {
          key: relationFilter,
          label: relationOptions.find(([key]) => key === relationFilter)?.[1] || relationFilter,
          value: baseResult.relations[relationFilter],
          interpretation: interpretCationRatio(
            relationFilter,
            baseResult.relations[relationFilter],
            reference.cicRatioRanges
          ),
        }
      : null;

  return (
    <CalculatorPage>
      <div className="calc-page__params calc-surface space-y-3 p-4">
        <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
          {t.cicRequirementTitle || "CIC, bases & ratios"}
        </h2>
        <CalculatorFormFields>
          <NumberField
            label={t.cicLabel || "CIC / CICe"}
            value={cec}
            onChange={setCec}
            preserveCase
            placeholder={
              estimatedCec > 0
                ? `${estimatedCec}${cecIsEstimated ? ` (${t.cicEstimated || "est."})` : ""}`
                : t.cicAutoPlaceholder || "Auto if blank"
            }
          />
          <NumberField
            label={`${t.cicFieldCa || "Ca"} (${t.current})`}
            value={ca}
            onChange={setCa}
            preserveCase
          />
          <NumberField
            label={`${t.cicFieldMg || "Mg"} (${t.current})`}
            value={mg}
            onChange={setMg}
            preserveCase
          />
          <NumberField
            label={`${t.cicFieldK || "K"} (${t.current})`}
            value={k}
            onChange={setK}
            preserveCase
          />
          <NumberField
            label={t.cicFieldNa || "Sodium (Na)"}
            value={na}
            onChange={setNa}
            preserveCase
          />
          <NumberField
            label={t.cicFieldHal || "Extractable acidity (H+Al)"}
            value={hAl}
            onChange={setHAl}
            preserveCase
            placeholder={
              acidityTerm > 0 && !(Number.isFinite(hAl) && hAl > 0)
                ? `${acidityTerm} (${t.cicEstimated || "est."})`
                : undefined
            }
          />
        </CalculatorFormFields>
        <p className="text-xs leading-relaxed text-slate-600 dark:text-slate-300">
          {cecIsEstimated
            ? t.cicAutoHelp ||
              "CIC not reported — CICe is estimated as Ca + Mg + K + Na + (H+Al or extractable Al when reported)."
            : t.cicHelp ||
              "Enter exchangeable bases and CIC in consistent units (cmol(+)/kg or meq/100 g). If CIC is blank, it is calculated automatically including extractable acidity or Al when reported."}
        </p>
      </div>

      <div className="overflow-x-auto scrollbar-none">
        <div className="flex w-max min-w-full gap-1.5">
          {relationOptions.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setRelationFilter(key)}
              className={`calc-relation-chip shrink-0 ${
                relationFilter === key ? "calc-relation-chip--active" : ""
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {selectedRatio ? (
        <CicRatioHighlightCard ratio={selectedRatio} t={t} ranges={reference.cicRatioRanges} />
      ) : null}

      {baseResult && relationFilter === "all" ? (
        <CicResultsPanel
          baseResult={baseResult}
          t={t}
          bands={reference.cicSaturationBands}
          cecEstimated={cecIsEstimated}
        />
      ) : null}

      {!baseResult ? (
        <p className="calc-cic-result calc-cic-result--empty calc-surface p-4 text-sm text-slate-600">
          {t.noData}
        </p>
      ) : null}

      {cnRatio && relationFilter === "all" ? (
        <div className="calc-surface p-4">
          <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.cicOtherRatios || "Other ratios"}
          </h3>
          <div className="mt-3">
            <CicResultCard
              label={cnRatio.label}
              value={cnRatio.value}
              unit={cnRatio.unit}
              band="optimal"
              bandLabel=""
              interpretation={cnRatio.notes[0] || ""}
            />
          </div>
        </div>
      ) : null}
    </CalculatorPage>
  );
}

function CicRatioHighlightCard({
  ratio,
  t,
  ranges,
}: {
  ratio: {
    key: Exclude<BaseRelationKey, "all">;
    label: string;
    value: number | null;
    interpretation: ReturnType<typeof interpretCationRatio>;
  };
  t: Record<string, string>;
  ranges: CicRatioRangeTable;
}) {
  const range = ranges[ratio.key];
  const bandKey = ratioBandLabelKey(ratio.interpretation.band);
  const message = t[ratio.interpretation.messageKey] || ratio.interpretation.messageKey;

  return (
    <article className={`calc-cic-ratio-highlight calc-cic-ratio-highlight--${ratio.interpretation.band}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="calc-cic-result__label">{ratio.label}</p>
          <p className="calc-cic-result__value">
            {ratio.value ?? "—"} <span className="calc-cic-result__unit">:1</span>
          </p>
        </div>
        <span className={`calc-cic-band calc-cic-band--${ratio.interpretation.band}`}>
          {t[bandKey] || bandKey}
        </span>
      </div>
      <p className="calc-cic-result__range">
        {t.cicTargetRange || "Target range"}: {range.optimalMin}–{range.optimalMax}
      </p>
      <p className="calc-cic-result__interpretation">{message}</p>
    </article>
  );
}

function CicResultsPanel({
  baseResult,
  t,
  bands,
  cecEstimated,
}: {
  baseResult: BaseSaturationResult;
  t: Record<string, string>;
  bands: CicSaturationBandTable;
  cecEstimated?: boolean;
}) {
  const layout = useContext(CalculatorFieldsLayoutContext);

  const saturationRows: Array<{
    key: string;
    label: string;
    value: number;
    cation?: "ca" | "mg" | "k" | "na";
  }> = [
    { key: "ca", label: t.cicCaSaturation || "Ca saturation", value: baseResult.caPercent, cation: "ca" },
    { key: "mg", label: t.cicMgSaturation || "Mg saturation", value: baseResult.mgPercent, cation: "mg" },
    { key: "k", label: t.cicKSaturation || "K saturation", value: baseResult.kPercent, cation: "k" },
    { key: "na", label: t.cicNaSaturation || "Na saturation", value: baseResult.naPercent, cation: "na" },
  ];

  const vBand: CicRatioBand =
    baseResult.totalBasePercent >= 75 && baseResult.totalBasePercent <= 80
      ? "optimal"
      : baseResult.totalBasePercent < 75
        ? "low"
        : "high";
  const vSeverity: CicSeverity =
    baseResult.totalBasePercent < 60
      ? "critical"
      : baseResult.totalBasePercent < 75
        ? "strong"
        : baseResult.totalBasePercent > 90
          ? "critical"
          : baseResult.totalBasePercent > 80
            ? "mild"
            : "ok";
  const vMessageKey =
    baseResult.totalBasePercent < 75
      ? "cicVPercentLow"
      : baseResult.totalBasePercent > 80
        ? "cicVPercentHigh"
        : "cicVPercentAdequate";

  const aciditySeverity = aciditySaturationSeverity(baseResult.hAlPercent);
  const acidityBand: CicRatioBand =
    aciditySeverity === "ok" ? "optimal" : aciditySeverity === "unknown" ? "unknown" : "high";

  return (
    <div className={`calc-cic-results calc-cic-results--${layout}`}>
      <CicResultCard
        label={t.cicCiceResult || "CICe"}
        value={baseResult.cec}
        unit="cmol(+)/kg"
        band="optimal"
        severity="ok"
        bandLabel={
          cecEstimated
            ? t.cicEstimated || "est."
            : t.cicBandOptimal || "OK"
        }
        interpretation={
          cecEstimated
            ? t.cicCiceEstimatedNote || "Estimated from bases + acidity when CIC was not reported."
            : t.cicCiceReportedNote || "Effective cation exchange capacity used for saturations."
        }
      />
      <CicResultCard
        label={t.cicSumBases || "Sum of bases"}
        value={baseResult.sumBases}
        unit="cmol(+)/kg"
        band="optimal"
        severity="ok"
        bandLabel="Ca+Mg+K+Na"
        interpretation={t.cicSumBasesNote || "Exchangeable bases contributing to CICe."}
        rangeNote={
          baseResult.acidity > 0
            ? `${t.cicAcidityAmount || "Acidity"}: ${baseResult.acidity} cmol(+)/kg`
            : undefined
        }
      />
      <CicResultCard
        label={t.cicTotalBases || "Total base saturation (V%)"}
        value={baseResult.totalBasePercent}
        unit="%"
        band={vBand}
        severity={vSeverity}
        bandLabel={t[ratioBandLabelKey(vBand)] || vBand}
        interpretation={t[vMessageKey] || vMessageKey}
        rangeNote={t.cicVPercentTarget || "75–80% for tropical crops"}
      />

      {saturationRows.map((row) => {
        const sat = interpretCationSaturation(row.cation!, row.value, bands);
        const bandForUi: CicRatioBand =
          sat.band === "adequate"
            ? "optimal"
            : sat.band === "very_low" || sat.band === "low" || sat.band === "moderately_low"
              ? "low"
              : "high";

        return (
          <CicResultCard
            key={row.key}
            label={row.label}
            value={row.value}
            unit="%"
            band={bandForUi}
            severity={saturationSeverity(sat.band)}
            bandLabel={t[saturationBandMessageKey(sat.band)] || t[ratioBandLabelKey(bandForUi)] || sat.band}
            interpretation={t[saturationBandMessageKey(sat.band)] || saturationBandMessageKey(sat.band)}
            rangeNote={`${t.cicTableBand || "Table band"}: ${sat.rangeLabel}`}
          />
        );
      })}

      <CicResultCard
        label={t.cicAciditySaturation || "Acidity saturation (H+Al)"}
        value={baseResult.hAlPercent}
        unit="%"
        band={acidityBand}
        severity={aciditySeverity}
        bandLabel={
          aciditySeverity === "ok"
            ? t.cicBandOptimal || "OK"
            : aciditySeverity === "mild"
              ? t.cicSatModeratelyHigh || "Moderate"
              : aciditySeverity === "strong"
                ? t.cicSatHigh || "High"
                : aciditySeverity === "critical"
                  ? t.cicSatVeryHigh || "Very high"
                  : "—"
        }
        interpretation={
          t.cicAciditySaturationNote ||
          "Share of CICe occupied by exchangeable acidity — higher values increase liming need."
        }
        rangeNote={
          baseResult.acidity > 0
            ? `${baseResult.acidity} cmol(+)/kg`
            : t.cicAcidityNone || "No exchangeable acidity reported"
        }
      />
    </div>
  );
}

function aciditySaturationSeverity(percent: number): CicSeverity {
  if (!(percent > 0)) return "ok";
  if (percent < 10) return "mild";
  if (percent < 20) return "strong";
  return "critical";
}

function CicResultCard({
  label,
  value,
  unit,
  band,
  severity,
  bandLabel,
  interpretation,
  rangeNote,
}: {
  label: string;
  value: number;
  unit: string;
  band: CicRatioBand;
  severity?: CicSeverity;
  bandLabel: string;
  interpretation: string;
  rangeNote?: string;
}) {
  const tone = severity || ratioSeverity(band);
  return (
    <article className={`calc-cic-result calc-cic-result--${band} calc-cic-result--sev-${tone}`}>
      <div className="calc-cic-result__head">
        <p className="calc-cic-result__label">{label}</p>
        {bandLabel ? (
          <span className={`calc-cic-band calc-cic-band--${band} calc-cic-band--sev-${tone}`}>
            {bandLabel}
          </span>
        ) : null}
      </div>
      <p className="calc-cic-result__value">
        {value} <span className="calc-cic-result__unit">{unit}</span>
      </p>
      {rangeNote ? <p className="calc-cic-result__range">{rangeNote}</p> : null}
      {interpretation ? <p className="calc-cic-result__interpretation">{interpretation}</p> : null}
    </article>
  );
}

type CicSeverity = "critical" | "strong" | "mild" | "ok" | "unknown";

function saturationSeverity(band: CicSaturationBand): CicSeverity {
  switch (band) {
    case "very_low":
    case "very_high":
      return "critical";
    case "low":
    case "high":
      return "strong";
    case "moderately_low":
    case "moderately_high":
      return "mild";
    case "adequate":
      return "ok";
    default:
      return "unknown";
  }
}

function ratioSeverity(band: CicRatioBand): CicSeverity {
  if (band === "optimal") return "ok";
  if (band === "low" || band === "high") return "strong";
  return "unknown";
}

function DopCalculator({
  t,
  lab,
  results,
  selectedCropName,
  reportDate,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  results: ResultLite[];
  selectedCropName?: string | null;
  reportDate?: string | null;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const [fallbackOptimum, setFallbackOptimum] = useState(1);
  const dopRows = useMemo(
    () => buildDopRows(lab, results, fallbackOptimum),
    [lab, results, fallbackOptimum]
  );
  const outputs = useMemo(
    () => dopRows.map((row) => row.output),
    [dopRows]
  );
  const needsFallbackOptimum = dopRows.some((row) => row.usedFallback);
  const downloadWatermark = useMemo(
    () =>
      buildCultosolChartWatermark({
        date: reportDate,
        crop: selectedCropName,
      }),
    [reportDate, selectedCropName]
  );

  useEmitCalculatorOutputs(onOutputsChange, outputs);

  return (
    <CalculatorPage>
      {needsFallbackOptimum ? (
        <div className="calc-page__params calc-surface p-4">
          <CalculatorFormFields>
            <NumberField
              label={`${t.optimum} (${t.current})`}
              value={fallbackOptimum}
              onChange={setFallbackOptimum}
            />
          </CalculatorFormFields>
          <p className="mt-3 text-xs leading-relaxed text-[#6c6c70]">{t.dopOptimumHelp}</p>
        </div>
      ) : null}
      <ChartExpandShell
        title={t.graphDop}
        closeLabel="Close"
        expandLabel="Expand chart"
        fullscreenClassName="chart-fullscreen--dop"
        downloadLabel="Download PNG"
        downloadWatermark={downloadWatermark}
        downloadFileName={downloadWatermark}
        downloadCaptureSelector=".dop-chart__board"
      >
        <DopVerticalChart t={t} rows={dopRows} compact />
      </ChartExpandShell>
    </CalculatorPage>
  );
}

function formatDopPercent(dop: number) {
  const abs = Math.abs(dop);
  if (abs >= 100) return `${dop.toFixed(0)}%`;
  return `${dop.toFixed(1)}%`;
}

function DopVerticalChart({
  t,
  rows,
  compact = false,
}: {
  t: Record<string, string>;
  rows: Array<{
    key: string;
    label: string;
    dop: number;
    optimum: number;
    value: number;
  }>;
  compact?: boolean;
}) {
  const maxAbs = Math.max(
    20,
    ...rows.map((row) => Math.abs(Math.max(-180, Math.min(180, row.dop))))
  );
  const scaleMax = Math.min(180, Math.max(40, Math.ceil(maxAbs / 20) * 20));
  const chartRows = rows.map((row) => {
    const clamped = Math.max(-180, Math.min(180, row.dop));
    const widthPct = Math.max(2, (Math.abs(clamped) / scaleMax) * 50);
    const nearOptimum = Math.abs(clamped) < scaleMax * 0.08;
    return {
      ...row,
      isNegative: clamped < 0,
      nearOptimum,
      widthPct,
      status: nearOptimum ? "ok" : clamped < 0 ? "low" : "high",
    } as const;
  });

  return (
    <div
      className={`dop-chart ${
        compact ? "dop-chart--compact chart-panel--compact" : "calc-surface p-3 sm:p-4"
      }`}
    >
      {!compact ? (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[#1c1c1e] dark-text-primary">{t.graphDop}</p>
          <p className="text-sm font-semibold text-[#6c6c70]">%</p>
        </div>
      ) : null}
      <div className="dop-chart__board calc-surface-muted">
        {chartRows.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noData}</p>
        ) : (
          <>
            <div className="dop-chart__h-scale" aria-hidden="true">
              <span />
              <span>−{scaleMax}%</span>
              <span>0%</span>
              <span>+{scaleMax}%</span>
              <span />
            </div>
            <div className="dop-chart__rows">
              {chartRows.map((row) => (
                <div
                  key={row.key}
                  className="dop-chart__row"
                  title={`${row.label}: ${row.value} | ${t.optimum}: ${row.optimum}`}
                >
                  <span className="dop-chart__row-label">{row.label}</span>
                  <div className="dop-chart__row-track">
                    <div className="dop-chart__row-grid" aria-hidden="true" />
                    <div className="dop-chart__row-zero" aria-hidden="true" />
                    <div
                      className={`dop-chart__row-bar dop-chart__row-bar--${row.status} ${
                        row.isNegative ? "dop-chart__row-bar--neg" : "dop-chart__row-bar--pos"
                      }`}
                      style={{ width: `${row.widthPct}%` }}
                    />
                  </div>
                  <span
                    className={`dop-chart__row-value dop-chart__row-value--${row.status}`}
                  >
                    {formatDopPercent(row.dop)}
                  </span>
                </div>
              ))}
            </div>
            <div className="dop-chart__legend" role="list">
              <span className="dop-chart__legend-item" role="listitem">
                <span className="dop-chart__swatch dop-chart__swatch--low" />
                {t.deficiency}
              </span>
              <span className="dop-chart__legend-item" role="listitem">
                <span className="dop-chart__swatch dop-chart__swatch--ok" />
                {t.optimum}
              </span>
              <span className="dop-chart__legend-item" role="listitem">
                <span className="dop-chart__swatch dop-chart__swatch--high" />
                {t.excess}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function CropUptakeGuide({
  t,
  language,
  selectedCropName,
}: {
  t: Record<string, string>;
  language: Language;
  selectedCropName?: string | null;
}) {
  const profile = getUptakeProfileForCrop(selectedCropName, language);
  const width = 560;
  const height = 400;
  const paddingX = 48;
  const paddingTop = 26;
  const paddingBottom = 82;
  const usableWidth = width - paddingX * 2;
  const usableHeight = height - paddingTop - paddingBottom;
  const points = profile.stages.map((stage, index) => {
    const x =
      profile.stages.length === 1
        ? width / 2
        : paddingX + (index / (profile.stages.length - 1)) * usableWidth;
    const y = paddingTop + (1 - stage.uptake / 100) * usableHeight;
    return { stage, x, y };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <CalculatorPage>
      <div className="uptake-guide">
        <header className="uptake-guide__intro">
          <div className="uptake-guide__heading">
            <h2 className="uptake-guide__title">{profile.title}</h2>
            <p className="uptake-guide__eyebrow">{t.uptakeCurve}</p>
          </div>
          <p className="uptake-guide__desc">{t.uptakeCurveDesc}</p>
        </header>

        <div className="uptake-chart-shell">
          <ChartExpandShell
            title={profile.title}
            closeLabel="Close"
            expandLabel="Expand chart"
            fullscreenClassName="chart-fullscreen--uptake"
            showInlineTitle={false}
            expandPlacement="overlay"
            lockLandscapeOnExpand
          >
            <div className="uptake-chart-panel chart-panel--compact">
              <svg
                viewBox={`0 0 ${width} ${height}`}
                className="uptake-chart-svg"
                role="img"
                aria-label={t.uptakeCurve}
                preserveAspectRatio="xMidYMid meet"
              >
                <line
                  x1={paddingX}
                  y1={paddingTop}
                  x2={paddingX}
                  y2={height - paddingBottom}
                  stroke="currentColor"
                  strokeOpacity="0.2"
                />
                <line
                  x1={paddingX}
                  y1={height - paddingBottom}
                  x2={width - paddingX}
                  y2={height - paddingBottom}
                  stroke="currentColor"
                  strokeOpacity="0.2"
                />
                {[25, 50, 75, 100].map((tick) => {
                  const y = paddingTop + (1 - tick / 100) * usableHeight;
                  return (
                    <g key={tick}>
                      <line
                        x1={paddingX}
                        y1={y}
                        x2={width - paddingX}
                        y2={y}
                        stroke="currentColor"
                        strokeOpacity="0.07"
                      />
                      <text
                        x={14}
                        y={y + 4}
                        className="calc-chart-axis-label"
                      >
                        {tick}%
                      </text>
                    </g>
                  );
                })}
                <polyline
                  fill="none"
                  stroke="var(--accent-600, #16a34a)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="5"
                  points={path}
                />
                {points.map(({ stage, x, y }, index) => (
                  <g key={stage.label || `stage-${index}`}>
                    <circle
                      cx={x}
                      cy={y}
                      r="7"
                      fill={GRAPH_COLORS[index % GRAPH_COLORS.length]}
                      className="calc-chart-dot"
                      strokeWidth="2.5"
                    />
                    <text
                      x={x}
                      y={height - 34}
                      textAnchor="middle"
                      className="calc-chart-stage-label"
                    >
                      {stage.label}
                    </text>
                    <text
                      x={x}
                      y={height - 14}
                      textAnchor="middle"
                      className="calc-chart-axis-label calc-chart-timing-label"
                    >
                      {stage.timing}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          </ChartExpandShell>
        </div>

        <section className="uptake-guide__section" aria-labelledby="uptake-stages-heading">
          <h3 id="uptake-stages-heading" className="uptake-guide__section-title">
            {t.stageFocus}
          </h3>
          <ol className="uptake-guide__stages">
            {profile.stages.map((stage, index) => (
              <li key={stage.label} className="uptake-guide__stage">
                <span
                  className="uptake-guide__stage-dot"
                  style={{ background: GRAPH_COLORS[index % GRAPH_COLORS.length] }}
                  aria-hidden="true"
                />
                <div className="uptake-guide__stage-body">
                  <div className="uptake-guide__stage-head">
                    <span className="uptake-guide__stage-name">
                      {stage.label}
                      {stage.focus.length > 0 ? (
                        <span className="uptake-guide__stage-focus">
                          {" "}
                          · {stage.focus.join(" · ")}
                        </span>
                      ) : null}
                    </span>
                    <span className="uptake-guide__stage-meta">
                      {stage.timing}
                      <span aria-hidden="true"> · </span>
                      {stage.uptake}%
                    </span>
                  </div>
                  <p className="uptake-guide__stage-note">{stage.note}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="uptake-guide__section" aria-labelledby="uptake-nutrients-heading">
          <h3 id="uptake-nutrients-heading" className="uptake-guide__section-title">
            {t.nutrientTiming}
          </h3>
          <ul className="uptake-guide__nutrients">
            {profile.nutrients.map((item) => (
              <li key={item.symbol} className="uptake-guide__nutrient">
                <span className="uptake-guide__nutrient-symbol">{item.symbol}</span>
                <div className="uptake-guide__nutrient-body">
                  <p className="uptake-guide__nutrient-timing">{item.timing}</p>
                  <p className="uptake-guide__nutrient-note">{item.note}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <p className="uptake-guide__footnote">{t.uptakeCurveNote}</p>
      </div>
    </CalculatorPage>
  );
}

function SalinityCalculator({
  t,
  lab,
  showCalculatorFormulas = false,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  showCalculatorFormulas?: boolean;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const [ecw, setEcw] = useMemoryNumber("salinity", "ecw", 1);
  const [eceTarget, setEceTarget] = useMemoryNumber("salinity", "eceTarget", 2);
  const [psiTarget, setPsiTarget] = useMemoryNumber("salinity", "psiTarget", 10);
  const [etValue, setEtValue] = useMemoryNumber("salinity", "et", 5);
  const lr = calculateLeachingRequirement(ecw, eceTarget);
  const sar = calculateSar(lab.get("sodium")?.value || 0, lab.get("calcium")?.value || 0, lab.get("magnesium")?.value || 0);
  const psi = calculatePsi(lab.get("sodium")?.value || 0, lab.get("cec")?.value || 0);
  const gypsum = calculateGypsumRequirementByPsi({
    cec: lab.get("cec")?.value || 0,
    psiCurrent: psi?.value || 0,
    psiTarget,
  });
  const totalWater = calculateTotalWaterFromLeaching(
    etValue,
    lr ? lr.value / 100 : Number.NaN
  );
  const porosity = calculatePorosity(lab.get("bulk_density")?.value || 0);
  const gypsumOutputs: CalculationOutput[] = gypsum
    ? [
        {
          value: gypsum.meqPer100g,
          unit: "meq/100g",
          label: "Gypsum (meq/100 g)",
          formula: "CEC x ((PSI current - PSI target)/100)",
          notes: [],
        },
        {
          value: gypsum.mgPer100g,
          unit: "mg/100g",
          label: "Gypsum (mg/100 g)",
          formula: "[CEC x ((PSI current - PSI target)/100)] x 87",
          notes: [],
        },
        {
          value: gypsum.kgPerTon,
          unit: "kg/t",
          label: "Gypsum (kg/t)",
          formula: "[CEC x ((PSI current - PSI target)/100)] x 1.74",
          notes: [],
        },
      ]
    : [];
  const outputs = [lr, sar, psi, porosity, ...gypsumOutputs, totalWater].filter(Boolean) as CalculationOutput[];

  useEmitCalculatorOutputs(onOutputsChange, outputs);

  return (
    <CalculatorPage>
      <div className="calc-page__params calc-surface p-4">
          <CalculatorFormFields>
            <NumberField label={t.ecw} value={ecw} onChange={setEcw} />
            <NumberField label={t.eceTarget} value={eceTarget} onChange={setEceTarget} />
            <NumberField label={t.psiTarget} value={psiTarget} onChange={setPsiTarget} />
            <NumberField label="ET" value={etValue} onChange={setEtValue} preserveCase />
          </CalculatorFormFields>
        </div>
        <OutputGrid
          t={t}
          outputs={outputs}
          title={t.salinityRequirementTitle || t.salinity}
          showCalculatorFormulas={showCalculatorFormulas}
        />
    </CalculatorPage>
  );
}

type GraphStyle = "histogram" | "pie";

type GraphNutrient = CalculatorValue & { graphValue: number };

const GRAPH_NUTRIENT_KEYS = [
  "nitrogen",
  "phosphorus",
  "potassium",
  "calcium",
  "magnesium",
  "sulfur",
  "iron",
  "zinc",
  "manganese",
  "copper",
  "boron",
] as const;

const GRAPH_MICRO_KEYS = new Set([
  "iron",
  "zinc",
  "manganese",
  "copper",
  "boron",
]);

function formatGraphPercent(value: number) {
  if (value >= 10) return value.toFixed(1);
  if (value >= 1) return value.toFixed(2);
  if (value >= 0.01) return value.toFixed(3);
  return value.toFixed(4);
}

/** Normalize lab concentrations to % for Nutrient Graphs only (not DOP).
 *  Only ppm/mg/kg values are divided; values already in % are left as-is.
 */
function nutrientsForGraph(lab: Map<string, CalculatorValue>): GraphNutrient[] {
  return GRAPH_NUTRIENT_KEYS.map((key) => lab.get(key))
    .filter(Boolean)
    .map((item) => {
      const nutrient = item as CalculatorValue;
      const asPercent = toMassPercent(nutrient.value, nutrient.unit, {
        // Micros with no unit on foliar reports are usually ppm — never guess for macros.
        assumePpmWhenUnitMissing: GRAPH_MICRO_KEYS.has(nutrient.key),
      });
      if (asPercent == null || !(asPercent > 0)) return null;
      return {
        ...nutrient,
        value: asPercent,
        unit: "%",
        graphValue: asPercent,
      };
    })
    .filter(Boolean) as GraphNutrient[];
}

function NutrientGraphs({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
  const [graphStyle, setGraphStyle] = useState<GraphStyle>("histogram");
  const nutrients = useMemo(() => nutrientsForGraph(lab), [lab]);

  const maxValue = Math.max(...nutrients.map((item) => item.graphValue), 1e-6);
  const chartTitle =
    graphStyle === "pie" ? t.graphPie || "Pie chart" : t.graphHistogram || "Histogram";

  return (
    <CalculatorPage>
      <div className="calc-page__params calc-surface space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold dark-text-primary">{t.macroMicro}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-[#6c6c70] dark-text-primary">
              {t.graphValuesAsPercent ||
                "Only ppm/mg/kg values are converted to % (÷ 10,000). Values already in % are unchanged."}
            </p>
          </div>
          <div className="w-full sm:w-auto sm:min-w-[12rem]">
            <SelectField
              label={t.graphStyle}
              value={graphStyle}
              onChange={(value) => setGraphStyle(value as GraphStyle)}
              options={[
                ["histogram", t.graphHistogram],
                ["pie", t.graphPie],
              ]}
            />
          </div>
        </div>
      </div>

      {nutrients.length === 0 ? (
        <p className="calc-surface p-4 text-sm text-slate-600 dark-text-primary">{t.noData}</p>
      ) : (
        <ChartExpandShell
          title={chartTitle}
          closeLabel="Close"
          expandLabel="Expand chart"
          fullscreenClassName="chart-fullscreen--nutrient"
          expandPlacement="overlay"
          showInlineTitle={false}
        >
          {graphStyle === "pie" ? (
            <PieGraph nutrients={nutrients} t={t} />
          ) : (
            <HistogramGraph nutrients={nutrients} maxValue={maxValue} />
          )}
        </ChartExpandShell>
      )}
    </CalculatorPage>
  );
}

const GRAPH_COLORS = [
  "#0f9f7a",
  "#2563eb",
  "#f59e0b",
  "#db2777",
  "#7c3aed",
  "#0891b2",
  "#65a30d",
  "#ea580c",
  "#475569",
  "#14b8a6",
  "#84cc16",
];

function graphColorForKey(key: string) {
  const index = GRAPH_NUTRIENT_KEYS.indexOf(
    key as (typeof GRAPH_NUTRIENT_KEYS)[number]
  );
  return GRAPH_COLORS[(index >= 0 ? index : 0) % GRAPH_COLORS.length];
}

function HistogramGraph({
  nutrients,
  maxValue,
}: {
  nutrients: GraphNutrient[];
  maxValue: number;
}) {
  const chartMaxH = 88;
  return (
    <div className="nutrient-graph nutrient-graph--hist chart-panel--compact calc-surface-muted">
      <div className="nutrient-graph__hist">
        {nutrients.map((item) => {
          const height = Math.max(
            6,
            Math.min(chartMaxH, (item.graphValue / maxValue) * chartMaxH)
          );
          return (
            <div key={item.key} className="nutrient-graph__col">
              <span className="nutrient-graph__value">
                {formatGraphPercent(item.graphValue)}%
              </span>
              <span
                className="nutrient-graph__bar"
                style={{
                  height,
                  background: `linear-gradient(180deg, ${graphColorForKey(item.key)}, var(--accent-600, #16a34a))`,
                }}
              />
              <span className="nutrient-graph__label">{item.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PieGraph({
  nutrients,
  t,
}: {
  nutrients: GraphNutrient[];
  t: Record<string, string>;
}) {
  const [sortDesc, setSortDesc] = useState(true);

  const total =
    nutrients.reduce((sum, item) => sum + Math.max(0, item.graphValue), 0) || 1;

  const slices = useMemo(() => {
    const ordered = [...nutrients]
      .map((item) => ({
        item,
        color: graphColorForKey(item.key),
        percent: Math.max(0, item.graphValue) / total,
      }))
      .sort((a, b) =>
        sortDesc ? b.percent - a.percent : a.percent - b.percent
      );

    let start = 0;
    return ordered.map((entry) => {
      const end = start + entry.percent * 100;
      const slice = `${entry.color} ${start}% ${end}%`;
      start = end;
      return { ...entry, slice };
    });
  }, [nutrients, sortDesc, total]);

  const sortLabel = sortDesc
    ? t.graphSortHighToLow || "Highest to lowest"
    : t.graphSortLowToHigh || "Lowest to highest";

  return (
    <div className="nutrient-graph nutrient-graph--pie chart-panel--compact calc-surface-muted">
      <div
        className="nutrient-graph__pie-disc"
        style={{
          background: `conic-gradient(${slices.map((slice) => slice.slice).join(", ")})`,
        }}
        role="img"
        aria-label={t.graphPie || "Pie chart"}
      />
      <div className="nutrient-graph__legend">
        <div className="nutrient-graph__legend-head">
          <button
            type="button"
            onClick={() => setSortDesc((value) => !value)}
            className="nutrient-graph__sort"
            title={sortLabel}
            aria-label={sortLabel}
          >
            {sortDesc ? (
              <ArrowDownWideNarrow size={16} aria-hidden />
            ) : (
              <ArrowUpNarrowWide size={16} aria-hidden />
            )}
          </button>
        </div>
        <div className="nutrient-graph__legend-grid">
          {slices.map(({ item, color, percent }) => (
            <div key={item.key} className="nutrient-graph__legend-item calc-surface-inner">
              <div className="nutrient-graph__legend-row">
                <span
                  className="nutrient-graph__swatch"
                  style={{ background: color }}
                />
                <span className="nutrient-graph__legend-name">{item.label}</span>
              </div>
              <span className="nutrient-graph__legend-values">
                {(percent * 100).toFixed(0)}%
                <span>{formatGraphPercent(item.graphValue)}%</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalculatorPanel({
  t,
  fields,
  output,
  showCalculatorFormulas = false,
}: {
  t: Record<string, string>;
  fields: ReactNode;
  output: CalculationOutput | null;
  showCalculatorFormulas?: boolean;
}) {
  return (
    <>
      <div className="calc-page__params calc-surface p-4">
        <CalculatorFormFields>{fields}</CalculatorFormFields>
      </div>
      <OutputCard
        t={t}
        output={output}
        title={t.result}
        showCalculatorFormulas={showCalculatorFormulas}
      />
    </>
  );
}

function CalculatorFormFields({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const layout = useContext(CalculatorFieldsLayoutContext);

  return (
    <div
      className={`calc-form-fields calc-form-fields--${layout}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

function OutputGrid({
  t,
  outputs,
  title,
  showCalculatorFormulas = false,
}: {
  t: Record<string, string>;
  outputs: Array<CalculationOutput | null>;
  title?: string;
  showCalculatorFormulas?: boolean;
}) {
  const validOutputs = outputs.filter(Boolean) as CalculationOutput[];
  if (validOutputs.length === 0) {
    return (
      <div className="calc-surface p-4">
        <p className="text-sm text-slate-600">{t.noData}</p>
      </div>
    );
  }

  return (
    <div className="calc-page__results calc-surface p-4">
      {title ? (
        <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">{title}</h3>
      ) : null}
      <div className={`grid grid-cols-2 gap-2.5 ${title ? "mt-3" : ""}`}>
        {validOutputs.map((output, index) => (
          <OutputCard
            key={output.label || index}
            t={t}
            output={output}
            compact
            showCalculatorFormulas={showCalculatorFormulas}
          />
        ))}
      </div>
    </div>
  );
}

function OutputCard({
  t,
  output,
  title,
  compact = false,
  showCalculatorFormulas = false,
}: {
  t: Record<string, string>;
  output: CalculationOutput | null;
  title?: string;
  compact?: boolean;
  showCalculatorFormulas?: boolean;
}) {
  const translatedOutput = output ? translateCalculationOutput(output, t) : null;

  if (!translatedOutput) {
    return (
      <div className="calc-surface p-4">
        <p className="text-sm text-slate-600">{t.noData}</p>
      </div>
    );
  }

  if (compact) {
    return (
      <article className="calc-result-card calc-result-card--active rounded-xl px-3 py-3">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
          {translatedOutput.label}
        </p>
        <p className="mt-1 text-2xl font-extrabold leading-none text-green-950">
          {translatedOutput.value}
          <span className="ml-1 text-xs font-semibold">{translatedOutput.unit}</span>
        </p>
        {translatedOutput.alternatives?.length ? (
          <ul className="mt-2 space-y-0.5 text-xs font-medium text-[#6c6c70]">
            {translatedOutput.alternatives.map((alternative) => (
              <li key={`${alternative.value}-${alternative.unit}`}>
                = {alternative.value} {alternative.unit}
              </li>
            ))}
          </ul>
        ) : null}
        {showCalculatorFormulas && translatedOutput.notes.length > 0 ? (
          <ul className="mt-2 space-y-1 text-xs leading-relaxed text-[#3c3c43]">
            {translatedOutput.notes.map((note) => (
              <li key={note} className="flex gap-1.5">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-green-600" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    );
  }

  return (
    <div className="calc-page__results calc-surface p-4">
      {title ? (
        <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">{title}</h3>
      ) : null}
      <article className={`calc-result-card calc-result-card--active rounded-xl px-4 py-4 ${title ? "mt-3" : ""}`}>
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
          {translatedOutput.label}
        </p>
        <p className="mt-1 text-3xl font-extrabold leading-none text-green-950">
          {translatedOutput.value}
          <span className="ml-1 text-sm font-semibold">{translatedOutput.unit}</span>
        </p>
        {translatedOutput.alternatives?.length ? (
          <ul className="mt-2 space-y-0.5 text-sm font-medium text-[#6c6c70]">
            {translatedOutput.alternatives.map((alternative) => (
              <li key={`${alternative.value}-${alternative.unit}`}>
                = {alternative.value} {alternative.unit}
              </li>
            ))}
          </ul>
        ) : null}
        {showCalculatorFormulas && translatedOutput.notes.length > 0 ? (
          <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#3c3c43]">
            {translatedOutput.notes.map((note) => (
              <li key={note} className="flex gap-2">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                <span>{note}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    </div>
  );
}

function translateCalculationOutput(
  output: CalculationOutput,
  t: Record<string, string>
): CalculationOutput {
  return {
    ...output,
    unit: translateCalculatorText(output.unit, t),
    label: translateCalculatorText(output.label, t),
    formula: translateCalculatorText(output.formula, t),
    notes: output.notes.map((note) => translateCalculatorText(note, t)),
    alternatives: output.alternatives?.map((alternative) => ({
      ...alternative,
      unit: translateCalculatorText(alternative.unit, t),
    })),
  };
}

function translateCalculatorText(value: string, t: Record<string, string>) {
  if (/kg product\/ha before local calibration/.test(value)) {
    return value.replace("kg product/ha before local calibration.", t.noteKgProductHa);
  }

  if (/t\/ha estimated/.test(value)) {
    return value.replace("t/ha estimated.", t.noteTonsHaEstimated);
  }

  const dictionary: Record<string, string | undefined> = {
    "kg product": t.unitKgProduct,
    "t product": t.unitTProduct,
    "Gypsum requirement": t.gypsumRequirementTitle,
    "Gypsum (meq/100 g)": t.gypsumMeqTitle,
    "Gypsum (mg/100 g)": t.gypsumMgTitle,
    "Gypsum (kg/t)": t.gypsumKgTitle,
    "Lime requirement": t.limeRequirementTitle,
    "Elemental sulfur requirement": t.phAmendSulfurRequirement,
    "Lime or amendment": t.amendmentRequirementTitle,
    "Estimate lime or gypsum need using pH, acidity, RNDT, depth, and density.":
      t.amendmentRequirementDesc,
    "Estimate lime or gypsum need using pH, acidity, RNDT, depth, and density":
      t.amendmentRequirementDesc,
    "Salinity and SAR": t.salinityRequirementTitle,
    "Calculate SAR/RAS, porosity, and leaching requirement.":
      t.salinityRequirementDesc,
    "Calculate SAR/RAS, porosity, and leaching requirement":
      t.salinityRequirementDesc,
    "Nutrient graphs": t.nutrientGraphsTitle,
    "Visualize macro and micronutrient values from the current analysis.":
      t.nutrientGraphsDesc,
    "Visualize macro and micronutrient values from the current analysis":
      t.nutrientGraphsDesc,
    Porosity: t.porosityTitle,
    "Leaching requirement": t.leachingRequirementTitle,
    "Total water": t.totalWaterTitle,
    "target_ph adjusted by depth, bulk density, RNDT, and area":
      t.targetPhFormula,
    "exchangeable_acidity adjusted by depth, bulk density, RNDT, and area":
      t.acidityFormula,
    "((V2 - V1) * CICE) / (10 * PRNT) * f":
      t.earthFormula,
    "buffer_index adjusted by depth, bulk density, RNDT, and area":
      t.bufferFormula,
    "((value - optimum) / optimum) * 100": t.dopFormula,
    "(1 - bulk density / particle density) * 100": t.porosityFormula,
    "ECw / (5 * ECe target - ECw) * 100": t.leachingFormula,
    "(Na exchangeable / CEC) * 100": t.psiFormula,
    "ET / (1 - RL)": t.totalWaterFormula,
    "CEC x ((PSI current - PSI target)/100)": t.gypsumMeqFormula,
    "[CEC x ((PSI current - PSI target)/100)] x 87": t.gypsumMgFormula,
    "[CEC x ((PSI current - PSI target)/100)] x 1.74": t.gypsumKgFormula,
    "Useful for judging organic matter decomposition speed and nitrogen immobilization risk.":
      t.noteCnRatio,
    "Use ratios as balance indicators, not as a replacement for crop-specific sufficiency ranges.":
      t.noteNutrientRatio,
    "Input is treated as oxide grade, such as P2O5 or K2O.":
      t.noteOxideGrade,
    "Input is treated as elemental nutrient grade.":
      t.noteElementGrade,
    "Simple target pH estimate. Confirm with local buffer/acidity method when possible.":
      t.noteTargetPh,
    "Exchangeable acidity estimate. Best when the lab reports acidity or Al+H.":
      t.noteExchangeableAcidity,
    "Base-saturation method: V1 current base saturation, V2 target base saturation, CICE effective CEC, PRNT neutralization value, and f incorporation factor.":
      t.noteEarthBaseSaturation,
    "Buffer-index estimate. Use the lab's local calibration if it provides one.":
      t.noteBufferIndex,
    "Gypsum supplies calcium and sulfur and is more relevant for sodicity/salinity structure problems than pH increase.":
      t.noteGypsum,
    "Dolomitic lime also supplies magnesium.": t.noteDolomiticLime,
    "Calcitic lime mainly supplies calcium carbonate equivalent.":
      t.noteCalciticLime,
    "Negative DOP indicates deficiency relative to optimum.": t.noteNegativeDop,
    "Positive DOP indicates excess relative to optimum.": t.notePositiveDop,
    "Typical mineral soil particle density default is 2.65 g/cm3.":
      t.noteParticleDensity,
    "Use mmolc/L or consistent water extract units for Na, Ca, and Mg.":
      t.noteSarUnits,
    "Requires drainage. Do not apply leaching water where drainage is poor.":
      t.noteDrainage,
  };

  return dictionary[value] || value;
}

function NumberField({
  label,
  value,
  onChange,
  readOnly,
  preserveCase,
  placeholder,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  preserveCase?: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState(() => formatNumberInput(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(formatNumberInput(value));
  }, [value]);

  return (
    <label
      className={`calc-field-label grid gap-1${preserveCase ? " calc-field-label--element" : ""}`}
    >
      {label}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        value={text}
        readOnly={readOnly}
        placeholder={placeholder}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onChange={(event) => {
          const next = event.target.value;
          if (!/^-?\d*[.,]?\d*$/.test(next)) return;
          setText(next);
          if (!onChange) return;
          if (next === "" || next === "-" || next === "." || next === ",") return;
          const parsed = Number(next.replace(",", "."));
          if (Number.isFinite(parsed)) onChange(parsed);
        }}
        onBlur={() => {
          focusedRef.current = false;
          if (text === "" || text === "-" || text === "." || text === ",") {
            setText("");
            onChange?.(0);
          }
        }}
        className="calc-field-input"
      />
    </label>
  );
}

function formatNumberInput(value: number) {
  if (!Number.isFinite(value) || value === 0) return "";
  return String(value);
}

function SelectField({
  label,
  value,
  onChange,
  options,
  fullWidth,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  fullWidth?: boolean;
}) {
  return (
    <MenuSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      fullWidth={fullWidth}
      variant="field"
    />
  );
}

function getSuggestions(
  lab: Map<string, CalculatorValue>,
  results: ResultLite[],
  t: Record<string, string>,
  sampleType: "soil" | "foliar"
) {
  const suggestions: Array<{ key: CalculatorKey; title: string; desc: string }> = [];
  const visible = new Set(visibleCalculatorTabs(sampleType).map((tab) => tab.key));

  function push(item: { key: CalculatorKey; title: string; desc: string }) {
    if (!visible.has(item.key)) return;
    if (suggestions.some((existing) => existing.key === item.key)) return;
    suggestions.push(item);
  }

  if (sampleType === "foliar") {
    push({
      key: "dop",
      title: t.graphDop || t.dop || "DOP",
      desc:
        t.dopOptimumHelp ||
        "Deviation from optimum for each foliar nutrient.",
    });
    push({
      key: "uptake",
      title: t.uptakeCurve || t.uptake || "Absorption",
      desc:
        t.uptakeCurveDesc ||
        "General nutrient uptake timing for the selected crop.",
    });
    push({
      key: "graphs",
      title: t.nutrientGraphsTitle,
      desc: t.nutrientGraphsDesc,
    });
    return suggestions;
  }

  const hasCriticalPh = results.some(
    (result) =>
      /ph/i.test(result.parameter_name) &&
      ["warning", "negative"].includes(result.final_group_code || "")
  );
  const hasSalinity = results.some(
    (result) =>
      /conduct|ec|salin|sodium|sodio/i.test(result.parameter_name) &&
      ["warning", "negative"].includes(result.final_group_code || "")
  );

  if (hasCriticalPh || lab.has("ph")) {
    push({
      key: "amendment",
      title: t.amendmentRequirementTitle,
      desc: t.amendmentRequirementDesc,
    });
  }

  if (hasSalinity || lab.has("sodium")) {
    push({
      key: "salinity",
      title: t.salinityRequirementTitle,
      desc: t.salinityRequirementDesc,
    });
  }

  if (
    lab.has("cec") ||
    lab.has("calcium") ||
    lab.has("magnesium") ||
    lab.has("potassium")
  ) {
    push({
      key: "cic",
      title: t.cicRequirementTitle,
      desc: t.cicRequirementDesc,
    });
  }

  if (
    lab.has("phosphorus") ||
    lab.has("potassium") ||
    lab.has("magnesium") ||
    lab.has("organic_matter")
  ) {
    push({
      key: "fertilizer",
      title: t.fertilizerPlanTab || t.fertilizerRequirementTitle,
      desc:
        t.fertilizerPlanDoseDesc ||
        t.fertilizerPlanDesc ||
        t.fertilizerRequirementDesc,
    });
    push({
      key: "fertilizerCost",
      title: t.fertilizerCost || "Fertilizer cost",
      desc: t.fertilizerCostCta || "See prices & cost scenarios",
    });
    push({
      key: "fertilizerFormulation",
      title: t.fertilizerFormulation || "Fertilizer formulation",
      desc:
        t.fertilizerFormulationDesc ||
        "Build a custom grade from raw materials with filler or adjusted formula.",
    });
  }

  push({
    key: "uptake",
    title: t.uptakeCurve || t.uptake || "Absorption",
    desc:
      t.uptakeCurveDesc ||
      "General nutrient uptake timing for the selected crop.",
  });

  push({
    key: "graphs",
    title: t.nutrientGraphsTitle,
    desc: t.nutrientGraphsDesc,
  });

  return suggestions;
}

function normalizeName(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[().:/_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameOutputs(previous: CalculationOutput[], next: CalculationOutput[]) {
  if (previous.length !== next.length) return false;

  return previous.every((item, index) => {
    const compare = next[index];
    if (!compare) return false;

    const previousAlternatives = item.alternatives || [];
    const nextAlternatives = compare.alternatives || [];
    if (previousAlternatives.length !== nextAlternatives.length) return false;

    const sameAlternatives = previousAlternatives.every((alternative, alternativeIndex) => {
      const nextAlternative = nextAlternatives[alternativeIndex];
      return Boolean(
        nextAlternative &&
          alternative.value === nextAlternative.value &&
          alternative.unit === nextAlternative.unit
      );
    });

    return (
      item.value === compare.value &&
      item.unit === compare.unit &&
      item.label === compare.label &&
      item.formula === compare.formula &&
      item.notes.join("||") === compare.notes.join("||") &&
      sameAlternatives
    );
  });
}

function sameFertilizerPlan(previous: FertilizerPlanSnapshot, next: FertilizerPlanSnapshot) {
  if (previous.areaHa !== next.areaHa) return false;
  if (previous.irrigationSystem !== next.irrigationSystem) return false;
  if (previous.recommendations.length !== next.recommendations.length) return false;
  if (!previous.recommendations.every((line, i) => line === next.recommendations[i])) return false;
  if (previous.doses.length !== next.doses.length) return false;
  if (
    !previous.doses.every((dose, i) => {
      const compare = next.doses[i];
      return (
        Boolean(compare) &&
        dose.key === compare.key &&
        dose.dosisOxideKgHa === compare.dosisOxideKgHa &&
        dose.notRequired === compare.notRequired &&
        dose.viaEncalado === compare.viaEncalado &&
        dose.demandaKgHa === compare.demandaKgHa
      );
    })
  ) {
    return false;
  }
  return JSON.stringify(previous.irrigationTable) === JSON.stringify(next.irrigationTable);
}

function buildDopRows(
  lab: Map<string, CalculatorValue>,
  results: ResultLite[],
  fallbackOptimum: number
) {
  const nutrientKeys = [
    "nitrogen",
    "phosphorus",
    "potassium",
    "calcium",
    "magnesium",
    "sulfur",
    "sodium",
    "iron",
    "zinc",
    "manganese",
    "copper",
    "boron",
  ] as const;

  return nutrientKeys
    .map((key) => {
      const item = lab.get(key);
      if (!item || !Number.isFinite(item.value) || item.value <= 0) return null;

      const matchingResult = results.find((result) =>
        matchResultToNutrient(key, `${result.display_parameter_name || result.parameter_name}`)
      );
      const min = Number(matchingResult?.min);
      const max = Number(matchingResult?.max);
      const rangeOptimum =
        Number.isFinite(min) && Number.isFinite(max) && max > min
          ? (min + max) / 2
          : Number.NaN;
      const usedFallback = !(Number.isFinite(rangeOptimum) && rangeOptimum > 0);
      const optimum = usedFallback
        ? Math.max(0.01, fallbackOptimum || 1)
        : rangeOptimum;
      const output = calculateDop(item.value, optimum);
      if (!output) return null;

      return {
        key,
        label: item.label || key.toUpperCase(),
        value: item.value,
        optimum,
        dop: output.value,
        usedFallback,
        output: {
          ...output,
          label: `DOP ${item.label || key.toUpperCase()}`,
        } satisfies CalculationOutput,
      };
    })
    .filter(Boolean) as Array<{
    key: string;
    label: string;
    value: number;
    optimum: number;
    dop: number;
    usedFallback: boolean;
    output: CalculationOutput;
  }>;
}

function matchResultToNutrient(key: string, label: string) {
  const normalized = normalizeName(label);
  const patterns: Record<string, RegExp> = {
    nitrogen: /\b(n|nitrogen|nitrogeno|azote|nh4|no3)\b/,
    phosphorus: /\b(p|phosphorus|fosforo|phosphore)\b/,
    potassium: /\b(k|potassium|potasio)\b/,
    calcium: /\b(ca|calcium|calcio)\b/,
    magnesium: /\b(mg|magnesium|magnesio)\b/,
    sulfur: /\b(s|sulfur|azufre|soufre)\b/,
    sodium: /\b(na|sodium|sodio)\b/,
    iron: /\b(fe|iron|hierro|fer)\b/,
    zinc: /\b(zn|zinc)\b/,
    manganese: /\b(mn|manganese|manganeso)\b/,
    copper: /\b(cu|copper|cobre|cuivre)\b/,
    boron: /\b(b|boron|boro|bore)\b/,
  };

  return patterns[key]?.test(normalized) ?? false;
}
