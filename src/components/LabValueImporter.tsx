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

type ImportMode = "scan" | "import";

type ParameterForImport = {
  parameter_key: string;
  parameter_id: number | null;
  custom_parameter_id: number | null;
  parameter_name: string;
  display_name: string;
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

type Props = {
  open: boolean;
  mode?: ImportMode;
  onClose: () => void;
  parameters: ParameterForImport[];
  existingValues?: Record<string, string>;
  onImportValues: (
    importedValues: Record<string, string>,
    importedUnits: Record<string, number>,
    metadata?: ImportMetadata
  ) => void;
};

const IMPORT_MEMORY_KEY = "alakay_import_memory";

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[()%/.,;:_-]/g, " ")
    .replace(/\s+/g, " ");
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
    const names = [
      parameter.display_name,
      parameter.parameter_name,
      parameter.symbol || "",
      `${parameter.display_name} ${parameter.symbol || ""}`,
      `${parameter.parameter_name} ${parameter.symbol || ""}`,
    ].filter(Boolean);

    for (const name of names) {
      map.set(normalizeText(name), parameter);
    }
  }

  return map;
}

function findBestParameterMatch(
  rawName: string,
  parameters: ParameterForImport[],
  searchMap: Map<string, ParameterForImport>
) {
  const normalizedRawName = normalizeText(rawName);
  if (!normalizedRawName) return null;

  const exactMatch = searchMap.get(normalizedRawName);
  if (exactMatch) return exactMatch;

  const containsMatch = parameters.find((parameter) => {
    const possibleNames = [
      parameter.display_name,
      parameter.parameter_name,
      parameter.symbol || "",
    ]
      .filter(Boolean)
      .map(normalizeText)
      .filter((name) => name.length >= 2);

    return possibleNames.some(
      (name) =>
        normalizedRawName === name ||
        normalizedRawName.includes(name) ||
        name.includes(normalizedRawName)
    );
  });

  return containsMatch || null;
}

function findUnitId(parameter: ParameterForImport, rawUnit: string | undefined) {
  if (!rawUnit?.trim()) return parameter.unit_id;

  const normalizedRawUnit = normalizeText(rawUnit);
  const match = parameter.available_units.find((unit) => {
    return (
      normalizeText(unit.unit_symbol) === normalizedRawUnit ||
      normalizeText(unit.display_symbol) === normalizedRawUnit
    );
  });

  return match?.unit_id || parameter.unit_id;
}

function getParameterLabel(parameter: ParameterForImport) {
  return `${parameter.display_name}${
    parameter.symbol ? ` (${parameter.symbol})` : ""
  }${parameter.is_custom ? " - Custom" : ""}`;
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
    parameter.symbol ? `${parameter.display_name} ${parameter.symbol}` : "",
    parameter.symbol ? `${parameter.parameter_name} ${parameter.symbol}` : "",
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

function parseLooseDocumentText(
  text: string,
  parameters: ParameterForImport[]
): ImportedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizeScannedText(line))
    .filter((line) => line.length > 0);
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
    const parameter = findBestParameterMatch(parameterText, parameters, searchMap);
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

