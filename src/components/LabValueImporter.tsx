"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCcw,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import {
  extractLabIntelligently,
  type DocToken,
} from "@/lib/import/intelligentLabExtractor";
import type { Language } from "@/lib/translations";
import { canConvertLabUnit } from "@/lib/unitConversions";

type ImportMode = "scan" | "import";

type ParameterForImport = {
  parameter_key: string;
  parameter_id: number | null;
  custom_parameter_id: number | null;
  parameter_name: string;
  display_name: string;
  aliases?: string[];
  symbol: string | null;
  category: string | null;
  unit_id: number;
  unit_symbol: string;
  is_custom: boolean;
  available_units: {
    unit_id: number;
    unit_symbol: string;
    display_symbol: string;
  }[];
};

type ImportedRow = {
  parameter: string;
  value: string;
  unit?: string;
  symbol?: string;
  sample?: string;
  method?: string;
  confidence?: number;
  source?: string;
};

type ImportMetadata = {
  labName?: string;
  clientName?: string;
  farmName?: string;
  lotName?: string;
  cropName?: string;
  reportDate?: string;
  sampleId?: string;
  analysisType?: string;
};

type ImportPreviewRow = {
  id: string;
  rowNumber: number;
  rawParameter: string;
  matchedParameterKey: string | null;
  value: string;
  unit: string | null;
  sampleName: string | null;
  source: string | null;
  selectedUnitId: number | null;
  selectedUnitDisplayKey: string | null;
  status: "matched" | "unmatched" | "invalid";
  message: string;
  selected: boolean;
};

type AiImportPayload = {
  text: string;
  tokens?: DocToken[];
  rows?: ImportedRow[];
  metadata?: ImportMetadata;
  engine?: "ai";
  warning?: string;
};

function repairImportedRow(row: ImportedRow): ImportedRow {
  const originalParameter = String(row.parameter || "");
  const originalValue = String(row.value || "");
  const parameterNormalized = normalizeText(originalParameter.replace(/_/g, " "));
  const symbolNormalized = normalizeText(String(row.symbol || ""));
  const leadingNumericToken = originalParameter.match(
    /^\s*([<>]?\s*[+-]?\d+(?:[.,]\d+)?)(?:\s*[-_:]?\s*)(.+)$/
  );
  const parameterNumber = parseImportedResultValue(originalParameter);
  const valueNumber = parseImportedResultValue(originalValue);
  const parameterLooksLikePh =
    /\bph\b/.test(parameterNormalized) || symbolNormalized === "ph";

  if (parameterLooksLikePh && parameterNumber) {
    const parameterWithinPhRange =
      Number(parameterNumber) >= 3 && Number(parameterNumber) <= 10;
    const suspiciousValue =
      !valueNumber || valueNumber === "0" || (Number(valueNumber) <= 2 && Number(parameterNumber) >= 3.5);
    const outOfPhRange = valueNumber ? Number(valueNumber) > 12 : false;
    if (parameterWithinPhRange && (suspiciousValue || outOfPhRange)) {
      return {
        ...row,
        parameter: "pH",
        value: parameterNumber,
        unit: row.unit && row.unit.trim() ? row.unit : "pH",
        source: [row.source, "auto-fixed pH value from merged OCR text"]
          .filter(Boolean)
          .join(" | "),
      };
    }
  }

  if (!leadingNumericToken) return row;

  const candidateValue = parseImportedResultValue(leadingNumericToken[1]);
  const trailingLabel = String(leadingNumericToken[2] || "").trim();
  const trailingNormalized = normalizeText(trailingLabel.replace(/_/g, " "));

  if (!candidateValue) return row;

  const looksLikeUnitHeader =
    /\bunit\b/.test(trailingNormalized) || /_unit/i.test(originalParameter);
  const looksLikePhLabel =
    /\bph\b/.test(trailingNormalized) || symbolNormalized === "ph";

  if (looksLikePhLabel || looksLikeUnitHeader) {
    return {
      ...row,
      parameter: looksLikePhLabel ? "pH" : trailingLabel || row.parameter,
      value: candidateValue,
      unit:
        row.unit && row.unit.trim()
          ? row.unit
          : looksLikePhLabel
            ? "pH"
            : row.unit,
      source: [row.source, "auto-fixed from merged OCR row"]
        .filter(Boolean)
        .join(" | "),
    };
  }

  return row;
}

type Props = {
  open: boolean;
  mode?: ImportMode;
  autoRestoreToken?: number;
  onClose: () => void;
  language: Language;
  parameters: ParameterForImport[];
  existingValues?: Record<string, string>;
  onRequestCreateParameter?: (draft: {
    parameterName: string;
    unitSymbol?: string;
  }) => void;
  onImportValues: (
    importedValues: Record<string, string>,
    importedUnits: Record<string, number>,
    metadata?: ImportMetadata,
    importedUnitDisplayKeys?: Record<string, string>
  ) => void;
};

const IMPORT_MEMORY_KEY = "alakay_import_memory";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[\u2080\u2070]/g, "0")
    .replace(/[\u2081\u00b9]/g, "1")
    .replace(/[\u2082\u00b2]/g, "2")
    .replace(/[\u2083\u00b3]/g, "3")
    .replace(/[\u2084\u2074]/g, "4")
    .replace(/[\u2085\u2075]/g, "5")
    .replace(/[\u2086\u2076]/g, "6")
    .replace(/[\u2087\u2077]/g, "7")
    .replace(/[\u2088\u2078]/g, "8")
    .replace(/[\u2089\u2079]/g, "9")
    .replace(/[\u207a\u208a]/g, "+")
    .replace(/[\u207b\u208b]/g, "-")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()%/.,;:_-]/g, " ")
    .replace(/\s+/g, " ");
}

const IMPORT_PARAMETER_ALIASES: Record<string, string[]> = {
  ph: ["ph", "ph unit", "soil ph", "ph suelo", "ph agua", "ph h2o", "ph kcl", "reaction"],
  electrical_conductivity: [
    "ce",
    "ec",
    "conductividad electrica",
    "electrical conductivity",
    "cond electrica",
    "soluble salts",
    "sales solubles",
  ],
  cec: [
    "cice",
    "c i c e",
    "cic",
    "cec",
    "c e c",
    "c.e.c.",
    "c.i.c.",
    "c.i.c.e.",
    "cation exchange capacity",
    "capacidad de intercambio cationico efectiva",
    "capacidad de intercambio cationico",
    "capacidad de intercambio catiónico efectiva",
    "capacidad de intercambio catiónico",
  ],
  organic_matter: ["mo", "om", "materia organica", "organic matter", "matiere organique"],
  organic_carbon: ["co", "coox", "carbono organico", "carbono organico oxidable", "organic carbon"],
  nitrogen: ["n", "nitrogeno", "nitrogen", "n total", "nitrogeno total", "total nitrogen"],
  nitrate: ["no3", "no3 n", "n no3", "n-no3", "nitrato", "nitrate", "nitrate nitrogen"],
  ammonium: ["nh4", "nh4 n", "n nh4", "n-nh4", "amonio", "ammonium", "ammonium nitrogen"],
  phosphorus: ["p", "fosforo", "phosphorus", "phosphore"],
  phosphorus_olsen: ["p olsen", "fosforo olsen", "phosphorus olsen", "nahco3 p", "nahco3-p"],
  phosphorus_bray: ["p bray", "fosforo bray", "phosphorus bray"],
  phosphorus_mehlich: ["p mehlich", "fosforo mehlich", "phosphorus mehlich"],
  potassium: ["k", "potasio", "potassium", "potasio intercambiable", "exchangeable potassium"],
  calcium: ["ca", "calcio", "calcium", "calcio intercambiable", "exchangeable calcium"],
  magnesium: ["mg", "magnesio", "magnesium", "magnesio intercambiable", "exchangeable magnesium"],
  sodium: [
    "na",
    "na intercambiable",
    "na exchangeable",
    "exchangeable na",
    "sodio",
    "sodium",
    "sodio intercambiable",
    "sodium exchangeable",
    "exchangeable sodium",
  ],
  exchangeable_acidity: [
    "acidez",
    "acidez intercambiable",
    "ac inter",
    "ac interc",
    "h al",
    "h+al",
    "exchangeable acidity",
  ],
  sulfur: ["s", "azufre", "sulfur", "sulphur", "soufre"],
  iron: ["fe", "hierro", "iron", "fer"],
  zinc: ["zn", "zinc"],
  manganese: ["mn", "manganeso", "manganese"],
  copper: ["cu", "cobre", "copper", "cuivre"],
  boron: ["b", "boro", "boron", "bore"],
  chloride: ["cl", "cloruro", "chloride"],
  bulk_density: ["da", "d a", "densidad aparente", "bulk density", "bd"],
  moisture: ["saturacion de humedad media", "humedad", "moisture", "humidity", "water saturation"],
  clay: ["arcilla", "clay", "argile"],
  sand: ["arena", "sand", "sable"],
  silt: ["limo", "silt", "limon"],
  texture: ["textura", "texture", "soil texture"],
};

