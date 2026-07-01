"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Calculator,
  Droplets,
  FlaskConical,
  Leaf,
  Percent,
  Sprout,
  Scale,
} from "lucide-react";
import {
  calculateCNRatio,
  calculateDop,
  calculateFertilizerRequirement,
  calculateGypsumRequirementByPsi,
  calculateLeachingRequirement,
  calculateNutrientRatio,
  calculatePorosity,
  calculatePsi,
  calculateSar,
  calculateSoilAmendment,
  calculateTotalWaterFromLeaching,
  type AreaUnit,
  type CalculationOutput,
  type CalculatorValue,
  type FertilizerMode,
  type LimeMethod,
} from "@/lib/agronomicCalculators";
import type { Language } from "@/lib/translations";
import { calculatorHubText } from "@/lib/i18n/componentText";
import { getUptakeProfileForCrop } from "@/lib/i18n/uptakeProfiles";
import {
  buildSoilFertilityPlan,
  fertilityPlanToCalculationOutputs,
  type FertilityPlanMode,
} from "@/lib/soilFertilityPlan";
import { useSoilFertilityReference } from "@/lib/soilFertilityData";
import { TABLE_12_AMENDMENTS, type AmendmentMaterialKey } from "@/lib/soilFertilityTables";
import {
  buildBaseSaturationOutputs,
  calculateBaseSaturation,
  diagnoseBaseBalance,
  type BaseRelationKey,
  type BaseSaturationResult,
} from "@/lib/baseSaturation";
import {
  CIC_RATIO_RANGES,
  interpretCationRatio,
  interpretCationSaturation,
  ratioBandLabelKey,
  saturationBandMessageKey,
  type CicRatioBand,
} from "@/lib/cicInterpretation";
import { useViewLayoutPreference } from "@/hooks/useViewLayoutPreference";
import { ViewLayoutToggle } from "@/components/ui/ViewLayoutToggle";
import BackButton from "@/components/ui/BackButton";
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
  goToValues?: () => void;
  onBack?: () => void;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
};

type CalculatorKey =
  | "priority"
  | "ratios"
  | "cic"
  | "fertilizer"
  | "amendment"
  | "dop"
  | "uptake"
  | "salinity"
  | "graphs";

const CalculatorFieldsLayoutContext = createContext<ViewLayoutMode>("grid");

const tabs: Array<{ key: CalculatorKey; icon: ReactNode }> = [
  { key: "priority", icon: <Activity size={17} /> },
  { key: "ratios", icon: <Scale size={17} /> },
  { key: "cic", icon: <Percent size={17} /> },
  { key: "fertilizer", icon: <Leaf size={17} /> },
  { key: "amendment", icon: <FlaskConical size={17} /> },
  { key: "dop", icon: <Calculator size={17} /> },
  { key: "uptake", icon: <Sprout size={17} /> },
  { key: "salinity", icon: <Droplets size={17} /> },
  { key: "graphs", icon: <BarChart3 size={17} /> },
];

function visibleCalculatorTabs(sampleType: "soil" | "foliar") {
  return tabs.filter(({ key }) => {
    if (key === "cic") return sampleType === "soil";
    if (key === "dop") return sampleType === "foliar";
    return true;
  });
}

const EARTH_DEPTH_OPTIONS = [
  { key: "0-20", depthCm: 20, factor: 1 },
  { key: "20-30", depthCm: 30, factor: 1.5 },
] as const;

type EarthDepthOption = (typeof EARTH_DEPTH_OPTIONS)[number]["key"];

function getEarthDepthOptionLabel(
  option: (typeof EARTH_DEPTH_OPTIONS)[number],
  t: Record<string, string>
) {
  return `${option.key} cm (${t.incorporationFactorShort || "f"} = ${option.factor})`;
}

function getEarthDepthOption(value: EarthDepthOption) {
  return (
    EARTH_DEPTH_OPTIONS.find((option) => option.key === value) ||
    EARTH_DEPTH_OPTIONS[0]
  );
}

