/**
 * Mini local catalog for irrigation / hydroponic water when the remote DB
 * does not yet have `parameters.water` or water ranges.
 *
 * Irrigation suitability bands follow EARTH Unidad 4 — Evaluación del agua
 * de riego (Prof. Diego Villaseñor Ortiz), severity table + Ayers & Westcot
 * EC guidance, with Vidal (2007) toxicity bands for Na / Cl / B.
 */

export type WaterCatalogMode = "irrigation" | "hydroponic" | "both";

export type WaterCatalogParameter = {
  parameter_id: number;
  parameter_name: string;
  symbol: string;
  category: string;
  unit_id: number;
  unit_symbol: string;
  mode: WaterCatalogMode;
  aliases?: string[];
};

export type WaterCatalogRange = {
  parameter_id: number;
  min: number;
  max: number;
  unit_symbol: string;
  source_name: string;
  note?: string;
};

const EARTH_SOURCE =
  "EARTH Unidad 4 — Villaseñor (agua de riego); Ayers & Westcot / Vidal";

/** High IDs avoid clashing with typical remote parameter_id values. */
export const LOCAL_WATER_PARAMETERS: WaterCatalogParameter[] = [
  // Irrigation water quality
  {
    parameter_id: 9101,
    parameter_name: "pH",
    symbol: "pH",
    category: "Irrigation water",
    unit_id: 1,
    unit_symbol: "—",
    mode: "irrigation",
    aliases: ["pH", "ph agua", "water pH"],
  },
  {
    parameter_id: 9102,
    parameter_name: "Electrical conductivity",
    symbol: "EC",
    category: "Irrigation water",
    unit_id: 1,
    unit_symbol: "dS/m",
    mode: "irrigation",
    aliases: ["EC", "CE", "Conductivity", "Conductividad eléctrica"],
  },
  {
    parameter_id: 9103,
    parameter_name: "SAR / RAS",
    symbol: "SAR",
    category: "Irrigation water",
    unit_id: 1,
    unit_symbol: "—",
    mode: "irrigation",
    aliases: ["SAR", "RAS", "Sodium Adsorption Ratio", "Relación de adsorción de sodio"],
  },
  {
    parameter_id: 9104,
    parameter_name: "Sodium",
    symbol: "Na",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["Na", "Sodium", "Sodio"],
  },
  {
    parameter_id: 9105,
    parameter_name: "Calcium",
    symbol: "Ca",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["Ca", "Calcium", "Calcio"],
  },
  {
    parameter_id: 9106,
    parameter_name: "Magnesium",
    symbol: "Mg",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["Mg", "Magnesium", "Magnesio"],
  },
  {
    parameter_id: 9107,
    parameter_name: "Potassium",
    symbol: "K",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["K", "Potassium", "Potasio"],
  },
  {
    parameter_id: 9108,
    parameter_name: "Chloride",
    symbol: "Cl",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["Cl", "Chloride", "Cloruro", "Cloro"],
  },
  {
    parameter_id: 9109,
    parameter_name: "Bicarbonate",
    symbol: "HCO3",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["HCO3", "Bicarbonate", "Bicarbonato", "Alkalinity", "Alcalinidad"],
  },
  {
    parameter_id: 9110,
    parameter_name: "Sulfate",
    symbol: "SO4",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["SO4", "Sulfate", "Sulfato"],
  },
  {
    parameter_id: 9111,
    parameter_name: "Boron",
    symbol: "B",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["B", "Boron", "Boro"],
  },
  {
    parameter_id: 9112,
    parameter_name: "Iron",
    symbol: "Fe",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["Fe", "Iron", "Fierro", "Hierro"],
  },
  {
    parameter_id: 9113,
    parameter_name: "Manganese",
    symbol: "Mn",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
  },
  {
    parameter_id: 9114,
    parameter_name: "Hardness (French °f)",
    symbol: "Hardness",
    category: "Irrigation water",
    unit_id: 1,
    unit_symbol: "°f",
    mode: "irrigation",
    aliases: ["Hardness", "Dureza", "°F", "Grados franceses"],
  },
  {
    parameter_id: 9115,
    parameter_name: "TDS / Total solids",
    symbol: "TDS",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["TDS", "Total Dissolved Solids", "Sólidos totales"],
  },
  {
    parameter_id: 9116,
    parameter_name: "Nitrate",
    symbol: "NO3",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["NO3", "Nitrate", "Nitrato", "NO3-N", "Nitrate-N"],
  },
  {
    parameter_id: 9117,
    parameter_name: "Carbonate",
    symbol: "CO3",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["CO3", "Carbonate", "Carbonato"],
  },
  {
    parameter_id: 9118,
    parameter_name: "Fluoride",
    symbol: "F",
    category: "Irrigation water",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "irrigation",
    aliases: ["F", "Fluoride", "Flúor", "Fluor"],
  },
  {
    parameter_id: 9119,
    parameter_name: "Kelly index",
    symbol: "Kelly",
    category: "Irrigation water",
    unit_id: 1,
    unit_symbol: "%",
    mode: "irrigation",
    aliases: ["Kelly", "Índice de Kelly", "I.K"],
  },

  // Hydroponic nutrient solution (general recipe targets)
  {
    parameter_id: 9120,
    parameter_name: "Solution pH",
    symbol: "pH-H",
    category: "Hydroponic solution",
    unit_id: 1,
    unit_symbol: "—",
    mode: "hydroponic",
  },
  {
    parameter_id: 9121,
    parameter_name: "Solution EC",
    symbol: "EC-H",
    category: "Hydroponic solution",
    unit_id: 1,
    unit_symbol: "dS/m",
    mode: "hydroponic",
  },
  {
    parameter_id: 9122,
    parameter_name: "Hydroponic N (NO3-N)",
    symbol: "NO3-N-H",
    category: "Hydroponic solution",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "hydroponic",
  },
  {
    parameter_id: 9123,
    parameter_name: "Hydroponic P",
    symbol: "P-H",
    category: "Hydroponic solution",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "hydroponic",
  },
  {
    parameter_id: 9124,
    parameter_name: "Hydroponic K",
    symbol: "K-H",
    category: "Hydroponic solution",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "hydroponic",
  },
  {
    parameter_id: 9125,
    parameter_name: "Hydroponic Ca",
    symbol: "Ca-H",
    category: "Hydroponic solution",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "hydroponic",
  },
  {
    parameter_id: 9126,
    parameter_name: "Hydroponic Mg",
    symbol: "Mg-H",
    category: "Hydroponic solution",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "hydroponic",
  },
  {
    parameter_id: 9127,
    parameter_name: "Hydroponic S",
    symbol: "S-H",
    category: "Hydroponic solution",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "hydroponic",
  },
  {
    parameter_id: 9128,
    parameter_name: "Hydroponic Fe",
    symbol: "Fe-H",
    category: "Hydroponic solution",
    unit_id: 2,
    unit_symbol: "mg/L",
    mode: "hydroponic",
  },
];

