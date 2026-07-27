/**
 * Irrigation water quality indices from EARTH Unidad 4
 * (Prof. Diego Villaseñor Ortiz — Evaluación del agua de riego).
 *
 * Formulas and severity bands follow AGUA.pdf lecture notes.
 */

export type WaterIonInputs = {
  /** Electrical conductivity in dS/m (also mmhos/cm). */
  ecDsM?: number | null;
  /** Sodium adsorption ratio (RAS), unitless — meq/L basis. */
  sar?: number | null;
  naMgL?: number | null;
  caMgL?: number | null;
  mgMgL?: number | null;
  clMgL?: number | null;
  bMgL?: number | null;
  hco3MgL?: number | null;
  /** Optional meq/L if already converted (preferred for RAS when available). */
  naMeqL?: number | null;
  caMeqL?: number | null;
  mgMeqL?: number | null;
};

/** mg/L → meq/L conversion factors used in the lecture case studies. */
export const MEQ_FACTORS = {
  Ca: 0.0499,
  Mg: 0.0822,
  Na: 0.0434,
  K: 0.0256,
  Cl: 0.0282,
  SO4: 0.0208,
  HCO3: 0.0164,
  CO3: 0.0333,
  NO3: 0.0161,
  NH4: 0.0554,
  PO4: 0.03158,
} as const;

export function mgLToMeq(mgL: number, factor: number) {
  return mgL * factor;
}

/** Salt concentration (g/L) ≈ EC (dS/m) × 0.64 (Urbano Terrón / Ayers & Westcot). */
export function saltConcentrationGL(ecDsM: number) {
  return ecDsM * 0.64;
}

/**
 * RAS / SAR = Na / sqrt((Ca + Mg) / 2) with ions in meq/L.
 */
export function computeRas(naMeq: number, caMeq: number, mgMeq: number) {
  const denom = Math.sqrt((caMeq + mgMeq) / 2);
  if (!Number.isFinite(denom) || denom <= 0) return null;
  return naMeq / denom;
}

/**
 * French hardness °f = (Ca×2.5 + Mg×4.2) / 10 with Ca, Mg in mg/L.
 */
export function hardnessFrenchDegrees(caMgL: number, mgMgL: number) {
  return (caMgL * 2.5 + mgMgL * 4.2) / 10;
}

export type HardnessClass =
  | "very_soft"
  | "soft"
  | "medium_soft"
  | "medium_hard"
  | "hard"
  | "very_hard";

export function classifyHardnessFrench(degreesF: number): HardnessClass {
  if (degreesF < 7) return "very_soft";
  if (degreesF <= 14) return "soft";
  if (degreesF <= 22) return "medium_soft";
  if (degreesF <= 32) return "medium_hard";
  if (degreesF <= 54) return "hard";
  return "very_hard";
}

/**
 * Kelly index (%) = Ca / (Ca + Mg + Na) × 100 with ions in mg/L.
 * Lecture: values above 35% are good for irrigation use.
 */
export function kellyIndex(caMgL: number, mgMgL: number, naMgL: number) {
  const sum = caMgL + mgMgL + naMgL;
  if (!Number.isFinite(sum) || sum <= 0) return null;
  return (caMgL / sum) * 100;
}

export type Severity = "none" | "moderate" | "high";

/** Page 7 severity table — potential water-quality problems. */
export function severityFromBands(
  value: number,
  noneMax: number,
  moderateMax: number
): Severity {
  if (value <= noneMax) return "none";
  if (value <= moderateMax) return "moderate";
  return "high";
}

export function sodiumToxicitySeverity(naPpm: number): Severity {
  // Vidal (2007) / lecture p.10 — aligned with p.7 Na bands
  return severityFromBands(naPpm, 70, 180);
}

export function chlorideToxicitySeverity(clPpm: number): Severity {
  // Vidal (2007): <68 / 68–170 / >170 — use lecture p.10
  return severityFromBands(clPpm, 68, 170);
}

export function boronToxicitySeverity(bPpm: number): Severity {
  // Vidal (2007): <0.7 / 0.7–3 / >3
  return severityFromBands(bPpm, 0.7, 3);
}

export function rasSeverity(ras: number): Severity {
  // Page 7: <3 none, 3–6 moderate, >6 high
  return severityFromBands(ras, 3, 6);
}

/**
 * Ayers & Westcot (1976) salinity interpretation via EC (dS/m).
 * Lecture p.5: ≤0.7 none; 0.7–3 increasing; >3 severe.
 */
