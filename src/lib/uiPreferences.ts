import { applyAccentTheme as applyAccentPalette } from "@/lib/accentPalette";
import { getSettings } from "@/lib/appSettings";
import type { AccentColor, AppThemePreference } from "@/lib/appSettings";
import type { Language } from "@/lib/translations";

export type { AccentColor } from "@/lib/appSettings";

export type AppTheme = "light" | "dark";

const LANGUAGE_KEY = "alakay-language";
const THEME_KEY = "alakay-theme";

export function resolveThemePreference(
  preference: AppThemePreference
): AppTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function readStoredLanguage(): Language {
  if (typeof window === "undefined") return "en";

  const settingsLanguage = getSettings().general.language;
  if (settingsLanguage) return settingsLanguage;

  const legacy = window.localStorage.getItem(LANGUAGE_KEY);
  if (
    legacy === "en" ||
    legacy === "es" ||
    legacy === "fr" ||
    legacy === "ht" ||
    legacy === "pt" ||
    legacy === "sw"
  ) {
    return legacy;
  }

  return "en";
}

export function readStoredTheme(): AppTheme {
  if (typeof window === "undefined") return "light";

  const preference = getSettings().general.theme;
  if (preference && preference !== "system") {
    return resolveThemePreference(preference);
  }

  const legacy = window.localStorage.getItem(THEME_KEY);
  if (legacy === "dark" || legacy === "light") {
    return legacy;
  }

  return resolveThemePreference(preference);
}

export function persistLanguage(language: Language) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_KEY, language);
}

export function persistTheme(theme: AppTheme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
}

export function applyTheme(theme: AppTheme) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  persistTheme(theme);
  applyBrightness(readStoredBrightness());
}

export function applyAccentColor(accent: AccentColor, theme: AppTheme = readStoredTheme()) {
  applyAccentPalette(accent, theme);
}

export function readStoredAccent(): AccentColor {
  const accent = getSettings().general.accentColor;
  if (
    accent === "green" ||
    accent === "teal" ||
    accent === "blue" ||
    accent === "amber" ||
    accent === "rose" ||
    accent === "violet"
  ) {
    return accent;
  }
  return "green";
}

export function readStoredBrightness() {
  const brightness = getSettings().general.brightness;
  return Math.min(115, Math.max(85, Number(brightness) || 100));
}

export function applyBrightness(brightness: number) {
  if (typeof document === "undefined") return;
  const nextBrightness = Math.min(115, Math.max(85, Number(brightness) || 100));
  document.documentElement.style.setProperty(
    "--app-brightness",
    String(nextBrightness / 100)
  );
  document.documentElement.dataset.brightness = String(nextBrightness);
}
