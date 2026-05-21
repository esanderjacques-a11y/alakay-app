import type { ComponentProps, JSX } from "react";
import US from "country-flag-icons/react/3x2/US";
import ES from "country-flag-icons/react/3x2/ES";
import FR from "country-flag-icons/react/3x2/FR";
import HT from "country-flag-icons/react/3x2/HT";
import BR from "country-flag-icons/react/3x2/BR";
import TZ from "country-flag-icons/react/3x2/TZ";
import { Language } from "@/lib/translations";

type FlagProps = ComponentProps<typeof US>;

const flags: Record<Language, (props: FlagProps) => JSX.Element> = {
  en: US,
  es: ES,
  fr: FR,
  ht: HT,
  pt: BR,
  sw: TZ,
};

type Props = {
  language: Language;
  size?: "sm" | "md";
  title?: string;
  className?: string;
};

const sizeClasses = {
  sm: "h-3.5 w-[1.3125rem]",
  md: "h-4 w-6",
};

export default function LanguageFlag({
  language,
  size = "md",
  title,
  className = "",
}: Props) {
  const Flag = flags[language];

  return (
    <Flag
      title={title}
      aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 overflow-hidden rounded-[3px] shadow-sm ring-1 ring-green-200/80 ${sizeClasses[size]} ${className}`}
    />
  );
}