async function recognizeImage(blob: Blob) {
  const preparedImage = await prepareImageForAi(blob);
  const formData = new FormData();
  formData.append("image", preparedImage, "lab-report.png");

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

export default function LabValueImporter({
  open,
  mode = "import",
  onClose,
  parameters,
  existingValues = {},
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

  useEffect(() => {
    if (!open) return;
    setHasImportMemory(Boolean(readImportMemory()));
    if (mode === "scan") {
      void startCamera();
    }
  }, [open, mode]);

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

    const preview = rows.map((row, index) => {
      const matchedParameter = findBestParameterMatch(
        row.parameter,
        parameters,
        searchMap
      );
      const parsedValue = Number(String(row.value).replace(",", "."));
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
          status: "invalid" as const,
          message: "Missing parameter name.",
          selected: false,
        };
      }

      if (!row.value.trim() || Number.isNaN(parsedValue)) {
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
          value: String(parsedValue),
          unit: row.unit || null,
          sampleName: row.sample || null,
          source: sourceDetail,
          selectedUnitId: null,
          status: "unmatched" as const,
          message: "Choose a parameter.",
          selected: false,
        };
      }

      return {
        id: baseId,
        rowNumber: index + 2,
        rawParameter: row.parameter,
        matchedParameterKey: matchedParameter.parameter_key,
        value: String(parsedValue),
        unit: row.unit || matchedParameter.unit_symbol,
        sampleName: row.sample || null,
        source: sourceDetail,
        selectedUnitId: findUnitId(matchedParameter, row.unit),
        status: "matched" as const,
        message: row.confidence && row.confidence < 0.75 ? "Review match." : "Ready.",
        selected: true,
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
        : extractRowsWithIntelligence(text);

    if (rows.length === 0) {
      setPreviewRows([]);
      setMessage(
        payload.warning ||
          "No lab values were detected. Try a clearer photo, another file, or paste the report text."
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
    const rows = extraction.values.map((value) => ({
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
      const payload = await recognizeImage(blob);
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
        buildPreview(smartRows.length > 0 ? smartRows : parseCsv(text));
        return;
      }

      if (fileName.endsWith(".txt")) {
        const text = await file.text();
        setDocumentText(text);
        setShowTextReview(true);
        buildDocumentPreview(text);
        return;
      }

      if (fileName.endsWith(".pdf")) {
        const buffer = await file.arrayBuffer();
        const text = await extractPdfText(buffer);
        const textRows = extractRowsWithIntelligence(text);

        if (textRows.length > 0) {
          setDocumentText(text);
          setShowTextReview(true);
          buildPreview(textRows);
          return;
        }

        setLoadingLabel("The PDF looks scanned. Reading its pages...");
        const pageImages = await renderPdfPagesForAi(buffer);
        const pageTexts: string[] = [];
        const pageTokens: DocToken[] = [];

        for (let index = 0; index < pageImages.length; index += 1) {
          setLoadingLabel(`Reading PDF page ${index + 1} of ${pageImages.length}...`);
          const payload = await recognizeImage(pageImages[index]);
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
          buildPreview(smartRows);
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
            status: "unmatched",
            message: "Choose a parameter.",
            selected: false,
          };
        }

        return {
          ...row,
          matchedParameterKey: parameter.parameter_key,
          selectedUnitId: parameter.unit_id,
          unit: parameter.unit_symbol,
          status: "matched",
          message: "Ready.",
          selected: true,
        };
      })
    );
  }

  function updateRowUnit(rowId: string, unitId: number) {
    setPreviewRows((previousRows) =>
      previousRows.map((row) =>
        row.id === rowId ? { ...row, selectedUnitId: unitId } : row
      )
    );
  }

  function updateRowSample(rowId: string, sampleName: string) {
    setPreviewRows((previousRows) =>
      previousRows.map((row) =>
        row.id === rowId ? { ...row, sampleName } : row
      )
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

    for (const row of rowsToImport) {
      if (!row.matchedParameterKey || !row.selectedUnitId) continue;
      importedValues[row.matchedParameterKey] = row.value;
      importedUnits[row.matchedParameterKey] = row.selectedUnitId;
    }

    onImportValues(importedValues, importedUnits, importMetadata);
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
                        </td>
                        <td className="border-b border-slate-100 p-3 font-bold">
                          {row.value || "-"}
                        </td>
                        <td className="border-b border-slate-100 p-3">
                          {matchedParameter ? (
                            <div className="grid gap-1">
                            <select
                              className="w-full rounded-xl border border-slate-200 bg-white p-2 outline-none focus:border-green-600"
                              value={row.selectedUnitId || ""}
                              onChange={(event) =>
                                updateRowUnit(row.id, Number(event.target.value))
                              }
                            >
                              {matchedParameter.available_units.map((unit, index) => (
                                <option
                                  key={`${unit.unit_id}-${unit.display_symbol}-${index}`}
                                  value={unit.unit_id}
                                >
                                  {unit.display_symbol || unit.unit_symbol}
                                </option>
                              ))}
                            </select>
                              {row.unit ? (
                                <p className="text-xs font-semibold text-slate-500">
                                  Detected: {row.unit}. Values are not converted.
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
