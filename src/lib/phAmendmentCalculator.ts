import { round } from "@/lib/agronomicCalculators";

export type PhAmendmentMethod =
  | "base_saturation"
  | "exchangeable_acidity"
  | "target_ph"
  | "gypsum"
  | "sulfur";

export type PhAmendmentMaterial = "calcitic_lime" | "dolomitic_lime";

export type SoilTexture = "sand" | "sandy_loam" | "loam" | "clay_loam" | "clay";

/**
 * Display rate for amendment doses.
 * Internal calculation stays in t/ha; these only rescale the result.
 */
export type PhAmendmentOutputUnit =
  | "t_ha"
  | "kg_ha"
  | "t_acre"
  | "kg_acre"
  | "lb_acre"
  | "t_carreau"
  | "kg_carreau"
  | "kg_m2"
  | "g_m2";

export const PH_AMENDMENT_OUTPUT_UNITS: PhAmendmentOutputUnit[] = [
  "t_ha",
  "kg_ha",
  "t_acre",
  "kg_acre",
  "lb_acre",
  "t_carreau",
  "kg_carreau",
  "kg_m2",
  "g_m2",
];

/** Hectares covered by one unit of the output area basis. */
const OUTPUT_AREA_HA: Record<PhAmendmentOutputUnit, number> = {
  t_ha: 1,
  kg_ha: 1,
  t_acre: 0.404686,
  kg_acre: 0.404686,
  lb_acre: 0.404686,
  t_carreau: 1.29,
  kg_carreau: 1.29,
  kg_m2: 0.0001,
  g_m2: 0.0001,
};

/** Mass multiplier relative to 1 tonne. */
const OUTPUT_MASS_FROM_T: Record<PhAmendmentOutputUnit, number> = {
  t_ha: 1,
  kg_ha: 1000,
  t_acre: 1,
  kg_acre: 1000,
  lb_acre: 2204.62262185,
  t_carreau: 1,
  kg_carreau: 1000,
  kg_m2: 1000,
  g_m2: 1_000_000,
};

export const PH_AMENDMENT_METHODS: PhAmendmentMethod[] = [
  "base_saturation",
  "exchangeable_acidity",
  "target_ph",
  "gypsum",
  "sulfur",
];

export const LIME_TEXTURE_FACTORS: Record<SoilTexture, number> = {
  sand: 2.5,
  sandy_loam: 3.0,
  loam: 4.0,
  clay_loam: 5.0,
  clay: 6.0,
};

export const SULFUR_TEXTURE_FACTORS: Record<SoilTexture, number> = {
  sand: 0.8,
  sandy_loam: 1.2,
  loam: 1.6,
  clay_loam: 2.0,
  clay: 2.5,
};

export type PhAmendmentInput = {
  method: PhAmendmentMethod;
  material?: PhAmendmentMaterial;
  ccePercent?: number;
  cec?: number;
  baseSaturationCurrent?: number;
  baseSaturationTarget?: number;
  exchangeableAcidity?: number;
  currentPh?: number;
  targetPh?: number;
  texture?: SoilTexture;
  exchangeableAl?: number;
  bulkDensity?: number;
  depthCm?: number;
};

export type PhAmendmentValidationError = {
  field: string;
  messageKey: string;
};

export type PhAmendmentResult = {
  method: PhAmendmentMethod;
  material?: PhAmendmentMaterial;
  baseRequirementTha: number;
  adjustedRequirementTha?: number;
  formula: string;
  explanationKey: string;
  noRequirement: boolean;
  /** Why calculation produced no dose (when noRequirement). */
  noRequirementReason?:
    | "current_meets_target"
    | "missing_cec"
    | "missing_current_v"
    | "missing_acidity"
    | "missing_aluminum"
    | "ph_already_ok"
    | "zero_dose";
  detailCurrent?: number;
  detailTarget?: number;
  detailCec?: number;
  ccePercent?: number;
};