export function ecSalinitySeverity(ecDsM: number): Severity {
  if (ecDsM <= 0.7) return "none";
  if (ecDsM <= 3) return "moderate";
  return "high";
}

/** Classic US Salinity Laboratory C class from EC (dS/m). */
export type SalinityClass = "C1" | "C2" | "C3" | "C4" | "C5" | "C6";

export function classifySalinityC(ecDsM: number): SalinityClass {
  if (ecDsM < 0.25) return "C1";
  if (ecDsM < 0.75) return "C2";
  if (ecDsM < 2.25) return "C3";
  if (ecDsM < 5) return "C4";
  if (ecDsM < 10) return "C5";
  return "C6";
}

/** Classic US Salinity Laboratory S class from RAS. */
export type SodicityClass = "S1" | "S2" | "S3" | "S4";

export function classifySodicityS(ras: number): SodicityClass {
  if (ras < 10) return "S1";
  if (ras < 18) return "S2";
  if (ras < 26) return "S3";
  return "S4";
}

export const SALINITY_CLASS_NOTES: Record<SalinityClass, string> = {
  C1: "Low salinity — suitable for irrigation in most cases. Problems only on very low-permeability soils.",
  C2: "Medium salinity — usable for irrigation; may need extra leaching volume and salt-tolerant crops.",
  C3: "High salinity — use on well-drained soils with leaching and salt-tolerant crops.",
  C4: "Very high salinity — often unsuitable; only permeable, well-drained soils with high leaching and very tolerant crops.",
  C5: "Excessive salinity — use only in rare cases with extreme precautions.",
  C6: "Excessive salinity — not recommended for irrigation.",
};

export const SODICITY_CLASS_NOTES: Record<SodicityClass, string> = {
  S1: "Low sodium — suitable in most cases; watch Na-sensitive crops.",
  S2: "Medium sodium — risk of Na buildup on fine-textured / low-permeability soils; monitor ESP.",
  S3: "High sodium — organic matter and gypsum amendments, good drainage, and ample irrigation volumes advised.",
  S4: "Very high sodium — generally not advisable for irrigation except at low salinity with full precautions.",
};

export const HARDNESS_CLASS_LABELS: Record<HardnessClass, string> = {
  very_soft: "Very soft (<7 °f)",
  soft: "Soft (7–14 °f)",
  medium_soft: "Medium soft (14–22 °f)",
  medium_hard: "Medium hard (22–32 °f)",
  hard: "Hard (32–54 °f)",
  very_hard: "Very hard (>54 °f)",
};

export type WaterQualitySummary = {
  saltGL: number | null;
  ras: number | null;
  hardnessF: number | null;
  hardnessClass: HardnessClass | null;
  kellyPct: number | null;
  kellyOk: boolean | null;
  salinityClass: SalinityClass | null;
  sodicityClass: SodicityClass | null;
  ecSeverity: Severity | null;
  rasSeverity: Severity | null;
  naSeverity: Severity | null;
  clSeverity: Severity | null;
  bSeverity: Severity | null;
  notes: string[];
};

function resolveMeq(
  meq: number | null | undefined,
  mgL: number | null | undefined,
  factor: number
) {
  if (meq != null && Number.isFinite(meq)) return meq;
  if (mgL != null && Number.isFinite(mgL)) return mgLToMeq(mgL, factor);
  return null;
}

