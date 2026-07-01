import type { Language } from "@/lib/i18n";
import { formatMessage } from "@/lib/i18n/format";

export const languageLocales: Record<Language, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  ht: "ht-HT",
  pt: "pt-BR",
  sw: "sw-TZ",
};

export function formatMonthYear(isoDate: string, language: Language): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat(languageLocales[language] || "en-US", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatLastUpdate(
  template: string,
  isoDate: string,
  language: Language
): string {
  return formatMessage(template, { date: formatMonthYear(isoDate, language) });
}
