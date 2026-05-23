export type AreaUnit = "ha" | "carreau" | "acre" | "m2";
export type FertilizerMode = "element" | "oxide";
export type LimeMethod = "earth_practical" | "target_ph" | "exchangeable_acidity" | "buffer_index";
export type AmendmentMaterial = "calcitic_lime" | "dolomitic_lime" | "gypsum";

export type CalculatorValue = {
  key: string;
  label: string;
  value: number;
  unit?: string;
};

export type CalculationOutput = {
  value: number;
  unit: string;
  label: string;
  formula: string;
  notes: string[];
  alternatives?: Array<{
    value: number;
    unit: string;
  }>;
};

const AREA_TO_HA: Record<AreaUnit, number> = {
  ha: 1,
  carreau: 1.29,
  acre: 0.404686,
  m2: 0.0001,
};

export function convertAreaToHa(area: number, unit: AreaUnit) {
  return finitePositive(area) * AREA_TO_HA[unit];
}

export function calculateCNRatio(carbon: number, nitrogen: number): CalculationOutput | null {
  if (!finitePositive(carbon) || !finitePositive(nitrogen)) return null;

  return {
    value: round(carbon / nitrogen, 2),
    unit: ":1",
    label: "C/N",
    formula: "C / N",
    notes: [
      "Useful for judging organic matter decomposition speed and nitrogen immobilization risk.",
    ],
  };
}

export function calculateNutrientRatio(
  numerator: CalculatorValue,
  denominator: CalculatorValue
): CalculationOutput | null {
  if (!finitePositive(numerator.value) || !finitePositive(denominator.value)) return null;

  return {
    value: round(numerator.value / denominator.value, 2),
    unit: ":1",
    label: `${numerator.label}/${denominator.label}`,
    formula: `${numerator.label} / ${denominator.label}`,
    notes: ["Use ratios as balance indicators, not as a replacement for crop-specific sufficiency ranges."],
  };
}

export function calculateFertilizerRequirement(input: {
  current?: number;
  target: number;
  nutrientPercent: number;
  area: number;
  areaUnit: AreaUnit;
  mode?: FertilizerMode;
  efficiencyPercent?: number;
}) {
  const current = Number.isFinite(input.current) ? Number(input.current) : 0;
  const deficit = Math.max(0, input.target - current);
  const areaHa = convertAreaToHa(input.area, input.areaUnit);
  const nutrientFraction = finitePositive(input.nutrientPercent) / 100;
  const efficiencyFraction = Math.min(1, Math.max(0.05, (input.efficiencyPercent || 100) / 100));
  if (!deficit || !areaHa || !nutrientFraction) return null;

  const kgPerHa = deficit / nutrientFraction / efficiencyFraction;

  return {
    value: round(kgPerHa * areaHa, 2),
    unit: "kg product",
    label: "Fertilizer requirement",
    formula: "(target - current) / nutrient fraction / efficiency * area",
    notes: [
      `${round(kgPerHa, 2)} kg product/ha before local calibration.`,
      input.mode === "oxide"
        ? "Input is treated as oxide grade, such as P2O5 or K2O."
        : "Input is treated as elemental nutrient grade.",
    ],
  } satisfies CalculationOutput;
}

export function calculateSoilAmendment(input: {
  method: LimeMethod;
  material: AmendmentMaterial;
  currentPh?: number;
  targetPh?: number;
  exchangeableAcidity?: number;
  bufferIndex?: number;
  baseSaturationCurrent?: number;
  baseSaturationTarget?: number;
  effectiveCec?: number;
  incorporationFactor?: number;
  rndtPercent?: number;
  bulkDensity?: number;
  depthCm?: number;
  area: number;
  areaUnit: AreaUnit;
}) {
  const areaHa = convertAreaToHa(input.area, input.areaUnit);
  const rndt = Math.min(1.5, Math.max(0.1, (input.rndtPercent || 90) / 100));
  const depthFactor = (input.depthCm || 20) / 20;
  const densityFactor = (input.bulkDensity || 1.25) / 1.25;
  let tonsPerHa = 0;
  let methodNote = "";
  let formula = "";

  if (input.method === "earth_practical") {
    const baseCurrent = finitePositive(input.baseSaturationCurrent);
    const baseTarget = finitePositive(input.baseSaturationTarget);
    const cecEffective = finitePositive(input.effectiveCec);
    const prntPercent = Math.max(1, input.rndtPercent || 90);
    const incorporationFactor = finitePositive(input.incorporationFactor) || 1;
    const baseGap = Math.max(0, baseTarget - baseCurrent);
    tonsPerHa = ((baseGap * cecEffective) / (10 * prntPercent)) * incorporationFactor;
    formula = "((V2 - V1) * CICE) / (10 * PRNT) * f";
    methodNote =
      "Base-saturation method: V1 current base saturation, V2 target base saturation, CICE effective CEC, PRNT neutralization value, and f incorporation factor.";
  }

  if (input.method === "target_ph") {
    const gap = Math.max(0, (input.targetPh || 6.2) - (input.currentPh || 0));
    tonsPerHa = gap * 2.2 * depthFactor * densityFactor / rndt;
    formula = "target_ph adjusted by depth, bulk density, RNDT, and area";
    methodNote = "Simple target pH estimate. Confirm with local buffer/acidity method when possible.";
  }

  if (input.method === "exchangeable_acidity") {
    tonsPerHa = finitePositive(input.exchangeableAcidity) * 1.5 * depthFactor * densityFactor / rndt;
    formula = "exchangeable_acidity adjusted by depth, bulk density, RNDT, and area";
    methodNote = "Exchangeable acidity estimate. Best when the lab reports acidity or Al+H.";
  }

  if (input.method === "buffer_index") {
    const target = input.targetPh || 6.5;
    const buffer = input.bufferIndex || target;
    tonsPerHa = Math.max(0, target - buffer) * 5.5 * depthFactor * densityFactor / rndt;
    formula = "buffer_index adjusted by depth, bulk density, RNDT, and area";
    methodNote = "Buffer-index estimate. Use the lab's local calibration if it provides one.";
  }

  if (!tonsPerHa || !areaHa) return null;

  const materialNote =
    input.material === "gypsum"
      ? "Gypsum supplies calcium and sulfur and is more relevant for sodicity/salinity structure problems than pH increase."
      : input.material === "dolomitic_lime"
        ? "Dolomitic lime also supplies magnesium."
        : "Calcitic lime mainly supplies calcium carbonate equivalent.";

  const totalTons = tonsPerHa * areaHa;

  return {
    value: round(totalTons, 2),
    unit: "t product",
    label: input.material === "gypsum" ? "Gypsum requirement" : "Lime requirement",
    formula,
    notes: [`${round(tonsPerHa, 2)} t/ha estimated.`, methodNote, materialNote],
    alternatives: [
      {
        value: round(totalTons * 1000, 2),
        unit: "kg product",
      },
    ],
  } satisfies CalculationOutput;
}

