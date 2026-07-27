import { pdfSafe } from "@/lib/pdfText";

export const PDF_BRAND: [number, number, number] = [5, 150, 105];
export const PDF_INK: [number, number, number] = [15, 23, 42];
/** Soft gray for non-header body chrome — not for header copy. */
export const PDF_MUTED: [number, number, number] = [100, 116, 139];
/** Darker secondary for readable header labels / subtitles. */
export const PDF_HEADER_SECONDARY: [number, number, number] = [51, 65, 85];
export const PDF_LINE: [number, number, number] = [226, 232, 240];
export const PDF_WHITE: [number, number, number] = [255, 255, 255];
export const PDF_CARD: [number, number, number] = [248, 250, 252];

/** Public contact line: email + Costa Rica only. */
export const PDF_CONTACTS = {
  email: "jesander@earth.ac.cr",
  phoneCr: "+506 8828 7831",
} as const;

export type PdfHeaderMetaLine = {
  label: string;
  value: string;
};

export type PdfJsDoc = {
  internal: { pageSize: { getWidth: () => number; getHeight: () => number } };
  setFillColor: (r: number, g: number, b: number) => void;
  rect: (
    x: number,
    y: number,
    w: number,
    h: number,
    style?: string
  ) => void;
  setFont: (name: string, style?: string) => void;
  setFontSize: (size: number) => void;
  setTextColor: (r: number, g: number, b: number) => void;
  setDrawColor: (r: number, g: number, b: number) => void;
  setLineWidth: (w: number) => void;
  text: (
    text: string | string[],
    x: number,
    y: number,
    options?: { align?: "left" | "center" | "right" }
  ) => void;
  splitTextToSize: (text: string, width: number) => string[];
  getTextWidth?: (text: string) => number;
  line: (x1: number, y1: number, x2: number, y2: number) => void;
  addImage?: (
    data: string,
    format: string,
    x: number,
    y: number,
    w: number,
    h: number
  ) => void;
  roundedRect?: (
    x: number,
    y: number,
    w: number,
    h: number,
    rx: number,
    ry: number,
    style?: string
  ) => void;
};

const PDF_LOGO_PX = 128;

/**
 * Load `/app-icon.png` and downscale it for PDF embedding.
 * The source asset is ~1.6MB; embedding that raw often yields huge/fragile PDFs.
 */
