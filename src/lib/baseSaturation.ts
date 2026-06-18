import { finitePositive, round, type CalculationOutput } from "@/lib/agronomicCalculators";
import { CIC_ADEQUATE_SATURATION } from "@/lib/cicInterpretation";

export type BaseRelationKey = "all" | "ca_mg" | "mg_k" | "ca_k" | "k_na" | "ca_na";

export type BaseSaturationInput = {
  cec?: number;
  ca?: number;
  mg?: number;
  k?: number;
  na?: number;
  hAl?: number;
  /** When true, ca/mg/k/na are already in % saturation */
  valuesArePercent?: boolean;
};

export type BaseSaturationResult = {
  cec: number;
  caPercent: number;
  mgPercent: number;
  kPercent: number;
  naPercent: number;
  hAlPercent: number;
  totalBasePercent: number;
  relations: Record<Exclude<BaseRelationKey, "all">, number | null>;
};

export type BaseCationKey = "calcium" | "magnesium" | "potassium";

export type SaturationRange = { min: number; max: number; target: number };

export const BASE_CATION_SATURATION_RANGES: Record<BaseCationKey, SaturationRange> = {
  calcium: CIC_ADEQUATE_SATURATION.ca,
  magnesium: CIC_ADEQUATE_SATURATION.mg,
  potassium: CIC_ADEQUATE_SATURATION.k,
};

const IDEAL = {
  caPercent: CIC_ADEQUATE_SATURATION.ca,
  mgPercent: CIC_ADEQUATE_SATURATION.mg,
  kPercent: CIC_ADEQUATE_SATURATION.k,
  naPercent: CIC_ADEQUATE_SATURATION.na,
  totalBasePercent: CIC_ADEQUATE_SATURATION.totalBases,
  caMg: { min: 3, max: 5 },
  mgK: { min: 2, max: 7 },
  caK: { min: 9, max: 25 },
  kNa: { min: 1, max: 15 },
  caNa: { min: 9, max: 25 },
};

export function getBaseCationSaturationRange(cation: BaseCationKey): SaturationRange {
  return BASE_CATION_SATURATION_RANGES[cation];
}

export function calculateBaseSaturation(input: BaseSaturationInput): BaseSaturationResult | null {
  const cec = finitePositive(input.cec);
  const ca = Number(input.ca);
  const mg = Number(input.mg);
  const k = Number(input.k);
  const na = Number(input.na);
  const hAl = Number(input.hAl);

  if (!cec && !input.valuesArePercent) {
    const sumBases =
      (finitePositive(ca) + finitePositive(mg) + finitePositive(k) + finitePositive(na)) || 0;
    if (!sumBases) return null;
  }

  let caPercent = 0;
  let mgPercent = 0;
  let kPercent = 0;
  let naPercent = 0;
  let hAlPercent = 0;

  if (input.valuesArePercent) {
    caPercent = finitePositive(ca);
    mgPercent = finitePositive(mg);
    kPercent = finitePositive(k);
    naPercent = finitePositive(na);
    hAlPercent = finitePositive(hAl);
  } else if (cec) {
    caPercent = finitePositive(ca) ? (ca / cec) * 100 : 0;
    mgPercent = finitePositive(mg) ? (mg / cec) * 100 : 0;
    kPercent = finitePositive(k) ? (k / cec) * 100 : 0;
    naPercent = finitePositive(na) ? (na / cec) * 100 : 0;
    hAlPercent = finitePositive(hAl) ? (hAl / cec) * 100 : 0;
  } else {
    return null;
  }

  const totalBasePercent = caPercent + mgPercent + kPercent + naPercent;
  const effectiveCec = cec || totalBasePercent + hAlPercent;

  return {
    cec: round(effectiveCec, 2),
    caPercent: round(caPercent, 1),
    mgPercent: round(mgPercent, 1),
    kPercent: round(kPercent, 1),
    naPercent: round(naPercent, 1),
    hAlPercent: round(hAlPercent, 1),
    totalBasePercent: round(totalBasePercent, 1),
    relations: {
      ca_mg: safeRatio(caPercent, mgPercent),
      mg_k: safeRatio(mgPercent, kPercent),
      ca_k: safeRatio(caPercent, kPercent),
      k_na: safeRatio(kPercent, naPercent),
      ca_na: safeRatio(caPercent, naPercent),
    },
  };
}

function safeRatio(numerator: number, denominator: number) {
  if (!finitePositive(numerator) || !finitePositive(denominator)) return null;
  return round(numerator / denominator, 2);
}

export type BaseDiagnosticLevel = "low" | "optimal" | "high" | "unknown";

export type BaseDiagnostic = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  level: BaseDiagnosticLevel;
  message: string;
};