export default function CalculatorHub({
  language,
  parameters,
  values,
  results,
  sampleType,
  selectedCropName,
  goToValues,
  onBack,
  onOutputsChange,
}: Props) {
  const t = calculatorHubText[language] || calculatorHubText.en;
  const defaultCalculatorFilter: CalculatorKey = "priority";
  const [active, setActive] = useState<CalculatorKey>(defaultCalculatorFilter);
  const [browseLayout, setBrowseLayout] = useViewLayoutPreference("calculator-hub");
  const [fieldsLayout] = useViewLayoutPreference("calculator-fields");
  const calculatorTabs = useMemo(
    () => visibleCalculatorTabs(sampleType),
    [sampleType]
  );
  const [calculatorOutputs, setCalculatorOutputs] = useState<Record<string, CalculationOutput[]>>({});
  const lab = useMemo(() => buildLabValueIndex(parameters, values, results), [parameters, values, results]);
  const suggestions = getSuggestions(lab, results, t);

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

  useEffect(() => {
    if (!onOutputsChange) return;
    onOutputsChange(
      Object.values(calculatorOutputs)
        .flat()
        .filter(Boolean)
        .map((output) => translateCalculationOutput(output, t))
    );
  }, [calculatorOutputs, onOutputsChange, t]);

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
            <ViewLayoutToggle
              value={browseLayout}
              onChange={setBrowseLayout}
              listLabel={t.viewLayoutList}
              gridLabel={t.viewLayoutGrid}
            />
          </div>
          {goToValues ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={goToValues}
                className="text-xs font-semibold text-green-800 underline-offset-2 hover:underline dark:text-green-300"
              >
                {t.openValues}
              </button>
            </div>
          ) : null}
        </div>

        <CalculatorFieldsLayoutContext.Provider value={fieldsLayout}>
        {browseLayout === "list" ? (
          <div className="px-4 pb-3">
            <label className="calculator-hub-picker grid gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                {t.calculatorPickerLabel}
              </span>
              <select
                value={active}
                onChange={(event) => setActive(event.target.value as CalculatorKey)}
                className="calc-field-input w-full"
              >
                {calculatorTabs.map((tab) => (
                  <option key={tab.key} value={tab.key}>
                    {t[tab.key]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : (
          <div className="calculator-hub-tabs overflow-x-auto scrollbar-none px-4 pb-3">
            <div className="flex w-max min-w-full gap-1.5">
              {calculatorTabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActive(tab.key)}
                  className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all ${
                    active === tab.key
                      ? "bg-green-700 text-white shadow-sm"
                      : "glass-chip text-[#3c3c43] shadow-[0_1px_3px_rgba(0,0,0,0.07)]"
                  }`}
                >
                  {tab.icon}
                  {t[tab.key]}
                </button>
              ))}
            </div>
          </div>
        )}

        {active === "priority" && browseLayout === "grid" ? (
          <PriorityCalculators t={t} suggestions={suggestions} setActive={setActive} />
        ) : null}
        {active === "priority" && browseLayout === "list" ? (
          <CalculatorPage>
            <p className="calc-surface p-4 text-sm text-slate-600">{t.calculatorListHint}</p>
          </CalculatorPage>
        ) : null}
        {active === "ratios" ? <RatioCalculator t={t} lab={lab} onOutputsChange={(outputs) => reportOutputs("ratios", outputs)} /> : null}
        {active === "cic" ? (
          <CicCalculator
            t={t}
            lab={lab}
            sampleType={sampleType}
            onOutputsChange={(outputs) => reportOutputs("cic", outputs)}
          />
        ) : null}
        {active === "fertilizer" ? (
          <FertilizerCalculator
            t={t}
            lab={lab}
            results={results}
            selectedCropName={selectedCropName}
            onOutputsChange={(outputs) => reportOutputs("fertilizer", outputs)}
          />
        ) : null}
        {active === "amendment" ? (
          <AmendmentCalculator
            t={t}
            lab={lab}
            sampleType={sampleType}
            selectedCropName={selectedCropName}
            onOutputsChange={(outputs) => reportOutputs("amendment", outputs)}
          />
        ) : null}
        {active === "dop" ? (
          sampleType === "foliar" ? (
            <DopCalculator
              t={t}
              lab={lab}
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
        {active === "salinity" ? <SalinityCalculator t={t} lab={lab} onOutputsChange={(outputs) => reportOutputs("salinity", outputs)} /> : null}
        {active === "graphs" ? <NutrientGraphs t={t} lab={lab} /> : null}
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

function RatioCalculator({
  t,
  lab,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const cn = calculateCNRatio(lab.get("organic_carbon")?.value || lab.get("organic_matter")?.value || 0, lab.get("nitrogen")?.value || 0);
  const caMg = calculateNutrientRatio(
    lab.get("calcium") || { key: "ca", label: "Ca", value: 0 },
    lab.get("magnesium") || { key: "mg", label: "Mg", value: 0 }
  );
  const kMg = calculateNutrientRatio(
    lab.get("potassium") || { key: "k", label: "K", value: 0 },
    lab.get("magnesium") || { key: "mg", label: "Mg", value: 0 }
  );
  const outputs = [cn, caMg, kMg].filter(Boolean) as CalculationOutput[];

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

  return (
    <CalculatorPage>
      <OutputGrid t={t} outputs={outputs} title={t.ratios} />
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
  const [cec, setCec] = useState(lab.get("cec")?.value || 0);
  const [ca, setCa] = useState(lab.get("calcium")?.value || 0);
  const [mg, setMg] = useState(lab.get("magnesium")?.value || 0);
  const [k, setK] = useState(lab.get("potassium")?.value || 0);
  const [na, setNa] = useState(lab.get("sodium")?.value || 0);
  const [relationFilter, setRelationFilter] = useState<BaseRelationKey>("all");

  const baseResult = useMemo(
    () =>
      calculateBaseSaturation({
        cec,
        ca,
        mg,
        k,
        na,
      }),
    [cec, ca, mg, k, na]
  );

  const diagnostics = useMemo(() => {
    if (!baseResult) return [];
    return diagnoseBaseBalance(baseResult, {
      ca: t.cicCa || "Ca",
      mg: t.cicMg || "Mg",
      k: t.cicK || "K",
      total: t.cicTotalBases || "Total bases",
      caMg: "Ca/Mg",
      mgK: "Mg/K",
      low: t.cicLow || "Below ideal range — consider amendment or fertilizer adjustment.",
      optimal: t.cicOptimal || "Within typical base balance range.",
      high: t.cicHigh || "Above ideal range — review before fertilizing.",
      limeSuggested:
        t.cicLimeSuggested ||
        "Low base saturation — evaluate agricultural lime or dolomite before fertilizer plan.",
      gypsumSuggested:
        t.cicGypsumSuggested ||
        "Elevated sodium — gypsum may help displace Na (no PRNT applies to gypsum).",
      kAdjustment: t.cicKHigh || "High K saturation — reduce K fertilizer and check Ca/Mg balance.",
      mgAdjustment: t.cicMgLow || "Low Mg saturation — dolomitic lime or Mg source may be needed.",
    });
  }, [baseResult, t]);

  const outputs = useMemo(() => {
    if (!baseResult) return [];
    return buildBaseSaturationOutputs(baseResult, relationFilter);
  }, [baseResult, relationFilter]);

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
    ["all", t.cicRelationAll || "All relations"],
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
          interpretation: interpretCationRatio(relationFilter, baseResult.relations[relationFilter]),
        }
      : null;

  return (
    <CalculatorPage>
      <div className="calc-page__params calc-surface p-4">
        <CalculatorFormFields className="calc-form-fields--grid">
          <NumberField label={t.cicLabel || "CIC / CICe"} value={cec} onChange={setCec} />
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
        </CalculatorFormFields>
        <p className="mt-3 text-xs leading-relaxed text-[#6c6c70]">
          {t.cicHelp ||
            "Enter exchangeable bases and CIC in consistent units (cmol(+)/kg or meq/100 g). Use this step before liming or fertilizing."}
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

      {selectedRatio ? <CicRatioHighlightCard ratio={selectedRatio} t={t} /> : null}

      {baseResult ? (
        <CicResultsPanel baseResult={baseResult} relationFilter={relationFilter} t={t} />
      ) : (
        <p className="calc-cic-result calc-cic-result--empty calc-surface p-4 text-sm text-slate-600">
          {t.noData}
        </p>
      )}

      {diagnostics.length > 0 && relationFilter === "all" ? (
        <div className="calc-surface p-4">
          <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.cicDiagnosis || "Base balance diagnosis"}
          </h3>
          <ul className="mt-3 space-y-2">
            {diagnostics.map((item) => (
              <li key={item.key} className={`calc-cic-diagnosis calc-cic-diagnosis--${item.level}`}>
                <span className="font-extrabold">{item.label}</span>
                {item.value !== null ? `: ${item.value}${item.unit}` : ""}
                <span className="opacity-90"> · {item.message}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </CalculatorPage>
  );
}

function CicRatioHighlightCard({
  ratio,
  t,
}: {
  ratio: {
    key: Exclude<BaseRelationKey, "all">;
    label: string;
    value: number | null;
    interpretation: ReturnType<typeof interpretCationRatio>;
  };
  t: Record<string, string>;
}) {
  const range = CIC_RATIO_RANGES[ratio.key];
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
  relationFilter,
  t,
}: {
  baseResult: BaseSaturationResult;
  relationFilter: BaseRelationKey;
  t: Record<string, string>;
}) {
  const layout = useContext(CalculatorFieldsLayoutContext);
  const saturationRows: Array<{
    key: string;
    label: string;
    value: number;
    cation?: "ca" | "mg" | "k" | "na";
    isTotal?: boolean;
  }> = [
    { key: "ca", label: t.cicCaSaturation || "Ca saturation", value: baseResult.caPercent, cation: "ca" },
    { key: "mg", label: t.cicMgSaturation || "Mg saturation", value: baseResult.mgPercent, cation: "mg" },
    { key: "k", label: t.cicKSaturation || "K saturation", value: baseResult.kPercent, cation: "k" },
    { key: "na", label: t.cicNaSaturation || "Na saturation", value: baseResult.naPercent, cation: "na" },
    {
      key: "total",
      label: t.cicTotalBases || "Total base saturation (V%)",
      value: baseResult.totalBasePercent,
      isTotal: true,
    },
  ];

  const relationRows: Array<[Exclude<BaseRelationKey, "all">, string]> = [
    ["ca_mg", "Ca/Mg"],
    ["mg_k", "Mg/K"],
    ["ca_k", "Ca/K"],
    ["k_na", "K/Na"],
    ["ca_na", "Ca/Na"],
  ];

  return (
    <div className={`calc-cic-results calc-cic-results--${layout}`}>
      {saturationRows.map((row) => {
        if (row.isTotal) {
          const messageKey =
            row.value < 75 ? "cicVPercentLow" : row.value > 80 ? "cicVPercentHigh" : "cicVPercentAdequate";
          const band: CicRatioBand =
            row.value >= 75 && row.value <= 80 ? "optimal" : row.value < 75 ? "low" : "high";
          return (
            <CicResultCard
              key={row.key}
              label={row.label}
              value={row.value}
              unit="%"
              band={band}
              bandLabel={t[ratioBandLabelKey(band)] || band}
              interpretation={t[messageKey] || messageKey}
              rangeNote={`CICe ${baseResult.cec} cmol(+)/kg · ${t.cicVPercentTarget || "75–80% for tropical crops"}`}
            />
          );
        }

        const sat = interpretCationSaturation(row.cation!, row.value);
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
            bandLabel={t[saturationBandMessageKey(sat.band)] || t[ratioBandLabelKey(bandForUi)] || sat.band}
            interpretation={t[saturationBandMessageKey(sat.band)] || saturationBandMessageKey(sat.band)}
            rangeNote={`${t.cicTableBand || "Table band"}: ${sat.rangeLabel}`}
          />
        );
      })}

      {relationFilter === "all"
        ? relationRows.map(([key, label]) => {
            const value = baseResult.relations[key];
            if (value === null) return null;
            const interpretation = interpretCationRatio(key, value);
            return (
              <CicResultCard
                key={key}
                label={label}
                value={value}
                unit=":1"
                band={interpretation.band}
                bandLabel={t[ratioBandLabelKey(interpretation.band)] || interpretation.band}
                interpretation={t[interpretation.messageKey] || interpretation.messageKey}
                rangeNote={`${t.cicTargetRange || "Target range"}: ${interpretation.optimalMin}–${interpretation.optimalMax}`}
              />
            );
          })
        : null}
    </div>
  );
}

function CicResultCard({
  label,
  value,
  unit,
  band,
  bandLabel,
  interpretation,
  rangeNote,
}: {
  label: string;
  value: number;
  unit: string;
  band: CicRatioBand;
  bandLabel: string;
  interpretation: string;
  rangeNote?: string;
}) {
  return (
    <article className={`calc-cic-result calc-cic-result--${band}`}>
      <div className="calc-cic-result__head">
        <p className="calc-cic-result__label">{label}</p>
        {bandLabel ? (
          <span className={`calc-cic-band calc-cic-band--${band}`}>{bandLabel}</span>
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

function FertilizerPlanCalculator({
  t,
  lab,
  selectedCropName,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  selectedCropName?: string | null;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const { reference } = useSoilFertilityReference();
  const [modo, setModo] = useState<FertilityPlanMode>("completo");
  const [rendimiento, setRendimiento] = useState(4);
  const [depth, setDepth] = useState(30);
  const [bulkDensity, setBulkDensity] = useState(lab.get("bulk_density")?.value || 1);
  const [effN, setEffN] = useState(60);
  const [effP, setEffP] = useState(30);
  const [effK, setEffK] = useState(70);
  const [effMg, setEffMg] = useState(70);
  const [prnt, setPrnt] = useState(95);
  const [enmienda, setEnmienda] = useState<AmendmentMaterialKey>("cal_agricola");
  const [manualN, setManualN] = useState(0);
  const [manualP2o5, setManualP2o5] = useState(0);
  const [manualK2o, setManualK2o] = useState(0);
  const [manualMgo, setManualMgo] = useState(0);

  const plan = useMemo(
    () =>
      buildSoilFertilityPlan(
        {
          modo,
          cultivo: selectedCropName,
          rendimientoObjetivo: rendimiento,
          profundidadMuestreo_cm: depth,
          densidadAparente_g_cm3: bulkDensity,
          ph: lab.get("ph")?.value,
          acidezExtraible: lab.get("exchangeable_acidity")?.value,
          K: lab.get("potassium")?.value,
          Ca: lab.get("calcium")?.value,
          Mg: lab.get("magnesium")?.value,
          Na: lab.get("sodium")?.value,
          P: lab.get("phosphorus")?.value,
          Fe: lab.get("iron")?.value,
          Cu: lab.get("copper")?.value,
          Zn: lab.get("zinc")?.value,
          Mn: lab.get("manganese")?.value,
          materiaOrganica: lab.get("organic_matter")?.value,
          eficienciaN: effN / 100,
          eficienciaP: effP / 100,
          eficienciaK: effK / 100,
          eficienciaMg: effMg / 100,
          PRNT: prnt,
          enmiendaSeleccionada: enmienda,
          demandaN_manual: modo === "solo_dosis" ? manualN : undefined,
          demandaP2o5_manual: modo === "solo_dosis" ? manualP2o5 : undefined,
          demandaK2o_manual: modo === "solo_dosis" ? manualK2o : undefined,
          demandaMgo_manual: modo === "solo_dosis" ? manualMgo : undefined,
        },
        reference
      ),
    [
      modo,
      selectedCropName,
      rendimiento,
      depth,
      bulkDensity,
      effN,
      effP,
      effK,
      effMg,
      prnt,
      enmienda,
      manualN,
      manualP2o5,
      manualK2o,
      manualMgo,
      lab,
      reference,
    ]
  );

  const outputs = useMemo(
    () => (plan ? fertilityPlanToCalculationOutputs(plan) : []),
    [plan]
  );

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

  return (
    <div className="calc-page space-y-4">
      <div className="fertilizer-plan__params calc-surface p-4">
        {selectedCropName ? (
          <div className="calc-page__crop mb-4 flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5">
            <Sprout size={16} className="shrink-0 text-green-700" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-800/70">
                {t.fertilizerPlanCrop}
              </p>
              <p className="text-sm font-bold text-green-950">{selectedCropName}</p>
            </div>
          </div>
        ) : null}

        <CalculatorFormFields className="calc-form-fields--grid">
          <SelectField
            label={t.fertilizerPlanMode}
            value={modo}
            onChange={(value) => setModo(value as FertilityPlanMode)}
            fullWidth
            options={[
              ["completo", t.fertilizerPlanModeFull],
              ["solo_dosis", t.fertilizerPlanModeDose],
            ]}
          />
          <NumberField
            label={t.fertilizerPlanYield}
            value={rendimiento}
            onChange={setRendimiento}
          />
          <NumberField label={t.depth} value={depth} onChange={setDepth} />
          <NumberField label={t.bulkDensity} value={bulkDensity} onChange={setBulkDensity} />
        </CalculatorFormFields>

        <p className="mt-4 mb-2 text-xs font-semibold text-[#6c6c70]">{t.efficiency}</p>
        <CalculatorFormFields className="calc-form-fields--grid">
          <NumberField label="N (%)" value={effN} onChange={setEffN} preserveCase />
          <NumberField label="P (%)" value={effP} onChange={setEffP} preserveCase />
          <NumberField label="K (%)" value={effK} onChange={setEffK} preserveCase />
          <NumberField label="Mg (%)" value={effMg} onChange={setEffMg} preserveCase />
        </CalculatorFormFields>

        {modo === "completo" ? (
          <CalculatorFormFields className="calc-form-fields--grid mt-4">
            <SelectField
              label={t.amendmentMaterial}
              value={enmienda}
              onChange={(value) => setEnmienda(value as AmendmentMaterialKey)}
              options={Object.values(TABLE_12_AMENDMENTS).map((item) => [item.key, item.label])}
            />
            <NumberField label={t.prntPercent} value={prnt} onChange={setPrnt} />
          </CalculatorFormFields>
        ) : (
          <CalculatorFormFields className="calc-form-fields--grid mt-4">
            <NumberField
              label={t.fertilizerPlanDemandN}
              value={manualN}
              onChange={setManualN}
            />
            <NumberField
              label={t.fertilizerPlanDemandP}
              value={manualP2o5}
              onChange={setManualP2o5}
            />
            <NumberField
              label={t.fertilizerPlanDemandK}
              value={manualK2o}
              onChange={setManualK2o}
            />
            <NumberField
              label={t.fertilizerPlanDemandMg}
              value={manualMgo}
              onChange={setManualMgo}
            />
          </CalculatorFormFields>
        )}
      </div>

      {plan ? (
        <>
          <div className="fertilizer-plan__results calc-surface p-4">
            <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
              {t.fertilizerPlanSummary}
            </h3>
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              {plan.doses.map((dose) => (
                <div
                  key={dose.nutrient}
                  className={`calc-result-card rounded-xl px-3 py-3 ${
                    dose.notRequired ? "calc-result-card--muted" : "calc-result-card--active"
                  }`}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                    {dose.nutrient}
                  </p>
                  <p className="mt-1 text-2xl font-extrabold leading-none text-green-950">
                    {dose.notRequired ? "NF" : dose.dosis}
                    {!dose.notRequired ? (
                      <span className="ml-1 text-xs font-semibold">{dose.unit}</span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {plan.conclusiones.length > 0 ? (
            <div className="fertilizer-plan__interpretation calc-surface p-4">
              <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
                {t.fertilizerPlanConclusions}
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-[#3c3c43]">
                {plan.conclusiones.map((line) => (
                  <li key={line} className="flex gap-2">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-green-600" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : (
        <div className="calc-surface p-4">
          <p className="text-sm text-slate-500">{t.noData}</p>
        </div>
      )}
    </div>
  );
}

function FertilizerSingleCalculator({
  t,
  lab,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const [element, setElement] = useState("nitrogen");
  const [target, setTarget] = useState(80);
  const [grade, setGrade] = useState(20);
  const [area, setArea] = useState(1);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>("ha");
  const [efficiency, setEfficiency] = useState(85);
  const [mode, setMode] = useState<FertilizerMode>("element");
  const current = lab.get(element)?.value || 0;
  const output = calculateFertilizerRequirement({
    current,
    target,
    nutrientPercent: grade,
    area,
    areaUnit,
    efficiencyPercent: efficiency,
    mode,
  });

  useEffect(() => {
    onOutputsChange?.(output ? [output] : []);
  }, [onOutputsChange, output]);

  return (
    <CalculatorPanel
      t={t}
      output={output}
      fields={
        <>
          <SelectField
            label={t.nutrientElement}
            value={element}
            onChange={setElement}
            fullWidth
            options={[
              ["nitrogen", "N"],
              ["phosphorus", "P"],
              ["potassium", "K"],
              ["calcium", "Ca"],
              ["magnesium", "Mg"],
              ["sulfur", "S"],
            ]}
          />
          <NumberField label={t.current} value={current} readOnly />
          <NumberField label={t.target} value={target} onChange={setTarget} />
          <NumberField label={t.nutrientGrade} value={grade} onChange={setGrade} />
          <NumberField label={t.efficiency} value={efficiency} onChange={setEfficiency} />
          <AreaFields t={t} area={area} setArea={setArea} areaUnit={areaUnit} setAreaUnit={setAreaUnit} />
          <SelectField
            label={t.mode}
            value={mode}
            onChange={(value) => setMode(value as FertilizerMode)}
            options={[
              ["element", t.element],
              ["oxide", t.oxide],
            ]}
          />
        </>
      }
    />
  );
}

function FertilizerCalculator({
  t,
  lab,
  results: _results,
  selectedCropName,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  results: ResultLite[];
  selectedCropName?: string | null;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const [view, setView] = useState<"single" | "plan">("plan");

  return (
    <CalculatorPage>
      <div className="app-segmented-control">
        <button
          type="button"
          onClick={() => setView("plan")}
          className={`app-segmented-control__btn ${
            view === "plan" ? "app-segmented-control__btn--active" : ""
          }`}
        >
          {t.fertilizerPlanTab}
        </button>
        <button
          type="button"
          onClick={() => setView("single")}
          className={`app-segmented-control__btn ${
            view === "single" ? "app-segmented-control__btn--active" : ""
          }`}
        >
          {t.fertilizerSingleTab}
        </button>
      </div>
      {view === "plan" ? (
        <FertilizerPlanCalculator
          t={t}
          lab={lab}
          selectedCropName={selectedCropName}
          onOutputsChange={onOutputsChange}
        />
      ) : (
        <FertilizerSingleCalculator t={t} lab={lab} onOutputsChange={onOutputsChange} />
      )}
    </CalculatorPage>
  );
}

function AmendmentCalculator({
  t,
  lab,
  sampleType,
  selectedCropName,
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  sampleType: "soil" | "foliar";
  selectedCropName?: string | null;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const cropSuggestedV2 = suggestEarthBaseSaturationTarget(selectedCropName);
  const earthAvailable = sampleType === "soil" || hasSoilLabValues(lab);
  const [method, setMethod] = useState<LimeMethod>("earth_practical");
  const [targetPh, setTargetPh] = useState(6.2);
  const [acidity, setAcidity] = useState(lab.get("exchangeable_acidity")?.value || 0);
  const [baseSaturationCurrent, setBaseSaturationCurrent] = useState(
    lab.get("base_saturation")?.value || 50
  );
  const [baseSaturationTarget, setBaseSaturationTarget] = useState(cropSuggestedV2);
  const [effectiveCec, setEffectiveCec] = useState(lab.get("cec")?.value || 10);
  const [earthDepthOption, setEarthDepthOption] = useState<EarthDepthOption>("0-20");
  const [incorporationFactor, setIncorporationFactor] = useState(1);
  const [rndt, setRndt] = useState(90);
  const [bulkDensity, setBulkDensity] = useState(lab.get("bulk_density")?.value || 1.25);
  const [depth, setDepth] = useState(20);
  const [area, setArea] = useState(1);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>("ha");

  useEffect(() => {
    if (!earthAvailable && method === "earth_practical") {
      setMethod("target_ph");
    }
  }, [earthAvailable, method]);

  useEffect(() => {
    setBaseSaturationTarget(cropSuggestedV2);
  }, [cropSuggestedV2]);

  function handleEarthDepthChange(value: string) {
    const next = getEarthDepthOption(value as EarthDepthOption);
    setEarthDepthOption(next.key);
    setDepth(next.depthCm);
    setIncorporationFactor(next.factor);
  }

  const output = calculateSoilAmendment({
    method,
    material: method === "target_ph" ? "calcitic_lime" : "dolomitic_lime",
    currentPh: lab.get("ph")?.value,
    targetPh,
    exchangeableAcidity: acidity,
    baseSaturationCurrent,
    baseSaturationTarget,
    effectiveCec,
    incorporationFactor,
    rndtPercent: rndt,
    bulkDensity,
    depthCm: depth,
    area,
    areaUnit,
  });

  useEffect(() => {
    onOutputsChange?.(output ? [output] : []);
  }, [onOutputsChange, output]);

  return (
    <CalculatorPage>
      <CalculatorPanel
        t={t}
        output={output}
        fields={
          <>
            <SelectField
              label={t.limeMethod}
              value={method}
              onChange={(value) => setMethod(value as LimeMethod)}
              fullWidth
              options={[
                ...(earthAvailable ? ([["earth_practical", t.earthPractical]] as Array<[string, string]>) : []),
                ["target_ph", t.targetPh],
                ["exchangeable_acidity", t.acidity],
                ["buffer_index", t.buffer],
              ]}
            />
          {!earthAvailable ? (
            <p className="text-xs font-semibold text-yellow-900 sm:col-span-2">
              {t.earthSoilOnly || "The base-saturation method is available only for soil lab tests."}
            </p>
          ) : null}
          {method === "earth_practical" ? (
            <>
              <NumberField
                label={t.baseSaturationCurrent || "Current base saturation V1 (%)"}
                value={baseSaturationCurrent}
                onChange={setBaseSaturationCurrent}
              />
              <NumberField
                label={t.baseSaturationTarget || "Target base saturation V2 (%)"}
                value={baseSaturationTarget}
                onChange={setBaseSaturationTarget}
              />
              <p className="text-xs font-semibold text-slate-600 sm:col-span-2">
                {`${t.v2SuggestedByCrop || "V2 suggested by selected crop"}: ${cropSuggestedV2}%`}
              </p>
              <NumberField
                label={t.effectiveCec || "Effective CEC (CICE)"}
                value={effectiveCec}
                onChange={setEffectiveCec}
              />
              <NumberField label={t.prntPercent || "PRNT (%)"} value={rndt} onChange={setRndt} />
              <SelectField
                label={t.incorporationDepth || "Incorporation depth"}
                value={earthDepthOption}
                onChange={handleEarthDepthChange}
                options={EARTH_DEPTH_OPTIONS.map((option) => [
                  option.key,
                  getEarthDepthOptionLabel(option, t),
                ])}
              />
              <NumberField
                label={t.incorporationFactor || "Incorporation factor (f)"}
                value={incorporationFactor}
                onChange={setIncorporationFactor}
              />
              <p className="text-xs font-semibold text-slate-600 sm:col-span-2">
                {t.incorporationDepthNote ||
                  "The selected depth sets f automatically; adjust f only if your local recommendation uses another incorporation factor."}
              </p>
            </>
          ) : (
            <>
              <NumberField label="pH" value={lab.get("ph")?.value || 0} readOnly />
              <NumberField label={t.target} value={targetPh} onChange={setTargetPh} />
              <NumberField label={t.acidity} value={acidity} onChange={setAcidity} />
              <NumberField label={t.rndt} value={rndt} onChange={setRndt} />
              <NumberField label={t.bulkDensity} value={bulkDensity} onChange={setBulkDensity} />
              <NumberField label={t.depth} value={depth} onChange={setDepth} />
            </>
          )}
          <AreaFields t={t} area={area} setArea={setArea} areaUnit={areaUnit} setAreaUnit={setAreaUnit} />
        </>
      }
      />
    </CalculatorPage>
  );
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
        <CalculatorFormFields className="calc-form-fields--grid">
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
  onOutputsChange,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
}) {
  const [ecw, setEcw] = useState(1);
  const [eceTarget, setEceTarget] = useState(2);
  const [psiTarget, setPsiTarget] = useState(10);
  const [etValue, setEtValue] = useState(5);
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
          <CalculatorFormFields className="calc-form-fields--grid">
            <NumberField label={t.ecw} value={ecw} onChange={setEcw} />
            <NumberField label={t.eceTarget} value={eceTarget} onChange={setEceTarget} />
            <NumberField label={t.psiTarget} value={psiTarget} onChange={setPsiTarget} />
            <NumberField label="ET" value={etValue} onChange={setEtValue} preserveCase />
          </CalculatorFormFields>
        </div>
        <OutputGrid t={t} outputs={outputs} title={t.salinityRequirementTitle || t.salinity} />
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
}: {
  t: Record<string, string>;
  fields: ReactNode;
  output: CalculationOutput | null;
}) {
  return (
    <>
      <div className="calc-page__params calc-surface p-4">
        <CalculatorFormFields className="calc-form-fields--grid">{fields}</CalculatorFormFields>
      </div>
      <OutputCard t={t} output={output} title={t.result} />
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
  const layoutColumns = layout === "grid" ? "grid-cols-2" : "grid-cols-1";

  return (
    <div
      className={`calc-form-fields calc-form-fields--${layout} grid gap-3 ${layoutColumns}${className ? ` ${className}` : ""}`}
    >
      {children}
    </div>
  );
}

function OutputGrid({
  t,
  outputs,
  title,
}: {
  t: Record<string, string>;
  outputs: Array<CalculationOutput | null>;
  title?: string;
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
          <OutputCard key={output.label || index} t={t} output={output} compact />
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
}: {
  t: Record<string, string>;
  output: CalculationOutput | null;
  title?: string;
  compact?: boolean;
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
        {translatedOutput.notes.length > 0 ? (
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
        {translatedOutput.notes.length > 0 ? (
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
    "Fertilizer requirement": t.fertilizerRequirementTitle,
    "Calculate product quantity by nutrient grade, efficiency, and area.":
      t.fertilizerRequirementDesc,
    "Calculate product quantity by nutrient grade, efficiency, and area":
      t.fertilizerRequirementDesc,
    "Calculate the amount of product based on nutrient grade, efficiency, and area.":
      t.fertilizerRequirementDesc,
    "Gypsum requirement": t.gypsumRequirementTitle,
    "Gypsum (meq/100 g)": t.gypsumMeqTitle,
    "Gypsum (mg/100 g)": t.gypsumMgTitle,
    "Gypsum (kg/t)": t.gypsumKgTitle,
    "Lime requirement": t.limeRequirementTitle,
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
    "(target - current) / nutrient fraction / efficiency * area":
      t.fertilizerFormula,
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
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  preserveCase?: boolean;
}) {
  const [text, setText] = useState(() => formatNumberInput(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(formatNumberInput(value));
  }, [value]);

  return (
    <label
      className={`grid gap-1 text-sm font-bold text-green-950${preserveCase ? " calc-field-label--element" : ""}`}
    >
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        readOnly={readOnly}
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
    <label
      className={`grid gap-1 text-sm font-bold text-green-950${fullWidth ? " col-span-full" : ""}`}
    >
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="calc-field-input"
      >
        {options.map(([optionValue, labelText]) => <option key={optionValue} value={optionValue}>{labelText}</option>)}
      </select>
    </label>
  );
}

function AreaFields({
  t,
  area,
  setArea,
  areaUnit,
  setAreaUnit,
}: {
  t: Record<string, string>;
  area: number;
  setArea: (value: number) => void;
  areaUnit: AreaUnit;
  setAreaUnit: (value: AreaUnit) => void;
}) {
  return (
    <>
      <NumberField label={t.area} value={area} onChange={setArea} />
      <SelectField label={t.unit} value={areaUnit} onChange={(value) => setAreaUnit(value as AreaUnit)} options={[["ha", "ha"], ["carreau", "carreau"], ["acre", "acre"], ["m2", "m²"]]} />
    </>
  );
}

function suggestEarthBaseSaturationTarget(cropName?: string | null) {
  const normalizedCrop = normalizeName(cropName || "");
  if (!normalizedCrop) return 70;

  const rules: Array<{ pattern: RegExp; value: number }> = [
    { pattern: /\b(arroz|rice|trigo|wheat|pasto|pasture|forage|pineapple|pina|piña)\b/, value: 50 },
    { pattern: /\b(soya|soja|soybean|cana|caña|sugarcane|algodon|algodao|cotton|frijol|frejol|bean)\b/, value: 60 },
    { pattern: /\b(banano|banana|platano|plantain|aguacate|avocado)\b/, value: 65 },
    { pattern: /\b(maiz|maize|corn|citricos|citrus|cafe|coffee|guayaba|guava|higo|fig|durazno|peach)\b/, value: 70 },
    { pattern: /\b(tomate|tomato|pepino|cucumber|pimiento|pepper|brocoli|broccoli|cebolla|onion|rabano|radish|hortaliza|vegetable|mango|papaya|maracuya|passion fruit|uva|uvas|grape)\b/, value: 80 },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(normalizedCrop)) return rule.value;
  }

  return 70;
}

function buildLabValueIndex(
  parameters: ParameterLite[],
  values: Record<string, string>,
  results: ResultLite[]
) {
  const map = new Map<string, CalculatorValue>();
  for (const parameter of parameters) {
    const numericValue = Number(String(values[parameter.parameter_key] || "").replace(",", "."));
    if (!Number.isFinite(numericValue)) continue;
    addKnownValue(map, parameter.display_name || parameter.parameter_name, parameter.symbol, numericValue);
  }

  for (const result of results) {
    addKnownValue(
      map,
      result.display_parameter_name || result.parameter_name,
      undefined,
      result.value,
      result.unit_symbol
    );
  }

  return map;
}

function addKnownValue(
  map: Map<string, CalculatorValue>,
  label: string,
  symbol: string | null | undefined,
  value: number,
  unit?: string
) {
  const normalized = normalizeName(`${label} ${symbol || ""}`);
  const keys = [
    ["ph", /\bph\b/],
    ["nitrogen", /\b(n|nitrogen|nitrogeno|azote)\b/],
    ["phosphorus", /\b(p|phosphorus|fosforo|phosphore)\b/],
    ["potassium", /\b(k|potassium|potasio)\b/],
    ["calcium", /\b(ca|calcium|calcio)\b/],
    ["magnesium", /\b(mg|magnesium|magnesio)\b/],
    ["sulfur", /\b(s|sulfur|azufre|soufre)\b/],
    ["sodium", /\b(na|sodium|sodio)\b/],
    ["iron", /\b(fe|iron|hierro|fer)\b/],
    ["zinc", /\b(zn|zinc)\b/],
    ["manganese", /\b(mn|manganese|manganeso)\b/],
    ["copper", /\b(cu|copper|cobre|cuivre)\b/],
    ["boron", /\b(b|boron|boro|bore)\b/],
    ["organic_matter", /\b(organic matter|materia organica|matiere organique|om|mo)\b/],
    ["organic_carbon", /\b(organic carbon|carbono organico)\b/],
    ["exchangeable_acidity", /\b(acidity|acidez|h\+al)\b/],
    ["bulk_density", /\b(bulk density|densidad aparente|da)\b/],
    ["cec", /\b(cec|cice|cic|ctc|cation exchange capacity|capacidad de intercambio cationico)\b/],
    ["base_saturation", /\b(base saturation|saturacion de bases|saturacao de bases|v%|sb)\b/],
  ] as const;

  for (const [key, pattern] of keys) {
    if (pattern.test(normalized) && !map.has(key)) {
      map.set(key, { key, label: symbol || label, value, unit });
    }
  }
}

function hasSoilLabValues(lab: Map<string, CalculatorValue>) {
  const soilKeys = [
    "cec",
    "base_saturation",
    "ph",
    "exchangeable_acidity",
    "calcium",
    "magnesium",
  ] as const;

  return soilKeys.some((key) => lab.has(key));
}

function getSuggestions(
  lab: Map<string, CalculatorValue>,
  results: ResultLite[],
  t: Record<string, string>
) {
  const suggestions: Array<{ key: CalculatorKey; title: string; desc: string }> = [];
  const hasCriticalPh = results.some((result) => /ph/i.test(result.parameter_name) && ["warning", "negative"].includes(result.final_group_code || ""));
  const hasSalinity = results.some((result) => /conduct|ec|salin|sodium|sodio/i.test(result.parameter_name) && ["warning", "negative"].includes(result.final_group_code || ""));

  suggestions.push({
    key: "fertilizer",
    title: t.fertilizerRequirementTitle,
    desc: t.fertilizerRequirementDesc,
  });

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
