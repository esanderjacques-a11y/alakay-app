"use client";

import { type ReactNode } from "react";
import { useStickyOccluding } from "@/hooks/useStickyOccluding";

type StickyPageTitleProps = {
  children: ReactNode;
  className?: string;
  /** When true, page heading is hidden so a sticky section title can replace it. */
  titleReplaced?: boolean;
};

export function StickyPageTitle({
  children,
  className = "",
  titleReplaced = false,
}: StickyPageTitleProps) {
  const { ref, occluding } = useStickyOccluding<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={`sticky-page-title ${className}`.trim()}
      data-sticky-occluding={occluding ? "true" : undefined}
      data-title-replaced={titleReplaced ? "true" : undefined}
    >
      {children}
    </div>
  );
}
