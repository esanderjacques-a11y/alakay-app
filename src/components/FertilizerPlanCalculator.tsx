"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, CircleDollarSign } from "lucide-react";
import {
  areaUnitLabel,
  type AreaUnit,
  type CalculationOutput,
  type CalculatorValue,
} from "@/lib/agronomicCalculators";
import { useMemoryNumber, useMemoryString, useEmitCalculatorOutputs } from "@/hooks/useCalculatorMemory";
import { useViewLayoutPreference } from "@/hooks/useViewLayoutPreference";
import MenuSelect from "@/components/ui/MenuSelect";
import { useSoilFertilityReference } from "@/lib/soilFertilityData";
import {
  IRRIGATION_SYSTEM_OPTIONS,
  findCropExtractionVariants,
  irrigationEfficiencyDefaults,
  type IrrigationEfficiencyTable,
  type IrrigationSystem,
} from "@/lib/soilFertilityTables";
import {
  formatAmendmentRecommendationLines,
  recommendSoilAmendment,
  soilAmendmentInputFromLabLike,
} from "@/lib/amendmentRecommendation";
import {
  buildManualDosePlan,
  buildNutrientDosePlan,
  displayExtractionLabels,
  elementalToOxideExtraction,
  fertilityDosePlanToCalculationOutputs,
  mineralizationCoefForScenario,
  mineralizationScenarioLabel,
  MINERALIZATION_SCENARIOS,
  oxideToElementalExtraction,
  type FertilityCalcStep,
  type FertilityDoseResult,
  type MineralizationScenario,
  type NutrientDisplayMode,
  type ExtractionOxide,
} from "@/lib/soilFertilityPlan";

type PlanCalcMode = "full" | "dose";

