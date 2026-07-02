"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronRight, ListTree, Plus, Ruler } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";

export type AddDataMenuLabels = {
  menuHeading: string;
  addCustomParameter: string;
  addCustomParameterDesc: string;
  manageCustomParameters: string;
  manageCustomParametersDesc: string;
  manageCustomRanges: string;
  manageCustomRangesDesc: string;
  close: string;
};

type Props = {
  variant?: "toolbar" | "sticky";
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labels: AddDataMenuLabels;
  onAddParameter: () => void;
  onManageParameters: () => void;
  onManageRanges: () => void;
};

const MENU_WIDTH = 288;

export default function AddDataMenu({
  variant = "toolbar",
  open,
  onOpenChange,
  labels,
  onAddParameter,
  onManageParameters,
  onManageRanges,
}: Props) {
  const presence = useAnimatedPresence(open);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [canPortal, setCanPortal] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setCanPortal(true));
  }, []);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const gap = 8;
      const padding = 12;
      const viewportHeight = window.innerHeight;
      const estimatedHeight = 280;
      const spaceBelow = viewportHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;

      const left = Math.min(
        Math.max(padding, rect.right - MENU_WIDTH),
        window.innerWidth - MENU_WIDTH - padding
      );

      setMenuStyle({
        position: "fixed",
        left,
        width: MENU_WIDTH,
        zIndex: 19000,
        ...(openAbove
          ? { bottom: viewportHeight - rect.top + gap }
          : { top: rect.bottom + gap }),
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

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      if (
        target instanceof Element &&
        target.closest(".add-data-menu-overlay")
      ) {
        return;
      }
      onOpenChange(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onOpenChange, open]);

  function runMenuAction(action: () => void) {
    action();
    onOpenChange(false);
  }

  const menuItems = [
    {
      key: "add",
      icon: Plus,
      title: labels.addCustomParameter,
      description: labels.addCustomParameterDesc,
      action: onAddParameter,
    },
    {
      key: "parameters",
      icon: ListTree,
      title: labels.manageCustomParameters,
      description: labels.manageCustomParametersDesc,
      action: onManageParameters,
    },
    {
      key: "ranges",
      icon: Ruler,
      title: labels.manageCustomRanges,
      description: labels.manageCustomRangesDesc,
      action: onManageRanges,
    },
  ] as const;

  const menuOverlay =
    presence.mounted && canPortal
      ? createPortal(
          <div ref={overlayRef} className="add-data-menu-overlay">
            <button
              type="button"
              aria-label={labels.close}
              className={`dismiss-backdrop ${presence.leaving ? "animate-fade-out" : "animate-fade-in"}`}
              onClick={() => onOpenChange(false)}
            />
            <section
              className={`add-data-menu ${presence.leaving ? "animate-scale-out" : "animate-scale-in"}`}
              style={menuStyle}
              role="menu"
              aria-label={labels.menuHeading}
            >
              <p className="add-data-menu__heading">{labels.menuHeading}</p>
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitem"
                    className="add-data-menu__item"
                    onPointerDown={(event) => {
                      if (event.button !== 0) return;
                      event.stopPropagation();
                      runMenuAction(item.action);
                    }}
                  >
                    <span className="add-data-menu__item-icon" aria-hidden>
                      <Icon size={16} strokeWidth={2.25} />
                    </span>
                    <span className="add-data-menu__item-copy">
                      <span className="add-data-menu__item-title">{item.title}</span>
                      <span className="add-data-menu__item-desc">
                        {item.description}
                      </span>
                    </span>
                    <ChevronRight
                      size={15}
                      className="add-data-menu__item-chevron"
                      aria-hidden
                    />
                  </button>
                );
              })}
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
      {variant === "sticky" ? (
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => onOpenChange(!open)}
          className="values-sticky-add-btn"
        >
          <span className="values-sticky-add-btn__icon">
            <Plus size={15} strokeWidth={2.5} />
          </span>
          <span>{labels.menuHeading}</span>
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={labels.menuHeading}
          title={labels.menuHeading}
          onClick={() => onOpenChange(!open)}
          className="values-toolbar-btn values-toolbar-btn--accent"
        >
          <Plus size={16} />
        </button>
      )}

      {menuOverlay}
    </div>
  );
}
