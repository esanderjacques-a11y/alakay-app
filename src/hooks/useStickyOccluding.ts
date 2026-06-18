"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

function resolveStickyTopPx(el: HTMLElement): number {
  const top = getComputedStyle(el).top;
  const px = parseFloat(top);
  return Number.isNaN(px) ? 64 : px;
}

/**
 * Detects when a sticky title has scrolled past its natural position and content
 * passes underneath — toggles `data-sticky-occluding` on the element.
 */
export function useStickyOccluding<T extends HTMLElement = HTMLDivElement>(
  externalRef?: RefObject<T | null>
) {
  const internalRef = useRef<T>(null);
  const ref = externalRef ?? internalRef;
  const [occluding, setOccluding] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const sentinel = document.createElement("div");
    sentinel.className = "sticky-occlude-sentinel";
    sentinel.setAttribute("aria-hidden", "true");
    el.parentNode?.insertBefore(sentinel, el);

    let observer: IntersectionObserver | null = null;
    let lastTopPx = -1;

    const connectObserver = () => {
      const topPx = resolveStickyTopPx(el);
      if (topPx === lastTopPx && observer) return;
      lastTopPx = topPx;

      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          setOccluding(!entry.isIntersecting);
        },
        { threshold: 0, rootMargin: `-${topPx}px 0px 0px 0px` }
      );
      observer.observe(sentinel);
    };

    connectObserver();

    const onScrollOrResize = () => {
      connectObserver();
    };

    window.addEventListener("scroll", onScrollOrResize, { passive: true });
    document.addEventListener("scroll", onScrollOrResize, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", onScrollOrResize);

    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScrollOrResize);
      document.removeEventListener("scroll", onScrollOrResize, { capture: true });
      window.removeEventListener("resize", onScrollOrResize);
      sentinel.remove();
    };
  }, [ref]);

  return { ref, occluding };
}
