import { round } from "@/lib/agronomicCalculators";
import {
  assessAmendmentChemistry,
  type SoilAmendmentInput,
} from "@/lib/amendmentRecommendation";
import { CIC_ADEQUATE_SATURATION } from "@/lib/cicInterpretation";
import { cmolToKgHa, TABLE_12_AMENDMENTS } from "@/lib/soilFertilityTables";

export type PhAmendmentMethod =
  | "ca_saturation"
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
  "ca_saturation",
  "base_saturation",
  "exchangeable_acidity",
  "target_ph",
  "gypsum",
  "sulfur",
];

/** Tabla N.° 2 adequate Ca% midpoint used as target in Tutoría worked example (68%). */
export const DEFAULT_CA_SATURATION_TARGET = CIC_ADEQUATE_SATURATION.ca.target;

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
  /** Exchangeable Ca (cmol(+)/kg) — required for Tutoría Ca-saturation Cal method. */
  caCmol?: number;
  /** Mg/K/Na used only for chemistry gating (lime vs gypsum vs none). */
  mgCmol?: number;
  kCmol?: number;
  naCmol?: number;
  ph?: number;
  baseSaturationCurrent?: number;
  baseSaturationTarget?: number;
  /** Target Ca saturation % (Tabla N.° 2 adequate midpoint default 68). */
  caSaturationTarget?: number;
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
    | "missing_ca"
    | "ph_already_ok"
    | "use_gypsum"
    | "chemistry_sufficient"
    | "zero_dose";
  detailCurrent?: number;
  detailTarget?: number;
  detailCec?: number;
  ccePercent?: number;
  /** Elemental Ca demand from Ca-sat method (kg/ha), when computed. */
  detailCaKgHa?: number;
  detailCaoKgHa?: number;
};

