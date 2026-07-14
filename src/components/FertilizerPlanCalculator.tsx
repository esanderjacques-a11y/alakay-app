"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  areaUnitLabel,
  type AreaUnit,
  type CalculationOutput,
  type CalculatorValue,
} from "@/lib/agronomicCalculators";
import { useMemoryNumber } from "@/hooks/useCalculatorMemory";
import { useViewLayoutPreference } from "@/hooks/useViewLayoutPreference";
import MenuSelect from "@/components/ui/MenuSelect";
import { useSoilFertilityReference } from "@/lib/soilFertilityData";
import {
  IRRIGATION_SYSTEM_OPTIONS,
  findCropExtraction,
  irrigationEfficiencyDefaults,
  type IrrigationSystem,
} from "@/lib/soilFertilityTables";
import {
  buildNutrientDosePlan,
  displayExtractionLabels,
  elementalToOxideExtraction,
  fertilityDosePlanToCalculationOutputs,
  oxideToElementalExtraction,
  type FertilityCalcStep,
  type FertilityDoseResult,
  type NutrientDisplayMode,
  type ExtractionOxide,
} from "@/lib/soilFertilityPlan";

type Props = {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  selectedCropName?: string | null;
  layout?: "grid" | "list";
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
};

const AREA_UNITS: AreaUnit[] = ["ha", "acre", "carreau", "m2"];

function formatNumberInput(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(value);
}

