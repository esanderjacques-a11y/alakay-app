"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AreaUnit, CalculationOutput, CalculatorValue } from "@/lib/agronomicCalculators";
import { areaUnitLabel } from "@/lib/agronomicCalculators";
import {
  calculateCropCaoLimeRequirement,
  calculatePhAmendment,
  convertPhAmendmentPlotTotal,
  convertPhAmendmentUnit,
  formatPhAmendmentDisplay,
  methodRaisesPh,
  phAmendmentUnitLabel,
  DEFAULT_CA_SATURATION_TARGET,
  PH_AMENDMENT_OUTPUT_UNITS,
  suggestBaseSaturationTarget,
  type CropCaoLimeRequirement,
  type PhAmendmentMaterial,
  type PhAmendmentMethod,
  type PhAmendmentOutputUnit,
  type SoilTexture,
} from "@/lib/phAmendmentCalculator";
import { assessAmendmentChemistry } from "@/lib/amendmentRecommendation";
import { useMemoryNumber, useSharedCationInputs } from "@/hooks/useCalculatorMemory";
import MenuSelect, { type MenuSelectOption } from "@/components/ui/MenuSelect";
import { getCicAcidityContribution } from "@/lib/baseSaturation";
import { useSoilFertilityReference } from "@/lib/soilFertilityData";
import { findCropExtractionVariants } from "@/lib/soilFertilityTables";
import {
  Beaker,
  ChevronDown,
  FlaskConical,
  Mountain,
  Percent,
  ThermometerSun,
} from "lucide-react";

