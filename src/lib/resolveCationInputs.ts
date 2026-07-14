import type { CalculatorValue } from "@/lib/agronomicCalculators";
import {
  calculateBaseSaturation,
  getCicAcidityContribution,
} from "@/lib/baseSaturation";
import {
  getMemoryField,
  type CalculatorMemorySlice,
} from "@/lib/calculatorMemory";

function positive(value: number | undefined) {
  return Number.isFinite(value) && Number(value) > 0 ? Number(value) : 0;
}

function pickPositive(...values: Array<number | undefined>) {
  for (const value of values) {
    const next = positive(value);
    if (next > 0) return next;
  }
  return 0;
}

function roundNumber(value: number, decimals: number) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export type ResolvedCationInputs = {
  ca: number;
  mg: number;
  k: number;
  na: number;
  hAl: number;
  aluminum: number;
  aluminumUnit?: string;
  /** Reported CIC/CEC if available (lab or memory). */
  cecReported: number;
  /** Reported V% if available. */
  baseSaturationReported: number;
  /** CICe = reported CEC, else Ca+Mg+K+Na+(H+Al or Al). */
  estimatedCec: number;
  /** V% = reported, else (bases / CICe) × 100. */
  estimatedBaseSaturation: number;
  cecSource: "reported" | "estimated" | "none";
  baseSaturationSource: "reported" | "estimated" | "none";
};

function isEstimatedLabEntry(entry?: CalculatorValue) {
  return Boolean(entry?.label && /estimated|estime|estimad/i.test(entry.label));
}

function labReportedValue(lab: Map<string, CalculatorValue>, key: string) {
  const entry = lab.get(key);
  if (!entry || isEstimatedLabEntry(entry)) return 0;
  return positive(entry.value);
}

/**
 * Merge Values (lab map) with calculator memory (guided CIC / shared fields)
 * so CECe and base saturation resolve anywhere in the calculator flow.
 */
