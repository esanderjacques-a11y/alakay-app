/**
 * Soil amendment recommendation (Tutoría Plan nutricional / SUE302 §§1.4–1.5, 12–14).
 * Names the amendment kind when warranted, or states explicitly that none is needed.
 * Lime / gypsum doses are gated on CICe cation distribution and base saturation (V%).
 */

import {
  calculateBaseSaturation,
  getCicAcidityContribution,
  type BaseSaturationResult,
} from "@/lib/baseSaturation";
import { CIC_ADEQUATE_SATURATION } from "@/lib/cicInterpretation";

/** Named soil amendments the app can recommend. */
export type AmendmentKind =
  | "calcitic_lime"
  | "dolomitic_lime"
  | "gypsum"
  | "elemental_sulfur"
  | "organic_matter"
  | "none";

export type SoilAmendmentInput = {
  ph?: number | null;
  cec?: number | null;
  ca?: number | null;
  mg?: number | null;
  k?: number | null;
  na?: number | null;
  /** Exchangeable acidity H+Al (cmol(+)/kg). */
  exchangeableAcidity?: number | null;
  aluminum?: number | null;
  aluminumUnit?: string | null;
  organicMatterPercent?: number | null;
  /**
   * Crop CaO demand present in the nutritional plan (via liming product).
   * Does NOT by itself force a lime recommendation when CICe / V% are already sufficient.
   */
  cropCaViaLiming?: boolean;
};

export type AmendmentNeed = {
  kind: Exclude<AmendmentKind, "none">;
  /** i18n key under calculatorHubText / Translation. */
  messageKey: string;
};

export type SoilAmendmentRecommendation = {
  /** Primary amendment (or "none"). */
  kind: AmendmentKind;
  /** Ordered needs — empty when kind is "none". */
  needs: AmendmentNeed[];
  /** True when cation / pH data were insufficient for a full diagnosis. */
  insufficientData: boolean;
};

/** Why lime or gypsum is (or is not) indicated from CICe / V% chemistry. */
export type AmendmentChemistryGate = {
  insufficientData: boolean;
  /** Ca% of CICe below Tabla N.° 2 adequate minimum. */
  caDeficit: boolean;
  /** V% (PSB) below Tabla N.° 2 adequate band for tropical crops (75–80%). */
  lowBaseSaturation: boolean;
  /** Exchangeable acidity (H+Al or Al) present. */
  hasAcidity: boolean;
  /** Elevated Na (sodicity risk). */
  sodic: boolean;
  /** Mg% below Tabla N.° 2 adequate minimum. */
  mgLow: boolean;
  /** Soil chemistry warrants agricultural lime (raises pH / displaces acidity). */
  needsLime: boolean;
  /**
   * Soil chemistry warrants gypsum (Ca without raising pH): sodicity, or Ca deficit
   * without exchangeable acidity (document + encaladoCaDeficitNoAcidity).
   */
  needsGypsum: boolean;
  /** No lime and no gypsum indicated from CICe / V% / acidity / Na. */
  noLimeOrGypsum: boolean;
  caPercent: number | null;
  vPercent: number | null;
  acidityCmol: number;
  sat: BaseSaturationResult | null;
};

const IDEAL = CIC_ADEQUATE_SATURATION;

/**
 * Table 1 — extractable acidity above this leaves the adequate band (cmol(+)/kg).
 * Used with low Ca sat to decide liming vs gypsum (not raw acidic pH alone).
 */
const ACIDITY_ADEQUATE_MAX = 0.5;
/** Typical pH band for elemental sulfur triage only (not lime). */
const PH_ALKALINE = 7.5;
/** Organic matter % below which an OM amendment note is useful. */
const OM_LOW = 2;

