"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AreaUnit, CalculationOutput, CalculatorValue } from "@/lib/agronomicCalculators";
import { areaUnitLabel } from "@/lib/agronomicCalculators";
import {
  calculatePhAmendment,
  convertPhAmendmentPlotTotal,
  convertPhAmendmentUnit,
  formatPhAmendmentDisplay,
  methodRaisesPh,
  phAmendmentUnitLabel,
  DEFAULT_CA_SATURATION_TARGET,
  PH_AMENDMENT_OUTPUT_UNITS,
  suggestBaseSaturationTarget,
  type PhAmendmentMaterial,
  type PhAmendmentMethod,
  type PhAmendmentOutputUnit,
  type SoilTexture,
} from "@/lib/phAmendmentCalculator";
import { assessAmendmentChemistry } from "@/lib/amendmentRecommendation";
import { useMemoryNumber, useSharedCationInputs } from "@/hooks/useCalculatorMemory";
import MenuSelect, { type MenuSelectOption } from "@/components/ui/MenuSelect";
import { getCicAcidityContribution } from "@/lib/baseSaturation";
import {
  Beaker,
  FlaskConical,
  Mountain,
  Percent,
  ThermometerSun,
} from "lucide-react";

type Props = {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  selectedCropName?: string | null;
  showCalculatorFormulas?: boolean;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
};

const METHOD_OPTIONS: PhAmendmentMethod[] = [
  "ca_saturation",
  "base_saturation",
  "exchangeable_acidity",
  "target_ph",
  "gypsum",
  "sulfur",
];

const METHOD_ICONS: Record<
  PhAmendmentMethod,
  NonNullable<MenuSelectOption<PhAmendmentMethod>["icon"]>
> = {
  ca_saturation: Percent,
  base_saturation: Percent,
  exchangeable_acidity: Beaker,
  target_ph: ThermometerSun,
  gypsum: Mountain,
  sulfur: FlaskConical,
};

const TEXTURE_OPTIONS: SoilTexture[] = ["sand", "sandy_loam", "loam", "clay_loam", "clay"];
const PLOT_AREA_UNITS: AreaUnit[] = ["ha", "acre", "carreau", "m2"];

function methodLabelKey(method: PhAmendmentMethod) {
  return `phAmendMethod_${method}` as const;
}

function textureLabelKey(texture: SoilTexture) {
  return `phAmendTexture_${texture}` as const;
}

function materialLabelKey(material: PhAmendmentMaterial) {
  return material === "calcitic_lime" ? "phAmendMaterialCalcitic" : "phAmendMaterialDolomitic";
}

function outputUnitLabel(unit: PhAmendmentOutputUnit, t: Record<string, string>) {
  return t[`phAmendUnit_${unit}`] || phAmendmentUnitLabel(unit);
}

