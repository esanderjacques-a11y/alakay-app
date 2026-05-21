import en from "./en";
import es from "./es";
import fr from "./fr";
import ht from "./ht";
import pt from "./pt";
import sw from "./sw";

export type Language = "en" | "es" | "fr" | "ht" | "pt" | "sw";

export const translations = {
  en,
  es,
  fr,
  ht,
  pt,
  sw,
} as const;

export type Translation = typeof en;

export { formatMessage } from "./format";
