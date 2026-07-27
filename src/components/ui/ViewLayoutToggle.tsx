"use client";

import type { ReactNode } from "react";
import { Grid3x3, LayoutGrid, List } from "lucide-react";
import type { ViewLayoutMode } from "@/lib/viewLayoutPreference";

type Props = {
  value: ViewLayoutMode;
  onChange: (mode: ViewLayoutMode) => void;
  listLabel: string;
  gridLabel: string;
  /** When set, shows a third compact pad/grid option (Values quick-entry). */
  padLabel?: string;
  className?: string;
};

/**
 * Segmented list | grid (| pad) control.
 * Pair with `useViewLayoutPreference(scope)` where persistence is needed.
 */
export function ViewLayoutToggle({
  value,
  onChange,
  listLabel,
  gridLabel,
  padLabel,
  className = "",
}: Props) {
  const options: Array<{ mode: ViewLayoutMode; label: string; icon: ReactNode }> =
    [
      { mode: "list", label: listLabel, icon: <List size={14} aria-hidden /> },
      {
        mode: "grid",
        label: gridLabel,
        icon: <LayoutGrid size={14} aria-hidden />,
      },
    ];

  if (padLabel) {
    options.push({
      mode: "pad",
      label: padLabel,
      icon: <Grid3x3 size={14} aria-hidden />,
    });
  }

  return (
    <div
      className={`view-layout-toggle ${className}`.trim()}
      role="group"
      aria-label={options.map((option) => option.label).join(" / ")}
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
