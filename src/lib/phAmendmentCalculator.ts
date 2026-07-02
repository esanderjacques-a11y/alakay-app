import { round } from "@/lib/agronomicCalculators";

export type PhAmendmentMethod =
  | "base_saturation"
  | "exchangeable_acidity"
  | "target_ph"
  | "gypsum"
  | "sulfur";

export type PhAmendmentMaterial = "calcitic_lime" | "dolomitic_lime";

export type SoilTexture = "sand" | "sandy_loam" | "loam" | "clay_loam" | "clay";

export type PhAmendmentOutputUnit = "t_ha" | "kg_ha";

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

  switch (input.method) {
    case "base_saturation": {
      const gap = (input.baseSaturationTarget ?? 0) - (input.baseSaturationCurrent ?? 0);
      if (gap <= 0) {
        noRequirement = true;
      } else {
        const cmolGap = (gap / 100) * (input.cec ?? 0);
        baseRequirementTha = cmolGap * 1.5 * df;
      }
      formula = "((V₂ − V₁) / 100) × CEC × 1.5 × (Depth / 10) × (BD / 1.3)";
      explanationKey = "phAmendExplainBaseSaturation";
      break;
    }
    case "exchangeable_acidity": {
      const acidity = input.exchangeableAcidity ?? 0;
      if (acidity <= 0) {
        noRequirement = true;
      } else {
        baseRequirementTha = acidity * 1.5 * df;
      }
      formula = "Acidity × 1.5 × (Depth / 10) × (BD / 1.3)";
      explanationKey = "phAmendExplainExchangeableAcidity";
      break;
    }
    case "target_ph": {
      const delta = (input.targetPh ?? 0) - (input.currentPh ?? 0);
      if (delta <= 0) {
        noRequirement = true;
      } else {
        baseRequirementTha = delta * LIME_TEXTURE_FACTORS[texture];
      }
      formula = "(Target pH − Current pH) × Texture factor";
      explanationKey = "phAmendExplainTargetPh";
      break;
    }
    case "gypsum": {
      const al = input.exchangeableAl ?? 0;
      if (al <= 0) {
        noRequirement = true;
      } else {
        baseRequirementTha = al * 1.72 * df;
      }
      formula = "Al × 1.72 × (Depth / 10) × (BD / 1.3)";
      explanationKey = "phAmendExplainGypsum";
      break;
    }
    case "sulfur": {
      const delta = (input.currentPh ?? 0) - (input.targetPh ?? 0);
      if (delta <= 0) {
        noRequirement = true;
      } else {
        baseRequirementTha = delta * SULFUR_TEXTURE_FACTORS[texture];
      }
      formula = "(Current pH − Target pH) × Texture factor";
      explanationKey = "phAmendExplainSulfur";
      break;
    }
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
      noRequirement: noRequirement || baseRequirementTha <= 0,
      ccePercent: methodRaisesPh(input.method) ? cce : undefined,
    },
    errors: [],
  };
}

export function convertPhAmendmentUnit(valueTha: number, unit: PhAmendmentOutputUnit) {
  if (unit === "kg_ha") return round(valueTha * 1000, 1);
  return valueTha;
}

export function phAmendmentUnitLabel(unit: PhAmendmentOutputUnit) {
  return unit === "kg_ha" ? "kg/ha" : "t/ha";
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
