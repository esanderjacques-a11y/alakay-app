import { saveBlobWithPicker } from "@/lib/fileSave";
import type { FormulationLine, FormulationResult } from "@/lib/fertilizerFormulation";

export type FormulationPdfLabels = {
  title: string;
  subtitle: string;
  grade: string;
  target: string;
  finishMode: string;
  strategy: string;
  recipe: string;
  product: string;
  analysis: string;
  percent: string;
  mass: string;
  total: string;
  fillerTag: string;
  bagPrice: string;
  lineCost: string;
  estimatedCost: string;
  productionBatch: string;
  composition: string;
  activeShare: string;
  fillerShare: string;
  appName: string;
};

export type FormulationPdfLine = FormulationLine & {
  /** Display mass already converted to the recipe unit. */
  displayMass: number;
  /** Share of batch (0–100). */
  percent: number;
  /** Price per bag, when includePrices. */
  bagPrice?: number | null;
  /** Line cost for displayMass, when includePrices. */
  lineCost?: number | null;
};

export type FormulationPdfInput = {
  labels: FormulationPdfLabels;
  result: FormulationResult;
  lines: FormulationPdfLine[];
  /** Mass unit shown in the recipe (kg or lb). */
  massUnit: string;
  finishModeLabel: string;
  strategyLabel: string;
  includePrices: boolean;
  currency?: string;
  /** Optional scaled production batch. */
  production?: {
    lines: Array<{ label: string; mass: number; isFiller: boolean }>;
    totalMass: number;
    unit: string;
    estimatedCost?: number | null;
  };
  fileName?: string;
};

