import { applyAccentTheme as applyAccentPalette } from "@/lib/accentPalette";
import { getSettings } from "@/lib/appSettings";
import type { AccentColor, AppFontPreference, AppThemePreference } from "@/lib/appSettings";
import type { Language } from "@/lib/translations";

export type { AccentColor, AppFontPreference } from "@/lib/appSettings";

export type AppTheme = "light" | "dark";
export type DarkVariant = "classic" | "black";

const LANGUAGE_KEY = "cultosol-language";
const THEME_KEY = "cultosol-theme";
const THEME_VARIANT_KEY = "cultosol-theme-variant";

export function resolveThemePreference(
  preference: AppThemePreference
): AppTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if (preference === "dark_black") return "dark";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveDarkVariantPreference(
  preference: AppThemePreference
): DarkVariant {
  return preference === "dark_black" ? "black" : "classic";
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

export function readStoredDarkVariant(): DarkVariant {
  if (typeof window === "undefined") return "classic";

  const preference = getSettings().general.theme;
  if (preference === "dark_black") return "black";

  const legacyVariant = window.localStorage.getItem(THEME_VARIANT_KEY);
  if (legacyVariant === "black" || legacyVariant === "classic") {
    return legacyVariant;
  }

  return "classic";
}

export function persistLanguage(language: Language) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LANGUAGE_KEY, language);
}

export function persistTheme(theme: AppTheme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, theme);
}

function persistThemeVariant(variant: DarkVariant) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_VARIANT_KEY, variant);
}

export function applyTheme(theme: AppTheme, darkVariant: DarkVariant = readStoredDarkVariant()) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
  document.documentElement.dataset.darkVariant = theme === "dark" ? darkVariant : "classic";
  persistTheme(theme);
  persistThemeVariant(darkVariant);
  applyVisualTone();
}

export function applyAccentColor(
  accent: AccentColor,
  theme: AppTheme = readStoredTheme(),
  darkVariant: DarkVariant = readStoredDarkVariant()
) {
  applyAccentPalette(accent, theme, darkVariant);
}

export function readStoredAccent(): AccentColor {
  const accent = getSettings().general.accentColor;
  if (
    accent === "green" ||
    accent === "teal" ||
    accent === "blue" ||
    accent === "amber" ||
    accent === "yellow" ||
    accent === "rose" ||
    accent === "violet" ||
    accent === "cyan" ||
    accent === "lime" ||
    accent === "orange" ||
    accent === "brown" ||
    accent === "fuchsia"
  ) {
    return accent;
  }
  return "green";
}

export function readStoredBrightness() {
  const brightness = getSettings().general.brightness;
  return Math.min(100, Math.max(70, Number(brightness) || 100));
}

export function readStoredSaturation() {
  const saturation = getSettings().general.saturation;
  return Math.min(100, Math.max(70, Number(saturation) || 100));
}

export function readStoredContrast() {
  const contrast = getSettings().general.contrast;
  return Math.min(100, Math.max(70, Number(contrast) || 100));
}

const TONE_MIN = 70;
const TONE_MAX = 100;

function clampToneInput(value: number) {
  return Math.min(TONE_MAX, Math.max(TONE_MIN, Number(value) || TONE_MAX));
}

/** Map 70–100 slider to a stronger perceptual filter range. */
function toneBrightnessFilter(value: number) {
  const v = clampToneInput(value);
  const t = (v - TONE_MIN) / (TONE_MAX - TONE_MIN);
  return 0.76 + t * 0.48;
}

function toneSaturationFilter(value: number) {
  const v = clampToneInput(value);
  const t = (v - TONE_MIN) / (TONE_MAX - TONE_MIN);
  return 0.62 + t * 0.58;
}

function toneContrastFilter(value: number) {
  const v = clampToneInput(value);
  const t = (v - TONE_MIN) / (TONE_MAX - TONE_MIN);
  return 0.8 + t * 0.42;
}

export function applyBrightness(brightness: number) {
  if (typeof document === "undefined") return;
  const nextBrightness = clampToneInput(brightness);
  document.documentElement.style.setProperty(
    "--app-brightness",
    String(toneBrightnessFilter(nextBrightness))
  );
  document.documentElement.dataset.brightness = String(nextBrightness);
}

export function applySaturation(saturation: number) {
  if (typeof document === "undefined") return;
  const nextSaturation = clampToneInput(saturation);
  document.documentElement.style.setProperty(
    "--app-saturation",
    String(toneSaturationFilter(nextSaturation))
  );
  document.documentElement.dataset.saturation = String(nextSaturation);
}

export function applyContrast(contrast: number) {
  if (typeof document === "undefined") return;
  const nextContrast = clampToneInput(contrast);
  document.documentElement.style.setProperty(
    "--app-contrast",
    String(toneContrastFilter(nextContrast))
  );
  document.documentElement.dataset.contrast = String(nextContrast);
}

export function applyGlassUi(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.glassUi = enabled ? "true" : "false";
  document.documentElement.style.setProperty(
    "--app-blur",
    enabled ? "1" : "0"
  );
}

export function readStoredGlassUi() {
  return getSettings().general.glassUi !== false;
}

export function readStoredAppFont(): AppFontPreference {
  const font = getSettings().general.appFont;
  if (
    font === "nunito" ||
    font === "source_sans" ||
    font === "dm_sans" ||
    font === "manrope"
  ) {
    return font;
  }
  return "system";
}

export function applyAppFont(font: AppFontPreference = readStoredAppFont()) {
  if (typeof document === "undefined") return;
  const next =
    font === "nunito" ||
    font === "source_sans" ||
    font === "dm_sans" ||
    font === "manrope"
      ? font
      : "system";
  document.documentElement.dataset.appFont = next;
}

export function applyVisualTone() {
  applyBrightness(readStoredBrightness());
  applySaturation(readStoredSaturation());
  applyContrast(readStoredContrast());
  applyGlassUi(readStoredGlassUi());
  applyAppFont(readStoredAppFont());
}
