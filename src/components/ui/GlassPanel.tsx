"use client";

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  strong?: boolean;
  animate?: boolean;
};

export default function GlassPanel({
  children,
  className = "",
  strong = false,
  animate = true,
}: Props) {
  return (
    <div
      className={`rounded-3xl ${strong ? "glass-panel-strong" : "glass-panel"} ${
        animate ? "animate-slide-up" : ""
      } ${className}`}
    >
      {children}
    </div>
  );
}
