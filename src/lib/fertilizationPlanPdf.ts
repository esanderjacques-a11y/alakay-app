import type { Translation } from "@/lib/translations";
import { saveBlobWithPicker } from "@/lib/fileSave";
import { parseLotNames } from "@/lib/farmLots";
import type { CalendarEvent } from "@/lib/planningTypes";
import { resolveScheduleCycleMode } from "@/lib/fertilizationSchedule";
import type { Language } from "@/lib/i18n";

export type FertilizationPlanPdfRow = {
  date: string;
  quantity: string;
  fertilizer: string;
  method: string;
  stageLabel?: string;
};

export type FertilizationPlanPdfInput = {
  t: Translation;
  farmName: string;
  lotName?: string;
  cropName?: string | null;
  responsible?: string;
  seasonStart?: string;
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

export function eventsToPlanRows(events: CalendarEvent[]): FertilizationPlanPdfRow[] {
  const sorted = [...events].sort((a, b) => {
    const byDate = a.date.localeCompare(b.date);
    if (byDate !== 0) return byDate;
    return (a.sequence || 0) - (b.sequence || 0);
  });

  const rows: FertilizationPlanPdfRow[] = [];
  for (const event of sorted) {
    if (event.lines && event.lines.length > 0) {
      for (const line of event.lines) {
        rows.push({
          date: event.date,
          quantity: `${line.kgHa} ${line.unitHa}${
            line.percentOfTotal != null ? ` (${line.percentOfTotal}%)` : ""
          }`,
          fertilizer: line.nutrient,
          method: line.method || event.method || event.stageLabel || "—",
          stageLabel: event.stageLabel || event.title,
        });
      }
    } else {
      rows.push({
        date: event.date,
        quantity: event.rate || "—",
        fertilizer: event.nutrient || event.title,
        method: event.method || "—",
        stageLabel: event.stageLabel || event.title,
      });
    }
  }
  return rows;
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
    lines.push(
      cycleMode === "perennial" ? t.pdfRecFlush : t.pdfRecBasal
    );
  }
  if (stages.has("vegetative") || stages.has("reproductive")) {
    lines.push(
      cycleMode === "perennial" || cycleMode === "fruiting"
        ? t.pdfRecFruiting
        : t.pdfRecTopdress
    );
  }
  if (events.some((e) => e.lines?.some((l) => /n\b|nitrogen|nitr/i.test(l.nutrient)))) {
    lines.push(t.pdfRecNitrogen);
  }
  return lines;
}

export async function exportFertilizationPlanPdf(
  input: FertilizationPlanPdfInput
): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const p = input.t.planning;
  const rows = eventsToPlanRows(input.events);
  if (rows.length === 0) {
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
    pdf.text(`${input.t.appName} · ${p.pdfSubtitle}`, margin, pageHeight - 7);
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

  // Header band
  pdf.setFillColor(HEAD_BG[0], HEAD_BG[1], HEAD_BG[2]);
  pdf.rect(0, 0, pageWidth, 32, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(16);
  pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
  pdf.text(p.pdfTitle, margin, 14);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(MUTED[0], MUTED[1], MUTED[2]);
  pdf.text(p.pdfSubtitle, margin, 21);
  y = 40;

  drawSectionTitle(p.pdfPlanInfo);
  metaRow(p.pdfFarm, input.farmName || "—");
  metaRow(
    p.pdfLots,
    formatLotsLabel(input.lotName, { lotsCount: p.pdfLotsCount })
  );
  metaRow(p.pdfCrop, input.cropName || "—");
  metaRow(p.pdfResponsible, input.responsible?.trim() || "—");
  if (input.seasonStart) {
    metaRow(
      cycleMode === "perennial" ? p.pdfCycleStart : p.pdfSeasonStart,
      input.seasonStart
    );
  }
  metaRow(
    p.pdfGenerated,
    new Date().toLocaleDateString(input.locale || undefined)
  );
  y += 3;

  drawSectionTitle(p.pdfScheduleTable);
  const col = {
    date: margin,
    qty: margin + 28,
    fert: margin + 58,
    method: margin + 118,
  };
  const widths = {
    date: 26,
    qty: 28,
    fert: 58,
    method: contentWidth - 112,
  };

  function drawTableHeader() {
    ensureSpace(10);
    pdf.setFillColor(240, 253, 244);
    pdf.rect(margin, y - 4, contentWidth, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(BRAND[0], BRAND[1], BRAND[2]);
    pdf.text(p.pdfColDate, col.date, y);
    pdf.text(p.pdfColQuantity, col.qty, y);
    pdf.text(p.pdfColFertilizer, col.fert, y);
    pdf.text(p.pdfColMethod, col.method, y);
    y += 6;
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 3;
  }

  drawTableHeader();

  let lastDate = "";
  for (const row of rows) {
    const fertLines = pdf.splitTextToSize(row.fertilizer, widths.fert - 2);
    const methodLines = pdf.splitTextToSize(row.method, widths.method - 2);
    const qtyLines = pdf.splitTextToSize(row.quantity, widths.qty - 2);
    const rowHeight = Math.max(
      6,
      fertLines.length * 4,
      methodLines.length * 4,
      qtyLines.length * 4
    );
    ensureSpace(rowHeight + 4);
    if (y === margin) drawTableHeader();

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(INK[0], INK[1], INK[2]);
    const showDate = row.date !== lastDate ? row.date : "";
    lastDate = row.date;
    pdf.text(showDate, col.date, y);
    pdf.text(qtyLines, col.qty, y);
    pdf.text(fertLines, col.fert, y);
    pdf.text(methodLines, col.method, y);
    y += rowHeight + 2;
    pdf.setDrawColor(LINE[0], LINE[1], LINE[2]);
    pdf.setLineWidth(0.2);
    pdf.line(margin, y, pageWidth - margin, y);
    y += 2;
  }

  y += 4;
  drawSectionTitle(p.pdfRecommendations);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(INK[0], INK[1], INK[2]);
  for (const tip of buildRecommendations(p, input.events, cycleMode)) {
    const lines = pdf.splitTextToSize(`• ${tip}`, contentWidth);
    for (const line of lines) {
      ensureSpace(5.5);
      pdf.text(line, margin, y);
      y += 4.8;
    }
    y += 1;
  }

  drawFooter();

  const farmSlug = (input.farmName || "farm")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  const fileName =
    input.fileName || `cultosol-fertilization-plan-${farmSlug || "farm"}.pdf`;
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
