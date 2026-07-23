function slugPart(value: string | null | undefined, fallback: string) {
  const cleaned = String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w.-]+/g, "");
  return cleaned || fallback;
}

/** CULTOSOL_YYYY-MM-DD_CropName */
export function buildCultosolChartWatermark(opts: {
  date?: string | null;
  crop?: string | null;
}) {
  const rawDate = String(opts.date || "").trim();
  const datePart = rawDate
    ? slugPart(rawDate.replace(/\//g, "-"), new Date().toISOString().slice(0, 10))
    : new Date().toISOString().slice(0, 10);
  const cropPart = slugPart(opts.crop, "crop");
  return `CULTOSOL_${datePart}_${cropPart}`;
}

/** Full HD 16:9 export frame. */
const EXPORT_WIDTH = 1920;
const EXPORT_HEIGHT = 1080;

/**
 * Copy computed rgb() colors onto the clone so html2canvas does not choke on
 * modern CSS (space-separated rgb, color-mix, CSS variables, etc.).
 */
function hardenCloneStyles(sourceRoot: HTMLElement, cloneRoot: HTMLElement) {
  const sourceNodes = [sourceRoot, ...Array.from(sourceRoot.querySelectorAll("*"))];
  const cloneNodes = [cloneRoot, ...Array.from(cloneRoot.querySelectorAll("*"))];

  for (let i = 0; i < sourceNodes.length; i += 1) {
    const source = sourceNodes[i];
    const clone = cloneNodes[i];
    if (!(source instanceof HTMLElement) || !(clone instanceof HTMLElement)) continue;

    const style = window.getComputedStyle(source);
    clone.style.setProperty("background-color", style.backgroundColor, "important");
    clone.style.setProperty("color", style.color, "important");
    clone.style.setProperty("border-top-color", style.borderTopColor, "important");
    clone.style.setProperty("border-right-color", style.borderRightColor, "important");
    clone.style.setProperty("border-bottom-color", style.borderBottomColor, "important");
    clone.style.setProperty("border-left-color", style.borderLeftColor, "important");
    clone.style.setProperty("outline-color", style.outlineColor, "important");
    clone.style.setProperty("box-shadow", "none", "important");
    clone.style.setProperty("text-shadow", "none", "important");
    clone.style.setProperty("filter", "none", "important");
    clone.style.setProperty("backdrop-filter", "none", "important");
    clone.style.setProperty("-webkit-backdrop-filter", "none", "important");

    if (style.backgroundImage && style.backgroundImage !== "none") {
      clone.style.setProperty("background-image", "none", "important");
    }
  }
}

type SavePicker = (options: {
  suggestedName?: string;
  types?: {
    description: string;
    accept: Record<string, string[]>;
  }[];
}) => Promise<{
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>;
    close: () => Promise<void>;
  }>;
}>;

async function savePngBlob(blob: Blob, suggestedName: string) {
  const picker = (window as Window & { showSaveFilePicker?: SavePicker })
    .showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName,
        types: [
          {
            description: "PNG image",
            accept: { "image/png": [".png"] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  const file = new File([blob], suggestedName, { type: "image/png" });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: suggestedName });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.rel = "noopener";
  anchor.style.display = "none";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function parseDopPercent(text: string) {
  const match = String(text || "")
    .replace(/\s/g, "")
    .match(/([+-]?\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}

type DopExportRow = {
  label: string;
  valueText: string;
  dop: number;
  widthPct: number;
  isNeg: boolean;
  color: string;
};

function readDopExportRows(element: HTMLElement): DopExportRow[] {
  return Array.from(element.querySelectorAll(".dop-chart__row")).map((row) => {
    const label =
      row.querySelector(".dop-chart__row-label")?.textContent?.trim() || "—";
    const valueText =
      row.querySelector(".dop-chart__row-value")?.textContent?.trim() || "";
    const dop = parseDopPercent(valueText) ?? 0;
    const bar = row.querySelector(".dop-chart__row-bar") as HTMLElement | null;
    const widthPct = Math.min(
      50,
      Math.max(
        2,
        Number.parseFloat(bar?.style.width || "") || Math.min(50, Math.abs(dop) / 3.6)
      )
    );
    const isNeg = bar?.classList.contains("dop-chart__row-bar--neg") || dop < 0;
    const isOk = bar?.classList.contains("dop-chart__row-bar--ok");
    const isHigh = bar?.classList.contains("dop-chart__row-bar--high");
    const color = isOk
      ? "#059669"
      : isHigh || (!isNeg && dop > 0)
        ? "#0f766e"
        : "#dc2626";
    return { label, valueText: valueText || `${dop}%`, dop, widthPct, isNeg, color };
  });
}

function readScaleMax(element: HTMLElement) {
  const scaleText = Array.from(element.querySelectorAll(".dop-chart__h-scale span"))
    .map((node) => node.textContent || "")
    .join(" ");
  const match = scaleText.match(/\+?\s*(\d+)\s*%/);
  return match ? Number(match[1]) : 180;
}

/** Crisp native 16:9 DOP chart — preferred over screenshot upscales. */
function drawDopChart16x9(element: HTMLElement, watermark: string) {
  const rows = readDopExportRows(element);
  if (rows.length === 0) return null;

  const scaleMax = readScaleMax(element);
  const width = EXPORT_WIDTH;
  const height = EXPORT_HEIGHT;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  // Soft page background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, width, height);

  const marginX = 72;
  const marginTop = 64;
  const watermarkH = 56;
  const legendH = 48;
  const scaleH = 40;
  const chartBottom = height - watermarkH - legendH - 24;
  const chartTop = marginTop + scaleH;
  const chartH = Math.max(240, chartBottom - chartTop);

  const labelW = 88;
  const valueW = 120;
  const trackX = marginX + labelW;
  const trackW = width - marginX * 2 - labelW - valueW;
  const midX = trackX + trackW / 2;
  const rowGap = chartH / rows.length;
  const barH = Math.min(34, Math.max(18, rowGap * 0.55));

  // Title
  ctx.fillStyle = "#14532d";
  ctx.font = "700 36px Helvetica, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("DOP", marginX, 44);

  ctx.fillStyle = "#64748b";
  ctx.font = "600 22px Helvetica, Arial, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("Deviation from optimum (%)", width - marginX, 44);

  // Scale labels
  ctx.fillStyle = "#64748b";
  ctx.font = "700 18px Helvetica, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(`−${scaleMax}%`, trackX, marginTop + 22);
  ctx.textAlign = "center";
  ctx.fillText("0%", midX, marginTop + 22);
  ctx.textAlign = "right";
  ctx.fillText(`+${scaleMax}%`, trackX + trackW, marginTop + 22);

  rows.forEach((row, index) => {
    const cy = chartTop + rowGap * index + rowGap / 2;
    const trackY = cy - barH / 2;

    ctx.fillStyle = "#14532d";
    ctx.font = "800 24px Helvetica, Arial, sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    ctx.fillText(row.label, trackX - 16, cy);

    // Track
    ctx.fillStyle = "#e2e8f0";
    roundRect(ctx, trackX, trackY, trackW, barH, 8);
    ctx.fill();

    // Quarter guides
    ctx.fillStyle = "rgba(148, 163, 184, 0.35)";
    ctx.fillRect(trackX + trackW * 0.25 - 1, trackY, 2, barH);
    ctx.fillRect(trackX + trackW * 0.75 - 1, trackY, 2, barH);

    // Zero line
    ctx.fillStyle = "rgba(100, 116, 139, 0.85)";
    ctx.fillRect(midX - 1.5, trackY, 3, barH);

    const barW = Math.max(6, (row.widthPct / 100) * trackW);
    ctx.fillStyle = row.color;
    if (row.isNeg) {
      roundRect(ctx, midX - barW, trackY + 3, barW, barH - 6, 6);
    } else {
      roundRect(ctx, midX, trackY + 3, barW, barH - 6, 6);
    }
    ctx.fill();

    ctx.fillStyle = row.color;
    ctx.font = "700 22px Helvetica, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(row.valueText, trackX + trackW + 16, cy);
  });

  // Legend
  const legendY = chartBottom + 28;
  drawLegendItem(ctx, width / 2 - 220, legendY, "#dc2626", "Deficiency");
  drawLegendItem(ctx, width / 2 - 40, legendY, "#059669", "Optimum");
  drawLegendItem(ctx, width / 2 + 140, legendY, "#0f766e", "Excess");

  // Watermark footer
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(0, height - watermarkH, width, watermarkH);
  ctx.fillStyle = "#64748b";
  ctx.font = "600 20px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(watermark, width / 2, height - watermarkH / 2);

  return canvas;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function drawLegendItem(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  label: string
) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y - 8, 16, 16, 4);
  ctx.fill();
  ctx.fillStyle = "#475569";
  ctx.font = "600 18px Helvetica, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(label, x + 24, y);
}

/** Fit any captured bitmap into a sharp 16:9 canvas with watermark. */
function composeTo16x9(source: HTMLCanvasElement, watermark: string) {
  const width = EXPORT_WIDTH;
  const height = EXPORT_HEIGHT;
  const watermarkH = 56;
  const pad = 48;
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Could not create canvas context");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const availW = width - pad * 2;
  const availH = height - pad - watermarkH;
  const scale = Math.min(availW / source.width, availH / source.height);
  const drawW = source.width * scale;
  const drawH = source.height * scale;
  const dx = (width - drawW) / 2;
  const dy = pad + (availH - drawH) / 2;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, dx, dy, drawW, drawH);

  ctx.fillStyle = "#f1f5f9";
  ctx.fillRect(0, height - watermarkH, width, watermarkH);
  ctx.fillStyle = "#64748b";
  ctx.font = "600 20px Helvetica, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(watermark, width / 2, height - watermarkH / 2);

  return out;
}

async function captureElementCanvas(element: HTMLElement) {
  const width = Math.max(1, element.scrollWidth || element.clientWidth);
  const height = Math.max(1, element.scrollHeight || element.clientHeight);
  // High capture scale for non-DOP fallbacks before fitting into 16:9.
  const scale = 3;

  try {
    const html2canvas = (await import("html2canvas")).default;
    const capturePromise = html2canvas(element, {
      backgroundColor: "#ffffff",
      scale,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      useCORS: true,
      allowTaint: true,
      logging: false,
      foreignObjectRendering: false,
      onclone: (_doc, cloned) => {
        hardenCloneStyles(element, cloned);
        cloned.style.width = `${width}px`;
        cloned.style.height = `${height}px`;
        cloned.style.maxHeight = "none";
        cloned.style.overflow = "visible";
      },
    });
    const timeoutPromise = new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Chart capture timed out")), 8000);
    });
    const captured = await Promise.race([capturePromise, timeoutPromise]);
    if (captured.width && captured.height) return captured;
  } catch (error) {
    console.warn("html2canvas failed", error);
  }

  throw new Error("Chart capture produced an empty image.");
}

export async function downloadElementAsPng(opts: {
  element: HTMLElement;
  fileName: string;
  watermark: string;
  scale?: number;
}) {
  if (typeof window === "undefined") {
    throw new Error("PNG export is only available in the browser.");
  }

  // Prefer a native high-res 16:9 redraw for DOP charts (crisp text/bars).
  let out =
    opts.element.querySelector(".dop-chart__row") ||
    opts.element.classList.contains("dop-chart__board")
      ? drawDopChart16x9(opts.element, opts.watermark)
      : null;

  if (!out) {
    const captured = await captureElementCanvas(opts.element);
    out = composeTo16x9(captured, opts.watermark);
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    out!.toBlob(resolve, "image/png")
  );
  if (!blob) throw new Error("Could not encode PNG");

  const suggestedName = opts.fileName.endsWith(".png")
    ? opts.fileName
    : `${opts.fileName}.png`;

  await savePngBlob(blob, suggestedName);
}
