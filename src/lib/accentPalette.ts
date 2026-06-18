import type { AccentColor } from "@/lib/appSettings";
import type { AppTheme, DarkVariant } from "@/lib/uiPreferences";

type Hsl = { h: number; s: number; l: number };

export type AccentScale = Record<
  "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950",
  string
>;

type AccentHslScale = Record<keyof AccentScale, Hsl>;

const ACCENT_SEEDS: Record<AccentColor, Hsl> = {
  green: { h: 142, s: 64, l: 36 },
  teal: { h: 173, s: 80, l: 32 },
  blue: { h: 221, s: 83, l: 48 },
  amber: { h: 32, s: 95, l: 44 },
  rose: { h: 347, s: 77, l: 42 },
  violet: { h: 263, s: 70, l: 50 },
  cyan: { h: 191, s: 86, l: 44 },
  lime: { h: 90, s: 78, l: 40 },
  orange: { h: 24, s: 92, l: 48 },
  fuchsia: { h: 300, s: 72, l: 44 },
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function hsl({ h, s, l }: Hsl) {
  return `hsl(${Math.round(h)} ${clamp(s, 0, 100)}% ${clamp(l, 0, 100)}%)`;
}

function hslToRgbParts({ h, s, l }: Hsl) {
  const sat = s / 100;
  const light = l / 100;
  const chroma = (1 - Math.abs(2 * light - 1)) * sat;
  const huePrime = h / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let r1 = 0;
  let g1 = 0;
  let b1 = 0;

  if (huePrime >= 0 && huePrime < 1) [r1, g1, b1] = [chroma, x, 0];
  else if (huePrime < 2) [r1, g1, b1] = [x, chroma, 0];
  else if (huePrime < 3) [r1, g1, b1] = [0, chroma, x];
  else if (huePrime < 4) [r1, g1, b1] = [0, x, chroma];
  else if (huePrime < 5) [r1, g1, b1] = [x, 0, chroma];
  else [r1, g1, b1] = [chroma, 0, x];

  const m = light - chroma / 2;
  return {
    r: Math.round((r1 + m) * 255),
    g: Math.round((g1 + m) * 255),
    b: Math.round((b1 + m) * 255),
  };
}

function buildDarkUiAccentScale(seed: Hsl): AccentHslScale {
  const hue = seed.h;

  return {
    50: { h: hue, s: 14, l: 94 },
    100: { h: hue, s: 18, l: 86 },
    200: { h: hue, s: 24, l: 74 },
    300: { h: hue, s: 34, l: 60 },
    400: { h: hue, s: 42, l: 52 },
    500: { h: hue, s: 46, l: 45 },
    600: { h: hue, s: 44, l: 39 },
    700: { h: hue, s: 40, l: 34 },
    800: { h: hue, s: 24, l: 21 },
    900: { h: hue, s: 18, l: 14 },
    950: { h: hue, s: 14, l: 9 },
  };
}

function hslScaleToCssScale(scale: AccentHslScale): AccentScale {
  return {
    50: hsl(scale[50]),
    100: hsl(scale[100]),
    200: hsl(scale[200]),
    300: hsl(scale[300]),
    400: hsl(scale[400]),
    500: hsl(scale[500]),
    600: hsl(scale[600]),
    700: hsl(scale[700]),
    800: hsl(scale[800]),
    900: hsl(scale[900]),
    950: hsl(scale[950]),
  };
}

export function buildAccentScale(accent: AccentColor, theme: AppTheme = "light"): AccentScale {
  const hslScale =
    theme === "dark" ? buildDarkUiAccentScale(ACCENT_SEEDS[accent]) : buildAccentHslScale(accent);

  return hslScaleToCssScale(hslScale);
}

function buildAccentHslScale(accent: AccentColor): AccentHslScale {
  const seed = ACCENT_SEEDS[accent];

  return {
    50: { h: seed.h, s: clamp(seed.s * 0.32, 18, 100), l: 97 },
    100: { h: seed.h, s: clamp(seed.s * 0.42, 22, 100), l: 94 },
    200: { h: seed.h, s: clamp(seed.s * 0.52, 26, 100), l: 86 },
    300: { h: seed.h, s: clamp(seed.s * 0.68, 30, 100), l: 72 },
    400: { h: seed.h, s: seed.s, l: clamp(seed.l + 14, 8, 92) },
    500: { h: seed.h, s: seed.s, l: clamp(seed.l + 8, 8, 90) },
    600: { h: seed.h, s: seed.s, l: clamp(seed.l + 4, 6, 88) },
    700: seed,
    800: { h: seed.h, s: seed.s, l: clamp(seed.l - 8, 4, 80) },
    900: { h: seed.h, s: clamp(seed.s * 0.96, 0, 100), l: clamp(seed.l - 16, 4, 72) },
    950: { h: seed.h, s: clamp(seed.s * 0.92, 0, 100), l: clamp(seed.l - 22, 4, 68) },
  };
}

function rgbParts(value: Hsl) {
  const { r, g, b } = hslToRgbParts(value);
  return `${r} ${g} ${b}`;
}

function withAlpha(hslColor: string, alpha: number) {
  return hslColor.replace("hsl(", "hsla(").replace(")", ` / ${alpha})`);
}

export function buildAccentCssVariables(
  accent: AccentColor,
  theme: AppTheme,
  darkVariant: DarkVariant = "classic"
) {
  const isDark = theme === "dark";
  const hslScale = isDark
    ? buildDarkUiAccentScale(ACCENT_SEEDS[accent])
    : buildAccentHslScale(accent);
  const scale = hslScaleToCssScale(hslScale);
  const seed = ACCENT_SEEDS[accent];
  const glow = hslToRgbParts(isDark ? hslScale[400] : seed);
  const isBlackDark = isDark && darkVariant === "black";
  const darkBase = isBlackDark ? "hsl(0 0% 5%)" : `hsl(${seed.h} 10% 7%)`;
  const darkSurface = isBlackDark ? "hsl(0 0% 9%)" : `hsl(${seed.h} 9% 11%)`;
  const darkSurfaceRaised = isBlackDark ? "hsl(0 0% 13%)" : `hsl(${seed.h} 10% 14%)`;
  const darkBorder = "rgb(255 255 255 / 0.14)";
  const darkMuted = "rgb(226 232 240 / 0.78)";

  const primary = isDark ? scale[400] : scale[700];
  const primaryDark = isDark ? scale[300] : scale[800];
  const surface = isDark ? darkBase : scale[50];
  const foreground = isDark ? "rgb(248 250 252)" : scale[950];

  const bodyGradient = isDark
    ? isBlackDark
      ? `radial-gradient(circle at 16% 8%, rgb(var(--accent-400-rgb) / 0.08), transparent 34%), radial-gradient(circle at 84% 14%, rgb(var(--accent-300-rgb) / 0.05), transparent 36%), linear-gradient(145deg, hsl(0 0% 4%) 0%, hsl(0 0% 6%) 52%, hsl(0 0% 8%) 100%)`
      : `radial-gradient(circle at 16% 10%, ${withAlpha(scale[400], 0.08)}, transparent 40%), radial-gradient(circle at 82% 18%, ${withAlpha(scale[300], 0.05)}, transparent 44%), linear-gradient(145deg, ${darkBase} 0%, ${darkSurface} 50%, ${darkSurfaceRaised} 100%)`
    : `linear-gradient(145deg, ${scale[100]} 0%, ${scale[50]} 35%, #ffffff 70%, ${scale[100]} 100%)`;

  const mainGradient = isDark
    ? isBlackDark
      ? `radial-gradient(ellipse 90% 55% at 18% 0%, rgb(var(--accent-400-rgb) / 0.12), transparent 52%), radial-gradient(ellipse 80% 50% at 88% 24%, rgb(var(--accent-300-rgb) / 0.08), transparent 50%), linear-gradient(180deg, rgb(12 12 12 / 0.96) 0%, rgb(8 8 8 / 0.98) 56%, rgb(6 6 6 / 0.98) 100%)`
      : `radial-gradient(ellipse 95% 60% at 12% -8%, ${withAlpha(scale[400], 0.14)}, transparent 54%), radial-gradient(ellipse 85% 55% at 92% 18%, ${withAlpha(scale[300], 0.1)}, transparent 52%), linear-gradient(180deg, ${withAlpha(darkSurface, 0.92)} 0%, ${withAlpha(darkBase, 0.96)} 56%, ${withAlpha(darkSurfaceRaised, 0.9)} 100%)`
    : `radial-gradient(ellipse 110% 75% at 8% -12%, ${withAlpha(scale[200], 0.58)}, transparent 52%), radial-gradient(ellipse 95% 65% at 96% 14%, ${withAlpha(scale[300], 0.42)}, transparent 54%), radial-gradient(ellipse 90% 55% at 50% 108%, ${withAlpha(scale[100], 0.72)}, transparent 50%), linear-gradient(165deg, ${scale[50]} 0%, ${withAlpha(scale[100], 0.88)} 36%, #f8fafc 58%, ${scale[50]} 100%)`;

  const authGradient = mainGradient;

  const vars: Record<string, string> = {
    "--accent-50": scale[50],
    "--accent-100": scale[100],
    "--accent-200": scale[200],
    "--accent-300": scale[300],
    "--accent-400": scale[400],
    "--accent-500": scale[500],
    "--accent-600": scale[600],
    "--accent-700": scale[700],
    "--accent-800": scale[800],
    "--accent-900": scale[900],
    "--accent-950": scale[950],
    "--accent-50-rgb": rgbParts(hslScale[50]),
    "--accent-100-rgb": rgbParts(hslScale[100]),
    "--accent-200-rgb": rgbParts(hslScale[200]),
    "--accent-300-rgb": rgbParts(hslScale[300]),
    "--accent-400-rgb": rgbParts(hslScale[400]),
    "--accent-500-rgb": rgbParts(hslScale[500]),
    "--accent-600-rgb": rgbParts(hslScale[600]),
    "--accent-700-rgb": rgbParts(hslScale[700]),
    "--accent-800-rgb": rgbParts(hslScale[800]),
    "--accent-900-rgb": rgbParts(hslScale[900]),
    "--accent-950-rgb": rgbParts(hslScale[950]),
    "--alakay-green": primary,
    "--alakay-green-dark": primaryDark,
    "--background": surface,
    "--foreground": foreground,
    "--dark-base": darkBase,
    "--dark-surface": darkSurface,
    "--dark-surface-raised": darkSurfaceRaised,
    "--dark-border": darkBorder,
    "--dark-muted": darkMuted,
    "--dark-panel-bg": isBlackDark ? "rgb(18 18 18 / 0.72)" : "rgb(255 255 255 / 0.04)",
    "--dark-panel-bg-strong": isBlackDark ? "rgb(24 24 24 / 0.8)" : "rgb(255 255 255 / 0.06)",
    "--dark-shell-top": isBlackDark ? "rgb(20 20 20 / 0.86)" : withAlpha(darkSurfaceRaised, 0.88),
    "--dark-shell-bottom": isBlackDark ? "rgb(13 13 13 / 0.78)" : withAlpha(darkBase, 0.94),
    "--dark-hover-top": isBlackDark ? "rgb(33 33 33 / 0.94)" : withAlpha(darkSurfaceRaised, 0.96),
    "--dark-hover-bottom": isBlackDark ? "rgb(18 18 18 / 0.9)" : withAlpha(darkSurface, 0.92),
    "--dark-disabled-bg": isBlackDark ? "rgb(14 14 14 / 0.72)" : "rgb(255 255 255 / 0.03)",
    "--auth-card-bg": isDark
      ? isBlackDark
        ? "linear-gradient(180deg, rgb(18 18 18 / 0.84), rgb(10 10 10 / 0.8))"
        : `linear-gradient(180deg, ${withAlpha(scale[900], 0.46)}, ${withAlpha(scale[950], 0.52)})`
      : "linear-gradient(180deg, rgb(255 255 255 / 0.46), rgb(248 252 250 / 0.38))",
    "--auth-card-border": isDark
      ? (isBlackDark ? "rgb(255 255 255 / 0.16)" : "rgb(255 255 255 / 0.18)")
      : "rgb(255 255 255 / 0.52)",
    "--auth-card-shadow": isDark
      ? (isBlackDark ? "0 20px 52px rgba(0, 0, 0, 0.48)" : "0 18px 44px rgba(0, 0, 0, 0.3)")
      : "0 18px 46px rgba(21, 128, 61, 0.12)",
    "--auth-chip-bg": isDark
      ? (isBlackDark ? "rgb(20 20 20 / 0.78)" : withAlpha(scale[900], 0.34))
      : "rgb(255 255 255 / 0.42)",
    "--auth-chip-border": isDark
      ? (isBlackDark ? "rgb(255 255 255 / 0.16)" : "rgb(255 255 255 / 0.2)")
      : "rgb(255 255 255 / 0.5)",
    "--glass-border": isDark
      ? darkBorder
      : withAlpha(scale[200], 0.85),
    "--glass-surface": isDark
      ? isBlackDark
        ? "rgb(18 18 18 / 0.72)"
        : withAlpha(darkSurfaceRaised, 0.74)
      : "rgb(var(--accent-50-rgb) / 0.68)",
    "--glass-surface-strong": isDark
      ? isBlackDark
        ? "rgb(24 24 24 / 0.82)"
        : withAlpha(darkSurface, 0.82)
      : "rgb(var(--accent-100-rgb) / 0.76)",
    "--glass-surface-muted": isDark
      ? "rgb(24 24 24 / 0.58)"
      : "rgb(var(--accent-100-rgb) / 0.52)",
    "--glass-chrome-surface": "var(--glass-surface)",
    "--glass-chrome-border": "var(--glass-border)",
    "--glass-shadow": isDark
      ? "0 20px 54px rgba(0, 0, 0, 0.52)"
      : `0 8px 32px rgba(${glow.r}, ${glow.g}, ${glow.b}, 0.14)`,
    "--body-gradient": bodyGradient,
    "--app-main-gradient": mainGradient,
    "--auth-page-gradient": authGradient,
    "--accent-glow-rgb": `${glow.r} ${glow.g} ${glow.b}`,
    "--accent-ring": isDark ? withAlpha(scale[500], 0.42) : withAlpha(scale[600], 0.22),
    "--accent-surface-tint": isDark
      ? "rgb(255 255 255 / 0.03)"
      : withAlpha(scale[100], 0.72),
  };

  return vars;
}

export function applyAccentTheme(
  accent: AccentColor,
  theme: AppTheme,
  darkVariant: DarkVariant = "classic"
) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.accent = accent;
  const variables = buildAccentCssVariables(accent, theme, darkVariant);

  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(name, value);
  }
}
