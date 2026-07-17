import { Language } from "@/lib/translations";

/** ISO 3166-1 alpha-2 codes for each app language locale. */
const flagCodes: Record<Language, string> = {
  en: "us",
  es: "es",
  fr: "fr",
  ht: "ht",
  pt: "br",
  sw: "tz",
};

type Props = {
  language: Language;
  size?: "sm" | "md";
  title?: string;
  className?: string;
};

export default function LanguageFlag({
  language,
  size = "md",
  title,
  className = "",
}: Props) {
  const code = flagCodes[language];

  return (
    <img
      src={`/flags/${code}.svg`}
      alt=""
      title={title}
      aria-hidden={title ? undefined : true}
      loading="lazy"
      decoding="async"
      draggable={false}
      className={`language-flag language-flag--${size} ${className}`.trim()}
    />
  );
}
