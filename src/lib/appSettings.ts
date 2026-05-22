import type { Language } from "@/lib/translations";

export const APP_SETTINGS_STORAGE_KEY = "alakay_app_settings";

export type AppThemePreference = "system" | "light" | "dark";
export type AccentColor =
  | "green"
  | "teal"
  | "blue"
  | "amber"
  | "rose"
  | "violet";
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

export type AppSettings = {
  general: {
    language: Language;
    theme: AppThemePreference;
    brightness: number;
    appFontSizeDelta: number;
    accentColor: AccentColor;
    defaultSampleType: DefaultSampleType;
    defaultCrop: DefaultCrop;
  };
  analysis: {
    interpretationMethod: InterpretationMethod;
    warningSensitivity: WarningSensitivity;
    enableNutrientRatios: boolean;
    enablePhWarnings: boolean;
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
    appFontSizeDelta: 0,
    accentColor: "green",
    defaultSampleType: "soil",
    defaultCrop: "banana",
  },
  analysis: {
    interpretationMethod: "sufficiency_range",
    warningSensitivity: "normal",
    enableNutrientRatios: true,
    enablePhWarnings: true,
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
  merged.general.theme =
    merged.general.theme === "light" || merged.general.theme === "dark"
      ? merged.general.theme
      : "system";
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
    115,
    Math.max(85, Number(merged.general.brightness) || 100)
  );
  merged.general.appFontSizeDelta = Math.min(
    3,
    Math.max(-2, Number(merged.general.appFontSizeDelta) || 0)
  );

  return merged;
}

export function getPermanentDeleteDays() {
  return Math.min(
    MAX_PERMANENT_DELETE_DAYS,
    Math.max(1, getSettings().data.permanentDeleteDays || MAX_PERMANENT_DELETE_DAYS)
  );
}
