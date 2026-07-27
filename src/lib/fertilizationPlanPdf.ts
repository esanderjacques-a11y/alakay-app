import type { Translation } from "@/lib/translations";
import { saveBlobWithPicker } from "@/lib/fileSave";
import { parseLotNames } from "@/lib/farmLots";
import type { CalendarEvent } from "@/lib/planningTypes";
import { resolveScheduleCycleMode } from "@/lib/fertilizationSchedule";
import type { Language } from "@/lib/i18n";
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
  type PdfHeaderMetaLine,
} from "@/lib/pdfReportHeader";

export type FertilizationPlanPdfRow = {
  date: string;
  quantity: string;
  fertilizer: string;
  method: string;
  stageLabel?: string;
};

type PlanApplicationBlock = {
  date: string;
  stageLabel: string;
  timingHint?: string;
  lines: Array<{
    fertilizer: string;
    quantity: string;
    method: string;
  }>;
};

export type FertilizationPlanPdfInput = {
  t: Translation;
  farmName: string;
  lotName?: string;
  cropName?: string | null;
  responsible?: string;
  seasonStart?: string;
  seasonEnd?: string;
  purposeLabel?: string;
  events: CalendarEvent[];
  locale?: string;
  fileName?: string;
};

/** Format one lot, "A – B", or "A – Z (N lots)". */
export function formatLotsLabel(
  lotName: string | undefined,
  labels: { lotsCount: string }
): string {
  const lots = parseLotNames(lotName || "");
  if (lots.length === 0) return "—";
  if (lots.length === 1) return lots[0];
  if (lots.length === 2) return `${lots[0]} – ${lots[1]}`;
  return `${lots[0]} – ${lots[lots.length - 1]} (${labels.lotsCount.replace(
    "{count}",
    String(lots.length)
  )})`;
}

function normalizeUnit(unitHa?: string) {
  const unit = String(unitHa || "kg/ha").trim();
  // Avoid duplicated nutrient symbols inside units (e.g. "kg N/ha").
  return unit.replace(/\s+[NPKCaMgnpkcamg]+[2oO5]*\s*\/\s*ha$/i, "/ha") || "kg/ha";
}

/** Flat rows kept for analysis-report calendar section compatibility. */
export function eventsToPlanRows(events: CalendarEvent[]): FertilizationPlanPdfRow[] {
  return eventsToPlanBlocks(events).flatMap((block) =>
    block.lines.map((line) => ({
      date: block.date,
      quantity: line.quantity,
      fertilizer: line.fertilizer,
      method: line.method,
      stageLabel: block.stageLabel,
    }))
  );
}

function eventsToPlanBlocks(events: CalendarEvent[]): PlanApplicationBlock[] {
  const sorted = [...events].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return (a.sequence || 0) - (b.sequence || 0);
  });

  return sorted.map((event) => {
    const stageLabel = event.stageLabel || event.title;
    const timingHint = event.method?.trim() || undefined;
    if (event.lines && event.lines.length > 0) {
      return {
        date: event.date,
        stageLabel,
        timingHint,
        lines: event.lines.map((line) => ({
          fertilizer: line.nutrient,
          quantity: `${line.kgHa} ${normalizeUnit(line.unitHa)}${
            line.percentOfTotal != null ? ` (${line.percentOfTotal}%)` : ""
          }`,
          // Prefer short application method; keep timing hint on the stage band.
          method: line.method || "—",
        })),
      };
    }
    return {
      date: event.date,
      stageLabel,
      timingHint,
      lines: [
        {
          fertilizer: event.nutrient || event.title,
          quantity: event.rate || "—",
          method: "—",
        },
      ],
    };
  });
}

function buildRecommendations(
  t: Translation["planning"],
  events: CalendarEvent[],
  cycleMode: ReturnType<typeof resolveScheduleCycleMode>
): string[] {
  const lines = [
    t.pdfRecClimate,
    t.pdfRecSoilMoisture,
    t.pdfRecWind,
    t.pdfRecTimeOfDay,
    t.pdfRecSafety,
    t.pdfRecRecord,
  ];

  const stages = new Set(
    events.map((e) => e.stageKey).filter(Boolean) as string[]
  );
  if (stages.has("amendment")) {
    lines.push(
      cycleMode === "perennial" ? t.pdfRecAmendmentPerennial : t.pdfRecAmendment
    );
  }
  if (stages.has("basal")) {
    lines.push(cycleMode === "perennial" ? t.pdfRecFlush : t.pdfRecBasal);
  }
  if (stages.has("vegetative") || stages.has("reproductive")) {
    lines.push(
      cycleMode === "perennial" || cycleMode === "fruiting"
        ? t.pdfRecFruiting
        : t.pdfRecTopdress
    );
  }
  if (
    events.some((e) =>
      e.lines?.some((l) => /n\b|nitrogen|nitr/i.test(l.nutrient))
    )
  ) {
    lines.push(t.pdfRecNitrogen);
  }
  return lines;
}

