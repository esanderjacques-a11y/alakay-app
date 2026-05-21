"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Database,
  FileDown,
  FlaskConical,
  Globe2,
  Redo2,
  RotateCcw,
  Save,
  ScanLine,
  Undo2,
} from "lucide-react";
import { buildAccentScale } from "@/lib/accentPalette";
import type { Session } from "@supabase/supabase-js";
import {
  AppSettings,
  AccentColor,
  AppThemePreference,
  DefaultCrop,
  DefaultExportFormat,
  DefaultImportType,
  DefaultSampleType,
  getSettings,
  InterpretationMethod,
  MAX_PERMANENT_DELETE_DAYS,
  AiReader,
  resetSettings,
  saveSettings,
  WarningSensitivity,
} from "@/lib/appSettings";
import AccountSettingsSection from "@/components/AccountSettingsSection";
import type { Language } from "@/lib/translations";

type Props = {
  language: Language;
  session: Session | null;
  onBack: () => void;
  onLanguageChange: (language: Language) => void;
  onThemePreferenceChange: (theme: AppThemePreference) => void;
  onAccentChange: (accent: AccentColor) => void;
  onBrightnessChange: (brightness: number) => void;
};

function cloneSettings(settings: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(settings)) as AppSettings;
}

function settingsEqual(a: AppSettings, b: AppSettings) {
  return JSON.stringify(a) === JSON.stringify(b);
}

type SettingsText = {
  back: string;
  title: string;
  subtitle: string;
  saved: string;
  local: string;
  unsaved: string;
  save: string;
  undo: string;
  redo: string;
  reset: string;
  resetConfirm: string;
  sections: {
    general: string;
    account: string;
    analysis: string;
    importAi: string;
    reports: string;
    data: string;
  };
  labels: {
    language: string;
    theme: string;
    brightness: string;
    accentColor: string;
    defaultSampleType: string;
    defaultCrop: string;
    interpretationMethod: string;
    warningSensitivity: string;
    enableNutrientRatios: string;
    enablePhWarnings: string;
    defaultImportType: string;
    aiReader: string;
    requireReviewBeforeSaving: string;
    aiConfidenceThreshold: string;
    defaultExportFormat: string;
    includeLogo: string;
    includeSummary: string;
    includeCharts: string;
    includeOriginalLabValues: string;
    includeCalculationValues: string;
    includeDopInReport: string;
    includeNutrientRatiosInReport: string;
    autoSaveAnalyses: string;
    keepImportHistory: string;
    permanentDeleteTime: string;
  };
  options: {
    english: string;
    spanish: string;
    french: string;
    haitianCreole: string;
    portuguese: string;
    swahili: string;
    system: string;
    light: string;
    dark: string;
    accentGreen: string;
    accentTeal: string;
    accentBlue: string;
    accentAmber: string;
    accentRose: string;
    accentViolet: string;
    soil: string;
    foliar: string;
    both: string;
    banana: string;
    coffee: string;
    maize: string;
    rice: string;
    tomato: string;
    sweetPepper: string;
    sufficiencyRange: string;
    dop: string;
    customRange: string;
    flexible: string;
    normal: string;
    strict: string;
    pdf: string;
    excel: string;
    csv: string;
    image: string;
    automatic: string;
    openaiVision: string;
    manualReviewOnly: string;
    days: string;
  };
};

