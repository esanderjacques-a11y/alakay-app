"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Calculator,
  CalendarDays,
  CircleDollarSign,
  Droplets,
  FileText,
  FlaskConical,
  Import,
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
import MenuSelect from "@/components/ui/MenuSelect";
import type { Language } from "@/lib/translations";
import { calculatorHubText } from "@/lib/i18n/componentText";
import { formatMessage } from "@/lib/i18n/format";
import { getUptakeProfileForCrop } from "@/lib/i18n/uptakeProfiles";
import { buildLabValueIndex, labHasUsefulSoilData } from "@/lib/labValueIndex";
import {
  enrichLabWithResolvedCations,
} from "@/lib/resolveCationInputs";
import { useSoilFertilityReference } from "@/lib/soilFertilityData";
import {
  CalculatorMemoryProvider,
  useCalculatorMemory,
  useMemoryNumber,
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
};

type CalculatorKey =
  | "priority"
  | "cic"
  | "amendment"
  | "fertilizer"
  | "fertilizerCost"
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
  { key: "dop", icon: <Calculator size={17} /> },
  { key: "uptake", icon: <Sprout size={17} /> },
  { key: "salinity", icon: <Droplets size={17} /> },
  { key: "graphs", icon: <BarChart3 size={17} /> },
];

function visibleCalculatorTabs(sampleType: "soil" | "foliar") {
  return tabs.filter(({ key }) => {
    if (key === "cic") return sampleType === "soil";
    if (key === "dop") return sampleType === "foliar";
    if (key === "fertilizer" || key === "fertilizerCost") return sampleType === "soil";
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
}: Props) {
  const t = calculatorHubText[language] || calculatorHubText.en;
  const defaultCalculatorFilter: CalculatorKey = "priority";
  const lab = useMemo(
    () => buildLabValueIndex(parameters, values, results, parameterUnits),
    [parameters, values, results, parameterUnits]
  );
  const hasLabData = labHasUsefulSoilData(lab);
  const suggestions = getSuggestions(lab, results, t);

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
}: {
  t: Record<string, string>;
  language: Language;
  lab: Map<string, CalculatorValue>;
  results: ResultLite[];
  sampleType: "soil" | "foliar";
  selectedCropName?: string | null;
  selectedCountry?: string | null;
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
}) {
  const { importFromValues, valuesOutOfSync, lastImportFingerprint } = useCalculatorMemory();
  const sharedCations = useSharedCationInputs(lab);
  const effectiveLab = useMemo(
    () => enrichLabWithResolvedCations(lab, sharedCations),
    [lab, sharedCations]
  );
  const [importMessage, setImportMessage] = useState("");
  const autoImportedRef = useRef(false);
  const [hubMode, setHubMode] = useState<HubMode>("guided");
  const calculatorTabs = useMemo(
    () => visibleCalculatorTabs(sampleType),
    [sampleType]
  );
  const guidedSteps = useMemo(() => {
    const visibleKeys = new Set(calculatorTabs.map((tab) => tab.key));
    return GUIDED_STEPS[sampleType].filter((key) => visibleKeys.has(key));
  }, [sampleType, calculatorTabs]);
  const [active, setActive] = useState<CalculatorKey>(
    () => GUIDED_STEPS[sampleType][0] || defaultCalculatorFilter
  );
  const [browseLayout, setBrowseLayout] = useViewLayoutPreference("calculator-hub");
  const fieldsLayout = browseLayout;

  // Drop removed tabs if a stale selection lingered.
  useEffect(() => {
    if (!calculatorTabs.some((tab) => tab.key === active)) {
      setActive(
        hubMode === "guided" && guidedSteps[0]
          ? guidedSteps[0]
          : defaultCalculatorFilter
      );
    }
  }, [active, calculatorTabs, defaultCalculatorFilter, guidedSteps, hubMode]);
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

  function reportOutputs(key: string, outputs: CalculationOutput[]) {
    const cleanOutputs = outputs.filter(Boolean);
    setCalculatorOutputs((previous) => {
      const current = previous[key] || [];
      if (sameOutputs(current, cleanOutputs)) return previous;
      return {
        ...previous,
        [key]: cleanOutputs,
      };
    });
  }

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

  useEffect(() => {
    if (!onOutputsChange) return;
    const entries = Object.entries(calculatorOutputs);
    // Skip the empty mount flush so navigating away/back to Calculators
    // does not wipe packs already held by the parent page.
    if (entries.length === 0) return;
    onOutputsChange(
      entries.map(([id, outputs]) => ({
        id,
        label: String(t[id as keyof typeof t] || id),
        outputs: outputs.map((output) => translateCalculationOutput(output, t)),
      }))
    );
  }, [calculatorOutputs, onOutputsChange, t]);

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

  // First visit (no saved import): pull Values into calculator memory automatically once.
  useEffect(() => {
    if (autoImportedRef.current) return;
    if (lastImportFingerprint) return;
    if (!hasLabData) return;
    autoImportedRef.current = true;
    importFromValues();
  }, [hasLabData, lastImportFingerprint, importFromValues]);

  return (
    <section className="animate-slide-up">
      <div className="calculator-hub-panel values-screen-panel--open px-0 pb-6 pt-0">
        {/* Page header */}
        <div className="flex flex-col gap-2 px-4 pb-3 pt-2">
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
            <div className="hub-mode-toggle inline-flex shrink-0" role="tablist" aria-label={t.hubModeLabel}>
              <button
                type="button"
                role="tab"
                aria-selected={hubMode === "guided"}
                onClick={() => switchHubMode("guided")}
                className={`hub-mode-toggle__btn ${hubMode === "guided" ? "hub-mode-toggle__btn--active" : ""}`}
              >
                {t.hubModeGuided}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={hubMode === "explorer"}
                onClick={() => switchHubMode("explorer")}
                className={`hub-mode-toggle__btn ${hubMode === "explorer" ? "hub-mode-toggle__btn--active" : ""}`}
              >
                {t.hubModeExplorer}
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={handleImportFromValues}
                className={`inline-flex items-center gap-1 text-xs font-semibold underline-offset-2 hover:underline ${
                  valuesOutOfSync
                    ? "text-amber-800 dark:text-amber-300"
                    : "text-green-800 dark:text-green-300"
                }`}
                title={t.importFromValuesHint}
                aria-label={t.importFromValuesHint}
              >
                <Import size={14} aria-hidden />
                <span>{t.importFromValues || "Import"}</span>
                {valuesOutOfSync ? (
                  <span className="ml-0.5 inline-block h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden />
                ) : null}
              </button>
              {goToValues ? (
                <button
                  type="button"
                  onClick={goToValues}
                  className="text-xs font-semibold text-green-800 underline-offset-2 hover:underline dark:text-green-300"
                >
                  {t.openValues}
                </button>
              ) : null}
            </div>
          </div>
          <p className="hub-mode-hint text-xs text-slate-500 dark:text-slate-400">
            {hubMode === "guided" ? t.hubModeGuidedHint : t.hubModeExplorerHint}
          </p>
          {importMessage ? (
            <p className="text-xs font-semibold text-green-800 dark:text-green-300" role="status">
              {importMessage}
            </p>
          ) : valuesOutOfSync ? (
            <p className="text-xs text-amber-800/90 dark:text-amber-200/90" role="status">
              {t.importFromValuesStale ||
                "Values changed since the last import. Tap Import from Values to update."}
            </p>
          ) : null}
        </div>

        {!hasLabData ? (
          <div className="mx-4 mb-3 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-3 dark:border-amber-900/40 dark:bg-amber-950/30" role="status">
            <p className="text-sm font-semibold text-amber-950 dark:text-amber-100">
              {t.labDataRequiredTitle}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-amber-900/90 dark:text-amber-200/90">
              {t.labDataRequiredDesc}
            </p>
            {goToValues ? (
              <button
                type="button"
                onClick={goToValues}
                className="mt-2 text-xs font-bold text-green-800 underline-offset-2 hover:underline dark:text-green-300"
              >
                {t.openValues}
              </button>
            ) : null}
          </div>
        ) : null}

        <CalculatorFieldsLayoutContext.Provider value={fieldsLayout}>
        {hubMode === "guided" && guidedSteps.length > 0 ? (
          <div className="calc-guided-stepper px-4 pb-3">
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
            {guidedIndex >= guidedSteps.length - 1 ? (
              <p className="mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                {t.hubModeFinishHint ||
                  "Guided path complete. Schedule applications or generate a report."}
              </p>
            ) : null}
          </div>
        ) : null}
        {hubMode === "explorer" && browseLayout === "list" ? (
          <div className="px-4 pb-3">
            <MenuSelect
              label={t.calculatorPickerLabel}
              heading={t.calculatorPickerLabel}
              value={active}
              onChange={(value) => setActive(value as CalculatorKey)}
              variant="field"
              fullWidth
              options={calculatorTabs.map((tab) => ({
                value: tab.key,
                label: t[tab.key],
              }))}
            />
          </div>
        ) : null}
        {hubMode === "explorer" && browseLayout !== "list" ? (
          <div className="calculator-hub-tabs overflow-x-auto scrollbar-none px-4 pb-3">
            <div className="flex w-max min-w-full gap-1.5">
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

        {active === "priority" && browseLayout === "grid" ? (
          <PriorityCalculators t={t} suggestions={suggestions} setActive={setActive} />
        ) : null}
        {active === "priority" && browseLayout === "list" ? (
          <CalculatorPage>
            <p className="calc-surface p-4 text-sm text-slate-600">{t.calculatorListHint}</p>
          </CalculatorPage>
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
              onDosePlanChange={(plan) => {
                setFertilizerPlan(plan);
                onFertilizerPlanChange?.(plan);
              }}
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
        {active === "dop" ? (
          sampleType === "foliar" ? (
            <DopCalculator
              t={t}
              lab={effectiveLab}
              results={results}
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
  desc: string;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="calculator-action-card">
      <span className="calculator-action-card__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="calculator-action-card__copy">
        <span className="calculator-action-card__title">{title}</span>
        <span className="calculator-action-card__desc">{desc}</span>
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
    <div className={`calc-page px-3 sm:px-4 space-y-4 ${className}`.trim()}>{children}</div>
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

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

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
      <div className="calc-page__params calc-surface p-4">
        <CalculatorFormFields>
          <NumberField
            label={t.cicLabel || "CIC / CICe"}
            value={cec}
            onChange={setCec}
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
        <p className="mt-3 text-xs leading-relaxed text-[#6c6c70]">
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
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  results: ResultLite[];
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

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

  return (
    <CalculatorPage>
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
      <ChartExpandShell
        title={t.graphDop}
        closeLabel="Close"
        expandLabel="Expand chart"
        fullscreenClassName="chart-fullscreen--landscape"
      >
        <DopVerticalChart t={t} rows={dopRows} compact />
      </ChartExpandShell>
    </CalculatorPage>
  );
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
    nutrientGroup: "macro" | "micro" | "other";
  }>;
  compact?: boolean;
}) {
  const clampedRows = rows.map((row) => ({
    ...row,
    clampedDop: Math.max(-180, Math.min(180, row.dop)),
  }));
  const maxAbs = Math.max(20, ...clampedRows.map((row) => Math.abs(row.clampedDop)));
  const scaleMax = Math.min(180, Math.max(40, Math.ceil(maxAbs / 20) * 20));
  const chartRows = rows.map((row) => {
    const clamped = Math.max(-180, Math.min(180, row.dop));
    const height = `${Math.max(8, (Math.abs(clamped) / scaleMax) * 50)}%`;
    return {
      ...row,
      isNegative: clamped < 0,
      height,
    };
  });

  return (
      <div className={`calc-surface p-3 sm:p-4 ${compact ? "chart-panel--compact" : ""}`}>
      {!compact ? (
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-[#1c1c1e] dark-text-primary">{t.graphDop}</p>
        <p className="text-sm font-semibold text-[#6c6c70]">%</p>
      </div>
      ) : null}
      <div className="calc-surface-muted p-2 sm:p-3 overflow-x-auto">
        {chartRows.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noData}</p>
        ) : (
          <div className={compact ? "min-w-0 w-full" : "min-w-[42rem]"}>
            <div className="mb-1 flex justify-between px-1 text-[10px] font-bold text-slate-500">
              <span>+{scaleMax}%</span>
              <span>0%</span>
              <span>-{scaleMax}%</span>
            </div>
            <div
              className="calc-chart-plot relative grid h-72 items-stretch gap-3 px-2 py-3"
              style={{
                gridTemplateColumns: `repeat(${Math.max(chartRows.length, 1)}, minmax(2.8rem, 1fr))`,
              }}
            >
              <div className="pointer-events-none absolute left-2 right-2 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-slate-400/70" />
              <div className="pointer-events-none absolute bottom-3 left-2 right-2 top-3 bg-[linear-gradient(to_bottom,rgba(148,163,184,0.12)_1px,transparent_1px)] bg-[length:100%_25%]" />
              {chartRows.map((row, index) => (
                <div key={row.key} className="relative flex min-w-0 flex-col items-center justify-between">
                  <span className="calc-value-pill z-10">
                    {`${row.dop.toFixed(1)}%`}
                  </span>
                  <div className="relative my-2 h-full w-full">
                    <div
                      className={`absolute left-1/2 w-10 max-w-[78%] -translate-x-1/2 rounded-md shadow-md ring-1 ring-white/45 ${
                        row.isNegative
                          ? "top-1/2 rounded-t-none"
                          : "bottom-1/2 rounded-b-none"
                      }`}
                      style={{
                        height: row.height,
                        opacity: 0.95 - (index % 4) * 0.08,
                        background: getDopBarColor(row.nutrientGroup, row.isNegative),
                      }}
                      title={`${row.label}: ${row.value} | ${t.optimum}: ${row.optimum}`}
                    />
                  </div>
                  <span className="z-10 max-w-16 truncate text-[11px] font-extrabold text-green-950">
                    {row.label}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
              <span className="text-sky-700">{t.deficiency}</span>
              <span className="text-emerald-700">{t.optimum}</span>
              <span className="text-orange-700">{t.excess}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-600">
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: getDopBarColor("macro", false) }}
                />
                {t.macro}
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: getDopBarColor("micro", false) }}
                />
                {t.micro}
              </span>
            </div>
          </div>
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
  const width = 620;
  const height = 230;
  const paddingX = 42;
  const paddingTop = 24;
  const paddingBottom = 46;
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
      <div className="calc-surface grid gap-4 p-4">
      <div>
        <p className="text-sm font-extrabold text-green-950">{t.uptakeCurve}</p>
        <h2 className="mt-1 text-xl font-extrabold text-green-950">{profile.title}</h2>
        <p className="mt-1 text-sm font-semibold text-slate-600">
          {t.uptakeCurveDesc}
        </p>
      </div>

      <ChartExpandShell
        title={profile.title}
        closeLabel="Close"
        expandLabel="Expand chart"
        fullscreenClassName="chart-fullscreen--landscape"
      >
        <div className="calc-surface-muted overflow-x-auto p-2 sm:p-3 chart-panel--compact">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-52 w-full max-w-full sm:h-64 sm:min-w-[32rem] text-green-950"
            role="img"
            aria-label={t.uptakeCurve}
            preserveAspectRatio="xMidYMid meet"
          >
          <line x1={paddingX} y1={paddingTop} x2={paddingX} y2={height - paddingBottom} stroke="currentColor" strokeOpacity="0.25" />
          <line x1={paddingX} y1={height - paddingBottom} x2={width - paddingX} y2={height - paddingBottom} stroke="currentColor" strokeOpacity="0.25" />
          {[25, 50, 75, 100].map((tick) => {
            const y = paddingTop + (1 - tick / 100) * usableHeight;
            return (
              <g key={tick}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="currentColor" strokeOpacity="0.08" />
                <text x={12} y={y + 4} className="calc-chart-axis-label text-[11px] font-bold">
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
            strokeWidth="7"
            points={path}
          />
          {points.map(({ stage, x, y }, index) => (
            <g key={stage.label}>
              <circle
                cx={x}
                cy={y}
                r="8"
                fill={GRAPH_COLORS[index % GRAPH_COLORS.length]}
                className="calc-chart-dot"
                strokeWidth="3"
              />
              <text x={x} y={height - 25} textAnchor="middle" className="calc-chart-stage-label text-[11px] font-extrabold">
                {stage.label}
              </text>
              <text x={x} y={height - 9} textAnchor="middle" className="calc-chart-axis-label text-[10px] font-bold">
                {stage.timing}
              </text>
            </g>
          ))}
        </svg>
        </div>
      </ChartExpandShell>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="calc-surface-inner">
          <p className="text-sm font-extrabold text-green-950">{t.stageFocus}</p>
          <div className="mt-2 grid gap-2">
            {profile.stages.map((stage) => (
              <div key={stage.label} className="calc-stage-card">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-extrabold text-green-950">{stage.label}</span>
                  <span className="calc-uptake-pill">
                    {stage.uptake}%
                  </span>
                  {stage.focus.map((item) => (
                    <span key={item} className="calc-chip">
                      {item}
                    </span>
                  ))}
                </div>
                <p className="mt-1 text-xs font-semibold text-slate-600">{stage.note}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="calc-surface-inner">
          <p className="text-sm font-extrabold text-green-950">{t.nutrientTiming}</p>
          <div className="mt-2 grid gap-2">
            {profile.nutrients.map((item) => (
              <div key={item.symbol} className="calc-stage-card">
                <p className="font-extrabold text-green-950">{item.symbol}</p>
                <p className="text-xs font-bold text-green-800">{item.timing}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">{item.note}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 rounded-xl bg-yellow-50/90 p-3 text-xs font-bold text-yellow-900">
            {t.uptakeCurveNote}
          </p>
        </div>
      </div>
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

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

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

type GraphStyle = "histogram" | "line" | "pie";

function NutrientGraphs({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
  const [graphStyle, setGraphStyle] = useState<GraphStyle>("histogram");
  const nutrients = ["nitrogen", "phosphorus", "potassium", "calcium", "magnesium", "sulfur", "iron", "zinc", "manganese", "copper", "boron"]
    .map((key) => lab.get(key))
    .filter(Boolean) as CalculatorValue[];

  const maxValue = Math.max(...nutrients.map((item) => item.value), 1);

  return (
    <CalculatorPage>
      <div className="calc-surface p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <p className="text-sm font-bold text-[#1c1c1e] dark-text-primary">{t.macroMicro}</p>
          <SelectField
            label={t.graphStyle}
            value={graphStyle}
            onChange={(value) => setGraphStyle(value as GraphStyle)}
            options={[
              ["histogram", t.graphHistogram],
              ["line", t.graphLine],
              ["pie", t.graphPie],
            ]}
          />
        </div>

        <div className="mt-4 grid gap-3">
        {nutrients.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noData}</p>
        ) : graphStyle === "line" ? (
          <LineGraph nutrients={nutrients} maxValue={maxValue} />
        ) : graphStyle === "pie" ? (
          <PieGraph nutrients={nutrients} />
        ) : (
          <HistogramGraph nutrients={nutrients} maxValue={maxValue} />
        )}
        </div>
      </div>
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

function HistogramGraph({
  nutrients,
  maxValue,
}: {
  nutrients: CalculatorValue[];
  maxValue: number;
}) {
  return (
    <div className="overflow-x-auto rounded-2xl calc-surface-muted p-4">
      <div className="flex min-w-[34rem] items-end gap-3">
        {nutrients.map((item, index) => {
          const height = Math.max(16, Math.min(180, (item.value / maxValue) * 180));
          return (
            <div key={item.key} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-[11px] font-bold text-slate-600">
                {item.value}
              </span>
              <span
                className="w-full max-w-12 rounded-t-2xl shadow-sm"
                style={{
                  height,
                  background: `linear-gradient(180deg, ${GRAPH_COLORS[index % GRAPH_COLORS.length]}, var(--accent-600, #16a34a))`,
                }}
              />
              <span className="max-w-14 truncate text-[11px] font-extrabold text-green-950">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LineGraph({
  nutrients,
  maxValue,
}: {
  nutrients: CalculatorValue[];
  maxValue: number;
}) {
  const width = 640;
  const height = 260;
  const padding = 34;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const points = nutrients.map((item, index) => {
    const x =
      nutrients.length === 1
        ? width / 2
        : padding + (index / (nutrients.length - 1)) * usableWidth;
    const y = height - padding - (item.value / maxValue) * usableHeight;
    return { item, x, y };
  });
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="calc-surface-muted overflow-x-auto p-4">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-72 min-w-[38rem] text-green-900"
        role="img"
      >
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="currentColor" strokeOpacity="0.25" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="currentColor" strokeOpacity="0.25" />
        <polyline
          fill="none"
          stroke="var(--accent-700, #15803d)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="5"
          points={path}
        />
        {points.map(({ item, x, y }, index) => (
          <g key={item.key}>
            <circle
              cx={x}
              cy={y}
              r="7"
              fill={GRAPH_COLORS[index % GRAPH_COLORS.length]}
              className="calc-chart-dot"
              strokeWidth="3"
            />
            <text
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="calc-chart-stage-label text-[12px] font-bold"
            >
              {item.label}
            </text>
            <text
              x={x}
              y={Math.max(16, y - 12)}
              textAnchor="middle"
              className="calc-chart-axis-label text-[11px] font-bold"
            >
              {item.value}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function PieGraph({ nutrients }: { nutrients: CalculatorValue[] }) {
  const total = nutrients.reduce((sum, item) => sum + Math.max(0, item.value), 0) || 1;
  let start = 0;
  const slices = nutrients.map((item, index) => {
    const percent = Math.max(0, item.value) / total;
    const end = start + percent * 100;
    const slice = `${GRAPH_COLORS[index % GRAPH_COLORS.length]} ${start}% ${end}%`;
    start = end;
    return { item, slice, color: GRAPH_COLORS[index % GRAPH_COLORS.length], percent };
  });

  return (
    <div className="calc-surface grid gap-4 rounded-2xl p-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
      <div
        className="mx-auto h-56 w-56 rounded-full shadow-inner"
        style={{
          background: `conic-gradient(${slices.map((slice) => slice.slice).join(", ")})`,
        }}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {slices.map(({ item, color, percent }) => (
          <div key={item.key} className="calc-surface-inner flex items-center gap-2 px-3 py-2">
            <span className="h-3 w-3 rounded-full" style={{ background: color }} />
            <span className="min-w-0 flex-1 truncate text-sm font-bold text-green-950">
              {item.label}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {(percent * 100).toFixed(0)}%
            </span>
          </div>
        ))}
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
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
  t: Record<string, string>
) {
  const suggestions: Array<{ key: CalculatorKey; title: string; desc: string }> = [];
  const hasCriticalPh = results.some((result) => /ph/i.test(result.parameter_name) && ["warning", "negative"].includes(result.final_group_code || ""));
  const hasSalinity = results.some((result) => /conduct|ec|salin|sodium|sodio/i.test(result.parameter_name) && ["warning", "negative"].includes(result.final_group_code || ""));

  if (hasCriticalPh || lab.has("ph")) {
    suggestions.push({
      key: "amendment",
      title: t.amendmentRequirementTitle,
      desc: t.amendmentRequirementDesc,
    });
  }

  if (hasSalinity || lab.has("sodium")) {
    suggestions.push({
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
    suggestions.push({
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
    suggestions.push({
      key: "fertilizer",
      title: t.fertilizerPlanTab || t.fertilizerRequirementTitle,
      desc: t.fertilizerPlanDoseDesc || t.fertilizerPlanDesc || t.fertilizerRequirementDesc,
    });
    suggestions.push({
      key: "fertilizerCost",
      title: t.fertilizerCost || "Fertilizer cost",
      desc: t.fertilizerCostCta || "See prices & cost scenarios",
    });
  }

  suggestions.push({
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
      const optimum =
        Number.isFinite(rangeOptimum) && rangeOptimum > 0
          ? rangeOptimum
          : Math.max(0.01, fallbackOptimum || 1);
      const output = calculateDop(item.value, optimum);
      if (!output) return null;

      return {
        key,
        label: item.label || key.toUpperCase(),
        value: item.value,
        optimum,
        dop: output.value,
        nutrientGroup: getNutrientGroup(key),
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
    nutrientGroup: "macro" | "micro" | "other";
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

function getNutrientGroup(key: string): "macro" | "micro" | "other" {
  if (
    ["nitrogen", "phosphorus", "potassium", "calcium", "magnesium", "sulfur", "sodium"].includes(
      key
    )
  ) {
    return "macro";
  }

  if (["iron", "zinc", "manganese", "copper", "boron"].includes(key)) {
    return "micro";
  }

  return "other";
}

function getDopBarColor(group: "macro" | "micro" | "other", isNegative: boolean) {
  if (group === "macro") {
    return isNegative
      ? "linear-gradient(180deg, #0ea5e9, #0369a1)"
      : "linear-gradient(180deg, #f59e0b, #d97706)";
  }

  if (group === "micro") {
    return isNegative
      ? "linear-gradient(180deg, #8b5cf6, #6d28d9)"
      : "linear-gradient(180deg, #10b981, #047857)";
  }

  return isNegative
    ? "linear-gradient(180deg, #94a3b8, #475569)"
    : "linear-gradient(180deg, #9ca3af, #6b7280)";
}