export async function exportFertilizationPlanPdf(
  input: FertilizationPlanPdfInput
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const logoData = await fetchPdfAppLogo();
  const p = input.t.planning;
  const t = input.t;
  const blocks = eventsToPlanBlocks(input.events);
  if (blocks.length === 0) {
    throw new Error(p.pdfNoEvents);
  }
  const cycleMode = resolveScheduleCycleMode(
    input.cropName,
    (input.locale as Language) || "en"
  );

  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;
  let pageNumber = 1;

  const BRAND = PDF_BRAND;
  const INK = PDF_INK;
  const MUTED = PDF_MUTED;
  const LINE = PDF_LINE;
  const CARD = PDF_CARD;

  paintPdfPageWhite(pdf, pageWidth, pageHeight);

  function drawFooter() {
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.3);
    pdf.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(
      pdfSafe(`${pdfBrandName(t.appName)} · ${p.pdfSubtitle}`),
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

  function drawSectionTitle(text: string) {
    ensureSpace(14);
    y += 2;
    pdf.setFillColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.roundedRect(margin, y, 2.2, 6, 0.5, 0.5, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(11);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(pdfSafe(text), margin + 5, y + 4.5);
    y += 10;
    pdf.setTextColor(INK[0], INK[1], INK[2]);
  }

  const meta: PdfHeaderMetaLine[] = [
    { label: p.pdfFarm, value: input.farmName || "—" },
    {
      label: p.pdfLots,
      value: formatLotsLabel(input.lotName, { lotsCount: p.pdfLotsCount }),
    },
    { label: p.pdfCrop, value: input.cropName || "—" },
    { label: p.pdfResponsible, value: input.responsible?.trim() || "—" },
  ];
  if (input.seasonStart) {
    meta.push({
      label: cycleMode === "perennial" ? p.pdfCycleStart : p.pdfSeasonStart,
      value: input.seasonStart,
    });
  }
  if (input.seasonEnd) {
    meta.push({
      label: p.pdfSeasonEnd,
      value: input.seasonEnd,
    });
  }
  if (input.purposeLabel) {
    meta.push({
      label: p.pdfPurpose,
      value: input.purposeLabel,
    });
  }
  meta.push({
    label: p.pdfGenerated,
    value: new Date().toLocaleDateString(input.locale || undefined),
  });

  y = drawPdfReportHeader({
    pdf,
    pageWidth,
    margin,
    contentWidth,
    appName: t.appName,
    subtitle: p.pdfSubtitle || t.reportSubtitle,
    title: p.pdfTitle,
    meta,
    contactMeta: buildPdfContactMetaLines({
      email: "Email",
    }),
    includeLogo: true,
    logoData,
    startY: 14,
  });

  drawSectionTitle(p.pdfScheduleTable);

  // Columns for nutrient lines under each application band.
  const col = {
    fert: margin + 2,
    qty: margin + 52,
    method: margin + 92,
  };
  const widths = {
    fert: 48,
    qty: 38,
    method: contentWidth - 96,
  };

  function drawNutrientHeader() {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
    pdf.text(pdfSafe(p.pdfColFertilizer), col.fert, y);
    pdf.text(pdfSafe(p.pdfColQuantity), col.qty, y);
    pdf.text(pdfSafe(p.pdfColMethod), col.method, y);
    y += 3.5;
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.25);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 3.2;
  }

  for (const block of blocks) {
    const hintLines = block.timingHint
      ? pdf.splitTextToSize(pdfSafe(block.timingHint), contentWidth - 8)
      : [];
    const bandHeight = 8 + Math.min(hintLines.length, 2) * 3.4;
    ensureSpace(bandHeight + 8 + block.lines.length * 5.5);

    // Application band: date + stage (group header).
    pdf.setFillColor(CARD[0], CARD[1], CARD[2]);
    pdf.roundedRect(margin, y, contentWidth, bandHeight, 1.2, 1.2, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9.5);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(pdfSafe(block.date), margin + 3, y + 5);
    pdf.text(pdfSafe(block.stageLabel), margin + 28, y + 5);
    if (hintLines.length > 0) {
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
      pdf.text(hintLines.slice(0, 2), margin + 3, y + 9.2);
    }
    y += bandHeight + 2.5;

    drawNutrientHeader();

    block.lines.forEach((line, index) => {
      const fertLines = pdf.splitTextToSize(
        pdfSafe(line.fertilizer),
        widths.fert - 1
      );
      const qtyLines = pdf.splitTextToSize(
        pdfSafe(line.quantity),
        widths.qty - 1
      );
      const methodLines = pdf.splitTextToSize(
        pdfSafe(line.method),
        widths.method - 1
      );
      const rowHeight = Math.max(
        4.8,
        fertLines.length * 3.8,
        qtyLines.length * 3.8,
        methodLines.length * 3.8
      );
      ensureSpace(rowHeight + 2);

      if (index % 2 === 0) {
        pdf.setFillColor(252, 252, 253);
        pdf.rect(margin, y - 3.2, contentWidth, rowHeight + 1.2, "F");
      }

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9);
      pdf.setTextColor(INK[0], INK[1], INK[2]);
      pdf.text(fertLines, col.fert, y);
      pdf.text(qtyLines, col.qty, y);
      pdf.text(methodLines, col.method, y);
      y += rowHeight + 1.2;
    });

    y += 2.5;
  }

  y += 1;
  drawSectionTitle(p.pdfRecommendations);
  const tips = buildRecommendations(p, input.events, cycleMode);
  tips.forEach((tip, index) => {
    ensureSpace(11);
    const fill =
      index % 2 === 0 ? CARD : ([255, 255, 255] as [number, number, number]);
    pdf.setFillColor(fill[0], fill[1], fill[2]);
    const wrap = pdf.splitTextToSize(
      pdfSafe(`${index + 1}. ${tip}`),
      contentWidth - 6
    );
    const h = Math.max(8, wrap.length * 4.2 + 2.5);
    pdf.roundedRect(margin, y, contentWidth, h, 1.1, 1.1, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    pdf.text(wrap, margin + 3, y + 5);
    y += h + 1.6;
  });

  drawFooter();

  const farmSlug = (input.farmName || "farm")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const fileName =
    input.fileName || `cultosol-fertilization-plan-${farmSlug || "farm"}.pdf`;
  const pdfBlob = pdf.output("blob");
  await saveBlobWithPicker(
    pdfBlob,
    fileName,
    "application/pdf",
    ".pdf",
    () => pdf.save(fileName)
  );
}
