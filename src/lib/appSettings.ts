import type { Language } from "@/lib/translations";

export const APP_SETTINGS_STORAGE_KEY = "cultosol_app_settings";

export type AppThemePreference = "system" | "light" | "dark";
export type AppFontPreference =
  | "system"
  | "nunito"
  | "source_sans"
  | "dm_sans"
  | "manrope";
export type AccentColor =
  | "green"
  | "teal"
  | "blue"
  | "amber"
  | "yellow"
  | "rose"
  | "violet"
  | "cyan"
  | "lime"
  | "orange"
  | "brown"
  | "fuchsia";
export type DefaultSampleType = "soil" | "foliar" | "both";
export type DefaultCrop =
  | "banana"
  | "coffee"
  | "maize"
  | "rice"
  | "tomato"
  | "sweet_pepper";
export type InterpretationMethod =
  | "sufficiency_range"
  | "dop"
  | "custom_range";
export type WarningSensitivity = "flexible" | "normal" | "strict";
export type DefaultImportType = "pdf" | "excel" | "csv" | "image";
export type AiReader =
  | "automatic"
  | "openai_vision"
  | "manual_review";
export type DefaultExportFormat = "pdf" | "excel" | "csv";
/** Lifetime software license tier — gates app features (not AI). */
export type PlanTier = "free" | "plus" | "pro";

export type AppSettings = {
  general: {
    language: Language;
    theme: AppThemePreference;
    brightness: number;
    saturation: number;
    contrast: number;
    appFontSizeDelta: number;
    appFont: AppFontPreference;
    accentColor: AccentColor;
    defaultSampleType: DefaultSampleType;
    defaultCrop: DefaultCrop;
    glassUi: boolean;
  };
  analysis: {
    interpretationMethod: InterpretationMethod;
    warningSensitivity: WarningSensitivity;
    enableNutrientRatios: boolean;
    enablePhWarnings: boolean;
    showCalculatorFormulas: boolean;
  };
  billing: {
    planTier: PlanTier;
  };
  importAi: {
    defaultImportType: DefaultImportType;
    aiReader: AiReader;
    requireReviewBeforeSaving: boolean;
    aiConfidenceThreshold: number;
  };
  reports: {
    defaultExportFormat: DefaultExportFormat;
    includeLogo: boolean;
    includeSummary: boolean;
    includeCharts: boolean;
    includeHorizontalResultGraph: boolean;
    includeOriginalLabValues: boolean;
    includeCalculationValues: boolean;
    includeDopInReport: boolean;
    includeNutrientRatiosInReport: boolean;
  };
  data: {
    autoSaveAnalyses: boolean;
    keepImportHistory: boolean;
    permanentDeleteDays: number;
    showParameterDetails: boolean;
    showParameterSymbolsOnly: boolean;
  };
};

export const defaultAppSettings: AppSettings = {
  general: {
    language: "en",
    theme: "system",
    brightness: 100,
    saturation: 100,
    contrast: 100,
    appFontSizeDelta: 0,
    appFont: "system",
    accentColor: "green",
    defaultSampleType: "soil",
    defaultCrop: "banana",
    glassUi: true,
  },
  analysis: {
    interpretationMethod: "sufficiency_range",
    warningSensitivity: "normal",
    enableNutrientRatios: true,
    enablePhWarnings: true,
    showCalculatorFormulas: false,
  },
  billing: {
    planTier: "free",
  },
  importAi: {
    defaultImportType: "pdf",
    aiReader: "automatic",
    requireReviewBeforeSaving: true,
    aiConfidenceThreshold: 80,
  },
  reports: {
    defaultExportFormat: "pdf",
    includeLogo: true,
    includeSummary: true,
    includeCharts: true,
    includeHorizontalResultGraph: false,
    includeOriginalLabValues: true,
    includeCalculationValues: true,
    includeDopInReport: true,
    includeNutrientRatiosInReport: true,
  },
  data: {
    autoSaveAnalyses: true,
    keepImportHistory: true,
    permanentDeleteDays: 30,
    showParameterDetails: false,
    showParameterSymbolsOnly: false,
  },
};

export function getSettings(): AppSettings {
  if (typeof window === "undefined") return defaultAppSettings;

  try {
    const rawSettings = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY);
    if (!rawSettings) return defaultAppSettings;
    const parsedSettings = JSON.parse(rawSettings) as Partial<AppSettings>;
    return mergeSettings(parsedSettings);
  } catch {
    return defaultAppSettings;
  }
}