export async function fetchPdfAppLogo(): Promise<string | null> {
  try {
    const response = await fetch("/app-icon.png");
    if (!response.ok) return null;
    const blob = await response.blob();

    if (
      typeof createImageBitmap === "function" &&
      typeof document !== "undefined"
    ) {
      const bitmap = await createImageBitmap(blob);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = PDF_LOGO_PX;
        canvas.height = PDF_LOGO_PX;
        const ctx = canvas.getContext("2d");
        if (!ctx) return null;
        ctx.clearRect(0, 0, PDF_LOGO_PX, PDF_LOGO_PX);
        ctx.drawImage(bitmap, 0, 0, PDF_LOGO_PX, PDF_LOGO_PX);
        return canvas.toDataURL("image/png");
      } finally {
        bitmap.close();
      }
    }

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function paintPdfPageWhite(
  pdf: PdfJsDoc,
  pageWidth: number,
  pageHeight: number
) {
  pdf.setFillColor(PDF_WHITE[0], PDF_WHITE[1], PDF_WHITE[2]);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");
}

/** Brand mark for PDF headers/footers — always full capitals. */
export function pdfBrandName(appName: string) {
  return pdfSafe(appName || "Cultosol").toUpperCase();
}

/** Email + Costa Rica phone only (no Haiti line). */
export function buildPdfContactMetaLines(labels?: {
  email?: string;
}): PdfHeaderMetaLine[] {
  return [
    { label: labels?.email || "Email", value: PDF_CONTACTS.email },
    { label: "", value: PDF_CONTACTS.phoneCr },
  ];
}

/**
 * Header layout: logo + report title (caps) on the left, contacts/meta on the
 * right. App name is not drawn — it already appears inside the logo artwork.
 */
export function drawPdfReportHeader(args: {
  pdf: PdfJsDoc;
  pageWidth: number;
  margin: number;
  contentWidth: number;
  /** Kept for API compatibility; not drawn in the header. */
  appName: string;
  subtitle: string;
  /** Optional header title. Prefer drawing document titles in the body. */
  title?: string;
  meta?: PdfHeaderMetaLine[];
  contactMeta?: PdfHeaderMetaLine[];
  includeLogo?: boolean;
  logoData?: string | null;
  startY?: number;
}): number {
  const {
    pdf,
    pageWidth,
    margin,
    contentWidth,
    subtitle,
    title,
    meta = [],
    contactMeta = [],
    includeLogo = true,
    logoData = null,
    startY = 12,
  } = args;

  const rightEdge = pageWidth - margin;
  const hasLogoAsset = Boolean(
    includeLogo && logoData && pdf.addImage && pdf.roundedRect
  );

  const logoPlate = 22;
  const logoInner = 18;
  const logoGap = 7;
  const rightColW = Math.min(72, contentWidth * 0.42);
  const leftColMax = Math.max(
    40,
    contentWidth - rightColW - (hasLogoAsset ? logoPlate + logoGap : 0) - 6
  );

  let logoDrawn = false;
  if (hasLogoAsset) {
    try {
      pdf.setFillColor(PDF_WHITE[0], PDF_WHITE[1], PDF_WHITE[2]);
      pdf.setDrawColor(PDF_LINE[0], PDF_LINE[1], PDF_LINE[2]);
      pdf.setLineWidth(0.3);
      pdf.roundedRect!(margin, startY, logoPlate, logoPlate, 3.5, 3.5, "FD");
      pdf.addImage!(
        logoData!,
        "PNG",
        margin + (logoPlate - logoInner) / 2,
        startY + (logoPlate - logoInner) / 2,
        logoInner,
        logoInner
      );
      logoDrawn = true;
    } catch (error) {
      console.warn("PDF logo embed skipped", error);
    }
  }

  const leftTextX = logoDrawn ? margin + logoPlate + logoGap : margin;

  // Report title beside the logo — always full capitals.
  const reportHeading = pdfSafe(
    (title?.trim() || subtitle.trim() || "Cultosol").toUpperCase()
  );
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(PDF_INK[0], PDF_INK[1], PDF_INK[2]);
  const headingLines = pdf.splitTextToSize(reportHeading, leftColMax).slice(0, 3);

  // If both title and subtitle exist and differ, show subtitle under the title.
  const secondaryHeading =
    title?.trim() &&
    subtitle.trim() &&
    title.trim().toLowerCase() !== subtitle.trim().toLowerCase()
      ? pdfSafe(subtitle.trim().toUpperCase())
      : "";
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  const secondaryLines = secondaryHeading
    ? pdf.splitTextToSize(secondaryHeading, leftColMax).slice(0, 2)
    : [];

  const leftBlockH =
    headingLines.length * 5.4 +
    (secondaryLines.length > 0 ? 1.5 + secondaryLines.length * 4.4 : 0);
  const leftTextTop =
    logoDrawn
      ? startY + Math.max(0, (logoPlate - leftBlockH) / 2) + 4
      : startY + 5;

  let leftY = leftTextTop;
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(12);
  pdf.setTextColor(PDF_INK[0], PDF_INK[1], PDF_INK[2]);
  for (const line of headingLines) {
    pdf.text(line, leftTextX, leftY);
    leftY += 5.4;
  }
  if (secondaryLines.length > 0) {
    leftY += 1.2;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    pdf.setTextColor(
      PDF_HEADER_SECONDARY[0],
      PDF_HEADER_SECONDARY[1],
      PDF_HEADER_SECONDARY[2]
    );
    for (const line of secondaryLines) {
      pdf.text(line, leftTextX, leftY);
      leftY += 4.4;
    }
  }

  // Right column: contacts + contextual meta, right-aligned.
  const detailMeta = meta.filter((row) => row.value.trim());
  const contacts = contactMeta.filter((row) => row.value.trim());
  const rightLines: Array<{ text: string; bold?: boolean }> = [];

  if (contacts.length > 0) {
    rightLines.push({
      text: pdfSafe(
        contacts
          .map((c) =>
            c.label.trim() ? `${c.label}: ${c.value}` : c.value
          )
          .join("   ·   ")
      ),
    });
  }
  for (const item of detailMeta) {
    const label = item.label.trim()
      ? `${pdfSafe(item.label).toUpperCase()}  `
      : "";
    rightLines.push({
      text: pdfSafe(`${label}${item.value}`),
      bold: Boolean(label),
    });
  }

  const rightWrapped: string[] = [];
  for (const row of rightLines) {
    pdf.setFont("helvetica", row.bold ? "bold" : "normal");
    pdf.setFontSize(9.5);
    const parts = pdf.splitTextToSize(row.text, rightColW);
    for (const part of parts.slice(0, 2)) rightWrapped.push(part);
  }

  const rightBlockH = rightWrapped.length * 4.6;
  let rightY =
    logoDrawn
      ? startY + Math.max(0, (logoPlate - rightBlockH) / 2) + 4
      : startY + 5;

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9.5);
  pdf.setTextColor(
    PDF_HEADER_SECONDARY[0],
    PDF_HEADER_SECONDARY[1],
    PDF_HEADER_SECONDARY[2]
  );
  for (const line of rightWrapped) {
    pdf.text(line, rightEdge, rightY, { align: "right" });
    rightY += 4.6;
  }

  const bottom = Math.max(
    logoDrawn ? startY + logoPlate : startY,
    leftY,
    rightY
  );
  let y = bottom + 4;

  pdf.setDrawColor(PDF_LINE[0], PDF_LINE[1], PDF_LINE[2]);
  pdf.setLineWidth(0.5);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 7;

  return y;
}