function parseNumberInput(text: string) {
  const cleaned = text.replace(",", ".").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export default function FertilizerPlanCalculator({
  t,
  lab,
  selectedCropName,
  layout: layoutProp,
  onOutputsChange,
}: Props) {
  const { reference } = useSoilFertilityReference();
  const [storedLayout] = useViewLayoutPreference("calculator-hub");
  const resultsLayout = layoutProp ?? storedLayout;
  const matchedCrop = useMemo(
    () => findCropExtraction(selectedCropName, reference),
    [selectedCropName, reference]
  );

  const [displayMode, setDisplayMode] = useState<NutrientDisplayMode>("oxide");
  const [irrigationSystem, setIrrigationSystem] = useState<IrrigationSystem>("aspersion_pivote");
  const [areaUnit, setAreaUnit] = useState<AreaUnit>("ha");
  const [selectedDoseKey, setSelectedDoseKey] = useState<string | null>(null);

  const defaultYield =
    matchedCrop?.yieldMin && matchedCrop?.yieldMax
      ? (matchedCrop.yieldMin + matchedCrop.yieldMax) / 2
      : matchedCrop?.yieldMin || 15;

  const [yieldTarget, setYieldTarget] = useMemoryNumber("fertilizer", "yield", defaultYield);
  const [bulkDensity, setBulkDensity] = useMemoryNumber(
    "fertilizer",
    "bulkDensity",
    lab.get("bulk_density")?.value || 1
  );
  const [depthCm, setDepthCm] = useMemoryNumber("fertilizer", "depthCm", 30);
  const [area, setArea] = useMemoryNumber("fertilizer", "area", 1);
  const [organicMatter, setOrganicMatter] = useMemoryNumber(
    "fertilizer",
    "organicMatter",
    lab.get("organic_matter")?.value || 0
  );
  const [pLab, setPLab] = useMemoryNumber("fertilizer", "p", lab.get("phosphorus")?.value || 0);
  const [kLab, setKLab] = useMemoryNumber("fertilizer", "k", lab.get("potassium")?.value || 0);
  const [mgLab, setMgLab] = useMemoryNumber("fertilizer", "mg", lab.get("magnesium")?.value || 0);

  const irrigDefaults = irrigationEfficiencyDefaults(irrigationSystem, reference.irrigationEfficiency);
  const [effN, setEffN] = useState(irrigDefaults.n);
  const [effP, setEffP] = useState(irrigDefaults.p);
  const [effK, setEffK] = useState(irrigDefaults.k);
  const [effMg, setEffMg] = useState(irrigDefaults.mg);
  const irrigationTouched = useRef(false);

  useEffect(() => {
    if (irrigationTouched.current) return;
    const next = irrigationEfficiencyDefaults(irrigationSystem, reference.irrigationEfficiency);
    setEffN(next.n);
    setEffP(next.p);
    setEffK(next.k);
    setEffMg(next.mg);
  }, [irrigationSystem, reference.irrigationEfficiency]);

  const factors = reference.oxideFactors;

  const [extractOxide, setExtractOxide] = useState<ExtractionOxide>(() =>
    matchedCrop
      ? {
          n: matchedCrop.n,
          p2o5: matchedCrop.p2o5,
          k2o: matchedCrop.k2o,
          cao: matchedCrop.cao,
          mgo: matchedCrop.mgo,
        }
      : { n: 0, p2o5: 0, k2o: 0, cao: 0, mgo: 0 }
  );
  const cropKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const key = matchedCrop?.cropKey ?? `manual:${selectedCropName || ""}`;
    if (cropKeyRef.current === key) return;
    cropKeyRef.current = key;
    setExtractOxide(
      matchedCrop
        ? {
            n: matchedCrop.n,
            p2o5: matchedCrop.p2o5,
            k2o: matchedCrop.k2o,
            cao: matchedCrop.cao,
            mgo: matchedCrop.mgo,
          }
        : { n: 0, p2o5: 0, k2o: 0, cao: 0, mgo: 0 }
    );
  }, [matchedCrop, selectedCropName]);

  const displayExtract =
    displayMode === "elemental" ? oxideToElementalExtraction(extractOxide, factors) : extractOxide;

  const labels = displayExtractionLabels(displayMode);

  function updateExtractionField(field: keyof ExtractionOxide, displayValue: number) {
    if (displayMode === "elemental") {
      const asElemental = { ...displayExtract, [field]: displayValue };
      setExtractOxide(elementalToOxideExtraction(asElemental, factors));
      return;
    }
    setExtractOxide((prev) => ({ ...prev, [field]: displayValue }));
  }

  const plan = useMemo(() => {
    return buildNutrientDosePlan(
      {
        cultivo: selectedCropName,
        extraction: extractOxide,
        rendimientoObjetivo: yieldTarget,
        profundidadMuestreo_cm: depthCm,
        densidadAparente_g_cm3: bulkDensity,
        materiaOrganica: organicMatter,
        P: pLab,
        K: kLab,
        Mg: mgLab,
        eficienciaN: effN,
        eficienciaP: effP,
        eficienciaK: effK,
        eficienciaMg: effMg,
        area,
        areaUnit,
        displayMode,
      },
      reference
    );
  }, [
    selectedCropName,
    extractOxide,
    yieldTarget,
    depthCm,
    bulkDensity,
    organicMatter,
    pLab,
    kLab,
    mgLab,
    effN,
    effP,
    effK,
    effMg,
    area,
    areaUnit,
    displayMode,
    reference,
  ]);

  useEffect(() => {
    if (!onOutputsChange) return;
    onOutputsChange(plan ? fertilityDosePlanToCalculationOutputs(plan) : []);
  }, [plan, onOutputsChange]);

  const selectedDose = plan?.doses.find((d) => d.key === selectedDoseKey) || null;

  const yieldHint =
    matchedCrop?.yieldMin != null && matchedCrop?.yieldMax != null
      ? formatMessage(t.fertilizerPlanYieldRange || "Typical range: {min}–{max} t/ha", {
          min: matchedCrop.yieldMin,
          max: matchedCrop.yieldMax,
        })
      : null;

  return (
    <div className="fertilizer-plan calc-page px-3 sm:px-4 space-y-4">
      <div className="fertilizer-plan__params calc-surface p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
              {t.fertilizerPlanTab || "Nutritional plan"}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {t.fertilizerPlanDoseDesc ||
                t.fertilizerPlanDesc ||
                "Dose from crop demand, soil supply, and irrigation efficiency."}
            </p>
          </div>
          <SelectField
            label={t.fertilizerPlanDisplayMode || t.fertilizerPlanMode || "Type"}
            value={displayMode}
            onChange={(value) => setDisplayMode(value as NutrientDisplayMode)}
            options={[
              ["oxide", t.oxide || "Óxido"],
              ["elemental", t.element || t.elemental || "Elemental"],
            ]}
          />
        </div>

        {selectedCropName || matchedCrop ? (
          <div className="calc-page__crop flex items-center gap-2 px-3 py-2.5">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
              {t.fertilizerPlanCrop || "Crop"}
            </span>
            <span className="text-sm font-semibold text-green-950 dark:text-emerald-50">
              {matchedCrop?.label || selectedCropName}
            </span>
            {!matchedCrop ? (
              <span className="text-xs text-amber-800 dark:text-amber-200">
                {t.fertilizerPlanCropUnknown ||
                  "Crop not in Tabla N.° 5 — enter extraction values below."}
              </span>
            ) : null}
          </div>
        ) : (
          <p className="fertilizer-plan__hint" role="status">
            {t.fertilizerPlanCropUnknown ||
              "No crop selected — enter extraction coefficients (kg/t) manually."}
          </p>
        )}

        <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-2">
          <NumberField
            label={t.fertilizerPlanYield || "Target yield (t/ha)"}
            value={yieldTarget}
            onChange={setYieldTarget}
          />
          <NumberField
            label={`${t.bulkDensity || "Bulk density"} (g/cm³)`}
            value={bulkDensity}
            onChange={setBulkDensity}
          />
          <NumberField
            label={`${t.incorporationDepth || t.samplingDepth || "Sampling depth"} (cm)`}
            value={depthCm}
            onChange={setDepthCm}
          />
          <NumberField
            label={`${t.organicMatter || "Organic matter"} (%)`}
            value={organicMatter}
            onChange={setOrganicMatter}
          />
          <div className="col-span-full grid gap-3 sm:grid-cols-[1fr_auto]">
            <NumberField label={t.area || "Area"} value={area} onChange={setArea} />
            <SelectField
              label={t.areaUnit || "Unit"}
              value={areaUnit}
              onChange={(value) => setAreaUnit(value as AreaUnit)}
              options={AREA_UNITS.map((unit) => [
                unit,
                t[`areaUnit_${unit}`] || areaUnitLabel(unit),
              ])}
            />
          </div>
        </div>
        {yieldHint ? <p className="text-xs text-slate-500 dark:text-slate-400">{yieldHint}</p> : null}

        <section className="space-y-2 border-t border-emerald-100/80 pt-4 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            {t.fertilizerPlanExtraction || "Extraction (kg/t)"}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.fertilizerPlanExtractionHint ||
              "From Tabla N.° 5 for the selected crop. Edit to override."}
          </p>
          <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <NumberField
              label={labels.n}
              value={displayExtract.n}
              onChange={(v) => updateExtractionField("n", v)}
              preserveCase
            />
            <NumberField
              label={labels.p}
              value={round3(displayExtract.p2o5)}
              onChange={(v) => updateExtractionField("p2o5", v)}
              preserveCase
            />
            <NumberField
              label={labels.k}
              value={round3(displayExtract.k2o)}
              onChange={(v) => updateExtractionField("k2o", v)}
              preserveCase
            />
            <NumberField
              label={labels.ca}
              value={round3(displayExtract.cao)}
              onChange={(v) => updateExtractionField("cao", v)}
              preserveCase
            />
            <NumberField
              label={labels.mg}
              value={round3(displayExtract.mgo)}
              onChange={(v) => updateExtractionField("mgo", v)}
              preserveCase
            />
          </div>
        </section>

        <section className="space-y-2 border-t border-emerald-100/80 pt-4 dark:border-white/10">
          <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            {t.fertilizerPlanLabSupply || "Soil lab values"}
          </h3>
          <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-3">
            <NumberField label={`${t.phosphorus || "P"} (mg/kg)`} value={pLab} onChange={setPLab} preserveCase />
            <NumberField
              label={`${t.potassium || "K"} (cmol(+)/kg)`}
              value={kLab}
              onChange={setKLab}
              preserveCase
            />
            <NumberField
              label={`${t.magnesium || "Mg"} (cmol(+)/kg)`}
              value={mgLab}
              onChange={setMgLab}
              preserveCase
            />
          </div>
        </section>

        <div className="calc-irrigation-picker">
          <div className="calc-irrigation-picker__row">
            <SelectField
              label={t.irrigationSystemLabel || "Irrigation system"}
              value={irrigationSystem}
              onChange={(value) => {
                irrigationTouched.current = false;
                setIrrigationSystem(value as IrrigationSystem);
              }}
              options={IRRIGATION_SYSTEM_OPTIONS.map((system) => [
                system,
                t[`irrigation_${system}`] || system,
              ])}
              fullWidth
            />
          </div>
          <div className="calc-form-fields calc-form-fields--grid mt-3 grid gap-3 sm:grid-cols-4">
            <NumberField
              label={`${labels.n} %`}
              value={effN}
              onChange={(v) => {
                irrigationTouched.current = true;
                setEffN(v);
              }}
              preserveCase
            />
            <NumberField
              label={`${labels.p} %`}
              value={effP}
              onChange={(v) => {
                irrigationTouched.current = true;
                setEffP(v);
              }}
              preserveCase
            />
            <NumberField
              label={`${labels.k} %`}
              value={effK}
              onChange={(v) => {
                irrigationTouched.current = true;
                setEffK(v);
              }}
              preserveCase
            />
            <NumberField
              label={`${labels.mg} %`}
              value={effMg}
              onChange={(v) => {
                irrigationTouched.current = true;
                setEffMg(v);
              }}
              preserveCase
            />
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t.fertilizerPlanEffHint ||
              "Efficiency defaults to the midpoint of Tabla N.° 7 for the selected irrigation system."}
          </p>
        </div>
      </div>

      {plan ? (
        <>
          <div className="fertilizer-plan__results calc-surface p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
                {t.fertilizerPlanSummary || "Dose summary"}
              </h3>
              <SelectField
                label={t.fertilizerPlanResultUnit || t.areaUnit || "Unit"}
                value={areaUnit}
                onChange={(value) => setAreaUnit(value as AreaUnit)}
                options={AREA_UNITS.map((unit) => [
                  unit,
                  t[`areaUnit_${unit}`] || areaUnitLabel(unit),
                ])}
              />
            </div>

            <div
              className={
                resultsLayout === "grid"
                  ? "calculator-actions-grid fertilizer-plan__dose-grid mt-0"
                  : "fertilizer-plan__dose-list"
              }
            >
              {plan.doses.map((dose) => (
                <DoseResultCard
                  key={dose.key}
                  dose={dose}
                  t={t}
                  areaUnit={areaUnit}
                  layout={resultsLayout}
                  selected={selectedDoseKey === dose.key}
                  onSelect={() =>
                    setSelectedDoseKey((prev) => (prev === dose.key ? null : dose.key))
                  }
                />
              ))}
            </div>

            {selectedDose ? (
              <div className="fertilizer-plan__steps-panel mt-2 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                    {`${selectedDose.nutrient} — ${t.fertilizerPlanStepsTitle || "Calculation steps"}`}
                  </h4>
                  <button
                    type="button"
                    className="calc-guided-stepper__nav-btn text-xs"
                    onClick={() => setSelectedDoseKey(null)}
                  >
                    {t.close || "Close"}
                  </button>
                </div>
                <div className="fertilizer-plan__steps">
                  {selectedDose.steps.map((step, index) => (
                    <DoseStepRow key={`${selectedDose.key}-${index}`} step={step} t={t} />
                  ))}
                </div>
                {plan.sections[0] ? (
                  <details className="fertilizer-plan__hint">
                    <summary className="cursor-pointer text-xs font-bold text-emerald-800">
                      {plan.sections[0].title}
                    </summary>
                    <div className="fertilizer-plan__steps mt-2">
                      {plan.sections[0].steps.map((step, index) => (
                        <DoseStepRow key={`mass-${index}`} step={step} t={t} />
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.fertilizerPlanViewSteps || "Tap a card to see calculation steps."}
              </p>
            )}
          </div>

          <details className="fertilizer-plan__interpretation calc-surface">
            <summary className="fertilizer-plan__recommendations-summary">
              {t.fertilizerPlanViewRecommendations || "View recommendations"}
            </summary>
            <div className="fertilizer-plan__recommendations-body space-y-2 px-4 pb-4 pt-1">
              <ul className="space-y-2">
                {plan.recommendations.map((line) => (
                  <li key={line} className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
                    {line}
                  </li>
                ))}
              </ul>
              <p className="fertilizer-plan__agronomist-note" role="note">
                {t.fertilizerPlanAgronomistNote ||
                  "If you have any doubts, contact a certified agronomist."}
              </p>
            </div>
          </details>
        </>
      ) : (
        <div className="calc-surface p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t.fertilizerPlanNeedYield || "Enter a target yield greater than zero to calculate doses."}
          </p>
        </div>
      )}
    </div>
  );
}

function DoseResultCard({
  dose,
  t,
  areaUnit,
  layout,
  selected,
  onSelect,
}: {
  dose: FertilityDoseResult;
  t: Record<string, string>;
  areaUnit: AreaUnit;
  layout: "grid" | "list";
  selected: boolean;
  onSelect: () => void;
}) {
  const showPlot = areaUnit !== "ha" && dose.dosisPlot != null && !dose.notRequired && !dose.viaEncalado;
  const valueText = dose.viaEncalado
    ? t.fertilizerPlanViaLime || "Via liming"
    : dose.notRequired
      ? t.fertilizerPlanNotRequired || "No fertilizer needed"
      : showPlot
        ? `${dose.dosisPlot} ${dose.unitPlot}`
        : `${dose.dosisKgHa} ${dose.unitHa}`;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${dose.nutrient} — ${t.fertilizerPlanViewSteps || "View steps"}`}
      className={`calculator-action-card fertilizer-plan__dose-card text-left ${
        layout === "list" ? "fertilizer-plan__dose-card--list" : "fertilizer-plan__dose-card--grid"
      } ${selected ? "calc-result-card--selected" : ""} ${
        dose.notRequired && !dose.viaEncalado ? "fertilizer-plan__dose-card--nf" : ""
      }`}
    >
      <div className="calculator-action-card__copy">
        <p className="calculator-action-card__title">{dose.nutrient}</p>
        <p
          className={`fertilizer-plan__dose-value ${
            dose.notRequired && !dose.viaEncalado ? "fertilizer-plan__dose-value--nf" : ""
          }`}
        >
          {valueText}
        </p>
        {!dose.notRequired && !dose.viaEncalado && showPlot ? (
          <p className="fertilizer-plan__dose-sub">{`${dose.dosisKgHa} ${dose.unitHa}`}</p>
        ) : null}
        {dose.viaEncalado ? (
          <p className="fertilizer-plan__dose-sub">
            {t.fertilizerPlanCaNote || "Supply Ca with the Amendment calculator."}
          </p>
        ) : null}
      </div>
    </button>
  );
}

function DoseStepRow({ step, t }: { step: FertilityCalcStep; t: Record<string, string> }) {
  return (
    <article className="fertilizer-plan__step">
      <p className="fertilizer-plan__step-label">{step.label}</p>
      <p className="fertilizer-plan__step-formula">{step.formula}</p>
      {step.substitution ? (
        <p className="fertilizer-plan__step-meta">
          <span className="fertilizer-plan__step-meta-key">{t.substitution || "Substitution"}</span>
          <span className="fertilizer-plan__step-meta-value">{step.substitution}</span>
        </p>
      ) : null}
      <p className="fertilizer-plan__step-meta">
        <span className="fertilizer-plan__step-meta-key">{t.result || "Result"}</span>
        <span className="fertilizer-plan__step-result">
          {step.result}
          {step.unit ? ` ${step.unit}` : ""}
        </span>
      </p>
      {step.tableRef ? <p className="fertilizer-plan__step-ref">{step.tableRef}</p> : null}
      {step.interpretation ? <p className="fertilizer-plan__step-note">{step.interpretation}</p> : null}
    </article>
  );
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
    <label className={`calc-field-label grid gap-1${preserveCase ? " calc-field-label--element" : ""}`}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        readOnly={readOnly}
        value={text}
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
          const next = parseNumberInput(text);
          setText(formatNumberInput(next));
          onChange?.(next);
        }}
        onChange={(event) => {
          const nextText = event.target.value;
          setText(nextText);
          if (!onChange) return;
          if (nextText.trim() === "" || nextText.endsWith(".") || nextText.endsWith(",")) return;
          onChange(parseNumberInput(nextText));
        }}
        className="calc-field-input"
      />
    </label>
  );
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

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
