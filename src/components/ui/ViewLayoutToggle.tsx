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
      className={`view-layout-toggle ${className}`.trim()}
      role="group"
      aria-label={`${listLabel} / ${gridLabel}`}
    >
      {options.map(({ mode, label, icon }) => (
        <button
          key={mode}
          type="button"
          onClick={() => onChange(mode)}
          className={`view-layout-toggle__btn ${
            value === mode ? "view-layout-toggle__btn--active" : ""
          }`}
          aria-pressed={value === mode}
          title={label}
        >
          {icon}
          <span className="view-layout-toggle__label">{label}</span>
        </button>
      ))}
    </div>
  );
}
