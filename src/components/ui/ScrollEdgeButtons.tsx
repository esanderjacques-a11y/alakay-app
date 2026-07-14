"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, ChevronUp } from "lucide-react";
import { readStoredLanguage } from "@/lib/uiPreferences";
import type { Language } from "@/lib/translations";

const OVERFLOW_MIN_PX = 160;
const EDGE_PX = 96;

const LABELS: Record<Language, { top: string; bottom: string }> = {
  en: { top: "Go to top", bottom: "Go to bottom" },
  es: { top: "Ir arriba", bottom: "Ir abajo" },
  fr: { top: "Aller en haut", bottom: "Aller en bas" },
  ht: { top: "Ale anwo", bottom: "Ale anba" },
  pt: { top: "Ir ao topo", bottom: "Ir ao final" },
  sw: { top: "Nenda juu", bottom: "Nenda chini" },
};

type ScrollEdges = {
  scrollable: boolean;
  showTop: boolean;
  showBottom: boolean;
};

function readScrollEdges(): ScrollEdges {
  const viewport = window.innerHeight || document.documentElement.clientHeight;
  const docHeight = Math.max(
    document.documentElement.scrollHeight,
    document.body?.scrollHeight || 0
  );
  const maxScroll = Math.max(0, docHeight - viewport);
  const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
  const scrollable = maxScroll > OVERFLOW_MIN_PX;

  return {
    scrollable,
    showTop: scrollable && scrollTop > EDGE_PX,
    showBottom: scrollable && scrollTop < maxScroll - EDGE_PX,
  };
}

function smoothScrollTo(top: number) {
  window.scrollTo({ top, behavior: "smooth" });
}

/**
 * Floating up/down controls when the document is longer than the viewport.
 */
export default function ScrollEdgeButtons() {
  const [mounted, setMounted] = useState(false);
  const [edges, setEdges] = useState<ScrollEdges>({
    scrollable: false,
    showTop: false,
    showBottom: false,
  });
  const [labels, setLabels] = useState(LABELS.en);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const syncLabels = () => {
      const lang = readStoredLanguage();
      setLabels(LABELS[lang] || LABELS.en);
    };
    syncLabels();

    let ticking = false;
    const update = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        setEdges(readScrollEdges());
        ticking = false;
      });
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("storage", syncLabels);

    const observer = new ResizeObserver(update);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("storage", syncLabels);
      observer.disconnect();
    };
  }, [mounted]);

  if (!mounted || !edges.scrollable || (!edges.showTop && !edges.showBottom)) {
    return null;
  }

  return createPortal(
    <div className="scroll-edge-buttons" role="navigation" aria-label="Page scroll">
      {edges.showTop ? (
        <button
          type="button"
          className="scroll-edge-buttons__btn"
          aria-label={labels.top}
          title={labels.top}
          onClick={() => smoothScrollTo(0)}
        >
          <ChevronUp size={20} aria-hidden />
        </button>
      ) : null}
      {edges.showBottom ? (
        <button
          type="button"
          className="scroll-edge-buttons__btn"
          aria-label={labels.bottom}
          title={labels.bottom}
          onClick={() =>
            smoothScrollTo(
              Math.max(
                0,
                Math.max(
                  document.documentElement.scrollHeight,
                  document.body?.scrollHeight || 0
                ) - (window.innerHeight || 0)
              )
            )
          }
        >
          <ChevronDown size={20} aria-hidden />
        </button>
      ) : null}
    </div>,
    document.body
  );
}
