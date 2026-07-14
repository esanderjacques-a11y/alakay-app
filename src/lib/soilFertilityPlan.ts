import {
  areaUnitLabel,
  convertAreaToHa,
  round,
  scaleDoseByArea,
  type AreaUnit,
  type CalculationOutput,
} from "@/lib/agronomicCalculators";
import {
  assessAmendmentChemistry,
  type SoilAmendmentInput,
} from "@/lib/amendmentRecommendation";
import {
  calculateCalFromCaSaturation,
  type PhAmendmentMaterial,
} from "@/lib/phAmendmentCalculator";
import {
  cmolToKgHa,
  cmolToMgKg,
  DEFAULT_SOIL_FERTILITY_REFERENCE,
  findCropExtraction,
  TABLE_12_AMENDMENTS,
  type SoilFertilityReference,
} from "@/lib/soilFertilityTables";

/** Display form for extraction / dose labels (Tabla N.° 4). */
export type NutrientDisplayMode = "elemental" | "oxide";

export type DoseNutrientKey = "n" | "p" | "k" | "mg" | "ca";

/**
 * N mineralization scenarios from SUE302 §2.5.1 (OM → mineralizable N).
 * Literature ranges for the fraction of organic N mineralized in a season.
 */
export type MineralizationScenario = "conservative" | "temperate" | "tropical" | "custom";

export type MineralizationScenarioDef = {
  key: Exclude<MineralizationScenario, "custom">;
  /** Inclusive lower bound of the published range (fraction). */
  coefMin: number;
  /** Inclusive upper bound of the published range (fraction). */
  coefMax: number;
  /** Representative coefficient used in calculations. */
  defaultCoef: number;
};

export const MINERALIZATION_SCENARIOS: MineralizationScenarioDef[] = [
  {
    key: "conservative",
    coefMin: 0.01,
    coefMax: 0.02,
    // Tutorial worked example uses 2%.
    defaultCoef: 0.02,
  },
  {
    key: "temperate",
    coefMin: 0.02,
    coefMax: 0.03,
    defaultCoef: 0.025,
  },
  {
    key: "tropical",
    coefMin: 0.03,
    coefMax: 0.05,
    defaultCoef: 0.04,
  },
];

export function mineralizationCoefForScenario(
  scenario: MineralizationScenario | null | undefined,
  customCoef?: number
): number {
  if (scenario === "custom") {
    const custom = Number(customCoef);
    return Number.isFinite(custom) && custom >= 0 ? custom : 0.02;
  }
  const match = MINERALIZATION_SCENARIOS.find((item) => item.key === scenario);
  return match?.defaultCoef ?? 0.02;
}

export function mineralizationScenarioLabel(
  scenario: MineralizationScenario,
  t: Record<string, string> = {}
): string {
  if (scenario === "custom") {
    return t.mineralizationCustom || "Custom coefficient";
  }
  const def = MINERALIZATION_SCENARIOS.find((item) => item.key === scenario);
  const range = def
    ? `${Math.round(def.coefMin * 100)}–${Math.round(def.coefMax * 100)}%`
    : "";
  const labels: Record<Exclude<MineralizationScenario, "custom">, string> = {
    conservative:
      t.mineralizationConservative || `Conservative (${range || "1–2%"})`,
    temperate: t.mineralizationTemperate || `Temperate (${range || "2–3%"})`,
    tropical:
      t.mineralizationTropical || `Tropical / high biological activity (${range || "3–5%"})`,
  };
  return labels[scenario] || scenario;
}

/** Extraction coefficients as stored in Tabla N.° 5 (P/K/Ca/Mg = oxides). */
export type ExtractionOxide = {
  n: number;
  p2o5: number;
  k2o: number;
  cao: number;
  mgo: number;
};

