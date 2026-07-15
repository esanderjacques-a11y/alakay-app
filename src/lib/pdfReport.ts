import type { Translation } from "@/lib/translations";
import { formatMessage } from "@/lib/translations";
import { saveBlobWithPicker } from "@/lib/fileSave";
import { calculateSoilTexture } from "@/lib/soilTexture";
import type { CalculationOutput } from "@/lib/agronomicCalculators";
import type { PdfFertilizerProduct } from "@/lib/fertilizerReportPayload";
import {
  formatAmendmentRecommendationLines,
  recommendSoilAmendment,
  soilAmendmentInputFromPdfResults,
} from "@/lib/amendmentRecommendation";
import { interpretCationRatio } from "@/lib/cicInterpretation";
import { eventsToPlanRows } from "@/lib/fertilizationPlanPdf";
import type { CalendarEvent } from "@/lib/planningTypes";

export type { PdfFertilizerProduct };

export type PdfResult = {
  display_parameter_name: string;
  parameter_name: string;
  value: number;
  unit_symbol: string;
  min: number | null;
  max: number | null;
  level_code: string;
  final_group_code: string;
  confidence: string;
  advice: string;
  source_name: string | null;
  is_proxy: boolean;
  custom_parameter_id?: number | null;
};

export type TextureSummary = {
  className: string;
  explanation: string;
  sand: number;
  silt: number;
  clay: number;
};

export type GroupedPdfResults = {
  negative: PdfResult[];
  warning: PdfResult[];
  normal: PdfResult[];
  positive: PdfResult[];
  neutral: PdfResult[];
  other: PdfResult[];
};

export type PdfReportMeta = {
  title?: string;
  details?: string[];
  analysisName?: string;
  generatedBy?: string;
  farm?: string;
  lots?: string;
  lab?: string;
  date?: string;
  place?: string;
  crop?: string;
  sampleType?: string;
  /** Phosphorus extraction / sufficiency method label (Crop-specific / Olsen / Mehlich). */
  extractionMethod?: string;
  /** Extra note when Olsen/Mehlich bands (Tabla N.° 1) apply. */
  extractionNote?: string;
};

export type CalculatorOutputPack = {
  id: string;
  label: string;
  outputs: CalculationOutput[];
};

/** Merge calculator updates without wiping packs when Calculators remounts empty. */
export function mergeCalculatorOutputPacks(
  previous: CalculatorOutputPack[],
  updates: CalculatorOutputPack[]
): CalculatorOutputPack[] {
  if (updates.length === 0) return previous;
  const map = new Map(previous.map((pack) => [pack.id, pack]));
  for (const pack of updates) {
    if (pack.outputs.length === 0) map.delete(pack.id);
    else map.set(pack.id, pack);
  }
  return Array.from(map.values());
}

/** @deprecated Prefer calculatorPacks; kept for callers still using flat outputs. */
export type PdfReportOptions = {
  includeLogo?: boolean;
  includeSummary?: boolean;
  includeCharts?: boolean;
  includeOriginalLabValues?: boolean;
  includeCalculationValues?: boolean;
  includeDopInReport?: boolean;
  includeNutrientRatiosInReport?: boolean;
};

export type PdfReportSectionOptions = {
  includeLogo: boolean;
  includeCover: boolean;
  includeSoilStatus: boolean;
  includeTexture: boolean;
  includeInterpretation: boolean;
  includeMissingValues: boolean;
  includeLabValues: boolean;
  includeSummary: boolean;
  includeCalculations: boolean;
  includeDop: boolean;
  includeRatios: boolean;
  includeCicBases: boolean;
  includePhAmendments: boolean;
  includeNutrientPlan: boolean;
  includeFertilizerPlan: boolean;
  includeCalendar: boolean;
  includeRecommendations: boolean;
  selectedCalculatorIds: string[];
};

/** Merge per-export picks with saved report defaults. */
export function resolvePdfReportSections(
  sections?: Partial<PdfReportSectionOptions> | null,
  reportOptions?: PdfReportOptions | null
): PdfReportSectionOptions {
  const includeCicBases = sections?.includeCicBases ?? true;
  const includePhAmendments = sections?.includePhAmendments ?? true;
  const includeNutrientPlan = sections?.includeNutrientPlan ?? true;
  const selectedFromFlags = [
    includeCicBases ? "cic" : null,
    includePhAmendments ? "amendment" : null,
    includeNutrientPlan ? "fertilizer" : null,
  ].filter(Boolean) as string[];

  return {
    includeLogo: sections?.includeLogo ?? reportOptions?.includeLogo ?? true,
    includeCover: sections?.includeCover ?? true,
    includeSoilStatus: sections?.includeSoilStatus ?? true,
    includeTexture: sections?.includeTexture ?? false,
    includeInterpretation: sections?.includeInterpretation ?? false,
    includeMissingValues: sections?.includeMissingValues ?? false,
    includeLabValues:
      sections?.includeLabValues ?? reportOptions?.includeOriginalLabValues ?? false,
    includeSummary:
      sections?.includeSummary ?? reportOptions?.includeSummary ?? false,
    includeCalculations:
      sections?.includeCalculations ??
      reportOptions?.includeCalculationValues ??
      true,
    includeDop: sections?.includeDop ?? reportOptions?.includeDopInReport ?? true,
    includeRatios:
      sections?.includeRatios ?? reportOptions?.includeNutrientRatiosInReport ?? true,
    includeCicBases,
    includePhAmendments,
    includeNutrientPlan,
    includeFertilizerPlan: sections?.includeFertilizerPlan ?? true,
    includeCalendar: sections?.includeCalendar ?? true,
    includeRecommendations: sections?.includeRecommendations ?? true,
    selectedCalculatorIds:
      sections?.selectedCalculatorIds && sections.selectedCalculatorIds.length > 0
        ? sections.selectedCalculatorIds
        : selectedFromFlags,
  };
}