type Props = {
  t: Record<string, string>;
  lab: Map<string, CalculatorValue>;
  selectedCropName?: string | null;
  layout?: "grid" | "list";
  showCalculatorFormulas?: boolean;
  onOutputsChange?: (outputs: CalculationOutput[]) => void;
  onOpenCostPage?: () => void;
  onDosePlanChange?: (payload: {
    doses: FertilityDoseResult[];
    areaHa: number;
    irrigationSystem: IrrigationSystem;
    irrigationTable: IrrigationEfficiencyTable;
    recommendations: string[];
  }) => void;
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
  showCalculatorFormulas = false,
  onOutputsChange,
  onOpenCostPage,
  onDosePlanChange,
}: Props) {
  const { reference } = useSoilFertilityReference();
  const [storedLayout] = useViewLayoutPreference("calculator-hub");
  const resultsLayout = layoutProp ?? storedLayout;
  const cropVariants = useMemo(
    () => findCropExtractionVariants(selectedCropName, reference),
    [selectedCropName, reference]
  );
  const needsVariantChoice = cropVariants.length > 1;
  const sourceMatchedCrop = cropVariants.length === 1 ? cropVariants[0] : null;
  const [selectedTableCropKey, setSelectedTableCropKey] = useMemoryString(
    "fertilizer",
    "selectedTableCropKey",
    ""
  );
  const selectedTableCrop = useMemo(
    () => reference.cropExtraction.find((crop) => crop.cropKey === selectedTableCropKey) || null,
    [reference.cropExtraction, selectedTableCropKey]
  );
  const matchedCrop = selectedTableCrop || sourceMatchedCrop;
  const effectiveCropName = matchedCrop?.label || selectedCropName;
  const showCropPicker = cropVariants.length !== 1;
  const cropOptions = useMemo<Array<[string, string]>>(() => {
    const pool = needsVariantChoice ? cropVariants : reference.cropExtraction;
    return pool
      .map((crop) => [crop.cropKey, crop.label] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [cropVariants, needsVariantChoice, reference.cropExtraction]);

  useEffect(() => {
    if (cropVariants.length === 1) {
      const onlyKey = cropVariants[0].cropKey;
      if (selectedTableCropKey !== onlyKey) {
        setSelectedTableCropKey(onlyKey);
      }
      return;
    }
    if (
      selectedTableCropKey &&
      cropVariants.length > 1 &&
      !cropVariants.some((crop) => crop.cropKey === selectedTableCropKey)
    ) {
      setSelectedTableCropKey("");
    }
  }, [cropVariants, selectedTableCropKey, setSelectedTableCropKey]);

  const [calcModeRaw, setCalcModeRaw] = useMemoryString("fertilizer", "calcMode", "full");
  const calcMode: PlanCalcMode = calcModeRaw === "dose" ? "dose" : "full";
  const setCalcMode = (mode: PlanCalcMode) => setCalcModeRaw(mode);

  const [displayModeRaw, setDisplayModeRaw] = useMemoryString(
    "fertilizer",
    "displayMode",
    "oxide"
  );
  const displayMode: NutrientDisplayMode =
    displayModeRaw === "elemental" ? "elemental" : "oxide";
  const setDisplayMode = (mode: NutrientDisplayMode) => setDisplayModeRaw(mode);

  const [irrigationSystemRaw, setIrrigationSystemRaw] = useMemoryString(
    "fertilizer",
    "irrigationSystem",
    "aspersion_pivote"
  );
  const irrigationSystem: IrrigationSystem = (
    IRRIGATION_SYSTEM_OPTIONS as readonly string[]
  ).includes(irrigationSystemRaw)
    ? (irrigationSystemRaw as IrrigationSystem)
    : "aspersion_pivote";
  const setIrrigationSystem = (system: IrrigationSystem) => setIrrigationSystemRaw(system);

  const [areaUnitRaw, setAreaUnitRaw] = useMemoryString("fertilizer", "areaUnit", "ha");
  const areaUnit: AreaUnit = (AREA_UNITS as readonly string[]).includes(areaUnitRaw)
    ? (areaUnitRaw as AreaUnit)
    : "ha";
  const setAreaUnit = (unit: AreaUnit) => setAreaUnitRaw(unit);

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
  const [mineralizationScenario, setMineralizationScenario] =
    useState<MineralizationScenario>("conservative");
  const [customMinerCoefPercent, setCustomMinerCoefPercent] = useState(2);
  const mineralizationStorageReady = useRef(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("cultosol_n_mineralization_v1");
      if (stored) {
        const parsed = JSON.parse(stored) as {
          scenario?: MineralizationScenario;
          customPercent?: number;
        };
        if (
          parsed.scenario === "conservative" ||
          parsed.scenario === "temperate" ||
          parsed.scenario === "tropical" ||
          parsed.scenario === "custom"
        ) {
          setMineralizationScenario(parsed.scenario);
        }
        if (
          typeof parsed.customPercent === "number" &&
          Number.isFinite(parsed.customPercent) &&
          parsed.customPercent >= 0
        ) {
          setCustomMinerCoefPercent(parsed.customPercent);
        }
      }
    } catch {
      /* ignore */
    }
    mineralizationStorageReady.current = true;
  }, []);

  useEffect(() => {
    if (!mineralizationStorageReady.current) return;
    try {
      window.localStorage.setItem(
        "cultosol_n_mineralization_v1",
        JSON.stringify({
          scenario: mineralizationScenario,
          customPercent: customMinerCoefPercent,
        })
      );
    } catch {
      /* ignore */
    }
  }, [customMinerCoefPercent, mineralizationScenario]);

  const mineralizationCoef = mineralizationCoefForScenario(
    mineralizationScenario,
    customMinerCoefPercent / 100
  );
  const [pLab, setPLab] = useMemoryNumber("fertilizer", "p", lab.get("phosphorus")?.value || 0);
  const [kLab, setKLab] = useMemoryNumber("fertilizer", "k", lab.get("potassium")?.value || 0);
  const [mgLab, setMgLab] = useMemoryNumber("fertilizer", "mg", lab.get("magnesium")?.value || 0);

  const irrigDefaults = irrigationEfficiencyDefaults(
    irrigationSystem,
    reference.irrigationEfficiency
  );
  const [effN, setEffN] = useMemoryNumber("fertilizer", "effN", irrigDefaults.n);
  const [effP, setEffP] = useMemoryNumber("fertilizer", "effP", irrigDefaults.p);
  const [effK, setEffK] = useMemoryNumber("fertilizer", "effK", irrigDefaults.k);
  const [effMg, setEffMg] = useMemoryNumber("fertilizer", "effMg", irrigDefaults.mg);

  function applyIrrigationSystem(system: IrrigationSystem) {
    setIrrigationSystem(system);
    const next = irrigationEfficiencyDefaults(system, reference.irrigationEfficiency);
    setEffN(next.n);
    setEffP(next.p);
    setEffK(next.k);
    setEffMg(next.mg);
  }

  const factors = reference.oxideFactors;

  const tableExtract = useMemo<ExtractionOxide>(
    () =>
      matchedCrop
        ? {
            n: matchedCrop.n,
            p2o5: matchedCrop.p2o5,
            k2o: matchedCrop.k2o,
            cao: matchedCrop.cao,
            mgo: matchedCrop.mgo,
          }
        : { n: 0, p2o5: 0, k2o: 0, cao: 0, mgo: 0 },
    [matchedCrop]
  );

  const [extractN, setExtractN] = useMemoryNumber("fertilizer", "extractN", tableExtract.n);
  const [extractP2o5, setExtractP2o5] = useMemoryNumber(
    "fertilizer",
    "extractP2o5",
    tableExtract.p2o5
  );
  const [extractK2o, setExtractK2o] = useMemoryNumber("fertilizer", "extractK2o", tableExtract.k2o);
  const [extractCao, setExtractCao] = useMemoryNumber("fertilizer", "extractCao", tableExtract.cao);
  const [extractMgo, setExtractMgo] = useMemoryNumber("fertilizer", "extractMgo", tableExtract.mgo);
  const [extractCropCode, setExtractCropCode] = useMemoryNumber(
    "fertilizer",
    "extractCropCode",
    0
  );

  /** Known doses stored on oxide basis (N elemental, P₂O₅, K₂O, MgO). */
  const [manualNOxide, setManualNOxide] = useMemoryNumber("fertilizer", "manualDoseN", 0);
  const [manualPOxide, setManualPOxide] = useMemoryNumber("fertilizer", "manualDoseP", 0);
  const [manualKOxide, setManualKOxide] = useMemoryNumber("fertilizer", "manualDoseK", 0);
  const [manualMgOxide, setManualMgOxide] = useMemoryNumber("fertilizer", "manualDoseMg", 0);

  const extractOxide = useMemo<ExtractionOxide>(
    () => ({
      n: extractN,
      p2o5: extractP2o5,
      k2o: extractK2o,
      cao: extractCao,
      mgo: extractMgo,
    }),
    [extractN, extractP2o5, extractK2o, extractCao, extractMgo]
  );

  useEffect(() => {
    // Wait until a crop is resolved so remount without picker key does not wipe memory
    if (!matchedCrop && !selectedCropName) return;
    const key = matchedCrop?.cropKey ?? `manual:${selectedCropName || ""}`;
    const cropCode = hashCropKey(key);
    if (extractCropCode === cropCode) return;
    // Avoid wiping remembered extracts when crop picker has not restored yet
    if (!matchedCrop && extractCropCode !== 0) return;
    setExtractN(tableExtract.n);
    setExtractP2o5(tableExtract.p2o5);
    setExtractK2o(tableExtract.k2o);
    setExtractCao(tableExtract.cao);
    setExtractMgo(tableExtract.mgo);
    if (matchedCrop?.yieldMin != null) {
      setYieldTarget(
        matchedCrop.yieldMax != null
          ? (matchedCrop.yieldMin + matchedCrop.yieldMax) / 2
          : matchedCrop.yieldMin
      );
    }
    setExtractCropCode(cropCode);
  }, [
    extractCropCode,
    matchedCrop,
    selectedCropName,
    tableExtract,
    setExtractN,
    setExtractP2o5,
    setExtractK2o,
    setExtractCao,
    setExtractMgo,
    setExtractCropCode,
    setYieldTarget,
  ]);

  const displayExtract =
    displayMode === "elemental" ? oxideToElementalExtraction(extractOxide, factors) : extractOxide;

  const labels = displayExtractionLabels(displayMode);

  function applyExtractionOxide(next: ExtractionOxide) {
    setExtractN(next.n);
    setExtractP2o5(next.p2o5);
    setExtractK2o(next.k2o);
    setExtractCao(next.cao);
    setExtractMgo(next.mgo);
  }

  function updateExtractionField(field: keyof ExtractionOxide, displayValue: number) {
    if (displayMode === "elemental") {
      const asElemental = { ...displayExtract, [field]: displayValue };
      applyExtractionOxide(elementalToOxideExtraction(asElemental, factors));
      return;
    }
    applyExtractionOxide({ ...extractOxide, [field]: displayValue });
  }

  const plan = useMemo(() => {
    if (calcMode === "dose") {
      return buildManualDosePlan({
        cultivo: effectiveCropName,
        nOxideKgHa: manualNOxide,
        p2o5KgHa: manualPOxide,
        k2oKgHa: manualKOxide,
        mgoKgHa: manualMgOxide,
        area,
        areaUnit,
        displayMode,
      });
    }
    return buildNutrientDosePlan(
      {
        cultivo: effectiveCropName,
        extraction: extractOxide,
        rendimientoObjetivo: yieldTarget,
        profundidadMuestreo_cm: depthCm,
        densidadAparente_g_cm3: bulkDensity,
        materiaOrganica: organicMatter,
        mineralizationScenario,
        coeficienteMineralizacion: mineralizationCoef,
        P: pLab,
        K: kLab,
        Mg: mgLab,
        Ca: lab.get("calcium")?.value || 0,
        Na: lab.get("sodium")?.value || 0,
        cec: lab.get("cec")?.value || 0,
        ph: lab.get("ph")?.value || 0,
        exchangeableAcidity: lab.get("exchangeable_acidity")?.value || 0,
        aluminum: lab.get("aluminum")?.value || 0,
        aluminumUnit: lab.get("aluminum")?.unit,
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
    calcMode,
    effectiveCropName,
    manualNOxide,
    manualPOxide,
    manualKOxide,
    manualMgOxide,
    extractOxide,
    yieldTarget,
    depthCm,
    bulkDensity,
    organicMatter,
    mineralizationScenario,
    mineralizationCoef,
    pLab,
    kLab,
    mgLab,
    lab,
    effN,
    effP,
    effK,
    effMg,
    area,
    areaUnit,
    displayMode,
    reference,
  ]);

  const planRecommendations = useMemo(() => {
    if (!plan) return [];
    if (calcMode === "dose") return plan.recommendations;
    const amendmentInput = soilAmendmentInputFromLabLike(
      (keys) => {
        for (const key of keys) {
          const hit = lab.get(key);
          if (hit && Number.isFinite(hit.value)) return hit.value;
        }
        return null;
      },
      {
        aluminumUnit: lab.get("aluminum")?.unit,
      }
    );
    if (
      amendmentInput.organicMatterPercent == null &&
      Number.isFinite(organicMatter) &&
      organicMatter > 0
    ) {
      amendmentInput.organicMatterPercent = organicMatter;
    }
    const amendmentLines = formatAmendmentRecommendationLines(
      recommendSoilAmendment(amendmentInput),
      t
    );
    return [...plan.recommendations, ...amendmentLines];
  }, [plan, calcMode, lab, organicMatter, t]);

  function displayManualDose(oxideKgHa: number, key: "n" | "p" | "k" | "mg") {
    if (displayMode === "oxide" || key === "n") return oxideKgHa;
    if (key === "p") return oxideKgHa / factors.pToP2o5;
    if (key === "k") return oxideKgHa / factors.kToK2o;
    return oxideKgHa / factors.mgToMgo;
  }

  function setManualDoseFromDisplay(key: "n" | "p" | "k" | "mg", displayValue: number) {
    const oxide =
      displayMode === "oxide" || key === "n"
        ? displayValue
        : key === "p"
          ? displayValue * factors.pToP2o5
          : key === "k"
            ? displayValue * factors.kToK2o
            : displayValue * factors.mgToMgo;
    if (key === "n") setManualNOxide(oxide);
    else if (key === "p") setManualPOxide(oxide);
    else if (key === "k") setManualKOxide(oxide);
    else setManualMgOxide(oxide);
  }

  const reportOutputs = useMemo(
    () => (plan ? fertilityDosePlanToCalculationOutputs(plan) : []),
    [plan]
  );

  useEmitCalculatorOutputs(onOutputsChange, reportOutputs);

  useEffect(() => {
    if (!onDosePlanChange) return;
    onDosePlanChange({
      doses: plan?.doses ?? [],
      areaHa: plan?.areaHa ?? 0,
      irrigationSystem,
      irrigationTable: reference.irrigationEfficiency,
      recommendations: planRecommendations,
    });
  }, [
    plan,
    planRecommendations,
    irrigationSystem,
    reference.irrigationEfficiency,
    onDosePlanChange,
  ]);

  const selectedDose = plan?.doses.find((d) => d.key === selectedDoseKey) || null;
  const hasActiveDoses = Boolean(
    plan?.doses.some(
      (dose) =>
        !dose.notRequired &&
        !dose.viaEncalado &&
        (dose.dosisOxideKgHa || 0) > 0
    )
  );

  const yieldHint =
    matchedCrop?.yieldMin != null && matchedCrop?.yieldMax != null
      ? formatMessage(t.fertilizerPlanYieldRange || "Typical range: {min}–{max} t/ha", {
          min: matchedCrop.yieldMin,
          max: matchedCrop.yieldMax,
        })
      : null;

  const cropSummary =
    matchedCrop?.label ||
    (!showCropPicker && effectiveCropName) ||
    null;

  const isDoseOnly = calcMode === "dose";

  return (
    <div className="fertilizer-plan calc-page px-3 sm:px-4 space-y-4">
      <div className="fertilizer-plan__params calc-surface p-4 space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3 pb-2">
          <div>
            <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
              {t.fertilizerPlanTab || "Nutritional plan"}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
              {isDoseOnly
                ? t.fertilizerPlanKnownDoseDesc ||
                  "Enter known nutrient doses to estimate fertilizer product amounts and cost."
                : t.fertilizerPlanDoseDesc ||
                  t.fertilizerPlanDesc ||
                  "Dose from crop demand, soil supply, and irrigation efficiency."}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <SelectField
              label={t.fertilizerPlanMode || "Mode"}
              value={calcMode}
              onChange={(value) => setCalcMode(value as PlanCalcMode)}
              options={[
                ["full", t.fertilizerPlanModeFull || "Full (diagnosis + doses)"],
                ["dose", t.fertilizerPlanModeDose || "Doses only"],
              ]}
            />
            <SelectField
              label={t.fertilizerPlanDisplayMode || "Type"}
              value={displayMode}
              onChange={(value) => setDisplayMode(value as NutrientDisplayMode)}
              options={[
                ["oxide", t.oxide || "Óxido"],
                ["elemental", t.element || t.elemental || "Elemental"],
              ]}
            />
          </div>
        </div>

        {isDoseOnly ? (
          <PlanSection
            title={t.fertilizerPlanKnownDoses || "Known doses"}
            summary={
              area > 0
                ? `${area} ${t[`areaUnit_${areaUnit}`] || areaUnitLabel(areaUnit)}`
                : undefined
            }
            defaultOpen
          >
            <p className="text-xs text-slate-600 dark:text-slate-300 px-1">
              {t.fertilizerPlanKnownDoseHint ||
                "Enter the nutrient rates you already know (kg/ha). Leave unused nutrients at 0."}
            </p>
            <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-2">
              <NumberField
                label={`${labels.n} (kg/ha)`}
                value={displayManualDose(manualNOxide, "n")}
                onChange={(value) => setManualDoseFromDisplay("n", value)}
                preserveCase
              />
              <NumberField
                label={`${labels.p} (kg/ha)`}
                value={displayManualDose(manualPOxide, "p")}
                onChange={(value) => setManualDoseFromDisplay("p", value)}
                preserveCase
              />
              <NumberField
                label={`${labels.k} (kg/ha)`}
                value={displayManualDose(manualKOxide, "k")}
                onChange={(value) => setManualDoseFromDisplay("k", value)}
                preserveCase
              />
              <NumberField
                label={`${labels.mg} (kg/ha)`}
                value={displayManualDose(manualMgOxide, "mg")}
                onChange={(value) => setManualDoseFromDisplay("mg", value)}
                preserveCase
              />
              <NumberField label={t.area || "Area"} value={area} onChange={setArea} />
              <SelectField
                label={t.areaUnit || t.unit || "Unit"}
                value={areaUnit}
                onChange={(value) => setAreaUnit(value as AreaUnit)}
                options={AREA_UNITS.map((unit) => [
                  unit,
                  t[`areaUnit_${unit}`] || areaUnitLabel(unit),
                ])}
              />
            </div>
          </PlanSection>
        ) : null}

        {!isDoseOnly ? (
          <>
        <PlanSection
          title={t.fertilizerPlanCropPlot || t.fertilizerPlanCrop || "Crop & plot"}
          summary={
            cropSummary
              ? `${cropSummary}${yieldTarget > 0 ? ` · ${yieldTarget} t/ha` : ""}`
              : undefined
          }
          defaultOpen
        >
          {showCropPicker ? (
            <div className="calc-page__crop grid gap-2 px-3 py-3">
              <SelectField
                label={t.fertilizerPlanCrop || "Crop"}
                value={selectedTableCropKey}
                onChange={setSelectedTableCropKey}
                options={cropOptions}
                placeholder={t.fertilizerPlanSelectCrop || "Select a crop"}
                searchable
                searchPlaceholder={t.fertilizerPlanSearchCrop || "Type to search…"}
                fullWidth
              />
              <p className="text-xs text-slate-600 dark:text-slate-300">
                {needsVariantChoice
                  ? t.fertilizerPlanCropVariantHint ||
                    "This crop has more than one form. Choose the one that matches your planting."
                  : t.fertilizerPlanCropPickerHint ||
                    "Select a crop to fill extraction values and the typical yield automatically."}
              </p>
            </div>
          ) : null}

          {matchedCrop || (!showCropPicker && effectiveCropName) ? (
            <div className="calc-page__crop flex items-center gap-2 px-3 py-2.5">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                {t.fertilizerPlanCrop || "Crop"}
              </span>
              <span className="text-sm font-semibold text-green-950 dark:text-emerald-50">
                {matchedCrop?.label || effectiveCropName}
              </span>
              {!matchedCrop ? (
                <span className="text-xs text-amber-800 dark:text-amber-200">
                  {t.fertilizerPlanCropUnknown ||
                    "This crop isn't in our list — enter nutrient extraction values below."}
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
            <SelectField
              label={t.mineralizationScenario || "N mineralization scenario"}
              value={mineralizationScenario}
              onChange={(value) =>
                setMineralizationScenario(value as MineralizationScenario)
              }
              options={[
                ...MINERALIZATION_SCENARIOS.map((item) => [
                  item.key,
                  mineralizationScenarioLabel(item.key, t),
                ] as [string, string]),
                [
                  "custom",
                  mineralizationScenarioLabel("custom", t),
                ] as [string, string],
              ]}
            />
            {mineralizationScenario === "custom" ? (
              <NumberField
                label={t.mineralizationCustomCoef || "Mineralization coefficient (%)"}
                value={customMinerCoefPercent}
                onChange={setCustomMinerCoefPercent}
              />
            ) : (
              <p className="col-span-full text-xs text-slate-500 dark:text-slate-400">
                {(
                  t.mineralizationScenarioHint ||
                  "SUE302 §2.5.1 — N supply from OM uses {coef}% mineralization ({label}). Changing the scenario changes the N dose."
                )
                  .replace("{coef}", String(round3(mineralizationCoef * 100)))
                  .replace(
                    "{label}",
                    mineralizationScenarioLabel(mineralizationScenario, t)
                  )}
              </p>
            )}
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
          {yieldHint ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">{yieldHint}</p>
          ) : null}
        </PlanSection>

        <PlanSection
          title={t.fertilizerPlanExtraction || "Extraction (kg/t)"}
          summary={`${labels.n} ${displayExtract.n} · ${labels.p} ${round3(displayExtract.p2o5)} · ${labels.k} ${round3(displayExtract.k2o)}`}
          defaultOpen={false}
        >
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {t.fertilizerPlanExtractionHint ||
              "Typical nutrient extraction for the selected crop. You can edit these values."}
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
        </PlanSection>

        <PlanSection
          title={t.fertilizerPlanLabSupply || "Soil lab values"}
          summary={`P ${pLab} · K ${kLab} · Mg ${mgLab}`}
          defaultOpen={false}
        >
          <div className="calc-form-fields calc-form-fields--grid grid gap-3 sm:grid-cols-3">
            <NumberField
              label={`${t.phosphorus || "P"} (mg/kg)`}
              value={pLab}
              onChange={setPLab}
              preserveCase
            />
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
        </PlanSection>

        <PlanSection
          title={t.irrigationSystemLabel || "Irrigation system"}
          summary={`${t[`irrigation_${irrigationSystem}`] || irrigationSystem} · N ${effN}%`}
          defaultOpen={false}
        >
          <div className="calc-irrigation-picker">
            <div className="calc-irrigation-picker__row">
              <SelectField
                label={t.irrigationSystemLabel || "Irrigation system"}
                value={irrigationSystem}
                onChange={(value) => applyIrrigationSystem(value as IrrigationSystem)}
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
                onChange={setEffN}
                preserveCase
              />
              <NumberField
                label={`${labels.p} %`}
                value={effP}
                onChange={setEffP}
                preserveCase
              />
              <NumberField
                label={`${labels.k} %`}
                value={effK}
                onChange={setEffK}
                preserveCase
              />
              <NumberField
                label={`${labels.mg} %`}
                value={effMg}
                onChange={setEffMg}
                preserveCase
              />
            </div>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {t.fertilizerPlanEffHint ||
                "Efficiency is set from your irrigation type. You can edit it."}
            </p>
          </div>
        </PlanSection>
          </>
        ) : null}
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
                  selected={showCalculatorFormulas && selectedDoseKey === dose.key}
                  onSelect={
                    showCalculatorFormulas
                      ? () =>
                          setSelectedDoseKey((prev) =>
                            prev === dose.key ? null : dose.key
                          )
                      : undefined
                  }
                />
              ))}
            </div>

            {showCalculatorFormulas ? (
              selectedDose ? (
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
              )
            ) : null}
          </div>

          <details className="fertilizer-plan__interpretation calc-surface">
            <summary className="fertilizer-plan__recommendations-summary">
              {t.fertilizerPlanViewRecommendations || "View recommendations"}
            </summary>
            <div className="fertilizer-plan__recommendations-body space-y-2 px-4 pb-4 pt-1">
              <ul className="space-y-2">
                {planRecommendations.map((line) => (
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

          {hasActiveDoses && onOpenCostPage ? (
            <button
              type="button"
              onClick={onOpenCostPage}
              className="calculator-action-card text-left"
            >
              <span className="calculator-action-card__icon" aria-hidden="true">
                <CircleDollarSign size={18} />
              </span>
              <span className="calculator-action-card__copy">
                <span className="calculator-action-card__title">
                  {t.fertilizerCost || "Fertilizer cost"}
                </span>
                <span className="calculator-action-card__desc">
                  {t.fertilizerCostCta || "See prices & cost scenarios"}
                </span>
              </span>
            </button>
          ) : null}
        </>
      ) : (
        <div className="calc-surface p-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {isDoseOnly
              ? t.fertilizerPlanNeedKnownDose ||
                "Enter at least one known nutrient dose greater than zero."
              : t.fertilizerPlanNeedYield ||
                "Enter a target yield greater than zero to calculate doses."}
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
  onSelect?: () => void;
}) {
  const showPlot = areaUnit !== "ha" && dose.dosisPlot != null && dose.viaEncalado
    ? true
    : areaUnit !== "ha" && dose.dosisPlot != null && !dose.notRequired && !dose.viaEncalado;
  const valueText = dose.viaEncalado
    ? dose.dosisKgHa != null
      ? `${dose.dosisKgHa} ${dose.unitHa}`
      : t.fertilizerPlanViaLime || "Via liming"
    : dose.notRequired
      ? t.fertilizerPlanNotRequired || "No fertilizer needed"
      : showPlot && !dose.viaEncalado
        ? `${dose.dosisPlot} ${dose.unitPlot}`
        : `${dose.dosisKgHa} ${dose.unitHa}`;

  const cardClassName = `calculator-action-card fertilizer-plan__dose-card text-left ${
    layout === "list" ? "fertilizer-plan__dose-card--list" : "fertilizer-plan__dose-card--grid"
  } ${selected ? "calc-result-card--selected" : ""} ${
    dose.notRequired && !dose.viaEncalado ? "fertilizer-plan__dose-card--nf" : ""
  }`;

  const body = (
    <div className="calculator-action-card__copy">
      <p className="calculator-action-card__title">{dose.nutrient}</p>
      <p
        className={`fertilizer-plan__dose-value ${
          dose.notRequired && !dose.viaEncalado ? "fertilizer-plan__dose-value--nf" : ""
        }`}
      >
        {valueText}
      </p>
      {dose.viaEncalado ? (
        <p className="fertilizer-plan__dose-sub">
          {dose.dosisOxideKgHa != null
            ? `${t.fertilizerPlanViaLime || "Via liming"} · ${dose.demandaKgHa} ${dose.nutrientOxide}/ha`
            : t.fertilizerPlanCaNote || "Supply Ca with the Amendment calculator."}
        </p>
      ) : null}
      {!dose.notRequired && !dose.viaEncalado && showPlot ? (
        <p className="fertilizer-plan__dose-sub">{`${dose.dosisKgHa} ${dose.unitHa}`}</p>
      ) : null}
    </div>
  );

  if (!onSelect) {
    return <div className={cardClassName}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${dose.nutrient} — ${t.fertilizerPlanViewSteps || "View steps"}`}
      className={cardClassName}
    >
      {body}
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

function PlanSection({
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  title: string;
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section
      className={`fertilizer-plan__section ${open ? "fertilizer-plan__section--open" : ""}`}
    >
      <button
        type="button"
        className="fertilizer-plan__section-toggle"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="fertilizer-plan__section-heading">
          <span className="fertilizer-plan__section-title">{title}</span>
          {!open && summary ? (
            <span className="fertilizer-plan__section-summary">{summary}</span>
          ) : null}
        </span>
        <ChevronDown
          size={16}
          aria-hidden
          className={`fertilizer-plan__section-chevron shrink-0 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open ? <div className="fertilizer-plan__section-body space-y-3">{children}</div> : null}
    </section>
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
  placeholder,
  searchable,
  searchPlaceholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
  fullWidth?: boolean;
  placeholder?: string;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  return (
    <MenuSelect
      label={label}
      value={value}
      onChange={onChange}
      options={options}
      fullWidth={fullWidth}
      variant="field"
      placeholder={placeholder}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
    />
  );
}

function round3(value: number) {
  return Math.round(value * 1000) / 1000;
}

function hashCropKey(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function formatMessage(template: string, values: Record<string, string | number>) {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => String(values[key] ?? ""));
}