const ADDITIONAL_IMPORT_PARAMETER_ALIASES: Record<string, string[]> = {
  ph: [
    "p h",
    "ph unidad",
    "ph del suelo",
    "ph h₂o",
    "reaccion",
    "reaccion del suelo",
  ],
  electrical_conductivity: [
    "c e",
    "e c",
    "conductivity",
    "conductividad",
    "conductividad electrica ce",
    "conductividad electrica ec",
    "salinidad",
  ],
  cec: [
    "effective cec",
    "effective cation exchange capacity",
    "capacidad intercambio cationico",
    "capacidad intercambio cationico efectiva",
    "intercambio cationico",
    "intercambio cationico efectivo",
  ],
  organic_matter: [
    "m o",
    "o m",
    "materia organica total",
  ],
  organic_carbon: [
    "c o",
    "carbono",
  ],
  phosphorus: ["fosforo disponible", "available phosphorus"],
  potassium: ["k intercambiable", "exchangeable k"],
  calcium: ["ca intercambiable", "exchangeable ca"],
  magnesium: ["mg intercambiable", "exchangeable mg"],
  exchangeable_acidity: ["al h", "al+h", "h aluminio", "aluminio hidrogeno"],
  chloride: ["chlorine"],
  bulk_density: ["densidad aparente da", "apparent density"],
  moisture: [
    "saturacion humedad",
    "humedad media",
    "soil moisture",
  ],
  clay: ["particula arcilla"],
  sand: ["particula arena"],
  silt: ["particula limo"],
  base_saturation: ["sb", "v", "v%", "sat bases", "saturacion de bases", "base saturation", "bases saturation"],
};

function getImportParameterAliasEntries() {
  const merged = new Map<string, string[]>();

  for (const [family, aliases] of Object.entries(IMPORT_PARAMETER_ALIASES)) {
    merged.set(family, [...aliases]);
  }

  for (const [family, aliases] of Object.entries(ADDITIONAL_IMPORT_PARAMETER_ALIASES)) {
    merged.set(family, [...(merged.get(family) || []), ...aliases]);
  }

  return Array.from(merged.entries());
}

function normalizeScannedText(value: string) {
  return value
    .replace(/[|]/g, " ")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\bO(?=[.,]?\d)/gi, "0")
    .replace(/\bI(?=[.,]?\d)/g, "1")
    .replace(/\bS(?=\d)/g, "5")
    .replace(/\s+/g, " ")
    .trim();
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && nextCharacter === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (character === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (character === "," && !insideQuotes) {
      result.push(current.trim());
      current = "";
      continue;
    }

    current += character;
  }

  result.push(current.trim());
  return result;
}

function parseCsv(text: string): ImportedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = splitCsvLine(lines[0]).map((header) => normalizeText(header));
  const parameterIndex = headers.findIndex((header) =>
    ["parameter", "parametro", "parametre", "name", "nombre", "nom"].includes(
      header
    )
  );
  const valueIndex = headers.findIndex((header) =>
    ["value", "valor", "valeur", "result", "resultado", "resultat"].includes(
      header
    )
  );
  const unitIndex = headers.findIndex((header) =>
    ["unit", "unidad", "unite", "units", "unit symbol", "unit_symbol"].includes(
      header
    )
  );
  const sampleIndex = headers.findIndex((header) =>
    [
      "sample",
      "sample id",
      "sample_id",
      "lot",
      "lote",
      "plot",
      "parcela",
      "muestra",
      "echantillon",
    ].includes(header)
  );

  if (parameterIndex === -1 || valueIndex === -1) {
    throw new Error("CSV must include parameter and value columns.");
  }

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    return {
      parameter: cells[parameterIndex] || "",
      value: cells[valueIndex] || "",
      unit: unitIndex >= 0 ? cells[unitIndex] || "" : "",
      sample: sampleIndex >= 0 ? cells[sampleIndex] || "" : "",
      source: "CSV",
    };
  });
}

function buildParameterSearchMap(parameters: ParameterForImport[]) {
  const map = new Map<string, ParameterForImport>();

  for (const parameter of parameters) {
    for (const name of getParameterSearchTerms(parameter)) {
      map.set(normalizeText(name), parameter);
    }
  }

  return map;
}

function getParameterAliasTerms(parameter: ParameterForImport) {
  const combined = normalizeText(
    `${parameter.parameter_name} ${parameter.display_name} ${parameter.symbol || ""} ${(parameter.aliases || []).join(" ")}`
  );
  const aliases = new Set<string>();

  for (const [, terms] of getImportParameterAliasEntries()) {
    const familyMatch = terms.some((term) => {
      const normalizedTerm = normalizeText(term);
      const combinedTokens = tokenSet(combined);
      const termTokens = tokenSet(normalizedTerm);

      if (normalizedTerm.length <= 2) {
        return termTokens.size === 1 && combinedTokens.has(normalizedTerm);
      }

      return (
        combined === normalizedTerm ||
        combined.includes(normalizedTerm) ||
        normalizedTerm.includes(combined)
      );
    });

    if (familyMatch) {
      terms.forEach((term) => aliases.add(term));
    }
  }

  return Array.from(aliases);
}

function extractSymbolHint(value: string) {
  const parenthesized = value.match(/\(([A-Za-z][A-Za-z0-9+\-]{0,5})\)/);
  if (parenthesized?.[1]) return normalizeText(parenthesized[1]);
  return "";
}

function detectAliasFamilies(value: string) {
  const normalized = normalizeText(value);
  const tokens = tokenSet(normalized);
  const families = new Set<string>();

  for (const [family, aliases] of getImportParameterAliasEntries()) {
    const matched = aliases.some((alias) => {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias) return false;
      if (normalizedAlias.length <= 2) return tokens.has(normalizedAlias);
      return (
        normalized === normalizedAlias ||
        normalized.includes(normalizedAlias) ||
        normalizedAlias.includes(normalized)
      );
    });
    if (matched) families.add(family);
  }

  return families;
}

function hasFamilyOverlap(left: Set<string>, right: Set<string>) {
  if (left.size === 0 || right.size === 0) return false;
  return [...left].some((family) => right.has(family));
}

function looksLikeSodiumName(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (/\b(nitrate|nitrato|nitrogen|nitrogeno)\b/.test(normalized)) return false;
  return /\b(na|sodium|sodio)\b/.test(normalized);
}

function looksLikePhName(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return /\bph\b/.test(normalized);
}

function looksLikeCecName(value: string) {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  return /\b(cec|cic|cice|cation exchange capacity|intercambio cationico)\b/.test(
    normalized
  );
}

function isSodiumParameter(parameter: ParameterForImport) {
  return getParameterSearchTerms(parameter).some((term) => looksLikeSodiumName(term));
}

function isPhParameter(parameter: ParameterForImport) {
  return getParameterSearchTerms(parameter).some((term) => looksLikePhName(term));
}

function isCecParameter(parameter: ParameterForImport) {
  return getParameterSearchTerms(parameter).some((term) => looksLikeCecName(term));
}

function parameterHasKclHint(parameter: ParameterForImport) {
  return getParameterSearchTerms(parameter).some((term) =>
    /\bkcl\b/.test(normalizeText(term))
  );
}

function parameterHasWaterHint(parameter: ParameterForImport) {
  return getParameterSearchTerms(parameter).some((term) =>
    /\b(h2o|water|agua)\b/.test(normalizeText(term))
  );
}

function forcePhParameterMatch(
  rawName: string,
  current: ParameterForImport | null,
  parameters: ParameterForImport[],
  rawSymbolHint?: string,
  methodHint?: string
) {
  const combinedHint = `${rawName} ${rawSymbolHint || ""} ${methodHint || ""}`;
  if (!looksLikePhName(combinedHint)) return current;
  if (current && isPhParameter(current)) return current;

  const phCandidates = parameters.filter((parameter) => isPhParameter(parameter));
  if (phCandidates.length === 0) return current;

  const normalizedHint = normalizeText(combinedHint);
  const wantsKcl = /\bkcl\b/.test(normalizedHint);
  const wantsWater = /\b(h2o|water|agua)\b/.test(normalizedHint);

  if (wantsKcl) {
    const kcl = phCandidates.find((parameter) => parameterHasKclHint(parameter));
    if (kcl) return kcl;
  }

  if (wantsWater) {
    const water = phCandidates.find((parameter) => parameterHasWaterHint(parameter));
    if (water) return water;
  }

  const ranked = phCandidates
    .map((parameter) => ({
      parameter,
      score: parameterMatchScore(rawName, getParameterSearchTerms(parameter)),
    }))
    .sort((left, right) => right.score - left.score);

  const preferred =
    ranked.find(({ parameter }) => parameterHasWaterHint(parameter)) ||
    ranked.find(({ parameter }) => !parameterHasKclHint(parameter)) ||
    ranked[0];

  return preferred?.parameter || current;
}