/**
 * Suitable (“Ninguna” severity) bands from lecture p.7, plus Ayers & Westcot
 * for EC and Vidal for Cl/B toxicity where noted.
 */
export const LOCAL_WATER_RANGES: WaterCatalogRange[] = [
  {
    parameter_id: 9101,
    min: 5.5,
    max: 7.0,
    unit_symbol: "—",
    source_name: EARTH_SOURCE,
    note: "Ninguna: 5.5–7.0. Moderada: <5.5 o >7.0. Alta: <4.5 o >8.0.",
  },
  {
    parameter_id: 9102,
    min: 0,
    max: 0.7,
    unit_symbol: "dS/m",
    source_name: EARTH_SOURCE,
    note: "Ayers & Westcot: ≤0.7 dS/m sin problema; 0.7–3 problema creciente; >3 grave. Sales ≈ CE×0.64 g/L.",
  },
  {
    parameter_id: 9103,
    min: 0,
    max: 3,
    unit_symbol: "—",
    source_name: EARTH_SOURCE,
    note: "RAS = Na / √((Ca+Mg)/2) en meq/L. Ninguna <3; moderada 3–6; alta >6.",
  },
  {
    parameter_id: 9104,
    min: 0,
    max: 70,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Toxicidad Na (Vidal): <70 ninguna; 70–180 moderada; >180 alta.",
  },
  {
    parameter_id: 9105,
    min: 20,
    max: 100,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Ninguna 20–100 ppm; moderada 100–200; alta >200.",
  },
  {
    parameter_id: 9106,
    min: 0,
    max: 63,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Ninguna <63 ppm; por encima: riesgo moderado/alto según tabla de severidad.",
  },
  {
    parameter_id: 9107,
    min: 0,
    max: 80,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Potasio suele ser bajo en aguas de riego; banda orientativa general.",
  },
  {
    parameter_id: 9108,
    min: 0,
    max: 68,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Toxicidad Cl (Vidal): <68 ninguna; 68–170 moderada; >170 alta. Tabla p.7: <70 / 70–300 / >300.",
  },
  {
    parameter_id: 9109,
    min: 0,
    max: 40,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Bicarbonatos: <40 ninguna; 40–180 moderada; >180 alta (emitter / alcalinidad).",
  },
  {
    parameter_id: 9110,
    min: 0,
    max: 200,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Sulfato — banda orientativa; verificar equilibrio iónico con cationes.",
  },
  {
    parameter_id: 9111,
    min: 0,
    max: 0.5,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Tabla p.7: <0.5 ninguna; 0.5–2 moderada; >2 alta. Vidal toxicidad: <0.7 / 0.7–3 / >3.",
  },
  {
    parameter_id: 9112,
    min: 0,
    max: 0.2,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Fierro: <0.2 ninguna; 0.2–0.4 moderada; >0.4 alta (obstrucción / manchas).",
  },
  {
    parameter_id: 9113,
    min: 0,
    max: 0.2,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Manganeso — banda orientativa para riego.",
  },
  {
    parameter_id: 9114,
    min: 0,
    max: 32,
    unit_symbol: "°f",
    source_name: EARTH_SOURCE,
    note: "Dureza °f = (Ca×2.5 + Mg×4.2)/10. Hasta media dura (≤32 °f) suele ser manejable.",
  },
  {
    parameter_id: 9115,
    min: 0,
    max: 480,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Sólidos totales: ninguna hasta ~480 ppm; moderada 480–1920; alta >1920.",
  },
  {
    parameter_id: 9116,
    min: 0,
    max: 50,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Nitrato (NO3) como aporte nutricional del agua; verificar conversión meq/L.",
  },
  {
    parameter_id: 9117,
    min: 0,
    max: 5,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Carbonatos CO3 — suelen ser ~0 a pH de riego típico; incluir en suma de aniones.",
  },
  {
    parameter_id: 9118,
    min: 0,
    max: 0.25,
    unit_symbol: "mg/L",
    source_name: EARTH_SOURCE,
    note: "Flúor: <0.25 ninguna; 0.25–1.0 moderada; >1.0 alta.",
  },
  {
    parameter_id: 9119,
    min: 35,
    max: 100,
    unit_symbol: "%",
    source_name: EARTH_SOURCE,
    note: "I.K. = Ca/(Ca+Mg+Na)×100 (mg/L). Kelly: >35% buenas para riego.",
  },
  {
    parameter_id: 9120,
    min: 5.5,
    max: 6.5,
    unit_symbol: "—",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9121,
    min: 1.2,
    max: 2.5,
    unit_symbol: "dS/m",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9122,
    min: 100,
    max: 200,
    unit_symbol: "mg/L",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9123,
    min: 30,
    max: 50,
    unit_symbol: "mg/L",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9124,
    min: 150,
    max: 300,
    unit_symbol: "mg/L",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9125,
    min: 100,
    max: 200,
    unit_symbol: "mg/L",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9126,
    min: 30,
    max: 70,
    unit_symbol: "mg/L",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9127,
    min: 50,
    max: 100,
    unit_symbol: "mg/L",
    source_name: "General hydroponic solution targets",
  },
  {
    parameter_id: 9128,
    min: 1,
    max: 3,
    unit_symbol: "mg/L",
    source_name: "General hydroponic solution targets",
  },
];

