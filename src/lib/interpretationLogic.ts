/**
 * Parameter-specific interpretation advice.
 * Prefer concrete management cues over generic “review this value” text.
 */

type LogicInput = {
  parameter_id?: number;
  parameter_name: string;
  value: number;
  min: number | null;
  max: number | null;
};

function normalizeName(name: string) {
  return name.toLowerCase().trim();
}

function isBulkDensity(name: string) {
  const n = normalizeName(name);
  return n.includes("bulk density") || n.includes("densidad aparente");
}

function isPH(name: string) {
  const n = normalizeName(name);
  return (
    /\bph\b/.test(n) &&
    !/\b(phosphorus|phosphate|phosphore|fosforo|fosfato)\b/.test(n)
  );
}

function isElectricalConductivity(name: string) {
  const n = normalizeName(name);
  return (
    n.includes("electrical conductivity") ||
    n === "ec" ||
    n.includes("conductividad eléctrica") ||
    n.includes("conductividad electrica") ||
    n.includes("conductivite")
  );
}

function isSodium(name: string) {
  const n = normalizeName(name);
  return (
    n === "na" ||
    n.includes("sodium") ||
    n.includes("sodio") ||
    n.includes("sodium exchangeable")
  );
}

function isAluminum(name: string) {
  const n = normalizeName(name);
  return n === "al" || n.includes("aluminum") || n.includes("aluminio");
}

function matchAny(name: string, needles: string[]) {
  const n = normalizeName(name);
  return needles.some((needle) =>
    needle.length <= 3 ? n === needle || new RegExp(`\\b${needle}\\b`).test(n) : n.includes(needle)
  );
}

function isNitrogen(name: string) {
  return matchAny(name, [
    "nitrogen",
    "nitrógeno",
    "nitrogeno",
    "nitrate",
    "nitrato",
    "ammonium",
    "amonio",
    "no3",
    "nh4",
    "n-no3",
    "n-nh4",
  ]) && !matchAny(name, ["organic matter", "materia orgánica", "materia organica"]);
}

function isPhosphorus(name: string) {
  return matchAny(name, [
    "phosphorus",
    "phosphore",
    "fósforo",
    "fosforo",
    "phosphate",
    "fosfato",
    "p2o5",
    "p-olsen",
    "p-bray",
    "p-mehlich",
  ]);
}

function isPotassium(name: string) {
  return matchAny(name, [
    "potassium",
    "potasio",
    "potassium oxide",
    "k2o",
    "k-exchangeable",
    "k intercambiable",
  ]);
}

function isCalcium(name: string) {
  return matchAny(name, ["calcium", "calcio", "cao", "ca-exchangeable", "ca intercambiable"]);
}

function isMagnesium(name: string) {
  return matchAny(name, [
    "magnesium",
    "magnesio",
    "mgo",
    "mg-exchangeable",
    "mg intercambiable",
  ]);
}

function isSulfur(name: string) {
  return matchAny(name, ["sulfur", "sulphur", "azufre", "sulfate", "sulfato", "so4"]);
}

function isOrganicMatter(name: string) {
  return matchAny(name, [
    "organic matter",
    "materia orgánica",
    "materia organica",
    "organic carbon",
    "carbono orgánico",
    "carbono organico",
    "om",
    "mo",
  ]);
}

function isCec(name: string) {
  return matchAny(name, ["cec", "cic", "capacidad de intercambio", "cation exchange"]);
}

function isBaseSaturation(name: string) {
  return matchAny(name, [
    "base saturation",
    "saturación de bases",
    "saturacion de bases",
    "v%",
    "v %",
  ]);
}

function isZinc(name: string) {
  return matchAny(name, ["zinc", "zn"]);
}
function isIron(name: string) {
  return matchAny(name, ["iron", "hierro", "fierro", "fe"]);
}
function isBoron(name: string) {
  return matchAny(name, ["boron", "boro"]);
}
function isManganese(name: string) {
  return matchAny(name, ["manganese", "manganeso", "mn"]);
}
function isCopper(name: string) {
  return matchAny(name, ["copper", "cobre", "cu"]);
}
function isMolybdenum(name: string) {
  return matchAny(name, ["molybdenum", "molibdeno", "mo"]);
}

