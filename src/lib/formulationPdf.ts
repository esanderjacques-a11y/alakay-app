import { saveBlobWithPicker } from "@/lib/fileSave";
import type { FormulationLine, FormulationResult } from "@/lib/fertilizerFormulation";
import { pdfSafe } from "@/lib/pdfText";
import {
  PDF_BRAND,
  PDF_CARD,
  PDF_INK,
  PDF_LINE,
  PDF_MUTED,
  buildPdfContactMetaLines,
  drawPdfReportHeader,
  fetchPdfAppLogo,
  paintPdfPageWhite,
  pdfBrandName,
} from "@/lib/pdfReportHeader";

export type FormulationPdfLabels = {
  title: string;
  subtitle: string;
  grade: string;
  target: string;
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
  const logoData = await fetchPdfAppLogo();
  const L = input.labels;
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  const BRAND = PDF_BRAND;
  const BRAND_DARK: [number, number, number] = [4, 120, 87];
  const INK = PDF_INK;
  const MUTED = PDF_MUTED;
  const LINE = PDF_LINE;
  const CARD = PDF_CARD;
  const HEAD_BG: [number, number, number] = [248, 250, 252];
  const WHITE: [number, number, number] = [255, 255, 255];

  paintPdfPageWhite(pdf, pageWidth, pageHeight);

  function drawFooter() {
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(
      pdfSafe(`${pdfBrandName(L.appName)} · ${L.subtitle}`),
      margin,
      pageHeight - 7
    );
    pdf.text(String(pageNumber), pageWidth - margin, pageHeight - 7, {
      align: "right",
    });
  }

  function newPage() {
    drawFooter();
    pdf.addPage();
    paintPdfPageWhite(pdf, pageWidth, pageHeight);
    pageNumber += 1;
    y = margin;
  }

  function ensureSpace(height: number) {
    if (y + height > pageHeight - 18) newPage();
  }

  function spaceAfter(mm = 4) {
    y += mm;
  }

  function drawSectionTitle(text: string, trailing?: string) {
    ensureSpace(16);
    spaceAfter(2);
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, 2.4, 7, 0.6, 0.6, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    const title = pdfSafe(text);
    pdf.text(title, margin + 5.5, y + 5.2);
    if (trailing) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(10);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(pdfSafe(trailing), pageWidth - margin, y + 5.2, {
        align: "right",
      });
    }
    y += 12;
    pdf.setTextColor(INK[0], INK[1], INK[2]);
  }

  const rawGrade = (input.result.gradeLabel || "").trim();
  const npk = gradeNpk(input.result);
  const gradeDisplay =
    rawGrade.replace(/^(grade|grado|formule|formula)\s+/i, "").trim() || npk;

  // Header: brand + subtitle + contacts only (no tech meta / no repeated grade).
  y = drawPdfReportHeader({
    pdf,
    pageWidth,
    margin,
    contentWidth,
    appName: L.appName,
    subtitle: L.subtitle,
    meta: [],
    contactMeta: buildPdfContactMetaLines({}),
    includeLogo: true,
    logoData,
    startY: 14,
  });

  // —— Document title (body) ——
  ensureSpace(12);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.text(pdfSafe(L.title), margin, y + 4);
  y += 10;
  spaceAfter(2);

  // —— Grade hero (most important fact) ——
  ensureSpace(28);
  pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  pdf.setDrawColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.setLineWidth(0.5);
  pdf.roundedRect(margin, y, contentWidth, 24, 2, 2, "FD");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
  pdf.text(pdfSafe(L.grade.toUpperCase()), margin + 5, y + 7);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  pdf.text(pdfSafe(gradeDisplay), margin + 5, y + 17);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  if (gradeDisplay !== npk) {
    pdf.text(pdfSafe(`${L.target}: ${npk}`), pageWidth - margin - 5, y + 17, {
      align: "right",
    });
  }
  y += 28;
  spaceAfter(2);

  // —— Composition highlight (once) ——
  const batchMass = input.result.batchMassKg;
  const fillerMass = input.result.fillerMassKg || 0;
  const activeMass = input.result.productMassKg || 0;
  const hasFiller = fillerMass > 0.05 || input.lines.some((line) => line.isFiller);

  if (hasFiller && batchMass > 0) {
    const activePct = (activeMass / batchMass) * 100;
    const fillerPct = (fillerMass / batchMass) * 100;
    drawSectionTitle(L.composition);
    const gap = 3;
    const cardW = (contentWidth - gap) / 2;
    const cardH = 22;
    ensureSpace(cardH + 4);
    const top = y;

    // Active
    pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
    pdf.roundedRect(margin, top, cardW, cardH, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    pdf.text(L.activeShare.toUpperCase(), margin + 4, top + 7);
    pdf.setFontSize(14);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(`${activePct.toFixed(1)}%`, margin + 4, top + 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(
      `${activeMass.toFixed(2)} ${input.massUnit}`,
      margin + cardW - 4,
      top + 16,
      { align: "right" }
    );

    // Filler
    pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
    pdf.roundedRect(margin + cardW + gap, top, cardW, cardH, 2, 2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(L.fillerShare.toUpperCase(), margin + cardW + gap + 4, top + 7);
    pdf.setFontSize(14);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(`${fillerPct.toFixed(1)}%`, margin + cardW + gap + 4, top + 16);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(
      `${fillerMass.toFixed(2)} ${input.massUnit}`,
      margin + cardW + gap + cardW - 4,
      top + 16,
      { align: "right" }
    );

    y = top + cardH + 6;
  }

  // —— Recipe table ——
  drawSectionTitle(L.recipe);

  const withPrices = input.includePrices;
  const cols = withPrices
    ? [
        { key: "product", label: L.product, w: 48 },
        { key: "analysis", label: L.analysis, w: 34 },
        { key: "pct", label: L.percent, w: 18 },
        { key: "mass", label: L.mass, w: 28 },
        { key: "price", label: L.bagPrice, w: 28 },
        { key: "cost", label: L.lineCost, w: 26 },
      ]
    : [
        { key: "product", label: L.product, w: 62 },
        { key: "analysis", label: L.analysis, w: 48 },
        { key: "pct", label: L.percent, w: 22 },
        { key: "mass", label: L.mass, w: 36 },
      ];
  const tableW = cols.reduce((sum, col) => sum + col.w, 0);
  const scale = contentWidth / tableW;
  const currency = input.currency || "USD";
  const lineH = 4.2;

  function colX(index: number) {
    let x = margin;
    for (let i = 0; i < index; i++) x += cols[i].w * scale;
    return x;
  }

  function drawTableHeader() {
    const headerH = 10;
    ensureSpace(headerH + 2);
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, contentWidth, headerH, 1.2, 1.2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    cols.forEach((col, i) => {
      const x = colX(i);
      const w = col.w * scale;
      const alignRight = col.key === "pct" || col.key === "mass" || col.key === "price" || col.key === "cost";
      const label = pdf.splitTextToSize(pdfSafe(col.label), w - 4)[0];
      if (alignRight) {
        pdf.text(label, x + w - 2, y + 6.5, { align: "right" });
      } else {
        pdf.text(label, x + 2.5, y + 6.5);
      }
    });
    y += headerH + 1;
  }

  drawTableHeader();

  for (let index = 0; index < input.lines.length; index++) {
    const line = input.lines[index];
    const name = line.isFiller
      ? `${line.label} (${L.fillerTag})`
      : line.label;

    const cellTexts = cols.map((col) => {
      switch (col.key) {
        case "product":
          return name;
        case "analysis":
          return line.analysis || "—";
        case "pct":
          return `${line.percent.toFixed(1)}%`;
        case "mass":
          return `${line.displayMass.toFixed(2)} ${input.massUnit}`;
        case "price":
          return line.bagPrice != null && line.bagPrice > 0
            ? formatMoney(line.bagPrice, currency)
            : "—";
        case "cost":
          return line.lineCost != null && line.lineCost > 0
            ? formatMoney(line.lineCost, currency)
            : "—";
        default:
          return "";
      }
    });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    const wrapped = cellTexts.map((text, i) =>
      pdf.splitTextToSize(pdfSafe(text), cols[i].w * scale - 4)
    );
    const rowLines = Math.max(...wrapped.map((lines) => lines.length), 1);
    const rowH = Math.max(9, rowLines * lineH + 4);
    ensureSpace(rowH + 1);
    if (y === margin) drawTableHeader();

    if (index % 2 === 0) {
      pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
      pdf.rect(margin, y, contentWidth, rowH, "F");
    }

    cols.forEach((col, i) => {
      const x = colX(i);
      const w = col.w * scale;
      const alignRight =
        col.key === "pct" || col.key === "mass" || col.key === "price" || col.key === "cost";
      const isProduct = col.key === "product";
      pdf.setFont("helvetica", isProduct ? "bold" : "normal");
      pdf.setFontSize(isProduct ? 9 : 8.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      if (alignRight) {
        pdf.text(wrapped[i], x + w - 2, y + 5.5, { align: "right" });
      } else {
        pdf.text(wrapped[i], x + 2.5, y + 5.5);
      }
    });
    y += rowH;
  }

  // Total row
  const totalMass = input.lines.reduce((sum, line) => sum + line.displayMass, 0);
  ensureSpace(12);
  spaceAfter(1);
  pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  pdf.roundedRect(margin, y, contentWidth, 10, 1.2, 1.2, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(10);
  pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
  pdf.text(L.total, margin + 3, y + 6.5);
  pdf.text(`${totalMass.toFixed(2)} ${input.massUnit}`, pageWidth - margin - 3, y + 6.5, {
    align: "right",
  });
  y += 14;

  if (withPrices && input.result.estimatedCost != null) {
    ensureSpace(12);
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, contentWidth, 11, 1.5, 1.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
    pdf.text(L.estimatedCost, margin + 4, y + 7);
    pdf.text(formatMoney(input.result.estimatedCost, currency), pageWidth - margin - 4, y + 7, {
      align: "right",
    });
    y += 15;
  }

  // —— Production batch ——
  if (input.production && input.production.lines.length > 0) {
    const targetBatch = `${input.production.totalMass.toFixed(2)} ${input.production.unit}`;
    drawSectionTitle(L.productionBatch, targetBatch);
    spaceAfter(1);

    for (let index = 0; index < input.production.lines.length; index++) {
      const line = input.production.lines[index];
      const label = line.isFiller
        ? `${line.label} (${L.fillerTag})`
        : line.label;
      const share =
        input.production.totalMass > 0
          ? `${((line.mass / input.production.totalMass) * 100).toFixed(1)}%`
          : "";
      const mass = `${line.mass.toFixed(2)} ${input.production.unit}`;

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      const massW = pdf.getTextWidth(mass) + 4;
      const nameLines = pdf.splitTextToSize(
        pdfSafe(label),
        contentWidth - massW - 28
      );
      const rowH = Math.max(10, nameLines.length * 4.2 + 4);
      ensureSpace(rowH + 1);

      if (index % 2 === 0) {
        pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
        pdf.rect(margin, y, contentWidth, rowH, "F");
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(nameLines, margin + 3, y + 5.5);

      if (share) {
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(8.5);
        pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
        pdf.text(share, pageWidth - margin - massW - 4, y + 5.5, {
          align: "right",
        });
      }

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(mass, pageWidth - margin - 3, y + 5.5, { align: "right" });
      y += rowH;
    }

    ensureSpace(12);
    spaceAfter(2);
    pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
    pdf.roundedRect(margin, y, contentWidth, 10, 1.2, 1.2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.setTextColor(BRAND_DARK[0], BRAND_DARK[1], BRAND_DARK[2]);
    pdf.text(L.total, margin + 3, y + 6.5);
    pdf.text(
      `${input.production.totalMass.toFixed(2)} ${input.production.unit}`,
      pageWidth - margin - 3,
      y + 6.5,
      { align: "right" }
    );
    y += 14;

    if (
      withPrices &&
      input.production.estimatedCost != null &&
      input.production.estimatedCost > 0
    ) {
      ensureSpace(12);
      pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
      pdf.roundedRect(margin, y, contentWidth, 11, 1.5, 1.5, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(WHITE[0], WHITE[1], WHITE[2]);
      pdf.text(L.estimatedCost, margin + 4, y + 7);
      pdf.text(
        formatMoney(input.production.estimatedCost, currency),
        pageWidth - margin - 4,
        y + 7,
        { align: "right" }
      );
      y += 12;
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
  const pdfBlob = pdf.output("blob");
  await saveBlobWithPicker(
    pdfBlob,
    fileName,
    "application/pdf",
    ".pdf",
    () => pdf.save(fileName)
  );
}