export function defaultPdfReportSections(
  reportOptions?: PdfReportOptions | null
): PdfReportSectionOptions {
  return resolvePdfReportSections(null, reportOptions);
}

export function buildPdfExportChecklist(args: {
  meta?: PdfReportMeta;
  hasResults: boolean;
  calculatorPacks: CalculatorOutputPack[];
  t: Translation;
}): string[] {
  const { meta, hasResults, calculatorPacks, t } = args;
  const warnings: string[] = [];

  if (!meta?.analysisName?.trim() && !meta?.title?.trim()) {
    warnings.push(t.exportMissingAnalysisName || "Analysis name not set");
  }
  if (!meta?.farm?.trim()) {
    warnings.push(t.exportMissingFarm || "Farm not set");
  }
  if (!meta?.lots?.trim()) {
    warnings.push(t.exportMissingLots || "Lot not set");
  }
  if (!meta?.place?.trim()) {
    warnings.push(t.exportMissingPlace || "Place / country not set");
  }
  if (!meta?.generatedBy?.trim()) {
    warnings.push(t.exportMissingGenerator || "Generator name not available");
  }
  if (!hasResults) {
    warnings.push(t.exportMissingResults || "No interpreted results yet");
  }
  if (!calculatorPacks.some((pack) => pack.outputs.length > 0)) {
    warnings.push(
      t.exportMissingCalculators ||
        "No calculator results yet — only analysis sections will appear"
    );
  }

  return warnings;
}

function isDopCalculation(label: string) {
  return /\bdop\b/i.test(label);
}

function isRatioCalculation(label: string) {
  return /\/|\bratio\b|\bca\s*\/\s*mg\b|\bmg\s*\/\s*k\b|\bk\s*\/\s*na\b|\bca\s*\/\s*k\b|\bca\s*\/\s*na\b/i.test(
    label
  );
}

/** Hide notes that look like calculation steps / formulas. */
export function looksLikeFormula(text: string) {
  const value = String(text || "").trim();
  if (!value) return true;
  if (/[=≈≤≥]/.test(value) && /[+\-×*/÷]/.test(value)) return true;
  if (/\b(formula|ecuaci[oó]n|équation|demande\s*[−\-]|demand\s*[−\-])/i.test(value)) {
    return true;
  }
  if (/\([^)]*[+\-×*/÷=][^)]*\)/.test(value) && /\d/.test(value)) return true;
  return false;
}

function filterSafeNotes(notes: string[] | undefined, limit = 3) {
  return (notes || []).filter((note) => !looksLikeFormula(note)).slice(0, limit);
}

function filterCalculationValues(
  values: CalculationOutput[],
  sections: PdfReportSectionOptions
) {
  return values.filter((item) => {
    if (!sections.includeDop && isDopCalculation(item.label)) return false;
    if (!sections.includeRatios && isRatioCalculation(item.label)) return false;
    return true;
  });
}

export function buildExportRecommendations(args: {
  planRecommendations?: string[];
  results: PdfResult[];
  fertilizerProducts?: PdfFertilizerProduct[];
  includeInterpretationAdvice?: boolean;
  fertilizerApplyLines?: string[];
  /** Optional i18n map (calculatorHubText or Translation) for amendment lines. */
  amendmentLabels?: Record<string, string>;
}): string[] {
  const lines: string[] = [];
  const seen = new Set<string>();

  function push(raw: string | undefined | null) {
    const text = String(raw || "")
      .replace(/\s+/g, " ")
      .trim();
    if (!text || looksLikeFormula(text)) return;
    const key = text.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(text);
  }

  for (const line of args.planRecommendations || []) push(line);

  const planAlreadyStatesAmendment = (args.planRecommendations || []).some((line) =>
    /amendment:|enmienda:|amendement:|amandman:|emenda:|marekebisho:|no soil amendment is needed|no se necesita enmienda|aucune amendement n['']est n[eé]cessaire|pa bezwen amandman|nenhuma emenda [eé] necess|hakuna marekebisho/i.test(
      line
    )
  );
  if (!planAlreadyStatesAmendment) {
    const amendmentRec = recommendSoilAmendment(
      soilAmendmentInputFromPdfResults(args.results)
    );
    for (const line of formatAmendmentRecommendationLines(
      amendmentRec,
      args.amendmentLabels || {}
    )) {
      push(line);
    }
  }

  const low: string[] = [];
  const high: string[] = [];
  for (const result of args.results) {
    const name = result.display_parameter_name || result.parameter_name;
    const bucket = soilStatusBucket(result);
    if (bucket === "low") low.push(name);
    if (bucket === "high") high.push(name);
  }
  if (low.length > 0) {
    push(`Prioritize correction for: ${low.slice(0, 8).join(", ")}.`);
  }
  if (high.length > 0) {
    push(`Monitor / avoid excess of: ${high.slice(0, 8).join(", ")}.`);
  }

  if (args.includeInterpretationAdvice) {
    for (const result of args.results) {
      if (soilStatusBucket(result) === "ok") continue;
      push(result.advice);
    }
  }

  for (const line of args.fertilizerApplyLines || []) push(line);
  for (const product of args.fertilizerProducts || []) {
    push(
      `Apply ${product.name} (${product.analysis})${
        product.nutrient ? ` for ${product.nutrient}` : ""
      }: ${product.rateKgHa.toFixed(1)} kg/ha.`
    );
  }

  return lines;
}

