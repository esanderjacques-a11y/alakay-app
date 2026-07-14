"use client";

import { useEffect, useMemo, useRef, useState, useId, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import {
  Redo2,
  RotateCcw,
  Save,
  Undo2,
  ChevronDown,
  Download,
  Loader2,
} from "lucide-react";
import MenuSelect from "@/components/ui/MenuSelect";
import { exportMethodologyPdf } from "@/lib/methodologyReport";
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
import {
  applyAccentColor,
  applyBrightness,
  applyContrast,
  applyGlassUi,
  applySaturation,
  resolveDarkVariantPreference,
  resolveThemePreference,
} from "@/lib/uiPreferences";
import AccountSettingsSection from "@/components/AccountSettingsSection";
import BackButton from "@/components/ui/BackButton";
import type { Language } from "@/lib/translations";

type Props = {
  language: Language;
  session: Session | null;
  onBack: () => void;
  onLanguageChange: (language: Language) => void;
  onThemePreferenceChange: (theme: AppThemePreference) => void;
  onAccentChange?: (accent: AccentColor) => void;
  onBrightnessChange?: (brightness: number) => void;
  onFontSizeChange?: (delta: number) => void;
  onSettingsChange?: (settings: AppSettings) => void;
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
    display: string;
    account: string;
    analysis: string;
    importAi: string;
    reports: string;
    data: string;
    resources: string;
  };
  labels: {
    language: string;
    theme: string;
    brightness: string;
    saturation: string;
    contrast: string;
    appFontSize: string;
    accentColor: string;
    glassUi: string;
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
    includeHorizontalResultGraph: string;
    includeOriginalLabValues: string;
    includeCalculationValues: string;
    includeDopInReport: string;
    includeNutrientRatiosInReport: string;
    autoSaveAnalyses: string;
    autoSaveAnalysesHint: string;
    keepImportHistory: string;
    permanentDeleteTime: string;
    showParameterDetails: string;
    showParameterSymbolsOnly: string;
    downloadMethodology: string;
  };
  resourcesDesc: string;
  methodologyDesc: string;
  methodologyGenerating: string;
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
    darkBlack: string;
    accentGreen: string;
    accentTeal: string;
    accentBlue: string;
    accentAmber: string;
    accentRose: string;
    accentViolet: string;
    accentCyan: string;
    accentLime: string;
    accentOrange: string;
    accentFuchsia: string;
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
      display: "Display",
      account: "Account",
      analysis: "Analysis",
      importAi: "Import / AI reader",
      reports: "Reports",
      data: "Data",
      resources: "Resources",
    },
    labels: {
      language: "Language",
      theme: "Theme",
      brightness: "App brightness",
      saturation: "Saturation",
      contrast: "Contrast",
      appFontSize: "App size",
      accentColor: "App accent color",
      glassUi: "Glass blur UI",
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
      includeHorizontalResultGraph: "Show horizontal result graph",
      includeOriginalLabValues: "Include original lab values",
      includeCalculationValues: "Include calculation values in reports",
      includeDopInReport: "Include DOP values in reports",
      includeNutrientRatiosInReport: "Include nutrient ratios in reports",
      autoSaveAnalyses: "Auto-save analyses",
      autoSaveAnalysesHint:
        "Save each interpretation to your account automatically. When offline, analyses queue on this device and sync later.",
      keepImportHistory: "Keep import history",
      permanentDeleteTime: "Permanent delete time (max 30 days)",
      showParameterDetails: "Show parameter details in value entry",
      showParameterSymbolsOnly: "Show symbols only in value entry",
      downloadMethodology: "Download calculator methodology (PDF)",
    },
    resourcesDesc: "Reference material you can download and keep offline.",
    methodologyDesc:
      "A bilingual (Spanish/English) document with every formula, calculation step, and reference table used across the Calculator module, with citations.",
    methodologyGenerating: "Generating…",
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
      darkBlack: "Black dark",
      accentGreen: "Green",
      accentTeal: "Teal",
      accentBlue: "Blue",
      accentAmber: "Amber",
      accentRose: "Rose",
      accentViolet: "Violet",
      accentCyan: "Cyan",
      accentLime: "Lime",
      accentOrange: "Orange",
      accentFuchsia: "Fuchsia",
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
    back: "Atrás",
    title: "Ajustes de la app",
    subtitle: "Mantén la app cómoda para tu flujo de laboratorio.",
    saved: "Guardado",
    local: "Local",
    unsaved: "Cambios sin guardar",
    save: "Guardar ajustes",
    undo: "Deshacer",
    redo: "Rehacer",
    reset: "Restablecer todos los ajustes",
    resetConfirm: "¿Restablecer todos los ajustes de la app?",
    sections: {
      general: "General",
      display: "Pantalla",
      account: "Cuenta",
      analysis: "Análisis",
      importAi: "Importación / lector IA",
      reports: "Reportes",
      data: "Datos",
      resources: "Recursos",
    },
    labels: {
      language: "Idioma",
      theme: "Tema",
      brightness: "Brillo de la app",
      saturation: "Saturación",
      contrast: "Contraste",
      appFontSize: "Tamaño de la app",
      accentColor: "Color principal de la app",
      glassUi: "Interfaz con efecto cristal",
      defaultSampleType: "Tipo de muestra predeterminado",
      defaultCrop: "Cultivo predeterminado",
      interpretationMethod: "Método de interpretación",
      warningSensitivity: "Sensibilidad de alertas",
      enableNutrientRatios: "Activar relaciones de nutrientes",
      enablePhWarnings: "Activar alertas de pH",
      defaultImportType: "Tipo de importación predeterminado",
      aiReader: "Lector de documentos",
      requireReviewBeforeSaving: "Revisar antes de guardar datos importados",
      aiConfidenceThreshold: "Umbral de confianza IA",
      defaultExportFormat: "Formato de exportación predeterminado",
      includeLogo: "Incluir logo",
      includeSummary: "Incluir resumen",
      includeCharts: "Incluir gráficos",
      includeHorizontalResultGraph: "Mostrar gráfico horizontal de resultados",
      includeOriginalLabValues: "Incluir valores originales",
      includeCalculationValues: "Incluir valores de cálculos en reportes",
      includeDopInReport: "Incluir valores DOP en reportes",
      includeNutrientRatiosInReport: "Incluir relaciones de nutrientes en reportes",
      autoSaveAnalyses: "Guardar análisis automáticamente",
      autoSaveAnalysesHint:
        "Guarda cada interpretación en tu cuenta automáticamente. Sin conexión, los análisis se ponen en cola en este dispositivo y se sincronizan después.",
      keepImportHistory: "Conservar historial de importación",
      permanentDeleteTime: "Eliminación permanente (máx. 30 días)",
      showParameterDetails: "Mostrar detalles del parámetro al ingresar valores",
      showParameterSymbolsOnly: "Mostrar solo símbolos al ingresar valores",
      downloadMethodology: "Descargar metodología de la calculadora (PDF)",
    },
    resourcesDesc: "Material de referencia que puedes descargar y conservar sin conexión.",
    methodologyDesc:
      "Un documento bilingüe (español/inglés) con todas las fórmulas, pasos de cálculo y tablas de referencia usadas en el módulo de calculadora, con citas.",
    methodologyGenerating: "Generando…",
    options: {
      english: "Inglés",
      spanish: "Español",
      french: "Francés",
      haitianCreole: "Criollo haitiano",
      portuguese: "Portugués",
      swahili: "Suajili",
      system: "Sistema",
      light: "Claro",
      dark: "Oscuro",
      darkBlack: "Oscuro negro",
      accentGreen: "Verde",
      accentTeal: "Turquesa",
      accentBlue: "Azul",
      accentAmber: "Ámbar",
      accentRose: "Rosa",
      accentViolet: "Violeta",
      accentCyan: "Cian",
      accentLime: "Lima",
      accentOrange: "Naranja",
      accentFuchsia: "Fucsia",
      soil: "Suelo",
      foliar: "Foliar",
      both: "Ambos",
      banana: "Banano",
      coffee: "Café",
      maize: "Maíz",
      rice: "Arroz",
      tomato: "Tomate",
      sweetPepper: "Ají dulce",
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
      automatic: "Automático",
      openaiVision: "Visión OpenAI",
      manualReviewOnly: "Solo revisión manual",
      days: "días",
    },
  },
  fr: {
    back: "Retour",
    title: "Réglages de l’app",
    subtitle: "Gardez l’app confortable pour votre travail de laboratoire.",
    saved: "Enregistré",
    local: "Local",
    unsaved: "Modifications non enregistrées",
    save: "Enregistrer les réglages",
    undo: "Annuler",
    redo: "Rétablir",
    reset: "Réinitialiser tous les réglages",
    resetConfirm: "Réinitialiser tous les réglages de l’app ?",
    sections: {
      general: "Général",
      display: "Affichage",
      account: "Compte",
      analysis: "Analyse",
      importAi: "Import / lecture IA",
      reports: "Rapports",
      data: "Données",
      resources: "Ressources",
    },
    labels: {
      language: "Langue",
      theme: "Thème",
      brightness: "Luminosité de l’app",
      saturation: "Saturation",
      contrast: "Contraste",
      appFontSize: "Taille de l’app",
      accentColor: "Couleur principale de l’app",
      glassUi: "Interface effet verre",
      defaultSampleType: "Type d’échantillon par défaut",
      defaultCrop: "Culture par défaut",
      interpretationMethod: "Méthode d’interprétation",
      warningSensitivity: "Sensibilité des alertes",
      enableNutrientRatios: "Activer les ratios de nutriments",
      enablePhWarnings: "Activer les alertes de pH",
      defaultImportType: "Type d’import par défaut",
      aiReader: "Lecteur de documents",
      requireReviewBeforeSaving: "Exiger une révision avant l’enregistrement",
      aiConfidenceThreshold: "Seuil de confiance IA",
      defaultExportFormat: "Format d’export par défaut",
      includeLogo: "Inclure le logo",
      includeSummary: "Inclure le résumé",
      includeCharts: "Inclure les graphiques",
      includeHorizontalResultGraph: "Afficher le graphique horizontal des résultats",
      includeOriginalLabValues: "Inclure les valeurs originales",
      includeCalculationValues: "Inclure les valeurs de calcul dans les rapports",
      includeDopInReport: "Inclure les valeurs DOP dans les rapports",
      includeNutrientRatiosInReport: "Inclure les ratios nutritifs dans les rapports",
      autoSaveAnalyses: "Enregistrer les analyses automatiquement",
      autoSaveAnalysesHint:
        "Enregistrez chaque interprétation sur votre compte automatiquement. Hors ligne, les analyses sont mises en file sur cet appareil et synchronisées plus tard.",
      keepImportHistory: "Conserver l’historique d’import",
      permanentDeleteTime: "Suppression définitive (max. 30 jours)",
      showParameterDetails: "Afficher les détails des paramètres dans la saisie",
      showParameterSymbolsOnly: "Afficher seulement les symboles dans la saisie",
      downloadMethodology: "Télécharger la méthodologie de la calculatrice (PDF)",
    },
    resourcesDesc: "Documents de référence que vous pouvez télécharger et conserver hors ligne.",
    methodologyDesc:
      "Un document bilingue (espagnol/anglais) avec toutes les formules, étapes de calcul et tableaux de référence utilisés dans le module de calculatrice, avec citations.",
    methodologyGenerating: "Génération…",
    options: {
      english: "Anglais",
      spanish: "Espagnol",
      french: "Français",
      haitianCreole: "Créole haïtien",
      portuguese: "Portugais",
      swahili: "Swahili",
      system: "Système",
      light: "Clair",
      dark: "Sombre",
      darkBlack: "Noir profond",
      accentGreen: "Vert",
      accentTeal: "Sarcelle",
      accentBlue: "Bleu",
      accentAmber: "Ambre",
      accentRose: "Rose",
      accentViolet: "Violet",
      accentCyan: "Cyan",
      accentLime: "Citron vert",
      accentOrange: "Orange",
      accentFuchsia: "Fuchsia",
      soil: "Sol",
      foliar: "Foliaire",
      both: "Les deux",
      banana: "Banane",
      coffee: "Café",
      maize: "Maïs",
      rice: "Riz",
      tomato: "Tomate",
      sweetPepper: "Piment doux",
      sufficiencyRange: "Plage de suffisance",
      dop: "DOP",
      customRange: "Plage personnalisée",
      flexible: "Flexible",
      normal: "Normal",
      strict: "Strict",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Image",
      automatic: "Automatique",
      openaiVision: "Vision OpenAI",
      manualReviewOnly: "Révision manuelle seulement",
      days: "jours",
    },
  },
  ht: {
    back: "Retounen",
    title: "Paramèt app la",
    subtitle: "Ajiste app la pou travay laboratwa ou pi fasil.",
    saved: "Sove",
    local: "Lokal",
    unsaved: "Chanjman pa sove",
    save: "Sove paramèt yo",
    undo: "Defèt",
    redo: "Refèt",
    reset: "Reyajiste tout paramèt yo",
    resetConfirm: "Reyajiste tout paramèt app la?",
    sections: {
      general: "Jeneral",
      display: "Afichaj",
      account: "Kont",
      analysis: "Analiz",
      importAi: "Enpòte / lekti IA",
      reports: "Rapò",
      data: "Done",
      resources: "Resous",
    },
    labels: {
      language: "Lang",
      theme: "Tèm",
      brightness: "Klere app la",
      saturation: "Satirasyon",
      contrast: "Kontras",
      appFontSize: "Gwosè app la",
      accentColor: "Koulè prensipal app la",
      glassUi: "Entèfas vitre flou",
      defaultSampleType: "Kalite echantiyon pa defo",
      defaultCrop: "Kilti pa defo",
      interpretationMethod: "Metòd entèpretasyon",
      warningSensitivity: "Sansiblite avètisman",
      enableNutrientRatios: "Aktive rapò eleman nitritif yo",
      enablePhWarnings: "Aktive avètisman pH",
      defaultImportType: "Kalite enpòtasyon pa defo",
      aiReader: "Lektè dokiman",
      requireReviewBeforeSaving: "Mande revizyon anvan done enpòte yo sove",
      aiConfidenceThreshold: "Limit konfyans IA",
      defaultExportFormat: "Fòma ekspòtasyon pa defo",
      includeLogo: "Mete logo",
      includeSummary: "Mete rezime",
      includeCharts: "Mete grafik",
      includeHorizontalResultGraph: "Montre grafik orizontal rezilta yo",
      includeOriginalLabValues: "Mete valè laboratwa orijinal yo",
      includeCalculationValues: "Mete valè kalkil yo nan rapò yo",
      includeDopInReport: "Mete valè DOP yo nan rapò yo",
      includeNutrientRatiosInReport: "Mete rapò eleman nitritif yo nan rapò yo",
      autoSaveAnalyses: "Sove analiz yo otomatikman",
      autoSaveAnalysesHint:
        "Sove chak entèpretasyon sou kont ou otomatikman. Lè ou pa gen entènèt, analiz yo rete nan fil sou aparèy sa a epi yo senkronize pita.",
      keepImportHistory: "Kenbe istwa enpòtasyon",
      permanentDeleteTime: "Efasman pou tout tan (maks. 30 jou)",
      showParameterDetails: "Montre detay paramèt yo lè w ap antre valè",
      showParameterSymbolsOnly: "Montre senbòl sèlman lè w ap antre valè",
      downloadMethodology: "Telechaje metodoloji kalkilatè a (PDF)",
    },
    resourcesDesc: "Materyèl referans ou ka telechaje epi konsève san koneksyon.",
    methodologyDesc:
      "Yon dokiman bileng (Panyòl/Anglè) ak tout fòmil, etap kalkil, ak tablo referans yo itilize nan modil Kalkilatè a, ak sitasyon yo.",
    methodologyGenerating: "Ap jenere…",
    options: {
      english: "Anglè",
      spanish: "Espanyòl",
      french: "Fransè",
      haitianCreole: "Kreyòl ayisyen",
      portuguese: "Pòtigè",
      swahili: "Swahili",
      system: "Sistèm",
      light: "Klè",
      dark: "Fonse",
      darkBlack: "Fonse nwa",
      accentGreen: "Vèt",
      accentTeal: "Ble sarcel",
      accentBlue: "Ble",
      accentAmber: "Anba",
      accentRose: "Woz",
      accentViolet: "Vyolèt",
      accentCyan: "Syan",
      accentLime: "Sitwon vèt",
      accentOrange: "Zoranj",
      accentFuchsia: "Fichsya",
      soil: "Tè",
      foliar: "Fèy",
      both: "Tou de",
      banana: "Bannann",
      coffee: "Kafe",
      maize: "Mayi",
      rice: "Diri",
      tomato: "Tomat",
      sweetPepper: "Piman dous",
      sufficiencyRange: "Ranje sifizans",
      dop: "DOP",
      customRange: "Ranje pèsonalize",
      flexible: "Fleksib",
      normal: "Nòmal",
      strict: "Strik",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Imaj",
      automatic: "Otomatik",
      openaiVision: "Vizyon OpenAI",
      manualReviewOnly: "Revizyon manyèl sèlman",
      days: "jou",
    },
  },
  pt: {
    back: "Voltar",
    title: "Configurações do app",
    subtitle: "Mantenha o app confortável para seu fluxo de laboratório.",
    saved: "Salvo",
    local: "Local",
    unsaved: "Alterações não salvas",
    save: "Salvar configurações",
    undo: "Desfazer",
    redo: "Refazer",
    reset: "Redefinir todas as configurações",
    resetConfirm: "Redefinir todas as configurações do app?",
    sections: {
      general: "Geral",
      display: "Exibição",
      account: "Conta",
      analysis: "Análise",
      importAi: "Importação / leitor IA",
      reports: "Relatórios",
      data: "Dados",
      resources: "Recursos",
    },
    labels: {
      language: "Idioma",
      theme: "Tema",
      brightness: "Brilho do app",
      saturation: "Saturação",
      contrast: "Contraste",
      appFontSize: "Tamanho do app",
      accentColor: "Cor principal do app",
      glassUi: "Interface com efeito vidro",
      defaultSampleType: "Tipo de amostra padrão",
      defaultCrop: "Cultura padrão",
      interpretationMethod: "Método de interpretação",
      warningSensitivity: "Sensibilidade dos avisos",
      enableNutrientRatios: "Ativar relações de nutrientes",
      enablePhWarnings: "Ativar avisos de pH",
      defaultImportType: "Tipo de importação padrão",
      aiReader: "Leitor de documentos",
      requireReviewBeforeSaving: "Exigir revisão antes de salvar dados importados",
      aiConfidenceThreshold: "Limite de confiança IA",
      defaultExportFormat: "Formato de exportação padrão",
      includeLogo: "Incluir logo",
      includeSummary: "Incluir resumo",
      includeCharts: "Incluir gráficos",
      includeHorizontalResultGraph: "Mostrar gráfico horizontal de resultados",
      includeOriginalLabValues: "Incluir valores originais",
      includeCalculationValues: "Incluir valores de cálculos nos relatórios",
      includeDopInReport: "Incluir valores DOP nos relatórios",
      includeNutrientRatiosInReport: "Incluir relações de nutrientes nos relatórios",
      autoSaveAnalyses: "Salvar análises automaticamente",
      autoSaveAnalysesHint:
        "Salve cada interpretação na sua conta automaticamente. Offline, as análises ficam na fila neste dispositivo e sincronizam depois.",
      keepImportHistory: "Manter histórico de importação",
      permanentDeleteTime: "Exclusão permanente (máx. 30 dias)",
      showParameterDetails: "Mostrar detalhes dos parâmetros ao inserir valores",
      showParameterSymbolsOnly: "Mostrar apenas símbolos ao inserir valores",
      downloadMethodology: "Baixar metodologia da calculadora (PDF)",
    },
    resourcesDesc: "Material de referência que você pode baixar e manter offline.",
    methodologyDesc:
      "Um documento bilíngue (espanhol/inglês) com todas as fórmulas, etapas de cálculo e tabelas de referência usadas no módulo de calculadora, com citações.",
    methodologyGenerating: "Gerando…",
    options: {
      english: "Inglês",
      spanish: "Espanhol",
      french: "Francês",
      haitianCreole: "Crioulo haitiano",
      portuguese: "Português",
      swahili: "Suaíli",
      system: "Sistema",
      light: "Claro",
      dark: "Escuro",
      darkBlack: "Escuro preto",
      accentGreen: "Verde",
      accentTeal: "Azul-petróleo",
      accentBlue: "Azul",
      accentAmber: "Ámbar",
      accentRose: "Rosa",
      accentViolet: "Violeta",
      accentCyan: "Ciano",
      accentLime: "Lima",
      accentOrange: "Laranja",
      accentFuchsia: "Fúcsia",
      soil: "Solo",
      foliar: "Foliar",
      both: "Ambos",
      banana: "Banana",
      coffee: "Café",
      maize: "Milho",
      rice: "Arroz",
      tomato: "Tomate",
      sweetPepper: "Pimentão",
      sufficiencyRange: "Faixa de suficiência",
      dop: "DOP",
      customRange: "Faixa personalizada",
      flexible: "Flexível",
      normal: "Normal",
      strict: "Rígido",
      pdf: "PDF",
      excel: "Excel",
      csv: "CSV",
      image: "Imagem",
      automatic: "Automático",
      openaiVision: "Visão OpenAI",
      manualReviewOnly: "Somente revisão manual",
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
      display: "Onyesho",
      account: "Akaunti",
      analysis: "Uchambuzi",
      importAi: "Ingiza / kisomaji cha AI",
      reports: "Ripoti",
      data: "Data",
      resources: "Rasilimali",
    },
    labels: {
      language: "Lugha",
      theme: "Mandhari",
      brightness: "Mwangaza wa app",
      saturation: "Usawazishaji wa rangi",
      contrast: "Kontrasti",
      appFontSize: "Ukubwa wa app",
      accentColor: "Rangi kuu ya app",
      glassUi: "Kiolesura cha kioo chenye ukungu",
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
      includeHorizontalResultGraph: "Onyesha grafu ya mlalo ya matokeo",
      includeOriginalLabValues: "Jumuisha thamani asili za maabara",
      includeCalculationValues: "Jumuisha thamani za hesabu kwenye ripoti",
      includeDopInReport: "Jumuisha thamani za DOP kwenye ripoti",
      includeNutrientRatiosInReport: "Jumuisha uwiano wa virutubisho kwenye ripoti",
      autoSaveAnalyses: "Hifadhi uchambuzi kiotomatiki",
      autoSaveAnalysesHint:
        "Hifadhi kila tafsiri kwenye akaunti yako kiotomatiki. Bila mtandao, uchambuzi huwekwa kwenye foleni kwenye kifaa hiki na husawazishwa baadaye.",
      keepImportHistory: "Hifadhi historia ya kuingiza",
      permanentDeleteTime: "Kufuta kabisa (kiwango cha juu siku 30)",
      showParameterDetails: "Onyesha maelezo ya vigezo wakati wa kuingiza thamani",
      showParameterSymbolsOnly: "Onyesha alama pekee wakati wa kuingiza thamani",
      downloadMethodology: "Pakua mbinu za kikokotoo (PDF)",
    },
    resourcesDesc: "Nyenzo za marejeleo unazoweza kupakua na kuzitunza bila mtandao.",
    methodologyDesc:
      "Hati ya lugha mbili (Kihispania/Kiingereza) yenye fomula zote, hatua za hesabu, na majedwali ya marejeleo yanayotumika katika moduli ya Kikokotoo, pamoja na vyanzo.",
    methodologyGenerating: "Inatengeneza…",
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
      darkBlack: "Meusi kabisa",
      accentGreen: "Kijani",
      accentTeal: "Samawati-kijani",
      accentBlue: "Bluu",
      accentAmber: "Manjano",
      accentRose: "Waridi",
      accentViolet: "Zambarau",
      accentCyan: "Samawati",
      accentLime: "Limu",
      accentOrange: "Machungwa",
      accentFuchsia: "Fuksia",
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
  { value: "dark_black", label: text.options.darkBlack },
];