function forceCecParameterMatch(
  rawName: string,
  current: ParameterForImport | null,
  parameters: ParameterForImport[]
) {
  if (!looksLikeCecName(rawName)) return current;
  if (current && isCecParameter(current)) return current;

  const cecCandidates = parameters.filter((parameter) => isCecParameter(parameter));
  if (cecCandidates.length === 0) return current;

  const ranked = cecCandidates
    .map((parameter) => ({
      parameter,
      score: parameterMatchScore(rawName, getParameterSearchTerms(parameter)),
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.parameter || current;
}

function forceCriticalParameterMatch(
  rawName: string,
  current: ParameterForImport | null,
  parameters: ParameterForImport[],
  rawSymbolHint?: string,
  methodHint?: string
) {
  const phHint = `${rawName} ${rawSymbolHint || ""} ${methodHint || ""}`;
  if (looksLikePhName(phHint)) {
    return forcePhParameterMatch(
      rawName,
      current,
      parameters,
      rawSymbolHint,
      methodHint
    );
  }

  if (looksLikeCecName(rawName)) {
    return forceCecParameterMatch(rawName, current, parameters);
  }

  if (looksLikeSodiumName(rawName)) {
    return forceSodiumParameterMatch(rawName, current, parameters);
  }

  return current;
}

function forceSodiumParameterMatch(
  rawName: string,
  current: ParameterForImport | null,
  parameters: ParameterForImport[]
) {
  if (!looksLikeSodiumName(rawName)) return current;
  if (current && isSodiumParameter(current)) return current;

  const sodiumCandidates = parameters.filter((parameter) => isSodiumParameter(parameter));
  if (sodiumCandidates.length === 0) return current;

  const ranked = sodiumCandidates
    .map((parameter) => ({
      parameter,
      score: parameterMatchScore(rawName, getParameterSearchTerms(parameter)),
    }))
    .sort((left, right) => right.score - left.score);

  return ranked[0]?.parameter || current;
}

function tokenSet(value: string) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function parameterMatchScore(rawName: string, terms: string[]) {
  const normalizedRawName = normalizeText(rawName);
  if (!normalizedRawName) return 0;

  let best = 0;
  const rawTokens = tokenSet(normalizedRawName);

  for (const term of terms) {
    const normalizedTerm = normalizeText(term);
    if (!normalizedTerm) continue;

    if (normalizedRawName === normalizedTerm) {
      best = Math.max(best, 1);
      continue;
    }

    const termTokens = tokenSet(normalizedTerm);
    const everyTermTokenPresent = [...termTokens].every((token) => rawTokens.has(token));
    if (everyTermTokenPresent && termTokens.size > 0) {
      best = Math.max(best, termTokens.size === rawTokens.size ? 0.96 : 0.88);
    }

    if (
      normalizedTerm.length >= 4 &&
      new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`).test(normalizedRawName)
    ) {
      best = Math.max(best, 0.86);
    }
  }

  return best;
}

function findBestParameterMatch(
  rawName: string,
  parameters: ParameterForImport[],
  searchMap: Map<string, ParameterForImport>,
  rawSymbolHint?: string,
  methodHint?: string
) {
  const normalizedRawName = normalizeText(rawName);
  if (!normalizedRawName) return null;
  const normalizedRawSymbol = normalizeText(rawSymbolHint || extractSymbolHint(rawName));
  const rawFamilies = detectAliasFamilies(rawName);

  const ranked = parameters
    .map((parameter) => {
      const baseScore = parameterMatchScore(rawName, getParameterSearchTerms(parameter));
      const parameterSymbol = normalizeText(parameter.symbol || "");
      const parameterFamilies = detectAliasFamilies(
        `${parameter.display_name} ${parameter.parameter_name} ${parameter.symbol || ""} ${(parameter.aliases || []).join(" ")}`
      );
      const familyOverlap = hasFamilyOverlap(rawFamilies, parameterFamilies);

      let score = baseScore;

      if (normalizedRawSymbol) {
        if (parameterSymbol && parameterSymbol === normalizedRawSymbol) score += 0.3;
        else if (!familyOverlap && parameterSymbol && parameterSymbol !== normalizedRawSymbol)
          score -= 0.08;
      }

      if (rawFamilies.size > 0 && parameterFamilies.size > 0) {
        score += familyOverlap ? 0.25 : -0.2;
      }

      return { parameter, score };
    })
    .filter((match) => match.score >= 0.8)
    .sort((left, right) => right.score - left.score);

  const exactMatch = searchMap.get(normalizedRawName);
  if (exactMatch && ranked.length > 0) {
    const exactRanked = ranked.find(
      (item) => item.parameter.parameter_key === exactMatch.parameter_key
    );
    if (exactRanked && exactRanked.score >= ranked[0].score - 0.05) {
      return forceCriticalParameterMatch(
        rawName,
        exactMatch,
        parameters,
        rawSymbolHint,
        methodHint
      );
    }
  } else if (exactMatch) {
    return forceCriticalParameterMatch(
      rawName,
      exactMatch,
      parameters,
      rawSymbolHint,
      methodHint
    );
  }

  if (ranked.length === 0) {
    return forceCriticalParameterMatch(
      rawName,
      null,
      parameters,
      rawSymbolHint,
      methodHint
    );
  }
  if (rawFamilies.size > 0) {
    const familyRanked = ranked.filter((item) =>
      hasFamilyOverlap(
        rawFamilies,
        detectAliasFamilies(
          `${item.parameter.display_name} ${item.parameter.parameter_name} ${item.parameter.symbol || ""} ${(item.parameter.aliases || []).join(" ")}`
        )
      )
    );

    if (
      familyRanked.length > 0 &&
      (familyRanked[0].score >= 0.7 || familyRanked[0].score >= ranked[0].score - 0.25)
    ) {
      return forceCriticalParameterMatch(
        rawName,
        familyRanked[0].parameter,
        parameters,
        rawSymbolHint,
        methodHint
      );
    }
  }
  if (looksLikeSodiumName(rawName)) {
    const sodiumRank = ranked.find((item) => isSodiumParameter(item.parameter));
    if (sodiumRank && sodiumRank.score >= 0.55) {
      return sodiumRank.parameter;
    }
  }
  if (ranked[1] && ranked[0].score - ranked[1].score < 0.06) {
    return forceCriticalParameterMatch(
      rawName,
      ranked[0].parameter,
      parameters,
      rawSymbolHint,
      methodHint
    );
  }

  return forceCriticalParameterMatch(
    rawName,
    ranked[0].parameter,
    parameters,
    rawSymbolHint,
    methodHint
  );
}

function findUnitId(parameter: ParameterForImport, rawUnit: string | undefined) {
  return findUnitSelection(parameter, rawUnit).unitId;
}

function getUnitOptionKey(unit: {
  unit_id: number;
  unit_symbol: string;
  display_symbol: string;
}) {
  return `${unit.unit_id}::${unit.display_symbol || unit.unit_symbol}`;
}

function normalizeUnitForMatching(value: string) {
  return normalizeText(value)
    .replace(/\bper\b/g, "/")
    .replace(/\s+/g, " ")
    .replace(/\b100\s*g\s*-?\s*1\b/g, "100g")
    .replace(/\bkg\s*-?\s*1\b/g, "kg")
    .replace(/\bcmolc\b/g, "cmol(+)")
    .trim();
}

function findUnitSelection(parameter: ParameterForImport, rawUnit: string | undefined) {
  const defaultOption =
    parameter.available_units.find((unit) => unit.unit_id === parameter.unit_id) ||
    parameter.available_units[0];

  if (!rawUnit?.trim()) {
    return {
      unitId: defaultOption?.unit_id || parameter.unit_id,
      displayKey: defaultOption ? getUnitOptionKey(defaultOption) : null,
      quality: "default" as const,
    };
  }

  const normalizedRawUnit = normalizeUnitForMatching(rawUnit);
  const rawUnitLiteral = rawUnit.trim().toLowerCase();
  const literalMatch = parameter.available_units.find((unit) => {
    return (
      String(unit.display_symbol || "").trim().toLowerCase() === rawUnitLiteral ||
      String(unit.unit_symbol || "").trim().toLowerCase() === rawUnitLiteral
    );
  });
  if (literalMatch) {
    return {
      unitId: literalMatch.unit_id,
      displayKey: getUnitOptionKey(literalMatch),
      quality: "exact" as const,
    };
  }

  const exactMatch = parameter.available_units.find((unit) => {
    return (
      normalizeUnitForMatching(unit.unit_symbol) === normalizedRawUnit ||
      normalizeUnitForMatching(unit.display_symbol) === normalizedRawUnit
    );
  });

  if (exactMatch) {
    return {
      unitId: exactMatch.unit_id,
      displayKey: getUnitOptionKey(exactMatch),
      quality: "exact" as const,
    };
  }

  const compatibleMatch = parameter.available_units.find((unit) =>
    canConvertLabUnit(rawUnit, unit.unit_symbol || unit.display_symbol)
  );

  if (compatibleMatch) {
    return {
      unitId: compatibleMatch.unit_id,
      displayKey: getUnitOptionKey(compatibleMatch),
      quality: "compatible" as const,
    };
  }

  const selected = defaultOption;
  return {
    unitId: selected?.unit_id || parameter.unit_id,
    displayKey: selected ? getUnitOptionKey(selected) : null,
    quality: "none" as const,
  };
}

function getParameterLabel(parameter: ParameterForImport) {
  return `${parameter.display_name}${
    parameter.symbol ? ` (${parameter.symbol})` : ""
  }${parameter.is_custom ? " - Custom" : ""}`;
}

function getTextureClass(parameter: ParameterForImport | null | undefined) {
  if (!parameter) return null;
  const text = normalizeText(
    `${parameter.display_name} ${parameter.parameter_name} ${parameter.symbol || ""} ${(parameter.aliases || []).join(" ")}`
  );
  if (/\b(sand|arena|sable)\b/.test(text)) return "sand";
  if (/\b(silt|limo|limon)\b/.test(text)) return "silt";
  if (/\b(clay|arcilla|argile)\b/.test(text)) return "clay";
  return null;
}

function readImportMemory(): AiImportPayload | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(IMPORT_MEMORY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AiImportPayload;
    if (!parsed.text && !parsed.rows?.length) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveImportMemory(payload: AiImportPayload) {
  if (typeof window === "undefined") return;
  const memory = {
    ...payload,
    savedAt: new Date().toISOString(),
  };
  window.localStorage.setItem(IMPORT_MEMORY_KEY, JSON.stringify(memory));
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getParameterSearchTerms(parameter: ParameterForImport) {
  return [
    parameter.display_name,
    parameter.parameter_name,
    parameter.symbol || "",
    ...(parameter.aliases || []),
    parameter.symbol ? `${parameter.display_name} ${parameter.symbol}` : "",
    parameter.symbol ? `${parameter.parameter_name} ${parameter.symbol}` : "",
    ...getParameterAliasTerms(parameter),
  ]
    .filter(Boolean)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
}

function parseNumber(raw: string) {
  const cleaned = raw.replace(",", ".").replace(/[^\d.+-]/g, "");
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function normalizeNumericValue(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const numeric = parseNumber(trimmed);
  if (numeric === null) return "";
  return String(numeric);
}

function parseImportedResultValue(raw: string) {
  const text = normalizeScannedText(raw).trim();
  if (!text) return null;

  const match = text.match(/[+-]?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  return normalizeNumericValue(match[0]) || null;
}

function extractFirstValue(text: string) {
  const match = normalizeScannedText(text).match(/[-+]?\d+(?:[.,]\d+)?/);
  if (!match) return null;
  return parseNumber(match[0]);
}

function extractUnit(text: string, parameter: ParameterForImport) {
  const normalizedText = normalizeText(text);
  const unit = parameter.available_units.find((option) => {
    return [option.unit_symbol, option.display_symbol]
      .filter(Boolean)
      .some((symbol) => normalizedText.includes(normalizeText(symbol)));
  });

  return unit?.display_symbol || unit?.unit_symbol || "";
}

function lineLooksLikeAnotherParameter(
  line: string,
  currentParameter: ParameterForImport,
  allParameters: ParameterForImport[]
) {
  const normalizedLine = normalizeText(line);

  return allParameters.some((parameter) => {
    if (parameter.parameter_key === currentParameter.parameter_key) return false;
    return getParameterSearchTerms(parameter).some((term) => {
      const normalizedTerm = normalizeText(term);
      return (
        normalizedTerm.length >= 2 &&
        (normalizedLine === normalizedTerm ||
          normalizedLine.startsWith(`${normalizedTerm} `))
      );
    });
  });
}

function countParameterMentions(line: string, parameters: ParameterForImport[]) {
  const normalizedLine = normalizeText(line);
  const seen = new Set<string>();

  for (const parameter of parameters) {
    const matched = getParameterSearchTerms(parameter).some((term) => {
      const normalizedTerm = normalizeText(term);
      return (
        normalizedTerm.length >= 2 &&
        new RegExp(`(^|\\s)${escapeRegExp(normalizedTerm)}(\\s|$)`).test(
          normalizedLine
        )
      );
    });

    if (matched) seen.add(parameter.parameter_key);
  }

  return seen.size;
}

function looksLikeNarrativeSummary(
  line: string,
  parameters: ParameterForImport[]
) {
  const normalizedLine = normalizeText(line);
  const parameterMentions = countParameterMentions(line, parameters);
  const hasSummaryLanguage =
    /\b(informe|report|analisis|analysis|resultados|results|incluyen|include|presenta|present|datos|data|detected|extracted|uploaded|documento|document)\b/.test(
      normalizedLine
    );
  const hasConnectorList = /\b(y|and|as well as|asi como|tambien)\b/.test(normalizedLine);

  return (
    (normalizedLine.length > 90 && parameterMentions >= 2 && hasSummaryLanguage) ||
    (parameterMentions >= 3 && hasConnectorList) ||
    /\b(con datos sobre|data for|report text|uploaded document|documento cargado)\b/.test(
      normalizedLine
    )
  );
}

function parseLooseDocumentText(
  text: string,
  parameters: ParameterForImport[]
): ImportedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeScannedText(line))
    .filter(
      (line) => line.length > 0 && !looksLikeNarrativeSummary(line, parameters)
    );
  const rows: ImportedRow[] = [];
  const seen = new Set<string>();

  function addRow(
    parameter: ParameterForImport,
    value: number,
    unit: string,
    confidence: number,
    source: string
  ) {
    const key = parameter.parameter_key;
    const existingIndex = rows.findIndex((row) => row.parameter === key);

    if (seen.has(key) && existingIndex === -1) return;
    seen.add(key);

    const row = {
      parameter: parameter.display_name || parameter.parameter_name,
      value: String(value),
      unit,
      confidence,
      source,
    };

    if (existingIndex >= 0) {
      rows[existingIndex] = row;
      return;
    }

    rows.push(row);
  }

  for (const parameter of parameters) {
    const terms = getParameterSearchTerms(parameter);

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      const nextLine = lines[index + 1] || "";
      const secondNextLine = lines[index + 2] || "";
      const previousLine = lines[index - 1] || "";
      const lineNorm = normalizeText(line);
      const previousNorm = normalizeText(previousLine);

      const matchedTerm = terms.find((term) => {
        const termNorm = normalizeText(term);
        return (
          lineNorm.includes(termNorm) ||
          (previousNorm === termNorm && extractFirstValue(line) !== null)
        );
      });

      if (!matchedTerm) continue;

      const termRegex = new RegExp(escapeRegExp(matchedTerm), "i");
      const sameLineCandidate = line.replace(termRegex, " ");
      const sameLineValue = extractFirstValue(sameLineCandidate);
      const nextLineValue = lineLooksLikeAnotherParameter(
        nextLine,
        parameter,
        parameters
      )
        ? null
        : extractFirstValue(nextLine);
      const secondNextLineValue = lineLooksLikeAnotherParameter(
        secondNextLine,
        parameter,
        parameters
      )
        ? null
        : extractFirstValue(secondNextLine);

      const value =
        sameLineValue ??
        nextLineValue ??
        (nextLine.length < 8 ? secondNextLineValue : null);

      if (value === null) continue;

      const confidence = sameLineValue !== null ? 0.92 : 0.78;
      addRow(
        parameter,
        value,
        extractUnit(`${line} ${nextLine} ${secondNextLine}`, parameter),
        confidence,
        "document"
      );
      break;
    }
  }

  if (rows.length > 0) return rows;

  const searchMap = buildParameterSearchMap(parameters);
  for (const line of lines) {
    const value = extractFirstValue(line);
    if (value === null) continue;

    const parameterText = line.replace(/[-+]?\d+(?:[.,]\d+)?.*$/, "").trim();
    const parameter = findBestParameterMatch(
      parameterText,
      parameters,
      searchMap
    );
    if (!parameter) continue;

    addRow(parameter, value, extractUnit(line, parameter), 0.68, "document");
  }

  return rows;
}

async function extractPdfText(buffer: ArrayBuffer) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const document = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    const text = content.items
      .map((item) => ("str" in item ? item.str : ""))
      .join("\n");

    pages.push(text);
  }

  return pages.join("\n");
}

async function renderPdfPagesForAi(buffer: ArrayBuffer, maxPages = 3) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.mjs",
    import.meta.url
  ).toString();

  const document = await pdfjs.getDocument({ data: buffer.slice(0) }).promise;
  const blobs: Blob[] = [];
  const pageCount = Math.min(document.numPages, maxPages);

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = window.document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) continue;

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);

   await page.render({ canvasContext: context, viewport }).promise;;

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/png", 0.95)
    );

    if (blob) blobs.push(blob);
  }

  return blobs;
}

async function prepareImageForAi(input: Blob) {
  const bitmap = await createImageBitmap(input);
  const maxWidth = 1800;
  const scale = bitmap.width < maxWidth ? maxWidth / bitmap.width : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = window.document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  if (!context) return input;

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);

  const imageData = context.getImageData(0, 0, width, height);
  for (let index = 0; index < imageData.data.length; index += 4) {
    const red = imageData.data[index];
    const green = imageData.data[index + 1];
    const blue = imageData.data[index + 2];
    const gray = red * 0.299 + green * 0.587 + blue * 0.114;
    const contrasted = gray > 178 ? 255 : gray < 112 ? 0 : gray * 1.12;
    imageData.data[index] = contrasted;
    imageData.data[index + 1] = contrasted;
    imageData.data[index + 2] = contrasted;
  }

  context.putImageData(imageData, 0, 0);
  bitmap.close();

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob || input), "image/png", 0.95);
  });
}

async function recognizeImage(blob: Blob, language: Language) {
  const preparedImage = await prepareImageForAi(blob);
  const formData = new FormData();
  formData.append("image", preparedImage, "lab-report.png");
  formData.append("language", language);

  const response = await fetch("/api/ai-import", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "Photo analysis failed.");
  }

  const payload = (await response.json()) as Partial<AiImportPayload>;
  return {
    text: payload.text || "",
    tokens: payload.tokens || [],
    rows: payload.rows || [],
    metadata: payload.metadata,
    engine: payload.engine,
    warning: payload.warning,
  } satisfies AiImportPayload;
}

async function recognizeExtractedContentWithAi(options: {
  text?: string;
  tableRows?: string[][];
  language: Language;
}) {
  const formData = new FormData();
  const text = options.text?.trim() || "";

  if (text) formData.append("text", text);
  formData.append("language", options.language);
  if (options.tableRows?.length) {
    formData.append("table", JSON.stringify(options.tableRows.slice(0, 300)));
  }

  const response = await fetch("/api/ai-import", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.error || "AI import failed.");
  }

  const payload = (await response.json()) as Partial<AiImportPayload>;
  return {
    text: payload.text || text,
    tokens: payload.tokens || [],
    rows: payload.rows || [],
    metadata: payload.metadata,
    engine: payload.engine,
    warning: payload.warning,
  } satisfies AiImportPayload;
}

export default function LabValueImporter({
  open,
  mode = "import",
  autoRestoreToken = 0,
  onClose,
  language,
  parameters,
  existingValues = {},
  onRequestCreateParameter,
  onImportValues,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [showTextReview, setShowTextReview] = useState(false);
  const [importMetadata, setImportMetadata] = useState<ImportMetadata | undefined>();
  const [hasImportMemory, setHasImportMemory] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const parameterByKey = useMemo(() => {
    const map = new Map<string, ParameterForImport>();

    for (const parameter of parameters) {
      map.set(parameter.parameter_key, parameter);
    }

    return map;
  }, [parameters]);

  const selectedRows = previewRows.filter(
    (row) => row.selected && row.status === "matched" && row.matchedParameterKey
  );

  const overwriteCount = selectedRows.filter((row) => {
    if (!row.matchedParameterKey) return false;
    return Boolean(existingValues[row.matchedParameterKey]?.trim());
  }).length;

  const textureSummary = useMemo(() => {
    const bucket = { sand: null as number | null, silt: null as number | null, clay: null as number | null };

    for (const row of previewRows) {
      if (!row.matchedParameterKey) continue;
      const parameter = parameterByKey.get(row.matchedParameterKey);
      const klass = getTextureClass(parameter);
      if (!klass) continue;
      const value = Number(row.value.replace(",", "."));
      if (!Number.isFinite(value)) continue;
      bucket[klass] = value;
    }

    const found = ["sand", "silt", "clay"].filter((item) => bucket[item as keyof typeof bucket] !== null).length;
    const complete = found === 3;
    const total = complete ? (bucket.sand || 0) + (bucket.silt || 0) + (bucket.clay || 0) : null;
    const withinRange = total !== null ? total >= 95 && total <= 105 : false;

    return {
      found,
      complete,
      total,
      withinRange,
      values: bucket,
    };
  }, [previewRows, parameterByKey]);

  useEffect(() => {
    if (!open) return;
    setHasImportMemory(Boolean(readImportMemory()));
    if (mode === "scan") {
      void startCamera();
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open) return;
    if (!autoRestoreToken) return;
    loadLastImport();
  }, [open, autoRestoreToken]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function startCamera() {
    setCameraError("");

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera is not available on this browser.");
      }

      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setCameraReady(true);
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : "Camera could not be opened. You can still import a photo."
      );
      setCameraReady(false);
    }
  }

  function resetImporter() {
    setPreviewRows([]);
    setMessage("");
    setDocumentText("");
    setShowTextReview(false);
    setImportMetadata(undefined);
    setCameraError("");

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function closeModal() {
    stopCamera();
    resetImporter();
    onClose();
  }

  function buildPreview(rows: ImportedRow[]) {
    const searchMap = buildParameterSearchMap(parameters);

    const preview = rows.map((unsafeRow, index) => {
      const row = repairImportedRow(unsafeRow);
      const matchedParameter = findBestParameterMatch(
        row.parameter,
        parameters,
        searchMap,
        row.symbol,
        row.method
      );
      const parsedValue = parseImportedResultValue(String(row.value));
      const baseId = `${index + 2}-${row.parameter}-${row.value}`;
      const sourceDetail =
        [row.source || "", row.method ? `method: ${row.method}` : ""]
          .filter(Boolean)
          .join(" | ") || null;

      if (!row.parameter.trim()) {
        return {
          id: baseId,
          rowNumber: index + 2,
          rawParameter: row.parameter,
          matchedParameterKey: null,
          value: row.value,
          unit: row.unit || null,
          sampleName: row.sample || null,
          source: sourceDetail,
          selectedUnitId: null,
          selectedUnitDisplayKey: null,
          status: "invalid" as const,
          message: "Missing parameter name.",
          selected: false,
        };
      }

      if (!row.value.trim() || !parsedValue) {
        return {
          id: baseId,
          rowNumber: index + 2,
          rawParameter: row.parameter,
          matchedParameterKey: matchedParameter?.parameter_key || null,
          value: row.value,
          unit: row.unit || null,
          sampleName: row.sample || null,
          source: sourceDetail,
          selectedUnitId: matchedParameter
            ? findUnitId(matchedParameter, row.unit)
            : null,
          selectedUnitDisplayKey: matchedParameter
            ? findUnitSelection(matchedParameter, row.unit).displayKey
            : null,
          status: "invalid" as const,
          message: "Invalid numeric value.",
          selected: false,
        };
      }

      if (!matchedParameter) {
        return {
          id: baseId,
          rowNumber: index + 2,
          rawParameter: row.parameter,
          matchedParameterKey: null,
          value: parsedValue,
          unit: row.unit || null,
          sampleName: row.sample || null,
          source: sourceDetail,
          selectedUnitId: null,
          selectedUnitDisplayKey: null,
          status: "unmatched" as const,
          message: "Choose a parameter.",
          selected: false,
        };
      }

      const selectedUnit = findUnitSelection(matchedParameter, row.unit);
      const requiresUnitReview =
        Boolean(row.unit?.trim()) && selectedUnit.quality === "none";

      return {
        id: baseId,
        rowNumber: index + 2,
        rawParameter: row.parameter,
        matchedParameterKey: matchedParameter.parameter_key,
        value: parsedValue,
        unit: row.unit?.trim() || null,
        sampleName: row.sample || null,
        source: sourceDetail,
        selectedUnitId: selectedUnit.unitId,
        selectedUnitDisplayKey: selectedUnit.displayKey,
        status: requiresUnitReview ? ("unmatched" as const) : ("matched" as const),
        message: requiresUnitReview
          ? "Review unit."
          : row.confidence && row.confidence < 0.75
            ? "Review match."
            : selectedUnit.quality === "compatible"
              ? "Ready (unit equivalent)."
              : "Ready.",
        selected: !requiresUnitReview,
      };
    });

    setPreviewRows(preview);

    const matched = preview.filter((row) => row.status === "matched").length;
    const failed = preview.length - matched;

    setMessage(`${matched} value(s) found. ${failed} need review.`);
  }

  function buildDocumentPreview(text: string) {
    const rows = extractRowsWithIntelligence(text);

    if (rows.length === 0) {
      setPreviewRows([]);
      setMessage(
        "No lab values were detected. Try a clearer photo, another file, or paste the report text."
      );
      return;
    }

    buildPreview(rows);
  }

  function buildAiDocumentPreview(payload: AiImportPayload, sourceLabel: string) {
    const text = payload.text || "";
    setDocumentText(text);
    setShowTextReview(true);
    setImportMetadata(payload.metadata);
    saveImportMemory(payload);
    setHasImportMemory(true);

    const rows = payload.rows?.length
      ? payload.rows
      : payload.tokens?.length
        ? extractRowsWithIntelligence(payload.tokens)
        : [];

    if (rows.length === 0) {
      setPreviewRows([]);
      setMessage(
        payload.warning ||
          "The AI read the document text but did not return structured lab rows. Try a clearer scan or adjust the detected text before reviewing values."
      );
      return;
    }

    buildPreview(rows);
    setMessage(`${sourceLabel} analyzed with AI import.`);
  }

  function loadLastImport() {
    const memory = readImportMemory();
    if (!memory) {
      setMessage("No saved import was found on this device.");
      return;
    }

    buildAiDocumentPreview(memory, "Saved import");
  }

  function extractRowsWithIntelligence(input: string | string[][] | DocToken[]) {
    const extraction = extractLabIntelligently(input);
    const rows = extraction.values
      .filter(
        (value) =>
          !looksLikeNarrativeSummary(value.originalLabel, parameters) &&
          !looksLikeNarrativeSummary(value.source?.bbox ? "" : value.originalValueRaw, parameters)
      )
      .map((value) => ({
        parameter: value.originalLabel || value.normalizedParameter || value.originalValueRaw,
        value: value.originalValueRaw,
        unit: value.normalizedUnit || value.originalUnit || "",
        sample: value.sampleName || "",
        confidence:
          value.confidenceScore !== undefined ? value.confidenceScore / 100 : undefined,
        source: [
          extraction.layoutFamily,
          value.sampleName ? `sample: ${value.sampleName}` : "",
          value.extractionMethod ? `method: ${value.extractionMethod}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      }));

    if (rows.length > 0) return rows;

    return typeof input === "string" ? parseLooseDocumentText(input, parameters) : [];
  }

  async function analyzePhotoBlob(blob: Blob, sourceLabel: string) {
    setLoading(true);
    setLoadingLabel("Reading the report photo...");
    setMessage("");

    try {
      const payload = await recognizeImage(blob, language);
      buildAiDocumentPreview(payload, sourceLabel);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Photo analysis failed.");
      setPreviewRows([]);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video || !cameraReady) return;

    const canvas = window.document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context) return;

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.95)
    );

    if (blob) {
      await analyzePhotoBlob(blob, "camera");
    }
  }

  async function handleFileUpload(file: File) {
    setLoading(true);
    setLoadingLabel("Reading file...");
    setMessage("");

    try {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".csv")) {
        const text = await file.text();
        const tableRows = text
          .split(/\r?\n/)
          .map((line) => splitCsvLine(line))
          .filter((row) => row.some((cell) => cell.trim()));
        const smartRows = extractRowsWithIntelligence(tableRows);
        if (smartRows.length > 0) {
          setDocumentText(text);
          setShowTextReview(true);
          buildPreview(smartRows);
          return;
        }

        setLoadingLabel("Asking AI to read the CSV structure...");
      const payload = await recognizeExtractedContentWithAi({ text, tableRows, language });
        if (payload.rows?.length) {
          buildAiDocumentPreview(payload, file.name || "CSV");
        } else {
          setDocumentText(text);
          setShowTextReview(true);
          buildPreview(parseCsv(text));
        }
        return;
      }

      if (fileName.endsWith(".txt")) {
        const text = await file.text();
        setDocumentText(text);
        setShowTextReview(true);
        const textRows = extractRowsWithIntelligence(text);
        if (textRows.length > 0) {
          buildPreview(textRows);
          return;
        }

        setLoadingLabel("Asking AI to read the report text...");
        const payload = await recognizeExtractedContentWithAi({ text, language });
        buildAiDocumentPreview(payload, file.name || "text report");
        return;
      }

      if (fileName.endsWith(".pdf")) {
        const buffer = await file.arrayBuffer();
        const text = await extractPdfText(buffer);
        const textRows = extractRowsWithIntelligence(text);

        setDocumentText(text);
        setShowTextReview(true);

        if (textRows.length > 0) {
          buildPreview(textRows);
          return;
        }

        if (text.trim().length > 80) {
          setLoadingLabel("Asking AI to read the PDF text...");
          const payload = await recognizeExtractedContentWithAi({ text, language });
          buildAiDocumentPreview(payload, file.name || "PDF");
          return;
        }

        setLoadingLabel("The PDF looks scanned. Reading its pages...");
        const pageImages = await renderPdfPagesForAi(buffer);
        const pageTexts: string[] = [];
        const pageTokens: DocToken[] = [];

        for (let index = 0; index < pageImages.length; index += 1) {
          setLoadingLabel(`Reading PDF page ${index + 1} of ${pageImages.length}...`);
          const payload = await recognizeImage(pageImages[index], language);
          pageTexts.push(payload.text);
          pageTokens.push(
            ...(payload.tokens || []).map((token) => ({
              ...token,
              id: `pdf-page-${index + 1}-${token.id}`,
              pageNumber: index + 1,
            }))
          );
        }

        const combinedText = pageTexts.join("\n");
        setDocumentText(combinedText);
        setShowTextReview(true);
        if (pageTokens.length > 0) {
          const rows = extractRowsWithIntelligence(pageTokens);
          if (rows.length > 0) {
            buildPreview(rows);
          } else {
            buildDocumentPreview(combinedText);
          }
        } else {
          buildDocumentPreview(combinedText);
        }
        return;
      }

      if (file.type.startsWith("image/")) {
        await analyzePhotoBlob(file, file.name || "photo");
        return;
      }

      if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];

        if (!firstSheetName) {
          throw new Error("Excel file has no sheets.");
        }

        const sheet = workbook.Sheets[firstSheetName];
        const tableRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
          header: 1,
          defval: "",
        }).map((row) => row.map((cell) => String(cell ?? "")));
        const smartRows = extractRowsWithIntelligence(tableRows);

        if (smartRows.length > 0) {
          setDocumentText(tableRows.map((row) => row.join(" | ")).join("\n"));
          setShowTextReview(true);
          buildPreview(smartRows);
          return;
        }

        setLoadingLabel("Asking AI to read the spreadsheet layout...");
        const payload = await recognizeExtractedContentWithAi({
          text: tableRows.map((row) => row.join(" | ")).join("\n"),
          tableRows,
          language,
        });
        if (payload.rows?.length) {
          buildAiDocumentPreview(payload, firstSheetName);
          return;
        }

        const jsonRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(
          sheet,
          { defval: "" }
        );

        const rows: ImportedRow[] = jsonRows.map((row) => {
          const normalizedEntries = Object.entries(row).map(([key, value]) => ({
            key,
            normalizedKey: normalizeText(key),
            value: String(value ?? ""),
          }));

          const parameter =
            normalizedEntries.find((entry) =>
              [
                "parameter",
                "parametro",
                "parametre",
                "name",
                "nombre",
                "nom",
              ].includes(entry.normalizedKey)
            )?.value || "";

          const value =
            normalizedEntries.find((entry) =>
              [
                "value",
                "valor",
                "valeur",
                "result",
                "resultado",
                "resultat",
              ].includes(entry.normalizedKey)
            )?.value || "";

          const unit =
            normalizedEntries.find((entry) =>
              [
                "unit",
                "unidad",
                "unite",
                "units",
                "unit symbol",
                "unit_symbol",
              ].includes(entry.normalizedKey)
            )?.value || "";

          const sample =
            normalizedEntries.find((entry) =>
              [
                "sample",
                "sample id",
                "sample_id",
                "lot",
                "lote",
                "plot",
                "parcela",
                "muestra",
                "echantillon",
              ].includes(entry.normalizedKey)
            )?.value || "";

          return { parameter, value, unit, sample, source: "Excel" };
        });

        buildPreview(rows);
        return;
      }

      throw new Error("Unsupported file type. Use CSV, Excel, PDF, TXT, or a photo.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Import failed.");
      setPreviewRows([]);
    } finally {
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function updateRowParameter(rowId: string, parameterKey: string) {
    setPreviewRows((previousRows) =>
      previousRows.map((row) => {
        if (row.id !== rowId) return row;

        const parameter = parameterByKey.get(parameterKey);

        if (!parameter) {
          return {
            ...row,
            matchedParameterKey: null,
            selectedUnitId: null,
            selectedUnitDisplayKey: null,
            status: "unmatched",
            message: "Choose a parameter.",
            selected: false,
          };
        }

        const selectedUnit = findUnitSelection(parameter, row.unit || undefined);
        const hasNumericValue = normalizeNumericValue(row.value) !== "";
        const requiresUnitReview =
          Boolean(row.unit?.trim()) && selectedUnit.quality === "none";

        return {
          ...row,
          matchedParameterKey: parameter.parameter_key,
          selectedUnitId: selectedUnit.unitId,
          selectedUnitDisplayKey: selectedUnit.displayKey,
          status: hasNumericValue
            ? requiresUnitReview
              ? "unmatched"
              : "matched"
            : "invalid",
          message: hasNumericValue
            ? requiresUnitReview
              ? "Review unit."
              : "Ready."
            : "Invalid numeric value.",
          selected: hasNumericValue && !requiresUnitReview,
        };
      })
    );
  }

  function updateRowUnit(rowId: string, unitDisplayKey: string) {
    setPreviewRows((previousRows) =>
      previousRows.map((row) => {
        if (row.id !== rowId || !row.matchedParameterKey) return row;
        const parameter = parameterByKey.get(row.matchedParameterKey);
        const unit = parameter?.available_units.find(
          (option) => getUnitOptionKey(option) === unitDisplayKey
        );
        if (!unit) return row;

        return {
          ...row,
          selectedUnitId: unit.unit_id,
          selectedUnitDisplayKey: getUnitOptionKey(unit),
        };
      })
    );
  }

  function updateRowSample(rowId: string, sampleName: string) {
    setPreviewRows((previousRows) =>
      previousRows.map((row) =>
        row.id === rowId ? { ...row, sampleName } : row
      )
    );
  }

  function updateRowValue(rowId: string, rawValue: string) {
    if (!/^-?\d*(?:[.,]\d*)?$/.test(rawValue)) return;

    setPreviewRows((previousRows) =>
      previousRows.map((row) => {
        if (row.id !== rowId) return row;
        const normalizedValue = normalizeNumericValue(rawValue);
        const hasValue = normalizedValue !== "";
        return {
          ...row,
          value: rawValue,
          status: hasValue
            ? row.matchedParameterKey
              ? "matched"
              : "unmatched"
            : "invalid",
          message: hasValue
            ? row.matchedParameterKey
              ? "Ready."
              : "Choose a parameter."
            : "Invalid numeric value.",
          selected: hasValue ? row.selected : false,
        };
      })
    );
  }

  function updateRowSelected(rowId: string, selected: boolean) {
    setPreviewRows((previousRows) =>
      previousRows.map((row) => (row.id === rowId ? { ...row, selected } : row))
    );
  }

  function selectAllMatchedRows(selected: boolean) {
    setPreviewRows((previousRows) =>
      previousRows.map((row) => ({
        ...row,
        selected: row.status === "matched" ? selected : false,
      }))
    );
  }

  function importMatchedRows() {
    if (selectedRows.length === 0) return;
    let rowsToImport = selectedRows;
    const sampleNames = Array.from(
      new Set(
        selectedRows
          .map((row) => row.sampleName?.trim())
          .filter((sample): sample is string => Boolean(sample))
      )
    );

    if (sampleNames.length > 1) {
      const choice = window.prompt(
        `Several lots/samples were detected: ${sampleNames.join(", ")}.\nType the exact lot/sample name to import now. You can reuse the saved import to bring another lot later.`
      );
      if (!choice) return;
      rowsToImport = selectedRows.filter(
        (row) => row.sampleName?.trim().toLowerCase() === choice.trim().toLowerCase()
      );
      if (rowsToImport.length === 0) {
        setMessage("No rows matched that lot/sample name.");
        return;
      }
    }

    if (overwriteCount > 0) {
      const confirmed = window.confirm(
        `${overwriteCount} imported value(s) will replace existing values. Continue?`
      );

      if (!confirmed) return;
    }

    const importedValues: Record<string, string> = {};
    const importedUnits: Record<string, number> = {};
    const importedUnitDisplayKeys: Record<string, string> = {};

    for (const row of rowsToImport) {
      if (!row.matchedParameterKey || !row.selectedUnitId) continue;
      const normalizedValue = normalizeNumericValue(row.value);
      if (!normalizedValue) continue;
      importedValues[row.matchedParameterKey] = normalizedValue;
      importedUnits[row.matchedParameterKey] = row.selectedUnitId;
      if (row.selectedUnitDisplayKey) {
        importedUnitDisplayKeys[row.matchedParameterKey] = row.selectedUnitDisplayKey;
      }
    }

    onImportValues(importedValues, importedUnits, importMetadata, importedUnitDisplayKeys);
    closeModal();
  }

  function downloadTemplate() {
    const template = [
      ["parameter", "value", "unit"],
      ["pH", "6.2", ""],
      ["Nitrogen", "2.8", "%"],
      ["Phosphorus", "18", "mg/kg"],
      ["Potassium", "0.35", "cmol(+)/kg"],
      ["Organic matter", "3.5", "%"],
      ["Calcium", "6.1", "cmol(+)/kg"],
      ["Magnesium", "1.8", "cmol(+)/kg"],
    ];
    const csv = template
      .map((row) =>
        row
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");

    anchor.href = url;
    anchor.download = "alakay-lab-values-template.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (!open) return null;

  const matchedCount = previewRows.filter(
    (row) => row.status === "matched"
  ).length;
  const isScanMode = mode === "scan";
  const title = isScanMode ? "Take report photo" : "Import lab report";
  const subtitle =
    isScanMode
      ? "Center the report, capture it, then confirm the values Alakay finds."
      : "Import Excel, CSV, PDF, TXT, or photo reports. Alakay will find the lab values automatically.";

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/35 px-3 backdrop-blur-md sm:px-4">
      <div
        className={`max-h-[94vh] w-full overflow-y-auto rounded-3xl border border-white/70 bg-white/92 p-4 shadow-2xl sm:p-5 ${
          isScanMode ? "max-w-3xl" : "max-w-6xl"
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold uppercase tracking-[0.04em] text-green-950 sm:text-xl">
              {title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">{subtitle}</p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-2xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm hover:bg-slate-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <section
          className={`mt-4 grid gap-4 ${
            isScanMode ? "" : "lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]"
          }`}
        >
          <div className="rounded-3xl border border-green-100 bg-green-50/60 p-3 sm:p-4">
            {isScanMode ? (
              <div>
                <div className="overflow-hidden rounded-3xl border border-white/80 bg-slate-900 shadow-inner">
                  <video
                    ref={videoRef}
                    className="aspect-[16/10] w-full object-cover"
                    playsInline
                    muted
                  />
                </div>

                {cameraError ? (
                  <div className="mt-3 rounded-2xl bg-yellow-50 p-3 text-sm text-yellow-900">
                    {cameraError}
                  </div>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                  <button
                    type="button"
                    onClick={capturePhoto}
                    disabled={!cameraReady || loading}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 font-bold text-white shadow-lg shadow-green-900/15 hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    <ScanLine size={18} />
                    Capture and analyze
                  </button>
                  <button
                    type="button"
                    onClick={() => photoInputRef.current?.click()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white px-4 font-bold text-green-900 hover:bg-green-50"
                  >
                    <ImageIcon size={18} />
                    Choose photo
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2 text-xs text-green-900/70">
                  <span>Use a flat, well-lit photo. Avoid shadows over the numbers.</span>
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="inline-flex shrink-0 items-center gap-1 rounded-xl px-2 py-1 font-semibold text-green-800 hover:bg-white"
                  >
                    <RefreshCcw size={14} />
                    Reopen
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 font-bold text-white shadow-lg shadow-green-900/15 hover:bg-green-800"
                  >
                    <Upload size={18} />
                    Choose file
                  </button>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-green-200 bg-white px-4 font-bold text-green-900 hover:bg-green-50"
                  >
                    <Download size={18} />
                    Template
                  </button>
                </div>

                {hasImportMemory ? (
                  <button
                    type="button"
                    onClick={loadLastImport}
                    className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-2xl border border-green-200 bg-green-50/75 px-4 text-sm font-bold text-green-900 hover:bg-green-50"
                  >
                    <RefreshCcw size={16} />
                    Use last analyzed import
                  </button>
                ) : null}

                <div className="mt-3 grid gap-2 text-sm text-slate-600">
                  <FormatPill icon={<FileSpreadsheet size={16} />} label="Excel and CSV" />
                  <FormatPill icon={<FileText size={16} />} label="PDF reports" />
                  <FormatPill icon={<ImageIcon size={16} />} label="Photos and screenshots" />
                </div>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,.txt,.pdf,image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleFileUpload(file);
              }}
            />
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void analyzePhotoBlob(file, file.name || "photo");
              }}
            />
          </div>

          {(!isScanMode || documentText.trim() || showTextReview) ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-start gap-3">
              <FileText size={20} className="mt-0.5 shrink-0 text-green-800" />
              <div>
                <p className="font-extrabold text-green-950">
                  {isScanMode ? "Review detected text" : "Detected report text"}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  You can adjust the text before reviewing the imported values.
                </p>
              </div>
            </div>

            <textarea
              className="mt-3 min-h-32 w-full rounded-2xl border border-green-100 bg-green-50/35 p-3 text-sm outline-none focus:border-green-600 focus:ring-4 focus:ring-green-700/10"
              value={documentText}
              onChange={(event) => {
                setDocumentText(event.target.value);
                setShowTextReview(true);
              }}
              placeholder={"Example:\nNitrogen (N) 2.8 %\nPhosphorus\n18 mg/kg\nPotassium 0.35 cmol(+)/kg"}
            />

            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => buildDocumentPreview(documentText)}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 font-bold text-white hover:bg-green-800"
              >
                <FileText size={17} />
                Review detected values
              </button>
              <button
                type="button"
                onClick={resetImporter}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 font-bold text-slate-700 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>

            {showTextReview ? (
              <p className="mt-3 text-xs text-slate-500">
                Alakay checks names, symbols, nearby values, next-line values,
                and visible units before asking you to confirm.
              </p>
            ) : null}
          </div>
          ) : null}
        </section>

        {loading ? (
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-green-50 p-4 text-green-900">
            <Loader2 size={18} className="animate-spin" />
            <span className="font-semibold">{loadingLabel || "Working..."}</span>
          </div>
        ) : null}

        {message ? (
          <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-sm font-medium text-yellow-950">
            {message}
          </div>
        ) : null}

        {previewRows.length > 0 ? (
          <section className="mt-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-green-950">
                  Review before importing
                </h3>
                <p className="mt-1 text-sm text-slate-600">
                  Keep the checked rows, fix anything uncertain, then import.
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={() => selectAllMatchedRows(true)}
                  className="rounded-2xl border border-green-200 px-4 py-3 text-sm font-bold text-green-800 hover:bg-green-50"
                >
                  Select matched
                </button>
                <button
                  type="button"
                  onClick={() => selectAllMatchedRows(false)}
                  className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={importMatchedRows}
                  disabled={selectedRows.length === 0}
                  className="rounded-2xl bg-green-700 px-5 py-3 font-bold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Import {selectedRows.length}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <ImportStat
                icon={<CheckCircle2 size={18} />}
                label="Matched"
                value={matchedCount}
              />
              <ImportStat
                icon={<AlertTriangle size={18} />}
                label="Needs review"
                value={previewRows.filter((row) => row.status !== "matched").length}
              />
              <ImportStat
                icon={<AlertTriangle size={18} />}
                label="Will replace"
                value={overwriteCount}
              />
            </div>

            {textureSummary.found > 0 ? (
              <div
                className={`mt-3 rounded-2xl p-3 text-sm font-semibold ${
                  textureSummary.complete
                    ? textureSummary.withinRange
                      ? "bg-green-50 text-green-900"
                      : "bg-yellow-50 text-yellow-900"
                    : "bg-slate-50 text-slate-700"
                }`}
              >
                Texture summary: {textureSummary.found}/3 detected
                {textureSummary.values.sand !== null ? `, Sand ${textureSummary.values.sand}%` : ""}
                {textureSummary.values.silt !== null ? `, Silt ${textureSummary.values.silt}%` : ""}
                {textureSummary.values.clay !== null ? `, Clay ${textureSummary.values.clay}%` : ""}
                {textureSummary.total !== null
                  ? `, Sum ${textureSummary.total.toFixed(1)}% ${
                      textureSummary.withinRange ? "(coherent)" : "(check values)"
                    }`
                  : ""}
              </div>
            ) : null}

            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[1040px] border-collapse bg-white text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 p-3">Import</th>
                    <th className="border-b border-slate-200 p-3">Sample / lot</th>
                    <th className="border-b border-slate-200 p-3">Found name</th>
                    <th className="border-b border-slate-200 p-3">Match</th>
                    <th className="border-b border-slate-200 p-3">Value</th>
                    <th className="border-b border-slate-200 p-3">Unit</th>
                    <th className="border-b border-slate-200 p-3">Status</th>
                  </tr>
                </thead>

                <tbody>
                  {previewRows.map((row) => {
                    const matchedParameter = row.matchedParameterKey
                      ? parameterByKey.get(row.matchedParameterKey)
                      : null;
                    const selectedRowUnit = matchedParameter?.available_units.find(
                      (option) => getUnitOptionKey(option) === row.selectedUnitDisplayKey
                    );
                    const hasExistingValue =
                      row.matchedParameterKey &&
                      existingValues[row.matchedParameterKey]?.trim();

                    return (
                      <tr key={row.id}>
                        <td className="border-b border-slate-100 p-3">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            disabled={row.status !== "matched"}
                            onChange={(event) =>
                              updateRowSelected(row.id, event.target.checked)
                            }
                          />
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          <input
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-green-600"
                            value={row.sampleName || ""}
                            placeholder="Optional"
                            onChange={(event) =>
                              updateRowSample(row.id, event.target.value)
                            }
                          />
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          <div className="font-semibold text-slate-800">
                            {row.rawParameter || "-"}
                          </div>
                          {row.source ? (
                            <p className="mt-1 text-xs text-slate-500">{row.source}</p>
                          ) : null}
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          <select
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-green-600"
                            value={row.matchedParameterKey || ""}
                            onChange={(event) =>
                              updateRowParameter(row.id, event.target.value)
                            }
                          >
                            <option value="">Select parameter</option>
                            {parameters.map((parameter) => (
                              <option
                                key={parameter.parameter_key}
                                value={parameter.parameter_key}
                              >
                                {getParameterLabel(parameter)}
                              </option>
                            ))}
                          </select>

                          {hasExistingValue ? (
                            <p className="mt-1 text-xs font-semibold text-orange-700">
                              Existing value will be replaced.
                            </p>
                          ) : null}
                          {row.status === "unmatched" && onRequestCreateParameter ? (
                            <button
                              type="button"
                              className="mt-1 text-xs font-semibold text-green-800 underline underline-offset-2"
                              onClick={() =>
                                onRequestCreateParameter({
                                  parameterName: row.rawParameter,
                                  unitSymbol: row.unit || undefined,
                                })
                              }
                            >
                              Add as custom parameter
                            </button>
                          ) : null}
                        </td>
                        <td className="border-b border-slate-100 p-3 font-bold">
                          <input
                            type="text"
                            inputMode="decimal"
                            className="w-full rounded-xl border border-slate-200 bg-white p-2 font-bold text-slate-900 outline-none focus:border-green-600"
                            value={row.value}
                            placeholder="-"
                            onChange={(event) =>
                              updateRowValue(row.id, event.target.value)
                            }
                            onBlur={() => {
                              const normalized = normalizeNumericValue(row.value);
                              updateRowValue(row.id, normalized);
                            }}
                          />
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          {matchedParameter ? (
                            <div className="grid gap-1">
                            <select
                              className="w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-green-600"
                              value={row.selectedUnitDisplayKey || ""}
                              onChange={(event) =>
                                updateRowUnit(row.id, event.target.value)
                              }
                            >
                              {matchedParameter.available_units.map((unit, index) => {
                                const canConvert =
                                  !selectedRowUnit ||
                                  canConvertLabUnit(
                                    selectedRowUnit.unit_symbol || selectedRowUnit.display_symbol,
                                    unit.unit_symbol || unit.display_symbol
                                  );
                                return (
                                <option
                                  key={`${unit.unit_id}-${unit.display_symbol}-${index}`}
                                  value={getUnitOptionKey(unit)}
                                  disabled={!canConvert}
                                >
                                  {unit.display_symbol || unit.unit_symbol}
                                </option>
                                );
                              })}
                            </select>
                              {row.unit ? (
                                <p className="text-xs font-semibold text-slate-500">
                                  Detected: {row.unit}. Values convert only when compatible.
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-bold ${
                              row.status === "matched"
                                ? "bg-green-100 text-green-800"
                                : row.status === "unmatched"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-red-100 text-red-800"
                            }`}
                          >
                            {row.message}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}

function FormatPill({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 font-semibold text-green-900">
      {icon}
      {label}
    </div>
  );
}

function ImportStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-600">{icon}</div>
      <p className="mt-2 text-2xl font-extrabold text-green-950">{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

