import { round } from "@/lib/agronomicCalculators";
import { CIC_ADEQUATE_SATURATION, interpretCationRatio, interpretCationSaturation } from "@/lib/cicInterpretation";
import {
  classifyTable1,
  cmolToKgHa,
  cmolToMgKg,
  DEFAULT_SOIL_FERTILITY_REFERENCE,
  matchCropExtraction,
  type AmendmentMaterialKey,
  type Extractant,
  type NutrientClass,
  type SoilFertilityReference,
  type Table1Parameter,
  type Table1Row,
} from "@/lib/soilFertilityTables";

export type FertilityPlanMode = "completo" | "solo_dosis";

export type FertilityPlanInput = {
  modo: FertilityPlanMode;
  cultivo?: string | null;
  /** Extractante de laboratorio usado (Tabla N.° 1). Por defecto Olsen Modificado/KCl 1N. */
  extractant?: Extractant;
  rendimientoObjetivo: number;
  profundidadMuestreo_cm: number;
  densidadAparente_g_cm3: number;
  ph?: number;
  acidezExtraible?: number;
  K?: number;
  Ca?: number;
  Mg?: number;
  Na?: number;
  P?: number;
  S?: number;
  Fe?: number;
  Cu?: number;
  Zn?: number;
  Mn?: number;
  materiaOrganica?: number;
  eficienciaN?: number;
  eficienciaP?: number;
  eficienciaK?: number;
  eficienciaMg?: number;
  PRNT?: number;
  enmiendaSeleccionada?: AmendmentMaterialKey;
  /** Demanda manual (kg/ha) — solo_dosis */
  demandaN_manual?: number;
  demandaP2o5_manual?: number;
  demandaK2o_manual?: number;
  demandaMgo_manual?: number;
  /** Suministro manual (kg/ha) — prioridad sobre calculado */
  N_suministro_manual?: number;
  P_suministro_manual?: number;
  K_suministro_manual?: number;
  Mg_suministro_manual?: number;
  Ca_suministro_manual?: number;
};

export type FertilityCalcStep = {
  label: string;
  formula: string;
  substitution: string;
  result: string;
  unit: string;
  interpretation?: string;
  tableRef?: string;
};

export type FertilityPlanSection = {
  id: string;
  title: string;
  tableRef?: string;
  steps: FertilityCalcStep[];
  summary?: string;
};

export type FertilityDoseResult = {
  nutrient: string;
  demanda: number;
  suministro: number;
  eficiencia: number;
  dosis: number | null;
  notRequired: boolean;
  unit: string;
  steps: FertilityCalcStep[];
};

export type FertilityPlanResult = {
  modo: FertilityPlanMode;
  cultivo: string;
  sections: FertilityPlanSection[];
  doses: FertilityDoseResult[];
  /** SUE302 §1.4–1.5: Ca saturation + lime only when acidity and Ca deficit coexist. */
  encaladoEligible: boolean;
  encaladoNote: string;
  encalado?: {
    caoRequerido: number;
    dosisTeorica: number;
    dosisAjustada: number;
    material: AmendmentMaterialKey;
    recomendacion: string;
    steps: FertilityCalcStep[];
  };
  conclusiones: string[];
};