export function methodRaisesPh(method: PhAmendmentMethod) {
  return method === "base_saturation" || method === "exchangeable_acidity" || method === "target_ph";
}

function depthDensityFactor(depthCm: number, bulkDensity: number) {
  return (depthCm / 10) * (bulkDensity / 1.3);
}

function isPhInRange(value: number | undefined) {
  return Number.isFinite(value) && value! >= 3 && value! <= 10;
}

export function validatePhAmendmentInput(input: PhAmendmentInput): PhAmendmentValidationError[] {
  const errors: PhAmendmentValidationError[] = [];
  const depth = input.depthCm ?? 15;
  const bulkDensity = input.bulkDensity ?? 1.3;

  if (depth <= 0) errors.push({ field: "depthCm", messageKey: "phAmendValidationDepth" });
  if (bulkDensity <= 0) errors.push({ field: "bulkDensity", messageKey: "phAmendValidationDensity" });

  if (methodRaisesPh(input.method)) {
    const cce = input.ccePercent ?? 100;
    if (cce < 50 || cce > 120) errors.push({ field: "ccePercent", messageKey: "phAmendValidationCce" });
  }

  switch (input.method) {
    case "base_saturation": {
      if (!Number.isFinite(input.cec) || (input.cec ?? 0) <= 0) {
        errors.push({ field: "cec", messageKey: "phAmendValidationCec" });
      }
      if (
        !Number.isFinite(input.baseSaturationCurrent) ||
        input.baseSaturationCurrent! < 0 ||
        input.baseSaturationCurrent! > 100
      ) {
        errors.push({ field: "baseSaturationCurrent", messageKey: "phAmendValidationBaseSat" });
      }
      if (
        !Number.isFinite(input.baseSaturationTarget) ||
        input.baseSaturationTarget! < 0 ||
        input.baseSaturationTarget! > 100
      ) {
        errors.push({ field: "baseSaturationTarget", messageKey: "phAmendValidationBaseSat" });
      }
      break;
    }
    case "exchangeable_acidity": {
      if (!Number.isFinite(input.exchangeableAcidity) || (input.exchangeableAcidity ?? 0) < 0) {
        errors.push({ field: "exchangeableAcidity", messageKey: "phAmendValidationAcidity" });
      }
      break;
    }
    case "target_ph": {
      if (!isPhInRange(input.currentPh)) errors.push({ field: "currentPh", messageKey: "phAmendValidationPh" });
      if (!isPhInRange(input.targetPh)) errors.push({ field: "targetPh", messageKey: "phAmendValidationPh" });
      if (
        isPhInRange(input.currentPh) &&
        isPhInRange(input.targetPh) &&
        (input.targetPh ?? 0) <= (input.currentPh ?? 0)
      ) {
        errors.push({ field: "targetPh", messageKey: "phAmendValidationTargetPhHigher" });
      }
      break;
    }
    case "gypsum": {
      if (!Number.isFinite(input.exchangeableAl) || (input.exchangeableAl ?? 0) < 0) {
        errors.push({ field: "exchangeableAl", messageKey: "phAmendValidationAl" });
      }
      break;
    }
    case "sulfur": {
      if (!isPhInRange(input.currentPh)) errors.push({ field: "currentPh", messageKey: "phAmendValidationPh" });
      if (!isPhInRange(input.targetPh)) errors.push({ field: "targetPh", messageKey: "phAmendValidationPh" });
      if (
        isPhInRange(input.currentPh) &&
        isPhInRange(input.targetPh) &&
        (input.currentPh ?? 0) <= (input.targetPh ?? 0)
      ) {
        errors.push({ field: "targetPh", messageKey: "phAmendValidationTargetPhLower" });
      }
      break;
    }
  }

  return errors;
}