function finite(value: number | null | undefined): number | null {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function hasChemistry(input: SoilAmendmentInput) {
  return (
    finite(input.ph) != null ||
    finite(input.ca) != null ||
    finite(input.mg) != null ||
    finite(input.na) != null ||
    finite(input.cec) != null ||
    finite(input.exchangeableAcidity) != null ||
    finite(input.aluminum) != null
  );
}

function buildSaturation(input: SoilAmendmentInput): BaseSaturationResult | null {
  return calculateBaseSaturation({
    cec: finite(input.cec) ?? undefined,
    ca: finite(input.ca) ?? undefined,
    mg: finite(input.mg) ?? undefined,
    k: finite(input.k) ?? undefined,
    na: finite(input.na) ?? undefined,
    hAl: finite(input.exchangeableAcidity) ?? undefined,
    aluminum: finite(input.aluminum) ?? undefined,
    aluminumUnit: input.aluminumUnit || undefined,
  });
}

/**
 * Gate lime / gypsum on CICe distribution and base saturation (Tutoría §§1.2–1.5).
 * Sufficient ranges → no Lime or Gypsum calculation/recommendation.
 */
export function assessAmendmentChemistry(
  input: SoilAmendmentInput
): AmendmentChemistryGate {
  if (!hasChemistry(input)) {
    return {
      insufficientData: true,
      caDeficit: false,
      lowBaseSaturation: false,
      hasAcidity: false,
      sodic: false,
      mgLow: false,
      needsLime: false,
      needsGypsum: false,
      noLimeOrGypsum: true,
      caPercent: null,
      vPercent: null,
      acidityCmol: 0,
      sat: null,
    };
  }

  const sat = buildSaturation(input);
  const acidity = getCicAcidityContribution({
    hAl: finite(input.exchangeableAcidity) ?? undefined,
    aluminum: finite(input.aluminum) ?? undefined,
    aluminumUnit: input.aluminumUnit || undefined,
  });
  const naCmol = finite(input.na);
  const hasAcidity = acidity > 0;
  const acidityHigh = acidity > ACIDITY_ADEQUATE_MAX;

  const caPercent = sat != null && sat.caPercent > 0 ? sat.caPercent : null;
  const vPercent =
    sat != null && sat.totalBasePercent > 0 ? sat.totalBasePercent : null;
  const canEvaluateSats = caPercent != null || vPercent != null;

  const caDeficit = caPercent != null && caPercent < IDEAL.ca.min;
  const lowBaseSaturation = vPercent != null && vPercent < IDEAL.totalBases.min;
  const mgLow = sat != null && sat.mgPercent > 0 && sat.mgPercent < IDEAL.mg.min;
  // Prefer Na% of CICe when available; fall back to cmol only without sat %.
  const sodic =
    sat != null && sat.totalBasePercent > 0
      ? sat.naPercent > IDEAL.na.max
      : naCmol != null && naCmol > 1.0;

  // Lime (Cal): low V% / PSB, or low Ca sat coinciding with excess extractable acidity.
  // Acidic pH alone does NOT force liming when CICe / V% already look sufficient.
  const needsLime = lowBaseSaturation || (caDeficit && acidityHigh);

  // Gypsum: sodicity, or Ca sat below sufficient without a liming pathway.
  const needsGypsum = sodic || (caDeficit && !needsLime);

  const noLimeOrGypsum = !needsLime && !needsGypsum;

  return {
    // Without CICe / base sat % we cannot affirm sufficiency (pH-only is not enough).
    insufficientData: !canEvaluateSats && !sodic,
    caDeficit,
    lowBaseSaturation,
    hasAcidity,
    sodic,
    mgLow,
    needsLime,
    needsGypsum,
    noLimeOrGypsum,
    caPercent,
    vPercent,
    acidityCmol: acidity,
    sat,
  };
}

/**
 * Diagnose which soil amendment(s) to name in recommendations.
 * Priority: gypsum (sodicity / Ca without liming need) → lime (low V% / Ca+acidity)
 * → sulfur (alkaline pH) → organic matter (low OM).
 * Calcitic vs dolomitic is named only when liming is chemically warranted.
 */
export function recommendSoilAmendment(
  input: SoilAmendmentInput
): SoilAmendmentRecommendation {
  if (!hasChemistry(input)) {
    return { kind: "none", needs: [], insufficientData: true };
  }

  const gate = assessAmendmentChemistry(input);
  const ph = finite(input.ph);
  const om = finite(input.organicMatterPercent);

  const needs: AmendmentNeed[] = [];
  const seen = new Set<Exclude<AmendmentKind, "none">>();

  function push(kind: Exclude<AmendmentKind, "none">, messageKey: string) {
    if (seen.has(kind)) return;
    seen.add(kind);
    needs.push({ kind, messageKey });
  }

  if (gate.needsGypsum) {
    if (gate.sodic) {
      push("gypsum", "amendRecGypsumNa");
    } else {
      push("gypsum", "amendRecGypsumCa");
    }
  }

  if (gate.needsLime) {
    const useCropCopy = Boolean(input.cropCaViaLiming);
    if (gate.mgLow) {
      push(
        "dolomitic_lime",
        useCropCopy ? "amendRecDolomiticLimeCrop" : "amendRecDolomiticLime"
      );
    } else {
      push(
        "calcitic_lime",
        useCropCopy ? "amendRecCalciticLimeCrop" : "amendRecCalciticLime"
      );
    }
  }

  if (ph != null && ph > PH_ALKALINE) {
    push("elemental_sulfur", "amendRecElementalSulfur");
  }

  if (om != null && om > 0 && om < OM_LOW) {
    push("organic_matter", "amendRecOrganicMatter");
  }

  if (needs.length === 0) {
    return {
      kind: "none",
      needs: [],
      insufficientData: gate.insufficientData,
    };
  }

  return {
    kind: needs[0].kind,
    needs,
    insufficientData: false,
  };
}

const FALLBACKS: Record<string, string> = {
  amendRecNone:
    "No liming or gypsum is needed — CICe base saturation is within the sufficient range.",
  amendRecInsufficientData:
    "Amendment: insufficient CICe / base-saturation data to decide — enter exchangeable bases, CIC (or H+Al), in Values.",
  amendRecCalciticLime:
    "Amendment: use calcareous (calcitic) agricultural lime — base saturation (V%) or Ca saturation is below the sufficient CICe range.",
  amendRecDolomiticLime:
    "Amendment: use dolomitic lime — base saturation is low and Mg saturation is below the sufficient CICe range.",
  amendRecGypsumNa:
    "Amendment: use gypsum — Na saturation is above the sufficient CICe range; gypsum supplies Ca to displace Na without raising pH much.",
  amendRecGypsumCa:
    "Amendment: use gypsum (or another Ca source) — Ca saturation is below the sufficient CICe range without a liming need.",
  amendRecElementalSulfur:
    "Amendment: use elemental sulfur — soil pH is high and may need acidification for the crop.",
  amendRecOrganicMatter:
    "Amendment: consider organic matter (manure, compost, or cover crops) — soil OM is low.",
  amendRecNoLime:
    "No lime application needed — CICe cation distribution and base saturation (V%) are within sufficient ranges.",
  amendRecNoGypsum:
    "No gypsum application needed — sodium and Ca saturation do not indicate a gypsum requirement.",
};

function messageFor(t: Record<string, string>, key: string) {
  return t[key] || FALLBACKS[key] || key;
}

/**
 * One or more recommendation lines naming the amendment kind, or an explicit
 * "no amendment needed" statement.
 */
export function formatAmendmentRecommendationLines(
  rec: SoilAmendmentRecommendation,
  t: Record<string, string> = {}
): string[] {
  if (rec.insufficientData && rec.needs.length === 0) {
    return [messageFor(t, "amendRecInsufficientData")];
  }
  if (rec.kind === "none" || rec.needs.length === 0) {
    return [messageFor(t, "amendRecNone")];
  }
  return rec.needs.map((need) => messageFor(t, need.messageKey));
}

export function formatAmendmentRecommendation(
  rec: SoilAmendmentRecommendation,
  t: Record<string, string> = {}
): string {
  return formatAmendmentRecommendationLines(rec, t).join(" ");
}

/** Map common lab / PDF parameter names to amendment inputs. */
export function soilAmendmentInputFromLabLike(
  getValue: (keys: string[]) => number | null,
  extras?: { aluminumUnit?: string | null; cropCaViaLiming?: boolean }
): SoilAmendmentInput {
  return {
    ph: getValue(["ph", "ph_h2o", "ph_water", "ph_agua"]),
    cec: getValue(["cec", "cice", "cic", "ctc"]),
    ca: getValue(["calcium", "ca"]),
    mg: getValue(["magnesium", "mg"]),
    k: getValue(["potassium", "k"]),
    na: getValue(["sodium", "na"]),
    exchangeableAcidity: getValue([
      "exchangeable_acidity",
      "acidez_extraible",
      "h_al",
      "h+al",
    ]),
    aluminum: getValue(["aluminum", "aluminium", "al"]),
    aluminumUnit: extras?.aluminumUnit,
    organicMatterPercent: getValue([
      "organic_matter",
      "materia_organica",
      "om",
      "mo",
    ]),
    cropCaViaLiming: extras?.cropCaViaLiming,
  };
}

export function soilAmendmentInputFromPdfResults(
  results: Array<{
    parameter_name: string;
    display_parameter_name?: string;
    value: number;
    unit_symbol?: string;
  }>,
  extras?: { cropCaViaLiming?: boolean }
): SoilAmendmentInput {
  const byKey = new Map<string, { value: number; unit: string }>();
  for (const result of results) {
    const hay = `${result.parameter_name} ${result.display_parameter_name || ""}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const value = Number(result.value);
    if (!Number.isFinite(value)) continue;
    const unit = result.unit_symbol || "";
    const put = (key: string) => {
      if (!byKey.has(key)) byKey.set(key, { value, unit });
    };
    if (/\bph\b/.test(hay)) put("ph");
    if (/\b(cec|cice|cic|ctc)\b/.test(hay)) put("cec");
    if (/\b(ca|calcium|calcio)\b/.test(hay) && !/carbon|caco|cao/.test(hay)) put("calcium");
    if (/\b(mg|magnesium|magnesio)\b/.test(hay) && !/mgo|kg/.test(hay)) put("magnesium");
    if (/\b(k|potassium|potasio)\b/.test(hay) && !/k2o/.test(hay)) put("potassium");
    if (/\b(na|sodium|sodio)\b/.test(hay)) put("sodium");
    if (/acidity|acidez|h\+al|h al|h_al/.test(hay)) put("exchangeable_acidity");
    if (/\b(al|aluminum|aluminium|aluminio)\b/.test(hay) && !/h\+al|h al/.test(hay)) {
      put("aluminum");
    }
    if (/organic matter|materia organica|matiere organique|matye oganik|\bom\b|\bmo\b/.test(hay)) {
      put("organic_matter");
    }
  }

  const get = (keys: string[]) => {
    for (const key of keys) {
      const hit = byKey.get(key);
      if (hit) return hit.value;
    }
    return null;
  };

  return soilAmendmentInputFromLabLike(get, {
    aluminumUnit: byKey.get("aluminum")?.unit,
    cropCaViaLiming: extras?.cropCaViaLiming,
  });
}
