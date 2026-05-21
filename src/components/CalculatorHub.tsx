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
  calculateLeachingRequirement,
  calculateNutrientRatio,
  calculatePorosity,
  calculateSar,
  calculateSoilAmendment,
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
  goToValues?: () => void;
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
  goToValues,
}: Props) {
  const t = calculatorHubText[language] || calculatorHubText.en;
  const [active, setActive] = useState<CalculatorKey>("all");
  const lab = useMemo(() => buildLabValueIndex(parameters, values, results), [parameters, values, results]);
  const suggestions = getSuggestions(lab, results, t);

  return (
    <section className="mt-6 animate-slide-up">
      <div className="values-screen-panel rounded-3xl p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
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
            <AmendmentCalculator t={t} lab={lab} />
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
        {active === "amendment" ? <AmendmentCalculator t={t} lab={lab} /> : null}
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
  const [target, setTarget] = useState(80);
  const [grade, setGrade] = useState(20);
  const [area, setArea] = useState(1);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>("ha");
  const [efficiency, setEfficiency] = useState(85);
  const [mode, setMode] = useState<FertilizerMode>("element");
  const current = lab.get("nitrogen")?.value || 0;
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

function AmendmentCalculator({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
  const [method, setMethod] = useState<LimeMethod>("target_ph");
  const [targetPh, setTargetPh] = useState(6.2);
  const [acidity, setAcidity] = useState(lab.get("exchangeable_acidity")?.value || 0);
  const [rndt, setRndt] = useState(90);
  const [bulkDensity, setBulkDensity] = useState(lab.get("bulk_density")?.value || 1.25);
  const [depth, setDepth] = useState(20);
  const [area, setArea] = useState(1);
  const [areaUnit, setAreaUnit] = useState<AreaUnit>("ha");
  const output = calculateSoilAmendment({
    method,
    material: method === "target_ph" ? "calcitic_lime" : "dolomitic_lime",
    currentPh: lab.get("ph")?.value,
    targetPh,
    exchangeableAcidity: acidity,
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
          <SelectField label={t.limeMethod} value={method} onChange={(value) => setMethod(value as LimeMethod)} options={[["target_ph", t.targetPh], ["exchangeable_acidity", t.acidity], ["buffer_index", t.buffer]]} />
          <NumberField label="pH" value={lab.get("ph")?.value || 0} readOnly />
          <NumberField label={t.target} value={targetPh} onChange={setTargetPh} />
          <NumberField label={t.acidity} value={acidity} onChange={setAcidity} />
          <NumberField label={t.rndt} value={rndt} onChange={setRndt} />
          <NumberField label={t.bulkDensity} value={bulkDensity} onChange={setBulkDensity} />
          <NumberField label={t.depth} value={depth} onChange={setDepth} />
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
  const lr = calculateLeachingRequirement(ecw, eceTarget);
  const sar = calculateSar(lab.get("sodium")?.value || 0, lab.get("calcium")?.value || 0, lab.get("magnesium")?.value || 0);
  const porosity = calculatePorosity(lab.get("bulk_density")?.value || 0);

  return (
    <>
      <CalculatorPanel
        t={t}
        output={lr}
        fields={
          <>
            <NumberField label={t.ecw} value={ecw} onChange={setEcw} />
            <NumberField label={t.eceTarget} value={eceTarget} onChange={setEceTarget} />
          </>
        }
      />
      <OutputGrid t={t} outputs={[sar, porosity]} />
    </>
  );
}

type GraphStyle = "bars" | "dop" | "radial";

function NutrientGraphs({ t, lab }: { t: Record<string, string>; lab: Map<string, CalculatorValue> }) {
  const [graphStyle, setGraphStyle] = useState<GraphStyle>("dop");
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
            ["dop", t.graphDop],
            ["bars", t.graphBars],
            ["radial", t.graphRadial],
          ]}
        />
      </div>

      <div className="mt-4 grid gap-3">
        {nutrients.length === 0 ? (
          <p className="text-sm text-slate-600">{t.noData}</p>
        ) : graphStyle === "radial" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {nutrients.map((item) => {
              const size = Math.max(72, Math.min(132, 72 + (item.value / maxValue) * 60));
              return (
                <div
                  key={item.key}
                  className="flex items-center gap-3 rounded-2xl border border-white/70 bg-white/72 p-3"
                >
                  <div
                    className="grid shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-emerald-500 text-xs font-extrabold text-white"
                    style={{ width: size, height: size }}
                  >
                    {item.value}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-green-950">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.unit}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : graphStyle === "dop" ? (
          nutrients.map((item) => {
            const optimum = maxValue * 0.7;
            const dop = ((item.value - optimum) / optimum) * 100;
            const clamped = Math.max(-100, Math.min(100, dop));
            const isNegative = clamped < 0;

            return (
              <div key={item.key}>
                <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
                  <span>{item.label}</span>
                  <span>
                    {item.value} {item.unit} · {clamped.toFixed(0)}%
                  </span>
                </div>
                <div className="relative h-6 overflow-hidden rounded-full bg-slate-100">
                  <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300" />
                  <span
                    className={`absolute top-0 h-full rounded-full ${
                      isNegative
                        ? "bg-gradient-to-l from-sky-500 to-cyan-400"
                        : "bg-gradient-to-r from-amber-500 to-orange-500"
                    }`}
                    style={{
                      width: `${Math.min(50, Math.abs(clamped) / 2)}%`,
                      left: isNegative ? undefined : "50%",
                      right: isNegative ? "50%" : undefined,
                    }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          nutrients.map((item) => (
            <div key={item.key}>
              <div className="mb-1 flex justify-between text-xs font-bold text-slate-600">
                <span>{item.label}</span>
                <span>
                  {item.value} {item.unit}
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <span
                  className="block h-full rounded-full bg-gradient-to-r from-teal-600 to-emerald-500"
                  style={{
                    width: `${Math.max(8, Math.min(100, (item.value / maxValue) * 100))}%`,
                  }}
                />
              </div>
            </div>
          ))
        )}
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
    "buffer_index adjusted by depth, bulk density, RNDT, and area":
      t.bufferFormula,
    "((value - optimum) / optimum) * 100": t.dopFormula,
    "(1 - bulk density / particle density) * 100": t.porosityFormula,
    "ECw / (5 * ECe target - ECw) * 100": t.leachingFormula,
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