export function calculatePhAmendment(input: PhAmendmentInput): {
  result: PhAmendmentResult | null;
  errors: PhAmendmentValidationError[];
} {
  const errors = validatePhAmendmentInput(input);
  if (errors.length > 0) return { result: null, errors };

  const depth = input.depthCm ?? 15;
  const bulkDensity = input.bulkDensity ?? 1.3;
  const df = depthDensityFactor(depth, bulkDensity);
  const cce = input.ccePercent ?? 100;
  const texture = input.texture ?? "loam";

  let baseRequirementTha = 0;
  let formula = "";
  let explanationKey = "";
  let noRequirement = false;
  let noRequirementReason: PhAmendmentResult["noRequirementReason"];
  let detailCurrent: number | undefined;
  let detailTarget: number | undefined;
  let detailCec: number | undefined;

  switch (input.method) {
    case "base_saturation": {
      const current = input.baseSaturationCurrent ?? 0;
      const target = input.baseSaturationTarget ?? 0;
      const cec = input.cec ?? 0;
      detailCurrent = current;
      detailTarget = target;
      detailCec = cec;
      const gap = target - current;
      if (!(cec > 0)) {
        noRequirement = true;
        noRequirementReason = "missing_cec";
      } else if (!(current > 0)) {
        noRequirement = true;
        noRequirementReason = "missing_current_v";
      } else if (gap <= 0) {
        noRequirement = true;
        noRequirementReason = "current_meets_target";
      } else {
        const cmolGap = (gap / 100) * cec;
        baseRequirementTha = cmolGap * 1.5 * df;
      }
      formula = "((V₂ − V₁) / 100) × CEC × 1.5 × (Depth / 10) × (BD / 1.3)";
      explanationKey = "phAmendExplainBaseSaturation";
      break;
    }
    case "exchangeable_acidity": {
      const acidity = input.exchangeableAcidity ?? 0;
      detailCurrent = acidity;
      if (acidity <= 0) {
        noRequirement = true;
        noRequirementReason = "missing_acidity";
      } else {
        baseRequirementTha = acidity * 1.5 * df;
      }
      formula = "Acidity × 1.5 × (Depth / 10) × (BD / 1.3)";
      explanationKey = "phAmendExplainExchangeableAcidity";
      break;
    }
    case "target_ph": {
      const current = input.currentPh ?? 0;
      const target = input.targetPh ?? 0;
      detailCurrent = current;
      detailTarget = target;
      const delta = target - current;
      if (delta <= 0) {
        noRequirement = true;
        noRequirementReason = "ph_already_ok";
      } else {
        baseRequirementTha = delta * LIME_TEXTURE_FACTORS[texture];
      }
      formula = "(Target pH − Current pH) × Texture factor";
      explanationKey = "phAmendExplainTargetPh";
      break;
    }
    case "gypsum": {
      const al = input.exchangeableAl ?? 0;
      detailCurrent = al;
      if (al <= 0) {
        noRequirement = true;
        noRequirementReason = "missing_aluminum";
      } else {
        baseRequirementTha = al * 1.72 * df;
      }
      formula = "Al × 1.72 × (Depth / 10) × (BD / 1.3)";
      explanationKey = "phAmendExplainGypsum";
      break;
    }
    case "sulfur": {
      const current = input.currentPh ?? 0;
      const target = input.targetPh ?? 0;
      detailCurrent = current;
      detailTarget = target;
      const delta = current - target;
      if (delta <= 0) {
        noRequirement = true;
        noRequirementReason = "ph_already_ok";
      } else {
        baseRequirementTha = delta * SULFUR_TEXTURE_FACTORS[texture];
      }
      formula = "(Current pH − Target pH) × Texture factor";
      explanationKey = "phAmendExplainSulfur";
      break;
    }
  }

  if (!noRequirement && baseRequirementTha <= 0) {
    noRequirement = true;
    noRequirementReason = "zero_dose";
  }

  const adjustedRequirementTha =
    methodRaisesPh(input.method) && !noRequirement && baseRequirementTha > 0
      ? baseRequirementTha / (cce / 100)
      : undefined;

  return {
    result: {
      method: input.method,
      material: methodRaisesPh(input.method) ? input.material : undefined,
      baseRequirementTha: round(baseRequirementTha, 2),
      adjustedRequirementTha:
        adjustedRequirementTha !== undefined ? round(adjustedRequirementTha, 2) : undefined,
      formula,
      explanationKey,
      noRequirement,
      noRequirementReason,
      detailCurrent,
      detailTarget,
      detailCec,
      ccePercent: methodRaisesPh(input.method) ? cce : undefined,
    },
    errors: [],
  };
}

