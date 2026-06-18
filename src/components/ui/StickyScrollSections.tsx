"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useStickyOccluding } from "@/hooks/useStickyOccluding";

export const STICKY_VIEWPORT_TOP =
  "var(--sticky-viewport-top, calc(env(safe-area-inset-top, 0px) + var(--app-header-visible-height, 4rem)))";

type StickyScrollSectionsContextValue = {
  topOffset: string;
};

const StickyScrollSectionsContext =
  createContext<StickyScrollSectionsContextValue>({
    topOffset: STICKY_VIEWPORT_TOP,
  });

type StickySectionOcclusionContextValue = {
  reportOccluding: (id: string, occluding: boolean) => void;
};

const StickySectionOcclusionContext =
  createContext<StickySectionOcclusionContextValue | null>(null);

type StickyScrollSectionsProps = {
  children: ReactNode;
  className?: string;
  topOffset?: string;
  onAnySectionOccludingChange?: (occluding: boolean) => void;
};

export function StickyScrollSections({
  children,
  className = "",
  topOffset = STICKY_VIEWPORT_TOP,
  onAnySectionOccludingChange,
}: StickyScrollSectionsProps) {
  const [occludingIds, setOccludingIds] = useState<Set<string>>(() => new Set());

  const reportOccluding = useCallback((id: string, occluding: boolean) => {
    setOccludingIds((previous) => {
      const has = previous.has(id);
      if (occluding === has) return previous;

      const next = new Set(previous);
      if (occluding) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const occlusionValue = useMemo(
    () => ({ reportOccluding }),
    [reportOccluding]
  );

  const anySectionOccluding = occludingIds.size > 0;

  useEffect(() => {
    onAnySectionOccludingChange?.(anySectionOccluding);
  }, [anySectionOccluding, onAnySectionOccludingChange]);

  return (
    <StickySectionOcclusionContext.Provider value={occlusionValue}>
      <StickyScrollSectionsContext.Provider value={{ topOffset }}>
        <div
          className={`sticky-scroll-sections ${className}`.trim()}
          style={{ "--sticky-section-top": topOffset } as CSSProperties}
        >
          {children}
        </div>
      </StickyScrollSectionsContext.Provider>
    </StickySectionOcclusionContext.Provider>
  );
}

type StickyScrollSectionProps = {
  title: string;
  description?: string;
  icon?: ReactNode;
  leading?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  headerClassName?: string;
  variant?: "default" | "panel" | "tone";
  tone?: "red" | "yellow" | "green" | "emerald" | "slate";
  badge?: ReactNode;
  id?: string;
};

const toneSectionClasses = {
  red: "sticky-scroll-section--tone-red",
  yellow: "sticky-scroll-section--tone-yellow",
  green: "sticky-scroll-section--tone-green",
  emerald: "sticky-scroll-section--tone-emerald",
  slate: "sticky-scroll-section--tone-slate",
} as const;

export function StickyScrollSection({
  title,
  description,
  icon,
  leading,
  children,
  className = "",
  bodyClassName = "",
  headerClassName = "",
  variant = "default",
  tone,
  badge,
  id,
}: StickyScrollSectionProps) {
  const { topOffset } = useContext(StickyScrollSectionsContext);
  const occlusionContext = useContext(StickySectionOcclusionContext);
  const { ref: headRef, occluding } = useStickyOccluding<HTMLElement>();
  const autoId = useId();
  const sectionId = id ?? autoId.replace(/:/g, "");

  useEffect(() => {
    if (!occlusionContext) return;
    occlusionContext.reportOccluding(sectionId, occluding);
    return () => {
      occlusionContext.reportOccluding(sectionId, false);
    };
  }, [occlusionContext, sectionId, occluding]);

  const sectionClass = [
    "sticky-scroll-section",
    variant === "panel" ? "sticky-scroll-section--panel" : "",
    variant === "tone" && tone ? toneSectionClasses[tone] : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <section
      id={sectionId}
      data-sticky-section
      data-sticky-section-id={sectionId}
      className={sectionClass}
      style={{ "--sticky-section-top": topOffset } as CSSProperties}
    >
      <header
        ref={headRef}
        className={`sticky-scroll-section-head ${headerClassName}`.trim()}
        data-sticky-occluding={occluding ? "true" : undefined}
      >
        <div className="sticky-scroll-section-head-inner">
          {leading ? (
            <span className="sticky-scroll-section-leading shrink-0">{leading}</span>
          ) : null}
          {icon ? (
            <span className="sticky-scroll-section-icon" aria-hidden>
              {icon}
            </span>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="sticky-scroll-section-title">{title}</h2>
            {description ? (
              <p className="sticky-scroll-section-desc">{description}</p>
            ) : null}
          </div>
          {badge}
        </div>
      </header>
      <div className={`sticky-scroll-section-body ${bodyClassName}`.trim()}>
        {children}
      </div>
    </section>
  );
}
