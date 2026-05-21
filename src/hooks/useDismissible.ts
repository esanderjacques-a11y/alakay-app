"use client";

import { useEffect } from "react";

/** Close popovers on outside tap/click — works on mobile Safari, not only mousedown. */
export function useDismissible(
  open: boolean,
  onClose: () => void,
  containerRef: React.RefObject<HTMLElement | null>
) {
  useEffect(() => {
    if (!open) return;

    function isOutside(target: EventTarget | null) {
      if (!target || !containerRef.current) return false;
      return !containerRef.current.contains(target as Node);
    }

    function onPointerDown(event: PointerEvent) {
      if (isOutside(event.target)) onClose();
    }

    function onTouchStart(event: TouchEvent) {
      if (isOutside(event.target)) onClose();
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("touchstart", onTouchStart, {
      capture: true,
      passive: true,
    });
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("touchstart", onTouchStart, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, containerRef]);
}