function resolveCalculatorPacks(
  packs: CalculatorOutputPack[],
  flatValues: CalculationOutput[],
  t: Translation
): CalculatorOutputPack[] {
  if (packs.length > 0) return packs.filter((pack) => pack.outputs.length > 0);
  if (flatValues.length === 0) return [];
  return [
    {
      id: "calculations",
      label: t.calculators || "Calculators",
      outputs: flatValues,
    },
  ];
}

function selectCalculatorPacks(
  packs: CalculatorOutputPack[],
  sections: PdfReportSectionOptions
): CalculatorOutputPack[] {
  if (sections.selectedCalculatorIds.length > 0) {
    const selected = new Set(sections.selectedCalculatorIds);
    return packs
      .filter((pack) => selected.has(pack.id))
      .map((pack) => ({
        ...pack,
        outputs: filterCalculationValues(pack.outputs, sections),
      }))
      .filter((pack) => pack.outputs.length > 0);
  }

  if (!sections.includeCalculations) return [];

  return packs
    .map((pack) => ({
      ...pack,
      outputs: filterCalculationValues(pack.outputs, sections),
    }))
    .filter((pack) => pack.outputs.length > 0);
}

function normalizeLevelKey(code: string | null | undefined) {
  return String(code || "")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
}

function soilStatusBucket(
  result: PdfResult
): "low" | "ok" | "high" {
  const group = normalizeGroupCode(result.final_group_code);
  const level = normalizeLevelKey(result.level_code);

  if (
    group === "positive" ||
    level === "high" ||
    level === "very_high" ||
    level.includes("excess") ||
    level.includes("surplus")
  ) {
    return "high";
  }

  if (
    group === "negative" ||
    group === "warning" ||
    level === "low" ||
    level === "very_low" ||
    level.includes("deficien") ||
    level.includes("scarce")
  ) {
    return "low";
  }

  return "ok";
}

const GROUP_KEYS = [
  "negative",
  "warning",
  "normal",
  "positive",
  "neutral",
] as const;

export function normalizeGroupCode(code: string | null | undefined) {
  const group = String(code || "other").toLowerCase();
  return GROUP_KEYS.includes(group as (typeof GROUP_KEYS)[number])
    ? group
    : "other";
}

export function groupPdfResults(results: PdfResult[]): GroupedPdfResults {
  return {
    negative: results.filter((r) => r.final_group_code === "negative"),
    warning: results.filter((r) => r.final_group_code === "warning"),
    normal: results.filter((r) => r.final_group_code === "normal"),
    positive: results.filter((r) => r.final_group_code === "positive"),
    neutral: results.filter((r) => r.final_group_code === "neutral"),
    other: results.filter((r) => r.final_group_code === "other"),
  };
}

export function buildTextureSummaryFromResults(
  results: PdfResult[]
): TextureSummary | null {
  function findTextureValue(keywords: string[]) {
    const match = results.find((result) => {
      const name = result.parameter_name.toLowerCase();
      const displayName = result.display_parameter_name.toLowerCase();

      return keywords.some(
        (keyword) => name.includes(keyword) || displayName.includes(keyword)
      );
    });

    return match?.value ?? null;
  }

  const sand = findTextureValue(["sand", "arena", "sable", "sab"]);
  const silt = findTextureValue(["silt", "limo", "limon"]);
  const clay = findTextureValue(["clay", "arcilla", "argile", "ajil"]);

  if (sand === null || silt === null || clay === null) {
    return null;
  }

  const texture = calculateSoilTexture({ sand, silt, clay });
  if (!texture) return null;

  return {
    className: texture.className,
    explanation: texture.explanation,
    sand,
    silt,
    clay,
  };
}

const GROUP_COLORS: Record<string, [number, number, number]> = {
  negative: [170, 24, 24],
  warning: [180, 83, 9],
  normal: [4, 120, 87],
  positive: [13, 148, 136],
  neutral: [71, 85, 105],
  other: [100, 116, 139],
};

const GROUP_FILLS: Record<string, [number, number, number]> = {
  negative: [254, 226, 226],
  warning: [254, 243, 199],
  normal: [209, 250, 229],
  positive: [204, 251, 241],
  neutral: [241, 245, 249],
  other: [241, 245, 249],
};

const STATUS_COLORS: Record<"low" | "ok" | "high", [number, number, number]> = {
  low: [170, 24, 24],
  ok: [4, 120, 87],
  high: [13, 148, 136],
};

const PDF_CONTACTS = [
  "jesander@earth.ac.cr",
  "+506 8828 7831",
  "+509 4422 9395",
] as const;