export function convertPhAmendmentUnit(valueTha: number, unit: PhAmendmentOutputUnit) {
  if (!Number.isFinite(valueTha)) return 0;
  const rate = valueTha * OUTPUT_AREA_HA[unit] * OUTPUT_MASS_FROM_T[unit];
  if (unit === "t_ha" || unit === "t_acre" || unit === "t_carreau") return round(rate, 2);
  if (unit === "kg_m2") return round(rate, 3);
  if (unit === "g_m2") return round(rate, 1);
  return round(rate, 1);
}

export function phAmendmentUnitLabel(unit: PhAmendmentOutputUnit) {
  switch (unit) {
    case "kg_ha":
      return "kg/ha";
    case "t_acre":
      return "t/acre";
    case "kg_acre":
      return "kg/acre";
    case "lb_acre":
      return "lb/acre";
    case "t_carreau":
      return "t/carreau";
    case "kg_carreau":
      return "kg/carreau";
    case "kg_m2":
      return "kg/m²";
    case "g_m2":
      return "g/m²";
    default:
      return "t/ha";
  }
}

/** Total product for a plot = rate (t/ha) × area converted to hectares. */
export function convertPhAmendmentPlotTotal(
  valueTha: number,
  plotArea: number,
  plotAreaUnit: "ha" | "acre" | "carreau" | "m2"
) {
  const haPerUnit = { ha: 1, acre: 0.404686, carreau: 1.29, m2: 0.0001 }[plotAreaUnit];
  if (!(valueTha > 0) || !(plotArea > 0) || !(haPerUnit > 0)) return 0;
  return round(valueTha * plotArea * haPerUnit, 2);
}

export function formatPhAmendmentDisplay(value: number, unit: PhAmendmentOutputUnit) {
  const converted = convertPhAmendmentUnit(value, unit);
  if (unit === "t_ha" || unit === "t_acre" || unit === "t_carreau") {
    return converted.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  if (unit === "kg_m2") {
    return converted.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return converted.toLocaleString(undefined, { maximumFractionDigits: 1 });
}

export function suggestBaseSaturationTarget(cropName?: string | null) {
  const normalized = (cropName || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
  if (!normalized) return 70;

  const rules: Array<{ pattern: RegExp; value: number }> = [
    { pattern: /\b(arroz|rice|trigo|wheat|pasto|pasture|forage|pineapple|pina|piña)\b/, value: 50 },
    { pattern: /\b(soya|soja|soybean|cana|caña|sugarcane|algodon|algodao|cotton|frijol|frejol|bean)\b/, value: 60 },
    { pattern: /\b(banano|banana|platano|plantain|aguacate|avocado)\b/, value: 65 },
    { pattern: /\b(maiz|maize|corn|citricos|citrus|cafe|coffee|guayaba|guava|higo|fig|durazno|peach)\b/, value: 70 },
    {
      pattern:
        /\b(tomate|tomato|pepino|cucumber|pimiento|pepper|brocoli|broccoli|cebolla|onion|rabano|radish|hortaliza|vegetable|mango|papaya|maracuya|passion fruit|uva|uvas|grape)\b/,
      value: 80,
    },
  ];

  for (const rule of rules) {
    if (rule.pattern.test(normalized)) return rule.value;
  }

  return 70;
}