export default function PhAmendmentCalculator({
  t,
  lab,
  selectedCropName,
  showCalculatorFormulas = false,
  onOutputsChange,
}: Props) {
  const cropSuggestedTarget = suggestBaseSaturationTarget(selectedCropName);

  const [method, setMethod] = useState<PhAmendmentMethod>("ca_saturation");
  const [material, setMaterial] = useState<PhAmendmentMaterial>("calcitic_lime");
  const [materialManual, setMaterialManual] = useState(false);
  const [ccePercent, setCcePercent] = useMemoryNumber("amendment", "ccePercent", 90);
  const CALCITIC_PRNT = 90;
  const DOLOMITIC_PRNT = 75;
  const [outputUnit, setOutputUnit] = useState<PhAmendmentOutputUnit>("t_ha");
  const [plotArea, setPlotArea] = useMemoryNumber("amendment", "plotArea", 0);
  const [plotAreaUnit, setPlotAreaUnit] = useState<AreaUnit>("ha");
  const [caSaturationTarget, setCaSaturationTarget] = useMemoryNumber(
    "amendment",
    "caSaturationTarget",
    DEFAULT_CA_SATURATION_TARGET
  );

  const [cec, setCec] = useMemoryNumber("amendment", "cec", lab.get("cec")?.value || 0);
  const [caCmol, setCaCmol] = useMemoryNumber(
    "amendment",
    "caCmol",
    lab.get("calcium")?.value || 0
  );
  const [baseSaturationCurrent, setBaseSaturationCurrent] = useMemoryNumber(
    "amendment",
    "baseSaturationCurrent",
    lab.get("base_saturation")?.value || 0
  );
  const [baseSaturationTarget, setBaseSaturationTarget] = useMemoryNumber(
    "amendment",
    "baseSaturationTarget",
    cropSuggestedTarget
  );
  const [exchangeableAcidity, setExchangeableAcidity] = useMemoryNumber(
    "amendment",
    "exchangeableAcidity",
    lab.get("exchangeable_acidity")?.value || 0
  );
  const [currentPh, setCurrentPh] = useMemoryNumber(
    "amendment",
    "currentPh",
    lab.get("ph")?.value || 0
  );
  const [targetPh, setTargetPh] = useMemoryNumber("amendment", "targetPh", 0);
  const [texture, setTexture] = useState<SoilTexture>("loam");
  const [exchangeableAl, setExchangeableAl] = useMemoryNumber(
    "amendment",
    "exchangeableAl",
    lab.get("aluminum")?.value || 0
  );
  const [bulkDensity, setBulkDensity] = useMemoryNumber(
    "amendment",
    "bulkDensity",
    lab.get("bulk_density")?.value || 0
  );
  const [depthCm, setDepthCm] = useMemoryNumber("amendment", "depthCm", 0);

  const shared = useSharedCationInputs(lab);

  const estimatedCec = shared.estimatedCec;
  const estimatedBaseSaturation = shared.estimatedBaseSaturation;
  const estimatedAcidity = getCicAcidityContribution({
    hAl: shared.hAl,
    aluminum: shared.aluminum,
    aluminumUnit: shared.aluminumUnit,
  });

  // Bases-only CICe makes V%≈100% by definition — do not treat that as a liming diagnosis.
  const resolvedCec = cec > 0 ? cec : estimatedCec;
  const resolvedBaseSaturationCurrent =
    baseSaturationCurrent > 0 ? baseSaturationCurrent : estimatedBaseSaturation;
  const needsMeasuredCecOrV =
    method === "base_saturation" &&
    !(baseSaturationCurrent > 0) &&
    estimatedBaseSaturation <= 0 &&
    shared.cecReported <= 0;
  const resolvedAcidity =
    exchangeableAcidity > 0 ? exchangeableAcidity : estimatedAcidity;
  const resolvedAl =
    exchangeableAl > 0
      ? exchangeableAl
      : getCicAcidityContribution({
          aluminum: shared.aluminum,
          aluminumUnit: shared.aluminumUnit,
        });
  const resolvedCurrentPh = currentPh > 0 ? currentPh : lab.get("ph")?.value || 0;
  const resolvedTargetPh =
    targetPh > 0 ? targetPh : method === "sulfur" ? 5.5 : 6.2;
  const resolvedBulkDensity = bulkDensity > 0 ? bulkDensity : method === "ca_saturation" ? 1 : 1.3;
  const resolvedDepthCm = depthCm > 0 ? depthCm : method === "ca_saturation" ? 30 : 15;
  const resolvedCa =
    caCmol > 0 ? caCmol : shared.ca > 0 ? shared.ca : lab.get("calcium")?.value || 0;

  const chemGate = useMemo(
    () =>
      assessAmendmentChemistry({
        ph: resolvedCurrentPh || null,
        cec: resolvedCec || null,
        ca: resolvedCa || null,
        mg: shared.mg || null,
        k: shared.k || null,
        na: shared.na || null,
        exchangeableAcidity: resolvedAcidity || null,
        aluminum: shared.aluminum || null,
        aluminumUnit: shared.aluminumUnit,
      }),
    [
      resolvedCurrentPh,
      resolvedCec,
      resolvedCa,
      shared.mg,
      shared.k,
      shared.na,
      resolvedAcidity,
      shared.aluminum,
      shared.aluminumUnit,
    ]
  );

  useEffect(() => {
    if (materialManual || !chemGate.needsLime) return;
    if (chemGate.mgLow) {
      setMaterial("dolomitic_lime");
      setCcePercent(DOLOMITIC_PRNT);
    } else {
      setMaterial("calcitic_lime");
      setCcePercent(CALCITIC_PRNT);
    }
  }, [chemGate.needsLime, chemGate.mgLow, materialManual, setCcePercent]);

  function toggleLimeMaterial() {
    if (!methodRaisesPh(method)) return;
    setMaterialManual(true);
    if (material === "dolomitic_lime") {
      setMaterial("calcitic_lime");
      setCcePercent(CALCITIC_PRNT);
    } else {
      setMaterial("dolomitic_lime");
      setCcePercent(DOLOMITIC_PRNT);
    }
  }

  const { result, errors } = useMemo(
    () =>
      calculatePhAmendment({
        method,
        material: methodRaisesPh(method) ? material : undefined,
        ccePercent,
        cec: resolvedCec,
        caCmol: resolvedCa,
        mgCmol: shared.mg,
        kCmol: shared.k,
        naCmol: shared.na,
        ph: resolvedCurrentPh,
        baseSaturationCurrent: resolvedBaseSaturationCurrent,
        baseSaturationTarget:
          baseSaturationTarget > 0 ? baseSaturationTarget : cropSuggestedTarget,
        caSaturationTarget:
          caSaturationTarget > 0 ? caSaturationTarget : DEFAULT_CA_SATURATION_TARGET,
        exchangeableAcidity: resolvedAcidity,
        currentPh: resolvedCurrentPh,
        targetPh: resolvedTargetPh,
        texture,
        exchangeableAl: resolvedAl,
        bulkDensity: resolvedBulkDensity,
        depthCm: resolvedDepthCm,
      }),
    [
      method,
      material,
      ccePercent,
      resolvedCec,
      resolvedCa,
      shared.mg,
      shared.k,
      shared.na,
      resolvedBaseSaturationCurrent,
      baseSaturationTarget,
      cropSuggestedTarget,
      caSaturationTarget,
      resolvedAcidity,
      resolvedCurrentPh,
      resolvedTargetPh,
      texture,
      resolvedAl,
      resolvedBulkDensity,
      resolvedDepthCm,
    ]
  );

  const outputs = useMemo(() => {
    const rows: CalculationOutput[] = [];

    if (!result || result.noRequirement) return rows;
    const primaryValue =
      result.adjustedRequirementTha !== undefined ? result.adjustedRequirementTha : result.baseRequirementTha;
    const label =
      method === "gypsum"
        ? "Gypsum requirement"
        : method === "sulfur"
          ? "Elemental sulfur requirement"
          : "Lime requirement";

    const notes = [t[result.explanationKey] || result.explanationKey];
    if (methodRaisesPh(method) && result.material) {
      const materialName =
        result.material === "dolomitic_lime"
          ? t.phAmendMaterialDolomitic || "Dolomitic limestone"
          : t.phAmendMaterialCalcitic || "Agricultural limestone";
      const why =
        result.material === "dolomitic_lime"
          ? t.phAmendWhyDolomite ||
            "Dolomitic lime chosen to supply calcium and magnesium (low Mg)."
          : t.phAmendWhyCalcitic ||
            "Agricultural lime chosen to raise pH / Ca without adding magnesium.";
      notes.push(`${materialName}. ${why}`);
    }
    if (result.adjustedRequirementTha !== undefined && result.ccePercent !== undefined) {
      notes.push(
        `${t.phAmendResultBase || "Base requirement"}: ${formatPhAmendmentDisplay(result.baseRequirementTha, outputUnit)} ${phAmendmentUnitLabel(outputUnit)} · CCE ${result.ccePercent}%`
      );
    }
    if (plotArea > 0) {
      const totalT = convertPhAmendmentPlotTotal(primaryValue, plotArea, plotAreaUnit);
      notes.push(
        `${t.phAmendPlotTotal || "Plot total"}: ${totalT.toLocaleString(undefined, { maximumFractionDigits: 2 })} t (${plotArea} ${areaUnitLabel(plotAreaUnit)})`
      );
    }

    rows.push({
      value: convertPhAmendmentUnit(primaryValue, outputUnit),
      unit: phAmendmentUnitLabel(outputUnit),
      label,
      formula: result.formula,
      notes,
    });
    return rows;
  }, [result, method, outputUnit, plotArea, plotAreaUnit, t]);

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

  const showMaterial = methodRaisesPh(method) && chemGate.needsLime;
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
            heading={t.phAmendSectionMethod || "Method"}
            options={METHOD_OPTIONS.map((key) => ({
              value: key,
              label: t[methodLabelKey(key)] || key,
              icon: METHOD_ICONS[key],
            }))}
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
              onChange={(value) => {
                setMaterialManual(true);
                const next = value as PhAmendmentMaterial;
                setMaterial(next);
                setCcePercent(
                  next === "dolomitic_lime" ? DOLOMITIC_PRNT : CALCITIC_PRNT
                );
              }}
              fullWidth
              options={[
                ["calcitic_lime", t.phAmendMaterialCalcitic || "Agricultural Limestone (CaCO₃)"],
                ["dolomitic_lime", t.phAmendMaterialDolomitic || "Dolomitic Limestone (CaMg(CO₃)₂)"],
              ]}
            />
            <NumberField
              label={t.phAmendMaterialQuality || "Material quality (CCE / PRNT %)"}
              value={ccePercent}
              onChange={(value) => {
                setMaterialManual(true);
                setCcePercent(value);
              }}
            />
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t.phAmendCceHint ||
                "Adjusted requirement = Base requirement / (CCE / 100). Calcitic ~90%, dolomitic ~75%."}
            </p>
          </section>
        ) : null}

        <section className="space-y-3 border-t border-emerald-100/80 pt-4 dark:border-white/10">
          <h2 className="text-xs font-bold uppercase tracking-wide text-emerald-800">
            {t.phAmendSectionInputs || "Inputs"}
          </h2>
          <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-2">
            {method === "ca_saturation" ? (
              <>
                <NumberField
                  label={t.effectiveCec || "CICe (cmol(+)/kg)"}
                  value={cec}
                  onChange={setCec}
                  placeholder={
                    estimatedCec > 0
                      ? `${estimatedCec}${!(cec > 0) ? ` (${t.phAmendAuto || "auto"})` : ""}`
                      : t.phAmendImportHint || "Import / auto if blank"
                  }
                />
                <NumberField
                  label={t.cicFieldCa || "Ca (cmol(+)/kg)"}
                  value={caCmol}
                  onChange={setCaCmol}
                  placeholder={
                    shared.ca > 0 && !(caCmol > 0)
                      ? `${shared.ca} (${t.phAmendAuto || "auto"})`
                      : t.phAmendImportHint || "Import / auto if blank"
                  }
                />
                <NumberField
                  label={t.phAmendCaSatTarget || "Target Ca saturation (%)"}
                  value={caSaturationTarget}
                  onChange={setCaSaturationTarget}
                  placeholder={`${DEFAULT_CA_SATURATION_TARGET} (${t.phAmendDefault || "default"})`}
                />
                <NumberField
                  label={t.phAmendExchangeableAcidity || "Exchangeable acidity (cmol(+)/kg)"}
                  value={exchangeableAcidity}
                  onChange={setExchangeableAcidity}
                  placeholder={
                    estimatedAcidity > 0
                      ? `${estimatedAcidity} (${t.phAmendAuto || "auto"})`
                      : t.phAmendImportHint || "Import / auto if blank"
                  }
                />
                <NumberField
                  label={`${t.bulkDensity || "Bulk density"}`}
                  value={bulkDensity}
                  onChange={setBulkDensity}
                  placeholder={`1.0 (${t.phAmendDefault || "default"})`}
                />
                <NumberField
                  label={`${t.incorporationDepth || "Sampling depth"} (cm)`}
                  value={depthCm}
                  onChange={setDepthCm}
                  placeholder={`30 (${t.phAmendDefault || "default"})`}
                />
              </>
            ) : null}

            {method === "base_saturation" ? (
              <>
                <NumberField
                  label={t.effectiveCec || "CEC (cmol(+)/kg)"}
                  value={cec}
                  onChange={setCec}
                  placeholder={
                    estimatedCec > 0
                      ? `${estimatedCec}${!(cec > 0) ? ` (${t.phAmendAuto || "auto"})` : ""}`
                      : t.phAmendImportHint || "Import / auto if blank"
                  }
                />
                <NumberField
                  label={t.baseSaturationCurrent || "Current base saturation (%)"}
                  value={baseSaturationCurrent}
                  onChange={setBaseSaturationCurrent}
                  placeholder={
                    estimatedBaseSaturation > 0
                      ? `${estimatedBaseSaturation}${!(baseSaturationCurrent > 0) ? ` (${t.phAmendAuto || "auto"})` : ""}`
                      : t.phAmendCalcHint || "Auto if blank"
                  }
                />
                <NumberField
                  label={t.baseSaturationTarget || "Target base saturation (%)"}
                  value={baseSaturationTarget}
                  onChange={setBaseSaturationTarget}
                  placeholder={`${cropSuggestedTarget} (${t.phAmendAuto || "auto"})`}
                />
                <p className="text-xs font-semibold text-slate-600 sm:col-span-2 dark:text-slate-300">
                  {`${t.v2SuggestedByCrop || "Target suggested by crop"}: ${cropSuggestedTarget}%`}
                  {!(cec > 0) && estimatedCec > 0
                    ? ` · ${t.phAmendCecAutoNote || "CEC estimated from exchangeable bases (+ H+Al/Al when reported)"}`
                    : ""}
                  {!(baseSaturationCurrent > 0) && estimatedBaseSaturation > 0
                    ? ` · ${t.phAmendVAutoNote || "Current V% calculated from bases / CEC"}`
                    : ""}
                  {needsMeasuredCecOrV
                    ? ` · ${t.phAmendNeedVNote || "Enter measured CIC (or H+Al) to auto-estimate V%, or type current V% yourself. Bases alone imply ~100% V% and cannot diagnose lime need."}`
                    : ""}
                </p>
                <NumberField
                  label={`${t.bulkDensity || "Bulk density"} (${t.phAmendOptional || "optional"})`}
                  value={bulkDensity}
                  onChange={setBulkDensity}
                  placeholder={`1.3 (${t.phAmendDefault || "default"})`}
                />
                <NumberField
                  label={`${t.incorporationDepth || "Incorporation depth"} (cm)`}
                  value={depthCm}
                  onChange={setDepthCm}
                  placeholder={`15 (${t.phAmendDefault || "default"})`}
                />
              </>
            ) : null}

            {method === "exchangeable_acidity" ? (
              <>
                <NumberField
                  label={t.phAmendExchangeableAcidity || "Exchangeable acidity (cmol(+)/kg)"}
                  value={exchangeableAcidity}
                  onChange={setExchangeableAcidity}
                  placeholder={
                    estimatedAcidity > 0
                      ? `${estimatedAcidity} (${t.phAmendAuto || "auto"})`
                      : t.phAmendImportHint || "Import / auto if blank"
                  }
                />
                <NumberField
                  label={t.bulkDensity || "Bulk density"}
                  value={bulkDensity}
                  onChange={setBulkDensity}
                  placeholder={`1.3 (${t.phAmendDefault || "default"})`}
                />
                <NumberField
                  label={`${t.incorporationDepth || "Incorporation depth"} (cm)`}
                  value={depthCm}
                  onChange={setDepthCm}
                  placeholder={`15 (${t.phAmendDefault || "default"})`}
                />
              </>
            ) : null}

            {method === "target_ph" || method === "sulfur" ? (
              <>
                <NumberField
                  label={t.phAmendCurrentPh || "Current soil pH"}
                  value={currentPh}
                  onChange={setCurrentPh}
                  placeholder={
                    lab.get("ph")?.value
                      ? `${lab.get("ph")!.value} (${t.phAmendAuto || "auto"})`
                      : t.phAmendImportHint || "Import / auto if blank"
                  }
                />
                <NumberField
                  label={t.phAmendTargetPh || "Target soil pH"}
                  value={targetPh}
                  onChange={setTargetPh}
                  placeholder={`${method === "sulfur" ? 5.5 : 6.2} (${t.phAmendDefault || "default"})`}
                />
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
                  placeholder={
                    resolvedAl > 0 && !(exchangeableAl > 0)
                      ? `${resolvedAl} (${t.phAmendAuto || "auto"})`
                      : t.phAmendImportHint || "Import / auto if blank"
                  }
                />
                <NumberField
                  label={t.bulkDensity || "Bulk density"}
                  value={bulkDensity}
                  onChange={setBulkDensity}
                  placeholder={`1.3 (${t.phAmendDefault || "default"})`}
                />
                <NumberField
                  label={`${t.incorporationDepth || "Incorporation depth"} (cm)`}
                  value={depthCm}
                  onChange={setDepthCm}
                  placeholder={`15 (${t.phAmendDefault || "default"})`}
                />
              </>
            ) : null}

            <div className="col-span-full grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <NumberField
                label={`${t.area || "Plot area"} (${t.phAmendOptional || "optional"})`}
                value={plotArea}
                onChange={setPlotArea}
                placeholder={`1 (${t.phAmendOptional || "optional"})`}
              />
              <SelectField
                label={t.areaUnit || "Unit"}
                value={plotAreaUnit}
                onChange={(value) => setPlotAreaUnit(value as AreaUnit)}
                options={PLOT_AREA_UNITS.map((unit) => [
                  unit,
                  t[`areaUnit_${unit}`] || areaUnitLabel(unit),
                ])}
              />
            </div>
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

      <PhAmendmentResultsCard
        t={t}
        result={result}
        outputUnit={outputUnit}
        onOutputUnitChange={setOutputUnit}
        unitLabel={unitLabel}
        plotArea={plotArea}
        plotAreaUnit={plotAreaUnit}
        showCalculatorFormulas={showCalculatorFormulas}
        onToggleLimeMaterial={
          methodRaisesPh(method) ? toggleLimeMaterial : undefined
        }
      />
    </div>
  );
}