export function resolveCationInputs(
  lab: Map<string, CalculatorValue>,
  slice?: CalculatorMemorySlice | null
): ResolvedCationInputs {
  const memory = slice || { fields: {} };

  const ca = pickPositive(
    getMemoryField(memory, "cic", "ca"),
    getMemoryField(memory, "lab", "calcium"),
    labReportedValue(lab, "calcium")
  );
  const mg = pickPositive(
    getMemoryField(memory, "cic", "mg"),
    getMemoryField(memory, "lab", "magnesium"),
    getMemoryField(memory, "fertilizer", "mg"),
    labReportedValue(lab, "magnesium")
  );
  const k = pickPositive(
    getMemoryField(memory, "cic", "k"),
    getMemoryField(memory, "lab", "potassium"),
    getMemoryField(memory, "fertilizer", "k"),
    labReportedValue(lab, "potassium")
  );
  const na = pickPositive(
    getMemoryField(memory, "cic", "na"),
    getMemoryField(memory, "lab", "sodium"),
    labReportedValue(lab, "sodium")
  );
  const hAl = pickPositive(
    getMemoryField(memory, "cic", "hAl"),
    getMemoryField(memory, "amendment", "exchangeableAcidity"),
    getMemoryField(memory, "lab", "exchangeable_acidity"),
    labReportedValue(lab, "exchangeable_acidity")
  );
  const aluminum = pickPositive(
    getMemoryField(memory, "amendment", "exchangeableAl"),
    getMemoryField(memory, "lab", "aluminum"),
    labReportedValue(lab, "aluminum")
  );
  const aluminumUnit = lab.get("aluminum")?.unit;

  const cecReported = pickPositive(
    getMemoryField(memory, "cic", "cec"),
    getMemoryField(memory, "amendment", "cec"),
    getMemoryField(memory, "lab", "cec"),
    labReportedValue(lab, "cec")
  );
  const baseSaturationReported = pickPositive(
    getMemoryField(memory, "amendment", "baseSaturationCurrent"),
    getMemoryField(memory, "lab", "base_saturation"),
    labReportedValue(lab, "base_saturation")
  );

  const acidity = getCicAcidityContribution({
    hAl,
    aluminum,
    aluminumUnit,
  });
  const sumBases = ca + mg + k + na;
  const estimatedFromBases =
    sumBases + acidity > 0 ? roundNumber(sumBases + acidity, 2) : 0;

  // CICe from bases alone (no measured CEC / acidity) implies V%≈100% by definition —
  // useful for CIC ratios, but not for liming V% diagnosis. Only fill V% when CEC is
  // reported, or CICe includes acidity so V% can be < 100%.
  const estimatedCec =
    cecReported > 0 ? roundNumber(cecReported, 2) : estimatedFromBases;

  let estimatedBaseSaturation = 0;
  if (baseSaturationReported > 0) {
    estimatedBaseSaturation = roundNumber(baseSaturationReported, 1);
  } else if (cecReported > 0 && sumBases > 0) {
    const sat = calculateBaseSaturation({
      cec: cecReported,
      ca,
      mg,
      k,
      na,
      hAl,
      aluminum,
      aluminumUnit,
    });
    estimatedBaseSaturation = sat?.totalBasePercent || 0;
  } else if (cecReported <= 0 && acidity > 0 && estimatedFromBases > 0) {
    const sat = calculateBaseSaturation({
      cec: estimatedFromBases,
      ca,
      mg,
      k,
      na,
      hAl,
      aluminum,
      aluminumUnit,
    });
    estimatedBaseSaturation = sat?.totalBasePercent || 0;
  }

  return {
    ca,
    mg,
    k,
    na,
    hAl,
    aluminum,
    aluminumUnit,
    cecReported,
    baseSaturationReported,
    estimatedCec,
    estimatedBaseSaturation,
    cecSource:
      cecReported > 0 ? "reported" : estimatedFromBases > 0 ? "estimated" : "none",
    baseSaturationSource:
      baseSaturationReported > 0
        ? "reported"
        : estimatedBaseSaturation > 0
          ? "estimated"
          : "none",
  };
}

/** Fill missing CEC / V% on the lab map so every calculator sees them. */
export function enrichLabWithResolvedCations(
  lab: Map<string, CalculatorValue>,
  resolved: ResolvedCationInputs
): Map<string, CalculatorValue> {
  const next = new Map(lab);

  if (!positive(lab.get("cec")?.value) && resolved.estimatedCec > 0) {
    next.set("cec", {
      key: "cec",
      label: resolved.cecSource === "estimated" ? "CICe (estimated)" : "CEC",
      value: resolved.estimatedCec,
      unit: "cmol(+)/kg",
    });
  }

  if (
    !positive(lab.get("base_saturation")?.value) &&
    resolved.estimatedBaseSaturation > 0
  ) {
    next.set("base_saturation", {
      key: "base_saturation",
      label:
        resolved.baseSaturationSource === "estimated"
          ? "Base saturation (estimated)"
          : "Base saturation",
      value: resolved.estimatedBaseSaturation,
      unit: "%",
    });
  }

  const ensure = (
    key: string,
    label: string,
    value: number,
    unit = "cmol(+)/kg"
  ) => {
    if (!positive(lab.get(key)?.value) && value > 0) {
      next.set(key, { key, label, value, unit });
    }
  };

  // Bases from guided memory become visible to salinity / fertilizer readers.
  ensure("calcium", "Ca", resolved.ca);
  ensure("magnesium", "Mg", resolved.mg);
  ensure("potassium", "K", resolved.k);
  ensure("sodium", "Na", resolved.na);
  ensure("exchangeable_acidity", "H+Al", resolved.hAl);
  if (resolved.hAl <= 0) {
    ensure(
      "aluminum",
      "Al",
      resolved.aluminum,
      resolved.aluminumUnit || "cmol(+)/kg"
    );
  }

  return next;
}