export function diagnoseBaseBalance(
  result: BaseSaturationResult,
  labels: {
    ca: string;
    mg: string;
    k: string;
    total: string;
    caMg: string;
    mgK: string;
    low: string;
    optimal: string;
    high: string;
    limeSuggested: string;
    gypsumSuggested: string;
    kAdjustment: string;
    mgAdjustment: string;
  }
): BaseDiagnostic[] {
  const diagnostics: BaseDiagnostic[] = [];

  diagnostics.push(buildPercentDiagnostic("ca", labels.ca, result.caPercent, IDEAL.caPercent, labels));
  diagnostics.push(buildPercentDiagnostic("mg", labels.mg, result.mgPercent, IDEAL.mgPercent, labels));
  diagnostics.push(buildPercentDiagnostic("k", labels.k, result.kPercent, IDEAL.kPercent, labels));
  diagnostics.push(
    buildPercentDiagnostic("total", labels.total, result.totalBasePercent, IDEAL.totalBasePercent, labels)
  );

  diagnostics.push(
    buildRatioDiagnostic("ca_mg", labels.caMg, result.relations.ca_mg, IDEAL.caMg, labels)
  );
  diagnostics.push(
    buildRatioDiagnostic("mg_k", labels.mgK, result.relations.mg_k, IDEAL.mgK, labels)
  );

  if (result.totalBasePercent < IDEAL.totalBasePercent.min) {
    diagnostics.push({
      key: "amendment_lime",
      label: labels.total,
      value: result.totalBasePercent,
      unit: "%",
      level: "low",
      message: labels.limeSuggested,
    });
  }

  if (result.naPercent > 5) {
    diagnostics.push({
      key: "amendment_gypsum",
      label: "Na%",
      value: result.naPercent,
      unit: "%",
      level: "high",
      message: labels.gypsumSuggested,
    });
  }

  if (result.kPercent > IDEAL.kPercent.max) {
    diagnostics.push({
      key: "k_excess",
      label: labels.k,
      value: result.kPercent,
      unit: "%",
      level: "high",
      message: labels.kAdjustment,
    });
  }

  if (result.mgPercent < IDEAL.mgPercent.min) {
    diagnostics.push({
      key: "mg_deficit",
      label: labels.mg,
      value: result.mgPercent,
      unit: "%",
      level: "low",
      message: labels.mgAdjustment,
    });
  }

  return diagnostics;
}

function buildPercentDiagnostic(
  key: string,
  label: string,
  value: number,
  ideal: { min: number; max: number; target: number },
  labels: { low: string; optimal: string; high: string }
): BaseDiagnostic {
  let level: BaseDiagnosticLevel = "unknown";
  let message = labels.optimal;

  if (value < ideal.min) {
    level = "low";
    message = labels.low;
  } else if (value > ideal.max) {
    level = "high";
    message = labels.high;
  } else {
    level = "optimal";
  }

  return { key, label, value, unit: "%", level, message };
}

function buildRatioDiagnostic(
  key: string,
  label: string,
  value: number | null,
  ideal: { min: number; max: number },
  labels: { low: string; optimal: string; high: string }
): BaseDiagnostic {
  if (value === null) {
    return { key, label, value: null, unit: ":1", level: "unknown", message: "—" };
  }

  let level: BaseDiagnosticLevel = "optimal";
  let message = labels.optimal;

  if (value < ideal.min) {
    level = "low";
    message = labels.low;
  } else if (value > ideal.max) {
    level = "high";
    message = labels.high;
  }

  return { key, label, value, unit: ":1", level, message };
}

export function buildBaseSaturationOutputs(
  result: BaseSaturationResult,
  relationFilter: BaseRelationKey
): CalculationOutput[] {
  const outputs: CalculationOutput[] = [
    {
      value: result.caPercent,
      unit: "%",
      label: "Ca saturation",
      formula: "(Ca / CIC) × 100",
      notes: [`Target ${IDEAL.caPercent.min}–${IDEAL.caPercent.max}%`],
    },
    {
      value: result.mgPercent,
      unit: "%",
      label: "Mg saturation",
      formula: "(Mg / CIC) × 100",
      notes: [`Target ${IDEAL.mgPercent.min}–${IDEAL.mgPercent.max}%`],
    },
    {
      value: result.kPercent,
      unit: "%",
      label: "K saturation",
      formula: "(K / CIC) × 100",
      notes: [`Target ${IDEAL.kPercent.min}–${IDEAL.kPercent.max}%`],
    },
    {
      value: result.naPercent,
      unit: "%",
      label: "Na saturation",
      formula: "(Na / CIC) × 100",
      notes: ["Keep below 5% when possible; elevated Na may require gypsum."],
    },
    {
      value: result.totalBasePercent,
      unit: "%",
      label: "Total base saturation (V%)",
      formula: "Ca% + Mg% + K% + Na%",
      notes: [`CIC/CICe: ${result.cec} cmol(+)/kg`],
    },
  ];

  const relationEntries: Array<[BaseRelationKey, string]> = [
    ["ca_mg", "Ca/Mg"],
    ["mg_k", "Mg/K"],
    ["ca_k", "Ca/K"],
    ["k_na", "K/Na"],
    ["ca_na", "Ca/Na"],
  ];

  for (const [key, label] of relationEntries) {
    if (relationFilter !== "all" && relationFilter !== key) continue;
    const value = result.relations[key as Exclude<BaseRelationKey, "all">];
    if (value === null) continue;
    const ratioIdeal = IDEAL[key as keyof typeof IDEAL];
    const rangeNote =
      ratioIdeal && "min" in ratioIdeal
        ? `Target ${ratioIdeal.min}–${ratioIdeal.max}`
        : "Use as a base-balance indicator before liming or fertilizing.";
    outputs.push({
      value,
      unit: ":1",
      label,
      formula: `${label.split("/")[0]}% / ${label.split("/")[1]}%`,
      notes: [rangeNote],
    });
  }

  return outputs;
}