export type FertilityPlanDoseInput = {
  cultivo?: string | null;
  /** Oxide-form extraction (kg/t). Required when crop is unknown or user overrides. */
  extraction?: Partial<ExtractionOxide> | null;
  rendimientoObjetivo: number;
  profundidadMuestreo_cm: number;
  densidadAparente_g_cm3: number;
  /** Organic matter % (for N supply estimate). */
  materiaOrganica?: number;
  /** Preset mineralization climate / activity scenario (SUE302 §2.5.1). */
  mineralizationScenario?: MineralizationScenario;
  /** Mineralization coefficient as fraction (default 0.02 = 2%). Used for custom or override. */
  coeficienteMineralizacion?: number;
  K?: number;
  Mg?: number;
  P?: number;
  /** Exchangeable Ca (cmol(+)/kg) — used to gate / compute Cal when liming is needed. */
  Ca?: number;
  Na?: number;
  cec?: number;
  ph?: number;
  exchangeableAcidity?: number;
  aluminum?: number;
  aluminumUnit?: string;
  /** PRNT / CCE % for liming product (default 100). */
  prntPercent?: number;
  /** Efficiency as 0–100 (%). */
  eficienciaN?: number;
  eficienciaP?: number;
  eficienciaK?: number;
  eficienciaMg?: number;
  area: number;
  areaUnit: AreaUnit;
  displayMode: NutrientDisplayMode;
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

export type FertilityDoseResult = {
  key: DoseNutrientKey;
  nutrient: string;
  nutrientOxide: string;
  demandaKgHa: number;
  suministroKgHa: number;
  eficiencia: number;
  /** Dose in kg/ha of the oxide form (N elemental); null when not required. */
  dosisKgHa: number | null;
  /** Unconverted N/P₂O₅/K₂O/MgO dose used to calculate commercial product mass. */
  dosisOxideKgHa: number | null;
  /** Dose scaled to plot area in display mode. */
  dosisPlot: number | null;
  notRequired: boolean;
  /** Ca is supplied via liming, not fertilizer dose. */
  viaEncalado: boolean;
  unitHa: string;
  unitPlot: string;
  steps: FertilityCalcStep[];
};

export type FertilityDosePlanResult = {
  cultivo: string;
  cropMatched: boolean;
  massTonsHa: number;
  massKgHa: number;
  displayMode: NutrientDisplayMode;
  areaHa: number;
  areaUnit: AreaUnit;
  extractionUsed: ExtractionOxide;
  mineralizationScenario: MineralizationScenario;
  mineralizationCoef: number;
  doses: FertilityDoseResult[];
  recommendations: string[];
  sections: Array<{ id: string; title: string; steps: FertilityCalcStep[]; tableRef?: string }>;
};

function num(value: number | undefined, fallback = 0) {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function effFraction(percent: number | undefined, fallbackPercent: number) {
  const pct = num(percent, fallbackPercent);
  if (pct > 1) return pct / 100;
  if (pct > 0) return pct;
  return fallbackPercent / 100;
}

export function oxideToElementalExtraction(
  oxide: ExtractionOxide,
  factors: SoilFertilityReference["oxideFactors"] = DEFAULT_SOIL_FERTILITY_REFERENCE.oxideFactors
): ExtractionOxide {
  return {
    n: oxide.n,
    p2o5: oxide.p2o5 / factors.pToP2o5,
    k2o: oxide.k2o / factors.kToK2o,
    cao: oxide.cao / factors.caToCao,
    mgo: oxide.mgo / factors.mgToMgo,
  };
}

export function elementalToOxideExtraction(
  elemental: ExtractionOxide,
  factors: SoilFertilityReference["oxideFactors"] = DEFAULT_SOIL_FERTILITY_REFERENCE.oxideFactors
): ExtractionOxide {
  return {
    n: elemental.n,
    p2o5: elemental.p2o5 * factors.pToP2o5,
    k2o: elemental.k2o * factors.kToK2o,
    cao: elemental.cao * factors.caToCao,
    mgo: elemental.mgo * factors.mgToMgo,
  };
}

export function displayExtractionLabels(mode: NutrientDisplayMode) {
  if (mode === "elemental") {
    return { n: "N", p: "P", k: "K", ca: "Ca", mg: "Mg" };
  }
  return { n: "N", p: "P₂O₅", k: "K₂O", ca: "CaO", mg: "MgO" };
}

function nutrientHaUnit(key: DoseNutrientKey, mode: NutrientDisplayMode) {
  const labels = displayExtractionLabels(mode);
  return `kg ${labels[key === "p" ? "p" : key === "k" ? "k" : key === "ca" ? "ca" : key === "mg" ? "mg" : "n"]}/ha`;
}

function nutrientPlotUnit(key: DoseNutrientKey, mode: NutrientDisplayMode, areaUnit: AreaUnit) {
  const labels = displayExtractionLabels(mode);
  const map: Record<DoseNutrientKey, string> = {
    n: labels.n,
    p: labels.p,
    k: labels.k,
    ca: labels.ca,
    mg: labels.mg,
  };
  return `kg ${map[key]} / ${areaUnitLabel(areaUnit)}`;
}

function toDisplayKg(valueKgOxide: number, key: DoseNutrientKey, mode: NutrientDisplayMode, factors: SoilFertilityReference["oxideFactors"]) {
  if (mode === "oxide" || key === "n") return valueKgOxide;
  if (key === "p") return valueKgOxide / factors.pToP2o5;
  if (key === "k") return valueKgOxide / factors.kToK2o;
  if (key === "ca") return valueKgOxide / factors.caToCao;
  return valueKgOxide / factors.mgToMgo;
}

/**
 * Estimate mineralizable N (kg/ha) from organic matter % (SUE302 §2.5.1).
 * Assumes OM is ~5% N; mineralization coefficient depends on the chosen scenario.
 */
export function estimateNSupplyFromOm(input: {
  organicMatterPercent: number;
  massTonsHa: number;
  mineralizationCoef?: number;
  mineralizationScenario?: MineralizationScenario;
}) {
  const om = Math.max(0, input.organicMatterPercent);
  const miner = Math.max(
    0,
    input.mineralizationCoef ??
      mineralizationCoefForScenario(input.mineralizationScenario ?? "conservative")
  );
  const organicNPercent = om * 0.05;
  const mineralizablePercent = organicNPercent * miner;
  const mgKg = mineralizablePercent * 10000;
  // SUE302: Factor MS = MS(t/ha)/1000 → kg/ha = (mg/kg) × (MS/1000)
  const massFactor = input.massTonsHa / 1000;
  const kgHa = mgKg * massFactor;
  return { organicNPercent, mineralizablePercent, mgKg, massFactor, kgHa, miner };
}

export function buildNutrientDosePlan(
  input: FertilityPlanDoseInput,
  refs: SoilFertilityReference = DEFAULT_SOIL_FERTILITY_REFERENCE
): FertilityDosePlanResult | null {
  const depthCm = Math.max(1, num(input.profundidadMuestreo_cm, 30));
  const bulkDensity = Math.max(0.5, num(input.densidadAparente_g_cm3, 1));
  const depthM = depthCm / 100;
  const massTonsHa = depthM * bulkDensity * 10000;
  const massKgHa = massTonsHa * 1000;
  const yieldTarget = Math.max(0, num(input.rendimientoObjetivo));
  const area = Math.max(0, num(input.area, 1));
  const areaUnit = input.areaUnit || "ha";
  const areaHa = convertAreaToHa(area, areaUnit);
  const mode = input.displayMode || "oxide";
  const factors = refs.oxideFactors;

  const matched = findCropExtraction(input.cultivo, refs);
  const cropMatched = Boolean(matched);
  const baseExtraction: ExtractionOxide = matched
    ? { n: matched.n, p2o5: matched.p2o5, k2o: matched.k2o, cao: matched.cao, mgo: matched.mgo }
    : { n: 0, p2o5: 0, k2o: 0, cao: 0, mgo: 0 };

  const extractionUsed: ExtractionOxide = {
    n: num(input.extraction?.n, baseExtraction.n),
    p2o5: num(input.extraction?.p2o5, baseExtraction.p2o5),
    k2o: num(input.extraction?.k2o, baseExtraction.k2o),
    cao: num(input.extraction?.cao, baseExtraction.cao),
    mgo: num(input.extraction?.mgo, baseExtraction.mgo),
  };

  const cultivoLabel = matched?.label || (input.cultivo?.trim() || "Cultivo (extracción manual)");

  if (!(yieldTarget > 0) || !(massTonsHa > 0)) return null;

  const pMgKg = num(input.P);
  const kCmol = num(input.K);
  const mgCmol = num(input.Mg);
  const om = num(input.materiaOrganica);
  const scenario: MineralizationScenario = input.mineralizationScenario || "conservative";
  const minerCoef = mineralizationCoefForScenario(
    scenario,
    input.coeficienteMineralizacion
  );

  const nFromOm = estimateNSupplyFromOm({
    organicMatterPercent: om,
    massTonsHa,
    mineralizationCoef: minerCoef,
    mineralizationScenario: scenario,
  });
  const supplyN = nFromOm.kgHa;

  const pSupplyElementalKgHa = pMgKg > 0 ? (pMgKg * massKgHa) / 1_000_000 : 0;
  const supplyP2o5 = pSupplyElementalKgHa * factors.pToP2o5;

  const kConv = cmolToKgHa({ cation: "k", cmolKg: kCmol, soilMassKgHa: massKgHa });
  const kMgKgLayer = cmolToMgKg("k", kCmol, refs.cmolToMgKg) * massTonsHa;
  const supplyK2o = kConv.kgHa * factors.kToK2o;

  const mgConv = cmolToKgHa({ cation: "mg", cmolKg: mgCmol, soilMassKgHa: massKgHa });
  const supplyMgo = mgConv.kgHa * factors.mgToMgo;

  const demandN = extractionUsed.n * yieldTarget;
  const demandP2o5 = extractionUsed.p2o5 * yieldTarget;
  const demandK2o = extractionUsed.k2o * yieldTarget;
  const demandMgo = extractionUsed.mgo * yieldTarget;
  const demandCao = extractionUsed.cao * yieldTarget;

  const caCmol = num(input.Ca);
  const naCmol = num(input.Na);
  const cecIn = num(input.cec);
  const phIn = num(input.ph);
  const acidityIn = num(input.exchangeableAcidity);
  const alIn = num(input.aluminum);
  const prnt = Math.max(1, num(input.prntPercent, 100));

  const amendmentInput: SoilAmendmentInput = {
    ph: phIn > 0 ? phIn : null,
    cec: cecIn > 0 ? cecIn : null,
    ca: caCmol > 0 ? caCmol : null,
    mg: mgCmol > 0 ? mgCmol : null,
    k: kCmol > 0 ? kCmol : null,
    na: naCmol > 0 ? naCmol : null,
    exchangeableAcidity: acidityIn > 0 ? acidityIn : null,
    aluminum: alIn > 0 ? alIn : null,
    aluminumUnit: input.aluminumUnit,
    organicMatterPercent: om > 0 ? om : null,
  };
  const chemGate = assessAmendmentChemistry(amendmentInput);
  const limeMaterial: PhAmendmentMaterial = chemGate.mgLow ? "dolomitic_lime" : "calcitic_lime";
  const limeCaoPercent =
    limeMaterial === "dolomitic_lime"
      ? TABLE_12_AMENDMENTS.dolomita.caoPercent
      : TABLE_12_AMENDMENTS.cal_agricola.caoPercent;

  const effN = effFraction(input.eficienciaN, 60);
  const effP = effFraction(input.eficienciaP, 20);
  const effK = effFraction(input.eficienciaK, 70);
  const effMg = effFraction(input.eficienciaMg, 70);

  const labels = displayExtractionLabels(mode);

  function buildFertilizerDose(
    key: Exclude<DoseNutrientKey, "ca">,
    nutrientLabel: string,
    nutrientOxideLabel: string,
    demandaOxide: number,
    suministroOxide: number,
    eficiencia: number,
    formula: string
  ): FertilityDoseResult {
    const gap = demandaOxide - suministroOxide;
    const raw = eficiencia > 0 ? gap / eficiencia : 0;
    const notRequired = raw <= 0;
    const dosisKgHaOxide = notRequired ? null : round(raw, 2);
    const demandaDisplay = toDisplayKg(demandaOxide, key, mode, factors);
    const suministroDisplay = toDisplayKg(suministroOxide, key, mode, factors);
    const dosisDisplayHa =
      dosisKgHaOxide === null ? null : round(toDisplayKg(dosisKgHaOxide, key, mode, factors), 2);
    const dosisPlot =
      dosisDisplayHa === null ? null : round(scaleDoseByArea(dosisDisplayHa, area, areaUnit), 2);

    const unitHa = nutrientHaUnit(key, mode);
    const unitPlot = nutrientPlotUnit(key, mode, areaUnit);

    const steps: FertilityCalcStep[] = [
      {
        label: `Demanda ${nutrientLabel}`,
        formula: "Demanda = Extracción (kg/t) × Rendimiento (t/ha)",
        substitution: `${round(key === "n" ? extractionUsed.n : key === "p" ? (mode === "elemental" ? extractionUsed.p2o5 / factors.pToP2o5 : extractionUsed.p2o5) : key === "k" ? (mode === "elemental" ? extractionUsed.k2o / factors.kToK2o : extractionUsed.k2o) : mode === "elemental" ? extractionUsed.mgo / factors.mgToMgo : extractionUsed.mgo, 3)} × ${yieldTarget}`,
        result: String(round(demandaDisplay, 2)),
        unit: unitHa,
        tableRef: "Tabla N.° 5",
      },
      {
        label: `Suministro ${nutrientLabel}`,
        formula: "Suministro del suelo",
        substitution: String(round(suministroDisplay, 2)),
        result: String(round(suministroDisplay, 2)),
        unit: unitHa,
      },
      {
        label: `Eficiencia ${nutrientLabel}`,
        formula: "Eficiencia (fracción) — Tabla N.° 7 / sistema de riego",
        substitution: `${round(eficiencia * 100, 1)}%`,
        result: String(round(eficiencia, 3)),
        unit: "",
        tableRef: "Tabla N.° 7",
      },
      {
        label: `Dosis ${nutrientLabel}`,
        formula,
        substitution: `(${round(demandaDisplay, 2)} − ${round(suministroDisplay, 2)}) / ${round(eficiencia, 3)}`,
        result: notRequired ? "NF" : String(dosisDisplayHa),
        unit: unitHa,
        interpretation: notRequired
          ? "No requiere fertilización — el suministro cubre la demanda."
          : areaUnit !== "ha"
            ? `Parcela: ${dosisPlot} ${unitPlot}`
            : "Aplicar según calendario del cultivo.",
      },
    ];

    return {
      key,
      nutrient: nutrientLabel,
      nutrientOxide: nutrientOxideLabel,
      demandaKgHa: round(demandaDisplay, 2),
      suministroKgHa: round(suministroDisplay, 2),
      eficiencia,
      dosisKgHa: dosisDisplayHa,
      dosisOxideKgHa: dosisKgHaOxide,
      dosisPlot,
      notRequired,
      viaEncalado: false,
      unitHa,
      unitPlot,
      steps,
    };
  }

  const nSupplySteps: FertilityCalcStep[] = [
    {
      label: "N orgánico",
      formula: "N orgánico (%) = MO% × 0.05",
      substitution: `${om} × 0.05`,
      result: String(round(nFromOm.organicNPercent, 4)),
      unit: "%",
      interpretation: om > 0 ? undefined : "Sin dato de MO — suministro N = 0.",
    },
    {
      label: "N mineralizable",
      formula: "N mineralizable (%) = N orgánico × coeficiente de mineralización",
      substitution: `${round(nFromOm.organicNPercent, 4)} × ${minerCoef} (${mineralizationScenarioLabel(scenario)})`,
      result: String(round(nFromOm.mineralizablePercent, 6)),
      unit: "%",
      interpretation: `Escenario SUE302 §2.5.1: ${mineralizationScenarioLabel(scenario)}.`,
    },
    {
      label: "N (mg/kg)",
      formula: "mg/kg = N mineralizable × 10 000",
      substitution: `${round(nFromOm.mineralizablePercent, 6)} × 10 000`,
      result: String(round(nFromOm.mgKg, 2)),
      unit: "mg/kg",
    },
    {
      label: "Suministro N",
      formula: "kg/ha = (mg/kg) × (MS t/ha / 1000)",
      substitution: `${round(nFromOm.mgKg, 2)} × ${round(nFromOm.massFactor, 2)}`,
      result: String(round(supplyN, 2)),
      unit: "kg N/ha",
    },
  ];

  const doseN = buildFertilizerDose(
    "n",
    labels.n,
    "N",
    demandN,
    supplyN,
    effN,
    "Dosis N = (Demanda − Suministro) / Eficiencia"
  );
  doseN.steps = [
    ...nSupplySteps,
    {
      label: `Demanda ${labels.n}`,
      formula: "Demanda = Extracción (kg/t) × Rendimiento (t/ha)",
      substitution: `${extractionUsed.n} × ${yieldTarget}`,
      result: String(round(demandN, 2)),
      unit: "kg N/ha",
      tableRef: "Tabla N.° 5",
    },
    {
      label: `Eficiencia ${labels.n}`,
      formula: "Eficiencia — Tabla N.° 7 / sistema de riego",
      substitution: `${round(effN * 100, 1)}%`,
      result: String(round(effN, 3)),
      unit: "",
      tableRef: "Tabla N.° 7",
    },
    {
      label: `Dosis ${labels.n}`,
      formula: "Dosis N = (Demanda − Suministro) / Eficiencia",
      substitution: `(${round(demandN, 2)} − ${round(supplyN, 2)}) / ${round(effN, 3)}`,
      result: doseN.notRequired ? "NF" : String(doseN.dosisKgHa),
      unit: doseN.unitHa,
      interpretation: doseN.notRequired
        ? "No requiere fertilización — el suministro cubre la demanda."
        : areaUnit !== "ha"
          ? `Parcela: ${doseN.dosisPlot} ${doseN.unitPlot}`
          : "Aplicar según calendario del cultivo.",
    },
  ];

  const doseP = buildFertilizerDose(
    "p",
    labels.p,
    "P₂O₅",
    demandP2o5,
    supplyP2o5,
    effP,
    "Dosis P₂O₅ = (Demanda − Suministro) / Eficiencia"
  );
  doseP.steps.splice(1, 1, {
    label: `Suministro ${labels.p}`,
    formula: "Suministro P₂O₅ = P(mg/kg) × MS(kg/ha) / 10⁶ × 2.29",
    substitution:
      pMgKg > 0
        ? `${pMgKg} × ${round(massKgHa, 0)} / 10⁶ × ${factors.pToP2o5}`
        : "Sin dato de P",
    result: String(round(toDisplayKg(supplyP2o5, "p", mode, factors), 2)),
    unit: nutrientHaUnit("p", mode),
    tableRef: "Tabla N.° 4",
  });

  const doseK = buildFertilizerDose(
    "k",
    labels.k,
    "K₂O",
    demandK2o,
    supplyK2o,
    effK,
    "Dosis K₂O = (Demanda − Suministro) / Eficiencia"
  );
  doseK.steps.splice(1, 1, {
    label: `Suministro ${labels.k}`,
    formula: "Suministro K₂O = K(cmol) → kg/ha × 1.20",
    substitution:
      kCmol > 0
        ? `K capa ≈ ${round(kMgKgLayer, 1)} mg/kg · ${round(kConv.kgHa, 2)} kg K/ha × ${factors.kToK2o}`
        : "Sin dato de K",
    result: String(round(toDisplayKg(supplyK2o, "k", mode, factors), 2)),
    unit: nutrientHaUnit("k", mode),
    tableRef: "Tabla N.° 4 / 6",
  });

  const doseMg = buildFertilizerDose(
    "mg",
    labels.mg,
    "MgO",
    demandMgo,
    supplyMgo,
    effMg,
    "Dosis MgO = (Demanda − Suministro) / Eficiencia"
  );
  doseMg.steps.splice(1, 1, {
    label: `Suministro ${labels.mg}`,
    formula: "Suministro MgO = Mg(cmol) → kg/ha × 1.66",
    substitution:
      mgCmol > 0
        ? `${round(mgConv.kgHa, 2)} kg Mg/ha × ${factors.mgToMgo}`
        : "Sin dato de Mg",
    result: String(round(toDisplayKg(supplyMgo, "mg", mode, factors), 2)),
    unit: nutrientHaUnit("mg", mode),
    tableRef: "Tabla N.° 4 / 6",
  });

  // Tutoría §§1.4–1.5: deficit-first Cal / gypsum — only when CICe / V% chemistry indicates need.
  let doseCaLimeKgHa: number | null = null;
  let deficitCaoKgHa = 0;
  let caSteps: FertilityCalcStep[] = [
    {
      label: "Déficit de Ca / enmienda",
      formula: "Sin dosis — CICe / V% en rango suficiente",
      substitution: "Tabla N.° 2 rangos adecuados",
      result: "—",
      unit: "kg/ha",
      tableRef: "Tabla N.° 2 · Tutoría §§1.4–1.5",
      interpretation:
        "No se requiere aplicación de cal o yeso: la distribución de bases en la CICe y/o V% está en rango suficiente.",
    },
  ];
  const useGypsumProduct = chemGate.needsGypsum && !chemGate.needsLime;

  if (
    (chemGate.needsLime || chemGate.needsGypsum) &&
    chemGate.sat &&
    chemGate.sat.cec > 0 &&
    Number.isFinite(caCmol)
  ) {
    const materialForCal: PhAmendmentMaterial = chemGate.needsLime
      ? limeMaterial
      : "calcitic_lime";
    const cal = calculateCalFromCaSaturation({
      cice: chemGate.sat.cec,
      caCmol,
      depthCm,
      bulkDensity,
      material: materialForCal,
      prntPercent: chemGate.needsLime ? prnt : 100,
    });
    const gypsumCao = TABLE_12_AMENDMENTS.yeso.caoPercent;
    const productKgHa = chemGate.needsLime
      ? cal.adjustedProductKgHa
      : !cal.noRequirement && gypsumCao > 0
        ? round(cal.caoKgHa / (gypsumCao / 100), 1)
        : 0;

    caSteps = [
      {
        label: "Ca objetivo",
        formula: "Ca objetivo = CICe × (sat meta / 100)",
        substitution: `${cal.caTargetCmol > 0 ? chemGate.sat.cec : 0} × (${cal.caTargetPercent} / 100)`,
        result: String(cal.caTargetCmol),
        unit: "cmol(+)/kg",
        tableRef: "Tabla N.° 2",
      },
      {
        label: "Déficit de Ca",
        formula: "Déficit = Ca objetivo − Ca actual",
        substitution: `${cal.caTargetCmol} − ${caCmol}`,
        result: String(cal.caDeficitCmol),
        unit: "cmol(+)/kg",
        tableRef: "Tutoría §1.4",
      },
      {
        label: "Ca elemental",
        formula: "kg Ca/ha = déficit (cmol) → soil mass",
        substitution: `MS ${cal.soilMassKgHa} kg/ha`,
        result: String(cal.caKgHa),
        unit: "kg Ca/ha",
        tableRef: "Tutoría §1.4",
      },
      {
        label: "CaO requerido",
        formula: "CaO = Ca × 1.4",
        substitution: `${cal.caKgHa} × ${factors.caToCao}`,
        result: String(cal.caoKgHa),
        unit: "kg CaO/ha",
        tableRef: "Tabla N.° 4",
      },
    ];

    if (!cal.noRequirement && productKgHa > 0) {
      doseCaLimeKgHa = productKgHa;
      deficitCaoKgHa = cal.caoKgHa;
      caSteps.push({
        label: useGypsumProduct ? "Dosis de yeso" : "Dosis de cal ajustada",
        formula: useGypsumProduct
          ? "Yeso = CaO / (14% CaO)"
          : "Cal = CaO / (CaO%/100) / (PRNT/100)",
        substitution: useGypsumProduct
          ? `${cal.caoKgHa} / (${gypsumCao} / 100)`
          : `${cal.caoKgHa} / (${limeCaoPercent} / 100) / (${prnt} / 100)`,
        result: String(productKgHa),
        unit: "kg/ha",
        tableRef: "Tabla N.° 12 · Tutoría §1.5",
        interpretation: useGypsumProduct
          ? "Yeso (sin subir pH): déficit de Ca sin vía de encalado y/o sodicidad."
          : limeMaterial === "dolomitic_lime"
            ? "Cal dolomítica: déficit de Ca con V%/acidez y Mg bajo."
            : "Cal agrícola: déficit de saturación de Ca con V% baja o acidez.",
      });
    } else {
      caSteps.push({
        label: "Producto",
        formula: "Sin dosis — sat. Ca ≥ meta",
        substitution: `Sat Ca ${cal.caCurrentPercent}% ≥ ${cal.caTargetPercent}%`,
        result: "—",
        unit: "kg/ha",
        tableRef: "Tabla N.° 2",
        interpretation:
          "No se requiere dosis: la saturación de Ca ya alcanza o supera la meta.",
      });
    }
  }

  const demandCaDisplay =
    deficitCaoKgHa > 0
      ? toDisplayKg(deficitCaoKgHa, "ca", mode, factors)
      : toDisplayKg(demandCao, "ca", mode, factors);

  const doseCa: FertilityDoseResult = {
    key: "ca",
    nutrient: labels.ca,
    nutrientOxide: "CaO",
    demandaKgHa: round(demandCaDisplay, 2),
    suministroKgHa: 0,
    eficiencia: 0,
    dosisKgHa: doseCaLimeKgHa,
    dosisOxideKgHa:
      doseCaLimeKgHa != null && doseCaLimeKgHa > 0
        ? round(deficitCaoKgHa > 0 ? deficitCaoKgHa : demandCao, 2)
        : null,
    dosisPlot:
      doseCaLimeKgHa != null && areaHa > 0 ? round(doseCaLimeKgHa * areaHa, 1) : null,
    notRequired: !(doseCaLimeKgHa != null && doseCaLimeKgHa > 0),
    viaEncalado: true,
    unitHa: useGypsumProduct ? "kg yeso/ha" : "kg cal agrícola/ha",
    unitPlot: useGypsumProduct
      ? `kg yeso/${areaUnit}`
      : `kg cal agrícola/${areaUnit}`,
    steps: caSteps,
  };

  const doses = [doseN, doseP, doseK, doseMg, doseCa];

  const needed = doses.filter((d) => !d.notRequired && !d.viaEncalado);
  const notNeeded = doses.filter((d) => d.notRequired && !d.viaEncalado);

  const recommendations: string[] = [
    `Cultivo: ${cultivoLabel}${cropMatched ? "" : " (extracción manual)"}. Rendimiento objetivo: ${yieldTarget} t/ha.`,
    `N desde MO: escenario ${mineralizationScenarioLabel(scenario)} (coef. ${round(minerCoef * 100, 2)}%) → suministro ≈ ${round(supplyN, 1)} kg N/ha.`,
    needed.length
      ? `Aplicar fertilizante para: ${needed.map((d) => `${d.nutrient} (${d.dosisPlot ?? d.dosisKgHa} ${d.dosisPlot != null && areaUnit !== "ha" ? d.unitPlot : d.unitHa})`).join(", ")}.`
      : "No se requieren dosis positivas de N, P, K ni Mg con los datos actuales.",
    ...notNeeded.map((d) => `No es necesario fertilizar ${d.nutrient} — el suministro del suelo cubre la demanda.`),
    // Amendment kind (calcitic/dolomitic lime, gypsum, sulfur, OM, or "none") is
    // appended by FertilizerPlanCalculator via recommendSoilAmendment + i18n.
  ];

  const sections = [
    {
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
      ] satisfies FertilityCalcStep[],
    },
  ];

  return {
    cultivo: cultivoLabel,
    cropMatched,
    massTonsHa: round(massTonsHa, 2),
    massKgHa: round(massKgHa, 0),
    displayMode: mode,
    areaHa: round(areaHa, 4),
    areaUnit,
    extractionUsed,
    mineralizationScenario: scenario,
    mineralizationCoef: minerCoef,
    doses,
    recommendations,
    sections,
  };
}

export function fertilityDosePlanToCalculationOutputs(plan: FertilityDosePlanResult): CalculationOutput[] {
  return plan.doses
    .filter((d) => !d.viaEncalado || (d.dosisKgHa != null && d.dosisKgHa > 0))
    .map((dose) => ({
      value: dose.dosisPlot ?? dose.dosisKgHa ?? 0,
      unit: dose.dosisPlot != null && plan.areaUnit !== "ha" ? dose.unitPlot : dose.unitHa,
      label: dose.viaEncalado
        ? `${dose.nutrient} — liming`
        : dose.notRequired
          ? `${dose.nutrient} — NF`
          : `Dosis ${dose.nutrient}`,
      formula: dose.viaEncalado
        ? "Cal = [(CICe×sat_meta − Ca) → kg Ca/ha × 1.4] / (CaO%/100) / (PRNT/100)"
        : "(Demanda − Suministro) / Eficiencia",
      notes: [
        dose.viaEncalado
          ? dose.notRequired
            ? "No lime/gypsum application needed — CICe / V% within sufficient ranges."
            : `Liming/gypsum product from Tutoría Ca-saturation method · ${dose.dosisKgHa} kg/ha.`
          : dose.notRequired
            ? "No requiere fertilización."
            : `Demanda: ${dose.demandaKgHa} · Suministro: ${dose.suministroKgHa} · Eficiencia: ${round(dose.eficiencia * 100, 0)}%.`,
        `Cultivo: ${plan.cultivo}.`,
      ],
    }));
}
