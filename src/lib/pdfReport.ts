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
  includeFertilizerPlan: boolean;
  includeRecommendations: boolean;
  selectedCalculatorIds: string[];
};

/** Merge per-export picks with saved report defaults. */
export function resolvePdfReportSections(
  sections?: Partial<PdfReportSectionOptions> | null,
  reportOptions?: PdfReportOptions | null
): PdfReportSectionOptions {
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
      false,
    includeDop: sections?.includeDop ?? reportOptions?.includeDopInReport ?? true,
    includeRatios:
      sections?.includeRatios ?? reportOptions?.includeNutrientRatiosInReport ?? true,
    includeFertilizerPlan: sections?.includeFertilizerPlan ?? true,
    includeRecommendations: sections?.includeRecommendations ?? true,
    selectedCalculatorIds: sections?.selectedCalculatorIds ?? [],
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
    groupedResults,
    missingResults,
    textureSummary,
    calculatorPacks = [],
    calculationValues = [],
    fertilizerProducts = [],
    recommendations = [],
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
  // Fertilizer product table owns the "fertilizerCost" pack; avoid double-drawing it.
  const packsForCards = allPacks.filter((pack) => pack.id !== "fertilizerCost");
  const visiblePacks = selectCalculatorPacks(packsForCards, exportSections);

  const recommendationLines =
    recommendations.length > 0
      ? recommendations.filter((line) => !looksLikeFormula(line))
      : buildExportRecommendations({
          results,
          fertilizerProducts,
          includeInterpretationAdvice: exportSections.includeInterpretation,
        });

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

  function money(value: number | null | undefined, currency: string) {
    if (value == null || !Number.isFinite(value)) return "—";
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

  function drawParagraph(text: string, size = 10, bold = false) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const lines = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(6);
      pdf.text(line, margin, y);
      y += size * 0.45 + 2;
    }
  }

  function drawSectionTitle(title: string) {
    ensureSpace(16);
    y += 3;
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, 2.2, 6, 0.6, 0.6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(title, margin + 5, y + 5);
    y += 11;
    pdf.setTextColor(INK[0], INK[1], INK[2]);
  }

  function drawCover() {
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.rect(0, 0, pageWidth, 28, "F");

    if (logoData && exportSections.includeLogo) {
      pdf.addImage(logoData, "PNG", margin, 5, 16, 16);
    }

    const titleX = logoData && exportSections.includeLogo ? margin + 20 : margin;
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(16);
    pdf.text(t.appName, titleX, 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text(t.reportSubtitle, titleX, 18);

    y = 36;

    const analysisTitle =
      reportMeta?.analysisName?.trim() ||
      reportMeta?.title?.trim() ||
      t.analysisSummary;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(15);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const titleLines = pdf.splitTextToSize(analysisTitle, contentWidth);
    for (const line of titleLines) {
      ensureSpace(7);
      pdf.text(line, margin, y);
      y += 7;
    }
    y += 3;

    const dateValue =
      reportMeta?.date?.trim() || new Date().toLocaleDateString(locale);

    const metaPairs: Array<[string, string | undefined]> = [
      [t.exportGeneratedBy || "Generated by", reportMeta?.generatedBy],
      [t.exportDate || t.generatedOn || "Date", dateValue],
      [t.exportFarm || "Farm", reportMeta?.farm],
      [t.exportLots || "Lot(s)", reportMeta?.lots],
      [t.exportPlace || "Place", reportMeta?.place],
      [t.exportLab || "Lab", reportMeta?.lab],
      [t.exportCrop || "Crop", reportMeta?.crop],
      [t.sampleType || "Sample type", reportMeta?.sampleType],
      [
        t.extractionMethodLabel || "Phosphorus extraction method",
        reportMeta?.extractionMethod,
      ],
    ];

    const usable = metaPairs.filter(([, value]) => Boolean(value?.trim()));
    const gap = 3;
    const colW = (contentWidth - gap) / 2;
    const rowH = 12;
    let col = 0;
    let rowY = y;

    for (const [label, value] of usable) {
      const x = margin + col * (colW + gap);
      ensureSpace(rowH + 2);
      if (col === 0) rowY = y;
      pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
      pdf.roundedRect(x, rowY, colW, rowH, 1.5, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(label.toUpperCase(), x + 3, rowY + 4.2);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      const clipped = pdf.splitTextToSize(String(value), colW - 6);
      pdf.text(clipped[0], x + 3, rowY + 9);

      col += 1;
      if (col >= 2) {
        col = 0;
        y = rowY + rowH + 2;
      }
    }
    if (col !== 0) y = rowY + rowH + 2;

    if (
      usable.length === 0 &&
      reportMeta?.details?.length
    ) {
      for (const detail of reportMeta.details) {
        drawParagraph(detail, 9);
      }
    }

    y += 4;
  }

  function drawSoilStatusDashboard() {
    if (results.length === 0) return;

    drawSectionTitle(t.exportSectionSoilStatus || t.analysisSummary);

    const buckets: Record<"low" | "ok" | "high", PdfResult[]> = {
      low: [],
      ok: [],
      high: [],
    };

    for (const result of results) {
      buckets[soilStatusBucket(result)].push(result);
    }

    const cards: Array<{
      key: "low" | "ok" | "high";
      title: string;
    }> = [
      { key: "low", title: t.exportSoilStatusLow || "Low / needs attention" },
      { key: "ok", title: t.exportSoilStatusOk || "Adequate" },
      { key: "high", title: t.exportSoilStatusHigh || "High / excess" },
    ];

    const gap = 3;
    const cardW = (contentWidth - gap * 2) / 3;
    const cardH = 28;
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
      pdf.roundedRect(x, top, cardW, 2.2, 1, 1, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(18);
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(String(items.length), x + 4, top + 14);

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      const titleLines = pdf.splitTextToSize(card.title, cardW - 8);
      pdf.text(titleLines.slice(0, 2), x + 4, top + 20);
    });

    y = top + cardH + 6;

    for (const card of cards) {
      const items = buckets[card.key];
      if (items.length === 0) continue;
      const color = STATUS_COLORS[card.key];
      ensureSpace(10);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(color[0], color[1], color[2]);
      pdf.text(`${card.title} (${items.length})`, margin, y);
      y += 5;
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      for (const item of items.slice(0, 12)) {
        const name = item.display_parameter_name || item.parameter_name;
        drawParagraph(
          `• ${name} · ${item.value} ${item.unit_symbol} · ${item.level_code || item.final_group_code || "—"}`,
          8.5
        );
      }
      if (items.length > 12) {
        drawParagraph(`• +${items.length - 12} more`, 8);
      }
      y += 1;
    }

    if (exportSections.includeSummary) {
      y += 1;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(
        formatMessage(t.interpretedValuesCount, { count: results.length }),
        margin,
        y
      );
      y += 6;
    }
  }

  function drawResultCard(result: PdfResult, tone: string) {
    const rgb = GROUP_COLORS[tone] || GROUP_COLORS.other;
    const fill = GROUP_FILLS[tone] || GROUP_FILLS.other;
    const advice = looksLikeFormula(result.advice) ? "" : result.advice;
    const adviceLines = advice
      ? pdf.splitTextToSize(advice, contentWidth - 12).slice(0, 2)
      : [];
    const cardH = 26 + adviceLines.length * 4;
    ensureSpace(cardH + 4);

    pdf.setFillColor(fill[0], fill[1], fill[2]);
    pdf.roundedRect(margin, y, contentWidth, cardH, 2, 2, "F");
    pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    pdf.roundedRect(margin, y, 2.5, cardH, 1, 1, "F");

    const name = result.display_parameter_name || result.parameter_name;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(name, margin + 6, y + 7);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.text(
      `${result.value} ${result.unit_symbol} · ${result.level_code} · ${t.confidence}: ${result.confidence}`,
      margin + 6,
      y + 13
    );

    if (adviceLines.length > 0) {
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(adviceLines, margin + 6, y + 19);
    }

    y += cardH + 3;
  }

  function drawCalculatorPack(pack: CalculatorOutputPack) {
    drawSectionTitle(pack.label);
    for (const result of pack.outputs) {
      ensureSpace(16);
      pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
      pdf.roundedRect(margin, y, contentWidth, 12, 1.5, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(result.label, margin + 3, y + 5);
      pdf.setFont("helvetica", "normal");
      pdf.text(
        `${result.value} ${result.unit}`,
        pageWidth - margin - 3,
        y + 5,
        { align: "right" }
      );
      y += 14;

      for (const alternative of result.alternatives || []) {
        drawParagraph(`= ${alternative.value} ${alternative.unit}`, 8);
      }
      for (const note of filterSafeNotes(result.notes, 2)) {
        drawParagraph(`• ${note}`, 8);
      }
    }
  }

  function drawFertilizerProductsTable(products: PdfFertilizerProduct[]) {
    if (products.length === 0) return;
    drawSectionTitle(
      t.exportSectionFertilizerProducts ||
        t.fertilizerProductsTitle ||
        "Fertilizer products & prices"
    );

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    drawParagraph(
      t.exportFertilizerPriceNote ||
        "Prices are supplier bags or online benchmarks when available.",
      8
    );
    y += 1;

    const cols = [
      { key: "product", label: t.exportFertilizerColProduct || "Product", w: 48 },
      { key: "grade", label: t.exportFertilizerColGrade || "Grade", w: 22 },
      { key: "rate", label: t.exportFertilizerColRate || "Rate", w: 28 },
      { key: "price", label: t.exportFertilizerColPrice || "Price", w: 32 },
      { key: "cost", label: t.exportFertilizerColCost || "Cost/ha", w: 28 },
    ] as const;
    const tableW = cols.reduce((sum, col) => sum + col.w, 0);
    const scale = contentWidth / tableW;

    function drawHeader() {
      ensureSpace(10);
      pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.roundedRect(margin, y, contentWidth, 8, 1, 1, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(255, 255, 255);
      let x = margin;
      for (const col of cols) {
        pdf.text(col.label, x + 2, y + 5.2);
        x += col.w * scale;
      }
      y += 9;
    }

    drawHeader();

    products.forEach((product, index) => {
      ensureSpace(11);
      if (index % 2 === 0) {
        pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
        pdf.rect(margin, y - 1, contentWidth, 10, "F");
      }
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
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
            : "—";
      const cost = money(product.costPerHa, product.currency);
      const cells = [
        product.name,
        product.analysis,
        rate,
        price,
        cost,
      ];
      let x = margin;
      cells.forEach((cell, i) => {
        const w = cols[i].w * scale;
        const lines = pdf.splitTextToSize(cell, w - 3);
        pdf.text(lines[0], x + 2, y + 5);
        x += w;
      });
      y += 10;
    });

    const totalCost = products.reduce(
      (sum, product) => sum + (product.costPerHa || 0),
      0
    );
    if (totalCost > 0) {
      y += 1;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9);
      pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.text(
        `${t.exportFertilizerTotalCost || "Estimated total"}: ${money(
          totalCost,
          products[0]?.currency || "USD"
        )}/ha`,
        margin,
        y
      );
      y += 7;
    }
  }

  function drawRecommendations(list: string[]) {
    if (list.length === 0) return;
    drawSectionTitle(
      t.exportSectionRecommendations || "Recommendations"
    );
    list.forEach((line, index) => {
      ensureSpace(10);
      pdf.setFillColor(index % 2 === 0 ? CARD[0] : 255, index % 2 === 0 ? CARD[1] : 255, index % 2 === 0 ? CARD[2] : 255);
      const wrap = pdf.splitTextToSize(`${index + 1}. ${line}`, contentWidth - 6);
      const h = Math.max(8, wrap.length * 4.2 + 3);
      pdf.roundedRect(margin, y, contentWidth, h, 1.2, 1.2, "F");
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(wrap, margin + 3, y + 5);
      y += h + 2;
    });
  }

  drawCover();

  if (isGeneralCrop) {
    drawSectionTitle(t.generalReferenceModeTitle);
    drawParagraph(t.generalCropWarning);
    // Only Olsen/Mehlich carry Tabla N.° 1 notes (set by the app); crop-specific does not.
    if (reportMeta?.extractionNote) {
      drawParagraph(reportMeta.extractionNote, 9);
    }
  } else if (reportMeta?.extractionNote) {
    drawSectionTitle(t.extractionMethodLabel || "Sufficiency / extraction");
    drawParagraph(reportMeta.extractionNote, 9);
  }

  if (exportSections.includeSoilStatus) {
    drawSoilStatusDashboard();
  }

  if (exportSections.includeTexture && textureSummary) {
    drawSectionTitle(t.exportSectionTexture || t.soilTexture);
    drawParagraph(`${t.textureClass}: ${textureSummary.className}`, 11, true);
    drawParagraph(
      `${t.sand}: ${textureSummary.sand}% · ${t.silt}: ${textureSummary.silt}% · ${t.clay}: ${textureSummary.clay}%`
    );
    drawParagraph(textureSummary.explanation);
  }

  if (
    exportSections.includeFertilizerPlan &&
    fertilizerProducts.length > 0
  ) {
    drawFertilizerProductsTable(fertilizerProducts);
  }

  for (const pack of visiblePacks) {
    drawCalculatorPack(pack);
  }

  if (exportSections.includeInterpretation) {
    const interpretationSections: {
      key: keyof GroupedPdfResults;
      title: string;
      desc: string;
    }[] = [
      { key: "negative", title: t.needsAttention, desc: t.needsAttentionDesc },
      { key: "warning", title: t.warning, desc: t.warningDesc },
      { key: "normal", title: t.normal, desc: t.normalDesc },
      { key: "positive", title: t.positive, desc: t.positiveDesc },
      { key: "neutral", title: t.neutral, desc: t.neutralDesc },
      { key: "other", title: t.other, desc: t.otherDesc },
    ];

    for (const section of interpretationSections) {
      const items = groupedResults[section.key];
      if (items.length === 0) continue;

      drawSectionTitle(`${section.title} (${items.length})`);
      drawParagraph(section.desc, 9);
      y += 2;

      for (const item of items) {
        drawResultCard(item, section.key);
      }
    }
  }

  if (exportSections.includeMissingValues && missingResults.length > 0) {
    drawSectionTitle(t.noRangeFound);
    drawParagraph(t.noRangeFoundDesc, 9);
    for (const item of missingResults) {
      drawParagraph(
        `• ${item.display_name || item.parameter_name}: ${item.value}`,
        9
      );
    }
  }

  if (exportSections.includeLabValues && results.length > 0) {
    drawSectionTitle(t.exportSectionLabValues || t.values);
    for (const result of results) {
      drawParagraph(
        `${result.display_parameter_name || result.parameter_name}: ${result.value} ${result.unit_symbol}`,
        9
      );
    }
  }

  if (exportSections.includeRecommendations) {
    drawRecommendations(recommendationLines);
  }

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