const settingsText: Record<Language, SettingsText> = {
  en: {
    back: "Back",
    title: "App Settings",
    subtitle: "Keep the app comfortable for your lab workflow.",
    saved: "Saved",
    local: "Local",
    unsaved: "Unsaved changes",
    save: "Save settings",
    undo: "Undo",
    redo: "Redo",
    reset: "Reset all settings",
    resetConfirm: "Reset all app settings?",
    sections: {
      general: "General",
      account: "Account",
      analysis: "Analysis",
      importAi: "Import / AI reader",
      reports: "Reports",
      data: "Data",
    },
    labels: {
      language: "Language",
      theme: "Theme",
      brightness: "App brightness",
      accentColor: "App accent color",
      defaultSampleType: "Default sample type",
      defaultCrop: "Default crop",
      interpretationMethod: "Interpretation method",
      warningSensitivity: "Warning sensitivity",
      enableNutrientRatios: "Enable nutrient ratios",
      enablePhWarnings: "Enable pH warnings",
      defaultImportType: "Default import type",
      aiReader: "Document reader",
      requireReviewBeforeSaving: "Require review before saving imported data",
      aiConfidenceThreshold: "AI confidence threshold",
      defaultExportFormat: "Default export format",
      includeLogo: "Include logo",
      includeSummary: "Include summary",
      includeCharts: "Include graphs and charts",
      includeOriginalLabValues: "Include original lab values",
      includeCalculationValues: "Include calculation values in reports",
      includeDopInReport: "Include DOP values in reports",
      includeNutrientRatiosInReport: "Include nutrient ratios in reports",
      autoSaveAnalyses: "Auto-save analyses",
      keepImportHistory: "Keep import history",
      permanentDeleteTime: "Permanent delete time (max 30 days)",
    },
    options: {
      english: "English",
      spanish: "Spanish",
      french: "French",
      haitianCreole: "Haitian Creole",
      portuguese: "Portuguese",
      swahili: "Swahili",
      system: "System",
      light: "Light",
      dark: "Dark",
      accentGreen: "Green",
      accentTeal: "Teal",
      accentBlue: "Blue",
      accentAmber: "Amber",
      accentRose: "Rose",
      accentViolet: "Violet",
      soil: "Soil",
      foliar: "Foliar",
      both: "Both",
      banana: "Banana",
      coffee: "Coffee",
      maize: "Maize",
      rice: "Rice",
      tomato: "Tomato",
      sweetPepper: "Sweet Pepper",
      sufficiencyRange: "Sufficiency range",
      dop: "DOP",
      customRange: "Custom range",
      flexible: "Flexible",
      normal: "Normal",
      strict: "Strict",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Image",
      automatic: "OpenAI + fallback",
      openaiVision: "OpenAI vision",
      manualReviewOnly: "Manual review only",
      days: "days",
    },
  },
  es: {
    back: "AtrÃ¡s",
    title: "Ajustes de la app",
    subtitle: "MantÃ©n la app cÃ³moda para tu flujo de laboratorio.",
    saved: "Guardado",
    local: "Local",
    unsaved: "Cambios sin guardar",
    save: "Guardar ajustes",
    undo: "Deshacer",
    redo: "Rehacer",
    reset: "Restablecer todos los ajustes",
    resetConfirm: "Â¿Restablecer todos los ajustes de la app?",
    sections: {
      general: "General",
      account: "Cuenta",
      analysis: "AnÃ¡lisis",
      importAi: "ImportaciÃ³n / lector IA",
      reports: "Reportes",
      data: "Datos",
    },
    labels: {
      language: "Idioma",
      theme: "Tema",
      brightness: "Brillo de la app",
      accentColor: "Color principal de la app",
      defaultSampleType: "Tipo de muestra predeterminado",
      defaultCrop: "Cultivo predeterminado",
      interpretationMethod: "MÃ©todo de interpretaciÃ³n",
      warningSensitivity: "Sensibilidad de alertas",
      enableNutrientRatios: "Activar relaciones de nutrientes",
      enablePhWarnings: "Activar alertas de pH",
      defaultImportType: "Tipo de importaciÃ³n predeterminado",
      aiReader: "Lector de documentos",
      requireReviewBeforeSaving: "Revisar antes de guardar datos importados",
      aiConfidenceThreshold: "Umbral de confianza IA",
      defaultExportFormat: "Formato de exportaciÃ³n predeterminado",
      includeLogo: "Incluir logo",
      includeSummary: "Incluir resumen",
      includeCharts: "Incluir grÃ¡ficos",
      includeOriginalLabValues: "Incluir valores originales",
      includeCalculationValues: "Incluir valores de cÃ¡lculos en reportes",
      includeDopInReport: "Incluir valores DOP en reportes",
      includeNutrientRatiosInReport: "Incluir relaciones de nutrientes en reportes",
      autoSaveAnalyses: "Guardar anÃ¡lisis automÃ¡ticamente",
      keepImportHistory: "Conservar historial de importaciÃ³n",
      permanentDeleteTime: "EliminaciÃ³n permanente (mÃ¡x. 30 dÃ­as)",
    },
    options: {
      english: "InglÃ©s",
      spanish: "EspaÃ±ol",
      french: "FrancÃ©s",
      haitianCreole: "Criollo haitiano",
      portuguese: "PortuguÃ©s",
      swahili: "Suajili",
      system: "Sistema",
      light: "Claro",
      dark: "Oscuro",
      accentGreen: "Verde",
      accentTeal: "Turquesa",
      accentBlue: "Azul",
      accentAmber: "Ãmbar",
      accentRose: "Rosa",
      accentViolet: "Violeta",
      soil: "Suelo",
      foliar: "Foliar",
      both: "Ambos",
      banana: "Banano",
      coffee: "CafÃ©",
      maize: "MaÃ­z",
      rice: "Arroz",
      tomato: "Tomate",
      sweetPepper: "AjÃ­ dulce",
      sufficiencyRange: "Rango de suficiencia",
      dop: "DOP",
      customRange: "Rango personalizado",
      flexible: "Flexible",
      normal: "Normal",
      strict: "Estricto",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Imagen",
      automatic: "AutomÃ¡tico",
      openaiVision: "VisiÃ³n OpenAI",
      manualReviewOnly: "Solo revisiÃ³n manual",
      days: "dÃ­as",
    },
  },
  fr: {
    back: "Retour",
    title: "RÃ©glages de lâ€™app",
    subtitle: "Gardez lâ€™app confortable pour votre travail de laboratoire.",
    saved: "EnregistrÃ©",
    local: "Local",
    unsaved: "Modifications non enregistrÃ©es",
    save: "Enregistrer les rÃ©glages",
    undo: "Annuler",
    redo: "RÃ©tablir",
    reset: "RÃ©initialiser tous les rÃ©glages",
    resetConfirm: "RÃ©initialiser tous les rÃ©glages de lâ€™app ?",
    sections: {
      general: "GÃ©nÃ©ral",
      account: "Compte",
      analysis: "Analyse",
      importAi: "Import / lecture IA",
      reports: "Rapports",
      data: "DonnÃ©es",
    },
    labels: {
      language: "Langue",
      theme: "ThÃ¨me",
      brightness: "LuminositÃ© de lâ€™app",
      accentColor: "Couleur principale de lâ€™app",
      defaultSampleType: "Type dâ€™Ã©chantillon par dÃ©faut",
      defaultCrop: "Culture par dÃ©faut",
      interpretationMethod: "MÃ©thode dâ€™interprÃ©tation",
      warningSensitivity: "SensibilitÃ© des alertes",
      enableNutrientRatios: "Activer les ratios de nutriments",
      enablePhWarnings: "Activer les alertes de pH",
      defaultImportType: "Type dâ€™import par dÃ©faut",
      aiReader: "Lecteur de documents",
      requireReviewBeforeSaving: "Exiger une rÃ©vision avant lâ€™enregistrement",
      aiConfidenceThreshold: "Seuil de confiance IA",
      defaultExportFormat: "Format dâ€™export par dÃ©faut",
      includeLogo: "Inclure le logo",
      includeSummary: "Inclure le rÃ©sumÃ©",
      includeCharts: "Inclure les graphiques",
      includeOriginalLabValues: "Inclure les valeurs originales",
      includeCalculationValues: "Inclure les valeurs de calcul dans les rapports",
      includeDopInReport: "Inclure les valeurs DOP dans les rapports",
      includeNutrientRatiosInReport: "Inclure les ratios nutritifs dans les rapports",
      autoSaveAnalyses: "Enregistrer les analyses automatiquement",
      keepImportHistory: "Conserver lâ€™historique dâ€™import",
      permanentDeleteTime: "Suppression dÃ©finitive (max. 30 jours)",
    },
    options: {
      english: "Anglais",
      spanish: "Espagnol",
      french: "FranÃ§ais",
      haitianCreole: "CrÃ©ole haÃ¯tien",
      portuguese: "Portugais",
      swahili: "Swahili",
      system: "SystÃ¨me",
      light: "Clair",
      dark: "Sombre",
      accentGreen: "Vert",
      accentTeal: "Sarcelle",
      accentBlue: "Bleu",
      accentAmber: "Ambre",
      accentRose: "Rose",
      accentViolet: "Violet",
      soil: "Sol",
      foliar: "Foliaire",
      both: "Les deux",
      banana: "Banane",
      coffee: "CafÃ©",
      maize: "MaÃ¯s",
      rice: "Riz",
      tomato: "Tomate",
      sweetPepper: "Piment doux",
      sufficiencyRange: "Plage de suffisance",
      dop: "DOP",
      customRange: "Plage personnalisÃ©e",
      flexible: "Flexible",
      normal: "Normal",
      strict: "Strict",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Image",
      automatic: "Automatique",
      openaiVision: "Vision OpenAI",
      manualReviewOnly: "RÃ©vision manuelle seulement",
      days: "jours",
    },
  },
  ht: {
    back: "Retounen",
    title: "ParamÃ¨t app la",
    subtitle: "Ajiste app la pou travay laboratwa ou pi fasil.",
    saved: "Sove",
    local: "Lokal",
    unsaved: "Chanjman pa sove",
    save: "Sove paramÃ¨t yo",
    undo: "DefÃ¨t",
    redo: "RefÃ¨t",
    reset: "Reyajiste tout paramÃ¨t yo",
    resetConfirm: "Reyajiste tout paramÃ¨t app la?",
    sections: {
      general: "Jeneral",
      account: "Kont",
      analysis: "Analiz",
      importAi: "EnpÃ²te / lekti IA",
      reports: "RapÃ²",
      data: "Done",
    },
    labels: {
      language: "Lang",
      theme: "TÃ¨m",
      brightness: "Klere app la",
      accentColor: "KoulÃ¨ prensipal app la",
      defaultSampleType: "Kalite echantiyon pa defo",
      defaultCrop: "Kilti pa defo",
      interpretationMethod: "MetÃ²d entÃ¨pretasyon",
      warningSensitivity: "Sansiblite avÃ¨tisman",
      enableNutrientRatios: "Aktive rapÃ² eleman nitritif yo",
      enablePhWarnings: "Aktive avÃ¨tisman pH",
      defaultImportType: "Kalite enpÃ²tasyon pa defo",
      aiReader: "LektÃ¨ dokiman",
      requireReviewBeforeSaving: "Mande revizyon anvan done enpÃ²te yo sove",
      aiConfidenceThreshold: "Limit konfyans IA",
      defaultExportFormat: "FÃ²ma ekspÃ²tasyon pa defo",
      includeLogo: "Mete logo",
      includeSummary: "Mete rezime",
      includeCharts: "Mete grafik",
      includeOriginalLabValues: "Mete valÃ¨ laboratwa orijinal yo",
      includeCalculationValues: "Mete valÃ¨ kalkil yo nan rapÃ² yo",
      includeDopInReport: "Mete valÃ¨ DOP yo nan rapÃ² yo",
      includeNutrientRatiosInReport: "Mete rapÃ² eleman nitritif yo nan rapÃ² yo",
      autoSaveAnalyses: "Sove analiz yo otomatikman",
      keepImportHistory: "Kenbe istwa enpÃ²tasyon",
      permanentDeleteTime: "Efasman pou tout tan (maks. 30 jou)",
    },
    options: {
      english: "AnglÃ¨",
      spanish: "EspanyÃ²l",
      french: "FransÃ¨",
      haitianCreole: "KreyÃ²l ayisyen",
      portuguese: "PÃ²tigÃ¨",
      swahili: "Swahili",
      system: "SistÃ¨m",
      light: "KlÃ¨",
      dark: "Fonse",
      accentGreen: "VÃ¨t",
      accentTeal: "Ble sarcel",
      accentBlue: "Ble",
      accentAmber: "Anba",
      accentRose: "Woz",
      accentViolet: "VyolÃ¨t",
      soil: "TÃ¨",
      foliar: "FÃ¨y",
      both: "Tou de",
      banana: "Bannann",
      coffee: "Kafe",
      maize: "Mayi",
      rice: "Diri",
      tomato: "Tomat",
      sweetPepper: "Piman dous",
      sufficiencyRange: "Ranje sifizans",
      dop: "DOP",
      customRange: "Ranje pÃ¨sonalize",
      flexible: "Fleksib",
      normal: "NÃ²mal",
      strict: "Strik",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Imaj",
      automatic: "Otomatik",
      openaiVision: "Vizyon OpenAI",
      manualReviewOnly: "Revizyon manyÃ¨l sÃ¨lman",
      days: "jou",
    },
  },
  pt: {
    back: "Voltar",
    title: "ConfiguraÃ§Ãµes do app",
    subtitle: "Mantenha o app confortÃ¡vel para seu fluxo de laboratÃ³rio.",
    saved: "Salvo",
    local: "Local",
    unsaved: "AlteraÃ§Ãµes nÃ£o salvas",
    save: "Salvar configuraÃ§Ãµes",
    undo: "Desfazer",
    redo: "Refazer",
    reset: "Redefinir todas as configuraÃ§Ãµes",
    resetConfirm: "Redefinir todas as configuraÃ§Ãµes do app?",
    sections: {
      general: "Geral",
      account: "Conta",
      analysis: "AnÃ¡lise",
      importAi: "ImportaÃ§Ã£o / leitor IA",
      reports: "RelatÃ³rios",
      data: "Dados",
    },
    labels: {
      language: "Idioma",
      theme: "Tema",
      brightness: "Brilho do app",
      accentColor: "Cor principal do app",
      defaultSampleType: "Tipo de amostra padrÃ£o",
      defaultCrop: "Cultura padrÃ£o",
      interpretationMethod: "MÃ©todo de interpretaÃ§Ã£o",
      warningSensitivity: "Sensibilidade dos avisos",
      enableNutrientRatios: "Ativar relaÃ§Ãµes de nutrientes",
      enablePhWarnings: "Ativar avisos de pH",
      defaultImportType: "Tipo de importaÃ§Ã£o padrÃ£o",
      aiReader: "Leitor de documentos",
      requireReviewBeforeSaving: "Exigir revisÃ£o antes de salvar dados importados",
      aiConfidenceThreshold: "Limite de confianÃ§a IA",
      defaultExportFormat: "Formato de exportaÃ§Ã£o padrÃ£o",
      includeLogo: "Incluir logo",
      includeSummary: "Incluir resumo",
      includeCharts: "Incluir grÃ¡ficos",
      includeOriginalLabValues: "Incluir valores originais",
      includeCalculationValues: "Incluir valores de cÃ¡lculos nos relatÃ³rios",
      includeDopInReport: "Incluir valores DOP nos relatÃ³rios",
      includeNutrientRatiosInReport: "Incluir relaÃ§Ãµes de nutrientes nos relatÃ³rios",
      autoSaveAnalyses: "Salvar anÃ¡lises automaticamente",
      keepImportHistory: "Manter histÃ³rico de importaÃ§Ã£o",
      permanentDeleteTime: "ExclusÃ£o permanente (mÃ¡x. 30 dias)",
    },
    options: {
      english: "InglÃªs",
      spanish: "Espanhol",
      french: "FrancÃªs",
      haitianCreole: "Crioulo haitiano",
      portuguese: "PortuguÃªs",
      swahili: "SuaÃ­li",
      system: "Sistema",
      light: "Claro",
      dark: "Escuro",
      accentGreen: "Verde",
      accentTeal: "Azul-petrÃ³leo",
      accentBlue: "Azul",
      accentAmber: "Ãmbar",
      accentRose: "Rosa",
      accentViolet: "Violeta",
      soil: "Solo",
      foliar: "Foliar",
      both: "Ambos",
      banana: "Banana",
      coffee: "CafÃ©",
      maize: "Milho",
      rice: "Arroz",
      tomato: "Tomate",
      sweetPepper: "PimentÃ£o",
      sufficiencyRange: "Faixa de suficiÃªncia",
      dop: "DOP",
      customRange: "Faixa personalizada",
      flexible: "FlexÃ­vel",
      normal: "Normal",
      strict: "RÃ­gido",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Imagem",
      automatic: "AutomÃ¡tico",
      openaiVision: "VisÃ£o OpenAI",
      manualReviewOnly: "Somente revisÃ£o manual",
      days: "dias",
    },
  },
  sw: {
    back: "Rudi",
    title: "Mipangilio ya app",
    subtitle: "Weka app iwe rahisi kwa kazi yako ya maabara.",
    saved: "Imehifadhiwa",
    local: "Ndani ya kifaa",
    unsaved: "Mabadiliko hayajahifadhiwa",
    save: "Hifadhi mipangilio",
    undo: "Tendua",
    redo: "Rudia",
    reset: "Rudisha mipangilio yote",
    resetConfirm: "Rudisha mipangilio yote ya app?",
    sections: {
      general: "Jumla",
      account: "Akaunti",
      analysis: "Uchambuzi",
      importAi: "Ingiza / kisomaji cha AI",
      reports: "Ripoti",
      data: "Data",
    },
    labels: {
      language: "Lugha",
      theme: "Mandhari",
      brightness: "Mwangaza wa app",
      accentColor: "Rangi kuu ya app",
      defaultSampleType: "Aina chaguo-msingi ya sampuli",
      defaultCrop: "Zao chaguo-msingi",
      interpretationMethod: "Mbinu ya tafsiri",
      warningSensitivity: "Unyeti wa tahadhari",
      enableNutrientRatios: "Washa uwiano wa virutubisho",
      enablePhWarnings: "Washa tahadhari za pH",
      defaultImportType: "Aina chaguo-msingi ya kuingiza",
      aiReader: "Kisomaji cha hati",
      requireReviewBeforeSaving: "Hitaji ukaguzi kabla ya kuhifadhi data iliyoingizwa",
      aiConfidenceThreshold: "Kiwango cha uhakika wa AI",
      defaultExportFormat: "Muundo chaguo-msingi wa kutoa",
      includeLogo: "Jumuisha nembo",
      includeSummary: "Jumuisha muhtasari",
      includeCharts: "Jumuisha grafu",
      includeOriginalLabValues: "Jumuisha thamani asili za maabara",
      includeCalculationValues: "Jumuisha thamani za hesabu kwenye ripoti",
      includeDopInReport: "Jumuisha thamani za DOP kwenye ripoti",
      includeNutrientRatiosInReport: "Jumuisha uwiano wa virutubisho kwenye ripoti",
      autoSaveAnalyses: "Hifadhi uchambuzi kiotomatiki",
      keepImportHistory: "Hifadhi historia ya kuingiza",
      permanentDeleteTime: "Kufuta kabisa (kiwango cha juu siku 30)",
    },
    options: {
      english: "Kiingereza",
      spanish: "Kihispania",
      french: "Kifaransa",
      haitianCreole: "Kikrioli cha Haiti",
      portuguese: "Kireno",
      swahili: "Kiswahili",
      system: "Mfumo",
      light: "Angavu",
      dark: "Meusi",
      accentGreen: "Kijani",
      accentTeal: "Samawati-kijani",
      accentBlue: "Bluu",
      accentAmber: "Manjano",
      accentRose: "Waridi",
      accentViolet: "Zambarau",
      soil: "Udongo",
      foliar: "Majani",
      both: "Zote mbili",
      banana: "Ndizi",
      coffee: "Kahawa",
      maize: "Mahindi",
      rice: "Mchele",
      tomato: "Nyanya",
      sweetPepper: "Pilipili hoho",
      sufficiencyRange: "Kiwango cha kutosha",
      dop: "DOP",
      customRange: "Kiwango maalum",
      flexible: "Rahisi",
      normal: "Kawaida",
      strict: "Kali",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Picha",
      automatic: "Otomatiki",
      openaiVision: "OpenAI vision",
      manualReviewOnly: "Ukaguzi wa mkono pekee",
      days: "siku",
    },
  },
};

