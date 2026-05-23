"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  BarChart3,
  Calculator,
  Droplets,
  FlaskConical,
  Layers3,
  Leaf,
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
};

type CalculatorKey =
  | "all"
  | "priority"
  | "ratios"
  | "fertilizer"
  | "amendment"
  | "dop"
  | "salinity"
  | "graphs";


const tabs: Array<{ key: CalculatorKey; icon: ReactNode }> = [
  { key: "all", icon: <Layers3 size={17} /> },
  { key: "priority", icon: <Activity size={17} /> },
  { key: "ratios", icon: <Scale size={17} /> },
  { key: "fertilizer", icon: <Leaf size={17} /> },
  { key: "amendment", icon: <FlaskConical size={17} /> },
  { key: "dop", icon: <Calculator size={17} /> },
  { key: "salinity", icon: <Droplets size={17} /> },
  { key: "graphs", icon: <BarChart3 size={17} /> },
];

export default function CalculatorHub({
  language,
  parameters,
  values,
  results,
  sampleType,
  selectedCropName,
  goToValues,
  onBack,
}: Props) {
  const t = calculatorHubText[language] || calculatorHubText.en;
  const defaultCalculatorFilter: CalculatorKey = "priority";
  const [active, setActive] = useState<CalculatorKey>(defaultCalculatorFilter);
  const lab = useMemo(() => buildLabValueIndex(parameters, values, results), [parameters, values, results]);
  const suggestions = getSuggestions(lab, results, t);

  return (
    <section className="mt-6 animate-slide-up">
      <div className="values-screen-panel rounded-3xl p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <button
              type="button"
              onClick={() => {
                if (active !== defaultCalculatorFilter) {
                  setActive(defaultCalculatorFilter);
                  return;
                }
                onBack?.();
              }}
              className="mb-3 inline-flex min-h-9 items-center justify-center rounded-2xl border border-white/70 bg-white/72 px-3 text-sm font-bold text-green-900 shadow-sm transition hover:bg-white/90 active:scale-[0.98]"
            >
              {active !== defaultCalculatorFilter ? t.backToCalculators : t.back}
            </button>
            <h1 className="text-base font-extrabold tracking-wide text-green-950 sm:text-lg">
              {t.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{t.subtitle}</p>
          </div>

          {goToValues ? (
            <button
              type="button"
              onClick={goToValues}
              className="rounded-2xl border border-white/70 bg-white/76 px-4 py-3 text-sm font-bold text-green-900 shadow-sm"
            >
              {t.openValues}
            </button>
          ) : null}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActive(tab.key)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition ${
                active === tab.key
                  ? "bg-emerald-700 text-white shadow-lg shadow-emerald-950/15"
                  : "bg-white/68 text-green-950 ring-1 ring-white/70"
              }`}
            >
              {tab.icon}
              {t[tab.key]}
            </button>
          ))}
        </div>

        {active === "all" ? (
          <div className="mt-4 grid gap-5">
            <PriorityCalculators t={t} suggestions={suggestions} setActive={setActive} />
            <NutrientGraphs t={t} lab={lab} />
            <RatioCalculator t={t} lab={lab} />
            <FertilizerCalculator t={t} lab={lab} />
            <AmendmentCalculator t={t} lab={lab} sampleType={sampleType} selectedCropName={selectedCropName} />
            {sampleType === "foliar" ? (
              <DopCalculator t={t} lab={lab} />
            ) : (
              <p className="rounded-2xl bg-yellow-50/90 p-4 text-sm font-bold text-yellow-900">
                {t.dopFoliarOnly}
              </p>
            )}
            <SalinityCalculator t={t} lab={lab} />
          </div>
        ) : null}
        {active === "priority" ? (
          <PriorityCalculators t={t} suggestions={suggestions} setActive={setActive} />
        ) : null}
        {active === "ratios" ? <RatioCalculator t={t} lab={lab} /> : null}
        {active === "fertilizer" ? <FertilizerCalculator t={t} lab={lab} /> : null}
        {active === "amendment" ? <AmendmentCalculator t={t} lab={lab} sampleType={sampleType} selectedCropName={selectedCropName} /> : null}
        {active === "dop" ? (
          sampleType === "foliar" ? (
            <DopCalculator t={t} lab={lab} />
          ) : (
            <p className="mt-4 rounded-2xl bg-yellow-50/90 p-4 text-sm font-bold text-yellow-900">
              {t.dopFoliarOnly}
            </p>
          )
        ) : null}
        {active === "salinity" ? <SalinityCalculator t={t} lab={lab} /> : null}
        {active === "graphs" ? <NutrientGraphs t={t} lab={lab} /> : null}
      </div>
    </section>
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
    return <p className="mt-4 rounded-2xl bg-white/62 p-4 text-sm text-slate-600">{t.noData}</p>;
  }

  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {suggestions.map((item) => (
        <button
          key={`${item.key}-${item.title}`}
          type="button"
          onClick={() => setActive(item.key)}
          className="rounded-2xl border border-white/65 bg-white/72 p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:bg-white/90"
        >
          <p className="font-extrabold text-green-950">
            {translateCalculatorText(item.title, t)}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {translateCalculatorText(item.desc, t)}
          </p>
        </button>
      ))}
    </div>
  );
}

function RatioCalculator({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
  const cn = calculateCNRatio(lab.get("organic_carbon")?.value || lab.get("organic_matter")?.value || 0, lab.get("nitrogen")?.value || 0);
  const caMg = calculateNutrientRatio(
    lab.get("calcium") || { key: "ca", label: "Ca", value: 0 },
    lab.get("magnesium") || { key: "mg", label: "Mg", value: 0 }
  );
  const kMg = calculateNutrientRatio(
    lab.get("potassium") || { key: "k", label: "K", value: 0 },
    lab.get("magnesium") || { key: "mg", label: "Mg", value: 0 }
  );

  return <OutputGrid t={t} outputs={[cn, caMg, kMg]} />;
}

function FertilizerCalculator({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
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
          <SelectField label={t.mode} value={mode} onChange={(value) => setMode(value as FertilizerMode)} options={[["element", t.element], ["oxide", t.oxide]]} />
        </>
      }
    />
  );
}

function AmendmentCalculator({
  t,
  lab,
  sampleType,
  selectedCropName,
}: {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  sampleType: "soil" | "foliar";
  selectedCropName?: string | null;
}) {
  const cropSuggestedV2 = suggestEarthBaseSaturationTarget(selectedCropName);
  const earthAvailable = sampleType === "soil";
  const [method, setMethod] = useState<LimeMethod>("earth_practical");
  const [targetPh, setTargetPh] = useState(6.2);
  const [acidity, setAcidity] = useState(lab.get("exchangeable_acidity")?.value || 0);
  const [baseSaturationCurrent, setBaseSaturationCurrent] = useState(
    lab.get("base_saturation")?.value || 50
  );
  const [baseSaturationTarget, setBaseSaturationTarget] = useState(cropSuggestedV2);
  const [effectiveCec, setEffectiveCec] = useState(lab.get("cec")?.value || 10);
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

  return (
    <CalculatorPanel
      t={t}
      output={output}
      fields={
        <>
          <SelectField
            label={t.limeMethod}
            value={method}
            onChange={(value) => setMethod(value as LimeMethod)}
            options={[
              ...(earthAvailable ? ([["earth_practical", t.earthPractical]] as Array<[string, string]>) : []),
              ["target_ph", t.targetPh],
              ["exchangeable_acidity", t.acidity],
              ["buffer_index", t.buffer],
            ]}
          />
          {!earthAvailable ? (
            <p className="text-xs font-semibold text-yellow-900 sm:col-span-2">
              {t.earthSoilOnly || "EARTH method is available only for soil lab tests."}
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
              <NumberField
                label={t.incorporationFactor || "Incorporation factor (f)"}
                value={incorporationFactor}
                onChange={setIncorporationFactor}
              />
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
  );
}

function DopCalculator({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
  const [value, setValue] = useState(lab.get("potassium")?.value || 0);
  const [optimum, setOptimum] = useState(1);
  const output = calculateDop(value, optimum);

  return (
    <>
      <CalculatorPanel
        t={t}
        output={output}
        fields={
          <>
            <NumberField label={t.current} value={value} onChange={setValue} />
            <NumberField label={t.optimum} value={optimum} onChange={setOptimum} />
          </>
        }
      />
      <DopDeviationChart t={t} value={value} optimum={optimum} dopPercent={output?.value ?? null} />
    </>
  );
}

function DopDeviationChart({
  t,
  value,
  optimum,
  dopPercent,
}: {
  t: Record<string, string>;
  value: number;
  optimum: number;
  dopPercent: number | null;
}) {
  const safeOptimum = optimum > 0 ? optimum : 1;
  const deviation = dopPercent ?? ((value - safeOptimum) / safeOptimum) * 100;
  const clamped = Math.max(-120, Math.min(120, deviation));
  const barWidth = `${Math.min(100, Math.abs(clamped))}%`;
  const isNegative = clamped < 0;

  return (
    <div className="mt-4 rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-extrabold text-green-950">{t.graphDop}</p>
        <p className="text-sm font-bold text-slate-600">
          {Number.isFinite(deviation) ? `${deviation.toFixed(1)}%` : "—"}
        </p>
      </div>
      <div className="relative h-28 rounded-2xl bg-slate-50/90 px-3 py-4">
        <div className="absolute inset-y-4 left-1/2 w-px -translate-x-1/2 bg-slate-300" />
        <div
          className={`absolute top-1/2 h-8 -translate-y-1/2 rounded-full ${
            isNegative
              ? "bg-gradient-to-l from-sky-500 to-cyan-400"
              : "bg-gradient-to-r from-amber-500 to-orange-500"
          }`}
          style={{
            width: barWidth,
            left: isNegative ? undefined : "50%",
            right: isNegative ? "50%" : undefined,
          }}
        />
        <div className="absolute bottom-2 left-3 text-[11px] font-bold text-sky-700">
          {t.deficiency}
        </div>
        <div className="absolute bottom-2 right-3 text-[11px] font-bold text-orange-700">
          {t.excess}
        </div>
        <div className="absolute left-1/2 top-2 -translate-x-1/2 text-[11px] font-bold text-emerald-700">
          {t.optimum}
        </div>
      </div>
    </div>
  );
}

function SalinityCalculator({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
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

  return (
    <>
      <CalculatorPanel
        t={t}
        output={lr}
        fields={
          <>
            <NumberField label={t.ecw} value={ecw} onChange={setEcw} />
            <NumberField label={t.eceTarget} value={eceTarget} onChange={setEceTarget} />
            <NumberField label="PSI target (%)" value={psiTarget} onChange={setPsiTarget} />
            <NumberField label="ET" value={etValue} onChange={setEtValue} />
          </>
        }
      />
      <OutputGrid
        t={t}
        outputs={[
          sar,
          psi,
          porosity,
          ...gypsumOutputs,
          totalWater,
        ]}
      />
    </>
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
    <div className="mt-4 rounded-2xl bg-white/66 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-extrabold text-green-950">{t.macroMicro}</p>
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
    <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/72 p-4">
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
    <div className="overflow-x-auto rounded-2xl border border-white/70 bg-white/72 p-4">
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
              stroke="white"
              strokeWidth="3"
            />
            <text
              x={x}
              y={height - 8}
              textAnchor="middle"
              className="fill-green-950 text-[12px] font-bold"
            >
              {item.label}
            </text>
            <text
              x={x}
              y={Math.max(16, y - 12)}
              textAnchor="middle"
              className="fill-slate-600 text-[11px] font-bold"
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
    <div className="grid gap-4 rounded-2xl border border-white/70 bg-white/72 p-4 md:grid-cols-[auto_minmax(0,1fr)] md:items-center">
      <div
        className="mx-auto h-56 w-56 rounded-full shadow-inner"
        style={{
          background: `conic-gradient(${slices.map((slice) => slice.slice).join(", ")})`,
        }}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        {slices.map(({ item, color, percent }) => (
          <div key={item.key} className="flex items-center gap-2 rounded-xl bg-white/62 px-3 py-2">
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
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid gap-3 rounded-2xl bg-white/66 p-4 sm:grid-cols-2">{fields}</div>
      <OutputCard t={t} output={output} />
    </div>
  );
}

function OutputGrid({ t, outputs }: { t: Record<string, string>; outputs: Array<CalculationOutput | null> }) {
  return (
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {outputs.map((output, index) => <OutputCard key={output?.label || index} t={t} output={output} />)}
    </div>
  );
}

function OutputCard({ t, output }: { t: Record<string, string>; output: CalculationOutput | null }) {
  const translatedOutput = output ? translateCalculationOutput(output, t) : null;

  return (
    <article className="rounded-2xl border border-white/70 bg-white/72 p-4 shadow-sm">
      {translatedOutput ? (
        <>
          <p className="text-sm font-bold text-slate-500">{translatedOutput.label}</p>
          <p className="mt-2 text-3xl font-extrabold text-green-950">
            {translatedOutput.value} <span className="text-base">{translatedOutput.unit}</span>
          </p>
          <p className="mt-3 text-xs font-semibold text-slate-500">{t.formula}: {translatedOutput.formula}</p>
          <ul className="mt-3 grid gap-1 text-sm text-slate-600">
            {translatedOutput.notes.map((note) => <li key={note}>{note}</li>)}
          </ul>
        </>
      ) : (
        <p className="text-sm text-slate-600">{t.noData}</p>
      )}
    </article>
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
    "EARTH base-saturation method: V1 current base saturation, V2 target base saturation, CICE effective CEC, PRNT neutralization value, and f incorporation factor.":
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
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
}) {
  const [text, setText] = useState(() => formatNumberInput(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (focusedRef.current) return;
    setText(formatNumberInput(value));
  }, [value]);

  return (
    <label className="grid gap-1 text-sm font-bold text-green-950">
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
        className="min-h-11 rounded-2xl border border-green-100 bg-white/82 px-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="grid gap-1 text-sm font-bold text-green-950">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 rounded-2xl border border-green-100 bg-white/82 px-3 text-slate-900 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-700/10"
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
