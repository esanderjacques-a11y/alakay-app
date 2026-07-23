"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Maximize2, X } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { downloadElementAsPng } from "@/lib/chartPngExport";

type Props = {
  title: string;
  closeLabel: string;
  expandLabel: string;
  children: ReactNode;
  fullscreenClassName?: string;
  /** When false, only the expand control is shown inline (title still used in fullscreen). */
  showInlineTitle?: boolean;
  /** Place expand control inside the chart (top-right) instead of a separate toolbar row. */
  expandPlacement?: "toolbar" | "overlay";
  /** On expand, try browser fullscreen + landscape lock (phones/tablets). */
  lockLandscapeOnExpand?: boolean;
  /** Show a PNG download control in fullscreen. */
  downloadLabel?: string;
  /** Watermark drawn at the bottom of the exported PNG. */
  downloadWatermark?: string;
  /** Suggested download filename (`.png` added if missing). */
  downloadFileName?: string;
  /** CSS selector scoped to the fullscreen body for capture target. */
  downloadCaptureSelector?: string;
};

type OrientationLockType =
  | "any"
  | "natural"
  | "landscape"
  | "portrait"
  | "portrait-primary"
  | "portrait-secondary"
  | "landscape-primary"
  | "landscape-secondary";

function isNarrowViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 700px), (pointer: coarse) and (max-width: 1024px)").matches;
}

async function enterLandscapeFullscreen(target: HTMLElement | null) {
  if (!target) return;
  try {
    if (!document.fullscreenElement && target.requestFullscreen) {
      await target.requestFullscreen();
    }
  } catch {
    /* fullscreen may be blocked */
  }
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (orientation: OrientationLockType) => Promise<void>;
    };
    await orientation.lock?.("landscape");
  } catch {
    /* lock requires fullscreen / is unsupported on iOS */
  }
}

async function exitLandscapeFullscreen() {
  try {
    screen.orientation?.unlock?.();
  } catch {
    /* ignore */
  }
  try {
    if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch {
    /* ignore */
  }
}

export default function ChartExpandShell({
  title,
  closeLabel,
  expandLabel,
  children,
  fullscreenClassName = "",
  showInlineTitle = true,
  expandPlacement = "toolbar",
  lockLandscapeOnExpand = false,
  downloadLabel,
  downloadWatermark,
  downloadFileName,
  downloadCaptureSelector = ".dop-chart__board, .chart-panel--compact, .uptake-chart-panel, .nutrient-graph",
}: Props) {
  const [open, setOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(false);
  const presence = useAnimatedPresence(open);
  const overlayExpand = expandPlacement === "overlay";
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const landscapeArmedRef = useRef(false);

  useEffect(() => {
    if (!open || !lockLandscapeOnExpand || !isNarrowViewport()) return;
    landscapeArmedRef.current = true;
    const frame = window.requestAnimationFrame(() => {
      void enterLandscapeFullscreen(dialogRef.current);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, lockLandscapeOnExpand]);

  useEffect(() => {
    if (open || !landscapeArmedRef.current) return;
    landscapeArmedRef.current = false;
    void exitLandscapeFullscreen();
  }, [open]);

  useEffect(() => {
    return () => {
      if (landscapeArmedRef.current) {
        landscapeArmedRef.current = false;
        void exitLandscapeFullscreen();
      }
    };
  }, []);

  function close() {
    setOpen(false);
  }

  async function handleDownload() {
    if (!downloadLabel || downloading) return;
    const root = bodyRef.current;
    if (!root) return;
    const target =
      (downloadCaptureSelector
        ? (root.querySelector(downloadCaptureSelector) as HTMLElement | null)
        : null) || root;
    setDownloadError(false);
    setDownloading(true);
    try {
      const watermark = downloadWatermark || "CULTOSOL";
      const fileName = downloadFileName || watermark;
      await downloadElementAsPng({
        element: target,
        fileName,
        watermark,
      });
    } catch (error) {
      console.error("Chart PNG download failed", error);
      setDownloadError(true);
    } finally {
      setDownloading(false);
    }
  }

  const expandButton = (
    <button
      type="button"
      className={`chart-expand-shell__btn${
        overlayExpand ? " chart-expand-shell__btn--overlay" : ""
      }`}
      onClick={() => setOpen(true)}
      aria-label={expandLabel}
    >
      <Maximize2 size={16} />
    </button>
  );

  return (
    <>
      <div
        className={`chart-expand-shell${
          overlayExpand ? " chart-expand-shell--overlay" : ""
        }`}
      >
        {!overlayExpand ? (
          <div
            className={`chart-expand-shell__toolbar${
              showInlineTitle ? "" : " chart-expand-shell__toolbar--actions-only"
            }`}
          >
            {showInlineTitle ? (
              <p className="chart-expand-shell__title">{title}</p>
            ) : null}
            {expandButton}
          </div>
        ) : null}
        <div className="chart-expand-shell__body">
          {overlayExpand ? expandButton : null}
          {children}
        </div>
      </div>

      {presence.mounted ? (
        <div
          ref={dialogRef}
          className={`chart-fullscreen ${presence.leaving ? "chart-fullscreen--leaving" : ""} ${fullscreenClassName}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="chart-fullscreen__bar">
            <p className="chart-fullscreen__title">{title}</p>
            <div className="chart-fullscreen__actions">
              {downloadLabel ? (
                <button
                  type="button"
                  className={`chart-expand-shell__btn${
                    downloadError ? " chart-expand-shell__btn--error" : ""
                  }`}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleDownload();
                  }}
                  aria-label={
                    downloadError
                      ? `${downloadLabel} failed — tap to retry`
                      : downloading
                        ? "Preparing PNG…"
                        : downloadLabel
                  }
                  title={
                    downloadError
                      ? "Download failed — tap to retry"
                      : downloadLabel
                  }
                  disabled={downloading}
                  aria-busy={downloading}
                >
                  <Download size={18} />
                </button>
              ) : null}
              <button
                type="button"
                className="chart-expand-shell__btn"
                onClick={close}
                aria-label={closeLabel}
              >
                <X size={18} />
              </button>
            </div>
          </div>
          <p className="chart-fullscreen__rotate-hint" role="note">
            Rotate to landscape for the best view
          </p>
          <div ref={bodyRef} className="chart-fullscreen__body">
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