export function isWaterColumnMissingError(message: string | null | undefined) {
  const text = String(message || "").toLowerCase();
  return (
    text.includes("parameters.water") ||
    (text.includes("'water'") && text.includes("parameters")) ||
    (text.includes("water") &&
      text.includes("column") &&
      (text.includes("does not exist") ||
        text.includes("schema cache") ||
        text.includes("could not find")))
  );
}

export function listLocalWaterParameters(
  mode: "irrigation" | "hydroponic" = "irrigation"
): WaterCatalogParameter[] {
  return LOCAL_WATER_PARAMETERS.filter(
    (p) => p.mode === mode || p.mode === "both"
  );
}

export function getLocalWaterRange(
  parameterId: number | null | undefined
): WaterCatalogRange | null {
  if (parameterId == null) return null;
  return LOCAL_WATER_RANGES.find((r) => r.parameter_id === parameterId) || null;
}

export function localWaterRangeAsMatch(range: WaterCatalogRange, parameterName: string) {
  return {
    crop_id: 999,
    crop_name: "General",
    sample_type: "water",
    parameter_id: range.parameter_id,
    parameter_name: parameterName,
    unit_id: 0,
    unit_symbol: range.unit_symbol,
    min: range.min,
    max: range.max,
    confidence: "medium",
    is_proxy: true,
    source_name: range.source_name,
    interpretation_note: range.note || null,
  };
}