export function buildIrrigationWaterQualitySummary(
  input: WaterIonInputs
): WaterQualitySummary {
  const notes: string[] = [];
  const caMeq = resolveMeq(input.caMeqL, input.caMgL, MEQ_FACTORS.Ca);
  const mgMeq = resolveMeq(input.mgMeqL, input.mgMgL, MEQ_FACTORS.Mg);
  const naMeq = resolveMeq(input.naMeqL, input.naMgL, MEQ_FACTORS.Na);

  let ras = input.sar != null && Number.isFinite(input.sar) ? input.sar : null;
  if (ras == null && caMeq != null && mgMeq != null && naMeq != null) {
    ras = computeRas(naMeq, caMeq, mgMeq);
  }

  const saltGL =
    input.ecDsM != null && Number.isFinite(input.ecDsM)
      ? saltConcentrationGL(input.ecDsM)
      : null;

  const hardnessF =
    input.caMgL != null &&
    input.mgMgL != null &&
    Number.isFinite(input.caMgL) &&
    Number.isFinite(input.mgMgL)
      ? hardnessFrenchDegrees(input.caMgL, input.mgMgL)
      : null;

  const kellyPct =
    input.caMgL != null &&
    input.mgMgL != null &&
    input.naMgL != null &&
    Number.isFinite(input.caMgL) &&
    Number.isFinite(input.mgMgL) &&
    Number.isFinite(input.naMgL)
      ? kellyIndex(input.caMgL, input.mgMgL, input.naMgL)
      : null;

  const kellyOk = kellyPct == null ? null : kellyPct > 35;

  const salinityClass =
    input.ecDsM != null && Number.isFinite(input.ecDsM)
      ? classifySalinityC(input.ecDsM)
      : null;
  const sodicityClass = ras != null ? classifySodicityS(ras) : null;

  const ecSeverity =
    input.ecDsM != null && Number.isFinite(input.ecDsM)
      ? ecSalinitySeverity(input.ecDsM)
      : null;
  const rasSev = ras != null ? rasSeverity(ras) : null;
  const naSeverity =
    input.naMgL != null && Number.isFinite(input.naMgL)
      ? sodiumToxicitySeverity(input.naMgL)
      : null;
  const clSeverity =
    input.clMgL != null && Number.isFinite(input.clMgL)
      ? chlorideToxicitySeverity(input.clMgL)
      : null;
  const bSeverity =
    input.bMgL != null && Number.isFinite(input.bMgL)
      ? boronToxicitySeverity(input.bMgL)
      : null;

  if (salinityClass) notes.push(SALINITY_CLASS_NOTES[salinityClass]);
  if (sodicityClass) notes.push(SODICITY_CLASS_NOTES[sodicityClass]);
  if (kellyOk === false) {
    notes.push(
      "Kelly index ≤35% — elevated alkalinization risk relative to calcium; review Na and soil amendments."
    );
  } else if (kellyOk === true) {
    notes.push("Kelly index >35% — calcium share is favorable for irrigation use.");
  }
  if (rasSev === "high") {
    notes.push(
      "High RAS — sodium may displace Ca/Mg in soil, degrading structure and permeability."
    );
  }

  return {
    saltGL,
    ras,
    hardnessF,
    hardnessClass: hardnessF != null ? classifyHardnessFrench(hardnessF) : null,
    kellyPct,
    kellyOk,
    salinityClass,
    sodicityClass,
    ecSeverity,
    rasSeverity: rasSev,
    naSeverity,
    clSeverity,
    bSeverity,
    notes,
  };
}

/** Match lab result rows by symbol / name for summary inputs. */
export function pickWaterValue(
  rows: Array<{
    value: number;
    symbol?: string | null;
    parameter_name?: string | null;
    display_parameter_name?: string | null;
  }>,
  keys: string[]
): number | null {
  const normalized = keys.map((k) => k.toLowerCase().replace(/\s+/g, ""));

  const scoreRow = (row: (typeof rows)[number]) => {
    const hay = [row.symbol, row.parameter_name, row.display_parameter_name]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase().replace(/\s+/g, ""));
    let best = 0;
    for (const h of hay) {
      for (const k of normalized) {
        if (h === k) best = Math.max(best, 3);
        else if (k.length >= 3 && (h.includes(k) || k.includes(h))) {
          best = Math.max(best, 2);
        }
      }
    }
    return best;
  };

  let bestRow: (typeof rows)[number] | null = null;
  let bestScore = 0;
  for (const row of rows) {
    const score = scoreRow(row);
    if (score > bestScore) {
      bestScore = score;
      bestRow = row;
    }
  }
  return bestScore > 0 && bestRow ? bestRow.value : null;
}

export function summaryFromInterpretationRows(
  rows: Array<{
    value: number;
    symbol?: string | null;
    parameter_name?: string | null;
    display_parameter_name?: string | null;
  }>
): WaterQualitySummary {
  return buildIrrigationWaterQualitySummary({
    ecDsM: pickWaterValue(rows, ["ec", "ce", "electricalconductivity", "conductividad"]),
    sar: pickWaterValue(rows, ["sar", "ras"]),
    naMgL: pickWaterValue(rows, ["na", "sodium", "sodio"]),
    caMgL: pickWaterValue(rows, ["ca", "calcium", "calcio"]),
    mgMgL: pickWaterValue(rows, ["mg", "magnesium", "magnesio"]),
    clMgL: pickWaterValue(rows, ["cl", "chloride", "cloruro", "cloro"]),
    bMgL: pickWaterValue(rows, ["b", "boron", "boro"]),
    hco3MgL: pickWaterValue(rows, ["hco3", "bicarbonate", "bicarbonato"]),
  });
}
