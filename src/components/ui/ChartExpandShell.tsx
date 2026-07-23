"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";

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
}: Props) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);
  const overlayExpand = expandPlacement === "overlay";
  const dialogRef = useRef<HTMLDivElement | null>(null);
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
            <button
              type="button"
              className="chart-expand-shell__btn"
              onClick={close}
              aria-label={closeLabel}
            >
              <X size={18} />
            </button>
          </div>
          <p className="chart-fullscreen__rotate-hint" role="note">
            Rotate to landscape for the best view
          </p>
          <div className="chart-fullscreen__body">{children}</div>
        </div>
      ) : null}
    </>
  );
}