const languageOptions = (text: SettingsText): { value: Language; label: string }[] => [
  { value: "en", label: text.options.english },
  { value: "es", label: text.options.spanish },
  { value: "fr", label: text.options.french },
  { value: "ht", label: text.options.haitianCreole },
  { value: "pt", label: text.options.portuguese },
  { value: "sw", label: text.options.swahili },
];

const themeOptions = (text: SettingsText): { value: AppThemePreference; label: string }[] => [
  { value: "system", label: text.options.system },
  { value: "light", label: text.options.light },
  { value: "dark", label: text.options.dark },
];

const accentOptions = (text: SettingsText): { value: AccentColor; label: string }[] => [
  { value: "green", label: text.options.accentGreen },
  { value: "teal", label: text.options.accentTeal },
  { value: "blue", label: text.options.accentBlue },
  { value: "amber", label: text.options.accentAmber },
  { value: "rose", label: text.options.accentRose },
  { value: "violet", label: text.options.accentViolet },
];

const sampleTypeOptions = (text: SettingsText): { value: DefaultSampleType; label: string }[] => [
  { value: "soil", label: text.options.soil },
  { value: "foliar", label: text.options.foliar },
  { value: "both", label: text.options.both },
];

const cropOptions = (text: SettingsText): { value: DefaultCrop; label: string }[] => [
  { value: "banana", label: text.options.banana },
  { value: "coffee", label: text.options.coffee },
  { value: "maize", label: text.options.maize },
  { value: "rice", label: text.options.rice },
  { value: "tomato", label: text.options.tomato },
  { value: "sweet_pepper", label: text.options.sweetPepper },
];