type Props = {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  selectedCropName?: string | null;
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

export default function PhAmendmentCalculator({ t, lab, selectedCropName, onOutputsChange }: Props) {
  const cropSuggestedTarget = suggestBaseSaturationTarget(selectedCropName);
  const { reference } = useSoilFertilityReference();
  const cropVariants = useMemo(
    () => findCropExtractionVariants(selectedCropName, reference),
    [selectedCropName, reference]
  );
  const matchedCrop = cropVariants.length === 1 ? cropVariants[0] : null;
  const tableExtractCao = matchedCrop?.cao ?? reference.defaultExtraction.cao;

  const [method, setMethod] = useState<PhAmendmentMethod>("ca_saturation");
  const [material, setMaterial] = useState<PhAmendmentMaterial>("calcitic_lime");
  const [ccePercent, setCcePercent] = useMemoryNumber("amendment", "ccePercent", 100);
  const [outputUnit, setOutputUnit] = useState<PhAmendmentOutputUnit>("t_ha");
  const [plotArea, setPlotArea] = useMemoryNumber("amendment", "plotArea", 0);
  const [plotAreaUnit, setPlotAreaUnit] = useState<AreaUnit>("ha");
  const [caoCardOpen, setCaoCardOpen] = useState(false);
  const [caSaturationTarget, setCaSaturationTarget] = useMemoryNumber(
    "amendment",
    "caSaturationTarget",
    DEFAULT_CA_SATURATION_TARGET
  );

  const defaultYield =
    matchedCrop?.yieldMin != null && matchedCrop?.yieldMax != null
      ? (matchedCrop.yieldMin + matchedCrop.yieldMax) / 2
      : matchedCrop?.yieldMin || 15;
  const [cropYield, setCropYield] = useMemoryNumber("fertilizer", "yield", defaultYield);
  const [extractCao, setExtractCao] = useMemoryNumber(
    "fertilizer",
    "extractCao",
    tableExtractCao
  );

  useEffect(() => {
    if (matchedCrop?.cao != null) setExtractCao(matchedCrop.cao);
    if (matchedCrop?.yieldMin != null) {
      setCropYield(
        matchedCrop.yieldMax != null
          ? (matchedCrop.yieldMin + matchedCrop.yieldMax) / 2
          : matchedCrop.yieldMin
      );
    }
  }, [matchedCrop?.cropKey, matchedCrop?.cao, matchedCrop?.yieldMin, matchedCrop?.yieldMax, setExtractCao, setCropYield]);

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
    if (chemGate.needsLime && chemGate.mgLow) {
      setMaterial("dolomitic_lime");
    } else if (chemGate.needsLime && !chemGate.mgLow) {
      setMaterial("calcitic_lime");
    }
  }, [chemGate.needsLime, chemGate.mgLow]);

  const cropCaoRequirement = useMemo(
    () => {
      if (!chemGate.needsLime) return null;
      return calculateCropCaoLimeRequirement({
        cropLabel: matchedCrop?.label || selectedCropName,
        extractCaoKgPerT: extractCao,
        yieldTargetTHa: cropYield,
        material: methodRaisesPh(method) ? material : "calcitic_lime",
        ccePercent,
      });
    },
    [
      chemGate.needsLime,
      matchedCrop?.label,
      selectedCropName,
      extractCao,
      cropYield,
      method,
      material,
      ccePercent,
    ]
  );

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

    if (cropCaoRequirement) {
      rows.push({
        value: cropCaoRequirement.adjustedProductKgHa,
        unit: "kg/ha",
        label: t.phAmendCropCaoLimeLabel || "Crop CaO liming product",
        formula: cropCaoRequirement.formula,
        notes: [
          `${t.phAmendCropCaoDemand || "Crop CaO demand"}: ${cropCaoRequirement.demandCaoKgHa} kg/ha`,
          `${cropCaoRequirement.cropLabel} · ${cropCaoRequirement.yieldTargetTHa} t/ha`,
          `${t.phAmendResultMaterial || "Amendment"}: ${
            cropCaoRequirement.material === "dolomitic_lime"
              ? t.phAmendMaterialDolomitic || "Dolomitic limestone"
              : t.phAmendMaterialCalcitic || "Agricultural limestone"
          } (${cropCaoRequirement.caoPercent}% CaO, CCE ${cropCaoRequirement.ccePercent}%)`,
        ],
      });
    }

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
  }, [
    cropCaoRequirement,
    result,
    method,
    outputUnit,
    plotArea,
    plotAreaUnit,
    t,
  ]);

  useEffect(() => {
    onOutputsChange?.(outputs);
  }, [onOutputsChange, outputs]);

  const showMaterial = methodRaisesPh(method) && chemGate.needsLime;
  const unitLabel = phAmendmentUnitLabel(outputUnit);

  return (
    <div className="calc-page px-3 sm:px-4 space-y-4">
      <CropCaoLimeCard
        t={t}
        requirement={cropCaoRequirement}
        open={caoCardOpen}
        onToggle={() => setCaoCardOpen((value) => !value)}
        yieldTarget={cropYield}
        onYieldChange={setCropYield}
        extractCao={extractCao}
        onExtractCaoChange={setExtractCao}
        cropLabel={matchedCrop?.label || selectedCropName}
        material={methodRaisesPh(method) ? material : "calcitic_lime"}
        outputUnit={outputUnit}
        plotArea={plotArea}
        plotAreaUnit={plotAreaUnit}
      />

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
                <p className="text-xs text-slate-600 sm:col-span-2 dark:text-slate-300">
                  {t.phAmendCaSatHint ||
                    "Tutoría §§1.4–1.5: Cal is calculated only when CICe / V% / acidity indicate liming. Target Ca saturation defaults to 68% (mid of Tabla N.° 2 61–75%)."}
                  {!chemGate.needsLime
                    ? ` · ${
                        chemGate.needsGypsum
                          ? t.encaladoCaDeficitNoAcidity ||
                            "Ca deficit without acidity — use gypsum."
                          : t.amendRecNoLime ||
                            "No lime needed: CICe / V% are within sufficient ranges."
                      }`
                    : ""}
                </p>
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

            <div className="col-span-full grid gap-3 sm:grid-cols-[1fr_auto]">
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
      />
    </div>
  );
}