export function calculateDop(value: number, optimum: number) {
  if (!Number.isFinite(value) || !finitePositive(optimum)) return null;
  const dop = ((value - optimum) / optimum) * 100;

  return {
    value: round(dop, 1),
    unit: "%",
    label: "DOP",
    formula: "((value - optimum) / optimum) * 100",
    notes: [
      dop < 0 ? "Negative DOP indicates deficiency relative to optimum." : "Positive DOP indicates excess relative to optimum.",
    ],
  } satisfies CalculationOutput;
}

export function calculatePorosity(bulkDensity: number, particleDensity = 2.65) {
  if (!finitePositive(bulkDensity) || !finitePositive(particleDensity)) return null;

  return {
    value: round((1 - bulkDensity / particleDensity) * 100, 1),
    unit: "%",
    label: "Porosity",
    formula: "(1 - bulk density / particle density) * 100",
    notes: ["Typical mineral soil particle density default is 2.65 g/cm3."],
  } satisfies CalculationOutput;
}

export function calculateSar(sodium: number, calcium: number, magnesium: number) {
  if (!finitePositive(sodium) || !finitePositive(calcium + magnesium)) return null;

  return {
    value: round(sodium / Math.sqrt((calcium + magnesium) / 2), 2),
    unit: "",
    label: "SAR / RAS",
    formula: "Na / sqrt((Ca + Mg) / 2)",
    notes: ["Use mmolc/L or consistent water extract units for Na, Ca, and Mg."],
  } satisfies CalculationOutput;
}

export function calculatePsi(exchangeableSodium: number, cec: number) {
  if (!finitePositive(exchangeableSodium) || !finitePositive(cec)) return null;

  return {
    value: round((exchangeableSodium / cec) * 100, 2),
    unit: "%",
    label: "PSI / ESP",
    formula: "(Na exchangeable / CEC) * 100",
    notes: ["Use consistent exchangeable Na and CEC units such as cmol(+)/kg or meq/100g."],
  } satisfies CalculationOutput;
}

export function calculateGypsumRequirementByPsi(input: {
  cec: number;
  psiCurrent: number;
  psiTarget: number;
}) {
  if (!finitePositive(input.cec)) return null;
  const psiGap = Math.max(0, input.psiCurrent - input.psiTarget);
  if (!psiGap) return null;

  const meqPer100g = input.cec * (psiGap / 100);

  return {
    meqPer100g: round(meqPer100g, 3),
    mgPer100g: round(meqPer100g * 87, 2),
    kgPerTon: round(meqPer100g * 1.74, 2),
  };
}

export function calculateLeachingRequirement(ecWater: number, ecSoilTarget: number) {
  if (!finitePositive(ecWater) || !finitePositive(ecSoilTarget)) return null;
  const denominator = 5 * ecSoilTarget - ecWater;
  if (denominator <= 0) return null;

  return {
    value: round((ecWater / denominator) * 100, 1),
    unit: "%",
    label: "Leaching requirement",
    formula: "ECw / (5 * ECe target - ECw) * 100",
    notes: ["Requires drainage. Do not apply leaching water where drainage is poor."],
  } satisfies CalculationOutput;
}

export function calculateTotalWaterFromLeaching(et: number, rlFraction: number) {
  if (!finitePositive(et)) return null;
  if (!Number.isFinite(rlFraction) || rlFraction < 0 || rlFraction >= 1) return null;

  return {
    value: round(et / (1 - rlFraction), 3),
    unit: "ET units",
    label: "Total water",
    formula: "ET / (1 - RL)",
    notes: ["ET and total water use the same base unit (for example mm or m3/ha)."],
  } satisfies CalculationOutput;
}

export function finitePositive(value: number | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}

export function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
