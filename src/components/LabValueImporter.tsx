"use client";

import { Fragment, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  ArrowLeft,
  Camera,
  Loader2,
  RefreshCcw,
  Save,
  ScanLine,
  Upload,
  X,
} from "lucide-react";
import {
  extractLabIntelligently,
  type DocToken,
} from "@/lib/import/intelligentLabExtractor";
import {
  detectDocumentUnitContext,
  documentContextFromMetadata,
  formatReportReferenceRange,
  inferRowReportUnit,
  mergeDocumentUnitContext,
  type DocumentUnitContext,
} from "@/lib/import/importUnitContext";
import type { Language } from "@/lib/translations";
import { canConvertLabUnit } from "@/lib/unitConversions";
import MenuSelect from "@/components/ui/MenuSelect";
import {
  getImportCache,
  getLatestImportCache,
  markImportCacheValidated,
  upsertImportCacheDraft,
  type CachedImportEntry,
} from "@/lib/importCache";

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
  reportRange?: string;
  reportRating?: string;
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
  defaultUnitSystem?: string;
};

type IntelligentExtractBatch = {
  rows: ImportedRow[];
  documentUnitContext: DocumentUnitContext;
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
  reportReferenceRange?: string | null;
  reportRating?: string | null;
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
  initialCacheId?: string | null;
  initialFile?: File | null;
  onInitialFileHandled?: () => void;
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
  onEnterImportReview?: () => void;
  presentation?: "overlay" | "page";
};

type ScanStep = "camera" | "crop";

type CropInsets = {
  top: number;
  left: number;
  right: number;
  bottom: number;
};

const DEFAULT_CROP_INSETS: CropInsets = { top: 6, left: 6, right: 6, bottom: 6 };

async function cropImageBlob(source: Blob, insets: CropInsets): Promise<Blob> {
  const bitmap = await createImageBitmap(source);
  const sx = Math.round(bitmap.width * (insets.left / 100));
  const sy = Math.round(bitmap.height * (insets.top / 100));
  const sw = Math.max(
    1,
    Math.round(bitmap.width * (1 - (insets.left + insets.right) / 100))
  );
  const sh = Math.max(
    1,
    Math.round(bitmap.height * (1 - (insets.top + insets.bottom) / 100))
  );

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return source;
  }

  context.drawImage(bitmap, sx, sy, sw, sh, 0, 0, sw, sh);
  bitmap.close();

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob || source), "image/jpeg", 0.92);
  });
}