function bandHint(input: LogicInput) {
  if (input.min != null && input.max != null) {
    return ` Measured ${formatNum(input.value)}; suitable band ${formatNum(input.min)}–${formatNum(input.max)}.`;
  }
  if (input.min != null) {
    return ` Measured ${formatNum(input.value)}; reference min ${formatNum(input.min)}.`;
  }
  if (input.max != null) {
    return ` Measured ${formatNum(input.value)}; reference max ${formatNum(input.max)}.`;
  }
  return ` Measured ${formatNum(input.value)}.`;
}

function formatNum(n: number) {
  if (!Number.isFinite(n)) return String(n);
  const abs = Math.abs(n);
  if (abs >= 100) return n.toFixed(0);
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

export function getLevelCode(input: LogicInput) {
  const name = input.parameter_name;
  const value = input.value;
  const min = input.min;
  const max = input.max;

  if (isBulkDensity(name)) {
    if (value > 1.65) return "very_high";
    if (value > 1.45) return "high";
    return "acceptable";
  }

  if (isElectricalConductivity(name)) {
    if (value >= 4) return "very_high";
    if (value >= 2) return "high";
    return "acceptable";
  }

  if (isPH(name)) {
    if (min !== null && max !== null) {
      if (value < min) return "acidic";
      if (value > max) return "alkaline";
      return "neutral_ph";
    }
    if (value < 6.5) return "acidic";
    if (value > 7.5) return "alkaline";
    return "neutral_ph";
  }

  if (isSodium(name)) {
    if (min !== null && max !== null) {
      if (value < min) return "low";
      if (value > max) return "high";
      return "normal";
    }
    if (value > 2) return "very_high";
    if (value > 1) return "high";
    if (value >= 0.5) return "moderate";
    return "acceptable";
  }

  if (isAluminum(name)) {
    if (max !== null && value > max) return "high";
    return "acceptable";
  }

  if (min !== null && value < min) return "low";
  if (max !== null && value > max) return "high";
  return "normal";
}

export function getFinalGroupCode(input: LogicInput) {
  const level = getLevelCode(input);
  const name = input.parameter_name;

  if (isBulkDensity(name)) {
    if (level === "very_high" || level === "high") return "negative";
    return "normal";
  }

  if (isPH(name)) {
    if (level === "acidic" || level === "alkaline" || level === "low" || level === "high")
      return "warning";
    return "normal";
  }

  if (isElectricalConductivity(name)) {
    if (level === "very_high" || level === "high") return "negative";
    return "normal";
  }

  if (isSodium(name)) {
    if (level === "very_high" || level === "high") return "negative";
    if (level === "moderate") return "warning";
    return "normal";
  }

  if (isAluminum(name)) {
    if (level === "high") return "negative";
    return "normal";
  }

  if (level === "low") return "warning";
  if (level === "high" || level === "very_high") return "warning";
  if (level === "normal" || level === "acceptable") return "normal";

  return "neutral";
}

function soilNutrientAdvice(input: LogicInput, level: string) {
  const name = input.parameter_name;
  const hint = bandHint(input);

  if (isNitrogen(name)) {
    if (level === "low")
      return `Available N is low.${hint} Schedule N for the next crop demand peak; split applications on sandy or high-rainfall soils to cut leaching. Prefer nitrate tests near planting for quick-acting needs.`;
    if (level === "high" || level === "very_high")
      return `Available N is high.${hint} Delay or reduce the next N rate; excess raises lodging, soft growth, and leaching risk. Re-check after heavy rain before topping up.`;
    return `Available N is within the reference band.${hint} Keep timing aligned with crop uptake rather than applying large single doses.`;
  }

  if (isPhosphorus(name)) {
    if (level === "low")
      return `Phosphorus is below the reference.${hint} Place or band P near the root zone; broadcast-only P is less efficient. Fix extreme acidity or calcareous pH first — both lock P.`;
    if (level === "high" || level === "very_high")
      return `Phosphorus is above the reference.${hint} Skip or cut P fertilizer this cycle; excess wastes money and can antagonize Zn/Fe. Focus on placement only if starter P is still needed.`;
    return `Phosphorus is within the reference band.${hint} Maintain with modest maintenance rates if removal is high (fruit, tubers, silage).`;
  }

  if (isPotassium(name)) {
    if (level === "low")
      return `Potassium is low.${hint} Apply K before peak vegetative/fruit demand; sandy soils and high-Ca regimes need more frequent smaller doses. Watch luxury consumption if EC is already high.`;
    if (level === "high" || level === "very_high")
      return `Potassium is high.${hint} Hold K fertilizer; excess can suppress Mg and Ca uptake. Recheck Mg:K balance before adding more potash.`;
    return `Potassium is within the reference band.${hint} Replace crop removal, especially on high-yielding fruit or forage systems.`;
  }

  if (isCalcium(name)) {
    if (level === "low")
      return `Calcium is low.${hint} Prefer lime (if pH is also low) or gypsum (if pH is adequate but structure/Na is the issue). Do not lime solely for Ca if V% and pH are already fine.`;
    if (level === "high" || level === "very_high")
      return `Calcium is high.${hint} Avoid more lime/gypsum unless sodicity or structure demands it; excess Ca can crowd out K and Mg on the exchange complex.`;
    return `Calcium is within the reference band.${hint} Keep an eye on Ca:Mg:K ratios rather than Ca alone.`;
  }

  if (isMagnesium(name)) {
    if (level === "low")
      return `Magnesium is low.${hint} Use kieserite or Mg sulfate when a quick response is needed; dolomitic lime if pH also needs raising. Check that high K is not blocking Mg uptake.`;
    if (level === "high" || level === "very_high")
      return `Magnesium is high.${hint} Avoid Mg amendments; very high Mg can tighten structure on some clays and compete with K/Ca.`;
    return `Magnesium is within the reference band.${hint} Maintain with crop removal replacement if yields are high.`;
  }

  if (isSulfur(name)) {
    if (level === "low")
      return `Sulfur is low.${hint} Use sulfate sources for a fast correction (ammonium sulfate, gypsum, kieserite); elemental S is slower and acidifies. Priority on sandy soils after leaching rains.`;
    if (level === "high" || level === "very_high")
      return `Sulfur is high.${hint} Skip S fertilizer; if EC is also high, salts may be contributing — improve leaching/drainage before adding more sulfate.`;
    return `Sulfur is within the reference band.${hint}`;
  }

  if (isOrganicMatter(name)) {
    if (level === "low")
      return `Organic matter is low.${hint} Build OM with residues, compost, cover crops, and reduced tillage; expect multi-season change, not a one-shot fix.`;
    if (level === "high" || level === "very_high")
      return `Organic matter is high.${hint} Favorable for structure and nutrient buffering; still match mineral fertilizer to crop removal so N release does not run ahead of demand.`;
    return `Organic matter is within the reference band.${hint} Protect it with residue return and controlled tillage.`;
  }

  if (isCec(name)) {
    if (level === "low")
      return `CEC is low.${hint} The soil holds fewer cations — prefer split K/Mg/Ca applications and build organic matter rather than large single dressings.`;
    if (level === "high" || level === "very_high")
      return `CEC is high.${hint} Good buffering capacity; amendments change saturation slowly — dose lime/gypsum from V% and pH targets, not CEC alone.`;
    return `CEC is within the expected band.${hint}`;
  }

  if (isBaseSaturation(name)) {
    if (level === "low")
      return `Base saturation (V%) is low.${hint} Liming is usually justified if pH/Al also confirm acidity; raise V% toward the crop target before heavy NPK investment.`;
    if (level === "high" || level === "very_high")
      return `Base saturation is high.${hint} Extra lime is rarely needed; if pH is already adequate, focus on nutrient balance (Ca:Mg:K) instead of more carbonate.`;
    return `Base saturation is within the reference band.${hint}`;
  }

  if (isZinc(name)) {
    if (level === "low")
      return `Zinc is low.${hint} Band Zn or use foliar Zn on responsive crops; high P and high pH often induce Zn deficiency — correct those first when possible.`;
    if (level === "high" || level === "very_high")
      return `Zinc is high.${hint} Stop Zn applications; repeated Zn can become toxic, especially in acid soils.`;
    return `Zinc is within the reference band.${hint}`;
  }

  if (isIron(name)) {
    if (level === "low")
      return `Iron is low.${hint} Prefer chelated Fe or foliar Fe on high-pH soils; soil Fe sulfate often fails when pH stays alkaline.`;
    if (level === "high" || level === "very_high")
      return `Iron is high.${hint} Unusual toxicity in well-aerated soils — confirm drainage/waterlogging and skip Fe fertilizer.`;
    return `Iron is within the reference band.${hint}`;
  }

  if (isBoron(name)) {
    if (level === "low")
      return `Boron is low.${hint} Apply a small B rate carefully (narrow window between deficiency and toxicity), preferably broadcast-incorporated or foliar at sensitive stages.`;
    if (level === "high" || level === "very_high")
      return `Boron is high.${hint} Do not apply B; toxicity risk rises fast. Leach if feasible and avoid B-containing fertilizers.`;
    return `Boron is within the reference band.${hint}`;
  }

  if (isManganese(name)) {
    if (level === "low")
      return `Manganese is low.${hint} Foliar Mn or Mn sulfate works well; deficiency is common on high-pH or heavily limed soils.`;
    if (level === "high" || level === "very_high")
      return `Manganese is high.${hint} Often linked to acidity or waterlogging — improve aeration/drainage and avoid Mn fertilizer; liming may help if pH is very low.`;
    return `Manganese is within the reference band.${hint}`;
  }

  if (isCopper(name)) {
    if (level === "low")
      return `Copper is low.${hint} Use a small Cu rate or foliar Cu; organic soils and high pH often need Cu more than mineral soils.`;
    if (level === "high" || level === "very_high")
      return `Copper is high.${hint} Skip Cu fertilizer; cumulative Cu (fungicides/history) can harm roots and microbes.`;
    return `Copper is within the reference band.${hint}`;
  }

  if (isMolybdenum(name)) {
    if (level === "low")
      return `Molybdenum is low.${hint} Small Mo rates or foliar Mo help legumes/brassicas; liming acidic soils often improves Mo availability without much fertilizer.`;
    if (level === "high" || level === "very_high")
      return `Molybdenum is high.${hint} Stop Mo applications; excess is uncommon but unnecessary.`;
    return `Molybdenum is within the reference band.${hint}`;
  }

  return null;
}

function foliarNutrientAdvice(input: LogicInput, level: string) {
  const name = input.parameter_name;
  const hint = bandHint(input);

  if (isNitrogen(name)) {
    if (level === "low")
      return `Leaf N is below sufficiency.${hint} Use a foliar N suited to this stage, or bring forward the next soil N dose before the next flush.`;
    if (level === "high" || level === "very_high")
      return `Leaf N is above sufficiency.${hint} Soft, dark growth and disease risk rise — cut upcoming N and check recent foliar/soil applications.`;
    return `Leaf N is within sufficiency.${hint}`;
  }
  if (isPhosphorus(name)) {
    if (level === "low")
      return `Leaf P is low.${hint} Foliar P can bridge a short gap; lasting correction needs soil P placement and pH that keeps P available.`;
    if (level === "high" || level === "very_high")
      return `Leaf P is high.${hint} Skip P foliar products; check whether recent P sprays or high soil P explain it.`;
    return `Leaf P is within sufficiency.${hint}`;
  }
  if (isPotassium(name)) {
    if (level === "low")
      return `Leaf K is low.${hint} Foliar K can help during fruit fill; also confirm soil K and irrigation (K moves with water).`;
    if (level === "high" || level === "very_high")
      return `Leaf K is high.${hint} Hold K products; luxury uptake is common when soil K is ample.`;
    return `Leaf K is within sufficiency.${hint}`;
  }
  if (isCalcium(name)) {
    if (level === "low")
      return `Leaf Ca is low.${hint} Foliar Ca helps fruit quality disorders; also check water supply and soil Ca/CEC — Ca moves poorly in plant phloem.`;
    if (level === "high" || level === "very_high")
      return `Leaf Ca is high.${hint} Extra Ca sprays are unnecessary unless a specific fruit disorder protocol requires them.`;
    return `Leaf Ca is within sufficiency.${hint}`;
  }
  if (isMagnesium(name)) {
    if (level === "low")
      return `Leaf Mg is low.${hint} Foliar Mg sulfate often greens tissue quickly; check soil Mg and high-K antagonism.`;
    if (level === "high" || level === "very_high")
      return `Leaf Mg is high.${hint} Skip Mg foliar; review whether recent sprays overshot.`;
    return `Leaf Mg is within sufficiency.${hint}`;
  }
  if (isZinc(name) || isIron(name) || isBoron(name) || isManganese(name) || isCopper(name) || isMolybdenum(name) || isSulfur(name)) {
    const label = input.parameter_name;
    if (level === "low")
      return `${label} in tissue is below sufficiency.${hint} Prefer a targeted foliar for this micronutrient at a compatible stage; confirm soil pH/antagonisms so deficiency does not return.`;
    if (level === "high" || level === "very_high")
      return `${label} in tissue is above sufficiency.${hint} Stop adding this nutrient; micros have a narrow safety margin when sprayed repeatedly.`;
    return `${label} in tissue is within sufficiency.${hint}`;
  }

  if (level === "low") {
    return `Tissue ${input.parameter_name} is below sufficiency.${hint} Adjust foliar nutrition or the soil program for this crop stage.`;
  }
  if (level === "high" || level === "very_high") {
    return `Tissue ${input.parameter_name} is above sufficiency.${hint} Review recent applications and antagonisms before adding more.`;
  }
  return `Tissue ${input.parameter_name} is within sufficiency.${hint}`;
}

export function getSimpleAdvice(
  input: LogicInput,
  sampleType: "soil" | "foliar" | "water" = "soil"
) {
  const level = getLevelCode(input);

  if (sampleType === "water") {
    const name = String(input.parameter_name || "").toLowerCase();
    const isPh = isPH(name);
    const isEc = isElectricalConductivity(name);
    const isSar = name.includes("sar") || name.includes("ras");
    const isNa = isSodium(name);
    const isCl =
      name.includes("chloride") || name.includes("cloruro") || name.includes("cloro");
    const isB = isBoron(name);
    const isHco3 =
      name.includes("bicarbonate") ||
      name.includes("bicarbonato") ||
      name.includes("hco3") ||
      name.includes("alkalinity");
    const isKelly = name.includes("kelly");
    const isHardness = name.includes("hardness") || name.includes("dureza");
    const isFe = isIron(name);
    const hint = bandHint(input);

    if (level === "acidic" || (isPh && level === "low")) {
      return `Irrigation pH is below the “none” band (target 5.5–7.0).${hint} Acid water can corrode metal and shift fertigation chemistry — check injector materials and nutrient tank stability.`;
    }
    if (level === "alkaline" || (isPh && (level === "high" || level === "very_high"))) {
      return `Irrigation pH is above the “none” band (target 5.5–7.0).${hint} Expect bicarbonate/clogging risk and weaker Fe/Zn/Mn availability in fertigation — acidify if HCO₃ is also elevated.`;
    }
    if (isEc && (level === "high" || level === "very_high")) {
      return `EC is above ~0.7 dS/m.${hint} Salt load ≈ EC×0.64 g/L. Increase leaching fraction and favor salt-tolerant crops as EC approaches 3 dS/m.`;
    }
    if (isSar && (level === "high" || level === "very_high")) {
      return `RAS/SAR is elevated.${hint} Na may displace Ca/Mg and seal the soil surface — pair with gypsum, drainage, and adequate leaching when EC allows.`;
    }
    if (isNa && (level === "high" || level === "very_high")) {
      return `Sodium is in the toxicity risk zone (moderate ~70 mg/L, high >180 mg/L).${hint} Confirm RAS and avoid foliar-sensitive crops if Na stays high.`;
    }
    if (isCl && (level === "high" || level === "very_high")) {
      return `Chloride is in the toxicity risk zone (moderate ~68 mg/L, high >170 mg/L).${hint} Blend with better water or choose Cl-tolerant crops.`;
    }
    if (isB && (level === "high" || level === "very_high")) {
      return `Boron is above the low-risk irrigation band.${hint} Severity rises near 0.5–0.7 mg/L; >2–3 mg/L is high for many crops — do not add B fertilizer.`;
    }
    if (isHco3 && (level === "high" || level === "very_high")) {
      return `Bicarbonate is elevated (>~40 mg/L starts risk; >180 mg/L high).${hint} Acidify fertigation and flush emitters to limit scale.`;
    }
    if (isFe && (level === "high" || level === "very_high")) {
      return `Iron in water is elevated (>~0.2 mg/L stains/clogs; >0.4 high).${hint} Filter or oxidize/settle before drip.`;
    }
    if (isKelly && level === "low") {
      return `Kelly index ≤35%.${hint} Ca share is weak vs Mg+Na — alkalinization risk; favor Ca amendments if the soil can take them.`;
    }
    if (isHardness && (level === "high" || level === "very_high")) {
      return `Hardness (°f) is high.${hint} Scale and emitter wear rise toward very hard water (>54 °f).`;
    }
    if (level === "low") {
      return `${input.parameter_name} is below the irrigation “none” band.${hint} Confirm units and whether this nutrient contribution from water should be credited in the fertility plan.`;
    }
    if (level === "high" || level === "very_high") {
      return `${input.parameter_name} is above the irrigation “none” band.${hint} Adjust crop choice, leaching, treatment, or blending before long-term use.`;
    }
    return `${input.parameter_name} is within the irrigation suitability band.${hint}`;
  }

  if (sampleType === "foliar") {
    return foliarNutrientAdvice(input, level);
  }

  const name = input.parameter_name;
  const value = input.value;
  const hint = bandHint(input);

  if (isBulkDensity(name)) {
    if (value > 1.65) {
      return `Bulk density is high (>1.65).${hint} Expect compaction, weaker roots, and slower infiltration — raise OM, cut axle load when wet, and confirm a plow pan before deep ripping.`;
    }
    if (value > 1.45) {
      return `Bulk density is moderately high (>1.45).${hint} Watch traffic timing on clayey soils; cover crops and residue help before density climbs further.`;
    }
    return `Bulk density is acceptable for many field soils.${hint}`;
  }

  if (isPH(name)) {
    if (level === "acidic" || level === "low") {
      return `Soil pH is acidic.${hint} Nutrient lock-up and Al risk rise — check V%/Ca sat and Al before liming; lime or gypsum only when those confirm the need.`;
    }
    if (level === "alkaline" || level === "high") {
      return `Soil pH is alkaline.${hint} P, Fe, Zn, Mn, and Cu often become less available — skip lime; if acidification is required, use elemental S carefully and match crop tolerance.`;
    }
    return `Soil pH is near the target band.${hint} No lime/S decision from pH alone.`;
  }

  if (isElectricalConductivity(name)) {
    if (level === "very_high") {
      return `EC is high (salinity risk).${hint} Plants struggle to take up water — check irrigation water EC, drainage, Na, and plan leaching before fertilizer salts add more load.`;
    }
    if (level === "high") {
      return `EC is elevated.${hint} Monitor salts after each irrigation cycle; verify drainage and Na before the next heavy fertilizer pass.`;
    }
    return `EC does not show major salinity risk on this reference.${hint}`;
  }

  if (isSodium(name)) {
    if (level === "very_high") {
      return `Exchangeable Na is highly sodic (>~2 cmol(+)/kg).${hint} Structure and infiltration can fail — prioritize gypsum requirement, drainage, and Ca status with EC/SAR context.`;
    }
    if (level === "high") {
      return `Exchangeable Na is problematic (>~1 cmol(+)/kg).${hint} Check EC, SAR/ESP, Ca, and drainage; gypsum may be needed before the soil seals.`;
    }
    if (level === "moderate") {
      return `Exchangeable Na is slightly elevated (0.5–1.0 cmol(+)/kg).${hint} Watch crusting on low-OM or poorly drained fields.`;
    }
    return `Exchangeable Na is in a safer range (<~0.5 cmol(+)/kg).${hint} No gypsum call from Na alone.`;
  }

  if (isAluminum(name)) {
    if (level === "high") {
      return `Aluminum is high.${hint} Root damage is likely in acid soils — confirm V%/pH; lime when base saturation is also low rather than liming from Al alone.`;
    }
    return `Aluminum is within the expected reference.${hint}`;
  }

  const nutrient = soilNutrientAdvice(input, level);
  if (nutrient) return nutrient;

  if (level === "low") {
    return `${input.parameter_name} is below the reference.${hint} Prioritize correcting this in the fertility plan if it is a yield-limiting nutrient for the crop stage.`;
  }
  if (level === "high") {
    return `${input.parameter_name} is above the reference.${hint} Hold additions of this nutrient; check for antagonism or salt contribution before the next application.`;
  }
  if (level === "very_high") {
    return `${input.parameter_name} is very high.${hint} Do not add more; investigate recent inputs, irrigation quality, or lab units if the jump is unexpected.`;
  }
  return `${input.parameter_name} is within the current reference.${hint}`;
}
