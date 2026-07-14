"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";

export type MenuSelectOption<T extends string = string> = {
  value: T;
  label: string;
  description?: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  disabled?: boolean;
};

type Props<T extends string> = {
  label?: string;
  heading?: string;
  value: T;
  options: Array<MenuSelectOption<T> | [T, string]>;
  onChange: (value: T) => void;
  compact?: boolean;
  fullWidth?: boolean;
  /** Form-field wrapper (calc labels / full-width trigger). */
  variant?: "default" | "field" | "chip";
  className?: string;
  triggerClassName?: string;
  placeholder?: string;
  disabled?: boolean;
};

function normalizeOptions<T extends string>(
  options: Array<MenuSelectOption<T> | [T, string]>
): MenuSelectOption<T>[] {
  return options.map((option) =>
    Array.isArray(option)
      ? { value: option[0], label: option[1] }
      : option
  );
}

export default function MenuSelect<T extends string>({
  label,
  heading,
  value,
  options,
  onChange,
  compact = false,
  fullWidth = false,
  variant = "default",
  className = "",
  triggerClassName = "",
  placeholder,
  disabled = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<CSSProperties>({});
  const [canPortal, setCanPortal] = useState(false);
  const normalized = normalizeOptions(options);
  const selected = normalized.find((option) => option.value === value);

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
      const viewportWidth = window.innerWidth;
      const estimatedHeight = Math.min(320, 56 + normalized.length * 56);
      const spaceBelow = viewportHeight - rect.bottom - padding;
      const spaceAbove = rect.top - padding;
      const openAbove = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
      const width = Math.min(
        Math.max(rect.width, variant === "chip" ? 160 : 240),
        viewportWidth - padding * 2
      );
      const left = Math.min(
        Math.max(padding, rect.left),
        viewportWidth - width - padding
      );

      setMenuStyle({
        position: "fixed",
        left,
        width,
        zIndex: 19000,
        maxHeight: Math.min(
          320,
          openAbove ? spaceAbove : spaceBelow
        ),
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
  }, [normalized.length, open, variant]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menuRef.current?.contains(target)) return;
      if (overlayRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const isField = variant === "field";
  const isChip = variant === "chip";

  const trigger = (
    <button
      ref={triggerRef}
      type="button"
      disabled={disabled}
      aria-expanded={open}
      aria-haspopup="listbox"
      onClick={() => {
        if (!disabled) setOpen((previous) => !previous);
      }}
      className={
        isChip
          ? `values-unit-chip values-unit-chip--select app-menu-select-trigger--chip ${
              compact ? "values-unit-chip--compact" : ""
            } ${open ? "is-open" : ""} ${triggerClassName}`
          : `app-menu-select-trigger flex w-full items-center justify-between gap-2 text-left outline-none transition ${
              compact
                ? "settings-menu-trigger--compact min-h-8 rounded-lg px-2.5 text-sm"
                : isField
                  ? "calc-field-input min-h-10 rounded-xl px-3 text-sm"
                  : "min-h-11 rounded-2xl px-3 text-sm"
            } ${fullWidth ? "w-full" : ""} ${triggerClassName}`
      }
    >
      {isChip ? (
        <>
          <span className="values-unit-chip__label">
            {selected?.label || placeholder || ""}
          </span>
          <ChevronDown
            size={14}
            className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </>
      ) : (
        <>
          <span className="truncate font-semibold">
            {selected?.label || placeholder || ""}
          </span>
          <ChevronDown
            size={18}
            className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
            aria-hidden
          />
        </>
      )}
    </button>
  );

  const menuOverlay =
    presence.mounted && canPortal
      ? createPortal(
          <div ref={overlayRef} className="app-menu-select-overlay">
            <button
              type="button"
              aria-label="Close menu"
              className={`dismiss-backdrop ${
                presence.leaving ? "animate-fade-out" : "animate-fade-in"
              }`}
              onClick={() => setOpen(false)}
            />
            <section
              ref={menuRef}
              role="listbox"
              aria-label={heading || label || "Options"}
              className={`add-data-menu app-menu-select-menu app-menu-select-menu--portal ${
                presence.leaving ? "animate-scale-out" : "animate-scale-in"
              }`}
              style={menuStyle}
            >
              {heading ? (
                <p className="add-data-menu__heading">{heading}</p>
              ) : null}
              <div className="app-menu-select-menu__scroll max-h-full overflow-y-auto">
                {normalized.map((option) => {
                  const isSelected = option.value === value;
                  const Icon = option.icon;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={option.disabled}
                      className={`add-data-menu__item app-menu-select-option ${
                        !Icon ? "app-menu-select-option--plain" : ""
                      } ${
                        isSelected ? "app-menu-select-option-active is-selected" : ""
                      }`}
                      onClick={() => {
                        if (option.disabled) return;
                        onChange(option.value);
                        setOpen(false);
                      }}
                    >
                      {Icon ? (
                        <span className="add-data-menu__item-icon" aria-hidden>
                          <Icon size={16} strokeWidth={2.25} />
                        </span>
                      ) : null}
                      <span className="add-data-menu__item-copy">
                        <span className="add-data-menu__item-title">
                          {option.label}
                        </span>
                        {option.description ? (
                          <span className="add-data-menu__item-desc">
                            {option.description}
                          </span>
                        ) : null}
                      </span>
                      {isSelected ? (
                        <Check
                          size={15}
                          className="add-data-menu__item-chevron"
                          aria-hidden
                        />
                      ) : (
                        <ChevronRight
                          size={15}
                          className="add-data-menu__item-chevron"
                          aria-hidden
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>,
          document.body
        )
      : null;

  const shellClass = [
    isField ? "calc-field-label grid gap-1" : "settings-field",
    compact && !isField ? "settings-field--compact" : "",
    fullWidth ? "col-span-full w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isChip) {
    return (
      <div className={`relative inline-flex ${open ? "z-[19000]" : ""} ${className}`}>
        {trigger}
        {menuOverlay}
      </div>
    );
  }

  return (
    <div className={shellClass}>
      {label ? (
        isField ? (
          label
        ) : (
          <span className="settings-field__label">{label}</span>
        )
      ) : null}
      <div className={`relative ${open ? "z-[19000]" : "z-0"}`}>
        {trigger}
        {menuOverlay}
      </div>
    </div>
  );
}
