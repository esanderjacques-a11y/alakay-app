import { applyAccentTheme as applyAccentPalette } from "@/lib/accentPalette";
import { getSettings } from "@/lib/appSettings";
import type { AccentColor, AppFontPreference, AppThemePreference } from "@/lib/appSettings";
import type { Language } from "@/lib/translations";

export type { AccentColor, AppFontPreference } from "@/lib/appSettings";

export type AppTheme = "light" | "dark";
export type DarkVariant = "classic";

const LANGUAGE_KEY = "cultosol-language";
const THEME_KEY = "cultosol-theme";
const THEME_VARIANT_KEY = "cultosol-theme-variant";

export function resolveThemePreference(
  preference: AppThemePreference
): AppTheme {
  if (preference === "light") return "light";
  if (preference === "dark") return "dark";
  if ((preference as string) === "dark_black") return "dark";
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function resolveDarkVariantPreference(
  _preference: AppThemePreference
): DarkVariant {
  return "classic";
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
  darkVariant: DarkVariant = readStoredDarkVariant(),
  glassUi: boolean = readStoredGlassUi()
) {
  applyAccentPalette(accent, theme, darkVariant, glassUi);
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

function clampTonePercent(value: number) {
  return Math.min(100, Math.max(70, Number(value) || 100));
}

/**
 * Map a 70–100 slider % onto a CSS filter multiplier.
 * Mid-slider (~85) stays near neutral (1); 100% is a vivid boost.
 */
function toneMultiplier(percent: number, muted: number, vivid: number) {
  const pct = clampTonePercent(percent);
  const t = (pct - 70) / 30;
  return muted + t * (vivid - muted);
}

export function brightnessFilterValue(percent: number) {
  // Keep brightness linear: 70% → 0.7, 100% → 1.
  return clampTonePercent(percent) / 100;
}

export function saturationFilterValue(percent: number) {
  // 70 → 0.72 (soft), ~85 → 1.0 (neutral), 100 → 1.48 (vivid)
  return toneMultiplier(percent, 0.72, 1.48);
}

export function contrastFilterValue(percent: number) {
  // 70 → 0.86, ~85 → 1.0, 100 → 1.28 (punchier contrast)
  return toneMultiplier(percent, 0.86, 1.28);
}

export function readStoredBrightness() {
  return clampTonePercent(getSettings().general.brightness);
}

export function readStoredSaturation() {
  return clampTonePercent(getSettings().general.saturation);
}

export function readStoredContrast() {
  return clampTonePercent(getSettings().general.contrast);
}

export function applyBrightness(brightness: number) {
  if (typeof document === "undefined") return;
  const nextBrightness = clampTonePercent(brightness);
  document.documentElement.style.setProperty(
    "--app-brightness",
    String(brightnessFilterValue(nextBrightness))
  );
  document.documentElement.dataset.brightness = String(nextBrightness);
  syncVisualToneFilterFlag();
}

export function applySaturation(saturation: number) {
  if (typeof document === "undefined") return;
  const nextSaturation = clampTonePercent(saturation);
  document.documentElement.style.setProperty(
    "--app-saturation",
    String(saturationFilterValue(nextSaturation))
  );
  document.documentElement.dataset.saturation = String(nextSaturation);
  syncVisualToneFilterFlag();
}

export function applyContrast(contrast: number) {
  if (typeof document === "undefined") return;
  const nextContrast = clampTonePercent(contrast);
  document.documentElement.style.setProperty(
    "--app-contrast",
    String(contrastFilterValue(nextContrast))
  );
  document.documentElement.dataset.contrast = String(nextContrast);
  syncContrastPresentation();
  syncVisualToneFilterFlag();
}

/**
 * Light + glass: CSS contrast() blows pale washes toward white and hurts reading.
 * Use ink boost + slightly clearer glass instead; keep filter contrast for dark/flat.
 */
function syncContrastPresentation() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const pct = clampTonePercent(Number(root.dataset.contrast || 100));
  const filterContrast = contrastFilterValue(pct);
  const glassOn = root.dataset.glassUi !== "false";
  const isDark = root.dataset.theme === "dark";
  // 0 near neutral (~82%), 1 at slider max
  const ink = Math.max(0, Math.min(1, (pct - 82) / 18));

  root.style.setProperty("--app-contrast-ink", String(ink));

  if (glassOn && !isDark) {
    root.style.setProperty("--app-contrast-backdrop", "1");
    // Less milky panels as contrast rises (clearer glass, sharper type).
    root.style.setProperty("--app-glass-alpha", String(1 - ink * 0.34));
  } else {
    root.style.setProperty("--app-contrast-backdrop", String(filterContrast));
    root.style.setProperty("--app-glass-alpha", "1");
  }
}

/** Only enable the page-wide CSS filter when tone multipliers leave neutral (≈1).
 *  A no-op filter still rasterizes the whole UI and softens text on phones. */
function syncVisualToneFilterFlag() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const brightness = brightnessFilterValue(Number(root.dataset.brightness || 100));
  const saturation = saturationFilterValue(Number(root.dataset.saturation || 100));
  const contrastPct = clampTonePercent(Number(root.dataset.contrast || 100));
  const contrast = contrastFilterValue(contrastPct);
  const glassOn = root.dataset.glassUi !== "false";
  const isDark = root.dataset.theme === "dark";
  const ink = Math.max(0, Math.min(1, (contrastPct - 82) / 18));
  // Light glass uses ink/alpha vars (no contrast filter) — still flag custom when boosted.
  const custom =
    Math.abs(brightness - 1) > 0.01 ||
    Math.abs(saturation - 1) > 0.01 ||
    Math.abs(contrast - 1) > 0.01 ||
    (glassOn && !isDark && ink > 0.02);
  if (custom) root.dataset.visualTone = "custom";
  else delete root.dataset.visualTone;
}

export function applyGlassUi(
  enabled: boolean,
  options?: {
    accent?: AccentColor;
    theme?: AppTheme;
    darkVariant?: DarkVariant;
  }
) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.glassUi = enabled ? "true" : "false";
  document.documentElement.style.setProperty(
    "--app-blur",
    enabled ? "1" : "0"
  );
  /* Refresh glass surface tokens — accent palette owns inline CSS vars.
   * Prefer explicit draft values so live settings preview is not reset to
   * whatever is last saved. */
  applyAccentPalette(
    options?.accent ?? readStoredAccent(),
    options?.theme ?? readStoredTheme(),
    options?.darkVariant ?? readStoredDarkVariant(),
    enabled
  );
  /* Tone filter targets differ for glass vs flat — refresh which layer is filtered. */
  syncContrastPresentation();
  syncVisualToneFilterFlag();
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