const interpretationOptions = (text: SettingsText): { value: InterpretationMethod; label: string }[] => [
  { value: "sufficiency_range", label: text.options.sufficiencyRange },
  { value: "dop", label: text.options.dop },
  { value: "custom_range", label: text.options.customRange },
];

const sensitivityOptions = (text: SettingsText): { value: WarningSensitivity; label: string }[] => [
  { value: "flexible", label: text.options.flexible },
  { value: "normal", label: text.options.normal },
  { value: "strict", label: text.options.strict },
];

const importTypeOptions = (text: SettingsText): { value: DefaultImportType; label: string }[] => [
  { value: "pdf", label: text.options.pdf },
  { value: "excel", label: text.options.excel },
  { value: "csv", label: text.options.csv },
  { value: "image", label: text.options.image },
];

const aiReaderOptions = (text: SettingsText): { value: AiReader; label: string }[] => [
  { value: "automatic", label: text.options.automatic },
  { value: "openai_vision", label: text.options.openaiVision },
  { value: "manual_review", label: text.options.manualReviewOnly },
];

const exportFormatOptions = (text: SettingsText): { value: DefaultExportFormat; label: string }[] => [
  { value: "pdf", label: text.options.pdf },
  { value: "excel", label: text.options.excel },
  { value: "csv", label: text.options.csv },
];