function CropCaoLimeCard({
  t,
  requirement,
  open,
  onToggle,
  yieldTarget,
  onYieldChange,
  extractCao,
  onExtractCaoChange,
  cropLabel,
  material,
  outputUnit,
  plotArea,
  plotAreaUnit,
}: {
  t: Record<string, string>;
  requirement: CropCaoLimeRequirement | null;
  open: boolean;
  onToggle: () => void;
  yieldTarget: number;
  onYieldChange: (value: number) => void;
  extractCao: number;
  onExtractCaoChange: (value: number) => void;
  cropLabel?: string | null;
  material: PhAmendmentMaterial;
  outputUnit: PhAmendmentOutputUnit;
  plotArea: number;
  plotAreaUnit: AreaUnit;
}) {
  const productDisplay = requirement
    ? formatPhAmendmentDisplay(requirement.adjustedProductTha, outputUnit)
    : "—";
  const productUnit = phAmendmentUnitLabel(outputUnit);
  const materialLabel =
    material === "dolomitic_lime"
      ? t.phAmendMaterialDolomitic || "Dolomitic limestone"
      : t.phAmendMaterialCalcitic || "Agricultural limestone";
  const plotTotal =
    requirement && plotArea > 0
      ? convertPhAmendmentPlotTotal(requirement.adjustedProductTha, plotArea, plotAreaUnit)
      : 0;

  return (
    <div className="fertilizer-plan__results calc-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
          {t.phAmendCropCaoTitle || "Crop CaO demand (liming)"}
        </h3>
        {cropLabel ? (
          <span className="text-xs font-semibold text-emerald-800">{cropLabel}</span>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        aria-pressed={open}
        aria-expanded={open}
        className={`calculator-action-card fertilizer-plan__dose-card text-left fertilizer-plan__dose-card--list w-full ${
          open ? "calc-result-card--selected" : ""
        }`}
      >
        <div className="calculator-action-card__copy flex-1">
          <p className="calculator-action-card__title">CaO</p>
          <p className="fertilizer-plan__dose-value">
            {t.fertilizerPlanViaLime || "Via liming"}
          </p>
          <p className="fertilizer-plan__dose-sub">
            {requirement
              ? `${requirement.demandCaoKgHa} kg CaO/ha · ${productDisplay} ${productUnit} ${materialLabel}`
              : t.phAmendCropCaoNeedInputs ||
                "Enter yield and CaO extraction to calculate liming from crop demand."}
          </p>
        </div>
        <ChevronDown
          size={16}
          aria-hidden
          className={`shrink-0 text-emerald-800 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="space-y-3 border-t border-emerald-100/80 pt-3 dark:border-white/10">
          <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-2">
            <NumberField
              label={t.fertilizerPlanYield || "Target yield (t/ha)"}
              value={yieldTarget}
              onChange={onYieldChange}
            />
            <NumberField
              label={t.phAmendCropCaoExtract || "CaO extraction (kg/t)"}
              value={extractCao}
              onChange={onExtractCaoChange}
            />
          </div>

          {requirement ? (
            <>
              <dl className="grid gap-2 sm:grid-cols-3">
                <ResultRow
                  label={t.phAmendCropCaoDemand || "Crop CaO demand"}
                  value={`${requirement.demandCaoKgHa} kg/ha`}
                />
                <ResultRow
                  label={t.phAmendCropCaoProduct || "Liming product"}
                  value={`${productDisplay} ${productUnit}`}
                  highlight
                />
                <ResultRow
                  label={t.phAmendResultMaterial || "Amendment"}
                  value={`${materialLabel} · ${requirement.caoPercent}% CaO`}
                />
              </dl>
              {plotArea > 0 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {`${t.phAmendPlotTotal || "Plot total"}: ${plotTotal.toLocaleString(undefined, {
                    maximumFractionDigits: 2,
                  })} t (${plotArea} ${areaUnitLabel(plotAreaUnit)})`}
                </p>
              ) : null}
              <div className="space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                  {t.phAmendResultFormula || "Formula used"}
                </p>
                {requirement.steps.map((step) => (
                  <article key={step.label} className="fertilizer-plan__step">
                    <p className="fertilizer-plan__step-label">{step.label}</p>
                    <p className="fertilizer-plan__step-formula">{step.formula}</p>
                    <p className="fertilizer-plan__step-meta">
                      <span className="fertilizer-plan__step-meta-key">
                        {t.substitution || "Substitution"}
                      </span>
                      <span className="fertilizer-plan__step-meta-value">{step.substitution}</span>
                    </p>
                    <p className="fertilizer-plan__step-meta">
                      <span className="fertilizer-plan__step-meta-key">{t.result || "Result"}</span>
                      <span className="fertilizer-plan__step-result">
                        {step.result}
                        {step.unit ? ` ${step.unit}` : ""}
                      </span>
                    </p>
                  </article>
                ))}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t.phAmendCropCaoNote ||
                  "This dose covers crop calcium need with liming materials. Use the methods below for pH or base saturation correction when needed."}
              </p>
            </>
          ) : null}
        </div>
      ) : null}
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
}: {
  t: Record<string, string>;
  result: ReturnType<typeof calculatePhAmendment>["result"];
  outputUnit: PhAmendmentOutputUnit;
  onOutputUnitChange: (unit: PhAmendmentOutputUnit) => void;
  unitLabel: string;
  plotArea: number;
  plotAreaUnit: AreaUnit;
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
  const requirementLabel =
    result.method === "gypsum"
      ? t.gypsumRequirementTitle || "Gypsum requirement"
      : result.method === "sulfur"
        ? t.phAmendSulfurRequirement || "Elemental sulfur requirement"
        : t.limeRequirementTitle || "Lime requirement";

  const plotTotalT =
    plotArea > 0 ? convertPhAmendmentPlotTotal(primaryTha, plotArea, plotAreaUnit) : 0;
  const plotTotalDisplay =
    outputUnit.startsWith("lb_")
      ? `${(plotTotalT * 2204.62262185).toLocaleString(undefined, { maximumFractionDigits: 0 })} lb`
      : outputUnit.startsWith("kg_") || outputUnit === "g_m2"
        ? `${(plotTotalT * 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })} kg`
        : `${plotTotalT.toLocaleString(undefined, { maximumFractionDigits: 2 })} t`;

  return (
    <div className="ph-amend-results calc-surface p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
          {t.phAmendResultsTitle || "Results"}
        </h3>
        {unitSelect}
      </div>

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
              value={`${formatPhAmendmentDisplay(result.baseRequirementTha, outputUnit)} ${unitLabel}`}
              highlight
            />
            {result.adjustedRequirementTha !== undefined ? (
              <ResultRow
                label={t.phAmendResultAdjusted || "Adjusted requirement"}
                value={`${formatPhAmendmentDisplay(result.adjustedRequirementTha, outputUnit)} ${unitLabel}`}
                highlight
              />
            ) : null}
          </>
        ) : (
          <ResultRow
            label={requirementLabel}
            value={`${formatPhAmendmentDisplay(primaryTha, outputUnit)} ${unitLabel}`}
            highlight
          />
        )}
        {plotArea > 0 ? (
          <ResultRow
            label={t.phAmendPlotTotal || "Total for plot"}
            value={`${plotTotalDisplay} · ${plotArea} ${t[`areaUnit_${plotAreaUnit}`] || areaUnitLabel(plotAreaUnit)}`}
            highlight
          />
        ) : null}
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
        {plotArea <= 0 ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.phAmendPlotAreaHint ||
              "Optional: enter plot area above to also see total product for the field."}
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
