"use client";

import { useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import LanguageFlag from "@/components/LanguageFlag";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { useDismissible } from "@/hooks/useDismissible";
import { Language, translations } from "@/lib/translations";

type Props = {
  language: Language;
  onChange: (language: Language) => void;
  compact?: boolean;
};

const languageOptions: {
  code: Language;
  fullLabel: string;
}[] = [
  { code: "en", fullLabel: "English" },
  { code: "es", fullLabel: "Español" },
  { code: "fr", fullLabel: "Français" },
  { code: "ht", fullLabel: "Kreyòl" },
  { code: "pt", fullLabel: "Português" },
  { code: "sw", fullLabel: "Kiswahili" },
];

export default function LanguageSwitcher({
  language,
  onChange,
  compact = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const presence = useAnimatedPresence(open);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const t = translations[language];

  useDismissible(open, () => setOpen(false), menuRef);

  const current =
    languageOptions.find((item) => item.code === language) ||
    languageOptions[0];

  return (
    <>
      {presence.mounted ? (
        <button
          type="button"
          aria-label={t.close}
          className={`dismiss-backdrop ${presence.leaving ? "animate-fade-out" : "animate-fade-in"}`}
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div ref={menuRef} className="relative z-[13000]">
        <button
          type="button"
          onClick={() => setOpen((previous) => !previous)}
          aria-label={t.languageLabel}
          aria-expanded={open}
          title={current.fullLabel}
          className={`touch-target flex items-center border border-green-200/80 bg-white/90 shadow-sm active:scale-[0.98] ${
            compact
              ? "min-h-8 gap-1 rounded-xl px-2 py-1.5"
              : "gap-1.5 rounded-2xl px-2.5 py-2"
          }`}
        >
          <LanguageFlag language={current.code} size={compact ? "sm" : "md"} />
          <ChevronDown
            size={compact ? 12 : 14}
            className={`text-green-700 transition ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {presence.mounted ? (
          <section
            className={`absolute right-0 top-full z-[13001] mt-2 rounded-3xl glass-panel-strong shadow-2xl ${
              presence.leaving ? "animate-scale-out" : "animate-scale-in"
            } ${
              compact ? "w-48 p-2" : "w-56 p-3"
            }`}
          >
            <div className="grid gap-1">
              {languageOptions.map((item) => (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => {
                    onChange(item.code);
                    setOpen(false);
                  }}
                  className={`touch-target flex w-full items-center rounded-2xl text-left font-semibold active:scale-[0.98] ${
                    compact ? "gap-2 px-2.5 py-2 text-xs" : "gap-3 px-3 py-3 text-sm"
                  } ${
                    language === item.code
                      ? "bg-green-100 text-green-900"
                      : "text-slate-700 active:bg-slate-50"
                  }`}
                >
                  <LanguageFlag
                    language={item.code}
                    size={compact ? "sm" : "md"}
                    title={item.fullLabel}
                  />
                  <span>{item.fullLabel}</span>
                  {language === item.code ? (
                    <span className="ml-auto text-xs font-bold text-green-700">
                      ✓
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}