function pdfSafe(text: string): string {
  return String(text ?? "")
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\u2022|\u00B7|\u2023/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (ch) => String("₀₁₂₃₄₅₆₇₈₉".indexOf(ch)))
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, (ch) => {
      const map = "⁰¹²³⁴⁵⁶⁷⁸⁹";
      return String(map.indexOf(ch));
    })
    .replace(/₂/g, "2")
    .replace(/₃/g, "3")
    .replace(/₅/g, "5")
    .replace(/₁/g, "1")
    .replace(/₄/g, "4")
    .replace(/₆/g, "6")
    .replace(/₇/g, "7")
    .replace(/₈/g, "8")
    .replace(/₉/g, "9")
    .replace(/₀/g, "0")
    .replace(/\s+/g, " ")
    .trim();
}

function findPack(
  packs: CalculatorOutputPack[],
  id: string
): CalculatorOutputPack | null {
  return packs.find((pack) => pack.id === id && pack.outputs.length > 0) || null;
}

function findOutput(
  pack: CalculatorOutputPack | null | undefined,
  patterns: string[]
): CalculationOutput | null {
  if (!pack) return null;
  const normalized = patterns.map((p) => p.toLowerCase());
  return (
    pack.outputs.find((output) => {
      const label = String(output.label || "").toLowerCase();
      return normalized.some((pattern) => label.includes(pattern));
    }) || null
  );
}

function formatCompact(value: number): string {
  if (!Number.isFinite(value)) return "-";
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  return Number(value.toFixed(2)).toString();
}

