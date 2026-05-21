import {
  extractLabIntelligently,
  type DocToken,
  type IntelligentExtractionResult,
} from "./intelligentLabExtractor";

export type ExtractionFixtureResult = {
  name: string;
  result: IntelligentExtractionResult;
  passed: boolean;
  messages: string[];
};

const omafraGroupedTable = [
  ["Sample #", "Organic Matter %", "pH", "Buffer pH", "Phosphorus P Olsen ppm", "Phosphorus P Mehlich ppm", "Potassium K ppm", "Magnesium Mg ppm", "Calcium Ca ppm", "CEC meq/100g", "Base Saturation K %", "Base Saturation Mg %", "Base Saturation Ca %", "Zinc Zn ppm", "Manganese Mn ppm", "Boron B ppm", "Copper Cu ppm", "Iron Fe ppm", "Aluminum Al ppm", "Sodium Na ppm", "Soluble Salts mS/cm", "Nitrate-N ppm", "Sulfur S ppm"],
  ["TF01", "3.2", "6.3", "7.2", "13", "63", "139", "129", "1530", "6.8", "3.9", "11.7", "83.6", "1.9", "19", "0.81", "2.6", "254", "734", "15", "0.3", "5", "22"],
  ["Notes", "L", "", "", "MR", "R", "M", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
  ["Recommendations (kg/ha)", "Crop", "Yield Goal", "Lime", "N", "P2O5", "K2O", "Mg", "Ca"],
  ["TF01", "Corn", "200 bu/ac", "0", "0", "20", "0", "", ""],
];

const eurofinsVerticalTable = [
  ["Farm Sampled", "Finca La Esperanza"],
  ["Field Name", "Norte 1"],
  ["Date Sampled", "2026-05-01"],
  ["Batch Number", "B-7788"],
  ["Lab Sample Number", "LS-9901"],
  ["Determination", "Result", "Units", "Target Value", "Status", "Method"],
  ["pH (H2O)", "4.28", "", "5.80 - 7.00", "Low", "Potentiometric"],
  ["Extractable Phosphorus", "24.0", "ppm", "20 - 100", "Optimum", "Spectroscopy"],
  ["Extractable Potassium", "154", "ppm", "121 - 608", "Optimum", "Spectroscopy"],
  ["Extractable Magnesium", "100", "ppm", "187 - 299", "Low", "Spectroscopy"],
  ["Extractable Calcium", "672", "ppm", "1870 - 2330", "Low", "Spectroscopy"],
  ["Organic Matter", "5.08", "%", "2.50 - 8.00", "Optimum", "Colorimetric"],
  ["Extractable Sodium", "83.7", "ppm", "<179", "Optimum", "Spectroscopy"],
  ["C.E.C.", "15.5", "meq/100g", "15.0 - 30.0", "Optimum", "Calculated"],
  ["Ca:Mg Ratio", "4.03", "", "4 - 7", "Optimum", ""],
  ["Lime Requirement", "1.2", "t/ha", "", "", ""],
  ["Chart axis", "0", "5", "10", "15", ""],
];

const denseUsMultiSampleTable = [
  ["Lab Number", "Sample Identification", "Organic Matter %", "OM Rate", "P Bray ppm", "P Rate", "K ppm", "K Rate", "Mg ppm", "Mg Rate", "Ca ppm", "pH Soil", "Buffer pH"],
  ["04962", "W IA 1", "2.8", "M", "18", "M", "139", "M", "343", "VH", "2438", "5.7", "6.6"],
  ["04963", "W IA 2", "2.0", "L", "10", "L", "188", "H", "478", "VH", "2274", "5.6", "6.5"],
  ["Page", "1", "", "", "", "", "", "", "", "", "", "", ""],
];

const spanishSectionedReport = [
  ["FERTILIDAD FISICA"],
  ["Parámetro", "Resultado", "Unidades", "Muy Bajo", "Bajo", "Normal", "Alto", "Muy Alto", "Método", "PNT"],
  ["Clase Textural", "Franca", "", "", "", "", "", "", "Densitometría", "PE-2127"],
  ["Arcilla", "26", "%", "", "", "", "", "", "Densitometría", "PE-2127"],
  ["Limo", "42", "%", "", "", "", "", "", "Densitometría", "PE-2127"],
  ["Arena", "32.0", "%", "", "", "", "", "", "Densitometría", "PE-2127"],
  ["FERTILIDAD"],
  ["Parámetro", "Resultado", "Unidades", "Muy Bajo", "Bajo", "Normal", "Alto", "Muy Alto", "Método", "PNT"],
  ["Cond. Eléctrica (Ext. 1/5)", "204", "µS/cm", "", "200", "", "400", "", "", "PE-2128"],
  ["pH (Extracto 1/2,5)", "5,80", "Unidades de pH", "", "6,50", "", "7,50", "", "", "PE-2128"],
  ["Materia Orgánica", "1,83", "%", "", "1,20", "", "2,00", "", "Combustión", "PE-2129"],
  ["Fósforo Disponible Olsen", "29,2", "mg/kg", "", "20,0", "", "40,0", "", "Olsen", "PE-2125"],
  ["MICROELEMENTOS"],
  ["Parámetro", "Resultado", "Unidades", "Muy Bajo", "Bajo", "Normal", "Alto", "Muy Alto", "Método", "PNT"],
  ["Boro", "0,92", "mg/kg", "", "0,60", "", "1,00", "", "Extract. Acuosa", "PE-2126"],
  ["Hierro (DTPA)", "109", "mg/kg", "", "4,00", "", "10,0", "", "DTPA", "PEC-009"],
];

const bananaWideLotTable = [
  ["MUESTREO DE SUELO DE LA BANANERA KOOPEMAZ"],
  ["MUESTRAS", "pH", "Acidez", "Ca", "Mg", "K", "CICE", "P", "Zn", "Fe", "Mn", "Cu", "B", "S"],
  ["", "Agua", "cmol(+)/kg", "cmol(+)/kg", "cmol(+)/kg", "cmol(+)/kg", "cmol(+)/kg", "ppm", "ppm", "ppm", "ppm", "ppm", "ppm", "ppm"],
  ["Cable 2", "4.7", "3.84", "12.37", "2.77", "1.99", "20.97", "92", "30", "518", "97", "8", "0.89", "59"],
  ["Cable 3", "4.3", "3.76", "12.20", "2.66", "2.14", "20.76", "81", "31", "513", "117", "17", "1.53", "62"],
  ["Promedio", "4.5", "3.42", "11.01", "2.78", "1.73", "18.94", "79", "24", "470", "89", "14", "0.76", "52"],
];

const agrilabScannedAiTable = [
  ["No. Reporte", "AGR-2026-111", "Cliente", "Finca La Esperanza", "Correo", "cliente@example.com"],
  ["No. Laboratorio", "LAB-7788", "Fecha recepción", "2026-05-10", "Cultivo", "Banano"],
  ["Lote/Bloque", "Norte 1", "Ubicación", "Matina"],
  ["Variable", "Expresión/Sigla", "Resultados", "Unidades", "Rango Medio", "Extractante/Técnica/Referencia"],
  ["pH", "pH H2O", "5.8", "", "5.5 - 7.0", "H2O"],
  ["Fósforo", "P", "12", "mg/kg", "10 - 20", "Olsen"],
  ["Potasio", "K", "0.35", "cmol(+)/kg", "0.2 - 0.4", "Acetato de amonio"],
  ["Calcio", "Ca", "6.1", "cmol(+)/kg", "4 - 8", "Acetato de amonio"],
  ["Arena", "Arena", "44", "%", "", "Textura"],
  ["Limo", "Limo", "25", "%", "", "Textura"],
  ["Arcilla", "Arcilla", "31", "%", "", "Textura"],
  ["Variable", "Sigla", "Resultados mg/kg", "Resultados meq/100g", "Unidades", "Rango Medio", "Referencia"],
  ["Calcio", "Ca", "992", "4.96", "mg/kg / meq/100g", "800-1600", "NH4OAc"],
];

const spatialAiTokens: DocToken[] = [
  token("RESULTADOS", 40, 30, 120, 20),
  token("Parametro", 50, 80, 120, 18),
  token("Resultado", 260, 80, 110, 18),
  token("Unidades", 390, 80, 100, 18),
  token("Fosforo Olsen", 52, 122, 135, 18),
  token("12", 282, 124, 28, 18),
  token("mg/kg", 396, 124, 64, 18),
  token("Rango Medio", 510, 80, 120, 18),
  token("10 - 20", 510, 124, 78, 18),
  token("Tel: 2222-2222", 45, 210, 150, 18),
  token("Pagina 1 de 2", 500, 710, 130, 18),
];

export function runIntelligentExtractorFixtureSuite(): ExtractionFixtureResult[] {
  return [
    checkFixture("OMAFRA grouped table", omafraGroupedTable, {
      required: ["ph", "organic_matter", "buffer_ph", "phosphorus_olsen", "phosphorus_mehlich", "potassium", "magnesium", "calcium", "cec", "base_saturation", "zinc", "manganese", "boron", "copper", "iron", "aluminum", "sodium", "soluble_salts", "nitrate", "sulfur"],
      forbiddenRaw: ["20", "P2O5"],
    }),
    checkFixture("Eurofins vertical table", eurofinsVerticalTable, {
      required: ["ph", "phosphorus", "potassium", "magnesium", "calcium", "organic_matter", "sodium", "cec", "ca_mg_ratio", "lime_requirement"],
      metadata: ["farmName", "lotName", "sampleId"],
    }),
    checkFixture("Dense US multi-sample table", denseUsMultiSampleTable, {
      required: ["organic_matter", "phosphorus_bray", "potassium", "magnesium", "calcium", "ph", "buffer_ph"],
      samples: ["W IA 1", "W IA 2"],
      forbiddenRaw: ["04962", "04963"],
    }),
    checkFixture("Spanish sectioned fertility report", spanishSectionedReport, {
      required: ["clay", "silt", "sand", "electrical_conductivity", "ph", "organic_matter", "phosphorus_olsen", "boron", "iron"],
    }),
    checkFixture("Banana wide lot table", bananaWideLotTable, {
      required: ["ph", "exchangeable_acidity", "calcium", "magnesium", "potassium", "cec", "phosphorus", "zinc", "iron", "manganese", "copper", "boron", "sulfur"],
      samples: ["Cable 2", "Cable 3"],
    }),
    checkFixture("AGRILAB scanned AI table", agrilabScannedAiTable, {
      required: ["ph", "phosphorus_olsen", "potassium", "calcium", "sand", "silt", "clay"],
      metadata: ["clientName", "cropName", "lotName", "sampleId"],
    }),
    checkDocTokenFixture("Spatial AI result table", spatialAiTokens, {
      required: ["phosphorus_olsen"],
      forbiddenRaw: ["10 - 20", "2222-2222"],
    }),
  ];
}

function checkFixture(
  name: string,
  input: string[][],
  expectations: {
    required: string[];
    samples?: string[];
    metadata?: string[];
    forbiddenRaw?: string[];
  }
): ExtractionFixtureResult {
  const result = extractLabIntelligently(input, { analysisType: "soil" });
  const params = new Set(result.values.map((value) => value.normalizedParameter).filter(Boolean));
  const messages: string[] = [];

  for (const required of expectations.required) {
    if (!params.has(required)) messages.push(`missing ${required}`);
  }

  for (const sample of expectations.samples || []) {
    if (!result.values.some((value) => value.sampleName === sample)) {
      messages.push(`missing sample ${sample}`);
    }
  }

  for (const metadataField of expectations.metadata || []) {
    const metadata = result.metadata as unknown as Record<string, unknown>;
    if (!metadata[metadataField]) messages.push(`missing metadata ${metadataField}`);
  }

  for (const raw of expectations.forbiddenRaw || []) {
    if (result.values.some((value) => value.originalValueRaw === raw)) {
      messages.push(`forbidden raw value imported ${raw}`);
    }
  }

  return {
    name,
    result,
    passed: messages.length === 0,
    messages,
  };
}

function checkDocTokenFixture(
  name: string,
  input: DocToken[],
  expectations: {
    required: string[];
    forbiddenRaw?: string[];
  }
): ExtractionFixtureResult {
  const result = extractLabIntelligently(input, { analysisType: "soil" });
  const params = new Set(result.values.map((value) => value.normalizedParameter).filter(Boolean));
  const messages: string[] = [];

  for (const required of expectations.required) {
    if (!params.has(required)) messages.push(`missing ${required}`);
  }

  for (const raw of expectations.forbiddenRaw || []) {
    if (result.values.some((value) => value.originalValueRaw.includes(raw))) {
      messages.push(`forbidden raw value imported ${raw}`);
    }
  }

  return {
    name,
    result,
    passed: messages.length === 0,
    messages,
  };
}

function token(rawText: string, x: number, y: number, width: number, height: number): DocToken {
  return {
    id: `ai-${rawText}-${x}-${y}`,
    rawText,
    normalizedText: rawText.toLowerCase(),
    tokenType: "unknown",
    bbox: { x, y, width, height },
    confidence: 0.92,
  };
}

