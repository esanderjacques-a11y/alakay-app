"use client";

import { useState, type ReactNode } from "react";
import { Maximize2, X } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";

type Props = {
  title: string;
  closeLabel: string;
  expandLabel: string;
  children: ReactNode;
  fullscreenClassName?: string;
};

export default function ChartExpandShell({
  title,
  closeLabel,
  expandLabel,
  children,
  fullscreenClassName = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);

  return (
    <>
      <div className="chart-expand-shell">
        <div className="chart-expand-shell__toolbar">
          <p className="chart-expand-shell__title">{title}</p>
          <button
            type="button"
            className="chart-expand-shell__btn"
            onClick={() => setOpen(true)}
            aria-label={expandLabel}
          >
            <Maximize2 size={16} />
          </button>
        </div>
        <div className="chart-expand-shell__body">{children}</div>
      </div>

      {presence.mounted ? (
        <div
          className={`chart-fullscreen ${presence.leaving ? "chart-fullscreen--leaving" : ""} ${fullscreenClassName}`}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <div className="chart-fullscreen__bar">
            <p className="chart-fullscreen__title">{title}</p>
            <button
              type="button"
              className="chart-expand-shell__btn"
              onClick={() => setOpen(false)}
              aria-label={closeLabel}
            >
              <X size={18} />
            </button>
          </div>
          <div className="chart-fullscreen__body">{children}</div>
        </div>
      ) : null}
    </>
  );
}