export async function exportAnalysisPdf(options: {
  t: Translation;
  results: PdfResult[];
  groupedResults: GroupedPdfResults;
  missingResults: { display_name: string; parameter_name: string; value: number }[];
  textureSummary: TextureSummary | null;
  calculatorPacks?: CalculatorOutputPack[];
  calculationValues?: CalculationOutput[];
  fertilizerProducts?: PdfFertilizerProduct[];
  recommendations?: string[];
  calendarEvents?: CalendarEvent[];
  labels?: Record<string, string>;
  isGeneralCrop: boolean;
  locale: string;
  reportMeta?: PdfReportMeta;
  reportOptions?: PdfReportOptions;
  sections?: Partial<PdfReportSectionOptions>;
  fileName?: string;
}) {
  const { jsPDF } = await import("jspdf");
  const {
    t,
    results,
    missingResults,
    textureSummary,
    calculatorPacks = [],
    calculationValues = [],
    fertilizerProducts = [],
    recommendations = [],
    calendarEvents = [],
    labels = {},
    isGeneralCrop,
    locale,
    reportMeta,
    reportOptions,
    sections,
    fileName = "cultosol-analysis-report.pdf",
  } = options;

  const exportSections = resolvePdfReportSections(sections, reportOptions);
  exportSections.includeCover = true;

  const allPacks = resolveCalculatorPacks(calculatorPacks, calculationValues, t);
  const cicPack = findPack(allPacks, "cic");
  const amendmentPack = findPack(allPacks, "amendment");
  const fertilizerPack = findPack(allPacks, "fertilizer");

  const recommendationLines = (
    recommendations.length > 0
      ? recommendations.filter((line) => !looksLikeFormula(line))
      : buildExportRecommendations({
          results,
          fertilizerProducts,
          includeInterpretationAdvice: false,
          amendmentLabels: labels,
        })
  )
    .map((line) => pdfSafe(line))
    .filter(Boolean)
    .slice(0, 12);

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  const BRAND: [number, number, number] = [5, 150, 105];
  const INK: [number, number, number] = [15, 23, 42];
  const MUTED: [number, number, number] = [100, 116, 139];
  const CARD: [number, number, number] = [248, 250, 252];
  const LINE: [number, number, number] = [226, 232, 240];

  function L(key: string, fallback: string) {
    return pdfSafe(labels[key] || (t as any)[key] || fallback);
  }

  function money(value: number | null | undefined, currency: string) {
    if (value == null || !Number.isFinite(value)) return "-";
    try {
      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: currency || "USD",
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${value.toFixed(2)} ${currency || ""}`.trim();
    }
  }

  function drawFooter() {
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(`${t.appName} · ${t.reportSubtitle}`, margin, pageHeight - 7);
    pdf.text(`${pageNumber}`, pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }

  function newPage() {
    drawFooter();
    pdf.addPage();
    pageNumber += 1;
    y = margin;
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - 18) {
      newPage();
    }
  }

  const logoData = await fetchLogo().catch(() => null);

  async function fetchLogo() {
    const response = await fetch("/app-icon.png");
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function drawParagraph(text: string, size = 11, bold = false) {
    const safe = pdfSafe(text);
    if (!safe) return;
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const lines = pdf.splitTextToSize(safe, contentWidth);
    for (const line of lines) {
      ensureSpace(6);
      pdf.text(line, margin, y);
      y += size * 0.45 + 2.2;
    }
  }

  function drawSectionTitle(title: string) {
    ensureSpace(18);
    y += 3;
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, 2.4, 7, 0.6, 0.6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(pdfSafe(title), margin + 5.5, y + 5.5);
    y += 13;
    pdf.setTextColor(INK[0], INK[1], INK[2]);
  }

  function drawKvRow(label: string, value: string, unit = "") {
    const left = pdfSafe(label);
    const right = pdfSafe(`${value}${unit ? ` ${unit}` : ""}`);
    ensureSpace(12);
    pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
    pdf.roundedRect(margin, y, contentWidth, 10, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const labelLines = pdf.splitTextToSize(left, contentWidth * 0.58);
    pdf.text(labelLines[0], margin + 3, y + 6.5);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(right, pageWidth - margin - 3, y + 6.5, { align: "right" });
    y += 12;
  }

  function drawCover() {
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.rect(0, 0, pageWidth, 32, "F");

    let titleX = margin;
    if (logoData && exportSections.includeLogo) {
      // Logo is a black-bg icon — sit it on a white rounded plate.
      pdf.setFillColor(255, 255, 255);
      pdf.roundedRect(margin, 5, 22, 22, 3.5, 3.5, "F");
      pdf.addImage(logoData, "PNG", margin + 3, 8, 16, 16);
      titleX = margin + 26;
    }

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(pdfSafe(t.appName), titleX, 14);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(pdfSafe(t.reportSubtitle), titleX, 22);

    y = 42;

    const analysisTitle =
      reportMeta?.analysisName?.trim() ||
      reportMeta?.title?.trim() ||
      t.analysisSummary;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const titleLines = pdf.splitTextToSize(pdfSafe(analysisTitle), contentWidth);
    for (const line of titleLines) {
      ensureSpace(8);
      pdf.text(line, margin, y);
      y += 8;
    }
    y += 3;

    const dateValue =
      reportMeta?.date?.trim() || new Date().toLocaleDateString(locale);

    const metaPairs: Array<[string, string | undefined]> = [
      [L("exportGeneratedBy", "Generated by"), reportMeta?.generatedBy],
      [L("exportDate", t.generatedOn || "Date"), dateValue],
      [L("exportFarm", "Farm"), reportMeta?.farm],
      [L("exportLots", "Lot(s)"), reportMeta?.lots],
      [L("exportPlace", "Place"), reportMeta?.place],
      [L("exportLab", "Lab"), reportMeta?.lab],
      [L("exportCrop", "Crop"), reportMeta?.crop],
      [L("sampleType", "Sample type"), reportMeta?.sampleType],
      [
        L("extractionMethodLabel", "Phosphorus extraction method"),
        reportMeta?.extractionMethod,
      ],
    ];

    const usable = metaPairs.filter(([, value]) => Boolean(value?.trim()));
    const gap = 3;
    const colW = (contentWidth - gap) / 2;
    const rowH = 14;
    let col = 0;
    let rowY = y;

    for (const [label, value] of usable) {
      const x = margin + col * (colW + gap);
      ensureSpace(rowH + 2);
      if (col === 0) rowY = y;
      pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
      pdf.roundedRect(x, rowY, colW, rowH, 1.5, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(pdfSafe(label).toUpperCase(), x + 3, rowY + 4.8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      const clipped = pdf.splitTextToSize(pdfSafe(String(value)), colW - 6);
      pdf.text(clipped[0], x + 3, rowY + 10.5);

      col += 1;
      if (col >= 2) {
        col = 0;
        y = rowY + rowH + 2.5;
      }
    }
    if (col !== 0) y = rowY + rowH + 2.5;

    if (usable.length === 0 && reportMeta?.details?.length) {
      for (const detail of reportMeta.details) {
        drawParagraph(detail, 11);
      }
    }

    y += 4;
  }

  function drawSoilStatusDashboard() {
    if (results.length === 0) return;

    drawSectionTitle(L("exportSectionSoilStatus", t.analysisSummary || "Soil status"));

    const buckets: Record<"low" | "ok" | "high", PdfResult[]> = {
      low: [],
      ok: [],
      high: [],
    };

    for (const result of results) {
      buckets[soilStatusBucket(result)].push(result);
    }

    const cards: Array<{ key: "low" | "ok" | "high"; title: string }> = [
      { key: "low", title: L("exportSoilStatusLow", "Low / needs attention") },
      { key: "ok", title: L("exportSoilStatusOk", "Adequate") },
      { key: "high", title: L("exportSoilStatusHigh", "High / excess") },
    ];

    const gap = 3;
    const cardW = (contentWidth - gap * 2) / 3;
    const cardH = 30;
    ensureSpace(cardH + 4);
    const top = y;

    cards.forEach((card, index) => {
      const items = buckets[card.key];
      const x = margin + index * (cardW + gap);
      const color = STATUS_COLORS[card.key];
      pdf.setFillColor(255, 255, 255);
      pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
      pdf.setLineWidth(0.4);
      pdf.roundedRect(x, top, cardW, cardH, 2, 2, "FD");
      pdf.setFillColor(color[0], color[1], color[2]);
      pdf.roundedRect(x, top, cardW, 2.4, 1, 1, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(20);
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(String(items.length), x + 4, top + 15);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const titleLines = pdf.splitTextToSize(card.title, cardW - 8);
      pdf.text(titleLines.slice(0, 2), x + 4, top + 22);
    });

    y = top + cardH + 6;

    for (const card of cards) {
      const items = buckets[card.key];
      if (items.length === 0) continue;
      const color = STATUS_COLORS[card.key];
      ensureSpace(10);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(`${card.title} (${items.length})`, margin, y);
      y += 5;
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      for (const item of items) {
        const name = item.display_parameter_name || item.parameter_name;
        drawParagraph(`- ${name}`, 10);
      }
      y += 1;
    }

    // One quick interpretation box (no full per-parameter advice cards).
    const lowNames = buckets.low
      .map((r) => r.display_parameter_name || r.parameter_name)
      .slice(0, 8);
    const highNames = buckets.high
      .map((r) => r.display_parameter_name || r.parameter_name)
      .slice(0, 6);
    let quick = "";
    if (lowNames.length > 0) {
      quick = L("exportSoilQuickLow", "Prioritize correcting: {list}.").replace(
        "{list}",
        lowNames.join(", ")
      );
      if (highNames.length > 0) {
        quick +=
          " " +
          L("exportSoilQuickHigh", "Monitor excess of: {list}.").replace(
            "{list}",
            highNames.join(", ")
          );
      }
    } else if (highNames.length > 0) {
      quick = L("exportSoilQuickHigh", "Monitor excess of: {list}.").replace(
        "{list}",
        highNames.join(", ")
      );
    } else if (results.length > 0) {
      quick = L(
        "exportSoilQuickOk",
        "Most parameters are within adequate ranges."
      );
    }
    if (quick) {
      ensureSpace(22);
      pdf.setFillColor(236, 253, 245);
      pdf.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.setLineWidth(0.4);
      const wrap = pdf.splitTextToSize(pdfSafe(quick), contentWidth - 10);
      const boxH = Math.max(16, wrap.length * 5 + 8);
      pdf.roundedRect(margin, y, contentWidth, boxH, 2, 2, "FD");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.text(L("exportQuickInterpretation", "Quick interpretation"), margin + 4, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(wrap, margin + 4, y + 11);
      y += boxH + 4;
    }
  }

  function drawCicBasesSection(pack: CalculatorOutputPack) {
    drawSectionTitle(
      L("exportSectionCicBases", "CIC, bases and ratios")
    );

    const ordered: Array<{
      patterns: string[];
      onlyIfPositive?: boolean;
      fallbackLabel: string;
    }> = [
      {
        patterns: ["total base", "v%", "base saturation", "saturacion de bases", "saturation totale"],
        fallbackLabel: L("cicTotalBases", "Total base saturation V%"),
      },
      {
        patterns: ["ca saturation", "%ca", "saturacion de ca", "saturation ca"],
        fallbackLabel: L("cicCaSaturation", "%Ca"),
      },
      {
        patterns: ["mg saturation", "%mg", "saturacion de mg", "saturation mg"],
        fallbackLabel: L("cicMgSaturation", "%Mg"),
      },
      {
        patterns: ["k saturation", "%k", "saturacion de k", "saturation k"],
        fallbackLabel: L("cicKSaturation", "%K"),
      },
      {
        patterns: ["na saturation", "%na", "saturacion de na", "saturation na"],
        onlyIfPositive: true,
        fallbackLabel: L("cicNaSaturation", "%Na"),
      },
      {
        patterns: [
          "h+al",
          "al saturation",
          "extractable acidity",
          "acidity",
          "acidez",
        ],
        onlyIfPositive: true,
        fallbackLabel: L("cicFieldHal", "% extractable acidity (H+Al)"),
      },
    ];

    for (const row of ordered) {
      const output = findOutput(pack, row.patterns);
      if (!output) continue;
      if (row.onlyIfPositive && !(output.value > 0)) continue;
      drawKvRow(
        row.fallbackLabel,
        formatCompact(output.value),
        output.unit
      );
    }

    const ratioSpecs: Array<{
      key: "ca_mg" | "mg_k" | "ca_k";
      patterns: string[];
      label: string;
    }> = [
      { key: "ca_mg", patterns: ["ca/mg"], label: "Ca/Mg" },
      { key: "mg_k", patterns: ["mg/k"], label: "Mg/K" },
      { key: "ca_k", patterns: ["ca/k"], label: "Ca/K" },
    ];

    const attention: Array<{ label: string; message: string; value: string }> = [];
    for (const spec of ratioSpecs) {
      const output = findOutput(pack, spec.patterns);
      if (!output) continue;
      const interpretation = interpretCationRatio(spec.key, output.value);
      if (interpretation.band === "optimal" || interpretation.band === "unknown") {
        continue;
      }
      attention.push({
        label: output.label || spec.label,
        value: `${formatCompact(output.value)} ${output.unit || ":1"}`.trim(),
        message: L(interpretation.messageKey, interpretation.messageKey),
      });
    }

    if (attention.length > 0) {
      y += 1;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(STATUS_COLORS.low[0], STATUS_COLORS.low[1], STATUS_COLORS.low[2]);
      ensureSpace(8);
      pdf.text(L("exportCicRatiosAttention", "Ratios needing attention"), margin, y);
      y += 5;
      for (const item of attention) {
        ensureSpace(16);
        pdf.setFillColor(254, 226, 226);
        const wrap = pdf.splitTextToSize(
          pdfSafe(`${item.label} (${item.value}): ${item.message}`),
          contentWidth - 8
        );
        const h = Math.max(12, wrap.length * 4.8 + 4);
        pdf.roundedRect(margin, y, contentWidth, h, 1.5, 1.5, "F");
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(10);
        pdf.setTextColor(INK[0], INK[1], INK[2]);
        pdf.text(wrap, margin + 3, y + 5);
        y += h + 2;
      }
    }
  }

  function drawAmendmentSection(pack: CalculatorOutputPack) {
    drawSectionTitle(
      L("exportSectionPhAmendments", "pH and amendments")
    );
    for (const output of pack.outputs) {
      if (!Number.isFinite(output.value)) continue;
      drawKvRow(output.label, formatCompact(output.value), output.unit);
      for (const note of output.notes || []) {
        if (!note || looksLikeFormula(note)) continue;
        // Prefer material / why notes; skip base requirement math detail
        if (/base requirement|requerimiento base|cce\s*\d/i.test(note)) continue;
        drawParagraph(note, 10);
      }
    }
  }

  function drawNutrientPlanSection(pack: CalculatorOutputPack) {
    drawSectionTitle(L("exportSectionNutrientPlan", "Nutrient plan"));
    let drawn = 0;
    for (const output of pack.outputs) {
      const label = String(output.label || "")
        .replace(/^Dosis\s+/i, "")
        .replace(/\s*[—-]\s*liming.*/i, " (liming)");
      if (/\bnf\b/i.test(label)) continue;
      if (!Number.isFinite(output.value) || output.value === 0) continue;
      drawKvRow(label, formatCompact(output.value), output.unit);
      drawn += 1;
    }
    if (drawn === 0) {
      drawParagraph(L("exportNutrientPlanEmpty", "No nutrient doses required."), 10);
    }
  }

  function drawFertilizerProductsTable(products: PdfFertilizerProduct[]) {
    if (products.length === 0) return;
    drawSectionTitle(
      L(
        "exportSectionFertilizerProducts",
        t.exportSectionFertilizerProducts ||
          t.fertilizerProductsTitle ||
          "Fertilizer products & costs"
      )
    );
    const cols = [
      { key: "product", label: L("exportFertilizerColProduct", "Product"), w: 48 },
      { key: "grade", label: L("exportFertilizerColGrade", "Grade"), w: 22 },
      { key: "rate", label: L("exportFertilizerColRate", "Rate"), w: 28 },
      { key: "price", label: L("exportFertilizerColPrice", "Price"), w: 32 },
      { key: "cost", label: L("exportFertilizerColCost", "Cost/ha"), w: 28 },
    ] as const;
    const tableW = cols.reduce((sum, col) => sum + col.w, 0);
    const scale = contentWidth / tableW;

    function drawHeader() {
      ensureSpace(11);
      pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.roundedRect(margin, y, contentWidth, 9, 1, 1, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(255, 255, 255);
      let x = margin;
      for (const col of cols) {
        pdf.text(col.label, x + 2, y + 6);
        x += col.w * scale;
      }
      y += 10;
    }

    drawHeader();

    products.forEach((product, index) => {
      ensureSpace(12);
      if (index % 2 === 0) {
        pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
        pdf.rect(margin, y - 1, contentWidth, 11, "F");
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);

      const rate =
        product.bagsHa != null
          ? `${product.rateKgHa.toFixed(1)} kg · ${product.bagsHa.toFixed(1)} bags`
          : `${product.rateKgHa.toFixed(1)} kg/ha`;
      const price =
        product.pricePerBag != null
          ? money(product.pricePerBag, product.currency)
          : product.pricePerTonne != null
            ? `${money(product.pricePerTonne, product.currency)}/t`
            : "-";
      const cost = money(product.costPerHa, product.currency);
      const cells = [
        pdfSafe(product.name),
        pdfSafe(product.analysis),
        pdfSafe(rate),
        pdfSafe(price),
        pdfSafe(cost),
      ];
      let x = margin;
      cells.forEach((cell, i) => {
        const w = cols[i].w * scale;
        const lines = pdf.splitTextToSize(cell, w - 3);
        pdf.text(lines[0], x + 2, y + 5.5);
        x += w;
      });
      y += 11;
    });

    const totalCost = products.reduce(
      (sum, product) => sum + (product.costPerHa || 0),
      0
    );
    if (totalCost > 0) {
      y += 1;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(11);
      pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.text(
        `${L("exportFertilizerTotalCost", "Estimated total")}: ${money(
          totalCost,
          products[0]?.currency || "USD"
        )}/ha`,
        margin,
        y
      );
      y += 8;
    }
  }

  function drawCalendarTable(events: CalendarEvent[]) {
    const rows = eventsToPlanRows(events);
    if (rows.length === 0) return;

    const planning = (t as any).planning || {};
    drawSectionTitle(
      L("exportSectionCalendar", planning.pdfScheduleTable || "Fertilization calendar")
    );

    const colDate = margin;
    const colQty = margin + 28;
    const colFert = margin + 58;
    const colMethod = margin + 118;
    const widths = {
      date: 26,
      qty: 28,
      fert: 58,
      method: contentWidth - 112,
    };

    function drawHeader() {
      ensureSpace(10);
      pdf.setFillColor(240, 253, 244);
      pdf.rect(margin, y - 4, contentWidth, 9, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.text(L("pdfColDate", planning.pdfColDate || "Date"), colDate, y);
      pdf.text(L("pdfColQuantity", planning.pdfColQuantity || "Quantity"), colQty, y);
      pdf.text(
        L("pdfColFertilizer", planning.pdfColFertilizer || "Fertilizer"),
        colFert,
        y
      );
      pdf.text(L("pdfColMethod", planning.pdfColMethod || "Method"), colMethod, y);
      y += 6;
      pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 4;
    }

    drawHeader();

    for (const row of rows) {
      ensureSpace(12);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      const dateLines = pdf.splitTextToSize(pdfSafe(row.date), widths.date);
      const qtyLines = pdf.splitTextToSize(pdfSafe(row.quantity), widths.qty);
      const fertLines = pdf.splitTextToSize(pdfSafe(row.fertilizer), widths.fert);
      const methodLines = pdf.splitTextToSize(pdfSafe(row.method), widths.method);
      const lineCount = Math.max(
        dateLines.length,
        qtyLines.length,
        fertLines.length,
        methodLines.length,
        1
      );
      pdf.text(dateLines[0], colDate, y);
      pdf.text(qtyLines[0], colQty, y);
      pdf.text(fertLines[0], colFert, y);
      pdf.text(methodLines[0], colMethod, y);
      y += Math.max(6, lineCount * 4.2);
    }
    y += 3;
  }

  function drawRecommendations(list: string[]) {
    if (list.length === 0) return;
    drawSectionTitle(L("exportSectionRecommendations", "Recommendations"));
    list.forEach((line, index) => {
      ensureSpace(12);
      const fill = index % 2 === 0 ? CARD : ([255, 255, 255] as [number, number, number]);
      pdf.setFillColor(fill[0], fill[1], fill[2]);
      const wrap = pdf.splitTextToSize(
        pdfSafe(`${index + 1}. ${line}`),
        contentWidth - 6
      );
      const h = Math.max(9, wrap.length * 4.6 + 3);
      pdf.roundedRect(margin, y, contentWidth, h, 1.2, 1.2, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(wrap, margin + 3, y + 5.5);
      y += h + 2;
    });
  }

  function drawContacts() {
    drawSectionTitle(L("exportSectionContacts", "Questions? Contact us"));
    drawParagraph(
      L(
        "exportContactsIntro",
        "If you have questions about this report, reach Cultosol:"
      ),
      11
    );
    drawKvRow("Email", PDF_CONTACTS[0]);
    drawKvRow(L("aboutPhoneCr", "Costa Rica"), PDF_CONTACTS[1]);
    drawKvRow(L("aboutPhoneHt", "Haiti"), PDF_CONTACTS[2]);
  }

  // —— Report body ——
  drawCover();

  if (isGeneralCrop) {
    drawSectionTitle(L("generalReferenceModeTitle", t.generalReferenceModeTitle));
    drawParagraph(t.generalCropWarning, 11);
    if (reportMeta?.extractionNote) {
      drawParagraph(reportMeta.extractionNote, 10);
    }
  } else if (reportMeta?.extractionNote) {
    drawSectionTitle(
      L("extractionMethodLabel", "Sufficiency / extraction")
    );
    drawParagraph(reportMeta.extractionNote, 10);
  }

  if (exportSections.includeSoilStatus) {
    drawSoilStatusDashboard();
  }

  if (exportSections.includeTexture && textureSummary) {
    drawSectionTitle(L("exportSectionTexture", t.soilTexture || "Soil texture"));
    drawParagraph(
      `${L("textureClass", t.textureClass || "Class")}: ${textureSummary.className}`,
      12,
      true
    );
    drawParagraph(
      `${L("sand", t.sand || "Sand")}: ${textureSummary.sand}% · ${L("silt", t.silt || "Silt")}: ${textureSummary.silt}% · ${L("clay", t.clay || "Clay")}: ${textureSummary.clay}%`,
      11
    );
    drawParagraph(textureSummary.explanation, 10);
  }

  if (exportSections.includeCicBases && cicPack) {
    drawCicBasesSection(cicPack);
  }

  if (exportSections.includePhAmendments && amendmentPack) {
    drawAmendmentSection(amendmentPack);
  }

  if (exportSections.includeNutrientPlan && fertilizerPack) {
    drawNutrientPlanSection(fertilizerPack);
  }

  if (exportSections.includeFertilizerPlan && fertilizerProducts.length > 0) {
    drawFertilizerProductsTable(fertilizerProducts);
  }

  if (exportSections.includeCalendar && calendarEvents.length > 0) {
    drawCalendarTable(calendarEvents);
  }

  if (exportSections.includeRecommendations) {
    drawRecommendations(recommendationLines);
  }

  if (exportSections.includeMissingValues && missingResults.length > 0) {
    drawSectionTitle(L("noRangeFound", t.noRangeFound || "Missing / no range"));
    drawParagraph(t.noRangeFoundDesc || "", 10);
    for (const item of missingResults) {
      drawParagraph(
        `- ${item.display_name || item.parameter_name}: ${item.value}`,
        10
      );
    }
  }

  if (exportSections.includeLabValues && results.length > 0) {
    drawSectionTitle(L("exportSectionLabValues", t.values || "Lab values"));
    for (const result of results) {
      drawParagraph(
        `${result.display_parameter_name || result.parameter_name}: ${result.value} ${result.unit_symbol}`,
        10
      );
    }
  }

  drawContacts();

  drawFooter();
  const pdfBlob = new Blob([pdf.output("arraybuffer")], {
    type: "application/pdf",
  });
  await saveBlobWithPicker(
    pdfBlob,
    fileName,
    "application/pdf",
    ".pdf",
    () => pdf.save(fileName)
  );
}
