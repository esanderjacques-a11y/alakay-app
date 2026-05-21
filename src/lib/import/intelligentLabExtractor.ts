export type AnalysisType = "soil" | "foliar" | "mixed" | "unknown";

export type LabReportLayoutFamily =
  | "grouped_header_table"
  | "vertical_result_table"
  | "dense_multi_sample_wide_table"
  | "sectioned_spanish_report"
  | "wide_multi_lot_table"
  | "scanned_pdf_ai_table"
  | "unknown";

export type TokenType =
  | "unknown"
  | "parameter"
  | "value"
  | "unit"
  | "method"
  | "metadata_label"
  | "metadata_value"
  | "sample_label"
  | "section_title"
  | "interpretation"
  | "reference_range"
  | "noise";

export type ValueKind =
  | "numeric"
  | "range"
  | "less_than"
  | "greater_than"
  | "text_category"
  | "not_detected"
  | "trace"
  | "missing"
  | "unknown";

export interface DocToken {
  id: string;
  rawText: string;
  normalizedText: string;
  tokenType: TokenType;
  pageNumber?: number;
  sheetName?: string;
  rowIndex?: number;
  columnIndex?: number;
  bbox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence?: number;
}

export interface DocumentContext {
  analysisType: AnalysisType;
  activeSection?: AnalysisType;
  sheetName?: string;
  pageNumber?: number;
  layoutFamily?: LabReportLayoutFamily;
}

export interface ParsedValue {
  raw: string;
  kind: ValueKind;
  numberValue?: number;
  minValue?: number;
  maxValue?: number;
  flags: string[];
}

export interface CandidateValue {
  parameterToken: DocToken;
  valueToken: DocToken;
  unitToken?: DocToken;
  methodToken?: DocToken;
  sampleToken?: DocToken;
  score: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
  warnings: string[];
}