function num(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function pickSupply(manual: number | undefined, calculated: number) {
  if (Number.isFinite(manual)) return Number(manual);
  if (Number.isFinite(calculated) && calculated > 0) return calculated;
  return 0;
}

function classifyLabel(c: NutrientClass) {
  return c === "bajo" ? "Bajo" : c === "adecuado" ? "Adecuado" : "Exceso";
}

function interpretVPercent(vPercent: number): { label: string; interpretation: string } {
  if (vPercent < CIC_ADEQUATE_SATURATION.totalBases.min) {
    return { label: "Bajo", interpretation: "Saturación de bases baja — evaluar encalado." };
  }
  if (vPercent > CIC_ADEQUATE_SATURATION.totalBases.max) {
    return { label: "Alto", interpretation: "Saturación de bases alta — revisar antes de fertilizar." };
  }
  return { label: "Adecuado", interpretation: "Saturación de bases dentro del rango adecuado (Tabla N.° 2)." };
}

export type EncaladoEligibility = {
  eligible: boolean;
  hasAcidity: boolean;
  hasCaSaturationDeficit: boolean;
  reason: string;
};

/** SUE302 §1.4: Ca saturation lime method only when exchangeable acidity and Ca target deficit coexist. */
export function evaluateEncaladoEligibility(
  input: FertilityPlanInput,
  table1: Table1Row[],
  ca: number,
  cice: number
): EncaladoEligibility {
  const acidity = num(input.acidezExtraible);
  const ph = input.ph;
  const acidityRow = table1.find((row) => row.parameter === "acidez_extraible");
  const phRow = table1.find((row) => row.parameter === "ph");
  const acidityLimit = acidityRow?.adequateMax ?? 0.5;
  const phMin = phRow?.adequateMin ?? 5.5;

  const hasAcidity =
    acidity > acidityLimit ||
    (ph !== undefined && Number.isFinite(ph) && ph < phMin) ||
    (cice > 0 && acidity > 0 && (acidity / cice) * 100 > 5);

  const satCaActual = cice > 0 ? (ca / cice) * 100 : 0;
  const caObjetivo = cice * (CIC_ADEQUATE_SATURATION.ca.target / 100);
  const deficitCa = Math.max(0, caObjetivo - ca);
  const hasCaSaturationDeficit =
    cice > 0 &&
    ca > 0 &&
    (satCaActual < CIC_ADEQUATE_SATURATION.ca.min || deficitCa > 0.001);

  const eligible = hasAcidity && hasCaSaturationDeficit;

  let reason: string;
  if (eligible) {
    reason =
      "Acidez intercambiable y déficit de saturación de Ca — aplica el cálculo de encalado (SUE302 §1.4–1.5).";
  } else if (!hasAcidity && !hasCaSaturationDeficit) {
    reason =
      "Sin acidez intercambiable ni déficit de saturación de Ca — no aplica el método de encalado por saturación.";
  } else if (!hasAcidity) {
    reason =
      "Hay déficit de Ca, pero sin acidez intercambiable: use yeso u otra fuente de Ca; el encalado por saturación no aplica.";
  } else {
    reason =
      "Hay acidez, pero la saturación de Ca ya alcanza la meta — corrija la acidez con la calculadora de enmiendas (pH / saturación de bases).";
  }

  return { eligible, hasAcidity, hasCaSaturationDeficit, reason };
}

function buildDiagnosticSection(
  input: FertilityPlanInput,
  table1: Table1Row[]
): FertilityPlanSection {
  const values: Partial<Record<Table1Parameter, number>> = {
    ph: input.ph,
    acidez_extraible: input.acidezExtraible,
    k: input.K,
    ca: input.Ca,
    mg: input.Mg,
    na: input.Na,
    p: input.P,
    s: input.S,
    fe: input.Fe,
    cu: input.Cu,
    zn: input.Zn,
    mn: input.Mn,
  };

  const steps: FertilityCalcStep[] = table1.map((row) => {
    const value = num(values[row.parameter]);
    const classification = classifyTable1(value, row);
    return {
      label: row.label,
      formula: "Comparar valor vs rango óptimo (Tabla N.° 1)",
      substitution: `${round(value, 3)} ${row.unit}`,
      result: classifyLabel(classification),
      unit: "",
      interpretation: `Rango óptimo: ${row.adequateMin}–${row.adequateMax} ${row.unit}`,
      tableRef: "Tabla N.° 1",
    };
  });

  return {
    id: "diagnostico",
    title: "Diagnóstico de fertilidad",
    tableRef: "Tabla N.° 1",
    steps,
  };
}

function buildSoilMassSection(depthCm: number, bulkDensity: number): FertilityPlanSection {
  const depthM = depthCm / 100;
  const massTonsHa = depthM * bulkDensity * 10000;
  const massKgHa = massTonsHa * 1000;

  return {
    id: "masa_suelo",
    title: "Masa de suelo",
    steps: [
      {
        label: "Masa de suelo",
        formula: "MS = Profundidad(m) × Densidad aparente(t/m³) × 10 000",
        substitution: `${round(depthM, 2)} × ${round(bulkDensity, 2)} × 10 000`,
        result: String(round(massTonsHa, 2)),
        unit: "t/ha",
      },
      {
        label: "Masa de suelo",
        formula: "MS(kg/ha) = MS(t/ha) × 1 000",
        substitution: `${round(massTonsHa, 2)} × 1 000`,
        result: String(round(massKgHa, 0)),
        unit: "kg/ha",
      },
    ],
    summary: `${round(massTonsHa, 2)} t/ha · ${round(massKgHa, 0)} kg/ha`,
  };
}

export function buildSoilFertilityPlan(
  input: FertilityPlanInput,
  refs: SoilFertilityReference = DEFAULT_SOIL_FERTILITY_REFERENCE
): FertilityPlanResult | null {
  const depthCm = Math.max(1, num(input.profundidadMuestreo_cm, 30));
  const bulkDensity = Math.max(0.5, num(input.densidadAparente_g_cm3, 1));
  const depthM = depthCm / 100;
  const massTonsHa = depthM * bulkDensity * 10000;
  const massKgHa = massTonsHa * 1000;

  const ca = num(input.Ca);
  const mg = num(input.Mg);
  const k = num(input.K);
  const na = num(input.Na);
  const acidity = num(input.acidezExtraible);
  const pMgKg = num(input.P);

  const effN = num(input.eficienciaN, 0.6);
  const effP = num(input.eficienciaP, 0.3);
  const effK = num(input.eficienciaK, 0.7);
  const effMg = num(input.eficienciaMg, 0.7);

  const crop = matchCropExtraction(input.cultivo, refs);
  const yieldTarget = Math.max(0, num(input.rendimientoObjetivo));
  const extractant = input.extractant || "olsen_kcl";
  const table1 = refs.nutrientInterpretationByExtractant[extractant] || refs.nutrientInterpretation;

  const sections: FertilityPlanSection[] = [];

  if (input.modo === "completo") {
    sections.push(buildDiagnosticSection(input, table1));
    sections.push(buildSoilMassSection(depthCm, bulkDensity));

    const sb = ca + mg + k + na;
    const cice = sb + acidity;
    const pctCa = cice > 0 ? (ca / cice) * 100 : 0;
    const pctMg = cice > 0 ? (mg / cice) * 100 : 0;
    const pctK = cice > 0 ? (k / cice) * 100 : 0;
    const pctNa = cice > 0 ? (na / cice) * 100 : 0;
    const pctAlH = cice > 0 ? (acidity / cice) * 100 : 0;
    const vPercent = cice > 0 ? (sb / cice) * 100 : 0;
    const vInterp = interpretVPercent(vPercent);

    sections.push({
      id: "indicadores",
      title: "Indicadores de fertilidad",
      tableRef: "Tabla N.° 2",
      steps: [
        {
          label: "Suma de bases (SB)",
          formula: "SB = Ca + Mg + K + Na",
          substitution: `${round(ca, 2)} + ${round(mg, 2)} + ${round(k, 2)} + ${round(na, 2)}`,
          result: String(round(sb, 2)),
          unit: "cmol(+)/kg",
        },
        {
          label: "CIC efectiva (CICe)",
          formula: "CICe = SB + Acidez extraíble",
          substitution: `${round(sb, 2)} + ${round(acidity, 2)}`,
          result: String(round(cice, 2)),
          unit: "cmol(+)/kg",
        },
        {
          label: "%Ca",
          formula: "%Ca = (Ca / CICe) × 100",
          substitution: `(${round(ca, 2)} / ${round(cice, 2)}) × 100`,
          result: String(round(pctCa, 1)),
          unit: "%",
          interpretation: `${interpretCationSaturation("ca", pctCa).rangeLabel} (Tabla N.° 2)`,
          tableRef: "Tabla N.° 2",
        },
        {
          label: "%Mg",
          formula: "%Mg = (Mg / CICe) × 100",
          substitution: `(${round(mg, 2)} / ${round(cice, 2)}) × 100`,
          result: String(round(pctMg, 1)),
          unit: "%",
          interpretation: `${interpretCationSaturation("mg", pctMg).rangeLabel} (Tabla N.° 2)`,
          tableRef: "Tabla N.° 2",
        },
        {
          label: "%K",
          formula: "%K = (K / CICe) × 100",
          substitution: `(${round(k, 2)} / ${round(cice, 2)}) × 100`,
          result: String(round(pctK, 1)),
          unit: "%",
          interpretation: `${interpretCationSaturation("k", pctK).rangeLabel} (Tabla N.° 2)`,
          tableRef: "Tabla N.° 2",
        },
        {
          label: "%Na",
          formula: "%Na = (Na / CICe) × 100",
          substitution: `(${round(na, 2)} / ${round(cice, 2)}) × 100`,
          result: String(round(pctNa, 1)),
          unit: "%",
          interpretation: `${interpretCationSaturation("na", pctNa).rangeLabel} (Tabla N.° 2)`,
          tableRef: "Tabla N.° 2",
        },
        {
          label: "%Al+H",
          formula: "%Al+H = (Acidez / CICe) × 100",
          substitution: `(${round(acidity, 2)} / ${round(cice, 2)}) × 100`,
          result: String(round(pctAlH, 1)),
          unit: "%",
        },
        {
          label: "V%",
          formula: "V% = (SB / CICe) × 100",
          substitution: `(${round(sb, 2)} / ${round(cice, 2)}) × 100`,
          result: String(round(vPercent, 1)),
          unit: "%",
          interpretation: `${vInterp.label} — ${vInterp.interpretation}`,
          tableRef: "Tabla N.° 2",
        },
      ],
    });

    const caMg = mg > 0 ? ca / mg : null;
    const caK = k > 0 ? ca / k : null;
    const mgK = k > 0 ? mg / k : null;
    const caMgK = k > 0 ? (ca + mg) / k : null;

    const ratioDefs: Array<{
      key: string;
      value: number | null;
      relation?: Exclude<import("@/lib/baseSaturation").BaseRelationKey, "all">;
      optimalMin?: number;
      optimalMax?: number;
    }> = [
      { key: "Ca/Mg", value: caMg, relation: "ca_mg" },
      { key: "Ca/K", value: caK, relation: "ca_k" },
      { key: "Mg/K", value: mgK, relation: "mg_k" },
      { key: "(Ca+Mg)/K", value: caMgK, optimalMin: 11, optimalMax: 32 },
    ];

    const ratioSteps: FertilityCalcStep[] = ratioDefs.map(({ key, value, relation, optimalMin, optimalMax }) => {
      const interp = relation
        ? interpretCationRatio(relation, value)
        : value !== null && Number.isFinite(value)
          ? {
              band:
                value < (optimalMin || 0)
                  ? ("low" as const)
                  : value > (optimalMax || Infinity)
                    ? ("high" as const)
                    : ("optimal" as const),
              optimalMin: optimalMin || 0,
              optimalMax: optimalMax || 0,
              messageKey: "",
            }
          : { band: "unknown" as const, optimalMin: optimalMin || 0, optimalMax: optimalMax || 0, messageKey: "" };

      const band =
        interp.band === "optimal"
          ? "Adecuado"
          : interp.band === "low"
            ? key.startsWith("Ca") || key.includes("Ca/")
              ? "Riesgo de deficiencia de Ca"
              : key.startsWith("Mg")
                ? "Riesgo de deficiencia de Mg"
                : "Riesgo de deficiencia de K"
            : interp.band === "high"
              ? "Fuera de rango óptimo"
              : "Sin dato";

      return {
        label: key,
        formula: `${key} = cociente catiónico`,
        substitution: value !== null ? String(round(value, 2)) : "—",
        result: band,
        unit: ":1",
        interpretation: `Rango óptimo Tabla N.° 3: ${interp.optimalMin}–${interp.optimalMax}`,
        tableRef: "Tabla N.° 3",
      };
    });

    sections.push({
      id: "relaciones",
      title: "Relaciones catiónicas",
      tableRef: "Tabla N.° 3",
      steps: ratioSteps,
    });

    const satCaActual = cice > 0 ? (ca / cice) * 100 : 0;
    const satCaObjetivo = CIC_ADEQUATE_SATURATION.ca.target;
    const caObjetivo = cice * (satCaObjetivo / 100);
    const deficitCa = Math.max(0, caObjetivo - ca);
    const encaladoEligibility = evaluateEncaladoEligibility(input, table1, ca, cice);

    sections.push({
      id: "requerimiento_ca",
      title: "Requerimiento de calcio",
      tableRef: "Tabla N.° 2",
      summary: encaladoEligibility.reason,
      steps: [
        {
          label: "Saturación actual de Ca",
          formula: "SatCa actual = (Ca / CICe) × 100",
          substitution: `(${round(ca, 2)} / ${round(cice, 2)}) × 100`,
          result: String(round(satCaActual, 1)),
          unit: "%",
        },
        {
          label: "Saturación objetivo de Ca",
          formula: "SatCa objetivo (Tabla N.° 2)",
          substitution: "Rango adecuado Ca",
          result: String(satCaObjetivo),
          unit: "%",
          tableRef: "Tabla N.° 2",
        },
        {
          label: "Ca objetivo",
          formula: "Ca objetivo = CICe × (SatCa objetivo / 100)",
          substitution: `${round(cice, 2)} × ${satCaObjetivo / 100}`,
          result: String(round(caObjetivo, 2)),
          unit: "cmol(+)/kg",
        },
        {
          label: "Déficit de Ca",
          formula: "Déficit Ca = Ca objetivo − Ca actual (mín. 0)",
          substitution: `${round(caObjetivo, 2)} − ${round(ca, 2)}`,
          result: String(round(deficitCa, 2)),
          unit: "cmol(+)/kg",
          interpretation: encaladoEligibility.eligible
            ? deficitCa > 0
              ? "Se requiere corrección de Ca / encalado (SUE302 §1.4)."
              : "Sin déficit de Ca intercambiable."
            : encaladoEligibility.reason,
        },
      ],
    });

    const cationSteps: FertilityCalcStep[] = (["ca", "mg", "k", "na"] as const).flatMap((cation) => {
      const cmol = { ca, mg, k, na }[cation];
      const conv = cmolToKgHa({ cation, cmolKg: cmol, soilMassKgHa: massKgHa });
      const label = cation.toUpperCase();
      return [
        {
          label: `Moles ${label}`,
          formula: "Moles = (cmol(+)/kg × 0.01) ÷ valencia",
          substitution: `(${round(cmol, 3)} × 0.01) ÷ ${cation === "k" || cation === "na" ? 1 : 2}`,
          result: String(round(conv.moles, 5)),
          unit: "mol/kg",
        },
        {
          label: `g ${label}/kg suelo`,
          formula: "g/kg = Moles × peso molecular",
          substitution: `${round(conv.moles, 5)} × ${cation === "ca" ? 40.078 : cation === "mg" ? 24.305 : cation === "k" ? 39.098 : 22.99}`,
          result: String(round(conv.gramsPerKg, 4)),
          unit: "g/kg",
        },
        {
          label: `${label} suministro`,
          formula: "kg/ha = (g/kg × MS kg/ha) / 1 000",
          substitution: `(${round(conv.gramsPerKg, 4)} × ${round(massKgHa, 0)}) / 1 000`,
          result: String(round(conv.kgHa, 2)),
          unit: `kg ${label}/ha`,
        },
      ];
    });

    sections.push({
      id: "conversion_cationes",
      title: "Conversión general de cationes",
      steps: cationSteps,
    });

    const mgKgSteps: FertilityCalcStep[] = (["ca", "mg", "k", "na"] as const).map((cation) => {
      const cmol = { ca, mg, k, na }[cation];
      const mgKg = cmolToMgKg(cation, cmol, refs.cmolToMgKg);
      return {
        label: `${cation.toUpperCase()} en mg/kg`,
        formula: "mg/kg = cmol(+)/kg × factor",
        substitution: `${round(cmol, 3)} × ${refs.cmolToMgKg[cation]}`,
        result: String(round(mgKg, 1)),
        unit: "mg/kg",
        tableRef: "Tabla N.° 6",
      };
    });

    sections.push({
      id: "conversion_mgkg",
      title: "Conversión directa a mg/kg",
      tableRef: "Tabla N.° 6",
      steps: mgKgSteps,
    });
  } else {
    sections.push(buildSoilMassSection(depthCm, bulkDensity));
  }

  const pSupplyKgHa = pMgKg > 0 ? (pMgKg * massKgHa) / 1_000_000 : 0;
  const p2o5SupplyCalc = pSupplyKgHa * refs.oxideFactors.pToP2o5;
  const kConv = cmolToKgHa({ cation: "k", cmolKg: k, soilMassKgHa: massKgHa });
  const k2oSupplyCalc = kConv.kgHa * refs.oxideFactors.kToK2o;
  const mgConv = cmolToKgHa({ cation: "mg", cmolKg: mg, soilMassKgHa: massKgHa });
  const mgoSupplyCalc = mgConv.kgHa * refs.oxideFactors.mgToMgo;
  const nSupplyCalc = 0;

  const supplyN = pickSupply(input.N_suministro_manual, nSupplyCalc);
  const supplyP2o5 = pickSupply(
    input.P_suministro_manual !== undefined ? input.P_suministro_manual * refs.oxideFactors.pToP2o5 : undefined,
    p2o5SupplyCalc
  );
  const supplyK2o = pickSupply(
    input.K_suministro_manual !== undefined ? input.K_suministro_manual * refs.oxideFactors.kToK2o : undefined,
    k2oSupplyCalc
  );
  const supplyMgo = pickSupply(
    input.Mg_suministro_manual !== undefined ? input.Mg_suministro_manual * refs.oxideFactors.mgToMgo : undefined,
    mgoSupplyCalc
  );

  const demandN =
    input.modo === "solo_dosis" && Number.isFinite(input.demandaN_manual)
      ? Number(input.demandaN_manual)
      : crop.n * yieldTarget;
  const demandP2o5 =
    input.modo === "solo_dosis" && Number.isFinite(input.demandaP2o5_manual)
      ? Number(input.demandaP2o5_manual)
      : crop.p2o5 * yieldTarget;
  const demandK2o =
    input.modo === "solo_dosis" && Number.isFinite(input.demandaK2o_manual)
      ? Number(input.demandaK2o_manual)
      : crop.k2o * yieldTarget;
  const demandMgo =
    input.modo === "solo_dosis" && Number.isFinite(input.demandaMgo_manual)
      ? Number(input.demandaMgo_manual)
      : crop.mgo * yieldTarget;

  sections.push({
    id: "suministro",
    title: "Suministro del suelo",
    steps: [
      {
        label: "P → P₂O₅",
        formula: "Suministro P₂O₅ = P(mg/kg) × MS(kg/ha) / 10⁶ × 2.29",
        substitution: pMgKg > 0 ? `${pMgKg} × ${round(massKgHa, 0)} / 10⁶ × 2.29` : "Sin dato de P",
        result: String(round(p2o5SupplyCalc, 2)),
        unit: "kg P₂O₅/ha",
        tableRef: "Tabla N.° 4",
      },
      {
        label: "K → K₂O",
        formula: "Suministro K₂O = K(kg/ha) × 1.20",
        substitution: k > 0 ? `${round(kConv.kgHa, 2)} × 1.20` : "Sin dato de K",
        result: String(round(k2oSupplyCalc, 2)),
        unit: "kg K₂O/ha",
        tableRef: "Tabla N.° 4",
      },
      {
        label: "Mg → MgO",
        formula: "Suministro MgO = Mg(kg/ha) × 1.66",
        substitution: mg > 0 ? `${round(mgConv.kgHa, 2)} × 1.66` : "Sin dato de Mg",
        result: String(round(mgoSupplyCalc, 2)),
        unit: "kg MgO/ha",
        tableRef: "Tabla N.° 4",
      },
    ],
    summary: `Prioridad: manual > calculado > cero.`,
  });

  sections.push({
    id: "demanda",
    title: "Demanda nutricional",
    tableRef: "Tabla N.° 5",
    steps: [
      {
        label: "N",
        formula: "Demanda N = Extracción N × Rendimiento",
        substitution: `${crop.n} × ${yieldTarget}`,
        result: String(round(demandN, 2)),
        unit: "kg N/ha",
        interpretation: `${crop.label} (Tabla N.° 5)`,
        tableRef: "Tabla N.° 5",
      },
      {
        label: "P₂O₅",
        formula: "Demanda P₂O₅ = Extracción × Rendimiento",
        substitution: `${crop.p2o5} × ${yieldTarget}`,
        result: String(round(demandP2o5, 2)),
        unit: "kg P₂O₅/ha",
        tableRef: "Tabla N.° 5",
      },
      {
        label: "K₂O",
        formula: "Demanda K₂O = Extracción × Rendimiento",
        substitution: `${crop.k2o} × ${yieldTarget}`,
        result: String(round(demandK2o, 2)),
        unit: "kg K₂O/ha",
        tableRef: "Tabla N.° 5",
      },
      {
        label: "MgO",
        formula: "Demanda MgO = Extracción × Rendimiento",
        substitution: `${crop.mgo} × ${yieldTarget}`,
        result: String(round(demandMgo, 2)),
        unit: "kg MgO/ha",
        tableRef: "Tabla N.° 5",
      },
    ],
  });

  sections.push({
    id: "factores",
    title: "Factores de conversión",
    tableRef: "Tabla N.° 4",
    steps: [
      { label: "P → P₂O₅", formula: "Factor", substitution: "Tabla N.° 4", result: String(refs.oxideFactors.pToP2o5), unit: "" },
      { label: "K → K₂O", formula: "Factor", substitution: "Tabla N.° 4", result: String(refs.oxideFactors.kToK2o), unit: "" },
      { label: "Ca → CaO", formula: "Factor", substitution: "Tabla N.° 4", result: String(refs.oxideFactors.caToCao), unit: "" },
      { label: "Mg → MgO", formula: "Factor", substitution: "Tabla N.° 4", result: String(refs.oxideFactors.mgToMgo), unit: "" },
    ],
  });

  function buildDose(
    nutrient: string,
    demanda: number,
    suministro: number,
    eficiencia: number,
    formula: string,
    unit: string
  ): FertilityDoseResult {
    const gap = demanda - suministro;
    const raw = eficiencia > 0 ? gap / eficiencia : 0;
    const notRequired = raw <= 0;
    const steps: FertilityCalcStep[] = [
      {
        label: `Demanda ${nutrient}`,
        formula: "Demanda nutricional",
        substitution: String(round(demanda, 2)),
        result: String(round(demanda, 2)),
        unit,
      },
      {
        label: `Suministro ${nutrient}`,
        formula: "Suministro del suelo (manual o calculado)",
        substitution: String(round(suministro, 2)),
        result: String(round(suministro, 2)),
        unit,
      },
      {
        label: `Dosis ${nutrient}`,
        formula,
        substitution: `(${round(demanda, 2)} − ${round(suministro, 2)}) / ${round(eficiencia, 2)}`,
        result: notRequired ? "NF" : String(round(raw, 2)),
        unit,
        interpretation: notRequired ? "No requiere fertilización" : "Aplicar según eficiencia y calendario del cultivo.",
      },
    ];
    return {
      nutrient,
      demanda,
      suministro,
      eficiencia,
      dosis: notRequired ? null : round(raw, 2),
      notRequired,
      unit,
      steps,
    };
  }

  const doses: FertilityDoseResult[] = [
    buildDose("N", demandN, supplyN, effN, "Dosis N = (Demanda N − Suministro N) / Eficiencia N", "kg N/ha"),
    buildDose(
      "P₂O₅",
      demandP2o5,
      supplyP2o5,
      effP,
      "Dosis P₂O₅ = (Demanda P₂O₅ − Suministro P₂O₅) / Eficiencia P",
      "kg P₂O₅/ha"
    ),
    buildDose(
      "K₂O",
      demandK2o,
      supplyK2o,
      effK,
      "Dosis K₂O = (Demanda K₂O − Suministro K₂O) / Eficiencia K",
      "kg K₂O/ha"
    ),
    buildDose(
      "MgO",
      demandMgo,
      supplyMgo,
      effMg,
      "Dosis MgO = (Demanda MgO − Suministro MgO) / Eficiencia Mg",
      "kg MgO/ha"
    ),
  ];

  sections.push({
    id: "dosis",
    title: "Dosis de fertilización",
    steps: doses.flatMap((d) => d.steps),
  });

  let encalado: FertilityPlanResult["encalado"];
  const ciceForEncalado = ca + mg + k + na + acidity;
  const encaladoEligibility =
    input.modo === "completo"
      ? evaluateEncaladoEligibility(input, table1, ca, ciceForEncalado)
      : {
          eligible: false,
          hasAcidity: false,
          hasCaSaturationDeficit: false,
          reason: "Modo solo dosis — sin cálculo de encalado por saturación de Ca.",
        };

  if (input.modo === "completo" && ca > 0 && encaladoEligibility.eligible) {
    const caObjetivo = ciceForEncalado * (CIC_ADEQUATE_SATURATION.ca.target / 100);
    const deficitCaCmol = Math.max(0, caObjetivo - ca);
    if (deficitCaCmol > 0.001) {
      const caKgHa = cmolToKgHa({ cation: "ca", cmolKg: deficitCaCmol, soilMassKgHa: massKgHa }).kgHa;
      const caoRequerido = caKgHa * refs.oxideFactors.caToCao;
      const materialKey = input.enmiendaSeleccionada || "cal_agricola";
      const material = refs.amendments[materialKey];
      const prnt = Math.max(1, num(input.PRNT, 95));
      const dosisTeorica = material.caoPercent > 0 ? caoRequerido / (material.caoPercent / 100) : 0;
      const dosisAjustada = dosisTeorica / (prnt / 100);

      const caRow = table1.find((r) => r.parameter === "ca");
      const mgRow = table1.find((r) => r.parameter === "mg");
      const caClass = caRow ? classifyTable1(ca, caRow) : "bajo";
      const mgClass = mgRow ? classifyTable1(mg, mgRow) : "bajo";
      let recomendacion = material.label;
      let motivo = `Enmienda seleccionada: ${material.label}.`;
      if (caClass === "bajo" && mgClass !== "bajo") {
        recomendacion = "Cal agrícola o yeso";
        motivo = "Ca bajo y Mg adecuado — cal agrícola para elevar pH y Ca; yeso si se requiere Ca sin elevar pH.";
      } else if (caClass === "bajo" && mgClass === "bajo") {
        recomendacion = "Dolomita";
        motivo = "Ca y Mg bajos — dolomita aporta CaO y MgO simultáneamente.";
      }

      encalado = {
        caoRequerido: round(caoRequerido, 2),
        dosisTeorica: round(dosisTeorica, 2),
        dosisAjustada: round(dosisAjustada, 2),
        material: materialKey,
        recomendacion,
        steps: [
          {
            label: "CaO requerido",
            formula: "CaO = Ca requerido (kg/ha) × 1.40",
            substitution: `${round(caKgHa, 2)} × 1.40`,
            result: String(round(caoRequerido, 2)),
            unit: "kg CaO/ha",
            tableRef: "Tabla N.° 4",
          },
          {
            label: "Dosis teórica",
            formula: "Dosis = CaO requerido / (%CaO/100)",
            substitution: `${round(caoRequerido, 2)} / ${material.caoPercent}%`,
            result: String(round(dosisTeorica, 2)),
            unit: "kg/ha",
          },
          {
            label: "Dosis ajustada PRNT",
            formula: "Dosis ajustada = Dosis / (PRNT/100)",
            substitution: `${round(dosisTeorica, 2)} / (${prnt}/100)`,
            result: String(round(dosisAjustada, 2)),
            unit: "kg/ha",
          },
          {
            label: "Dosis ajustada",
            formula: "t/ha = kg/ha / 1 000",
            substitution: `${round(dosisAjustada, 2)} / 1 000`,
            result: String(round(dosisAjustada / 1000, 3)),
            unit: "t/ha",
          },
          {
            label: "Recomendación de enmienda",
            formula: "Criterio Ca/Mg (Tabla N.° 1)",
            substitution: `Ca: ${classifyLabel(caClass)}, Mg: ${classifyLabel(mgClass)}`,
            result: recomendacion,
            unit: "",
            interpretation: motivo,
          },
        ],
      };

      sections.push({
        id: "encalado",
        title: "Requerimiento de encalado",
        tableRef: "SUE302 §1.4–1.5",
        summary: `${round(dosisAjustada, 2)} kg/ha · ${round(dosisAjustada / 1000, 3)} t/ha`,
        steps: encalado.steps,
      });
    }
  }

  const conclusiones = [
    `Cultivo: ${crop.label} · Rendimiento objetivo: ${yieldTarget} t/ha.`,
    doses.some((d) => !d.notRequired)
      ? `Se recomienda fertilización para: ${doses.filter((d) => !d.notRequired).map((d) => d.nutrient).join(", ")}.`
      : "No se requieren dosis positivas de N, P₂O₅, K₂O ni MgO con los datos actuales.",
    encalado && encalado.dosisAjustada > 0
      ? `Encalado estimado: ${encalado.dosisAjustada} kg/ha (${encalado.recomendacion}).`
      : encaladoEligibility.eligible
        ? "Sin déficit de Ca intercambiable para encalado por saturación."
        : encaladoEligibility.reason,
  ];

  return {
    modo: input.modo,
    cultivo: crop.label,
    sections,
    doses,
    encaladoEligible: encaladoEligibility.eligible,
    encaladoNote: encaladoEligibility.reason,
    encalado,
    conclusiones,
  };
}

export function fertilityPlanToCalculationOutputs(plan: FertilityPlanResult) {
  return plan.doses.map((dose) => ({
    value: dose.notRequired ? 0 : dose.dosis || 0,
    unit: dose.unit,
    label: dose.notRequired ? `${dose.nutrient} — NF` : `Dosis ${dose.nutrient}`,
    formula: dose.steps[dose.steps.length - 1]?.formula || "",
    notes: dose.notRequired
      ? ["No requiere fertilización (NF)."]
      : [
          `Demanda: ${round(dose.demanda, 2)} · Suministro: ${round(dose.suministro, 2)} · Eficiencia: ${round(dose.eficiencia * 100, 0)}%.`,
          ...(dose.steps[dose.steps.length - 1]?.interpretation ? [dose.steps[dose.steps.length - 1].interpretation!] : []),
        ],
  }));
}