export function saveSettings(settings: AppSettings) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(APP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export function updateSetting<
  Section extends keyof AppSettings,
  Key extends keyof AppSettings[Section],
>(
  section: Section,
  key: Key,
  value: AppSettings[Section][Key]
): AppSettings {
  const nextSettings = {
    ...getSettings(),
    [section]: {
      ...getSettings()[section],
      [key]: value,
    },
  };
  saveSettings(nextSettings);
  return nextSettings;
}

export function resetSettings(): AppSettings {
  saveSettings(defaultAppSettings);
  return defaultAppSettings;
}

export const MAX_PERMANENT_DELETE_DAYS = 30;

function mergeSettings(settings: Partial<AppSettings>): AppSettings {
  const merged = {
    general: { ...defaultAppSettings.general, ...settings.general },
    analysis: { ...defaultAppSettings.analysis, ...settings.analysis },
    billing: { ...defaultAppSettings.billing, ...settings.billing },
    importAi: {
      ...defaultAppSettings.importAi,
      ...settings.importAi,
    },
    reports: { ...defaultAppSettings.reports, ...settings.reports },
    data: { ...defaultAppSettings.data, ...settings.data },
  };

  merged.data.permanentDeleteDays = Math.min(
    MAX_PERMANENT_DELETE_DAYS,
    Math.max(1, merged.data.permanentDeleteDays || MAX_PERMANENT_DELETE_DAYS)
  );
  const themePreference = merged.general.theme as AppThemePreference | "dark_black";
  merged.general.theme =
    themePreference === "light" || themePreference === "dark"
      ? themePreference
      : themePreference === "dark_black"
        ? "dark"
        : "system";
  if (
    merged.general.accentColor !== "green" &&
    merged.general.accentColor !== "teal" &&
    merged.general.accentColor !== "blue" &&
    merged.general.accentColor !== "amber" &&
    merged.general.accentColor !== "yellow" &&
    merged.general.accentColor !== "rose" &&
    merged.general.accentColor !== "violet" &&
    merged.general.accentColor !== "cyan" &&
    merged.general.accentColor !== "lime" &&
    merged.general.accentColor !== "orange" &&
    merged.general.accentColor !== "brown" &&
    merged.general.accentColor !== "fuchsia"
  ) {
    merged.general.accentColor = "green";
  }
  if (
    merged.importAi.aiReader !== "automatic" &&
    merged.importAi.aiReader !== "openai_vision" &&
    merged.importAi.aiReader !== "manual_review"
  ) {
    merged.importAi.aiReader = "automatic";
  }
  merged.importAi.aiConfidenceThreshold = Math.min(
    100,
    Math.max(50, Number(merged.importAi.aiConfidenceThreshold) || 80)
  );
  merged.general.brightness = Math.min(
    100,
    Math.max(70, Number(merged.general.brightness) || 100)
  );
  merged.general.saturation = Math.min(
    100,
    Math.max(70, Number(merged.general.saturation) || 100)
  );
  merged.general.contrast = Math.min(
    100,
    Math.max(70, Number(merged.general.contrast) || 100)
  );
  merged.general.glassUi = merged.general.glassUi !== false;
  merged.analysis.showCalculatorFormulas =
    merged.analysis.showCalculatorFormulas === true;
  const rawPlanTier = (settings.billing?.planTier ?? merged.billing.planTier) as string;
  if (rawPlanTier === "plus") merged.billing.planTier = "plus";
  else if (rawPlanTier === "pro" || rawPlanTier === "premium" || rawPlanTier === "business")
    merged.billing.planTier = "pro";
  else merged.billing.planTier = "free";
  merged.general.appFontSizeDelta = Math.min(
    3,
    Math.max(-2, Number(merged.general.appFontSizeDelta) || 0)
  );
  if (
    merged.general.appFont !== "system" &&
    merged.general.appFont !== "nunito" &&
    merged.general.appFont !== "source_sans" &&
    merged.general.appFont !== "dm_sans" &&
    merged.general.appFont !== "manrope"
  ) {
    merged.general.appFont = "system";
  }

  return merged;
}

export function getPermanentDeleteDays() {
  return Math.min(
    MAX_PERMANENT_DELETE_DAYS,
    Math.max(1, getSettings().data.permanentDeleteDays || MAX_PERMANENT_DELETE_DAYS)
  );
}

/** Formulas require an enabled setting and a paid plan tier. */
export function planAllowsCalculatorFormulas(planTier: PlanTier) {
  return planTier === "plus" || planTier === "pro";
}

export function planAllowsJacko(planTier: PlanTier) {
  return planTier === "plus" || planTier === "pro";
}

export function effectiveShowCalculatorFormulas(settings: AppSettings = getSettings()) {
  return (
    settings.analysis.showCalculatorFormulas &&
    planAllowsCalculatorFormulas(settings.billing.planTier)
  );
}

export function canUseJacko(
  settings: AppSettings = getSettings(),
  isAdmin = false
) {
  return isAdmin || planAllowsJacko(settings.billing.planTier);
}
