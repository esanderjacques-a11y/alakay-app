"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CalculationOutput, CalculatorValue } from "@/lib/agronomicCalculators";
import {
  calculatePhAmendment,
  convertPhAmendmentUnit,
  methodRaisesPh,
  phAmendmentUnitLabel,
  suggestBaseSaturationTarget,
  type PhAmendmentMaterial,
  type PhAmendmentMethod,
  type PhAmendmentOutputUnit,
  type SoilTexture,
} from "@/lib/phAmendmentCalculator";

type Props = {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  selectedCropName?: string | null;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
};

const METHOD_OPTIONS: PhAmendmentMethod[] = [
  "base_saturation",
  "exchangeable_acidity",
  "target_ph",
  "gypsum",
  "sulfur",
];

const TEXTURE_OPTIONS: SoilTexture[] = ["sand", "sandy_loam", "loam", "clay_loam", "clay"];

function methodLabelKey(method: PhAmendmentMethod) {
  return `phAmendMethod_${method}` as const;
}

function textureLabelKey(texture: SoilTexture) {
  return `phAmendTexture_${texture}` as const;
}

function materialLabelKey(material: PhAmendmentMaterial) {
  return material === "calcitic_lime" ? "phAmendMaterialCalcitic" : "phAmendMaterialDolomitic";
}

function formatDisplay(value: number, unit: PhAmendmentOutputUnit) {
  const converted = convertPhAmendmentUnit(value, unit);
  return unit === "kg_ha" ? converted.toLocaleString(undefined, { maximumFractionDigits: 1 }) : String(converted);
}

