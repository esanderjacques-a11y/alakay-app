"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, SlidersHorizontal } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { useDismissible } from "@/hooks/useDismissible";

type Props = {
  sortMode: "name" | "type";
  onSortModeChange: (mode: "name" | "type") => void;
  showSymbolsOnly: boolean;
  onShowSymbolsOnlyChange: (value: boolean) => void;
  labels: {
    sortByType: string;
    sortByName: string;
    showSymbolsOnly: string;
    menuLabel: string;
  };
};

export default function ValuesDisplayMenu({
  sortMode,
  onSortModeChange,
  showSymbolsOnly,
  onShowSymbolsOnlyChange,
  labels,
}: Props) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [canPortal, setCanPortal] = useState(false);
  const dismissRefs = useMemo(() => [panelRef, overlayRef], []);

  useEffect(() => {
    queueMicrotask(() => setCanPortal(true));
  }, []);

  useDismissible(open, () => setOpen(false), menuRef, dismissRefs);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = 240;
      const gap = 8;
      const padding = 12;
      const left = Math.min(
        Math.max(padding, rect.right - width),
        window.innerWidth - width - padding
      );

      setMenuStyle({
        position: "fixed",
        top: rect.bottom + gap,
        left,
        width,
        zIndex: 19000,
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const sortOptions = useMemo(
    () => [
      { value: "type" as const, label: labels.sortByType },
      { value: "name" as const, label: labels.sortByName },
    ],
    [labels.sortByName, labels.sortByType]
  );

  const menuOverlay =
    presence.mounted && canPortal
      ? createPortal(
          <div ref={overlayRef} className="values-display-menu-overlay">
            <button
              type="button"
              aria-label={labels.menuLabel}
              className={`dismiss-backdrop ${presence.leaving ? "animate-fade-out" : "animate-fade-in"}`}
              onClick={() => setOpen(false)}
            />
            <section
              ref={panelRef}
              className={`values-display-menu ${
                presence.leaving ? "animate-scale-out" : "animate-scale-in"
              }`}
              style={menuStyle}
              role="menu"
              aria-label={labels.menuLabel}
            >
              <p className="values-display-menu__heading">{labels.menuLabel}</p>
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  role="menuitemradio"
                  aria-checked={sortMode === option.value}
                  className={`values-display-menu__item${
                    sortMode === option.value ? " is-active" : ""
                  }`}
                  onClick={() => {
                    onSortModeChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                  {sortMode === option.value ? (
                    <Check size={15} aria-hidden />
                  ) : null}
                </button>
              ))}
              <div className="values-display-menu__divider" />
              <button
                type="button"
                role="menuitemcheckbox"
                aria-checked={showSymbolsOnly}
                className={`values-display-menu__item${
                  showSymbolsOnly ? " is-active" : ""
                }`}
                onClick={() => onShowSymbolsOnlyChange(!showSymbolsOnly)}
              >
                <span>{labels.showSymbolsOnly}</span>
                {showSymbolsOnly ? <Check size={15} aria-hidden /> : null}
              </button>
            </section>
          </div>,
          document.body
        )
      : null;

  return (
    <div
      ref={menuRef}
      className={`relative shrink-0 ${open ? "z-[19000]" : ""}`}
    >
      <button
        ref={triggerRef}
        type="button"
        className="values-toolbar-btn"
        aria-label={labels.menuLabel}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((previous) => !previous)}
      >
        <SlidersHorizontal size={16} />
      </button>

      {menuOverlay}
    </div>
  );
}