function formatMoney(value: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function gradeNpk(result: FormulationResult) {
  const g = result.targetGrade;
  return `${g.n || 0}-${g.p2o5 || 0}-${g.k2o || 0}`;
}

/**
 * Export a standalone fertilizer formulation recipe PDF.
 * Prices/costs are included only when `includePrices` is true.
 */
export async function exportFormulationPdf(
  input: FormulationPdfInput
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const L = input.labels;
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
  const LINE: [number, number, number] = [226, 232, 240];
  const HEAD_BG: [number, number, number] = [236, 253, 245];

  function drawFooter() {
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(`${L.appName} · ${L.subtitle}`, margin, pageHeight - 7);
    pdf.text(String(pageNumber), pageWidth - margin, pageHeight - 7, {
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
    if (y + height > pageHeight - 18) newPage();
  }

  function drawSectionTitle(text: string) {
    ensureSpace(12);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(text, margin, y);
    y += 6;
    pdf.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.setLineWidth(0.4);
    pdf.line(margin, y, margin + 28, y);
    y += 5;
  }

  function metaRow(label: string, value: string) {
    const labelColW = 42;
    const valueX = margin + labelColW;
    const valueW = contentWidth - labelColW;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    const labelLines = pdf.splitTextToSize(label, labelColW - 2);
    pdf.setFont("helvetica", "normal");
    const valueLines = pdf.splitTextToSize(value || "—", valueW);
    const lineCount = Math.max(labelLines.length, valueLines.length, 1);
    const rowH = Math.max(6, lineCount * 4.2);
    ensureSpace(rowH + 1);

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(labelLines, margin, y);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(valueLines, valueX, y);
    y += rowH;
  }

  // Header
  pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  pdf.rect(0, 0, pageWidth, 32, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.text(L.title, margin, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text(L.subtitle, margin, 21);
  y = 40;

  drawSectionTitle(L.grade);
  metaRow(L.grade, input.result.gradeLabel || "—");
  metaRow(L.target, gradeNpk(input.result));
  metaRow(L.finishMode, input.finishModeLabel);
  metaRow(L.strategy, input.strategyLabel);

  const batchMass = input.result.batchMassKg;
  const fillerMass = input.result.fillerMassKg || 0;
  const activeMass = input.result.productMassKg || 0;
  const hasFiller = fillerMass > 0.05 || input.lines.some((line) => line.isFiller);
  if (hasFiller && batchMass > 0) {
    const activePct = (activeMass / batchMass) * 100;
    const fillerPct = (fillerMass / batchMass) * 100;
    drawSectionTitle(L.composition);
    metaRow(
      L.activeShare,
      `${activePct.toFixed(1)}% · ${activeMass.toFixed(2)} ${input.massUnit}`
    );
    metaRow(
      L.fillerShare,
      `${fillerPct.toFixed(1)}% · ${fillerMass.toFixed(2)} ${input.massUnit}`
    );
  }

  drawSectionTitle(L.recipe);

  const withPrices = input.includePrices;
  const col = withPrices
    ? {
        product: margin,
        analysis: margin + 52,
        pct: margin + 88,
        mass: margin + 108,
        price: margin + 132,
        cost: margin + 158,
      }
    : {
        product: margin,
        analysis: margin + 70,
        pct: margin + 118,
        mass: margin + 148,
        price: 0,
        cost: 0,
      };

  ensureSpace(10);
  pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  pdf.rect(margin, y - 4, contentWidth, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text(L.product, col.product, y);
  pdf.text(L.analysis, col.analysis, y);
  pdf.text(L.percent, col.pct, y);
  pdf.text(L.mass, col.mass, y);
  if (withPrices) {
    pdf.text(L.bagPrice, col.price, y);
    pdf.text(L.lineCost, col.cost, y);
  }
  y += 6;

  const currency = input.currency || "USD";

  for (const line of input.lines) {
    const name = line.isFiller
      ? `${line.label} (${L.fillerTag})`
      : line.label;
    const nameLines = pdf.splitTextToSize(name, withPrices ? 50 : 66);
    const analysisLines = pdf.splitTextToSize(line.analysis || "—", withPrices ? 34 : 44);
    const rowHeight = Math.max(
      5.5,
      nameLines.length * 4,
      analysisLines.length * 4
    );
    ensureSpace(rowHeight + 2);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(nameLines, col.product, y);
    pdf.text(analysisLines, col.analysis, y);
    pdf.text(`${line.percent.toFixed(1)}%`, col.pct, y);
    pdf.text(`${line.displayMass.toFixed(2)} ${input.massUnit}`, col.mass, y);
    if (withPrices) {
      pdf.text(
        line.bagPrice != null && line.bagPrice > 0
          ? formatMoney(line.bagPrice, currency)
          : "—",
        col.price,
        y
      );
      pdf.text(
        line.lineCost != null && line.lineCost > 0
          ? formatMoney(line.lineCost, currency)
          : "—",
        col.cost,
        y
      );
    }
    y += rowHeight;
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 2;
  }

  ensureSpace(8);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  const totalMass = input.lines.reduce((sum, line) => sum + line.displayMass, 0);
  pdf.text(L.total, margin, y);
  pdf.text(`${totalMass.toFixed(2)} ${input.massUnit}`, margin + 40, y);
  y += 6;

  if (hasFiller && batchMass > 0) {
    const activePct = (activeMass / batchMass) * 100;
    const fillerPct = (fillerMass / batchMass) * 100;
    ensureSpace(16);
    pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
    pdf.roundedRect(margin, y - 3.5, contentWidth, 14, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(L.composition, margin + 3, y + 1.5);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(
      `${L.activeShare}: ${activePct.toFixed(1)}%  ·  ${L.fillerShare}: ${fillerPct.toFixed(1)}%`,
      margin + 3,
      y + 7.5
    );
    y += 14;
  }

  if (withPrices && input.result.estimatedCost != null) {
    ensureSpace(7);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(
      `${L.estimatedCost}: ${formatMoney(input.result.estimatedCost, currency)}`,
      margin,
      y
    );
    y += 8;
  }

  if (input.production && input.production.lines.length > 0) {
    drawSectionTitle(L.productionBatch);
    for (const line of input.production.lines) {
      ensureSpace(6);
      const label = line.isFiller
        ? `${line.label} (${L.fillerTag})`
        : line.label;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      const share =
        input.production.totalMass > 0
          ? ` · ${((line.mass / input.production.totalMass) * 100).toFixed(1)}%`
          : "";
      const mass = `${line.mass.toFixed(2)} ${input.production.unit}`;
      const massW = pdf.getTextWidth(mass) + 4;
      const labelLines = pdf.splitTextToSize(
        `${label}${share}`,
        contentWidth - massW
      );
      pdf.text(labelLines[0], margin, y);
      pdf.text(mass, pageWidth - margin, y, { align: "right" });
      y += 5.5;
    }
    ensureSpace(7);
    pdf.setFont("helvetica", "bold");
    pdf.text(L.total, margin, y);
    pdf.text(
      `${input.production.totalMass.toFixed(2)} ${input.production.unit}`,
      pageWidth - margin,
      y,
      { align: "right" }
    );
    y += 6;

    if (hasFiller && input.production.totalMass > 0) {
      const prodActive = input.production.lines
        .filter((line) => !line.isFiller)
        .reduce((sum, line) => sum + line.mass, 0);
      const prodFiller = input.production.lines
        .filter((line) => line.isFiller)
        .reduce((sum, line) => sum + line.mass, 0);
      const prodActivePct = (prodActive / input.production.totalMass) * 100;
      const prodFillerPct = (prodFiller / input.production.totalMass) * 100;
      ensureSpace(8);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.text(
        `${L.activeShare}: ${prodActivePct.toFixed(1)}%  ·  ${L.fillerShare}: ${prodFillerPct.toFixed(1)}%`,
        margin,
        y
      );
      y += 6;
    }

    if (
      withPrices &&
      input.production.estimatedCost != null &&
      input.production.estimatedCost > 0
    ) {
      ensureSpace(7);
      pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.text(
        `${L.estimatedCost}: ${formatMoney(
          input.production.estimatedCost,
          currency
        )}`,
        margin,
        y
      );
    }
  }

  drawFooter();

  const gradeSlug = (input.result.gradeLabel || "mix")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const fileName =
    input.fileName || `cultosol-formulation-${gradeSlug || "recipe"}.pdf`;
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