export default function PhAmendmentCalculator({ t, lab, selectedCropName, onOutputsChange }: Props) {
  const cropSuggestedTarget = suggestBaseSaturationTarget(selectedCropName);

  const [method, setMethod] = useState<PhAmendmentMethod>("base_saturation");
  const [material, setMaterial] = useState<PhAmendmentMaterial>("calcitic_lime");
  const [ccePercent, setCcePercent] = useState(100);
  const [outputUnit, setOutputUnit] = useState<PhAmendmentOutputUnit>("t_ha");

  const [cec, setCec] = useState(lab.get("cec")?.value || 10);
  const [baseSaturationCurrent, setBaseSaturationCurrent] = useState(lab.get("base_saturation")?.value || 50);
  const [baseSaturationTarget, setBaseSaturationTarget] = useState(cropSuggestedTarget);
  const [exchangeableAcidity, setExchangeableAcidity] = useState(lab.get("exchangeable_acidity")?.value || 0);
  const [currentPh, setCurrentPh] = useState(lab.get("ph")?.value || 5.5);
  const [targetPh, setTargetPh] = useState(6.2);
  const [texture, setTexture] = useState<SoilTexture>("loam");
  const [exchangeableAl, setExchangeableAl] = useState(lab.get("aluminum")?.value || 0);
  const [bulkDensity, setBulkDensity] = useState(lab.get("bulk_density")?.value || 1.3);
  const [depthCm, setDepthCm] = useState(15);

  useEffect(() => {
    setBaseSaturationTarget(cropSuggestedTarget);
  }, [cropSuggestedTarget]);

  const { result, errors } = useMemo(
    () =>
      calculatePhAmendment({
        method,
        material: methodRaisesPh(method) ? material : undefined,
        ccePercent,
        cec,
        baseSaturationCurrent,
        baseSaturationTarget,
        exchangeableAcidity,
        currentPh,
        targetPh,
        texture,
        exchangeableAl,
        bulkDensity,
        depthCm,
      }),
    [
      method,
      material,
      ccePercent,
      cec,
      baseSaturationCurrent,
      baseSaturationTarget,
      exchangeableAcidity,
      currentPh,
      targetPh,
      texture,
      exchangeableAl,
      bulkDensity,
      depthCm,
    ]
  );

  const outputs = useMemo(() => {
    if (!result || result.noRequirement) return [];
    const primaryValue =
      result.adjustedRequirementTha !== undefined ? result.adjustedRequirementTha : result.baseRequirementTha;
    const label =
      method === "gypsum"
        ? "Gypsum requirement"
        : method === "sulfur"
          ? "Elemental sulfur requirement"
          : "Lime requirement";

    const notes = [t[result.explanationKey] || result.explanationKey];
    if (result.adjustedRequirementTha !== undefined && result.ccePercent !== undefined) {
      notes.push(
        `${t.phAmendResultBase || "Base requirement"}: ${formatDisplay(result.baseRequirementTha, outputUnit)} ${phAmendmentUnitLabel(outputUnit)} · CCE ${result.ccePercent}%`
      );
    }

    return [
      {
        value: convertPhAmendmentUnit(primaryValue, outputUnit),
        unit: phAmendmentUnitLabel(outputUnit),
        label,
        formula: result.formula,
        notes,
      } satisfies CalculationOutput,
    ];
  }, [result, method, outputUnit, t]);

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

  const showMaterial = methodRaisesPh(method);
  const unitLabel = phAmendmentUnitLabel(outputUnit);

  return (
    <div className="calc-page px-3 sm:px-4 space-y-4">
      <div className="calc-surface p-4 space-y-4">
        <section className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            {t.phAmendSectionMethod || "1. Method"}
          </h2>
          <SelectField
            label={t.limeMethod || "Method"}
            value={method}
            onChange={(value) => setMethod(value as PhAmendmentMethod)}
            fullWidth
            options={METHOD_OPTIONS.map((key) => [key, t[methodLabelKey(key)] || key])}
          />
        </section>

        {showMaterial ? (
          <section className="space-y-3 border-t border-emerald-100/80 pt-4 dark:border-white/10">
            <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
              {t.phAmendSectionMaterial || "2. Amendment material"}
            </h2>
            <SelectField
              label={t.amendmentMaterial || "Amendment material"}
              value={material}
              onChange={(value) => setMaterial(value as PhAmendmentMaterial)}
              fullWidth
              options={[
                ["calcitic_lime", t.phAmendMaterialCalcitic || "Agricultural Limestone (CaCO₃)"],
                ["dolomitic_lime", t.phAmendMaterialDolomitic || "Dolomitic Limestone (CaMg(CO₃)₂)"],
              ]}
            />
            <NumberField
              label={t.phAmendMaterialQuality || "Material quality (CCE / PRNT %)"}
              value={ccePercent}
              onChange={setCcePercent}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.phAmendCceHint || "Adjusted requirement = Base requirement / (CCE / 100). Default 100%."}
            </p>
          </section>
        ) : null}

        <section className="space-y-3 border-t border-emerald-100/80 pt-4 dark:border-white/10">
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            {t.phAmendSectionInputs || "Inputs"}
          </h2>
          <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-2">
            {method === "base_saturation" ? (
              <>
                <NumberField label={t.effectiveCec || "CEC (cmol(+)/kg)"} value={cec} onChange={setCec} />
                <NumberField
                  label={t.baseSaturationCurrent || "Current base saturation (%)"}
                  value={baseSaturationCurrent}
                  onChange={setBaseSaturationCurrent}
                />
                <NumberField
                  label={t.baseSaturationTarget || "Target base saturation (%)"}
                  value={baseSaturationTarget}
                  onChange={setBaseSaturationTarget}
                />
                <p className="text-xs font-semibold text-slate-600 sm:col-span-2">
                  {`${t.v2SuggestedByCrop || "Target suggested by crop"}: ${cropSuggestedTarget}%`}
                </p>
                <NumberField
                  label={`${t.bulkDensity || "Bulk density"} (${t.phAmendOptional || "optional"})`}
                  value={bulkDensity}
                  onChange={setBulkDensity}
                />
                <NumberField
                  label={`${t.incorporationDepth || "Incorporation depth"} (cm)`}
                  value={depthCm}
                  onChange={setDepthCm}
                />
              </>
            ) : null}

            {method === "exchangeable_acidity" ? (
              <>
                <NumberField
                  label={t.phAmendExchangeableAcidity || "Exchangeable acidity (cmol(+)/kg)"}
                  value={exchangeableAcidity}
                  onChange={setExchangeableAcidity}
                />
                <NumberField label={t.bulkDensity || "Bulk density"} value={bulkDensity} onChange={setBulkDensity} />
                <NumberField
                  label={`${t.incorporationDepth || "Incorporation depth"} (cm)`}
                  value={depthCm}
                  onChange={setDepthCm}
                />
              </>
            ) : null}

            {method === "target_ph" || method === "sulfur" ? (
              <>
                <NumberField label={t.phAmendCurrentPh || "Current soil pH"} value={currentPh} onChange={setCurrentPh} />
                <NumberField label={t.phAmendTargetPh || "Target soil pH"} value={targetPh} onChange={setTargetPh} />
                <SelectField
                  label={t.phAmendSoilTexture || "Soil texture"}
                  value={texture}
                  onChange={(value) => setTexture(value as SoilTexture)}
                  options={TEXTURE_OPTIONS.map((key) => [key, t[textureLabelKey(key)] || key])}
                />
              </>
            ) : null}

            {method === "gypsum" ? (
              <>
                <NumberField
                  label={t.phAmendExchangeableAl || "Exchangeable aluminum (cmol(+)/kg)"}
                  value={exchangeableAl}
                  onChange={setExchangeableAl}
                />
                <NumberField label={t.bulkDensity || "Bulk density"} value={bulkDensity} onChange={setBulkDensity} />
                <NumberField
                  label={`${t.incorporationDepth || "Incorporation depth"} (cm)`}
                  value={depthCm}
                  onChange={setDepthCm}
                />
              </>
            ) : null}

            <SelectField
              label={t.phAmendOutputUnit || "Output unit"}
              value={outputUnit}
              onChange={(value) => setOutputUnit(value as PhAmendmentOutputUnit)}
              options={[
                ["t_ha", t.phAmendUnitTha || "t/ha"],
                ["kg_ha", t.phAmendUnitKgha || "kg/ha"],
              ]}
            />
          </div>
        </section>
      </div>

      {errors.length > 0 ? (
        <div className="calc-surface p-4">
          <ul className="space-y-1 text-sm font-medium text-red-800">
            {errors.map((error) => (
              <li key={`${error.field}-${error.messageKey}`}>{t[error.messageKey] || error.messageKey}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <PhAmendmentResultsCard t={t} result={result} outputUnit={outputUnit} unitLabel={unitLabel} />
    </div>
  );
}

function PhAmendmentResultsCard({
  t,
  result,
  outputUnit,
  unitLabel,
}: {
  t: Record<string, string>;
  result: ReturnType<typeof calculatePhAmendment>["result"];
  outputUnit: PhAmendmentOutputUnit;
  unitLabel: string;
}) {
  if (!result) return null;

  if (result.noRequirement) {
    return (
      <div className="ph-amend-results calc-surface p-4">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {t.phAmendNoRequirement || "No amendment is required based on the selected target."}
        </p>
      </div>
    );
  }

  const primaryTha = result.adjustedRequirementTha ?? result.baseRequirementTha;
  const requirementLabel =
    result.method === "gypsum"
      ? t.gypsumRequirementTitle || "Gypsum requirement"
      : result.method === "sulfur"
        ? t.phAmendSulfurRequirement || "Elemental sulfur requirement"
        : t.limeRequirementTitle || "Lime requirement";

  return (
    <div className="ph-amend-results calc-surface p-4 space-y-4">
      <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
        {t.phAmendResultsTitle || "Results"}
      </h3>

      <dl className="ph-amend-results__grid grid gap-3 sm:grid-cols-2">
        <ResultRow label={t.phAmendResultMethod || "Method"} value={t[methodLabelKey(result.method)] || result.method} />
        {result.material ? (
          <ResultRow
            label={t.phAmendResultMaterial || "Amendment"}
            value={t[materialLabelKey(result.material)] || result.material}
          />
        ) : null}
        {methodRaisesPh(result.method) ? (
          <>
            <ResultRow
              label={t.phAmendResultBase || "Base requirement"}
              value={`${formatDisplay(result.baseRequirementTha, outputUnit)} ${unitLabel}`}
              highlight
            />
            {result.adjustedRequirementTha !== undefined ? (
              <ResultRow
                label={t.phAmendResultAdjusted || "Adjusted requirement"}
                value={`${formatDisplay(result.adjustedRequirementTha, outputUnit)} ${unitLabel}`}
                highlight
              />
            ) : null}
          </>
        ) : (
          <ResultRow
            label={requirementLabel}
            value={`${formatDisplay(primaryTha, outputUnit)} ${unitLabel}`}
            highlight
          />
        )}
      </dl>

      <div className="space-y-2 border-t border-emerald-100/80 pt-3 dark:border-white/10">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          {t.phAmendResultFormula || "Formula used"}
        </p>
        <p className="font-mono text-sm text-slate-800 dark:text-slate-100">{result.formula}</p>
      </div>

      <div className="space-y-1">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          {t.phAmendResultExplanation || "Explanation"}
        </p>
        <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200">
          {t[result.explanationKey] || result.explanationKey}
        </p>
        {result.adjustedRequirementTha !== undefined && result.ccePercent !== undefined ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.phAmendAdjustedNote ||
              `Adjusted requirement accounts for material quality (CCE ${result.ccePercent}%).`}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ResultRow({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className={`ph-amend-results__row rounded-xl px-3 py-3 ${highlight ? "calc-result-card calc-result-card--active" : "calc-surface-inner"}`}>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">{label}</dt>
      <dd className={`mt-1 font-extrabold leading-none ${highlight ? "text-2xl text-green-950" : "text-sm text-slate-800 dark:text-slate-100"}`}>
        {value}
      </dd>
    </div>
  );
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
    <label className="calc-field-label grid gap-1">
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
    <label className={`calc-field-label grid gap-1${fullWidth ? " col-span-full" : ""}`}>
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="calc-field-input">
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}
