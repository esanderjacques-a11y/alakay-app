"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { useDismissible } from "@/hooks/useDismissible";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label?: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
  compact?: boolean;
};

export default function MenuSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  compact = false,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value);

  useDismissible(open, () => setOpen(false), menuRef);

  return (
    <div className={`settings-field ${compact ? "settings-field--compact" : ""}`}>
      {label ? <span className="settings-field__label">{label}</span> : null}
      <div ref={menuRef} className={`relative ${open ? "z-[12000]" : "z-0"}`}>
        {presence.mounted ? (
          <button
            type="button"
            aria-label="Close menu"
            className={`dismiss-backdrop ${presence.leaving ? "animate-fade-out" : "animate-fade-in"}`}
            onClick={() => setOpen(false)}
          />
        ) : null}
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
          className={`app-menu-select-trigger flex w-full items-center justify-between gap-2 text-left outline-none transition ${
            compact
              ? "settings-menu-trigger--compact min-h-8 rounded-lg px-2.5 text-sm"
              : "min-h-11 rounded-2xl px-3 text-sm"
          }`}
        >
          <span className="truncate font-semibold">{selected?.label ?? ""}</span>
          <ChevronDown
            size={18}
            className={`shrink-0 transition ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        {presence.mounted ? (
          <section
            className={`app-menu-select-menu absolute inset-x-0 top-full z-[12001] mt-2 overflow-hidden p-2 ${
              presence.leaving ? "animate-scale-out" : "animate-scale-in"
            }`}
          >
            <div className="max-h-72 overflow-y-auto pr-1">
              {options.map((option) => {
                const isSelected = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={`app-menu-select-option flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                      isSelected ? "app-menu-select-option-active" : ""
                    }`}
                  >
                    <span className="whitespace-nowrap">{option.label}</span>
                    {isSelected ? (
                      <Check size={16} className="shrink-0" aria-hidden="true" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
