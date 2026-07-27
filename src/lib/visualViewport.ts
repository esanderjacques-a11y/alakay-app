import type { CSSProperties } from "react";

export type ViewportBox = {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
};

/** Visible area of the screen (excludes the soft keyboard when present). */
export function getVisualViewportBox(): ViewportBox {
  const vv = typeof window !== "undefined" ? window.visualViewport : null;
  if (vv) {
    return {
      top: vv.offsetTop,
      left: vv.offsetLeft,
      width: vv.width,
      height: vv.height,
      bottom: vv.offsetTop + vv.height,
      right: vv.offsetLeft + vv.width,
    };
  }
  const width = window.innerWidth;
  const height = window.innerHeight;
  return {
    top: 0,
    left: 0,
    width,
    height,
    bottom: height,
    right: width,
  };
}

export function isCoarsePointerUi() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(pointer: coarse), (max-width: 768px)").matches;
}

/**
 * On touch / narrow screens, dock the menu as a sheet inside the visual
 * viewport so long lists (country, crop, region) stay readable above the
 * soft keyboard instead of fighting layout jumps.
 */
export function shouldUseMenuSheet(_vv: ViewportBox = getVisualViewportBox()) {
  return isCoarsePointerUi();
}

export type FloatingMenuPlacement = {
  style: CSSProperties;
  /** Max height for the scrollable options list (px). */
  listMaxHeight: number;
  sheet: boolean;
};

/**
 * Place a portaled select menu inside the visual viewport.
 * On mobile with the keyboard open, docks as a bottom sheet above the keyboard.
 */
export function placeFloatingMenu(opts: {
  triggerRect: DOMRect;
  estimatedHeight?: number;
  minWidth?: number;
  padding?: number;
  gap?: number;
  zIndex?: number;
  /** Extra chrome above the scroll list (heading, search row). */
  chromeHeight?: number;
}): FloatingMenuPlacement {
  const padding = opts.padding ?? 12;
  const gap = opts.gap ?? 8;
  const zIndex = opts.zIndex ?? 19000;
  const chromeHeight = opts.chromeHeight ?? 0;
  const estimatedHeight = opts.estimatedHeight ?? 280;
  const minWidth = opts.minWidth ?? 180;
  const vv = getVisualViewportBox();
  const sheet = shouldUseMenuSheet(vv);

  if (sheet) {
    const maxPanel = Math.max(
      168,
      Math.min(Math.round(vv.height * 0.62), 420)
    );
    const bottom = Math.max(padding, window.innerHeight - vv.bottom + padding);
    const left = Math.max(padding, vv.left + padding);
    const width = Math.max(160, vv.width - padding * 2);
    return {
      sheet: true,
      listMaxHeight: Math.max(120, maxPanel - chromeHeight - 16),
      style: {
        position: "fixed",
        left,
        width,
        right: "auto",
        bottom,
        top: "auto",
        maxHeight: maxPanel,
        zIndex,
      },
    };
  }

  const spaceBelow = vv.bottom - opts.triggerRect.bottom - gap - padding;
  const spaceAbove = opts.triggerRect.top - vv.top - gap - padding;
  const openAbove =
    spaceBelow < Math.min(estimatedHeight, 200) && spaceAbove > spaceBelow;
  const available = Math.max(120, openAbove ? spaceAbove : spaceBelow);
  const maxHeight = Math.min(available, Math.round(vv.height * 0.55), 360);
  const preferredWidth = Math.max(opts.triggerRect.width, minWidth);
  const width = Math.min(preferredWidth, vv.width - padding * 2);
  let left = opts.triggerRect.left;
  left = Math.min(Math.max(vv.left + padding, left), vv.right - width - padding);

  if (openAbove) {
    return {
      sheet: false,
      listMaxHeight: Math.max(100, maxHeight - chromeHeight),
      style: {
        position: "fixed",
        bottom: window.innerHeight - opts.triggerRect.top + gap,
        top: "auto",
        left,
        width,
        maxHeight,
        zIndex,
      },
    };
  }

  return {
    sheet: false,
    listMaxHeight: Math.max(100, maxHeight - chromeHeight),
    style: {
      position: "fixed",
      top: opts.triggerRect.bottom + gap,
      bottom: "auto",
      left,
      width,
      maxHeight,
      zIndex,
    },
  };
}

/** Subscribe to visualViewport + window geometry changes. */
export function subscribeViewportChange(handler: () => void) {
  window.addEventListener("resize", handler);
  window.addEventListener("scroll", handler, true);
  window.visualViewport?.addEventListener("resize", handler);
  window.visualViewport?.addEventListener("scroll", handler);
  return () => {
    window.removeEventListener("resize", handler);
    window.removeEventListener("scroll", handler, true);
    window.visualViewport?.removeEventListener("resize", handler);
    window.visualViewport?.removeEventListener("scroll", handler);
  };
}