export function methodRaisesPh(method: PhAmendmentMethod) {
  return (
    method === "ca_saturation" ||
    method === "base_saturation" ||
    method === "exchangeable_acidity" ||
    method === "target_ph"
  );
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
    case "ca_saturation": {
      if (!Number.isFinite(input.cec) || (input.cec ?? 0) <= 0) {
        errors.push({ field: "cec", messageKey: "phAmendValidationCec" });
      }
      if (!Number.isFinite(input.caCmol) || (input.caCmol ?? 0) < 0) {
        errors.push({ field: "caCmol", messageKey: "phAmendValidationCa" });
      }
      break;
    }
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
      // Chemistry gate may still return noRequirement; Al or Na/Ca inputs are optional here.
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

function chemistryInputFromPhAmend(input: PhAmendmentInput): SoilAmendmentInput {
  return {
    ph: input.ph ?? input.currentPh,
    cec: input.cec,
    ca: input.caCmol,
    mg: input.mgCmol,
    k: input.kCmol,
    na: input.naCmol,
    exchangeableAcidity: input.exchangeableAcidity,
    aluminum: input.exchangeableAl,
  };
}

/**
 * Tutoría Plan nutricional §§1.4–1.5 — Cálculo de Cal from Ca saturation deficit.
 *
 * Sat Ca actual = Ca / CICe × 100
 * Ca objetivo (cmol) = CICe × (sat meta / 100)   (meta ≈ 68% = mid of Tabla N.° 2 61–75%)
 * Déficit Ca (cmol) = Ca objetivo − Ca actual
 * Ca kg/ha from cmol deficit × soil mass (depth × BD)
 * CaO = Ca × 1.4
 * Cal = CaO / (CaO% material / 100)
 * Ajustada = Cal / (PRNT / 100)
 */
export function calculateCalFromCaSaturation(input: {
  cice: number;
  caCmol: number;
  caSaturationTarget?: number;
  depthCm?: number;
  bulkDensity?: number;
  material?: PhAmendmentMaterial;
  prntPercent?: number;
}): {
  caCurrentPercent: number;
  caTargetPercent: number;
  caTargetCmol: number;
  caDeficitCmol: number;
  soilMassKgHa: number;
  caKgHa: number;
  caoKgHa: number;
  baseProductKgHa: number;
  adjustedProductKgHa: number;
  adjustedProductTha: number;
  caoPercent: number;
  prntPercent: number;
  formula: string;
  noRequirement: boolean;
} {
  const cice = Number(input.cice);
  const ca = Number(input.caCmol);
  const targetPct = Number(input.caSaturationTarget) || DEFAULT_CA_SATURATION_TARGET;
  const depthCm = Math.max(1, Number(input.depthCm) || 30);
  const bulkDensity = Math.max(0.1, Number(input.bulkDensity) || 1);
  const prnt = Math.max(1, Number(input.prntPercent) || 100);
  const material = input.material || "calcitic_lime";
  const caoPercent =
    material === "dolomitic_lime"
      ? TABLE_12_AMENDMENTS.dolomita.caoPercent
      : TABLE_12_AMENDMENTS.cal_agricola.caoPercent;

  const caCurrentPercent = cice > 0 ? (ca / cice) * 100 : 0;
  const caTargetCmol = cice * (targetPct / 100);
  const caDeficitCmol = Math.max(0, caTargetCmol - ca);
  const soilMassKgHa = (depthCm / 100) * bulkDensity * 10_000 * 1000;
  const caKgHa = cmolToKgHa({ cation: "ca", cmolKg: caDeficitCmol, soilMassKgHa }).kgHa;
  const caoKgHa = caKgHa * 1.4;
  const baseProductKgHa = caoPercent > 0 ? caoKgHa / (caoPercent / 100) : 0;
  const adjustedProductKgHa = baseProductKgHa / (prnt / 100);
  const adjustedProductTha = adjustedProductKgHa / 1000;

  return {
    caCurrentPercent: round(caCurrentPercent, 1),
    caTargetPercent: targetPct,
    caTargetCmol: round(caTargetCmol, 3),
    caDeficitCmol: round(caDeficitCmol, 3),
    soilMassKgHa: round(soilMassKgHa, 0),
    caKgHa: round(caKgHa, 1),
    caoKgHa: round(caoKgHa, 2),
    baseProductKgHa: round(baseProductKgHa, 1),
    adjustedProductKgHa: round(adjustedProductKgHa, 1),
    adjustedProductTha: round(adjustedProductTha, 3),
    caoPercent,
    prntPercent: prnt,
    formula:
      "Cal = [(CICe×sat_meta − Ca) → kg Ca/ha × 1.4] / (CaO%/100) / (PRNT/100)  · Tutoría §§1.4–1.5",
    noRequirement: caDeficitCmol <= 0,
  };
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
  const gate = assessAmendmentChemistry(chemistryInputFromPhAmend(input));

  let baseRequirementTha = 0;
  let formula = "";
  let explanationKey = "";
  let noRequirement = false;
  let noRequirementReason: PhAmendmentResult["noRequirementReason"];
  let detailCurrent: number | undefined;
  let detailTarget: number | undefined;
  let detailCec: number | undefined;
  let detailCaKgHa: number | undefined;
  let detailCaoKgHa: number | undefined;

  switch (input.method) {
    case "ca_saturation": {
      const cec = input.cec ?? 0;
      const ca = input.caCmol ?? 0;
      detailCec = cec;
      detailCurrent = cec > 0 ? (ca / cec) * 100 : 0;
      detailTarget = input.caSaturationTarget || DEFAULT_CA_SATURATION_TARGET;

      if (!(cec > 0)) {
        noRequirement = true;
        noRequirementReason = "missing_cec";
        formula = "Cal = f(CICe, Ca sat meta, PRNT) · Tutoría §§1.4–1.5";
        explanationKey = "phAmendExplainCaSaturation";
        break;
      }
      if (!(ca >= 0) || !Number.isFinite(ca)) {
        noRequirement = true;
        noRequirementReason = "missing_ca";
        formula = "Cal = f(CICe, Ca sat meta, PRNT) · Tutoría §§1.4–1.5";
        explanationKey = "phAmendExplainCaSaturation";
        break;
      }

      // Gate: only compute Cal when liming is chemically warranted.
      if (!gate.needsLime) {
        noRequirement = true;
        if (gate.needsGypsum) {
          noRequirementReason = "use_gypsum";
        } else if (gate.caDeficit === false && !gate.lowBaseSaturation && !gate.hasAcidity) {
          noRequirementReason = "chemistry_sufficient";
        } else {
          noRequirementReason = "chemistry_sufficient";
        }
        formula = "Cal = f(CICe, Ca sat meta, PRNT) · Tutoría §§1.4–1.5";
        explanationKey = "phAmendExplainCaSaturation";
        break;
      }

      const cal = calculateCalFromCaSaturation({
        cice: cec,
        caCmol: ca,
        caSaturationTarget: input.caSaturationTarget || DEFAULT_CA_SATURATION_TARGET,
        depthCm: depth,
        bulkDensity,
        material: input.material || "calcitic_lime",
        prntPercent: cce,
      });
      detailCurrent = cal.caCurrentPercent;
      detailTarget = cal.caTargetPercent;
      detailCaKgHa = cal.caKgHa;
      detailCaoKgHa = cal.caoKgHa;
      if (cal.noRequirement) {
        noRequirement = true;
        noRequirementReason = "current_meets_target";
      } else {
        // Base requirement in t/ha before PRNT (PRNT applied via adjustedRequirementTha below).
        // calculateCalFromCaSaturation already folds PRNT into adjustedProductTha;
        // keep base as pre-PRNT and adjusted as post-PRNT.
        baseRequirementTha = cal.baseProductKgHa / 1000;
      }
      formula = cal.formula;
      explanationKey = "phAmendExplainCaSaturation";
      break;
    }
    case "base_saturation": {
      if (!gate.needsLime) {
        noRequirement = true;
        noRequirementReason = gate.needsGypsum ? "use_gypsum" : "chemistry_sufficient";
        formula = "((V₂ − V₁) / 100) × CEC × 1.5 × (Depth / 10) × (BD / 1.3)";
        explanationKey = "phAmendExplainBaseSaturation";
        break;
      }
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
      if (!gate.needsLime) {
        noRequirement = true;
        noRequirementReason = gate.needsGypsum ? "use_gypsum" : "chemistry_sufficient";
        formula = "Acidity × 1.5 × (Depth / 10) × (BD / 1.3)";
        explanationKey = "phAmendExplainExchangeableAcidity";
        break;
      }
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
      if (!gate.needsLime) {
        noRequirement = true;
        noRequirementReason = gate.needsGypsum ? "use_gypsum" : "chemistry_sufficient";
        formula = "(Target pH − Current pH) × Texture factor";
        explanationKey = "phAmendExplainTargetPh";
        break;
      }
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
      if (!gate.needsGypsum) {
        noRequirement = true;
        noRequirementReason = "chemistry_sufficient";
        formula = "Al × 1.72 × (Depth / 10) × (BD / 1.3)  · only when gypsum is indicated";
        explanationKey = "phAmendExplainGypsum";
        break;
      }
      // Prefer Al-based gypsum rate when Al is present; otherwise Ca-deficit path uses cal method with gypsum CaO%.
      const al = input.exchangeableAl ?? 0;
      detailCurrent = al;
      if (al > 0) {
        baseRequirementTha = al * 1.72 * df;
        formula = "Al × 1.72 × (Depth / 10) × (BD / 1.3)";
      } else if (gate.caDeficit && (input.cec ?? 0) > 0 && Number.isFinite(input.caCmol)) {
        const gypsumCal = calculateCalFromCaSaturation({
          cice: input.cec!,
          caCmol: input.caCmol!,
          caSaturationTarget: input.caSaturationTarget || DEFAULT_CA_SATURATION_TARGET,
          depthCm: depth,
          bulkDensity,
          material: "calcitic_lime",
          prntPercent: 100,
        });
        // Convert to gypsum product using Tabla N.° 12 gypsum CaO%.
        const caoKgHa = gypsumCal.caoKgHa;
        const gypsumCao = TABLE_12_AMENDMENTS.yeso.caoPercent;
        const productKgHa = gypsumCao > 0 ? caoKgHa / (gypsumCao / 100) : 0;
        baseRequirementTha = productKgHa / 1000;
        detailCaKgHa = gypsumCal.caKgHa;
        detailCaoKgHa = caoKgHa;
        detailCurrent = gypsumCal.caCurrentPercent;
        detailTarget = gypsumCal.caTargetPercent;
        detailCec = input.cec;
        formula = "Gypsum = (Ca deficit → CaO) / (14% CaO)";
        if (gypsumCal.noRequirement || productKgHa <= 0) {
          noRequirement = true;
          noRequirementReason = "current_meets_target";
        }
      } else if (al <= 0) {
        noRequirement = true;
        noRequirementReason = "missing_aluminum";
        formula = "Al × 1.72 × (Depth / 10) × (BD / 1.3)";
      }
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

  // For lime methods, adjusted = base / (CCE/100). Gypsum is not PRNT-adjusted.
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
      detailCaKgHa,
      detailCaoKgHa,
      ccePercent: methodRaisesPh(input.method) ? cce : undefined,
    },
    errors: [],
  };
}

/** Tabla N.° 12 CaO content used to convert crop CaO demand into product mass. */
export const LIME_MATERIAL_CAO_PERCENT: Record<PhAmendmentMaterial, number> = {
  calcitic_lime: 40,
  dolomitic_lime: 30,
};

export type CropCaoLimeRequirement = {
  cropLabel: string;
  extractCaoKgPerT: number;
  yieldTargetTHa: number;
  demandCaoKgHa: number;
  material: PhAmendmentMaterial;
  caoPercent: number;
  ccePercent: number;
  baseProductKgHa: number;
  adjustedProductKgHa: number;
  adjustedProductTha: number;
  formula: string;
  steps: Array<{
    label: string;
    formula: string;
    substitution: string;
    result: string;
    unit: string;
  }>;
};

/**
 * Crop Ca demand from Tabla N.° 5 is supplied by liming, not NPK fertilizer.
 * Product = CaO demand / (material CaO%) / (CCE/100).
 */
export function calculateCropCaoLimeRequirement(input: {
  cropLabel?: string | null;
  extractCaoKgPerT: number;
  yieldTargetTHa: number;
  material: PhAmendmentMaterial;
  ccePercent?: number;
}): CropCaoLimeRequirement | null {
  const extract = Number(input.extractCaoKgPerT);
  const yieldTarget = Number(input.yieldTargetTHa);
  if (!(extract > 0) || !(yieldTarget > 0)) return null;

  const demandCaoKgHa = round(extract * yieldTarget, 2);
  const caoPercent = LIME_MATERIAL_CAO_PERCENT[input.material];
  const cce = Math.max(1, Number(input.ccePercent) || 100);
  const baseProductKgHa = round(demandCaoKgHa / (caoPercent / 100), 1);
  const adjustedProductKgHa = round(baseProductKgHa / (cce / 100), 1);
  const adjustedProductTha = round(adjustedProductKgHa / 1000, 3);

  return {
    cropLabel: input.cropLabel?.trim() || "Crop",
    extractCaoKgPerT: extract,
    yieldTargetTHa: yieldTarget,
    demandCaoKgHa,
    material: input.material,
    caoPercent,
    ccePercent: cce,
    baseProductKgHa,
    adjustedProductKgHa,
    adjustedProductTha,
    formula: "Product = (CaO extract × yield) / (CaO% / 100) / (CCE / 100)",
    steps: [
      {
        label: "Crop CaO demand",
        formula: "Demand = Extraction × Yield",
        substitution: `${extract} kg/t × ${yieldTarget} t/ha`,
        result: String(demandCaoKgHa),
        unit: "kg CaO/ha",
      },
      {
        label: "Base lime product",
        formula: "Product = Demand / (CaO% / 100)",
        substitution: `${demandCaoKgHa} / (${caoPercent} / 100)`,
        result: String(baseProductKgHa),
        unit: "kg/ha",
      },
      {
        label: "Adjusted for CCE",
        formula: "Adjusted = Base / (CCE / 100)",
        substitution: `${baseProductKgHa} / (${cce} / 100)`,
        result: String(adjustedProductKgHa),
        unit: "kg/ha",
      },
    ],
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