export interface ExtractedLabValue {
  originalLabel: string;
  normalizedParameter: string | null;
  originalValueRaw: string;
  valueKind: ValueKind;
  originalValueNumber?: number;
  normalizedValueNumber?: number;
  originalUnit?: string;
  normalizedUnit?: string;
  analysisType: AnalysisType;
  extractionMethod?: string;
  sampleName?: string;
  confidence: "high" | "medium" | "low";
  confidenceScore?: number;
  layoutFamily?: LabReportLayoutFamily;
  parameterGroup?: string;
  interpretation?: string;
  referenceRange?: string;
  metadata?: ExtractedMetadata;
  flags: string[];
  reasons: string[];
  source: {
    pageNumber?: number;
    sheetName?: string;
    rowIndex?: number;
    columnIndex?: number;
    bbox?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export interface ExtractedMetadata {
  labName?: string;
  farmName?: string;
  lotName?: string;
  sampleName?: string;
  sampleId?: string;
  cropName?: string;
  clientName?: string;
  reportDate?: string;
  receptionDate?: string;
  analysisType?: AnalysisType;
  confidence: Record<string, "high" | "medium" | "low">;
}

export interface IntelligentExtractionResult {
  metadata: ExtractedMetadata;
  values: ExtractedLabValue[];
  warnings: string[];
  rawTokens: DocToken[];
  layoutFamily?: LabReportLayoutFamily;
}

type InternalToken = DocToken & {
  lineText?: string;
};

type ParameterAlias = {
  normalizedParameter: string;
  aliases: string[];
  analysisTypes: AnalysisType[];
  preferredUnits?: string[];
  expectedRange?: [number, number];
};

type NearbyOptions = {
  maxRowDistance?: number;
  maxColumnDistance?: number;
  includeSameToken?: boolean;
};

type HeaderMapEntry = {
  columnIndex: number;
  label: string;
  normalizedParameter: string | null;
  unit?: string;
  method?: string;
  group?: string;
  isResultColumn?: boolean;
  isUnitColumn?: boolean;
  isMethodColumn?: boolean;
  isReferenceColumn?: boolean;
  isRatingColumn?: boolean;
  isSampleColumn?: boolean;
};

const PARAMETER_ALIASES: ParameterAlias[] = [
  parameter("nitrogen", ["N", "Nitrogen", "Nitrógeno", "Azote"], ["soil", "foliar"], ["%", "mg/kg", "ppm"]),
  parameter("total_nitrogen", ["N total", "total nitrogen"], ["soil", "foliar"], ["%"]),
  parameter("nitrate", ["NO3", "N-NO3", "nitrate"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("ammonium", ["NH4", "N-NH4", "ammonium"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("phosphorus", ["P", "Phosphorus", "Fósforo", "Fosforo", "Phosphore"], ["soil", "foliar"], ["mg/kg", "ppm", "%"]),
  parameter("phosphorus_olsen", ["P Olsen"], ["soil"], ["mg/kg", "ppm"]),
  parameter("phosphorus_bray", ["P Bray"], ["soil"], ["mg/kg", "ppm"]),
  parameter("phosphorus_mehlich", ["P Mehlich"], ["soil"], ["mg/kg", "ppm"]),
  parameter("buffer_ph", ["buffer pH", "buffer index"], ["soil"]),
  parameter("potassium", ["K", "Potassium", "Potasio"], ["soil", "foliar"], ["cmol(+)/kg", "cmolc/kg", "meq/100g", "mg/kg", "ppm", "%"]),
  parameter("calcium", ["Ca", "Calcium", "Calcio"], ["soil", "foliar"], ["cmol(+)/kg", "cmolc/kg", "meq/100g", "mg/kg", "ppm", "%"]),
  parameter("magnesium", ["Mg", "Magnesium", "Magnesio", "Magnésium"], ["soil", "foliar"], ["cmol(+)/kg", "cmolc/kg", "meq/100g", "mg/kg", "ppm", "%"]),
  parameter("sulfur", ["S", "Sulfur", "Azufre", "Soufre"], ["soil", "foliar"], ["mg/kg", "ppm", "%"]),
  parameter("iron", ["Fe", "Iron", "Hierro", "Fer", "Hierro DTPA"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("zinc", ["Zn", "Zinc"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("manganese", ["Mn", "Manganese", "Manganeso"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("copper", ["Cu", "Copper", "Cobre", "Cuivre"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("boron", ["B", "Boron", "Boro", "Bore"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("molybdenum", ["Mo", "Molybdenum", "Molibdeno"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("chloride", ["Cl", "Chloride", "Cloruro"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("sodium", ["Na", "Sodium", "Sodio"], ["soil", "foliar"], ["cmol(+)/kg", "mg/kg", "ppm"]),
  parameter("aluminum", ["Al", "Aluminum", "Aluminio", "Aluminium"], ["soil"], ["mg/kg", "ppm", "cmol(+)/kg", "meq/100g"]),
  parameter("soluble_salts", ["soluble salts", "sales solubles"], ["soil"], ["dS/m", "mS/cm", "µS/cm"]),
  parameter("lime_requirement", ["lime requirement", "lime", "cal requirement", "encalado"], ["soil"]),
  parameter("ca_mg_ratio", ["Ca:Mg ratio", "K:Mg ratio"], ["soil"]),
  parameter("silicon", ["Si", "Silicon", "Silicio"], ["soil", "foliar"], ["mg/kg", "ppm"]),
  parameter("ph", ["pH", "pH H2O", "pH KCl"], ["soil"], undefined, [0, 14]),
  parameter("organic_matter", ["MO", "M.O.", "OM", "Organic Matter", "Materia Orgánica", "Matière organique"], ["soil"], ["%"]),
  parameter("cec", ["CEC", "C.E.C.", "CIC", "CICE", "cation exchange capacity"], ["soil"], ["cmol(+)/kg", "cmolc/kg", "meq/100g"]),
  parameter("electrical_conductivity", ["CE", "EC", "electrical conductivity", "conductividad eléctrica", "Cond. Eléctrica", "conductividad electrica"], ["soil"], ["dS/m", "mS/cm", "µS/cm"]),
  parameter("texture", ["texture", "textura"], ["soil"]),
  parameter("sand", ["sand", "arena", "sable"], ["soil"], ["%"]),
  parameter("silt", ["silt", "limo", "limon"], ["soil"], ["%"]),
  parameter("clay", ["clay", "arcilla", "argile"], ["soil"], ["%"]),
  parameter("bulk_density", ["bulk density", "densidad aparente", "Da", "BD"], ["soil"]),
  parameter("exchangeable_acidity", ["exchangeable acidity", "acidez intercambiable", "acidez", "Acd. Interc.", "H+Al"], ["soil"], ["cmol(+)/kg", "cmolc/kg", "meq/100g"]),
  parameter("base_saturation", ["base saturation", "saturación de bases"], ["soil"], ["%"]),
  parameter("foliar_nitrogen", ["foliar N", "leaf N", "tissue N"], ["foliar"], ["%"]),
  parameter("dry_matter", ["dry matter", "materia seca"], ["foliar"], ["%"]),
  parameter("leaf_tissue", ["leaf tissue", "tejido foliar", "hoja"], ["foliar"]),
];

const METADATA_LABELS = new Map<string, keyof Omit<ExtractedMetadata, "confidence">>([
  ["laboratorio", "labName"],
  ["laboratory", "labName"],
  ["lab", "labName"],
  ["cliente", "clientName"],
  ["client", "clientName"],
  ["productor", "clientName"],
  ["producer", "clientName"],
  ["finca", "farmName"],
  ["farm", "farmName"],
  ["farm sampled", "farmName"],
  ["parcela", "lotName"],
  ["field", "lotName"],
  ["field name", "lotName"],
  ["lote", "lotName"],
  ["lot", "lotName"],
  ["lote bloque", "lotName"],
  ["bloque", "lotName"],
  ["muestra", "sampleName"],
  ["sample", "sampleName"],
  ["sample id", "sampleId"],
  ["lab sample number", "sampleId"],
  ["lab number", "sampleId"],
  ["batch number", "sampleId"],
  ["no laboratorio", "sampleId"],
  ["no reporte", "sampleId"],
  ["codigo de muestra", "sampleId"],
  ["fecha", "reportDate"],
  ["date", "reportDate"],
  ["report date", "reportDate"],
  ["fecha de recepcion", "receptionDate"],
  ["reception date", "receptionDate"],
  ["cultivo", "cropName"],
  ["crop", "cropName"],
  ["culture", "cropName"],
  ["tipo de muestra", "analysisType"],
  ["sample type", "analysisType"],
]);

const RESULT_ZONE_KEYWORDS = [
  "results",
  "resultado",
  "resultados",
  "analysis results",
  "analisis quimico",
  "analisis de suelo",
  "analisis foliar",
  "soil analysis",
  "foliar analysis",
  "determinaciones",
  "parametros",
  "nutrientes",
  "concentracion",
  "variable",
  "determinacion",
  "determination",
];

const REFERENCE_ZONE_KEYWORDS = [
  "rango",
  "range",
  "reference",
  "referencia",
  "nivel critico",
  "critical level",
  "optimum",
  "optimo",
  "bajo",
  "medio",
  "alto",
  "low",
  "medium",
  "high",
  "sufficient",
  "deficient",
  "excessive",
  "target value",
  "guide low",
  "guide high",
  "rango medio",
  "pnt",
];

const RECOMMENDATION_KEYWORDS = [
  "recommendation",
  "recommendations",
  "recomendacion",
  "recomendaciones",
  "fertilizer",
  "fertilizante",
  "kg/ha",
  "kg ha",
  "p2o5",
  "k2o",
  "cal agricola",
];

const METHOD_ALIASES = [
  "olsen",
  "bray",
  "mehlich",
  "kcl",
  "h2o",
  "dtpa",
  "kelowna",
  "ammonium acetate",
  "acetato de amonio",
  "walkley black",
  "combustion",
  "kjeldahl",
  "icp",
];

const UNIT_ALIASES: Array<{ aliases: string[]; normalizedUnit: string }> = [
  { aliases: ["%"], normalizedUnit: "%" },
  { aliases: ["ppm"], normalizedUnit: "ppm" },
  { aliases: ["mg/kg", "mg kg-1", "mg.kg-1", "mg kg^-1"], normalizedUnit: "mg/kg" },
  { aliases: ["g/kg", "g kg-1", "g.kg-1", "g kg^-1"], normalizedUnit: "g/kg" },
  { aliases: ["cmol(+)/kg", "cmolc/kg", "cmol/kg"], normalizedUnit: "cmol(+)/kg" },
  { aliases: ["meq/100g", "meq 100g-1"], normalizedUnit: "meq/100g" },
  { aliases: ["ds/m", "dS/m"], normalizedUnit: "dS/m" },
  { aliases: ["ms/cm", "mS/cm"], normalizedUnit: "mS/cm" },
  { aliases: ["µs/cm", "us/cm", "uS/cm"], normalizedUnit: "µS/cm" },
];

function parameter(
  normalizedParameter: string,
  aliases: string[],
  analysisTypes: AnalysisType[],
  preferredUnits?: string[],
  expectedRange?: [number, number]
): ParameterAlias {
  return {
    normalizedParameter,
    aliases,
    analysisTypes,
    preferredUnits,
    expectedRange,
  };
}

function normalizeForMatching(rawText: string) {
  return rawText
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()[\]{}/]/g, " ")
    .replace(/[._:;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenId(prefix: string, rowIndex: number, columnIndex: number) {
  return `${prefix}-${rowIndex}-${columnIndex}`;
}

function makeToken(
  rawText: string,
  rowIndex: number,
  columnIndex: number,
  context?: Partial<DocumentContext>,
  lineText?: string
): InternalToken {
  return {
    id: tokenId(context?.sheetName || "doc", rowIndex, columnIndex),
    rawText: rawText.trim(),
    normalizedText: normalizeForMatching(rawText),
    tokenType: "unknown",
    rowIndex,
    columnIndex,
    pageNumber: context?.pageNumber,
    sheetName: context?.sheetName,
    lineText,
  };
}

export function normalizeInputToTokens(
  input: string | string[][] | DocToken[]
): DocToken[] {
  if (Array.isArray(input) && input.every(isDocToken)) {
    const normalizedTokens = input.map((token, index) => ({
      ...token,
      id: token.id || `input-${index}`,
      normalizedText: token.normalizedText || normalizeForMatching(token.rawText),
      tokenType: token.tokenType || "unknown",
    }));

    if (
      normalizedTokens.some((token) => token.bbox) &&
      normalizedTokens.some((token) => token.rowIndex === undefined || token.columnIndex === undefined)
    ) {
      return assignRowsAndColumnsFromBboxes(normalizedTokens);
    }

    return normalizedTokens;
  }

  if (Array.isArray(input)) {
    const tokens: DocToken[] = [];
    input.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (!cell?.trim()) return;
        tokens.push(makeToken(cell, rowIndex, columnIndex));
      });
    });
    return tokens;
  }

  const tokens: DocToken[] = [];
  input.split(/\r?\n/).forEach((line, rowIndex) => {
    const cleanLine = line.trim();
    if (!cleanLine) return;

    const colonMatch = cleanLine.match(/^([^:]{2,42}):\s*(.+)$/);
    if (colonMatch) {
      tokens.push(makeToken(colonMatch[1], rowIndex, 0, undefined, cleanLine));
      tokens.push(makeToken(colonMatch[2], rowIndex, 1, undefined, cleanLine));
      return;
    }

    if (/[|\t]/.test(cleanLine)) {
      cleanLine
        .split(/[|\t]/)
        .map((cell) => cell.trim())
        .filter(Boolean)
        .forEach((cell, columnIndex) => {
          tokens.push(makeToken(cell, rowIndex, columnIndex, undefined, cleanLine));
        });
      return;
    }

    const rowParts = splitResultLine(cleanLine);
    rowParts.forEach((part, columnIndex) => {
      tokens.push(makeToken(part, rowIndex, columnIndex, undefined, cleanLine));
    });
  });

  return tokens;
}

function assignRowsAndColumnsFromBboxes(tokens: DocToken[]) {
  const tokensWithBoxes = tokens.filter((token) => token.bbox);
  const tokensWithoutBoxes = tokens.filter((token) => !token.bbox);

  type SpatialRow = {
    pageNumber: number;
    centerY: number;
    averageHeight: number;
    tokens: DocToken[];
  };

  const rows: SpatialRow[] = [];
  const sorted = [...tokensWithBoxes].sort((left, right) => {
    const pageDiff = (left.pageNumber ?? 1) - (right.pageNumber ?? 1);
    if (pageDiff !== 0) return pageDiff;
    const yDiff = (left.bbox?.y ?? 0) - (right.bbox?.y ?? 0);
    if (Math.abs(yDiff) > 2) return yDiff;
    return (left.bbox?.x ?? 0) - (right.bbox?.x ?? 0);
  });

  for (const token of sorted) {
    if (!token.bbox) continue;
    const pageNumber = token.pageNumber ?? 1;
    const centerY = token.bbox.y + token.bbox.height / 2;
    const threshold = Math.max(8, Math.min(26, token.bbox.height * 0.75));
    const row = rows.find(
      (candidate) =>
        candidate.pageNumber === pageNumber &&
        Math.abs(candidate.centerY - centerY) <= Math.max(threshold, candidate.averageHeight * 0.75)
    );

    if (row) {
      row.tokens.push(token);
      row.centerY =
        row.tokens.reduce(
          (sum, item) => sum + ((item.bbox?.y ?? 0) + (item.bbox?.height ?? 0) / 2),
          0
        ) / row.tokens.length;
      row.averageHeight =
        row.tokens.reduce((sum, item) => sum + (item.bbox?.height ?? 0), 0) / row.tokens.length;
      continue;
    }

    rows.push({
      pageNumber,
      centerY,
      averageHeight: token.bbox.height,
      tokens: [token],
    });
  }

  const spatialTokens = rows
    .sort((left, right) => {
      const pageDiff = left.pageNumber - right.pageNumber;
      if (pageDiff !== 0) return pageDiff;
      return left.centerY - right.centerY;
    })
    .flatMap((row, rowIndex) => {
      const rowTokens = [...row.tokens].sort((left, right) => (left.bbox?.x ?? 0) - (right.bbox?.x ?? 0));
      const lineText = rowTokens.map((token) => token.rawText).join(" ");

      return rowTokens.map((token, columnIndex) => ({
        ...token,
        rowIndex: token.rowIndex ?? rowIndex,
        columnIndex: token.columnIndex ?? columnIndex,
        lineText,
      }));
    });

  return [
    ...spatialTokens,
    ...tokensWithoutBoxes.map((token, index) => ({
      ...token,
      rowIndex: token.rowIndex ?? spatialTokens.length + index,
      columnIndex: token.columnIndex ?? 0,
    })),
  ];
}

export function classifyToken(
  token: DocToken,
  allTokens: DocToken[],
  context?: Partial<DocumentContext>
): DocToken {
  const nextToken = { ...token };
  const nearbyTokens = findNearbyTokens(token, allTokens, {
    maxRowDistance: 1,
    maxColumnDistance: 2,
  });

  if (isNoiseToken(token, context)) {
    nextToken.tokenType = "noise";
    return nextToken;
  }

  if (isMetadataLabel(token)) {
    nextToken.tokenType = "metadata_label";
    return nextToken;
  }

  if (isMetadataValue(token, allTokens)) {
    nextToken.tokenType = "metadata_value";
    return nextToken;
  }

  if (isSectionTitle(token)) {
    nextToken.tokenType = "section_title";
    return nextToken;
  }

  if (isReferenceRangeText(token.rawText)) {
    nextToken.tokenType = "reference_range";
    return nextToken;
  }

  if (isInterpretationText(token.rawText)) {
    nextToken.tokenType = "interpretation";
    return nextToken;
  }

  const unitDetection = detectUnit(token.rawText);
  const startsWithUnit =
    unitDetection.originalUnit &&
    token.rawText.trim().toLowerCase().startsWith(unitDetection.originalUnit.toLowerCase());
  if (unitDetection.normalizedUnit && startsWithUnit) {
    nextToken.tokenType = "unit";
    return nextToken;
  }

  if (normalizeParameterName(token.rawText, context).normalizedParameter) {
    nextToken.tokenType = "parameter";
    return nextToken;
  }

  if (detectExtractionMethod(token, nearbyTokens).method) {
    nextToken.tokenType = "method";
    return nextToken;
  }

  if (unitDetection.normalizedUnit && parseNumericValue(token.rawText).kind === "unknown") {
    nextToken.tokenType = "unit";
    return nextToken;
  }

  const value = parseNumericValue(token.rawText);
  if (value.kind !== "unknown" && value.kind !== "missing") {
    nextToken.tokenType = "value";
    return nextToken;
  }

  if (isSampleLabel(token)) {
    nextToken.tokenType = "sample_label";
    return nextToken;
  }

  nextToken.tokenType = "unknown";
  return nextToken;
}

export function isNoiseToken(
  token: DocToken,
  context?: Partial<DocumentContext>
): boolean {
  void context;
  const text = token.rawText.trim();
  const normalized = token.normalizedText || normalizeForMatching(text);

  if (!text) return true;
  if (/^[^\w%<>.,+-]+$/.test(text)) return true;
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) return true;
  if (/\bhttps?:\/\/|www\./i.test(text)) return true;
  if (/\b(?:tel|phone|telefono|fax)\b/i.test(text)) return true;
  if (/\b\d{3,4}[-\s]\d{3,4}(?:[-\s]\d{3,4})?\b/.test(text)) return true;
  if (/\bpage\s*\d+\s*(?:of|de)\s*\d+\b/i.test(text)) return true;
  if (/\bpagina\s*\d+\s*(?:de)?\s*\d*\b/i.test(normalized)) return true;
  if (/\b(invoice|factura|payment|pago|subtotal|total due|signature|firma)\b/i.test(normalized)) return true;
  if (/\b(iso|accredit|acredit|confidential|legal|terms|barcode|qr)\b/i.test(normalized)) return true;
  if (/\b(avenida|calle|street|road|suite|postal|zipcode|codigo postal)\b/i.test(normalized)) return true;
  if (/^\d+$/.test(text) && Number(text) <= 20 && /page|pagina/.test(normalized)) return true;

  return false;
}

export function parseNumericValue(rawText: string): ParsedValue {
  const raw = rawText.trim();
  const normalized = normalizeForMatching(raw);
  const flags: string[] = [];

  if (!raw) return { raw, kind: "missing", flags: ["empty value"] };
  if (/^(?:nd|n\.d\.|not detected|no detectado)$/i.test(raw)) {
    return { raw, kind: "not_detected", flags };
  }
  if (/^(?:trace|trazas|traces?)$/i.test(normalized)) {
    return { raw, kind: "trace", flags };
  }
  if (looksLikeDate(raw)) {
    return { raw, kind: "unknown", flags: ["looks like date"] };
  }
  if (looksLikePhoneNumber(raw)) {
    return { raw, kind: "unknown", flags: ["looks like phone number"] };
  }

  const cleanRaw = raw.replace(/\s*%\s*$/, "").trim();
  const lessThan = cleanRaw.match(/^<\s*([+-]?\d[\d.,]*)$/);
  if (lessThan) {
    return {
      raw,
      kind: "less_than",
      numberValue: parseLocalizedNumber(lessThan[1]),
      flags,
    };
  }

  const greaterThan = cleanRaw.match(/^>\s*([+-]?\d[\d.,]*)$/);
  if (greaterThan) {
    return {
      raw,
      kind: "greater_than",
      numberValue: parseLocalizedNumber(greaterThan[1]),
      flags,
    };
  }

  const range = cleanRaw.match(/^([+-]?\d[\d.,]*)\s*(?:-|–|—|to|a)\s*([+-]?\d[\d.,]*)$/i);
  if (range) {
    return {
      raw,
      kind: "range",
      minValue: parseLocalizedNumber(range[1]),
      maxValue: parseLocalizedNumber(range[2]),
      flags,
    };
  }

  const numeric = cleanRaw.match(/[+-]?\d[\d.,]*/);
  if (numeric) {
    return {
      raw,
      kind: "numeric",
      numberValue: parseLocalizedNumber(numeric[0]),
      flags,
    };
  }

  if (/^(low|medium|high|bajo|medio|alto|optimal|optimo|deficient|sufficient|excessive)$/i.test(normalized)) {
    return { raw, kind: "text_category", flags };
  }

  return { raw, kind: "unknown", flags };
}

export function normalizeParameterName(
  rawText: string,
  context?: Partial<DocumentContext>
): {
  normalizedParameter: string | null;
  confidence: number;
  flags: string[];
} {
  const normalizedRaw = normalizeParameterCandidateText(rawText);
  const flags: string[] = [];
  let best: { parameter: ParameterAlias; score: number; exact: boolean } | null = null;

  const methodSpecific = detectMethodSpecificParameter(normalizedRaw);
  if (methodSpecific) {
    return {
      normalizedParameter: methodSpecific,
      confidence: 1,
      flags,
    };
  }

  for (const parameterAlias of PARAMETER_ALIASES) {
    if (
      context?.analysisType &&
      context.analysisType !== "mixed" &&
      context.analysisType !== "unknown" &&
      !parameterAlias.analysisTypes.includes(context.analysisType)
    ) {
      continue;
    }

    for (const alias of parameterAlias.aliases) {
      const normalizedAlias = normalizeForMatching(alias);
      const score = parameterMatchScore(normalizedRaw, normalizedAlias);
      const betterContextFit =
        best &&
        score === best.score &&
        context?.analysisType &&
        parameterAlias.analysisTypes.includes(context.analysisType) &&
        !best.parameter.analysisTypes.every((type) => type === context.analysisType);

      if (!best || score > best.score || betterContextFit) {
        best = {
          parameter: parameterAlias,
          score,
          exact: normalizedRaw === normalizedAlias,
        };
      }
    }
  }

  if (!best || best.score < 0.58) {
    return { normalizedParameter: null, confidence: 0, flags };
  }

  if (!best.exact) flags.push("parameter alias fuzzy match");
  if (best.score < 0.78) flags.push("ambiguous parameter");

  return {
    normalizedParameter: best.parameter.normalizedParameter,
    confidence: best.score,
    flags,
  };
}

export function detectUnit(rawText: string): {
  originalUnit?: string;
  normalizedUnit?: string;
  confidence: number;
} {
  const normalized = rawText.toLowerCase().replace(/\s+/g, " ").trim();

  for (const unit of UNIT_ALIASES) {
    for (const alias of unit.aliases) {
      const aliasText = alias.toLowerCase();
      if (normalized === aliasText || normalized.includes(aliasText)) {
        return {
          originalUnit: alias,
          normalizedUnit: unit.normalizedUnit,
          confidence: normalized === aliasText ? 1 : 0.85,
        };
      }
    }
  }

  return { confidence: 0 };
}

export function detectExtractionMethod(
  token: DocToken,
  nearbyTokens: DocToken[]
): {
  method?: string;
  confidence: number;
} {
  const combined = [token, ...nearbyTokens]
    .map((item) => item.normalizedText || normalizeForMatching(item.rawText))
    .join(" ");

  const method = METHOD_ALIASES.find((alias) =>
    combined.includes(normalizeForMatching(alias))
  );

  return method ? { method, confidence: 0.86 } : { confidence: 0 };
}

export function extractMetadata(
  tokens: DocToken[],
  context?: Partial<DocumentContext>
): ExtractedMetadata {
  const metadata: ExtractedMetadata = {
    analysisType: context?.analysisType || detectAnalysisType(tokens),
    confidence: {},
  };
  const sorted = sortTokens(tokens);

  for (let index = 0; index < sorted.length; index += 1) {
    const token = sorted[index];
    if (token.tokenType !== "metadata_label" && !isMetadataLabel(token)) continue;

    const field = METADATA_LABELS.get(token.normalizedText);
    if (!field) continue;

    const valueToken = findMetadataValueForLabel(token, sorted);
    if (!valueToken) continue;
    if (field === "sampleName" && valueToken.tokenType === "parameter") continue;

    if (field === "analysisType") {
      metadata.analysisType = detectAnalysisType([valueToken]);
      metadata.confidence.analysisType = "medium";
      continue;
    }

    const cleanedValue = cleanMetadataValue(valueToken.rawText);
    if (!cleanedValue) continue;

    metadata[field] = cleanedValue;
    metadata.confidence[field] = token.columnIndex !== valueToken.columnIndex ? "high" : "medium";
  }

  const firstLabLike = sorted.find((token) => {
    const text = token.rawText.trim();
    return (
      (token.rowIndex ?? 999) <= 2 &&
      !isNoiseToken(token) &&
      /^[A-ZÁÉÍÓÚÑ0-9 .&-]{6,}$/.test(text) &&
      /lab|agro|soil|anal/i.test(text)
    );
  });

  if (!metadata.labName && firstLabLike) {
    metadata.labName = cleanMetadataValue(firstLabLike.rawText);
    metadata.confidence.labName = "medium";
  }

  return metadata;
}

export function detectAnalysisType(tokens: DocToken[]): AnalysisType {
  let soilScore = 0;
  let foliarScore = 0;

  for (const token of tokens) {
    const text = token.normalizedText || normalizeForMatching(token.rawText);
    if (/\b(soil|suelo|terre|tierra|ph|organic matter|materia organica|cec|cic|textura|texture)\b/.test(text)) {
      soilScore += 2;
    }
    if (/\b(foliar|leaf|hoja|tissue|tejido|feuille)\b/.test(text)) {
      foliarScore += 2;
    }

    const parameterMatch = normalizeParameterName(token.rawText).normalizedParameter;
    const alias = PARAMETER_ALIASES.find((item) => item.normalizedParameter === parameterMatch);
    if (alias?.analysisTypes.includes("soil") && !alias.analysisTypes.includes("foliar")) soilScore += 1;
    if (alias?.analysisTypes.includes("foliar") && !alias.analysisTypes.includes("soil")) foliarScore += 1;
  }

  if (soilScore >= 2 && foliarScore >= 2) return "mixed";
  if (soilScore >= 2) return "soil";
  if (foliarScore >= 2) return "foliar";
  return "unknown";
}

export function detectLabReportLayout(tokens: DocToken[]): LabReportLayoutFamily {
  const rows = groupTokensByRow(tokens);
  const allText = tokens.map((token) => token.normalizedText).join(" ");
  const headerTexts = rows
    .slice(0, 12)
    .flatMap((row) => row.map((token) => token.normalizedText));
  const hasTextCoordinates = tokens.some((token) => token.bbox);

  if (
    /variable.*expresion|expresion.*resultados|extractante|tecnica|rango medio/.test(allText) ||
    (hasTextCoordinates && /resultados|variable|unidades/.test(allText))
  ) {
    return "scanned_pdf_ai_table";
  }

  if (
    /fertilidad fisica|microelementos|complejo de cambio|muy bajo|muy alto|parametro resultado unidades metodo/.test(allText)
  ) {
    return "sectioned_spanish_report";
  }

  if (
    /determinacion|determination|target value|status|current/.test(allText) &&
    headerTexts.some((text) => /result|resultado/.test(text))
  ) {
    return "vertical_result_table";
  }

  if (
    /lotes/.test(allText) &&
    /parametro/.test(allText) &&
    /unidad/.test(allText) &&
    /\bmin\b|\bmax\b/.test(allText)
  ) {
    return "wide_multi_lot_table";
  }

  if (
    headerTexts.some((text) => /sample|muestra|lote|lotes|cable/.test(text)) &&
    rows.some((row) => row.length >= 8) &&
    rows.some((row) => row.some((token) => /^promedio$/.test(token.normalizedText)))
  ) {
    return "wide_multi_lot_table";
  }

  if (
    rows.some((row) => row.length >= 12) &&
    headerTexts.some((text) => /lab number|sample identification|sample id|sample #/.test(text)) &&
    headerTexts.some((text) => /rate|rating|symbol/.test(text))
  ) {
    return "dense_multi_sample_wide_table";
  }

  if (
    rows.some((row) => row.length >= 8) &&
    /base saturation|cation exchange|organic matter|phosphorus|buffer ph|recommendations/.test(allText)
  ) {
    return "grouped_header_table";
  }

  if (
    headerTexts.some((text) => /parametro|parameter/.test(text)) &&
    headerTexts.some((text) => /result|resultado/.test(text))
  ) {
    return "vertical_result_table";
  }

  return "unknown";
}

export function findParameterTokens(tokens: DocToken[]): DocToken[] {
  return tokens.filter((token) => token.tokenType === "parameter");
}

export function findNearbyTokens(
  token: DocToken,
  tokens: DocToken[],
  options: NearbyOptions = {}
): DocToken[] {
  const maxRowDistance = options.maxRowDistance ?? 4;
  const maxColumnDistance = options.maxColumnDistance ?? 4;
  const row = token.rowIndex ?? -1;
  const column = token.columnIndex ?? -1;

  return tokens.filter((candidate) => {
    if (!options.includeSameToken && candidate.id === token.id) return false;
    const candidateRow = candidate.rowIndex ?? -1;
    const candidateColumn = candidate.columnIndex ?? -1;

    if (row >= 0 && candidateRow >= 0 && Math.abs(candidateRow - row) > maxRowDistance) {
      return false;
    }

    if (
      column >= 0 &&
      candidateColumn >= 0 &&
      Math.abs(candidateColumn - column) > maxColumnDistance
    ) {
      return false;
    }

    return true;
  });
}

export function findCandidateValues(
  parameterToken: DocToken,
  tokens: DocToken[],
  context?: Partial<DocumentContext>
): CandidateValue[] {
  const nearbyTokens = findNearbyTokens(parameterToken, tokens, {
    maxRowDistance: 5,
    maxColumnDistance: 8,
  });
  const parameterUnit = detectUnit(parameterToken.rawText);

  return nearbyTokens
    .filter((token) => token.tokenType === "value")
    .map((valueToken) => {
      const candidateNearby = findNearbyTokens(valueToken, tokens, {
        maxRowDistance: 1,
        maxColumnDistance: 2,
      });
      const unitToken = findBestUnitToken(parameterToken, valueToken, candidateNearby);
      const methodToken = candidateNearby.find((token) => token.tokenType === "method");
      const sampleToken = findSampleToken(valueToken, tokens);
      const unitFromValue = detectUnit(valueToken.rawText);
      const syntheticUnitToken =
        !unitToken && (unitFromValue.normalizedUnit || parameterUnit.normalizedUnit)
          ? ({
              id: `${valueToken.id}-unit`,
              rawText: unitFromValue.originalUnit || parameterUnit.originalUnit || "",
              normalizedText: unitFromValue.normalizedUnit || parameterUnit.normalizedUnit || "",
              tokenType: "unit",
              rowIndex: valueToken.rowIndex,
              columnIndex: valueToken.columnIndex,
              pageNumber: valueToken.pageNumber,
              sheetName: valueToken.sheetName,
            } satisfies DocToken)
          : undefined;

      return scoreCandidateValue(
        {
          parameterToken,
          valueToken,
          unitToken: unitToken || syntheticUnitToken,
          methodToken,
          sampleToken,
          score: 0,
          confidence: "low",
          reasons: [],
          warnings: [],
        },
        context
      );
    })
    .filter((candidate) => candidate.score >= 25);
}

export function scoreCandidateValue(
  candidate: CandidateValue,
  context?: Partial<DocumentContext>
): CandidateValue {
  let score = 0;
  const reasons: string[] = [];
  const warnings: string[] = [];
  const parameter = candidate.parameterToken;
  const value = candidate.valueToken;
  const parameterMatch = normalizeParameterName(parameter.rawText, context);
  const parsedValue = parseNumericValue(value.rawText);
  const rowDistance = Math.abs((parameter.rowIndex ?? 0) - (value.rowIndex ?? 0));
  const columnDistance = Math.abs((parameter.columnIndex ?? 0) - (value.columnIndex ?? 0));

  if (sameRow(parameter, value)) addScore(35, "same row as parameter");
  if (sameColumn(parameter, value)) addScore(25, "same column as parameter");
  if (isImmediatelyRight(parameter, value)) addScore(35, "value to the right of parameter");
  if (isImmediatelyBelow(parameter, value)) addScore(25, "value below parameter");
  if (candidate.unitToken) addScore(20, "recognized unit nearby");
  if (isCompatibleUnit(parameterMatch.normalizedParameter, candidate.unitToken?.rawText || value.rawText, context)) {
    addScore(20, "compatible unit");
  }
  if (isInsideResultZone(value, [parameter, value])) {
    addScore(30, context?.analysisType === "soil" ? "inside soil result section" : "inside result section");
  }
  if (parameterMatch.confidence >= 0.98) addScore(30, "parameter alias exact match");
  else if (parameterMatch.confidence >= 0.58) addScore(15, "parameter alias fuzzy match");
  if (hasRepeatedTablePattern(parameter, value)) addScore(25, "repeated table layout pattern");
  if (candidate.sampleToken) addScore(10, "sample context detected");
  if (candidate.methodToken || detectExtractionMethod(parameter, [value]).method) {
    addScore(10, "extraction method nearby");
  }
  if (isUnderResultColumn(value, [parameter, value])) addScore(30, "under result column");
  if (!isReferenceColumn(value, [parameter, value])) reasons.push("not in reference range column");

  if (looksLikeDate(value.rawText)) subtractScore(40, "value looks like date");
  if (looksLikePhoneNumber(value.rawText)) subtractScore(50, "value looks like phone number");
  if (isNoiseToken(value, context)) subtractScore(100, "token classified as noise");
  if (looksLikeAddressFooterOrHeader(value.rawText)) subtractScore(40, "value looks like address/footer/header");
  if (isReferenceColumn(value, [parameter, value]) || value.tokenType === "reference_range") {
    subtractScore(35, "value appears in reference range column");
  }
  if (isNearInterpretationColumn(value, [parameter, value])) {
    subtractScore(30, "value near low/medium/high/optimal columns but not result column");
  }
  if (rowDistance > 3 || columnDistance > 6) subtractScore(25, "value too far from parameter");
  if (!isCompatibleUnit(parameterMatch.normalizedParameter, candidate.unitToken?.rawText || value.rawText, context)) {
    subtractScore(40, "incompatible unit");
  }
  if (parameterMatch.flags.includes("ambiguous parameter")) subtractScore(20, "ambiguous parameter");
  if ((value.confidence ?? 1) < 0.65) subtractScore(20, "AI extraction confidence low");
  if (isOutsideExpectedAgronomicRange(parameterMatch.normalizedParameter, parsedValue, context)) {
    subtractScore(25, "value outside expected agronomic range");
  }

  return {
    ...candidate,
    score,
    confidence: score >= 80 ? "high" : score >= 50 ? "medium" : "low",
    reasons,
    warnings,
  };

  function addScore(points: number, reason: string) {
    score += points;
    reasons.push(reason);
  }

  function subtractScore(points: number, warning: string) {
    score -= points;
    warnings.push(warning);
  }
}

export function selectBestCandidate(candidates: CandidateValue[]): CandidateValue | null {
  const sorted = [...candidates].sort((left, right) => right.score - left.score);
  return sorted[0]?.score >= 25 ? sorted[0] : null;
}

export function validateExtractedValue(value: ExtractedLabValue): string[] {
  const warnings: string[] = [];
  const numericValue = value.normalizedValueNumber ?? value.originalValueNumber;

  if (numericValue === undefined) return warnings;
  if (value.normalizedParameter === "ph") {
    if (numericValue < 0 || numericValue > 14) warnings.push("pH should be 0-14");
    if (value.analysisType === "soil" && (numericValue < 3 || numericValue > 10)) {
      warnings.push("soil pH outside 3-10 is suspicious");
    }
  }
  if (numericValue < 0 && value.normalizedParameter !== "ph") {
    warnings.push("negative nutrients are suspicious");
  }
  if (value.normalizedParameter === "electrical_conductivity" && numericValue < 0) {
    warnings.push("negative EC is invalid");
  }
  if (value.normalizedUnit === "%" && (numericValue < 0 || numericValue > 100)) {
    warnings.push("percentage values outside 0-100 are suspicious");
  }

  return warnings;
}

export function deduplicateAndResolveConflicts(
  values: ExtractedLabValue[]
): ExtractedLabValue[] {
  const byKey = new Map<string, ExtractedLabValue>();

  for (const value of values) {
    const key = [
      value.normalizedParameter || value.originalLabel,
      value.sampleName || "",
      value.analysisType,
    ].join("|");
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, value);
      continue;
    }

    if (confidenceRank(value.confidence) > confidenceRank(existing.confidence)) {
      byKey.set(key, {
        ...value,
        flags: [...value.flags, "duplicated conflicting candidate"],
        reasons: [...value.reasons, "higher confidence duplicate selected"],
      });
      continue;
    }

    existing.flags.push("duplicated conflicting candidate");
  }

  return Array.from(byKey.values());
}

function extractValuesByCandidateScoring(
  classifiedTokens: DocToken[],
  metadata: ExtractedMetadata,
  resolvedContext: DocumentContext
) {
  const values: ExtractedLabValue[] = [];

  for (const parameterToken of findParameterTokens(classifiedTokens)) {
    const candidates = findCandidateValues(parameterToken, classifiedTokens, resolvedContext);
    const best = selectBestCandidate(candidates);
    if (!best) continue;

    const parsedValue = parseNumericValue(best.valueToken.rawText);
    const parameterMatch = normalizeParameterName(parameterToken.rawText, resolvedContext);
    const unit = detectUnit(
      `${best.unitToken?.rawText || ""} ${best.valueToken.rawText} ${parameterToken.rawText}`
    );
    const method = detectExtractionMethod(
      parameterToken,
      findNearbyTokens(parameterToken, classifiedTokens, {
        maxRowDistance: 1,
        maxColumnDistance: 3,
      })
    );
    const extracted: ExtractedLabValue = {
      originalLabel: parameterToken.rawText,
      normalizedParameter: parameterMatch.normalizedParameter,
      originalValueRaw: best.valueToken.rawText,
      valueKind: parsedValue.kind,
      originalValueNumber: parsedValue.numberValue,
      normalizedValueNumber: parsedValue.numberValue,
      originalUnit: unit.originalUnit,
      normalizedUnit: unit.normalizedUnit,
      analysisType: resolvedContext.analysisType,
      extractionMethod: method.method,
      sampleName: best.sampleToken?.rawText,
      confidence: best.confidence,
      confidenceScore: best.score,
      layoutFamily: resolvedContext.layoutFamily,
      metadata,
      flags: [...parsedValue.flags, ...parameterMatch.flags, ...best.warnings],
      reasons: best.reasons,
      source: sourceFromToken(best.valueToken),
    };

    extracted.flags.push(...validateExtractedValue(extracted));
    values.push(extracted);
  }

  return values;
}

function extractValuesByLayout(
  tokens: DocToken[],
  metadata: ExtractedMetadata,
  context: DocumentContext
) {
  switch (context.layoutFamily) {
    case "vertical_result_table":
    case "sectioned_spanish_report":
    case "scanned_pdf_ai_table":
      return parseVerticalResultTable(tokens, metadata, context);
    case "wide_multi_lot_table":
    case "dense_multi_sample_wide_table":
    case "grouped_header_table":
      return parseWideOrGroupedTable(tokens, metadata, context);
    default:
      return [];
  }
}

function parseVerticalResultTable(
  tokens: DocToken[],
  metadata: ExtractedMetadata,
  context: DocumentContext
) {
  const rows = groupTokensByRow(tokens);
  const headerRowIndex = findBestHeaderRow(rows, ["parameter", "parametro", "variable", "determination", "determinacion"]);
  if (headerRowIndex < 0) return [];

  const header = buildHeaderMap(rows, headerRowIndex, context);
  const parameterColumn = header.find((item) =>
    /parameter|parametro|variable|determination|determinacion/.test(normalizeForMatching(item.label))
  );
  const resultColumn = header.find((item) => item.isResultColumn);
  const unitColumn = header.find((item) => item.isUnitColumn);
  const methodColumn = header.find((item) => item.isMethodColumn);
  const referenceColumn = header.find((item) => item.isReferenceColumn);
  if (!parameterColumn || !resultColumn) return [];

  let activeSection = "";
  const values: ExtractedLabValue[] = [];

  for (const row of rows.slice(headerRowIndex + 1)) {
    const rowText = row.map((token) => token.normalizedText).join(" ");
    if (!row.length || isRecommendationRow(rowText)) continue;

    const sectionToken = row.find((token) => isSectionTitle(token));
    if (sectionToken) {
      activeSection = sectionToken.rawText;
      continue;
    }

    const parameterToken = getTokenAtColumn(row, parameterColumn.columnIndex);
    const resultToken = getTokenAtColumn(row, resultColumn.columnIndex);
    if (!parameterToken || !resultToken) continue;
    if (isRatingOnly(resultToken.rawText) || isReferenceRangeText(resultToken.rawText)) continue;

    const parsedValue = parseNumericValue(resultToken.rawText);
    if (!isImportableValue(parsedValue)) continue;

    const unitToken = unitColumn ? getTokenAtColumn(row, unitColumn.columnIndex) : undefined;
    const methodToken = methodColumn ? getTokenAtColumn(row, methodColumn.columnIndex) : undefined;
    const referenceToken = referenceColumn ? getTokenAtColumn(row, referenceColumn.columnIndex) : undefined;
    const parameterMatch = normalizeParameterName(
      `${parameterToken.rawText} ${methodToken?.rawText || ""}`,
      context
    );
    const unit = detectUnit(unitToken?.rawText || parameterToken.rawText);
    const reasons = [
      "inside result column",
      "not in reference range column",
      context.analysisType === "soil" ? "inside soil analysis section" : "inside analysis section",
    ];
    if (unit.normalizedUnit) reasons.push("compatible unit");
    if (methodToken?.rawText) reasons.push("method column detected");
    if (activeSection) reasons.push(`inside ${activeSection} section`);

    const extracted = makeExtractedValue({
      parameterToken,
      valueToken: resultToken,
      parsedValue,
      parameterMatch,
      unit,
      metadata,
      context,
      method: methodToken?.rawText,
      referenceRange: referenceToken?.rawText,
      group: activeSection,
      reasons,
      score: unit.normalizedUnit ? 110 : 90,
    });

    values.push(extracted);
  }

  return values;
}

function parseWideOrGroupedTable(
  tokens: DocToken[],
  metadata: ExtractedMetadata,
  context: DocumentContext
) {
  const rows = groupTokensByRow(tokens);
  const headerRowIndex = findBestWideHeaderRow(rows);
  if (headerRowIndex < 0) return [];

  const header = buildMultiRowHeaderMap(rows, headerRowIndex, context);
  const values: ExtractedLabValue[] = [];
  const firstDataRowIndex = headerRowIndex + countHeaderRows(rows, headerRowIndex);

  for (const row of rows.slice(firstDataRowIndex)) {
    const rowText = row.map((token) => token.normalizedText).join(" ");
    if (!row.length || isRecommendationRow(rowText)) break;

    const sampleToken = findSampleCell(row, header);
    const sampleName = sampleToken?.rawText;
    const isAverage = /^promedio|average|avg$/i.test(sampleToken?.normalizedText || "");

    for (const headerEntry of header) {
      if (
        headerEntry.isSampleColumn ||
        headerEntry.isReferenceColumn ||
        headerEntry.isRatingColumn ||
        !headerEntry.normalizedParameter
      ) {
        continue;
      }

      const valueToken = getTokenAtColumn(row, headerEntry.columnIndex);
      if (!valueToken) continue;

      const parsedValue = parseNumericValue(valueToken.rawText);
      if (!isImportableValue(parsedValue)) continue;
      if (isRatingOnly(valueToken.rawText)) continue;

      const unit = detectUnit(headerEntry.unit || headerEntry.label);
      const method = headerEntry.method || detectExtractionMethod(valueToken, rows[headerRowIndex] || []).method;
      const reasons = [
        "under parameter header",
        "sample name detected from first column",
        "not in reference range column",
        "not in recommendation section",
      ];
      if (headerEntry.group) reasons.push(`parent header ${headerEntry.group}`);
      if (unit.normalizedUnit) reasons.push("compatible unit");
      if (context.layoutFamily === "grouped_header_table") reasons.push("multi-level header combined");

      const parameterMatch = {
        normalizedParameter: headerEntry.normalizedParameter,
        confidence: 1,
        flags: [] as string[],
      };
      const extracted = makeExtractedValue({
        parameterToken: makeSyntheticHeaderToken(headerEntry, valueToken),
        valueToken,
        parsedValue,
        parameterMatch,
        unit,
        metadata,
        context,
        method,
        sampleName,
        group: headerEntry.group,
        interpretation: findRatingBesideValue(row, headerEntry.columnIndex),
        reasons,
        score: unit.normalizedUnit ? 115 : 95,
      });

      if (isAverage) {
        extracted.flags.push("average row");
        extracted.reasons.push("average row detected");
      }

      values.push(extracted);
    }
  }

  return values;
}

export function extractLabIntelligently(
  rawInput: string | string[][] | DocToken[],
  context?: Partial<DocumentContext>
): IntelligentExtractionResult {
  const initialTokens = normalizeInputToTokens(rawInput);
  const detectedType = context?.analysisType || detectAnalysisType(initialTokens);
  const layoutFamily = context?.layoutFamily || detectLabReportLayout(initialTokens);
  const resolvedContext: DocumentContext = {
    analysisType: detectedType,
    activeSection: context?.activeSection,
    sheetName: context?.sheetName,
    pageNumber: context?.pageNumber,
    layoutFamily,
  };
  const classifiedTokens = initialTokens.map((token) =>
    classifyToken(token, initialTokens, resolvedContext)
  );
  const metadata = extractMetadata(classifiedTokens, resolvedContext);
  const warnings: string[] = [];
  const strategyValues = extractValuesByLayout(classifiedTokens, metadata, resolvedContext);
  const values: ExtractedLabValue[] =
    strategyValues.length > 0
      ? strategyValues
      : extractValuesByCandidateScoring(classifiedTokens, metadata, resolvedContext);

  const resolvedValues = deduplicateAndResolveConflicts(values);
  const textureWarning = validateTextureTotal(resolvedValues);
  if (textureWarning) warnings.push(textureWarning);

  if (resolvedValues.length === 0) {
    warnings.push("No confident lab result values were found.");
  }

  return {
    metadata,
    values: resolvedValues,
    warnings,
    rawTokens: classifiedTokens,
    layoutFamily,
  };
}

export function demoIntelligentLabExtractor() {
  return [
    extractLabIntelligently(`pH 5.8
MO 3.2 %
P 12 mg/kg
K 0.35 cmol(+)/kg`),
    extractLabIntelligently([
      ["Sample", "pH", "MO (%)", "P (mg/kg)", "K (cmol(+)/kg)"],
      ["Lot 1", "5.8", "3.2", "12", "0.35"],
      ["Lot 2", "6.1", "2.8", "18", "0.42"],
    ]),
    extractLabIntelligently(`AGROLAB COSTA RICA
Tel: 2222-2222
Cliente: Finca La Esperanza
Lote: Norte 1
RESULTADOS
pH     5,8
M.O.   3,1 %
Fosforo  12 mg kg-1
Pagina 1 de 2`),
    extractLabIntelligently([
      ["Parametro", "Resultado", "Bajo", "Medio", "Alto"],
      ["P", "12", "0-10", "10-20", ">20"],
      ["K", "0.35", "0.1-0.2", "0.2-0.4", ">0.4"],
    ]),
  ];
}

function splitResultLine(line: string) {
  const partsBySpacing = line
    .split(/\s{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (partsBySpacing.length > 1) return partsBySpacing.flatMap(splitCompactResultCell);

  return splitCompactResultCell(line);
}

function splitCompactResultCell(text: string) {
  const numericMatch = text.match(/^(.*?)\s*((?:<|>)?\s*[+-]?\d[\d.,]*(?:\s*(?:-|–|—|to|a)\s*[+-]?\d[\d.,]*)?|ND|N\.D\.|trace|trazas|not detected)\s*(.*)$/i);

  if (!numericMatch) return [text.trim()];

  const before = numericMatch[1].trim();
  const value = numericMatch[2].trim();
  const after = numericMatch[3].trim();
  return [before, value, after].filter(Boolean);
}

function groupTokensByRow(tokens: DocToken[]) {
  const byRow = new Map<number, DocToken[]>();

  for (const token of tokens) {
    const rowIndex = token.rowIndex ?? 0;
    const existing = byRow.get(rowIndex) || [];
    existing.push(token);
    byRow.set(rowIndex, existing);
  }

  return Array.from(byRow.entries())
    .sort(([left], [right]) => left - right)
    .map(([, row]) => row.sort((left, right) => (left.columnIndex ?? 0) - (right.columnIndex ?? 0)));
}

function findBestHeaderRow(rows: DocToken[][], requiredLabels: string[]) {
  let bestIndex = -1;
  let bestScore = 0;

  rows.forEach((row, index) => {
    const text = row.map((token) => token.normalizedText).join(" ");
    let score = 0;
    for (const label of requiredLabels) {
      if (text.includes(label)) score += 2;
    }
    if (/\b(result|resultado|resultados|valor|current)\b/.test(text)) score += 4;
    if (/\b(unit|unidad|unidades)\b/.test(text)) score += 2;
    if (/\b(method|metodo|extractante|tecnica)\b/.test(text)) score += 1;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 4 ? bestIndex : -1;
}

function findBestWideHeaderRow(rows: DocToken[][]) {
  let bestIndex = -1;
  let bestScore = 0;

  rows.forEach((row, index) => {
    const text = row.map((token) => token.normalizedText).join(" ");
    let score = 0;
    if (/\b(sample|sample #|sample id|muestra|muestras|lote|lotes|cable|lab number)\b/.test(text)) score += 5;
    score += row.filter((token) => normalizeParameterName(token.rawText).normalizedParameter).length;
    score += row.filter((token) => detectUnit(token.rawText).normalizedUnit).length;
    if (/\brecommendations?|recomendaciones?|kg\/ha|p2o5|k2o\b/.test(text)) score -= 8;

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestScore >= 4 ? bestIndex : -1;
}

function buildHeaderMap(
  rows: DocToken[][],
  headerRowIndex: number,
  context: DocumentContext
): HeaderMapEntry[] {
  return rows[headerRowIndex].map((token) => {
    const normalized = token.normalizedText;
    return {
      columnIndex: token.columnIndex ?? 0,
      label: token.rawText,
      normalizedParameter: normalizeParameterName(token.rawText, context).normalizedParameter,
      unit: detectUnit(token.rawText).normalizedUnit,
      method: detectExtractionMethod(token, rows[headerRowIndex]).method,
      isResultColumn: /\b(result|resultado|resultados|valor|current|concentracion)\b/.test(normalized),
      isUnitColumn: /\b(unit|unidad|unidades)\b/.test(normalized),
      isMethodColumn: /\b(method|metodo|extractante|tecnica|referencia)\b/.test(normalized),
      isReferenceColumn: isReferenceHeader(normalized),
      isRatingColumn: isRatingHeader(normalized),
      isSampleColumn: isSampleHeader(normalized),
    };
  });
}

function buildMultiRowHeaderMap(
  rows: DocToken[][],
  headerRowIndex: number,
  context: DocumentContext
): HeaderMapEntry[] {
  const headerRowsCount = countHeaderRows(rows, headerRowIndex);
  const headerRows = rows.slice(headerRowIndex, headerRowIndex + headerRowsCount);
  const maxColumn = Math.max(...headerRows.flatMap((row) => row.map((token) => token.columnIndex ?? 0)));
  const entries: HeaderMapEntry[] = [];

  for (let columnIndex = 0; columnIndex <= maxColumn; columnIndex += 1) {
    const columnTokens = headerRows
      .map((row) => getTokenAtColumn(row, columnIndex))
      .filter(Boolean) as DocToken[];
    const labelParts = columnTokens.map((token) => token.rawText).filter(Boolean);
    const label = labelParts.join(" ").trim();
    const normalizedLabel = normalizeForMatching(label);
    const closestParameterToken = [...columnTokens]
      .reverse()
      .find((token) => normalizeParameterName(token.rawText, context).normalizedParameter);
    const parameterText = closestParameterToken?.rawText || label;
    const parameterMatch = normalizeParameterName(label, context).normalizedParameter
      ? normalizeParameterName(label, context)
      : normalizeParameterName(parameterText, context);
    const groupToken = columnTokens.find((token) => !normalizeParameterName(token.rawText, context).normalizedParameter);
    const unit = columnTokens.map((token) => detectUnit(token.rawText).normalizedUnit).find(Boolean);
    const method = detectExtractionMethod(
      { ...columnTokens[0], rawText: label, normalizedText: normalizedLabel },
      columnTokens
    ).method;

    entries.push({
      columnIndex,
      label,
      normalizedParameter: parameterMatch.normalizedParameter,
      unit,
      method,
      group: groupToken?.rawText,
      isResultColumn: /\b(result|resultado|resultados|valor|current)\b/.test(normalizedLabel),
      isUnitColumn: /\b(unit|unidad|unidades)\b/.test(normalizedLabel),
      isMethodColumn: /\b(method|metodo|extractante|tecnica|referencia)\b/.test(normalizedLabel),
      isReferenceColumn: isReferenceHeader(normalizedLabel),
      isRatingColumn: isRatingHeader(normalizedLabel),
      isSampleColumn: isSampleHeader(normalizedLabel) || columnIndex === 0,
    });
  }

  return entries;
}

function countHeaderRows(rows: DocToken[][], headerRowIndex: number) {
  let count = 1;
  for (let index = headerRowIndex + 1; index < Math.min(rows.length, headerRowIndex + 5); index += 1) {
    const row = rows[index];
    const text = row.map((token) => token.normalizedText).join(" ");
    const parameterCount = row.filter((token) => normalizeParameterName(token.rawText).normalizedParameter).length;
    const valueCount = row.filter((token) => parseNumericValue(token.rawText).kind === "numeric").length;
    const unitCount = row.filter((token) => detectUnit(token.rawText).normalizedUnit).length;

    if (isRecommendationRow(text)) break;
    if (unitCount >= 2 || (parameterCount >= 2 && valueCount < 2)) {
      count += 1;
      continue;
    }
    break;
  }

  return count;
}

function getTokenAtColumn(row: DocToken[], columnIndex: number) {
  return row.find((token) => token.columnIndex === columnIndex);
}

function findSampleCell(row: DocToken[], header: HeaderMapEntry[]) {
  const sampleColumn =
    header.find((item) => /sample identification|sample id|muestra|lote|cable/.test(normalizeForMatching(item.label)))?.columnIndex ??
    header.find((item) => item.isSampleColumn && !/lab number|lab no/.test(normalizeForMatching(item.label)))?.columnIndex ??
    header.find((item) => item.isSampleColumn)?.columnIndex ??
    0;
  return getTokenAtColumn(row, sampleColumn) || row[0];
}

function makeSyntheticHeaderToken(entry: HeaderMapEntry, valueToken: DocToken): DocToken {
  return {
    id: `header-${valueToken.id}-${entry.columnIndex}`,
    rawText: entry.label,
    normalizedText: normalizeForMatching(entry.label),
    tokenType: "parameter",
    rowIndex: valueToken.rowIndex,
    columnIndex: entry.columnIndex,
    pageNumber: valueToken.pageNumber,
    sheetName: valueToken.sheetName,
  };
}

function makeExtractedValue(input: {
  parameterToken: DocToken;
  valueToken: DocToken;
  parsedValue: ParsedValue;
  parameterMatch: { normalizedParameter: string | null; confidence: number; flags: string[] };
  unit: { originalUnit?: string; normalizedUnit?: string };
  metadata: ExtractedMetadata;
  context: DocumentContext;
  method?: string;
  sampleName?: string;
  group?: string;
  interpretation?: string;
  referenceRange?: string;
  reasons: string[];
  score: number;
}): ExtractedLabValue {
  const extracted: ExtractedLabValue = {
    originalLabel: input.parameterToken.rawText,
    normalizedParameter: input.parameterMatch.normalizedParameter,
    originalValueRaw: input.valueToken.rawText,
    valueKind: input.parsedValue.kind,
    originalValueNumber: input.parsedValue.numberValue,
    normalizedValueNumber: input.parsedValue.numberValue,
    originalUnit: input.unit.originalUnit,
    normalizedUnit: input.unit.normalizedUnit,
    analysisType: input.context.analysisType,
    extractionMethod: input.method,
    sampleName: input.sampleName,
    confidence: input.score >= 80 ? "high" : input.score >= 50 ? "medium" : "low",
    confidenceScore: input.score,
    layoutFamily: input.context.layoutFamily,
    parameterGroup: input.group,
    interpretation: input.interpretation,
    referenceRange: input.referenceRange,
    metadata: input.metadata,
    flags: [...input.parsedValue.flags, ...input.parameterMatch.flags],
    reasons: input.reasons,
    source: sourceFromToken(input.valueToken),
  };

  extracted.flags.push(...validateExtractedValue(extracted));
  return extracted;
}

function sourceFromToken(token: DocToken) {
  return {
    pageNumber: token.pageNumber,
    sheetName: token.sheetName,
    rowIndex: token.rowIndex,
    columnIndex: token.columnIndex,
    bbox: token.bbox,
  };
}

function isReferenceHeader(normalized: string) {
  return REFERENCE_ZONE_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    /\b(target|guide low|guide high|min|max|pnt)\b/.test(normalized);
}

function isRatingHeader(normalized: string) {
  return /\b(rate|rating|status|symbol|low|medium|high|bajo|medio|alto|normal|optimum|optimo|muy bajo|muy alto)\b/.test(normalized);
}

function isSampleHeader(normalized: string) {
  return /\b(sample|sample #|sample id|muestra|muestras|lote|lotes|cable|lab number|lab no|identification)\b/.test(normalized);
}

function isRecommendationRow(normalizedRowText: string) {
  return RECOMMENDATION_KEYWORDS.some((keyword) => normalizedRowText.includes(keyword));
}

function isRatingOnly(rawText: string) {
  return /^(?:vl|l|m|h|vh|e|bajo|medio|alto|normal|adecuado|deficiente|excesivo|low|medium|high)$/i.test(
    normalizeForMatching(rawText)
  );
}

function isImportableValue(parsedValue: ParsedValue) {
  return ["numeric", "less_than", "greater_than", "not_detected", "trace"].includes(parsedValue.kind);
}

function findRatingBesideValue(row: DocToken[], valueColumnIndex: number) {
  const right = getTokenAtColumn(row, valueColumnIndex + 1);
  return right && isRatingOnly(right.rawText) ? right.rawText : undefined;
}

function isDocToken(value: unknown): value is DocToken {
  if (!value || typeof value !== "object") return false;
  return "rawText" in value && "id" in value;
}

function isMetadataLabel(token: DocToken) {
  return METADATA_LABELS.has(token.normalizedText);
}

function isMetadataValue(token: DocToken, tokens: DocToken[]) {
  return tokens.some(
    (candidate) =>
      candidate.tokenType === "metadata_label" &&
      candidate.rowIndex === token.rowIndex &&
      (token.columnIndex ?? 0) > (candidate.columnIndex ?? 0)
  );
}

function isSectionTitle(token: DocToken) {
  const normalized = token.normalizedText;
  return RESULT_ZONE_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    /\b(soil|foliar)\s+analysis\b/i.test(normalized);
}

function isReferenceRangeText(text: string) {
  const normalized = normalizeForMatching(text);
  const parsed = parseNumericValue(text);
  return (
    REFERENCE_ZONE_KEYWORDS.some((keyword) => normalized.includes(keyword)) ||
    parsed.kind === "range" ||
    (parsed.kind === "less_than" && /alto|high|excessive|reference|range/.test(normalized)) ||
    (parsed.kind === "greater_than" && /alto|high|excessive|reference|range/.test(normalized))
  );
}

function isInterpretationText(text: string) {
  return /^(low|medium|high|bajo|medio|alto|optimal|optimo|deficient|sufficient|excessive)$/i.test(
    normalizeForMatching(text)
  );
}

function isSampleLabel(token: DocToken) {
  const normalized = token.normalizedText;
  return /^(sample|muestra|lot|lote|parcela|field)\b/.test(normalized) ||
    /^lot\s*\d+$/i.test(normalized);
}

function findMetadataValueForLabel(label: DocToken, tokens: DocToken[]) {
  return tokens.find(
    (token) =>
      token.rowIndex === label.rowIndex &&
      (token.columnIndex ?? 0) > (label.columnIndex ?? 0) &&
      !isNoiseToken(token)
  );
}

function cleanMetadataValue(value: string) {
  return value.replace(/^[:\s-]+/, "").trim();
}

function sortTokens(tokens: DocToken[]) {
  return [...tokens].sort((left, right) => {
    const rowDiff = (left.rowIndex ?? 0) - (right.rowIndex ?? 0);
    if (rowDiff !== 0) return rowDiff;
    return (left.columnIndex ?? 0) - (right.columnIndex ?? 0);
  });
}

function parameterMatchScore(raw: string, alias: string) {
  if (raw === alias) return 1;
  const rawWords = new Set(raw.split(" "));
  if (raw.startsWith(`${alias} `) || raw.endsWith(` ${alias}`)) return 0.9;
  if (raw.split(" ")[0] === alias || raw.split(" ").at(-1) === alias) return 0.9;
  if (!alias.includes(" ") && rawWords.has(alias)) return 0.9;
  if (raw.includes(alias) || alias.includes(raw)) {
    return Math.min(raw.length, alias.length) / Math.max(raw.length, alias.length) + 0.18;
  }

  const aliasWords = alias.split(" ");
  const matchingWords = aliasWords.filter((word) => rawWords.has(word)).length;
  return matchingWords / Math.max(aliasWords.length, 1);
}

function normalizeParameterCandidateText(rawText: string) {
  const cleaned = rawText
    .replace(/^[*•\s-]+/, "")
    .replace(/\b(extractable|disponible|asimilable|available|cambio|exchangeable)\b/gi, " ")
    .replace(/\b(resultados?|resultado|current|symbol|sigla|expresion)\b/gi, " ");

  const leadingBeforeParenthetical = rawText.match(/^([A-Za-z\u00C0-\u00FF.+-]{1,14})\s*\(/);
  if (leadingBeforeParenthetical) {
    return normalizeForMatching(leadingBeforeParenthetical[1]);
  }

  const withoutUnitParentheses = cleaned.replace(
    /\((?:%|ppm|mg\/kg|mg\s*kg-?1|g\/kg|g\s*kg-?1|cmol[^)]*|meq\/100g|ds\/m|ms\/cm|µs\/cm|us\/cm)\)/gi,
    " "
  );
  const withoutTrailingUnit = withoutUnitParentheses.replace(
    /\b(?:%|ppm|mg\/kg|mg\s*kg-?1|g\/kg|g\s*kg-?1|cmol\(\+\)\/kg|cmolc\/kg|cmol\/kg|meq\/100g|ds\/m|ms\/cm|µs\/cm|us\/cm)\b/gi,
    " "
  );

  return normalizeForMatching(withoutTrailingUnit);
}

function detectMethodSpecificParameter(normalizedRaw: string) {
  if (/\b(arena|sand|sable)\b/.test(normalizedRaw)) return "sand";
  if (/\b(limo|limon|silt)\b/.test(normalizedRaw)) return "silt";
  if (/\b(arcilla|clay|argile)\b/.test(normalizedRaw)) return "clay";
  if (/\b(p|phosphorus|fosforo|phosphore)\b/.test(normalizedRaw) && /\bolsen\b/.test(normalizedRaw)) {
    return "phosphorus_olsen";
  }
  if (/\b(p|phosphorus|fosforo|phosphore)\b/.test(normalizedRaw) && /\bbray\b/.test(normalizedRaw)) {
    return "phosphorus_bray";
  }
  if (/\b(p|phosphorus|fosforo|phosphore)\b/.test(normalizedRaw) && /\bmehlich\b/.test(normalizedRaw)) {
    return "phosphorus_mehlich";
  }
  if (/\bph\b/.test(normalizedRaw) && /\bkcl\b/.test(normalizedRaw)) {
    return "ph_kcl";
  }
  if (/\bph\b/.test(normalizedRaw) && /\bh2o|agua\b/.test(normalizedRaw)) {
    return "ph";
  }
  return null;
}

function parseLocalizedNumber(raw: string) {
  const value = raw.trim();
  const lastComma = value.lastIndexOf(",");
  const lastDot = value.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    if (lastComma > lastDot) {
      return Number(value.replace(/\./g, "").replace(",", "."));
    }
    return Number(value.replace(/,/g, ""));
  }

  if (lastComma > -1) {
    const decimalLikely = value.length - lastComma <= 3;
    return Number(decimalLikely ? value.replace(",", ".") : value.replace(/,/g, ""));
  }

  return Number(value.replace(/,/g, ""));
}

function looksLikeDate(rawText: string) {
  return /\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/.test(rawText) ||
    /\b\d{4}[/-]\d{1,2}[/-]\d{1,2}\b/.test(rawText);
}

function looksLikePhoneNumber(rawText: string) {
  const digits = rawText.replace(/\D/g, "");
  return digits.length >= 7 && /[-\s()]/.test(rawText);
}

function looksLikeAddressFooterOrHeader(rawText: string) {
  const normalized = normalizeForMatching(rawText);
  return /\b(avenida|calle|street|road|page|pagina|footer|header|www|email)\b/.test(normalized);
}

function sameRow(left: DocToken, right: DocToken) {
  return left.rowIndex !== undefined && left.rowIndex === right.rowIndex;
}

function sameColumn(left: DocToken, right: DocToken) {
  return left.columnIndex !== undefined && left.columnIndex === right.columnIndex;
}

function isImmediatelyRight(left: DocToken, right: DocToken) {
  return sameRow(left, right) && (right.columnIndex ?? -99) === (left.columnIndex ?? 0) + 1;
}

function isImmediatelyBelow(left: DocToken, right: DocToken) {
  return sameColumn(left, right) && (right.rowIndex ?? -99) === (left.rowIndex ?? 0) + 1;
}

function isInsideResultZone(token: DocToken, tokens: DocToken[]) {
  const row = token.rowIndex ?? 0;
  const sameTokens = tokens.filter((item) => item.rowIndex !== undefined);
  const previousSection = sameTokens
    .filter((item) => (item.rowIndex ?? 0) <= row && item.tokenType === "section_title")
    .sort((left, right) => (right.rowIndex ?? 0) - (left.rowIndex ?? 0))[0];

  if (!previousSection) return false;
  if (REFERENCE_ZONE_KEYWORDS.some((keyword) => previousSection.normalizedText.includes(keyword))) {
    return false;
  }

  return RESULT_ZONE_KEYWORDS.some((keyword) => previousSection.normalizedText.includes(keyword));
}

function isUnderResultColumn(token: DocToken, tokens: DocToken[]) {
  const header = findColumnHeader(token, tokens);
  if (!header) return false;
  return /\b(result|resultado|value|valor|valeur)\b/.test(header.normalizedText);
}

function isReferenceColumn(token: DocToken, tokens: DocToken[]) {
  const header = findColumnHeader(token, tokens);
  if (!header) return false;
  return REFERENCE_ZONE_KEYWORDS.some((keyword) => header.normalizedText.includes(keyword));
}

function isNearInterpretationColumn(token: DocToken, tokens: DocToken[]) {
  const header = findColumnHeader(token, tokens);
  if (!header) return false;
  return /\b(low|medium|high|bajo|medio|alto|optimum|optimo)\b/.test(header.normalizedText) &&
    !isUnderResultColumn(token, tokens);
}

function findColumnHeader(token: DocToken, tokens: DocToken[]) {
  const column = token.columnIndex;
  const row = token.rowIndex;
  if (column === undefined || row === undefined) return null;

  return sortTokens(tokens)
    .filter((candidate) => candidate.columnIndex === column && (candidate.rowIndex ?? 999) < row)
    .reverse()[0] || null;
}

function hasRepeatedTablePattern(parameter: DocToken, value: DocToken) {
  return (
    parameter.rowIndex !== undefined &&
    value.rowIndex !== undefined &&
    parameter.columnIndex !== undefined &&
    value.columnIndex !== undefined &&
    (sameRow(parameter, value) || sameColumn(parameter, value))
  );
}

function isCompatibleUnit(
  normalizedParameter: string | null,
  rawUnitText: string,
  context?: Partial<DocumentContext>
) {
  const detected = detectUnit(rawUnitText);
  const unit = detected.normalizedUnit;
  if (!normalizedParameter) return true;

  if (normalizedParameter === "ph") return !unit;

  const alias = PARAMETER_ALIASES.find((item) => item.normalizedParameter === normalizedParameter);
  if (!alias?.preferredUnits?.length) return true;

  if (!unit) return true;
  if (alias.preferredUnits.includes(unit)) return true;

  if (
    context?.analysisType === "foliar" &&
    ["nitrogen", "phosphorus", "potassium", "calcium", "magnesium", "sulfur"].includes(normalizedParameter)
  ) {
    return unit === "%";
  }

  return false;
}

function isOutsideExpectedAgronomicRange(
  normalizedParameter: string | null,
  parsedValue: ParsedValue,
  context?: Partial<DocumentContext>
) {
  const numeric = parsedValue.numberValue;
  if (numeric === undefined) return false;
  if (numeric < 0 && normalizedParameter !== "ph") return true;
  if (normalizedParameter === "ph") return numeric < 0 || numeric > 14;
  if (context?.analysisType === "soil" && normalizedParameter === "ph") return numeric < 3 || numeric > 10;
  if (detectUnit(parsedValue.raw).normalizedUnit === "%" && (numeric < 0 || numeric > 100)) return true;

  const alias = PARAMETER_ALIASES.find((item) => item.normalizedParameter === normalizedParameter);
  if (!alias?.expectedRange) return false;
  return numeric < alias.expectedRange[0] || numeric > alias.expectedRange[1];
}

function findSampleToken(valueToken: DocToken, tokens: DocToken[]) {
  const row = valueToken.rowIndex;
  if (row === undefined) return undefined;

  return tokens.find(
    (token) =>
      token.rowIndex === row &&
      (token.columnIndex ?? 99) < (valueToken.columnIndex ?? 0) &&
      (token.tokenType === "sample_label" || /^lot\s*\d+$/i.test(token.normalizedText))
  );
}

function findBestUnitToken(
  parameterToken: DocToken,
  valueToken: DocToken,
  nearbyTokens: DocToken[]
) {
  const sameRowRight = nearbyTokens.find(
    (token) =>
      token.tokenType === "unit" &&
      token.rowIndex === valueToken.rowIndex &&
      (token.columnIndex ?? 0) >= (valueToken.columnIndex ?? 0)
  );
  if (sameRowRight) return sameRowRight;

  const parameterHeaderUnit = detectUnit(parameterToken.rawText);
  if (parameterHeaderUnit.normalizedUnit) {
    return {
      id: `${parameterToken.id}-header-unit`,
      rawText: parameterHeaderUnit.originalUnit || parameterHeaderUnit.normalizedUnit,
      normalizedText: parameterHeaderUnit.normalizedUnit,
      tokenType: "unit" as const,
      rowIndex: parameterToken.rowIndex,
      columnIndex: parameterToken.columnIndex,
      pageNumber: parameterToken.pageNumber,
      sheetName: parameterToken.sheetName,
    } satisfies DocToken;
  }

  return nearbyTokens.find(
    (token) =>
      token.tokenType === "unit" &&
      token.rowIndex === valueToken.rowIndex
  );
}

function confidenceRank(confidence: "high" | "medium" | "low") {
  if (confidence === "high") return 3;
  if (confidence === "medium") return 2;
  return 1;
}

function validateTextureTotal(values: ExtractedLabValue[]) {
  const sand = values.find((value) => value.normalizedParameter === "sand")?.normalizedValueNumber;
  const silt = values.find((value) => value.normalizedParameter === "silt")?.normalizedValueNumber;
  const clay = values.find((value) => value.normalizedParameter === "clay")?.normalizedValueNumber;

  if (sand === undefined || silt === undefined || clay === undefined) return null;

  const total = sand + silt + clay;
  if (total < 95 || total > 105) {
    return "texture sand+silt+clay should be near 100 if all are present";
  }

  return null;
}