function PhAmendmentResultsCard({
  t,
  result,
  outputUnit,
  onOutputUnitChange,
  unitLabel,
  plotArea,
  plotAreaUnit,
  showCalculatorFormulas = false,
  onToggleLimeMaterial,
}: {
  t: Record<string, string>;
  result: ReturnType<typeof calculatePhAmendment>["result"];
  outputUnit: PhAmendmentOutputUnit;
  onOutputUnitChange: (unit: PhAmendmentOutputUnit) => void;
  unitLabel: string;
  plotArea: number;
  plotAreaUnit: AreaUnit;
  showCalculatorFormulas?: boolean;
  onToggleLimeMaterial?: () => void;
}) {
  if (!result) return null;

  const unitSelect = (
    <SelectField
      label={t.phAmendOutputUnit || "Output unit"}
      value={outputUnit}
      onChange={(value) => onOutputUnitChange(value as PhAmendmentOutputUnit)}
      options={PH_AMENDMENT_OUTPUT_UNITS.map((unit) => [unit, outputUnitLabel(unit, t)])}
    />
  );

  if (result.noRequirement) {
    const reason = result.noRequirementReason;
    const message =
      reason === "chemistry_sufficient"
        ? t.amendRecNoLime ||
          t.phAmendNoReqChemistryOk ||
          "No amendment needed: CICe cation distribution and base saturation are within sufficient ranges."
        : reason === "use_gypsum"
          ? t.encaladoCaDeficitNoAcidity ||
            "Ca deficit without exchangeable acidity — use gypsum or another Ca source; saturation-based liming does not apply."
          : reason === "current_meets_target"
            ? t.phAmendNoReqMeetsTarget ||
              "No lime needed: current base saturation is already at or above the target."
            : reason === "missing_cec"
              ? t.phAmendNoReqMissingCec ||
                "Enter CEC (cmol(+)/kg) greater than 0 to calculate the dose."
              : reason === "missing_ca"
                ? t.phAmendNoReqMissingCa ||
                  "Enter exchangeable Ca (cmol(+)/kg) to calculate Cal from Ca saturation."
                : reason === "missing_current_v"
                  ? t.phAmendNoReqMissingV ||
                    "Enter current V%, or provide measured CIC / H+Al so V% can be estimated. Bases alone are not enough for this method."
                  : reason === "missing_acidity"
                    ? t.phAmendNoReqMissingAcidity ||
                      "Enter exchangeable acidity (H+Al) greater than 0 to calculate liming."
                    : reason === "missing_aluminum"
                      ? t.phAmendNoReqMissingAl ||
                        "Enter exchangeable aluminum greater than 0 to calculate gypsum."
                      : reason === "ph_already_ok"
                        ? t.phAmendNoReqPhOk ||
                          "No amendment needed: soil pH already meets the selected target."
                        : t.phAmendNoRequirement ||
                          "No amendment is required based on the selected target.";

    const detailParts: string[] = [];
    if (
      reason === "current_meets_target" &&
      result.detailCurrent !== undefined &&
      result.detailTarget !== undefined
    ) {
      detailParts.push(`V₁ ${result.detailCurrent}% → V₂ ${result.detailTarget}%`);
      if (result.detailCec !== undefined) {
        detailParts.push(`CEC ${result.detailCec} cmol(+)/kg`);
      }
    }

    return (
      <div className="ph-amend-results calc-surface p-4 space-y-2">
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{message}</p>
        {detailParts.length > 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">{detailParts.join(" · ")}</p>
        ) : null}
      </div>
    );
  }

  const primaryTha = result.adjustedRequirementTha ?? result.baseRequirementTha;
  const hasAdjusted =
    result.adjustedRequirementTha !== undefined &&
    result.adjustedRequirementTha !== result.baseRequirementTha;
  const requirementLabel =
    result.method === "gypsum"
      ? t.gypsumRequirementTitle || "Gypsum requirement"
      : result.method === "sulfur"
        ? t.phAmendSulfurRequirement || "Elemental sulfur requirement"
        : hasAdjusted
          ? t.phAmendResultAdjusted || "Adjusted requirement"
          : t.limeRequirementTitle || "Lime requirement";

  const plotTotalT =
    plotArea > 0 ? convertPhAmendmentPlotTotal(primaryTha, plotArea, plotAreaUnit) : 0;
  const plotTotalDisplay =
    outputUnit.startsWith("lb_")
      ? `${(plotTotalT * 2204.62262185).toLocaleString(undefined, { maximumFractionDigits: 0 })} lb`
      : outputUnit.startsWith("kg_") || outputUnit === "g_m2"
        ? `${(plotTotalT * 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
        : `${plotTotalT.toLocaleString(undefined, { maximumFractionDigits: 2 })} t`;

  const methodLabel = t[methodLabelKey(result.method)] || result.method;
  const materialLabel = result.material
    ? t[materialLabelKey(result.material)] || result.material
    : "";
  const recommendation =
    t[result.explanationKey] ||
    result.explanationKey ||
    (t.phAmendNoRequirement || "Review amendment dose before applying.");

  const doseKgHa = Math.max(0, primaryTha) * 1000;
  const bagsPerHa = doseKgHa / 50;
  const bagsRaw =
    plotArea > 0
      ? (convertPhAmendmentPlotTotal(primaryTha, plotArea, plotAreaUnit) * 1000) /
        50
      : bagsPerHa;
  // Whole bags: round up so the dose is never short
  const bagsForPlot = bagsRaw > 0 ? Math.ceil(bagsRaw) : 0;
  const bagsDisplay = bagsForPlot.toLocaleString(undefined, {
    maximumFractionDigits: 0,
  });
  const bagsUnit =
    plotArea > 0
      ? t.phAmendBagsUnit || "× 50 kg bags"
      : t.phAmendBagsPerHa || "× 50 kg bags/ha";
  const bagsHint =
    result.material === "dolomitic_lime"
      ? t.phAmendTapForCalcitic || "Tap for agricultural lime (higher PRNT)"
      : t.phAmendTapForDolomite || "Tap for dolomite (lower PRNT)";

  return (
    <div className="ph-amend-results calc-surface p-3 space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {t.phAmendResultsTitle || "Results"}
          </h3>
          <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
            {[methodLabel, materialLabel].filter(Boolean).join(" · ")}
            {result.ccePercent != null ? ` · PRNT ${result.ccePercent}%` : ""}
          </p>
        </div>
        {unitSelect}
      </div>

      <dl className="ph-amend-results__grid grid grid-cols-2 gap-2">
        <ResultRow
          label={requirementLabel}
          value={`${formatPhAmendmentDisplay(primaryTha, outputUnit)} ${unitLabel}`}
          highlight
        />
        <ResultRow
          label={t.phAmendBagsLabel || "50 kg bags"}
          value={`${bagsDisplay} ${bagsUnit}`}
          hint={
            onToggleLimeMaterial
              ? bagsHint
              : plotArea > 0
                ? plotTotalDisplay
                : undefined
          }
          highlight
          onClick={onToggleLimeMaterial}
        />
      </dl>

      <div className="ph-amend-results__rec rounded-xl px-3 py-2.5 calc-surface-inner">
        <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
          {t.phAmendRecommendation || t.phAmendResultExplanation || "Recommendation"}
        </p>
        <p className="mt-1 text-xs leading-snug text-slate-700 dark:text-slate-200">
          {recommendation}
          {hasAdjusted && result.ccePercent !== undefined
            ? ` ${t.phAmendAdjustedNote || `Adjusted for CCE ${result.ccePercent}%.`}`
            : ""}
        </p>
      </div>

      {showCalculatorFormulas ? (
        <div className="space-y-1 border-t border-emerald-100/80 pt-2 dark:border-white/10">
          <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            {t.phAmendResultFormula || "Formula used"}
          </p>
          <p className="font-mono text-xs text-slate-800 dark:text-slate-100">{result.formula}</p>
        </div>
      ) : null}
    </div>
  );
}

function ResultRow({
  label,
  value,
  hint,
  highlight = false,
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`ph-amend-results__row rounded-xl px-2.5 py-2 ${
        highlight ? "calc-result-card calc-result-card--active" : "calc-surface-inner"
      }${onClick ? " cursor-pointer select-none active:scale-[0.99]" : ""}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <dt className="text-[9px] font-bold uppercase tracking-wide text-emerald-800">{label}</dt>
      <dd
        className={`mt-0.5 font-extrabold leading-tight ${
          highlight ? "text-lg text-green-950" : "text-sm text-slate-800 dark:text-slate-100"
        }`}
      >
        {value}
      </dd>
      {hint ? (
        <p className="mt-1 text-[9px] leading-snug text-slate-500 dark:text-slate-400">{hint}</p>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  readOnly,
  placeholder,
}: {
  label: string;
  value: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  placeholder?: string;
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
  heading,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<MenuSelectOption | [string, string]>;
  fullWidth?: boolean;
  heading?: string;
}) {
  return (
    <MenuSelect
      label={label}
      heading={heading}
      value={value}
      onChange={onChange}
      options={options}
      fullWidth={fullWidth}
      variant="field"
    />
  );
}