const accentOptions = (text: SettingsText): { value: AccentColor; label: string }[] => [
  { value: "green", label: text.options.accentGreen },
  { value: "teal", label: text.options.accentTeal },
  { value: "blue", label: text.options.accentBlue },
  { value: "amber", label: text.options.accentAmber },
  { value: "rose", label: text.options.accentRose },
  { value: "violet", label: text.options.accentViolet },
  { value: "cyan", label: text.options.accentCyan },
  { value: "lime", label: text.options.accentLime },
  { value: "orange", label: text.options.accentOrange },
  { value: "fuchsia", label: text.options.accentFuchsia },
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
  onFontSizeChange,
  onSettingsChange,
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
  const [canPortalToolbar, setCanPortalToolbar] = useState(false);
  const [downloadingMethodology, setDownloadingMethodology] = useState(false);

  const isDirty = useMemo(
    () => !settingsEqual(draftSettings, committedSettings),
    [draftSettings, committedSettings]
  );
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  useEffect(() => {
    queueMicrotask(() => setCanPortalToolbar(true));
    return () => {
      if (savedTimeout.current) window.clearTimeout(savedTimeout.current);
    };
  }, []);

  function previewSettings(
    nextSettings: AppSettings,
    previousSettings: AppSettings = draftSettings
  ) {
    const resolvedTheme = resolveThemePreference(nextSettings.general.theme);
    const darkVariant = resolveDarkVariantPreference(nextSettings.general.theme);
    if (nextSettings.general.language !== previousSettings.general.language) {
      onLanguageChange(nextSettings.general.language);
    }
    onThemePreferenceChange(nextSettings.general.theme);
    applyAccentColor(nextSettings.general.accentColor, resolvedTheme, darkVariant);
    applyBrightness(nextSettings.general.brightness);
    applySaturation(nextSettings.general.saturation);
    applyContrast(nextSettings.general.contrast);
    applyGlassUi(nextSettings.general.glassUi);
    onAccentChange?.(nextSettings.general.accentColor);
    onBrightnessChange?.(nextSettings.general.brightness);
    document.documentElement.style.setProperty(
      "--app-root-font-size",
      `${16 + nextSettings.general.appFontSizeDelta}px`
    );
    onFontSizeChange?.(nextSettings.general.appFontSizeDelta);
    onSettingsChange?.(nextSettings);
  }

  function showSavedFlash() {
    setSavedFlash(true);
    if (savedTimeout.current) window.clearTimeout(savedTimeout.current);
    savedTimeout.current = window.setTimeout(() => setSavedFlash(false), 1600);
  }

  function pushDraft(nextSettings: AppSettings) {
    const snapshot = cloneSettings(nextSettings);
    const previous = draftSettings;
    setDraftSettings(snapshot);
    previewSettings(snapshot, previous);

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
    const previous = draftSettings;
    setDraftSettings(snapshot);
    previewSettings(snapshot, previous);
  }

  function handleRedo() {
    if (!canRedo) return;
    const nextIndex = historyIndexRef.current + 1;
    historyIndexRef.current = nextIndex;
    setHistoryIndex(nextIndex);
    const snapshot = cloneSettings(history[nextIndex]);
    const previous = draftSettings;
    setDraftSettings(snapshot);
    previewSettings(snapshot, previous);
  }

  function handleSave() {
    if (!isDirty) return;
    const snapshot = cloneSettings(draftSettings);
    saveSettings(snapshot);
    setCommittedSettings(snapshot);
    previewSettings(snapshot);
    showSavedFlash();
  }

  async function handleDownloadMethodology() {
    if (downloadingMethodology) return;
    setDownloadingMethodology(true);
    try {
      await exportMethodologyPdf();
    } catch (error) {
      console.warn("Failed to generate methodology PDF:", error);
    } finally {
      setDownloadingMethodology(false);
    }
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
    <section className="animate-slide-up">
      <div
        className={`settings-page mx-auto w-full max-w-lg px-0 pt-0 ${
          isDirty
            ? "pb-[calc(4.75rem+env(safe-area-inset-bottom))]"
            : "pb-6"
        }`}
      >
        <div className="settings-page__header mb-2 flex items-center gap-2 pt-1 pb-0.5">
          <BackButton
            variant="icon"
            onClick={() => {
              if (isDirty) {
                previewSettings(committedSettings);
              }
              onBack();
            }}
            label={text.back}
          />
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold dark-text-primary">{text.title}</h1>
            {isDirty ? (
              <p className="mt-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                {text.unsaved}
              </p>
            ) : savedFlash ? (
              <p className="mt-0.5 text-xs font-semibold text-green-700 dark:text-green-400">
                {text.saved}
              </p>
            ) : null}
          </div>
          {isDirty ? (
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-green-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-green-800 active:scale-[0.98]"
            >
              <Save size={15} />
              <span>{text.save}</span>
            </button>
          ) : null}
        </div>

        <div className="settings-sections">
          <AccountSettingsSection language={language} session={session} />

          <SettingsSection title={text.sections.general}>
            <MenuSelect
              compact
              label={text.labels.language}
              value={draftSettings.general.language}
              options={languageOptions(text)}
              onChange={(value) => changeSetting("general", "language", value)}
            />
            <MenuSelect
              compact
              label={text.labels.defaultSampleType}
              value={draftSettings.general.defaultSampleType}
              options={sampleTypeOptions(text)}
              onChange={(value) =>
                changeSetting("general", "defaultSampleType", value)
              }
            />
            <MenuSelect
              compact
              label={text.labels.defaultCrop}
              value={draftSettings.general.defaultCrop}
              options={cropOptions(text)}
              onChange={(value) => changeSetting("general", "defaultCrop", value)}
            />
          </SettingsSection>

          <SettingsSection title={text.sections.display ?? "Display"}>
            <MenuSelect
              compact
              label={text.labels.theme}
              value={draftSettings.general.theme}
              options={themeOptions(text)}
              onChange={(value) => changeSetting("general", "theme", value)}
            />
            <div className="settings-accent-block">
              <MenuSelect
                compact
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
            <div className="settings-tone-panel">
              <RangeField
                inset
                label={text.labels.brightness}
                value={draftSettings.general.brightness}
                min={70}
                max={100}
                onChange={(value) => changeSetting("general", "brightness", value)}
              />
              <RangeField
                inset
                label={text.labels.saturation}
                value={draftSettings.general.saturation}
                min={70}
                max={100}
                onChange={(value) => changeSetting("general", "saturation", value)}
              />
              <RangeField
                inset
                label={text.labels.contrast}
                value={draftSettings.general.contrast}
                min={70}
                max={100}
                onChange={(value) => changeSetting("general", "contrast", value)}
              />
            </div>
            <RangeField
              label={text.labels.appFontSize}
              value={draftSettings.general.appFontSizeDelta}
              min={-2}
              max={5}
              suffix="px"
              onChange={(value) =>
                changeSetting("general", "appFontSizeDelta", value)
              }
            />
            <SwitchField
              label={text.labels.glassUi}
              checked={draftSettings.general.glassUi}
              onChange={(value) => changeSetting("general", "glassUi", value)}
            />
          </SettingsSection>

          <SettingsSection title={text.sections.analysis}>
            <MenuSelect
              compact
              label={text.labels.interpretationMethod}
              value={draftSettings.analysis.interpretationMethod}
              options={interpretationOptions(text)}
              onChange={(value) =>
                changeSetting("analysis", "interpretationMethod", value)
              }
            />
            <MenuSelect
              compact
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

          <SettingsSection title={text.sections.importAi}>
            <MenuSelect
              compact
              label={text.labels.defaultImportType}
              value={draftSettings.importAi.defaultImportType}
              options={importTypeOptions(text)}
              onChange={(value) =>
                changeSetting("importAi", "defaultImportType", value)
              }
            />
            <MenuSelect
              compact
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

          <SettingsSection title={text.sections.reports}>
            <MenuSelect
              compact
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
              label={text.labels.includeHorizontalResultGraph}
              checked={draftSettings.reports.includeHorizontalResultGraph}
              onChange={(value) =>
                changeSetting("reports", "includeHorizontalResultGraph", value)
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

          <SettingsSection title={text.sections.data}>
            <SwitchField
              label={text.labels.autoSaveAnalyses}
              hint={text.labels.autoSaveAnalysesHint}
              checked={draftSettings.data.autoSaveAnalyses}
              onChange={(value) => changeSetting("data", "autoSaveAnalyses", value)}
            />
            <SwitchField
              label={text.labels.keepImportHistory}
              checked={draftSettings.data.keepImportHistory}
              onChange={(value) => changeSetting("data", "keepImportHistory", value)}
            />
            <SwitchField
              label={text.labels.showParameterDetails}
              checked={draftSettings.data.showParameterDetails}
              onChange={(value) =>
                changeSetting("data", "showParameterDetails", value)
              }
            />
            <SwitchField
              label={text.labels.showParameterSymbolsOnly}
              checked={draftSettings.data.showParameterSymbolsOnly}
              onChange={(value) =>
                changeSetting("data", "showParameterSymbolsOnly", value)
              }
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
              className="settings-reset-btn mt-1 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-xl border border-red-200/90 bg-red-50/80 px-3 py-2 text-sm font-bold text-red-800 transition hover:bg-red-100"
            >
              <RotateCcw size={15} />
              {text.reset}
            </button>
          </SettingsSection>

          <SettingsSection title={text.sections.resources}>
            <p className="settings-resources-desc text-xs leading-relaxed text-[#6c6c70] dark:text-white/50">
              {text.resourcesDesc}
            </p>
            <div className="settings-resource-card">
              <p className="settings-resource-card__desc">{text.methodologyDesc}</p>
              <button
                type="button"
                onClick={handleDownloadMethodology}
                disabled={downloadingMethodology}
                className="settings-resource-card__btn"
              >
                {downloadingMethodology ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                <span>{downloadingMethodology ? text.methodologyGenerating : text.labels.downloadMethodology}</span>
              </button>
            </div>
          </SettingsSection>
        </div>

        {canPortalToolbar
          ? createPortal(
              <SettingsToolbar
                text={text}
                isDirty={isDirty}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={handleUndo}
                onRedo={handleRedo}
                onSave={handleSave}
              />,
              document.body
            )
          : null}
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
  "cyan",
  "lime",
  "orange",
  "fuchsia",
];

function AccentSwatches({
  value,
  onChange,
}: {
  value: AccentColor;
  onChange: (value: AccentColor) => void;
}) {
  return (
    <div className="settings-accent-swatches">
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
            className={`settings-accent-swatch ${selected ? "settings-accent-swatch--selected" : ""}`}
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
  if (!isDirty) return null;

  return (
    <div className="settings-save-toolbar">
      <div className="app-content-shell flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          title={text.undo}
          className="glass-icon-btn inline-flex h-10 w-10 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Undo2 size={16} />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          title={text.redo}
          className="glass-icon-btn inline-flex h-10 w-10 items-center justify-center rounded-xl disabled:cursor-not-allowed disabled:opacity-35"
        >
          <Redo2 size={16} />
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-800 active:scale-[0.98]"
        >
          <Save size={16} />
          {text.save}
        </button>
      </div>
    </div>
  );
}

function SettingsSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={`settings-section-flat ${open ? "settings-section-flat--open" : ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="settings-section__trigger"
        aria-expanded={open}
      >
        <span className="settings-section-title">{title}</span>
        <ChevronDown
          size={16}
          className={`settings-section-chevron shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open ? (
        <div className="settings-section__body">
          <div className="settings-fields">{children}</div>
        </div>
      ) : null}
    </section>
  );
}

function SwitchField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const id = useId();

  return (
    <label
      className={`settings-toggle-row${hint ? " settings-toggle-row--with-hint" : ""}`}
      htmlFor={id}
    >
      <span className="settings-toggle-row__copy">
        <span className="settings-toggle-row__label">{label}</span>
        {hint ? <span className="settings-toggle-row__hint">{hint}</span> : null}
      </span>
      <span className="settings-toggle">
        <input
          id={id}
          type="checkbox"
          role="switch"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="settings-toggle__input"
        />
        <span className="settings-toggle__track" aria-hidden />
        <span className="settings-toggle__thumb" aria-hidden />
      </span>
    </label>
  );
}

function RangeField({
  label,
  value,
  min,
  max,
  suffix = "%",
  inset = false,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  inset?: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div
      className={`settings-slider-row ${inset ? "settings-slider-row--inset" : ""}`}
    >
      <div className="settings-slider-row__head">
        <span className="settings-slider-row__label">{label}</span>
        <span className="settings-slider-row__value">
          {value} {suffix}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="settings-range settings-range--compact"
        aria-label={label}
        style={
          {
            "--range-progress": `${((value - min) / (max - min)) * 100}%`,
          } as CSSProperties
        }
      />
    </div>
  );
}