export default function AppSettingsScreen({
  language,
  session,
  onBack,
  onLanguageChange,
  onThemePreferenceChange,
  onAccentChange,
  onBrightnessChange,
}: Props) {
  const text = settingsText[language] || settingsText.en;
  const initialSettings = useMemo(() => cloneSettings(getSettings()), []);
  const [committedSettings, setCommittedSettings] = useState(initialSettings);
  const [draftSettings, setDraftSettings] = useState(initialSettings);
  const [history, setHistory] = useState<AppSettings[]>([initialSettings]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const historyIndexRef = useRef(0);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedTimeout = useRef<number | null>(null);

  const isDirty = useMemo(
    () => !settingsEqual(draftSettings, committedSettings),
    [draftSettings, committedSettings]
  );
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  useEffect(() => {
    return () => {
      if (savedTimeout.current) window.clearTimeout(savedTimeout.current);
    };
  }, []);

  function previewSettings(nextSettings: AppSettings) {
    onLanguageChange(nextSettings.general.language);
    onThemePreferenceChange(nextSettings.general.theme);
    onAccentChange(nextSettings.general.accentColor);
    onBrightnessChange(nextSettings.general.brightness);
  }

  function showSavedFlash() {
    setSavedFlash(true);
    if (savedTimeout.current) window.clearTimeout(savedTimeout.current);
    savedTimeout.current = window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function pushDraft(nextSettings: AppSettings) {
    const snapshot = cloneSettings(nextSettings);
    setDraftSettings(snapshot);
    previewSettings(snapshot);

    setHistory((previous) => {
      const current = previous[historyIndexRef.current];
      if (current && settingsEqual(current, snapshot)) {
        return previous;
      }

      const truncated = previous.slice(0, historyIndexRef.current + 1);
      historyIndexRef.current = truncated.length;
      setHistoryIndex(historyIndexRef.current);
      return [...truncated, snapshot];
    });
  }

  function changeSetting<
    Section extends keyof AppSettings,
    Key extends keyof AppSettings[Section],
  >(section: Section, key: Key, value: AppSettings[Section][Key]) {
    pushDraft({
      ...draftSettings,
      [section]: {
        ...draftSettings[section],
        [key]: value,
      },
    });
  }

  function handleUndo() {
    if (!canUndo) return;
    const nextIndex = historyIndexRef.current - 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const snapshot = cloneSettings(history[nextIndex]);
    setDraftSettings(snapshot);
    previewSettings(snapshot);
  }

  function handleRedo() {
    if (!canRedo) return;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const snapshot = cloneSettings(history[nextIndex]);
    setDraftSettings(snapshot);
    previewSettings(snapshot);
  }

  function handleSave() {
    if (!isDirty) return;
    const snapshot = cloneSettings(draftSettings);
    saveSettings(snapshot);
    setCommittedSettings(snapshot);
    previewSettings(snapshot);
    showSavedFlash();
  }

  function handleReset() {
    if (!window.confirm(text.resetConfirm)) return;
    const nextSettings = cloneSettings(resetSettings());
    setCommittedSettings(nextSettings);
    setDraftSettings(nextSettings);
    setHistory([nextSettings]);
    historyIndexRef.current = 0;
    setHistoryIndex(0);
    previewSettings(nextSettings);
    showSavedFlash();
  }

  return (
    <section className="mt-4 animate-slide-up">
      <div className="values-screen-panel rounded-3xl p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => {
                if (isDirty) {
                  previewSettings(committedSettings);
                }
                onBack();
              }}
              className="rounded-2xl border border-white/70 bg-white/72 px-3 py-2 text-sm font-bold text-green-900 shadow-sm"
            >
              {text.back}
            </button>
            <h1 className="mt-4 text-base font-extrabold uppercase tracking-wide text-green-950 sm:text-lg">
              {text.title}
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              {text.subtitle}
            </p>
          </div>

          <span
            className={`rounded-full px-3 py-1 text-xs font-extrabold transition ${
              savedFlash
                ? "bg-emerald-100 text-emerald-800 opacity-100"
                : isDirty
                  ? "bg-amber-100 text-amber-900 opacity-100"
                  : "bg-white/60 text-slate-400 opacity-70"
            }`}
          >
            {savedFlash ? text.saved : isDirty ? text.unsaved : text.local}
          </span>
        </div>

        <div className="mt-5 grid gap-4 pb-24">
          <SettingsSection icon={<Globe2 size={18} />} title={text.sections.general}>
            <SelectField
              label={text.labels.language}
              value={draftSettings.general.language}
              options={languageOptions(text)}
              onChange={(value) => changeSetting("general", "language", value)}
            />
            <SelectField
              label={text.labels.theme}
              value={draftSettings.general.theme}
              options={themeOptions(text)}
              onChange={(value) => changeSetting("general", "theme", value)}
            />
            <RangeField
              label={text.labels.brightness}
              value={draftSettings.general.brightness}
              min={85}
              max={115}
              onChange={(value) => changeSetting("general", "brightness", value)}
            />
            <div className="grid gap-2 md:col-span-2">
              <SelectField
                label={text.labels.accentColor}
                value={draftSettings.general.accentColor}
                options={accentOptions(text)}
                onChange={(value) => changeSetting("general", "accentColor", value)}
              />
              <AccentSwatches
                value={draftSettings.general.accentColor}
                onChange={(value) => changeSetting("general", "accentColor", value)}
              />
            </div>
            <SelectField
              label={text.labels.defaultSampleType}
              value={draftSettings.general.defaultSampleType}
              options={sampleTypeOptions(text)}
              onChange={(value) =>
                changeSetting("general", "defaultSampleType", value)
              }
            />
            <SelectField
              label={text.labels.defaultCrop}
              value={draftSettings.general.defaultCrop}
              options={cropOptions(text)}
              onChange={(value) => changeSetting("general", "defaultCrop", value)}
            />
          </SettingsSection>

          <AccountSettingsSection language={language} session={session} />

          <SettingsSection icon={<FlaskConical size={18} />} title={text.sections.analysis}>
            <SelectField
              label={text.labels.interpretationMethod}
              value={draftSettings.analysis.interpretationMethod}
              options={interpretationOptions(text)}
              onChange={(value) =>
                changeSetting("analysis", "interpretationMethod", value)
              }
            />
            <SelectField
              label={text.labels.warningSensitivity}
              value={draftSettings.analysis.warningSensitivity}
              options={sensitivityOptions(text)}
              onChange={(value) =>
                changeSetting("analysis", "warningSensitivity", value)
              }
            />
            <SwitchField
              label={text.labels.enableNutrientRatios}
              checked={draftSettings.analysis.enableNutrientRatios}
              onChange={(value) =>
                changeSetting("analysis", "enableNutrientRatios", value)
              }
            />
            <SwitchField
              label={text.labels.enablePhWarnings}
              checked={draftSettings.analysis.enablePhWarnings}
              onChange={(value) =>
                changeSetting("analysis", "enablePhWarnings", value)
              }
            />
          </SettingsSection>

          <SettingsSection icon={<ScanLine size={18} />} title={text.sections.importAi}>
            <SelectField
              label={text.labels.defaultImportType}
              value={draftSettings.importAi.defaultImportType}
              options={importTypeOptions(text)}
              onChange={(value) =>
                changeSetting("importAi", "defaultImportType", value)
              }
            />
            <SelectField
              label={text.labels.aiReader}
              value={draftSettings.importAi.aiReader}
              options={aiReaderOptions(text)}
              onChange={(value) => changeSetting("importAi", "aiReader", value)}
            />
            <SwitchField
              label={text.labels.requireReviewBeforeSaving}
              checked={draftSettings.importAi.requireReviewBeforeSaving}
              onChange={(value) =>
                changeSetting("importAi", "requireReviewBeforeSaving", value)
              }
            />
            <RangeField
              label={text.labels.aiConfidenceThreshold}
              value={draftSettings.importAi.aiConfidenceThreshold}
              min={50}
              max={100}
              onChange={(value) =>
                changeSetting("importAi", "aiConfidenceThreshold", value)
              }
            />
          </SettingsSection>

          <SettingsSection icon={<FileDown size={18} />} title={text.sections.reports}>
            <SelectField
              label={text.labels.defaultExportFormat}
              value={draftSettings.reports.defaultExportFormat}
              options={exportFormatOptions(text)}
              onChange={(value) =>
                changeSetting("reports", "defaultExportFormat", value)
              }
            />
            <SwitchField
              label={text.labels.includeLogo}
              checked={draftSettings.reports.includeLogo}
              onChange={(value) => changeSetting("reports", "includeLogo", value)}
            />
            <SwitchField
              label={text.labels.includeSummary}
              checked={draftSettings.reports.includeSummary}
              onChange={(value) =>
                changeSetting("reports", "includeSummary", value)
              }
            />
            <SwitchField
              label={text.labels.includeCharts}
              checked={draftSettings.reports.includeCharts}
              onChange={(value) =>
                changeSetting("reports", "includeCharts", value)
              }
            />
            <SwitchField
              label={text.labels.includeOriginalLabValues}
              checked={draftSettings.reports.includeOriginalLabValues}
              onChange={(value) =>
                changeSetting("reports", "includeOriginalLabValues", value)
              }
            />
            <SwitchField
              label={text.labels.includeCalculationValues}
              checked={draftSettings.reports.includeCalculationValues}
              onChange={(value) =>
                changeSetting("reports", "includeCalculationValues", value)
              }
            />
            <SwitchField
              label={text.labels.includeDopInReport}
              checked={draftSettings.reports.includeDopInReport}
              onChange={(value) =>
                changeSetting("reports", "includeDopInReport", value)
              }
            />
            <SwitchField
              label={text.labels.includeNutrientRatiosInReport}
              checked={draftSettings.reports.includeNutrientRatiosInReport}
              onChange={(value) =>
                changeSetting("reports", "includeNutrientRatiosInReport", value)
              }
            />
          </SettingsSection>

          <SettingsSection icon={<Database size={18} />} title={text.sections.data}>
            <SwitchField
              label={text.labels.autoSaveAnalyses}
              checked={draftSettings.data.autoSaveAnalyses}
              onChange={(value) => changeSetting("data", "autoSaveAnalyses", value)}
            />
            <SwitchField
              label={text.labels.keepImportHistory}
              checked={draftSettings.data.keepImportHistory}
              onChange={(value) => changeSetting("data", "keepImportHistory", value)}
            />
            <RangeField
              label={text.labels.permanentDeleteTime}
              value={draftSettings.data.permanentDeleteDays}
              min={1}
              max={MAX_PERMANENT_DELETE_DAYS}
              suffix={text.options.days}
              onChange={(value) =>
                changeSetting(
                  "data",
                  "permanentDeleteDays",
                  Math.min(MAX_PERMANENT_DELETE_DAYS, value)
                )
              }
            />
            <button
              type="button"
              onClick={handleReset}
              className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 text-sm font-extrabold text-red-800 transition hover:bg-red-100"
            >
              <RotateCcw size={16} />
              {text.reset}
            </button>
          </SettingsSection>
        </div>

        <SettingsToolbar
          text={text}
          isDirty={isDirty}
          canUndo={canUndo}
          canRedo={canRedo}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onSave={handleSave}
        />
      </div>
    </section>
  );
}

