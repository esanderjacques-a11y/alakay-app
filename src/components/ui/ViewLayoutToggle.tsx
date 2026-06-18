"use client";

import type { ReactNode } from "react";
import { LayoutGrid, List } from "lucide-react";
import type { ViewLayoutMode } from "@/lib/viewLayoutPreference";

type Props = {
  value: ViewLayoutMode;
  onChange: (mode: ViewLayoutMode) => void;
  listLabel: string;
  gridLabel: string;
  className?: string;
};

/**
 * Segmented list | grid control. Pair with `useViewLayoutPreference(scope)`.
 * Reused on CalculatorHub; Values page can adopt the same hook + toggle.
 */
export function ViewLayoutToggle({
  value,
  onChange,
  listLabel,
  gridLabel,
  className = "",
}: Props) {
  const options: Array<{ mode: ViewLayoutMode; label: string; icon: ReactNode }> = [
    { mode: "list", label: listLabel, icon: <List size={14} aria-hidden /> },
    { mode: "grid", label: gridLabel, icon: <LayoutGrid size={14} aria-hidden /> },
  ];

  return (
    <div
      className={`view-layout-toggle inline-flex shrink-0 rounded-xl border border-white/70 bg-white/58 p-0.5 shadow-sm ${className}`}
      role="group"
      aria-label={`${listLabel} / ${gridLabel}`}
    >
      {options.map(({ mode, label, icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`inline-flex min-h-9 min-w-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-extrabold transition sm:px-3 ${
            value === mode
              ? "bg-[var(--accent-600)] text-white shadow-sm"
              : "text-green-900 hover:bg-white/70"
          }`}
          aria-pressed={value === mode}
          title={label}
        >
          {icon}
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}
