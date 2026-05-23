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

export function buildAccentScale(accent: AccentColor): AccentScale {
  const scale = buildAccentHslScale(accent);

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
  const hslScale = buildAccentHslScale(accent);
  const scale = buildAccentScale(accent);
  const seed = ACCENT_SEEDS[accent];
  const glow = hslToRgbParts(seed);
  const isDark = theme === "dark";
  const isBlackDark = isDark && darkVariant === "black";
  const darkBase = isBlackDark ? "hsl(0 0% 2%)" : `hsl(${seed.h} 24% 10%)`;
  const darkSurface = isBlackDark ? "hsl(0 0% 7%)" : `hsl(${seed.h} 20% 14%)`;
  const darkSurfaceRaised = isBlackDark ? "hsl(0 0% 11%)" : `hsl(${seed.h} 18% 18%)`;
  const darkBorder = isBlackDark ? "rgb(255 255 255 / 0.16)" : "rgb(255 255 255 / 0.2)";
  const darkMuted = isBlackDark ? "rgb(230 230 230 / 0.74)" : "rgb(233 239 236 / 0.82)";

  const primary = isDark ? scale[400] : scale[700];
  const primaryDark = isDark ? scale[300] : scale[800];
  const surface = isDark ? darkBase : scale[50];
  const foreground = isDark ? "#ffffff" : scale[950];

  const bodyGradient = isDark
    ? isBlackDark
      ? `radial-gradient(circle at 16% 8%, ${withAlpha(scale[400], 0.18)}, transparent 32%), radial-gradient(circle at 84% 14%, ${withAlpha(scale[300], 0.1)}, transparent 34%), linear-gradient(145deg, hsl(0 0% 2%) 0%, hsl(0 0% 4%) 52%, hsl(0 0% 6%) 100%)`
      : `radial-gradient(circle at 14% 10%, ${withAlpha(scale[300], 0.2)}, transparent 32%), radial-gradient(circle at 82% 16%, ${withAlpha(scale[500], 0.12)}, transparent 36%), linear-gradient(145deg, ${darkBase} 0%, ${darkSurface} 48%, ${darkSurfaceRaised} 100%)`
    : `linear-gradient(145deg, ${scale[100]} 0%, ${scale[50]} 35%, #ffffff 70%, ${scale[100]} 100%)`;

  const mainGradient = isDark
    ? isBlackDark
      ? `linear-gradient(180deg, rgb(14 14 14 / 0.94) 0%, rgb(10 10 10 / 0.96) 56%, rgb(7 7 7 / 0.96) 100%), repeating-linear-gradient(112deg, ${withAlpha(scale[400], 0.07)} 0 1px, transparent 1px 24px), repeating-linear-gradient(168deg, ${withAlpha(scale[300], 0.04)} 0 1px, transparent 1px 30px), radial-gradient(ellipse at 50% 12%, ${withAlpha(scale[400], 0.16)}, transparent 42%), linear-gradient(135deg, rgb(12 12 12 / 0.95) 0%, rgb(18 18 18 / 0.92) 46%, rgb(8 8 8 / 0.95) 100%)`
      : `linear-gradient(180deg, ${withAlpha(darkSurface, 0.94)} 0%, ${withAlpha(darkBase, 0.96)} 56%, ${withAlpha(darkSurfaceRaised, 0.94)} 100%), repeating-linear-gradient(112deg, ${withAlpha(scale[300], 0.1)} 0 1px, transparent 1px 24px), repeating-linear-gradient(168deg, ${withAlpha(scale[400], 0.06)} 0 1px, transparent 1px 30px), radial-gradient(ellipse at 50% 12%, ${withAlpha(scale[400], 0.18)}, transparent 42%), linear-gradient(135deg, ${withAlpha(darkBase, 0.96)} 0%, ${withAlpha(darkSurface, 0.94)} 46%, ${withAlpha(darkSurfaceRaised, 0.94)} 100%)`
    : `linear-gradient(180deg, ${withAlpha(scale[100], 0.78)} 0%, ${withAlpha(scale[50], 0.78)} 54%, ${withAlpha(scale[100], 0.84)} 100%), repeating-linear-gradient(112deg, ${withAlpha(scale[700], 0.1)} 0 1px, transparent 1px 24px), repeating-linear-gradient(168deg, ${withAlpha(scale[600], 0.06)} 0 1px, transparent 1px 30px), radial-gradient(ellipse at 50% 14%, rgba(255, 255, 255, 0.58), transparent 42%), linear-gradient(135deg, ${scale[50]} 0%, ${scale[100]} 46%, ${scale[50]} 100%)`;

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
    "--glass-border": isDark
      ? darkBorder
      : withAlpha(scale[200], 0.85),
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
