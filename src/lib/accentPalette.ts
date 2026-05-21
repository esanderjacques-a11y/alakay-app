import type { AccentColor } from "@/lib/appSettings";
import type { AppTheme } from "@/lib/uiPreferences";

type Hsl = { h: number; s: number; l: number };

export type AccentScale = Record<
  "50" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900" | "950",
  string
>;

const ACCENT_SEEDS: Record<AccentColor, Hsl> = {
  green: { h: 142, s: 64, l: 36 },
  teal: { h: 173, s: 80, l: 32 },
  blue: { h: 221, s: 83, l: 48 },
  amber: { h: 32, s: 95, l: 44 },
  rose: { h: 347, s: 77, l: 42 },
  violet: { h: 263, s: 70, l: 50 },
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
  const seed = ACCENT_SEEDS[accent];

  return {
    50: hsl({ h: seed.h, s: clamp(seed.s * 0.32, 18, 100), l: 97 }),
    100: hsl({ h: seed.h, s: clamp(seed.s * 0.42, 22, 100), l: 94 }),
    200: hsl({ h: seed.h, s: clamp(seed.s * 0.52, 26, 100), l: 86 }),
    300: hsl({ h: seed.h, s: clamp(seed.s * 0.68, 30, 100), l: 72 }),
    400: hsl({ h: seed.h, s: seed.s, l: clamp(seed.l + 14, 8, 92) }),
    500: hsl({ h: seed.h, s: seed.s, l: clamp(seed.l + 8, 8, 90) }),
    600: hsl({ h: seed.h, s: seed.s, l: clamp(seed.l + 4, 6, 88) }),
    700: hsl(seed),
    800: hsl({ h: seed.h, s: seed.s, l: clamp(seed.l - 8, 4, 80) }),
    900: hsl({ h: seed.h, s: clamp(seed.s * 0.96, 0, 100), l: clamp(seed.l - 16, 4, 72) }),
    950: hsl({ h: seed.h, s: clamp(seed.s * 0.92, 0, 100), l: clamp(seed.l - 22, 4, 68) }),
  };
}

function withAlpha(hslColor: string, alpha: number) {
  return hslColor.replace("hsl(", "hsla(").replace(")", ` / ${alpha})`);
}

export function buildAccentCssVariables(accent: AccentColor, theme: AppTheme) {
  const scale = buildAccentScale(accent);
  const seed = ACCENT_SEEDS[accent];
  const glow = hslToRgbParts(seed);
  const isDark = theme === "dark";

  const primary = isDark ? scale[400] : scale[700];
  const primaryDark = isDark ? scale[300] : scale[800];
  const surface = isDark
    ? `hsl(${seed.h} 24% 9%)`
    : scale[50];
  const foreground = isDark ? scale[50] : scale[950];

  const bodyGradient = isDark
    ? `radial-gradient(circle at 18% 10%, ${withAlpha(scale[400], 0.2)}, transparent 28%), radial-gradient(circle at 82% 18%, ${withAlpha(scale[300], 0.14)}, transparent 30%), linear-gradient(145deg, hsl(${seed.h} 28% 10%) 0%, hsl(${seed.h} 30% 12%) 48%, hsl(${seed.h} 22% 14%) 100%)`
    : `linear-gradient(145deg, ${scale[100]} 0%, ${scale[50]} 35%, #ffffff 70%, ${scale[100]} 100%)`;

  const mainGradient = isDark
    ? `linear-gradient(180deg, ${withAlpha(scale[900], 0.94)} 0%, ${withAlpha(scale[800], 0.94)} 56%, hsl(${seed.h} 24% 14% / 0.94) 100%), repeating-linear-gradient(112deg, ${withAlpha(scale[400], 0.08)} 0 1px, transparent 1px 24px), repeating-linear-gradient(168deg, ${withAlpha(scale[300], 0.05)} 0 1px, transparent 1px 30px), radial-gradient(ellipse at 50% 12%, ${withAlpha(scale[400], 0.2)}, transparent 42%), linear-gradient(135deg, hsl(${seed.h} 32% 12%) 0%, hsl(${seed.h} 34% 14%) 50%, hsl(${seed.h} 26% 16%) 100%)`
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
    "--alakay-green": primary,
    "--alakay-green-dark": primaryDark,
    "--background": surface,
    "--foreground": foreground,
    "--glass-border": isDark
      ? withAlpha(scale[300], 0.26)
      : withAlpha(scale[200], 0.85),
    "--glass-shadow": isDark
      ? `0 18px 52px rgba(${glow.r}, ${glow.g}, ${glow.b}, 0.22)`
      : `0 8px 32px rgba(${glow.r}, ${glow.g}, ${glow.b}, 0.14)`,
    "--body-gradient": bodyGradient,
    "--app-main-gradient": mainGradient,
    "--auth-page-gradient": authGradient,
    "--accent-glow-rgb": `${glow.r} ${glow.g} ${glow.b}`,
    "--accent-ring": withAlpha(scale[600], 0.22),
    "--accent-surface-tint": isDark
      ? withAlpha(scale[800], 0.55)
      : withAlpha(scale[100], 0.72),
  };

  return vars;
}

export function applyAccentTheme(accent: AccentColor, theme: AppTheme) {
  if (typeof document === "undefined") return;

  document.documentElement.dataset.accent = accent;
  const variables = buildAccentCssVariables(accent, theme);

  for (const [name, value] of Object.entries(variables)) {
    document.documentElement.style.setProperty(name, value);
  }
}