async function waitForVideoReady(video: HTMLVideoElement) {
  if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return;
  await new Promise<void>((resolve, reject) => {
    const onReady = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onError);
      resolve();
    };
    const onError = () => {
      video.removeEventListener("loadedmetadata", onReady);
      video.removeEventListener("error", onError);
      reject(new Error("Camera preview failed to load."));
    };
    video.addEventListener("loadedmetadata", onReady);
    video.addEventListener("error", onError);
  });
}

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

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function findUnitSelection(
  parameter: ParameterForImport,
  rawUnit: string | undefined,
  documentContext: DocumentUnitContext = {},
  numericValue?: number
) {
  const sortedDefaults = [...parameter.available_units].sort((left, right) => {
    const leftLabel = String(left.display_symbol || left.unit_symbol || "");
    const rightLabel = String(right.display_symbol || right.unit_symbol || "");
    const rank = (label: string) => {
      const raw = label.trim().toLowerCase().replace(/\s+/g, "");
      if (raw === "mg/kg" || raw === "mgkg-1" || raw === "mg.kg-1") return 0;
      if (raw === "ppm" || raw === "ug/g") return 2;
      return 1;
    };
    return rank(leftLabel) - rank(rightLabel);
  });
  const preferredMgKg = sortedDefaults.find((unit) => {
    const raw = String(unit.display_symbol || unit.unit_symbol || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "");
    return raw === "mg/kg" || raw === "mgkg-1" || raw === "mg.kg-1";
  });
  const defaultOption =
    preferredMgKg ||
    parameter.available_units.find((unit) => unit.unit_id === parameter.unit_id) ||
    sortedDefaults[0] ||
    parameter.available_units[0];

  if (!rawUnit?.trim()) {
    const inferredMass = inferRowReportUnit(
      undefined,
      parameter.parameter_key,
      numericValue,
      documentContext
    );
    if (inferredMass?.trim()) {
      return findUnitSelection(parameter, inferredMass, documentContext, numericValue);
    }

    return {
      unitId: defaultOption?.unit_id || parameter.unit_id,
      displayKey: defaultOption ? getUnitOptionKey(defaultOption) : null,
      quality: "default" as const,
    };
  }

  const normalizedRawUnit = normalizeUnitForMatching(rawUnit);
  const rawUnitLiteral = rawUnit.trim().toLowerCase().replace(/\s+/g, "");
  // ppm ≡ mg/kg — prefer showing mg/kg when the lab reports either.
  if (rawUnitLiteral === "ppm" || rawUnitLiteral === "ug/g" || rawUnitLiteral === "µg/g") {
    if (preferredMgKg) {
      return {
        unitId: preferredMgKg.unit_id,
        displayKey: getUnitOptionKey(preferredMgKg),
        quality: "compatible" as const,
      };
    }
  }

  const literalMatch = parameter.available_units.find((unit) => {
    return (
      String(unit.display_symbol || "").trim().toLowerCase() === rawUnit.trim().toLowerCase() ||
      String(unit.unit_symbol || "").trim().toLowerCase() === rawUnit.trim().toLowerCase()
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
    // Prefer mg/kg display label among compatible mass units.
    const compatibleMgKg = parameter.available_units.find((unit) => {
      const raw = String(unit.display_symbol || unit.unit_symbol || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "");
      return (
        (raw === "mg/kg" || raw === "mgkg-1") &&
        canConvertLabUnit(rawUnit, unit.unit_symbol || unit.display_symbol)
      );
    });
    const selected = compatibleMgKg || compatibleMatch;
    return {
      unitId: selected.unit_id,
      displayKey: getUnitOptionKey(selected),
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

function resolveRowImportState(
  row: ImportPreviewRow,
  parameterByKey: Map<string, ParameterForImport>,
  documentContext: DocumentUnitContext = {},
  options?: { preserveSelected?: boolean }
): ImportPreviewRow {
  const preserveSelected = options?.preserveSelected ?? true;
  const normalizedValue = normalizeNumericValue(row.value);
  const hasValue = normalizedValue !== "";

  if (!row.rawParameter.trim() && !row.matchedParameterKey) {
    return {
      ...row,
      status: "invalid",
      message: "Missing parameter name.",
      selected: false,
    };
  }

  if (!hasValue) {
    return {
      ...row,
      status: "invalid",
      message: "Invalid numeric value.",
      selected: false,
    };
  }

  if (!row.matchedParameterKey) {
    return {
      ...row,
      value: normalizedValue,
      status: "unmatched",
      message: "Choose a parameter.",
      selected: false,
    };
  }

  const parameter = parameterByKey.get(row.matchedParameterKey);
  if (!parameter) {
    return {
      ...row,
      value: normalizedValue,
      matchedParameterKey: null,
      selectedUnitId: null,
      selectedUnitDisplayKey: null,
      status: "unmatched",
      message: "Choose a parameter.",
      selected: false,
    };
  }

  if (!row.selectedUnitId || !row.selectedUnitDisplayKey) {
    const numericValue = Number(normalizedValue);
    const inferredUnit = inferRowReportUnit(
      row.unit || undefined,
      parameter.parameter_key,
      Number.isFinite(numericValue) ? numericValue : undefined,
      documentContext
    );
    const selectedUnit = findUnitSelection(
      parameter,
      inferredUnit || row.unit || undefined,
      documentContext,
      Number.isFinite(numericValue) ? numericValue : undefined
    );
    const ready =
      selectedUnit.quality === "exact" || selectedUnit.quality === "compatible";
    return {
      ...row,
      value: normalizedValue,
      unit: inferredUnit || row.unit,
      selectedUnitId: selectedUnit.unitId,
      selectedUnitDisplayKey: selectedUnit.displayKey,
      status: ready ? "matched" : "unmatched",
      message: ready ? "Ready." : "Review unit.",
      selected: ready ? (preserveSelected ? row.selected : true) : false,
    };
  }

  return {
    ...row,
    value: normalizedValue,
    status: "matched",
    message: "Ready.",
    selected: preserveSelected ? row.selected || false : true,
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
  initialCacheId = null,
  initialFile = null,
  onInitialFileHandled,
  onClose,
  language,
  parameters,
  existingValues = {},
  onRequestCreateParameter,
  onImportValues,
  onEnterImportReview,
  presentation = "overlay",
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handleFileUploadRef = useRef<(file: File) => Promise<void>>(async () => {});
  const skipCacheSyncRef = useRef(false);

  const [previewRows, setPreviewRows] = useState<ImportPreviewRow[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [documentText, setDocumentText] = useState("");
  const [showTextReview, setShowTextReview] = useState(false);
  const [importMetadata, setImportMetadata] = useState<ImportMetadata | undefined>();
  const [documentUnitContext, setDocumentUnitContext] = useState<DocumentUnitContext>({});
  const [hasCachedImport, setHasCachedImport] = useState(false);
  const [activeCacheId, setActiveCacheId] = useState<string | null>(null);
  const [cacheSourceLabel, setCacheSourceLabel] = useState("Import");
  const [cacheSourceKind, setCacheSourceKind] = useState<"file" | "scan" | "text">("file");
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);
  const [scanStep, setScanStep] = useState<ScanStep>("camera");
  const [capturedPreviewUrl, setCapturedPreviewUrl] = useState<string | null>(null);
  const [cropInsets, setCropInsets] = useState<CropInsets>(DEFAULT_CROP_INSETS);
  const capturedBlobRef = useRef<Blob | null>(null);
  const cameraStartingRef = useRef(false);
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null);

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
    setHasCachedImport(Boolean(getLatestImportCache()));
  }, [open]);

  useEffect(() => {
    if (!open || previewRows.length === 0 || skipCacheSyncRef.current) {
      skipCacheSyncRef.current = false;
      return;
    }

    setActiveCacheId((currentId) =>
      upsertImportCacheDraft({
        id: currentId ?? undefined,
        sourceLabel: cacheSourceLabel,
        sourceKind: cacheSourceKind,
        metadata: importMetadata,
        rows: previewRows,
      })
    );
    setHasCachedImport(true);
  }, [open, previewRows, importMetadata, cacheSourceLabel, cacheSourceKind]);

  useEffect(() => {
    if (!open || !initialCacheId) return;
    const entry = getImportCache(initialCacheId);
    if (entry) loadImportFromCache(entry);
  }, [open, initialCacheId]);

  useEffect(() => {
    if (!open || mode !== "scan" || scanStep !== "camera") {
      stopCamera();
      return;
    }

    void startCamera();
    return () => stopCamera();
  }, [open, mode, scanStep]);

  useEffect(() => {
    if (!open) return;
    if (!autoRestoreToken) return;
    loadLastImport();
  }, [open, autoRestoreToken]);

  useEffect(() => {
    if (!open || !initialFile) return;
    void handleFileUploadRef.current(initialFile);
    onInitialFileHandled?.();
  }, [open, initialFile, onInitialFileHandled]);

  useEffect(() => {
    return () => stopCamera();
  }, []);

  useEffect(() => {
    if (loading && previewRows.length === 0) {
      setLoadingStartedAt(Date.now());
      return;
    }
    if (!loading) {
      setLoadingStartedAt(null);
    }
  }, [loading, previewRows.length]);

  function stopCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraReady(false);
  }

  async function startCamera() {
    if (cameraStartingRef.current) return;
    cameraStartingRef.current = true;
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

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await waitForVideoReady(video);
        try {
          await video.play();
        } catch (error) {
          if (!(error instanceof DOMException) || error.name !== "AbortError") {
            throw error;
          }
        }
      }

      setCameraReady(true);
    } catch (error) {
      setCameraError(
        error instanceof Error
          ? error.message
          : "Camera could not be opened. You can still import a photo."
      );
      setCameraReady(false);
    } finally {
      cameraStartingRef.current = false;
    }
  }

  function clearCapturedPhoto() {
    if (capturedPreviewUrl) URL.revokeObjectURL(capturedPreviewUrl);
    capturedBlobRef.current = null;
    setCapturedPreviewUrl(null);
    setCropInsets(DEFAULT_CROP_INSETS);
  }

  function resetScanFlow() {
    clearCapturedPhoto();
    setScanStep("camera");
  }

  function resetImporter() {
    setPreviewRows([]);
    setMessage("");
    setDocumentText("");
    setShowTextReview(false);
    setImportMetadata(undefined);
    setDocumentUnitContext({});
    setActiveCacheId(null);
    setCacheSourceLabel("Import");
    setCacheSourceKind("file");
    setCameraError("");
    resetScanFlow();

    if (fileInputRef.current) fileInputRef.current.value = "";
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function loadImportFromCache(entry: CachedImportEntry) {
    skipCacheSyncRef.current = true;
    setActiveCacheId(entry.id);
    setCacheSourceLabel(entry.sourceLabel);
    setCacheSourceKind(entry.sourceKind);
    setImportMetadata(entry.metadata);
    setPreviewRows(entry.rows);
    setDocumentText("");
    setShowTextReview(false);

    const matched = entry.rows.filter((row) => row.status === "matched").length;
    const failed = entry.rows.length - matched;
    setMessage(`${matched} value(s) found. ${failed} need review.`);
  }

  function closeModal() {
    stopCamera();
    resetImporter();
    onClose();
  }

  function buildPreview(rows: ImportedRow[], unitContext: DocumentUnitContext = documentUnitContext) {
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
      const numericValue = parsedValue ? Number(parsedValue) : undefined;
      const effectiveUnit = matchedParameter
        ? inferRowReportUnit(
            row.unit,
            matchedParameter.parameter_key,
            numericValue,
            unitContext
          )
        : row.unit;
      const reportReferenceRange = formatReportReferenceRange(
        row.reportRange || undefined
      );
      const reportRating = row.reportRating?.trim() || null;
      const baseId = `${index + 2}-${row.parameter}-${row.value}`;
      const sourceDetail =
        [
          row.source || "",
          row.method ? `method: ${row.method}` : "",
          reportReferenceRange ? `report range: ${reportReferenceRange}` : "",
          reportRating ? `report rating: ${reportRating}` : "",
        ]
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
          reportReferenceRange,
          reportRating,
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
            ? findUnitSelection(
                matchedParameter,
                effectiveUnit,
                unitContext,
                numericValue
              ).unitId
            : null,
          selectedUnitDisplayKey: matchedParameter
            ? findUnitSelection(
                matchedParameter,
                effectiveUnit,
                unitContext,
                numericValue
              ).displayKey
            : null,
          status: "invalid" as const,
          message: "Invalid numeric value.",
          selected: false,
          reportReferenceRange,
          reportRating,
        };
      }

      if (!matchedParameter) {
        return {
          id: baseId,
          rowNumber: index + 2,
          rawParameter: row.parameter,
          matchedParameterKey: null,
          value: parsedValue,
          unit: effectiveUnit || row.unit || null,
          sampleName: row.sample || null,
          source: sourceDetail,
          selectedUnitId: null,
          selectedUnitDisplayKey: null,
          status: "unmatched" as const,
          message: "Choose a parameter.",
          selected: false,
          reportReferenceRange,
          reportRating,
        };
      }

      const selectedUnit = findUnitSelection(
        matchedParameter,
        effectiveUnit,
        unitContext,
        numericValue
      );
      const requiresUnitReview =
        Boolean(row.unit?.trim()) && selectedUnit.quality === "none";

      return {
        id: baseId,
        rowNumber: index + 2,
        rawParameter: row.parameter,
        matchedParameterKey: matchedParameter.parameter_key,
        value: parsedValue,
        unit: effectiveUnit?.trim() || row.unit?.trim() || null,
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
              : unitContext.defaultMassUnit && !row.unit?.trim()
                ? `Ready (${unitContext.defaultMassUnit} from report).`
                : "Ready.",
        selected: !requiresUnitReview,
        reportReferenceRange,
        reportRating,
      };
    });

    setPreviewRows(preview);

    const matched = preview.filter((row) => row.status === "matched").length;
    const failed = preview.length - matched;

    setMessage(`${matched} value(s) found. ${failed} need review.`);
  }

  function buildDocumentPreview(text: string) {
    setCacheSourceKind("text");
    const batch = extractRowsWithIntelligence(text);

    if (batch.rows.length === 0) {
      setPreviewRows([]);
      setMessage(
        "No lab values were detected. Try a clearer photo, another file, or paste the report text."
      );
      return;
    }

    applyIntelligentExtract(batch);
  }

  function buildAiDocumentPreview(
    payload: AiImportPayload,
    sourceLabel: string,
    sourceKind: "file" | "scan" | "text" = "file"
  ) {
    const text = payload.text || "";
    setDocumentText(text);
    setShowTextReview(true);
    setImportMetadata(payload.metadata);
    setCacheSourceLabel(sourceLabel);
    setCacheSourceKind(sourceKind);
    let unitContext = mergeDocumentUnitContext(
      documentContextFromMetadata(payload.metadata?.defaultUnitSystem),
      detectDocumentUnitContext(text)
    );
    setDocumentUnitContext(unitContext);

    let rows: ImportedRow[] = [];
    if (payload.rows?.length) {
      rows = payload.rows;
    } else if (payload.tokens?.length) {
      const batch = extractRowsWithIntelligence(payload.tokens);
      rows = batch.rows;
      unitContext = mergeDocumentUnitContext(unitContext, batch.documentUnitContext);
      setDocumentUnitContext(unitContext);
    }

    if (rows.length === 0) {
      setPreviewRows([]);
      setMessage(
        payload.warning ||
          "The AI read the document text but did not return structured lab rows. Try a clearer scan or adjust the detected text before reviewing values."
      );
      return;
    }

    buildPreview(rows, unitContext);
    setMessage(`${sourceLabel} analyzed with AI import.`);
  }

  function loadLastImport() {
    const cached = getLatestImportCache();
    if (!cached) {
      setMessage("No saved import was found on this device.");
      return;
    }

    loadImportFromCache(cached);
  }

  function extractRowsWithIntelligence(
    input: string | string[][] | DocToken[]
  ): IntelligentExtractBatch {
    const extraction = extractLabIntelligently(input);
    const sourceText =
      typeof input === "string"
        ? input
        : Array.isArray(input) && input.length > 0 && typeof input[0] === "string"
          ? (input as string[][]).flat().join("\n")
          : extraction.rawTokens.map((token) => token.rawText).join("\n");
    const documentUnitContext = detectDocumentUnitContext(sourceText);
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
        reportRange: value.referenceRange || "",
        reportRating: value.interpretation || "",
        source: [
          extraction.layoutFamily,
          value.sampleName ? `sample: ${value.sampleName}` : "",
          value.extractionMethod ? `method: ${value.extractionMethod}` : "",
        ]
          .filter(Boolean)
          .join(" | "),
      }));

    if (rows.length > 0) {
      return { rows, documentUnitContext };
    }

    return {
      rows:
        typeof input === "string" ? parseLooseDocumentText(input, parameters) : [],
      documentUnitContext,
    };
  }

  function applyIntelligentExtract(batch: IntelligentExtractBatch) {
    setDocumentUnitContext(batch.documentUnitContext);
    buildPreview(batch.rows, batch.documentUnitContext);
  }

  async function analyzePhotoBlob(blob: Blob, sourceLabel: string, fromScan = false) {
    setLoading(true);
    setLoadingLabel("Reading your photo...");
    setMessage("");
    setCacheSourceLabel(sourceLabel);
    setCacheSourceKind(fromScan ? "scan" : "file");

    try {
      const payload = await recognizeImage(blob, language);
      buildAiDocumentPreview(payload, sourceLabel, fromScan ? "scan" : "file");
      if (fromScan) {
        onEnterImportReview?.();
      }
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

    if (!blob) return;

    stopCamera();
    clearCapturedPhoto();
    capturedBlobRef.current = blob;
    setCapturedPreviewUrl(URL.createObjectURL(blob));
    setScanStep("crop");
  }

  async function confirmCropAndAnalyze() {
    const source = capturedBlobRef.current;
    if (!source) return;

    setLoading(true);
    setLoadingLabel("Preparing photo — almost ready...");
    setMessage("");

    try {
      const cropped = await cropImageBlob(source, cropInsets);
      clearCapturedPhoto();
      setScanStep("camera");
      await analyzePhotoBlob(cropped, "camera", true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not prepare the photo.");
      setLoading(false);
      setLoadingLabel("");
    }
  }

  function retakePhoto() {
    resetScanFlow();
  }

  async function handleFileUpload(file: File) {
    setLoading(true);
    setLoadingLabel("Reading your file...");
    setMessage("");
    setCacheSourceLabel(file.name || "Import");
    setCacheSourceKind("file");

    try {
      const fileName = file.name.toLowerCase();

      if (fileName.endsWith(".csv")) {
        const text = await file.text();
        const tableRows = text
          .split(/\r?\n/)
          .map((line) => splitCsvLine(line))
          .filter((row) => row.some((cell) => cell.trim()));
        const smartBatch = extractRowsWithIntelligence(tableRows);
        if (smartBatch.rows.length > 0) {
          setDocumentText(text);
          setShowTextReview(true);
          applyIntelligentExtract(smartBatch);
          return;
        }

        setLoadingLabel("Almost done — interpreting the spreadsheet...");
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
        const textBatch = extractRowsWithIntelligence(text);
        if (textBatch.rows.length > 0) {
          applyIntelligentExtract(textBatch);
          return;
        }

        setLoadingLabel("Almost done — reading report text...");
        const payload = await recognizeExtractedContentWithAi({ text, language });
        buildAiDocumentPreview(payload, file.name || "text report");
        return;
      }

      if (fileName.endsWith(".pdf")) {
        const buffer = await file.arrayBuffer();
        const text = await extractPdfText(buffer);
        const pdfBatch = extractRowsWithIntelligence(text);

        setDocumentText(text);
        setShowTextReview(true);

        if (pdfBatch.rows.length > 0) {
          applyIntelligentExtract(pdfBatch);
          return;
        }

        if (text.trim().length > 80) {
          setLoadingLabel("Almost done — interpreting PDF text...");
          const payload = await recognizeExtractedContentWithAi({ text, language });
          buildAiDocumentPreview(payload, file.name || "PDF");
          return;
        }

        setLoadingLabel("Reading scanned pages — almost there...");
        const pageImages = await renderPdfPagesForAi(buffer);
        const pageTexts: string[] = [];
        const pageTokens: DocToken[] = [];

        for (let index = 0; index < pageImages.length; index += 1) {
          setLoadingLabel(`Reading page ${index + 1} of ${pageImages.length} — nearly done...`);
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
          const tokenBatch = extractRowsWithIntelligence(pageTokens);
          if (tokenBatch.rows.length > 0) {
            applyIntelligentExtract(tokenBatch);
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
        const excelBatch = extractRowsWithIntelligence(tableRows);

        if (excelBatch.rows.length > 0) {
          setDocumentText(tableRows.map((row) => row.join(" | ")).join("\n"));
          setShowTextReview(true);
          applyIntelligentExtract(excelBatch);
          return;
        }

        setLoadingLabel("Almost done — reading spreadsheet layout...");
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

  handleFileUploadRef.current = handleFileUpload;

  function updateRowParameter(rowId: string, parameterKey: string) {
    if (!parameterKey) return;

    setPreviewRows((previousRows) =>
      previousRows.map((row) => {
        if (row.id !== rowId) return row;

        const parameter = parameterByKey.get(parameterKey);
        if (!parameter) return row;

        const selectedUnit = findUnitSelection(parameter, row.unit || undefined);
        return resolveRowImportState(
          {
            ...row,
            matchedParameterKey: parameter.parameter_key,
            selectedUnitId: selectedUnit.unitId,
            selectedUnitDisplayKey: selectedUnit.displayKey,
          },
          parameterByKey,
          documentUnitContext,
          { preserveSelected: false }
        );
      })
    );
  }

  function updateRowUnit(rowId: string, unitDisplayKey: string) {
    if (!unitDisplayKey) return;

    setPreviewRows((previousRows) =>
      previousRows.map((row) => {
        if (row.id !== rowId || !row.matchedParameterKey) return row;
        const parameter = parameterByKey.get(row.matchedParameterKey);
        const unit = parameter?.available_units.find(
          (option) => getUnitOptionKey(option) === unitDisplayKey
        );
        if (!unit || !parameter) return row;

        return resolveRowImportState(
          {
            ...row,
            selectedUnitId: unit.unit_id,
            selectedUnitDisplayKey: getUnitOptionKey(unit),
          },
          parameterByKey,
          documentUnitContext,
          { preserveSelected: false }
        );
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
        return resolveRowImportState({ ...row, value: rawValue }, parameterByKey, documentUnitContext);
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
    if (activeCacheId) {
      markImportCacheValidated(activeCacheId);
    }
    closeModal();
  }

  if (!open) return null;

  const matchedCount = previewRows.filter(
    (row) => row.status === "matched"
  ).length;
  const isScanMode = mode === "scan";
  const hasPreview = previewRows.length > 0;
  const showScanCapture =
    isScanMode && !hasPreview && !loading && (scanStep === "camera" || scanStep === "crop");
  const showTextPanel =
    Boolean(documentText.trim()) || showTextReview || (loading && !isScanMode);
  const showScanTextPanel =
    isScanMode && (Boolean(documentText.trim()) || showTextReview);
  const title = hasPreview
    ? "Review import"
    : isScanMode
      ? scanStep === "crop"
        ? "Crop photo"
        : "Take picture"
      : "Import document";
  const subtitle = hasPreview
    ? "Check matched values, adjust anything uncertain, then import."
    : isScanMode
      ? scanStep === "crop"
        ? "Frame the lab report, then continue to review the detected values."
        : "Center the report in the frame. You can crop before analysis."
      : "Upload Excel, CSV, PDF, or TXT.";

  if (showScanCapture) {
    const isPage = presentation === "page";

    return (
      <div
        className={isPage ? "lab-scan-page animate-slide-up" : "lab-scan-screen"}
        role={isPage ? undefined : "dialog"}
        aria-modal={isPage ? undefined : true}
        aria-label={title}
      >
        {!isPage ? (
          <button
            type="button"
            className="lab-scan-screen__scrim"
            aria-label="Close"
            onClick={closeModal}
          />
        ) : null}

        <section
          className={
            isPage ? "lab-scan-page__shell" : "lab-scan-screen__panel glass-modal-shell"
          }
        >
          <header
            className={
              isPage ? "lab-scan-page__header" : "lab-scan-screen__header"
            }
          >
            {scanStep === "crop" ? (
              <button
                type="button"
                className="glass-icon-btn lab-scan-screen__back"
                onClick={retakePhoto}
                aria-label="Back to camera"
              >
                <ArrowLeft size={17} />
              </button>
            ) : (
              <button
                type="button"
                className="glass-icon-btn lab-scan-screen__back"
                onClick={closeModal}
                aria-label="Close"
              >
                <ArrowLeft size={17} />
              </button>
            )}

            <div className="min-w-0 flex-1 text-center">
              <h2 className="lab-scan-screen__title">{title}</h2>
              <p className="lab-scan-screen__subtitle">{subtitle}</p>
            </div>

            {!isPage ? (
              <button
                type="button"
                onClick={closeModal}
                className="glass-icon-btn lab-scan-screen__close"
                aria-label="Close"
              >
                <X size={17} />
              </button>
            ) : (
              <span className="lab-scan-screen__back-spacer" aria-hidden />
            )}
          </header>

          {scanStep === "camera" ? (
            <div
              className={
                isPage ? "lab-scan-page__body" : "lab-scan-screen__body"
              }
            >
              <div
                className={
                  isPage
                    ? "lab-scan-page__camera lab-scan-camera"
                    : "lab-scan-camera"
                }
              >
                <video
                  ref={videoRef}
                  className="lab-scan-camera__video"
                  playsInline
                  muted
                  autoPlay
                />
                {!cameraReady && !cameraError ? (
                  <div className="lab-scan-camera__placeholder">
                    <Loader2 size={22} className="animate-spin" aria-hidden />
                    <span>Opening camera…</span>
                  </div>
                ) : null}
              </div>

              {cameraError ? (
                <p className="lab-scan-screen__notice lab-scan-screen__notice--warn">
                  {cameraError}
                </p>
              ) : (
                <p className="lab-scan-screen__hint">
                  Hold the report flat. You can capture a full page, then crop if needed.
                </p>
              )}

              <div className="lab-scan-screen__actions">
                <button
                  type="button"
                  onClick={capturePhoto}
                  disabled={!cameraReady}
                  className="lab-scan-screen__primary-btn"
                >
                  <Camera size={18} aria-hidden />
                  Take photo
                </button>
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="lab-scan-screen__secondary-btn"
                >
                  <Upload size={16} aria-hidden />
                  Choose from gallery
                </button>
                {!cameraError ? (
                  <button
                    type="button"
                    onClick={() => void startCamera()}
                    className="lab-scan-screen__text-btn"
                  >
                    <RefreshCcw size={14} aria-hidden />
                    Restart camera
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div
              className={
                isPage ? "lab-scan-page__body" : "lab-scan-screen__body"
              }
            >
              {capturedPreviewUrl ? (
                <div
                  className={
                    isPage
                      ? "lab-scan-page__crop lab-scan-crop-stage"
                      : "lab-scan-crop-stage"
                  }
                  style={
                    {
                      "--crop-top": `${cropInsets.top}%`,
                      "--crop-right": `${cropInsets.right}%`,
                      "--crop-bottom": `${cropInsets.bottom}%`,
                      "--crop-left": `${cropInsets.left}%`,
                    } as CSSProperties
                  }
                >
                  <img
                    src={capturedPreviewUrl}
                    alt="Captured lab report preview"
                    className="lab-scan-crop-stage__image"
                  />
                  <div className="lab-scan-crop-stage__frame" aria-hidden />
                </div>
              ) : null}

              <div className="lab-scan-crop-controls">
                <label className="lab-scan-crop-controls__field">
                  <span>Top</span>
                  <input
                    type="range"
                    min={0}
                    max={35}
                    value={cropInsets.top}
                    onChange={(event) =>
                      setCropInsets((previous) => ({
                        ...previous,
                        top: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="lab-scan-crop-controls__field">
                  <span>Bottom</span>
                  <input
                    type="range"
                    min={0}
                    max={35}
                    value={cropInsets.bottom}
                    onChange={(event) =>
                      setCropInsets((previous) => ({
                        ...previous,
                        bottom: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="lab-scan-crop-controls__field">
                  <span>Left</span>
                  <input
                    type="range"
                    min={0}
                    max={35}
                    value={cropInsets.left}
                    onChange={(event) =>
                      setCropInsets((previous) => ({
                        ...previous,
                        left: Number(event.target.value),
                      }))
                    }
                  />
                </label>
                <label className="lab-scan-crop-controls__field">
                  <span>Right</span>
                  <input
                    type="range"
                    min={0}
                    max={35}
                    value={cropInsets.right}
                    onChange={(event) =>
                      setCropInsets((previous) => ({
                        ...previous,
                        right: Number(event.target.value),
                      }))
                    }
                  />
                </label>
              </div>

              <div className="lab-scan-screen__actions">
                <button
                  type="button"
                  onClick={() => void confirmCropAndAnalyze()}
                  className="lab-scan-screen__primary-btn"
                >
                  <ScanLine size={18} aria-hidden />
                  Analyze and review
                </button>
                <button
                  type="button"
                  onClick={retakePhoto}
                  className="lab-scan-screen__secondary-btn"
                >
                  Retake photo
                </button>
              </div>
            </div>
          )}

          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              stopCamera();
              clearCapturedPhoto();
              capturedBlobRef.current = file;
              setCapturedPreviewUrl(URL.createObjectURL(file));
              setScanStep("crop");
              event.target.value = "";
            }}
          />
        </section>
      </div>
    );
  }

  function handleImportBack() {
    if (hasPreview) {
      if (!isScanMode && (documentText.trim() || showTextReview)) {
        setPreviewRows([]);
        setMessage("");
        return;
      }
      closeModal();
      return;
    }

    if ((showTextPanel || showScanTextPanel) && !loading) {
      setDocumentText("");
      setShowTextReview(false);
      setMessage("");
      return;
    }

    closeModal();
  }

  const importFlowStep: "source" | "text" | "review" = hasPreview
    ? "review"
    : (showTextPanel || showScanTextPanel) && !loading
      ? "text"
      : "source";

  const reviewCount = previewRows.filter((row) => row.status !== "matched").length;

  return (
    <section className="lab-import-page animate-slide-up" aria-label={title}>
      <header className="lab-import-page__header">
        <button
          type="button"
          className="glass-icon-btn lab-scan-screen__back"
          onClick={handleImportBack}
          aria-label="Back"
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="lab-import-panel__title">{title}</h1>
          <p className="lab-import-panel__subtitle">{subtitle}</p>
          <ImportFlowStepper
            step={importFlowStep}
            isScanMode={isScanMode}
            showTextStep={Boolean(documentText.trim()) || showTextReview}
          />
        </div>
      </header>

      <div
        className={`lab-import-page__body${
          importFlowStep === "review" ? " lab-import-page__body--review" : ""
        }`}
      >
        {loading && !hasPreview ? (
          <ImportProcessingPanel
            label={loadingLabel}
            startedAt={loadingStartedAt}
          />
        ) : null}

        {!loading && message && importFlowStep !== "review" ? (
          <p className="lab-import-page__message">{message}</p>
        ) : null}

        {!loading && importFlowStep === "source" && !isScanMode ? (
          <section className="lab-import-page__step lab-import-page__step--source">
            <ImportGuide step="source" />
            <div className="lab-import-page__actions">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="lab-scan-screen__primary-btn"
              >
                <Upload size={17} aria-hidden />
                Choose file
              </button>
              {hasCachedImport ? (
                <button
                  type="button"
                  onClick={loadLastImport}
                  className="lab-scan-screen__secondary-btn"
                >
                  <RefreshCcw size={15} aria-hidden />
                  Resume last import
                </button>
              ) : null}
            </div>
            <p className="lab-scan-screen__hint">
              Excel, CSV, PDF, TXT, or image files are supported.
            </p>
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
          </section>
        ) : null}

        {!loading && importFlowStep === "text" ? (
          <section className="lab-import-page__step">
            <label className="lab-import-page__text-label">
              Detected text
              <textarea
                className="auth-field mt-2 min-h-32 text-sm"
                value={documentText}
                onChange={(event) => {
                  setDocumentText(event.target.value);
                  setShowTextReview(true);
                }}
                placeholder="Edit the detected text if needed."
              />
            </label>
            <div className="lab-import-page__actions">
              <button
                type="button"
                onClick={() => buildDocumentPreview(documentText)}
                className="lab-scan-screen__primary-btn"
              >
                Continue to review
              </button>
              <button
                type="button"
                onClick={resetImporter}
                className="lab-scan-screen__secondary-btn"
              >
                Start over
              </button>
            </div>
          </section>
        ) : null}

        {importFlowStep === "review" ? (
          <>
            <div className="lab-import-page__review-toolbar">
              <p className="lab-import-page__summary">
                {matchedCount} matched
                {reviewCount > 0 ? (
                  <>
                    {" "}
                    · <span className="lab-import-page__summary-mark">{reviewCount} to check</span>
                  </>
                ) : null}
                {overwriteCount > 0 ? <> · {overwriteCount} will replace</> : null}
              </p>
            </div>

            {textureSummary.found > 0 ? (
              <div
                className={`lab-import-page__texture ${
                  textureSummary.complete
                    ? textureSummary.withinRange
                      ? "lab-import-page__texture--ok"
                      : "lab-import-page__texture--warn"
                    : ""
                }`}
              >
                Texture {textureSummary.found}/3
                {textureSummary.values.sand !== null ? ` · Sand ${textureSummary.values.sand}%` : ""}
                {textureSummary.values.silt !== null ? ` · Silt ${textureSummary.values.silt}%` : ""}
                {textureSummary.values.clay !== null ? ` · Clay ${textureSummary.values.clay}%` : ""}
                {textureSummary.total !== null
                  ? ` · Sum ${textureSummary.total.toFixed(1)}%`
                  : ""}
              </div>
            ) : null}

            <ImportReviewList
              rows={previewRows}
              parameters={parameters}
              parameterByKey={parameterByKey}
              existingValues={existingValues}
              onRequestCreateParameter={onRequestCreateParameter}
              onSelectRow={updateRowSelected}
              onSampleChange={updateRowSample}
              onParameterChange={updateRowParameter}
              onValueChange={updateRowValue}
              onValueBlur={(id, value) => updateRowValue(id, normalizeNumericValue(value))}
              onUnitChange={updateRowUnit}
            />
          </>
        ) : null}
      </div>

      {importFlowStep === "review" ? (
        <footer className="lab-import-page__footer">
          <div className="lab-import-page__footer-actions">
            <button
              type="button"
              onClick={() => selectAllMatchedRows(true)}
              className="lab-import-page__footer-btn lab-import-page__footer-btn--ghost"
            >
              Select matched
            </button>
            <button
              type="button"
              onClick={() => selectAllMatchedRows(false)}
              className="lab-import-page__footer-btn lab-import-page__footer-btn--ghost"
            >
              Clear
            </button>
          </div>
          <button
            type="button"
            onClick={importMatchedRows}
            disabled={selectedRows.length === 0}
            className="lab-import-page__import-btn"
          >
            <Save size={16} aria-hidden />
            Import {selectedRows.length}
          </button>
        </footer>
      ) : null}
    </section>
  );
}

function estimateImportProgress(label: string, tick: number): number {
  const lower = label.toLowerCase();
  const pageMatch = label.match(/page (\d+) of (\d+)/i);
  if (pageMatch) {
    const current = Number(pageMatch[1]);
    const total = Math.max(1, Number(pageMatch[2]));
    return Math.min(94, 38 + (current / total) * 52);
  }
  if (lower.includes("ai") || lower.includes("spreadsheet") || lower.includes("structure")) {
    return Math.min(90, 52 + tick * 5);
  }
  if (
    lower.includes("scanned") ||
    lower.includes("photo") ||
    lower.includes("preparing") ||
    lower.includes("report photo")
  ) {
    return Math.min(82, 44 + tick * 6);
  }
  if (lower.includes("reading file") || lower.includes("reading the")) {
    return Math.min(42, 22 + tick * 4);
  }
  return Math.min(88, 30 + tick * 7);
}

function ImportProcessingPanel({
  label,
  startedAt,
}: {
  label: string;
  startedAt: number | null;
}) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 2600);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setTick(0);
  }, [label]);

  const encouragements = [
    "Almost there — wrapping up the last details.",
    "Matching parameters and units to your catalog.",
    "You'll review everything before anything is saved.",
    "Nearly done — preparing your import list now.",
    "Just a moment — quality check in progress.",
  ];

  const elapsedSeconds = startedAt ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  const hint =
    elapsedSeconds >= 8
      ? "Still working — complex reports can take a little longer."
      : encouragements[tick % encouragements.length];
  const progress = estimateImportProgress(label || "Reading file...", tick);
  const primaryLabel = label.trim() || "Reading your file...";

  return (
    <section className="lab-import-page__processing" aria-live="polite" aria-busy="true">
      <div className="lab-import-page__processing-card">
        <button type="button" disabled className="lab-import-page__processing-btn">
          <Loader2 size={18} className="animate-spin shrink-0" aria-hidden />
          Processing
        </button>
        <p className="lab-import-page__processing-label">{primaryLabel}</p>
        <p className="lab-import-page__processing-hint">{hint}</p>
        <div
          className="lab-import-page__progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="Import progress"
        >
          <div
            className="lab-import-page__progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </section>
  );
}

function ImportGuide({
  step,
  reviewCount = 0,
}: {
  step: "source" | "review";
  reviewCount?: number;
}) {
  if (step === "source") {
    return (
      <aside className="lab-import-page__guide">
        <p className="lab-import-page__guide-title">How to import</p>
        <ol className="lab-import-page__guide-list">
          <li>Choose your lab file (Excel, CSV, PDF, TXT, or photo).</li>
          <li>
            For photos or scans, use a clear, high-quality image — sharp text, good
            lighting, and the full report in frame.
          </li>
          <li>Review the detected values on the next screen.</li>
          <li>Fix rows marked with an amber dot — pick the parameter or unit.</li>
          <li>Check the rows you want, then tap Import.</li>
        </ol>
      </aside>
    );
  }

  return (
    <aside className="lab-import-page__guide">
      <p className="lab-import-page__guide-title">Review checklist</p>
      <ol className="lab-import-page__guide-list">
        <li>Use the table below to confirm each value, parameter, and unit.</li>
        {reviewCount > 0 ? (
          <li>
            {reviewCount} row{reviewCount === 1 ? "" : "s"} still need attention — amber
            highlight means pick a parameter or unit first.
          </li>
        ) : (
          <li>All rows look matched. Check the ones you want and import.</li>
        )}
        <li>Scroll sideways on small screens to see every column.</li>
      </ol>
    </aside>
  );
}

function ImportFlowStepper({
  step,
  isScanMode,
  showTextStep,
}: {
  step: "source" | "text" | "review";
  isScanMode: boolean;
  showTextStep: boolean;
}) {
  const steps = isScanMode
    ? [
        { id: "source" as const, label: "Capture" },
        { id: "review" as const, label: "Review" },
      ]
    : showTextStep
      ? [
          { id: "source" as const, label: "Upload" },
          { id: "text" as const, label: "Text" },
          { id: "review" as const, label: "Review" },
        ]
      : [
          { id: "source" as const, label: "Upload" },
          { id: "review" as const, label: "Review" },
        ];

  const activeIndex = steps.findIndex((item) => item.id === step);

  return (
    <ol className="lab-import-steps" aria-label="Import progress">
      {steps.map((item, index) => {
        const isComplete = index < activeIndex;
        const isActive = item.id === step;
        return (
          <li
            key={item.id}
            className={`lab-import-steps__item ${
              isActive ? "is-active" : isComplete ? "is-complete" : ""
            }`}
          >
            <span className="lab-import-steps__dot" aria-hidden />
            <span className="lab-import-steps__label">{item.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function getImportParameterShortLabel(
  matchedParameter: ParameterForImport | null | undefined,
  rawParameter: string,
  compact: boolean
) {
  if (compact) {
    if (matchedParameter?.symbol?.trim()) return matchedParameter.symbol.trim();
    const inlineSymbol = rawParameter.match(/\(([A-Za-z][A-Za-z0-9+\-]{0,5})\)/)?.[1];
    if (inlineSymbol) return inlineSymbol;
    const normalized = rawParameter.trim();
    if (normalized.length <= 10) return normalized;
    return `${normalized.slice(0, 9)}…`;
  }
  return matchedParameter ? getParameterLabel(matchedParameter) : rawParameter || "-";
}

function getImportRowStatusTone(status: ImportPreviewRow["status"]) {
  if (status === "matched") return "ok";
  if (status === "invalid") return "error";
  return "review";
}

function ImportReviewList({
  rows,
  parameters,
  parameterByKey,
  existingValues,
  onRequestCreateParameter,
  onSelectRow,
  onSampleChange,
  onParameterChange,
  onValueChange,
  onValueBlur,
  onUnitChange,
}: {
  rows: ImportPreviewRow[];
  parameters: ParameterForImport[];
  parameterByKey: Map<string, ParameterForImport>;
  existingValues: Record<string, string>;
  onRequestCreateParameter?: Props["onRequestCreateParameter"];
  onSelectRow: (id: string, selected: boolean) => void;
  onSampleChange: (id: string, sample: string) => void;
  onParameterChange: (id: string, key: string) => void;
  onValueChange: (id: string, value: string) => void;
  onValueBlur: (id: string, value: string) => void;
  onUnitChange: (id: string, unitKey: string) => void;
}) {
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 899px)");
    const sync = () => setIsCompactViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  return (
    <>
      <div className="lab-import-review-table-wrap lab-import-review-table-wrap--desktop preview-table-wrap">
        <table className="lab-import-review-table w-full border-collapse text-sm">
        <thead>
          <tr>
            <th>Import</th>
            <th>Parameter</th>
            <th className="lab-import-review-table__sample-col">Sample</th>
            <th>Value</th>
            <th>Unit</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const matchedParameter = row.matchedParameterKey
              ? parameterByKey.get(row.matchedParameterKey)
              : null;
            const needsReview = row.status !== "matched";
            const needsParameterPick = !row.matchedParameterKey;
            const displayName = matchedParameter
              ? getParameterLabel(matchedParameter)
              : row.rawParameter || "-";
            const selectedRowUnit = matchedParameter?.available_units.find(
              (option) => getUnitOptionKey(option) === row.selectedUnitDisplayKey
            );
            const hasExistingValue =
              row.matchedParameterKey && existingValues[row.matchedParameterKey]?.trim();

            return (
              <tr
                key={row.id}
                className={needsReview ? "lab-import-review-table__row--review" : ""}
              >
                <td>
                  <input
                    type="checkbox"
                    checked={row.selected}
                    disabled={row.status !== "matched"}
                    onChange={(event) => onSelectRow(row.id, event.target.checked)}
                    aria-label={`Import ${displayName}`}
                  />
                </td>
                <td>
                  <div className="lab-import-review-table__param">
                    {needsReview ? (
                      <span
                        className="lab-import-review__dot"
                        title={row.message}
                        aria-label="Needs review"
                      />
                    ) : null}
                    <div className="min-w-0">
                      <div className="font-semibold">{displayName}</div>
                      {row.rawParameter && matchedParameter && row.rawParameter !== displayName ? (
                        <div className="text-xs text-slate-500">{row.rawParameter}</div>
                      ) : null}
                      {needsParameterPick ? (
                        <div className="mt-1">
                          <MenuSelect
                            compact
                            value={row.matchedParameterKey || ""}
                            heading="Select parameter"
                            variant="field"
                            fullWidth
                            placeholder="Select parameter"
                            onChange={(next) => onParameterChange(row.id, next)}
                            options={[
                              { value: "", label: "Select parameter" },
                              ...parameters.map((parameter) => ({
                                value: parameter.parameter_key,
                                label: getParameterLabel(parameter),
                              })),
                            ]}
                          />
                        </div>
                      ) : null}
                      {row.status === "unmatched" && onRequestCreateParameter ? (
                        <button
                          type="button"
                          className="lab-import-review-row__create-btn mt-1"
                          onClick={() =>
                            onRequestCreateParameter({
                              parameterName: row.rawParameter,
                              unitSymbol: row.unit || undefined,
                            })
                          }
                        >
                          Add custom parameter
                        </button>
                      ) : null}
                      {row.reportReferenceRange ? (
                        <p className="lab-import-review-row__report-range mt-1">
                          Report range: {row.reportReferenceRange}
                        </p>
                      ) : null}
                      {row.reportRating ? (
                        <p className="lab-import-review-row__report-range mt-1">
                          Lab rating: {row.reportRating}
                        </p>
                      ) : null}
                      {needsReview && row.message ? (
                        <p className="lab-import-review-row__replace-note mt-1">{row.message}</p>
                      ) : null}
                      {hasExistingValue ? (
                        <p className="lab-import-review-row__replace-note mt-1">
                          Replaces existing value
                        </p>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="lab-import-review-table__sample-col">
                  <input
                    className="calc-field-input w-full rounded-lg p-2"
                    value={row.sampleName || ""}
                    placeholder="Optional"
                    onChange={(event) => onSampleChange(row.id, event.target.value)}
                  />
                </td>
                <td>
                  <input
                    type="text"
                    inputMode="decimal"
                    className="calc-field-input w-full rounded-lg p-2 font-bold"
                    value={row.value}
                    onChange={(event) => onValueChange(row.id, event.target.value)}
                    onBlur={() => onValueBlur(row.id, row.value)}
                  />
                </td>
                <td>
                  {matchedParameter ? (
                    <MenuSelect
                      compact
                      value={row.selectedUnitDisplayKey || ""}
                      heading="Unit"
                      variant="field"
                      fullWidth
                      onChange={(next) => onUnitChange(row.id, next)}
                      options={matchedParameter.available_units.map((unit, index) => {
                        const canConvert =
                          !selectedRowUnit ||
                          canConvertLabUnit(
                            selectedRowUnit.unit_symbol || selectedRowUnit.display_symbol,
                            unit.unit_symbol || unit.display_symbol
                          );
                        return {
                          value: getUnitOptionKey(unit),
                          label: unit.display_symbol || unit.unit_symbol,
                          disabled: !canConvert,
                          description:
                            index === 0 && row.unit ? `Detected: ${row.unit}` : undefined,
                        };
                      })}
                    />
                  ) : (
                    row.unit || "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      </div>

      <div className="lab-import-review-compact">
        <table className="lab-import-review-compact-table w-full table-fixed border-collapse text-xs">
          <colgroup>
            <col className="lab-import-review-col lab-import-review-col--check" />
            <col className="lab-import-review-col lab-import-review-col--param" />
            <col className="lab-import-review-col lab-import-review-col--value" />
            <col className="lab-import-review-col lab-import-review-col--unit" />
            <col className="lab-import-review-col lab-import-review-col--status" />
          </colgroup>
          <thead>
            <tr>
              <th className="sr-only">Import</th>
              <th>Param</th>
              <th>Value</th>
              <th>Unit</th>
              <th>
                <span className="sr-only">Status</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const matchedParameter = row.matchedParameterKey
                ? parameterByKey.get(row.matchedParameterKey)
                : null;
              const needsReview = row.status !== "matched";
              const needsParameterPick = !row.matchedParameterKey;
              const displayName = getImportParameterShortLabel(
                matchedParameter,
                row.rawParameter,
                true
              );
              const fullName = matchedParameter
                ? getParameterLabel(matchedParameter)
                : row.rawParameter || "-";
              const selectedRowUnit = matchedParameter?.available_units.find(
                (option) => getUnitOptionKey(option) === row.selectedUnitDisplayKey
              );
              const unitLabel =
                selectedRowUnit?.display_symbol ||
                selectedRowUnit?.unit_symbol ||
                row.unit ||
                "—";
              const statusTone = getImportRowStatusTone(row.status);
              const isExpanded = expandedRowId === row.id;

              return (
                <Fragment key={row.id}>
                  <tr
                    className={`lab-import-review-compact__row lab-import-review-compact__row--${statusTone}${
                      needsReview ? " lab-import-review-compact__row--action" : ""
                    }`}
                    onClick={() => {
                      if (needsReview) {
                        setExpandedRowId(isExpanded ? null : row.id);
                      }
                    }}
                  >
                    <td className="lab-import-review-compact__check">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        disabled={row.status !== "matched"}
                        onChange={(event) => onSelectRow(row.id, event.target.checked)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`Import ${fullName}`}
                      />
                    </td>
                    <td className="lab-import-review-compact__param" title={fullName}>
                      {displayName}
                    </td>
                    <td className="lab-import-review-compact__value">
                      <input
                        type="text"
                        inputMode="decimal"
                        className="lab-import-review-compact__value-input"
                        value={row.value}
                        onChange={(event) => onValueChange(row.id, event.target.value)}
                        onBlur={() => onValueBlur(row.id, row.value)}
                        onClick={(event) => event.stopPropagation()}
                        aria-label={`${fullName} value`}
                      />
                    </td>
                    <td className="lab-import-review-compact__unit" title={unitLabel}>
                      {matchedParameter && !needsParameterPick ? (
                        <button
                          type="button"
                          className="lab-import-review-compact__unit-btn"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedRowId(isExpanded ? null : row.id);
                          }}
                        >
                          {unitLabel}
                        </button>
                      ) : (
                        unitLabel
                      )}
                    </td>
                    <td className="lab-import-review-compact__status">
                      <span
                        className={`lab-import-status-dot lab-import-status-dot--${statusTone}`}
                        title={row.message}
                        aria-label={row.message}
                      />
                    </td>
                  </tr>
                  {isExpanded ? (
                    <tr className="lab-import-review-compact__details-row">
                      <td colSpan={5}>
                        <div className="lab-import-review-compact__details">
                          <p className="lab-import-review-compact__details-title">{fullName}</p>
                          {needsParameterPick ? (
                            <MenuSelect
                              compact
                              value={row.matchedParameterKey || ""}
                              heading="Select parameter"
                              variant="field"
                              fullWidth
                              placeholder="Select parameter"
                              onChange={(next) => onParameterChange(row.id, next)}
                              options={[
                                { value: "", label: "Select parameter" },
                                ...parameters.map((parameter) => ({
                                  value: parameter.parameter_key,
                                  label: getParameterLabel(parameter),
                                })),
                              ]}
                            />
                          ) : null}
                          {matchedParameter ? (
                            <MenuSelect
                              compact
                              value={row.selectedUnitDisplayKey || ""}
                              heading="Unit"
                              variant="field"
                              fullWidth
                              onChange={(next) => onUnitChange(row.id, next)}
                              options={matchedParameter.available_units.map((unit) => {
                                const canConvert =
                                  !selectedRowUnit ||
                                  canConvertLabUnit(
                                    selectedRowUnit.unit_symbol ||
                                      selectedRowUnit.display_symbol,
                                    unit.unit_symbol || unit.display_symbol
                                  );
                                return {
                                  value: getUnitOptionKey(unit),
                                  label: unit.display_symbol || unit.unit_symbol,
                                  disabled: !canConvert,
                                };
                              })}
                            />
                          ) : null}
                          {row.reportReferenceRange ? (
                            <p className="lab-import-review-row__report-range">
                              Report range: {row.reportReferenceRange}
                            </p>
                          ) : null}
                          {row.reportRating ? (
                            <p className="lab-import-review-row__report-range">
                              Lab rating: {row.reportRating}
                            </p>
                          ) : null}
                          {needsReview && row.message ? (
                            <p className="lab-import-review-row__replace-note">{row.message}</p>
                          ) : null}
                          {row.status === "unmatched" && onRequestCreateParameter ? (
                            <button
                              type="button"
                              className="lab-import-review-row__create-btn"
                              onClick={() =>
                                onRequestCreateParameter({
                                  parameterName: row.rawParameter,
                                  unitSymbol: row.unit || undefined,
                                })
                              }
                            >
                              Add custom parameter
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