const ACCENT_OPTIONS: AccentColor[] = [
  "green",
  "teal",
  "blue",
  "amber",
  "rose",
  "violet",
];

function AccentSwatches({
  value,
  onChange,
}: {
  value: AccentColor;
  onChange: (value: AccentColor) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {ACCENT_OPTIONS.map((accent) => {
        const scale = buildAccentScale(accent);
        const selected = value === accent;

        return (
          <button
            key={accent}
            type="button"
            title={accent}
            aria-pressed={selected}
            onClick={() => onChange(accent)}
            className={`h-9 w-9 rounded-full border-2 shadow-sm transition ${
              selected
                ? "border-[color:var(--accent-900)] ring-4 ring-[color:var(--accent-ring)]"
                : "border-white/80 hover:scale-105"
            }`}
            style={{
              background: `linear-gradient(135deg, ${scale[300]}, ${scale[700]})`,
            }}
          />
        );
      })}
    </div>
  );
}

function SettingsToolbar({
  text,
  isDirty,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
}: {
  text: SettingsText;
  isDirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
}) {
  return (
    <div
      className={`sticky bottom-0 z-20 -mx-1 mt-2 border-t border-white/70 bg-white/82 px-1 py-3 backdrop-blur-xl transition ${
        isDirty ? "opacity-100" : "opacity-95"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title={text.undo}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Undo2 size={16} />
            <span className="hidden sm:inline">{text.undo}</span>
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title={text.redo}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white/90 px-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Redo2 size={16} />
            <span className="hidden sm:inline">{text.redo}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-extrabold transition ${
            isDirty
              ? "bg-green-700 text-white shadow-lg shadow-green-900/20 hover:bg-green-800"
              : "border border-slate-200 bg-white/80 text-slate-400"
          }`}
        >
          <Save size={16} />
          {text.save}
        </button>
      </div>
    </div>
  );
}

function SettingsSection({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/65 bg-white/58 p-3 shadow-sm backdrop-blur-xl sm:p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="grid h-9 w-9 place-items-center rounded-2xl bg-emerald-100/80 text-emerald-800">
          {icon}
        </span>
        <h2 className="text-sm font-extrabold uppercase tracking-wide text-green-950">
          {title}
        </h2>
      </div>
      <div className="grid gap-3 md:grid-cols-2">{children}</div>
    </section>
  );
}

function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-extrabold uppercase tracking-wide text-slate-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="min-h-11 rounded-2xl border border-green-700/18 bg-white/82 px-3 text-sm font-bold text-slate-900 shadow-sm outline-none focus:border-green-700 focus:ring-4 focus:ring-green-700/10"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex min-h-11 items-center justify-between gap-3 rounded-2xl border border-green-700/12 bg-white/62 px-3 py-2">
      <span className="text-sm font-bold text-green-950">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-green-700"
      />
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix = "%",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-2 rounded-2xl border border-green-700/12 bg-white/62 px-3 py-2">
      <span className="flex items-center justify-between gap-3 text-sm font-bold text-green-950">
        {label}
        <span className="text-green-700">
          {value} {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="accent-green-700"
      />
    </label>
  );
}

