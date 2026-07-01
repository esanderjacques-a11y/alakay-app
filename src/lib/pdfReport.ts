import type { Translation } from "@/lib/translations";
import { formatMessage } from "@/lib/translations";
import { saveBlobWithPicker } from "@/lib/fileSave";
import { calculateSoilTexture } from "@/lib/soilTexture";
import type { CalculationOutput } from "@/lib/agronomicCalculators";

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
};

export type PdfReportOptions = {
  includeLogo?: boolean;
  includeSummary?: boolean;
  includeCharts?: boolean;
  includeOriginalLabValues?: boolean;
  includeCalculationValues?: boolean;
};

export type PdfReportSectionOptions = {
  includeLogo: boolean;
  includeSummary: boolean;
  includeInterpretation: boolean;
  includeMissingValues: boolean;
  includeTexture: boolean;
  includeCalculations: boolean;
  includeLabValues: boolean;
  includeDop: boolean;
  includeRatios: boolean;
};

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

export async function exportAnalysisPdf(options: {
  t: Translation;
  results: PdfResult[];
  groupedResults: GroupedPdfResults;
  missingResults: { display_name: string; parameter_name: string; value: number }[];
  textureSummary: TextureSummary | null;
  calculationValues?: CalculationOutput[];
  isGeneralCrop: boolean;
  locale: string;
  reportMeta?: PdfReportMeta;
  reportOptions?: PdfReportOptions;
  fileName?: string;
}) {
  const { jsPDF } = await import("jspdf");
  const {
    t,
    results,
    groupedResults,
    missingResults,
    textureSummary,
    calculationValues = [],
    isGeneralCrop,
    locale,
    reportMeta,
    reportOptions,
    fileName = "cultosol-analysis-report.pdf",
  } = options;

  const exportOptions: Required<PdfReportOptions> = {
    includeLogo: reportOptions?.includeLogo ?? true,
    includeSummary: reportOptions?.includeSummary ?? true,
    includeCharts: reportOptions?.includeCharts ?? true,
    includeOriginalLabValues: reportOptions?.includeOriginalLabValues ?? true,
    includeCalculationValues: reportOptions?.includeCalculationValues ?? true,
  };

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  function drawFooter() {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(120, 120, 120);
    pdf.text(
      `${t.appName} · ${t.reportSubtitle}`,
      margin,
      pageHeight - 8
    );
    pdf.text(`${pageNumber}`, pageWidth - margin, pageHeight - 8, {
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
    if (y + height > pageHeight - 22) {
      newPage();
    }
  }

  const logoData = await fetchLogo().catch(() => null);

  function drawHeaderBand() {
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, 46, "F");
    pdf.setDrawColor(220, 235, 225);
    pdf.setLineWidth(0.4);
    pdf.line(0, 46, pageWidth, 46);

    if (logoData && exportOptions.includeLogo) {
      pdf.addImage(logoData, "PNG", margin, 8, 20, 20);
    }

    const titleX = logoData && exportOptions.includeLogo ? margin + 26 : margin;
    pdf.setTextColor(22, 101, 52);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(t.appName, titleX, 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(71, 85, 105);
    pdf.text(t.reportSubtitle, titleX, 23);
    pdf.text(
      `${t.generatedOn} ${new Date().toLocaleDateString(locale)}`,
      titleX,
      29
    );

    if (reportMeta?.details?.length) {
      const headerDetails = reportMeta.details.slice(0, 4).join("  |  ");
      const detailLines = pdf.splitTextToSize(headerDetails, contentWidth - 6);
      pdf.setFontSize(8);
      pdf.setTextColor(71, 85, 105);
      pdf.text(detailLines.slice(0, 2), margin, 38);
    }

    y = 54;
    pdf.setTextColor(30, 41, 59);
  }

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

  function drawSummaryCards() {
    ensureSpace(32);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(13);
    pdf.setTextColor(22, 101, 52);
    pdf.text(t.analysisSummary, margin, y);
    y += 8;

    const cards = [
      { label: t.needsAttention, count: groupedResults.negative.length, tone: "negative" },
      { label: t.warning, count: groupedResults.warning.length, tone: "warning" },
      { label: t.normal, count: groupedResults.normal.length, tone: "normal" },
      { label: t.positive, count: groupedResults.positive.length, tone: "positive" },
    ];

    const cardW = (contentWidth - 9) / 4;
    cards.forEach((card, index) => {
      const x = margin + index * (cardW + 3);
      const rgb = GROUP_COLORS[card.tone] || GROUP_COLORS.other;
      pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
      pdf.roundedRect(x, y, cardW, 18, 2, 2, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(14);
      pdf.text(String(card.count), x + cardW / 2, y + 9, { align: "center" });
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      const lines = pdf.splitTextToSize(card.label, cardW - 4);
      pdf.text(lines, x + cardW / 2, y + 14, { align: "center" });
    });

    y += 24;
    pdf.setTextColor(30, 41, 59);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.text(
      formatMessage(t.interpretedValuesCount, { count: results.length }),
      margin,
      y
    );
    y += 8;
  }

  function drawParagraph(text: string, size = 10, bold = false) {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(size);
    const lines = pdf.splitTextToSize(text, contentWidth);
    for (const line of lines) {
      ensureSpace(6);
      pdf.text(line, margin, y);
      y += size * 0.45 + 2;
    }
  }

  function drawSectionTitle(title: string) {
    ensureSpace(14);
    y += 4;
    pdf.setDrawColor(220, 230, 220);
    pdf.setLineWidth(0.4);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 7;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(22, 101, 52);
    pdf.text(title, margin, y);
    y += 7;
    pdf.setTextColor(30, 41, 59);
  }

  function drawResultCard(result: PdfResult, tone: string) {
    const rgb = GROUP_COLORS[tone] || GROUP_COLORS.other;
    const fill = GROUP_FILLS[tone] || GROUP_FILLS.other;
    ensureSpace(42);

    pdf.setFillColor(fill[0], fill[1], fill[2]);
    pdf.roundedRect(margin, y, contentWidth, 34, 2, 2, "F");
    pdf.setFillColor(rgb[0], rgb[1], rgb[2]);
    pdf.roundedRect(margin, y, 3, 34, 1, 1, "F");

    const name =
      result.display_parameter_name || result.parameter_name;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text(name, margin + 6, y + 8);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.text(
      `${result.value} ${result.unit_symbol} · ${t.rangeLabel}: ${result.min ?? "—"} – ${result.max ?? "—"}`,
      margin + 6,
      y + 15
    );
    pdf.text(
      `${result.level_code.toUpperCase()} · ${t.confidence}: ${result.confidence}`,
      margin + 6,
      y + 21
    );

    const adviceLines = pdf.splitTextToSize(result.advice, contentWidth - 12);
    pdf.text(adviceLines.slice(0, 2), margin + 6, y + 27);

    y += 39;
  }

  await drawHeaderBand();

  if (reportMeta?.title) {
    drawParagraph(reportMeta.title, 14, true);
  }

  const overflowDetails = reportMeta?.details?.slice(4) || [];
  if (overflowDetails.length > 0) {
    for (const line of overflowDetails) {
      drawParagraph(line, 10);
    }
    y += 4;
  }

  if (exportOptions.includeSummary) {
    drawSummaryCards();
  }

  if (isGeneralCrop) {
    drawSectionTitle(t.generalReferenceModeTitle);
    drawParagraph(t.generalCropWarning);
  }

  if (textureSummary) {
    drawSectionTitle(t.soilTexture);
    drawParagraph(
      `${t.textureClass}: ${textureSummary.className}`,
      11,
      true
    );
    drawParagraph(
      `${t.sand}: ${textureSummary.sand}% · ${t.silt}: ${textureSummary.silt}% · ${t.clay}: ${textureSummary.clay}%`
    );
    drawParagraph(textureSummary.explanation);
  }

  if (exportOptions.includeCharts && results.length > 0) {
    drawSectionTitle(t.resultGraphs);
    drawParagraph(t.resultGraphsDesc, 9);
    for (const result of results.slice(0, 18)) {
      drawPdfGraphRow(result);
    }
  }

  const sections: { key: keyof GroupedPdfResults; title: string; desc: string }[] = [
    { key: "negative", title: t.needsAttention, desc: t.needsAttentionDesc },
    { key: "warning", title: t.warning, desc: t.warningDesc },
    { key: "normal", title: t.normal, desc: t.normalDesc },
    { key: "positive", title: t.positive, desc: t.positiveDesc },
    { key: "neutral", title: t.neutral, desc: t.neutralDesc },
    { key: "other", title: t.other, desc: t.otherDesc },
  ];

  for (const section of sections) {
    const items = groupedResults[section.key];
    if (items.length === 0) continue;

    drawSectionTitle(`${section.title} (${items.length})`);
    drawParagraph(section.desc, 9);
    y += 2;

    for (const item of items) {
      drawResultCard(item, section.key);
    }
  }

  if (missingResults.length > 0) {
    drawSectionTitle(t.noRangeFound);
    drawParagraph(t.noRangeFoundDesc, 9);
    for (const item of missingResults) {
      drawParagraph(
        `• ${item.display_name || item.parameter_name}: ${item.value}`,
        9
      );
    }
  }

  if (exportOptions.includeCalculationValues && calculationValues.length > 0) {
    drawSectionTitle(t.calculators);
    for (const result of calculationValues) {
      drawParagraph(`${result.label}: ${result.value} ${result.unit}`, 9, true);
      for (const alternative of result.alternatives || []) {
        drawParagraph(`= ${alternative.value} ${alternative.unit}`, 9);
      }
      drawParagraph(`Formula: ${result.formula}`, 8);
      for (const note of result.notes) {
        drawParagraph(`• ${note}`, 8);
      }
      y += 2;
    }
  }

  if (exportOptions.includeOriginalLabValues && results.length > 0) {
    drawSectionTitle(t.values);
    for (const result of results) {
      drawParagraph(
        `${result.display_parameter_name || result.parameter_name}: ${result.value} ${result.unit_symbol}`,
        9
      );
    }
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

  function drawPdfGraphRow(result: PdfResult) {
    const value = Number(result.value);
    if (!Number.isFinite(value)) return;

    const min = Number(result.min);
    const max = Number(result.max);
    const hasRange = Number.isFinite(min) && Number.isFinite(max) && max > min;
    const axisMin = hasRange ? Math.min(0, min, value) : Math.min(0, value);
    const axisMax = hasRange ? Math.max(max, value) : Math.max(value, 1);
    const span = axisMax - axisMin || 1;
    const graphX = margin + 58;
    const graphW = contentWidth - 64;
    const rowHeight = 12;
    const valueX = graphX + ((value - axisMin) / span) * graphW;

    ensureSpace(rowHeight + 2);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(30, 41, 59);
    pdf.text(
      pdf.splitTextToSize(
        result.display_parameter_name || result.parameter_name,
        52
      )[0],
      margin,
      y + 5
    );

    pdf.setFillColor(241, 245, 249);
    pdf.roundedRect(graphX, y, graphW, 5, 1, 1, "F");

    if (hasRange) {
      const rangeX = graphX + ((min - axisMin) / span) * graphW;
      const rangeW = Math.max(2, ((max - min) / span) * graphW);
      pdf.setFillColor(187, 247, 208);
      pdf.roundedRect(rangeX, y, rangeW, 5, 1, 1, "F");
    }

    const tone = normalizeGroupCode(result.final_group_code);
    const color = GROUP_COLORS[tone] || GROUP_COLORS.other;
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.circle(Math.min(graphX + graphW, Math.max(graphX, valueX)), y + 2.5, 1.8, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(71, 85, 105);
    pdf.text(`${value} ${result.unit_symbol}`, graphX + graphW, y + 10, {
      align: "right",
    });
    y += rowHeight;
  }
}

