"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { useDismissible } from "@/hooks/useDismissible";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Eraser,
  FlaskConical,
  BarChart3,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sprout,
  Table2,
  Upload,
} from "lucide-react";

import AppHeader from "@/components/AppHeader";
import AuthPanel from "@/components/AuthPanel";
import type { EditableAnalysisPayload } from "@/components/AnalysisHistory";
import CustomParameterModal from "@/components/CustomParameterModal";
import CustomParameterManager from "@/components/CustomParameterManager";
import CustomRangeManager from "@/components/CustomRangeManager";
import LabValueImporter from "@/components/LabValueImporter";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import ParameterCategoryFilter from "@/components/ParameterCategoryFilter";
import ResultsDashboard from "@/components/ResultsDashboard";
import RecycleBinScreen from "@/components/RecycleBinScreen";
import CalculatorHub from "@/components/CalculatorHub";
import AppSettingsScreen from "@/components/AppSettingsScreen";
import AboutScreen from "@/components/AboutScreen";
import AppDock from "@/components/ui/AppDock";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import HomeScreen from "@/components/HomeScreen";
import ImportDataScreen from "@/components/ImportDataScreen";

import BackButton from "@/components/ui/BackButton";
import { AppStep } from "@/lib/appSteps";
import { isAdminEmail } from "@/lib/admin";
import { exportAnalysisPdf } from "@/lib/pdfReport";
import { RequestTimeoutError } from "@/lib/fetchWithTimeout";
import { formatMessage, Language, translations } from "@/lib/translations";
import {
  applyAccentColor,
  applyTheme,
  applyVisualTone,
  persistLanguage,
  readStoredAccent,
  readStoredLanguage,
  readStoredTheme,
  resolveDarkVariantPreference,
  resolveThemePreference,
  type AppTheme,
} from "@/lib/uiPreferences";
import {
  defaultAppSettings,
  getSettings,
  updateSetting,
  type AppSettings,
} from "@/lib/appSettings";
import { translateCategory } from "@/lib/categoryLabels";
import { countries, countryRegions, type CountryRegion } from "@/lib/countries";
import { supabase } from "@/lib/supabase";
import {
  loadCropAliasMap,
  loadParameterAliasOptionsMap,
  loadUnitAliasOptionsMap,
} from "@/lib/aliases";
import {
  getFinalGroupCode,
  getLevelCode,
  getSimpleAdvice,
} from "@/lib/interpretationLogic";
import { calculateSoilTexture } from "@/lib/soilTexture";
import { canConvertLabUnit, convertLabUnit } from "@/lib/unitConversions";
import type { CalculationOutput } from "@/lib/agronomicCalculators";
import {
  GENERAL_CROP_EXTRACTION_OPTIONS,
  FOLIAR_SKIP_CROP_EXTRACTION_OPTIONS,
  getDefaultExtractionMethod,
  resolveInterpretationParameter,
  type ExtractionMethod,
} from "@/lib/extractionMethod";

type Crop = {
  crop_id: number;
  crop_name: string;
  display_name: string;
};

type Parameter = {
  parameter_key: string;
  parameter_id: number | null;
  custom_parameter_id: number | null;
  parameter_name: string;
  display_name: string;
  aliases?: string[];
  symbol: string | null;
  category: string | null;
  unit_id: number;
  unit_symbol: string;
  is_custom: boolean;
  available_units: {
    unit_id: number;
    unit_symbol: string;
    display_symbol: string;
    canonical_symbol?: string;
  }[];
};

type SupabaseUnitRelation =
  | {
      unit_id: number;
      unit_symbol: string;
    }
  | {
      unit_id: number;
      unit_symbol: string;
    }[]
  | null;

type OfficialParameterRow = {
  parameter_id: number;
  parameter_name: string;
  symbol: string | null;
  category: string | null;
  default_unit_id: number;
  units: SupabaseUnitRelation;
};

type CustomParameterRow = {
  custom_parameter_id: number;
  parameter_name: string;
  symbol: string | null;
  category: string | null;
  sample_type: "soil" | "foliar";
  default_unit_id: number;
  units: SupabaseUnitRelation;
};

type RangeMatch = {
  crop_id: number | null;
  crop_name: string | null;
  sample_type: string;
  parameter_id: number | null;
  custom_parameter_id?: number | null;
  parameter_name: string;
  unit_id: number;
  unit_symbol: string;
  min: number | null;
  max: number | null;
  confidence: string;
  is_proxy: boolean;
  source_name: string | null;
  interpretation_note?: string | null;
};

type InterpretationResult = RangeMatch & {
  value: number;
  level_code: string;
  final_group_code: string;
  advice: string;
  display_parameter_name: string;
};

type MissingResult = {
  parameter_key: string;
  parameter_id: number | null;
  custom_parameter_id: number | null;
  parameter_name: string;
  display_name: string;
  value: number;
};

type TextureSummary = {
  className: string;
  explanation: string;
  sand: number;
  silt: number;
  clay: number;
};

type UserCustomRange = {
  custom_range_id: number;
  custom_parameter_id: number | null;
  parameter_id: number | null;
  crop_id: number | null;
  sample_type: string;
  unit_id: number | null;
  min_value: number | null;
  max_value: number | null;
  interpretation_note: string | null;
  source_name: string | null;
};

type ParameterFilterGroup = "All" | "Chemical" | "Physical";
type ValueEntryView = "cards" | "table";
type ImportedLabMetadata = {
  labName?: string;
  clientName?: string;
  farmName?: string;
  lotName?: string;
  cropName?: string;
  reportDate?: string;
  sampleId?: string;
  analysisType?: string;
};

function normalizeParameterText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function normalizeForMatching(value: string | null | undefined) {
  return normalizeParameterText(value)
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTodayIsoDate() {
  const now = new Date();
  const offset = now.getTimezoneOffset();
  const local = new Date(now.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 10);
}

function buildSetupCropOptions(
  crops: Crop[],
  generalCropLabel: string
): { label: string; value: number }[] {
  const sorted = [...crops].sort((a, b) => {
    if (a.crop_id === 999) return -1;
    if (b.crop_id === 999) return 1;
    return a.display_name.localeCompare(b.display_name);
  });

  const options = sorted.map((crop) => ({
    label: crop.crop_id === 999 ? generalCropLabel : crop.display_name,
    value: crop.crop_id,
  }));

  if (!options.some((option) => option.value === 999)) {
    options.unshift({ label: generalCropLabel, value: 999 });
  }

  return options;
}

function getParameterFilterGroup(
  parameter: Pick<
    Parameter,
    "category" | "parameter_name" | "display_name" | "symbol"
  >
): Exclude<ParameterFilterGroup, "All"> {
  const text = normalizeParameterText(
    `${parameter.category || ""} ${parameter.parameter_name} ${parameter.display_name} ${
      parameter.symbol || ""
    }`
  );

  if (
    /\b(physical|fisic|physique|texture|textura|bulk density|densidad|porosity|porosite|porosidad|sand|sable|arena|silt|limo|limon|clay|arcilla|argile)\b/.test(
      text
    )
  ) {
    return "Physical";
  }

  return "Chemical";
}

function getUnitOptionKey(unit: {
  unit_id: number;
  unit_symbol: string;
  display_symbol: string;
  canonical_symbol?: string;
}) {
  return `${unit.unit_id}::${unit.display_symbol || unit.unit_symbol}`;
}

function getUnitSymbolForConversion(unit: {
  unit_symbol: string;
  display_symbol: string;
  canonical_symbol?: string;
}) {
  return unit.canonical_symbol || unit.unit_symbol || unit.display_symbol;
}

function getPreferredUnitDisplayKey(
  parameter: Parameter,
  selectedUnitId: number,
  currentDisplayKey?: string
) {
  const currentOption = currentDisplayKey
    ? parameter.available_units.find(
        (unit) => getUnitOptionKey(unit) === currentDisplayKey
      )
    : null;

  if (currentOption && currentOption.unit_id !== parameter.unit_id) {
    return currentDisplayKey || getUnitOptionKey(currentOption);
  }

  const preferredDisplay = getFriendlyUnitSymbol(
    parameter.unit_symbol || currentOption?.unit_symbol || ""
  );
  const preferredOption =
    parameter.available_units.find(
      (unit) =>
        unit.unit_id === selectedUnitId &&
        (unit.display_symbol || unit.unit_symbol) === preferredDisplay
    ) ||
    parameter.available_units.find((unit) => unit.unit_id === selectedUnitId) ||
    parameter.available_units[0];

  return preferredOption ? getUnitOptionKey(preferredOption) : "";
}

function getFriendlyUnitSymbol(unitSymbol: string) {
  const rawUnitSymbol = String(unitSymbol || "").trim();

  if (
    /\bMg\s*\/\s*m(?:3|\^3|³)\b/.test(rawUnitSymbol) ||
    /\bMg\s*m(?:-3|⁻3|−3)\b/.test(rawUnitSymbol)
  ) {
    return "g/cm3";
  }

  const compact = rawUnitSymbol
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\u00b5/g, "u")
    .replace(/\u207b/g, "-");

  const friendlySymbols: Record<string, string> = {
    "dag/kg": "%",
    "dagkg-1": "%",
    "ug/g": "mg/kg",
    "µg/g": "mg/kg",
    "mmhos/cm": "dS/m",
    "mmhoscm-1": "dS/m",
    "mmho/cm": "dS/m",
    "mmhocm-1": "dS/m",
    "meq100g-1": "meq/100g",
    "meq/100g-1": "meq/100g",
  };

  return friendlySymbols[compact] || unitSymbol;
}

function normalizeUnitSymbol(unitSymbol: string) {
  return getFriendlyUnitSymbol(unitSymbol)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function getPreferredFoliarUnitSymbol(parameter: {
  parameter_name: string;
  symbol: string | null;
  category: string | null;
}) {
  const symbol = String(parameter.symbol || "").trim().toLowerCase();
  const name = parameter.parameter_name.toLowerCase();
  const category = String(parameter.category || "").toLowerCase();

  if (
    category.includes("micro") ||
    category.includes("toxic") ||
    ["b", "cu", "fe", "mn", "zn", "al", "mo", "cl", "na", "si"].includes(symbol)
  ) {
    return "mg/kg";
  }

  if (
    category.includes("macro") ||
    ["n", "p", "k", "ca", "mg", "s"].includes(symbol) ||
    /\b(nitrogen|phosphorus|potassium|calcium|magnesium|sulfur|sulphur)\b/.test(name)
  ) {
    return "%";
  }

  return null;
}

function findUnitBySymbol(
  units: Array<{ unit_id: number; unit_symbol: string }>,
  unitSymbol: string | null
) {
  if (!unitSymbol) return null;
  const normalizedSymbol = normalizeUnitSymbol(unitSymbol);
  return (
    units.find((unit) => normalizeUnitSymbol(unit.unit_symbol) === normalizedSymbol) ||
    null
  );
}

function convertRangeToUnit(
  min: number | null,
  max: number | null,
  fromUnit: string,
  toUnit: string
) {
  if (!fromUnit || !toUnit || normalizeForMatching(fromUnit) === normalizeForMatching(toUnit)) {
    return { min, max, converted: false };
  }

  const minConverted =
    min === null ? null : convertLabUnit(min, fromUnit, toUnit)?.value ?? null;
  const maxConverted =
    max === null ? null : convertLabUnit(max, fromUnit, toUnit)?.value ?? null;

  if (
    (min !== null && minConverted === null) ||
    (max !== null && maxConverted === null)
  ) {
    return { min, max, converted: false };
  }

  return {
    min: minConverted,
    max: maxConverted,
    converted: true,
  };
}

function getParameterSortRank(parameter: Parameter) {
  const text = normalizeParameterText(
    `${parameter.display_name} ${parameter.parameter_name} ${parameter.symbol || ""}`
  );
  const rules: Array<[RegExp, number]> = [
    [/\b(organic matter|materia organica|matiere organique|matye oganik|om|mo)\b/, 10],
    [/\b(base saturation|saturacion de bases|saturation en bases)\b/, 20],
    [/\b(exchangeable acidity|acidez intercambiable|acidite echangeable|h\+al|al\+h)\b/, 30],
    [/\b(aluminium|aluminum|aluminio|aliminyom|al)\b/, 40],
    [/\bph\b.*\b(water|agua|eau|h2o)\b|\bph\b(?!.*kcl)/, 50],
    [/\bph\b.*\bkcl\b/, 60],
    [/\b(electric|electrical|conductivity|conductividad|conductivite|ec|ce)\b/, 70],
    [/\b(nitrate|nitrato|no3)\b/, 110],
    [/\b(ammonium|amonio|ammonio|nh4)\b/, 120],
    [/\b(nitrate.*ammonium|ammonium.*nitrate|no3.*nh4|nh4.*no3)\b/, 130],
    [/\b(phosphorus|fosforo|phosphore|p)\b/, 140],
    [/\b(potassium|potasio|potasyom|k)\b/, 150],
    [/\b(magnesium|magnesio|mg)\b/, 160],
    [/\b(calcium|calcio|kalsiyom|ca)\b/, 170],
    [/\b(sulfur|sulphur|azufre|soufre|so4|s)\b/, 180],
    [/\b(iron|hierro|fer|fe)\b/, 210],
    [/\b(manganese|manganeso|mn)\b/, 220],
    [/\b(copper|cobre|cuivre|cu)\b/, 230],
    [/\b(zinc|zn)\b/, 240],
    [/\b(boron|boro|bore|bo|b)\b/, 250],
    [/\b(sodium|sodio|na)\b/, 280],
    [/\b(chloride|cloruro|chlorure|cl)\b/, 290],
    [/\b(texture|textura|sand|silt|clay|bulk density|porosity)\b/, 320],
  ];

  for (const [pattern, rank] of rules) {
    if (pattern.test(text)) return rank;
  }

  return getParameterFilterGroup(parameter) === "Physical" ? 350 : 260;
}

function translateLevelCode(
  code: string,
  t: (typeof translations)[Language]
) {
  const key = code.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    very_high: t.levelVeryHigh,
    high: t.levelHigh,
    moderate: t.levelModerate,
    medium: t.levelModerate,
    low: t.levelLow,
    very_low: t.levelVeryLow,
    normal: t.levelNormal,
    acceptable: t.levelAcceptable,
    acidic: t.levelAcidic,
    neutral_ph: t.levelNeutralPh,
    alkaline: t.levelAlkaline,
  };

  return labels[key] || code;
}

function getLevelBadgeClass(code: string) {
  const key = code.toLowerCase().trim().replace(/[\s-]+/g, "_");

  if (key === "very_high") {
    return "level-badge level-badge-very-high";
  }

  if (key === "high") {
    return "level-badge level-badge-high";
  }

  if (key === "moderate" || key === "medium") {
    return "level-badge level-badge-moderate";
  }

  if (key === "low") {
    return "level-badge level-badge-low";
  }

  if (key === "very_low") {
    return "level-badge level-badge-very-low";
  }

  return "level-badge level-badge-normal";
}

function translateConfidence(
  confidence: string,
  t: (typeof translations)[Language]
) {
  const key = confidence.toLowerCase().trim().replace(/[\s-]+/g, "_");
  const labels: Record<string, string> = {
    user: t.confidenceUser,
    exact: t.confidenceExact,
    proxy: t.confidenceProxy,
    crop_proxy: t.confidenceProxy,
    general: t.confidenceGeneral,
  };

  return labels[key] || confidence;
}

function translateSourceName(
  sourceName: string | null,
  t: (typeof translations)[Language]
) {
  if (!sourceName) return t.notSpecified;

  const normalized = sourceName.toLowerCase().trim();
  const labels: Record<string, string> = {
    "user custom range - selected crop": t.userRangeSelectedCrop,
    "user custom range - general": t.userRangeGeneral,
    "user custom range": t.userCustomRange,
    "custom crop range": t.customCropRange,
    "general custom range": t.generalCustomRange,
    manual: t.manualSource,
    database: t.databaseSource,
    "official range": t.officialRangeSource,
    "official ranges": t.officialRangeSource,
  };

  return labels[normalized] || sourceName;
}

function translateCountryRegion(
  region: CountryRegion,
  t: (typeof translations)[Language]
) {
  const labels: Record<CountryRegion, string> = {
    Caribbean: t.regionCaribbean,
    "Central America": t.regionCentralAmerica,
    "North America": t.regionNorthAmerica,
    "South America": t.regionSouthAmerica,
    Europe: t.regionEurope,
    Africa: t.regionAfrica,
    Asia: t.regionAsia,
    Oceania: t.regionOceania,
  };

  return labels[region] || region;
}

function translateAdvice(
  result: InterpretationResult,
  t: (typeof translations)[Language]
) {
  const customAdvice = result.interpretation_note?.trim();

  if (customAdvice) {
    return customAdvice;
  }

  const name = result.parameter_name.toLowerCase();
  const level = result.level_code.toLowerCase();

  if (name.includes("bulk density") || name.includes("densidad aparente")) {
    if (level === "very_high") return t.adviceBulkDensityVeryHigh;
    if (level === "high") return t.adviceBulkDensityHigh;
    return t.adviceBulkDensityOk;
  }

  if (name === "ph" || name.includes("soil ph")) {
    if (level === "low") return t.advicePhLow;
    if (level === "high") return t.advicePhHigh;
    return t.advicePhOk;
  }

  if (
    name.includes("electrical conductivity") ||
    name === "ec" ||
    name.includes("conductividad")
  ) {
    if (level === "very_high") return t.adviceEcVeryHigh;
    if (level === "high") return t.adviceEcHigh;
    return t.adviceEcOk;
  }

  if (name === "na" || name.includes("sodium") || name.includes("sodio")) {
    if (level === "very_high") return t.adviceSodiumVeryHigh;
    if (level === "high") return t.adviceSodiumHigh;
    if (level === "moderate") return t.adviceSodiumModerate;
    return t.adviceSodiumOk;
  }

  if (name === "al" || name.includes("aluminum") || name.includes("aluminio")) {
    if (level === "high") return t.adviceAluminumHigh;
    return t.adviceAluminumOk;
  }

  if (level === "low") return t.adviceLow;
  if (level === "high") return t.adviceHigh;
  if (level === "very_high") return t.adviceVeryHigh;
  return t.adviceNormal;
}

const appSteps = new Set<AppStep>([
  "home",
  "import",
  "setup",
  "values",
  "results",
  "calculators",
  "history",
  "about",
  "recycle",
  "settings",
]);

function readHistoryStep(state: unknown): AppStep | null {
  if (!state || typeof state !== "object") return null;
  const step = (state as { alakayStep?: unknown }).alakayStep;
  return typeof step === "string" && appSteps.has(step as AppStep)
    ? (step as AppStep)
    : null;
}

export default function HomePage() {
  const [language, setLanguage] = useState<Language>("en");
  const t = translations[language];
  const [theme, setTheme] = useState<AppTheme>("light");

  const [currentStep, setCurrentStep] = useState<AppStep>("home");
  const currentStepRef = useRef<AppStep>("home");
  const historyReadyRef = useRef(false);
  const handlingPopStateRef = useRef(false);

  const [session, setSession] = useState<Session | null>(null);
  const [sessionRestoring, setSessionRestoring] = useState(true);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [guestMode, setGuestMode] = useState(false);

  const [crops, setCrops] = useState<Crop[]>([]);
  const [cropsLoading, setCropsLoading] = useState(false);

  const [parameters, setParameters] = useState<Parameter[]>([]);
  const [parametersSampleType, setParametersSampleType] = useState<
    "soil" | "foliar"
  >("soil");

  const [cropId, setCropId] = useState<number | "">(999);
  const [sampleType, setSampleType] = useState<"soil" | "foliar">("soil");
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMethod>("general");
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});
  const [selectedUnitDisplayKeys, setSelectedUnitDisplayKeys] = useState<
    Record<string, string>
  >({});
  const [appSettings, setAppSettings] = useState<AppSettings>(defaultAppSettings);

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAllParameters, setShowAllParameters] = useState(true);
  const [parameterSearch, setParameterSearch] = useState("");
  const [sortMode, setSortMode] = useState<"name" | "type">("type");

  const [showCustomParameterModal, setShowCustomParameterModal] =
    useState(false);
  const [customParameterDraft, setCustomParameterDraft] = useState<{
    parameterName?: string;
    unitSymbol?: string;
    applySodiumTropicalPreset?: boolean;
  } | null>(null);
  const [importerAutoRestoreToken, setImporterAutoRestoreToken] = useState(0);
  const resumeImporterAfterCustomParameterSaveRef = useRef(false);
  const customParameterSavedFromImporterRef = useRef(false);
  const [showCustomParameterManager, setShowCustomParameterManager] =
    useState(false);
  const [showCustomRangeManager, setShowCustomRangeManager] = useState(false);
  const [showLabValueImporter, setShowLabValueImporter] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [labValueImporterMode, setLabValueImporterMode] = useState<
    "scan" | "import"
  >("import");

  const [editingRootAnalysisId, setEditingRootAnalysisId] = useState<
    number | null
  >(null);
  const [editingNextVersionNumber, setEditingNextVersionNumber] = useState(1);
  const [pendingEditableAnalysis, setPendingEditableAnalysis] =
    useState<EditableAnalysisPayload | null>(null);

  const [results, setResults] = useState<InterpretationResult[]>([]);
  const [missingResults, setMissingResults] = useState<MissingResult[]>([]);
  const [calculatorOutputs, setCalculatorOutputs] = useState<CalculationOutput[]>([]);

  const [analysisName, setAnalysisName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [lotName, setLotName] = useState("");
  const [labName, setLabName] = useState("");
  const [samplingDate, setSamplingDate] = useState("");
  const [reportDate, setReportDate] = useState("");

  const [country, setCountry] = useState("");
  const [customCountry, setCustomCountry] = useState("");
  const [provinceState, setProvinceState] = useState("");

  const [message, setMessage] = useState("");
  const [saveMessage, setSaveMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAnalysisSignature, setSavedAnalysisSignature] = useState<
    string | null
  >(null);

  const finalCountry = country === "Other" ? customCountry.trim() : country;

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    const currentState = window.history.state;
    if (!readHistoryStep(currentState)) {
      window.history.replaceState(
        { ...currentState, alakayStep: currentStepRef.current },
        ""
      );
    }

    historyReadyRef.current = true;

    function handlePopState(event: PopStateEvent) {
      const nextStep = readHistoryStep(event.state);
      if (!nextStep) return;
      handlingPopStateRef.current = true;
      setCurrentStep(nextStep);
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, []);

  useEffect(() => {
    if (!historyReadyRef.current) return;
    if (handlingPopStateRef.current) {
      handlingPopStateRef.current = false;
      return;
    }

    if (readHistoryStep(window.history.state) === currentStep) return;
    window.history.pushState(
      { ...window.history.state, alakayStep: currentStep },
      ""
    );
  }, [currentStep]);

  useLayoutEffect(() => {
    setLanguage(readStoredLanguage());
    setTheme(readStoredTheme());
    setAppSettings(getSettings());
  }, []);

  useEffect(() => {
    const darkVariant = resolveDarkVariantPreference(appSettings.general.theme);
    applyTheme(theme, darkVariant);
    applyAccentColor(readStoredAccent(), theme, darkVariant);
    applyVisualTone();
    document.documentElement.style.setProperty(
      "--app-root-font-size",
      `${16 + getSettings().general.appFontSizeDelta}px`
    );
  }, [theme, appSettings.general.theme]);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    persistLanguage(nextLanguage);
    updateSetting("general", "language", nextLanguage);
  }

  useEffect(() => {
    if (!session?.user || guestMode) return;
    const key = `alakay-welcome-seen-${session.user.id}`;
    if (window.localStorage.getItem(key)) return;
    const frame = window.requestAnimationFrame(() => setShowWelcomeGuide(true));
    return () => window.cancelAnimationFrame(frame);
  }, [session?.user, guestMode]);

  function closeWelcomeGuide() {
    if (session?.user) {
      window.localStorage.setItem(`alakay-welcome-seen-${session.user.id}`, "1");
    }
    setShowWelcomeGuide(false);
  }

  function buildAnalysisSignature(sourceResults = results) {
    return JSON.stringify({
      cropId,
      sampleType,
      values,
      selectedUnits,
      results: sourceResults.map((result) => ({
        key: result.custom_parameter_id
          ? `c-${result.custom_parameter_id}`
          : `p-${result.parameter_id}`,
        value: result.value,
        unitId: result.unit_id,
        min: result.min,
        max: result.max,
        level: result.level_code,
        group: result.final_group_code,
      })),
    });
  }

  useEffect(() => {
    loadSession();

    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    loadCrops();
  }, [language]);

  useEffect(() => {
    loadParameters();
  }, [language, session, sampleType]);

  useEffect(() => {
    if (!pendingEditableAnalysis) return;

    if (parametersSampleType !== pendingEditableAnalysis.sampleType) return;

    const incomingValues: Record<string, string> = {};
    const incomingUnits: Record<string, number> = {};
    const incomingUnitDisplayKeys: Record<string, string> = {};

    for (const [key, value] of Object.entries(pendingEditableAnalysis.values)) {
      const normalizedKey =
        key.startsWith("p-") || key.startsWith("c-") ? key : `p-${key}`;

      incomingValues[normalizedKey] = value;
    }

    for (const [key, value] of Object.entries(
      pendingEditableAnalysis.selectedUnits
    )) {
      const normalizedKey =
        key.startsWith("p-") || key.startsWith("c-") ? key : `p-${key}`;

      incomingUnits[normalizedKey] = value;
      const parameter = parameters.find((item) => item.parameter_key === normalizedKey);
      const unitOption =
        parameter?.available_units.find((unit) => unit.unit_id === value) ||
        parameter?.available_units[0];
      if (unitOption) {
        incomingUnitDisplayKeys[normalizedKey] = getUnitOptionKey(unitOption);
      }
    }

    queueMicrotask(() => {
      setValues(incomingValues);

      setSelectedUnits((previous) => ({
        ...previous,
        ...incomingUnits,
      }));
      setSelectedUnitDisplayKeys((previous) => ({
        ...previous,
        ...incomingUnitDisplayKeys,
      }));

      setPendingEditableAnalysis(null);
    });
  }, [pendingEditableAnalysis, parametersSampleType, parameters]);

  function formatRequestError(error: unknown) {
    if (error instanceof RequestTimeoutError) {
      return t.connectionError;
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return t.connectionError;
  }

  async function loadSession() {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        throw error;
      }

      setSession(data.session);
    } catch (error) {
      console.error("loadSession:", error);
      setSession(null);
      setMessage(formatRequestError(error));
    } finally {
      setSessionRestoring(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null);
    setShowAuthScreen(false);
    setGuestMode(false);
    setCurrentStep("home");
  }

  async function loadCrops() {
    setCropsLoading(true);
    setMessage("");

    try {
      const { data, error } = await supabase
        .from("crops")
        .select("crop_id, crop_name")
        .order("crop_name");

      if (error) {
        setMessage(`${t.cropLoadingError}: ${error.message}`);
        setCrops([]);
        return;
      }

      if (!data || data.length === 0) {
        setMessage(t.noCropsFound);
        setCrops([]);
        return;
      }

      const cropIds = data.map((crop) => crop.crop_id);
      const aliasMap = await loadCropAliasMap(language, cropIds);

      const translatedCrops = data.map((crop) => ({
        crop_id: crop.crop_id,
        crop_name: crop.crop_name,
        display_name: aliasMap.get(crop.crop_id) || crop.crop_name,
      }));

      setCrops(translatedCrops);
    } catch (error) {
      console.error("loadCrops:", error);
      setCrops([]);
      setMessage(formatRequestError(error));
    } finally {
      setCropsLoading(false);
    }
  }

  async function loadParameters() {
    const column = sampleType;

    const { data, error } = await supabase
      .from("parameters")
      .select(
        `
        parameter_id,
        parameter_name,
        symbol,
        category,
        default_unit_id,
        units (
          unit_id,
          unit_symbol
        )
      `
      )
      .eq(column, true)
      .order("category")
      .order("parameter_name");

    if (error) {
      setMessage(error.message);
      return;
    }

    const officialRows = (data || []) as OfficialParameterRow[];

    const officialParameterIds = officialRows.map(
      (parameter) => parameter.parameter_id
    );

    const officialUnitIds = officialRows
      .map((row) => {
        const unitData = Array.isArray(row.units) ? row.units[0] : row.units;
        return unitData?.unit_id ?? row.default_unit_id;
      })
      .filter((id): id is number => typeof id === "number");

    let customRows: CustomParameterRow[] = [];

    if (session?.user) {
      const { data: customData, error: customError } = await supabase
        .from("user_custom_parameters")
        .select(
          `
          custom_parameter_id,
          parameter_name,
          symbol,
          category,
          sample_type,
          default_unit_id,
          units (
            unit_id,
            unit_symbol
          )
        `
        )
        .eq("user_id", session.user.id)
        .eq("sample_type", sampleType)
        .eq("is_deleted", false)
        .order("parameter_name");

      if (customError) {
        setMessage(customError.message);
        return;
      }

      customRows = (customData || []) as CustomParameterRow[];
    }

    const customUnitIds = customRows
      .map((row) => {
        const unitData = Array.isArray(row.units) ? row.units[0] : row.units;
        return unitData?.unit_id ?? row.default_unit_id;
      })
      .filter((id): id is number => typeof id === "number");

    const unitIds = [...officialUnitIds, ...customUnitIds];
    const { data: allUnitsData, error: allUnitsError } = await supabase
      .from("units")
      .select("unit_id, unit_symbol")
      .order("unit_symbol");

    if (allUnitsError) {
      setMessage(allUnitsError.message);
      return;
    }

    const allUnits = (allUnitsData || []) as Array<{
      unit_id: number;
      unit_symbol: string;
    }>;

    const parameterAliasOptionsMap = await loadParameterAliasOptionsMap(
      language,
      officialParameterIds
    );

    const unitAliasOptionsMap = await loadUnitAliasOptionsMap(language, unitIds);

    function buildExpandedUnitOptions(
      baseUnitId: number,
      baseUnitSymbol: string,
      initialOptions: {
        unit_id: number;
        unit_symbol: string;
        display_symbol: string;
      }[],
      preferredUnitId = baseUnitId,
      preferredUnitSymbol = baseUnitSymbol
    ) {
      const options = initialOptions.map((option) => ({
        ...option,
        display_symbol: getFriendlyUnitSymbol(option.display_symbol || option.unit_symbol),
        canonical_symbol: option.unit_symbol,
      }));
      const seen = new Set(options.map((option) => getUnitOptionKey(option)));

      if (preferredUnitId && preferredUnitSymbol) {
        const preferredOption = {
          unit_id: preferredUnitId,
          unit_symbol: preferredUnitSymbol,
          display_symbol: getFriendlyUnitSymbol(preferredUnitSymbol),
          canonical_symbol: preferredUnitSymbol,
        };
        const key = getUnitOptionKey(preferredOption);
        if (!seen.has(key)) {
          options.push(preferredOption);
          seen.add(key);
        }
      }

      for (const candidate of allUnits) {
        if (!canConvertLabUnit(baseUnitSymbol, candidate.unit_symbol)) continue;
        const option = {
          unit_id: candidate.unit_id,
          unit_symbol: candidate.unit_symbol,
          display_symbol: getFriendlyUnitSymbol(candidate.unit_symbol),
          canonical_symbol: candidate.unit_symbol,
        };
        const key = getUnitOptionKey(option);
        if (!seen.has(key)) {
          options.push(option);
          seen.add(key);
        }
      }

      options.sort((left, right) => {
        if (left.unit_id === preferredUnitId) return -1;
        if (right.unit_id === preferredUnitId) return 1;
        if (left.unit_id === baseUnitId) return -1;
        if (right.unit_id === baseUnitId) return 1;
        return left.display_symbol.localeCompare(right.display_symbol);
      });

      return options;
    }

    const officialParameters: Parameter[] = officialRows.map((row) => {
      const unitData = Array.isArray(row.units) ? row.units[0] : row.units;

      const databaseUnitId = unitData?.unit_id ?? row.default_unit_id;
      const databaseUnitSymbol = unitData?.unit_symbol ?? "";
      const foliarPreferredUnit = sampleType === "foliar"
        ? findUnitBySymbol(allUnits, getPreferredFoliarUnitSymbol(row))
        : null;
      const unitId = foliarPreferredUnit?.unit_id ?? databaseUnitId;
      const unitSymbol = foliarPreferredUnit?.unit_symbol ?? databaseUnitSymbol;

      return {
        parameter_key: `p-${row.parameter_id}`,
        parameter_id: row.parameter_id,
        custom_parameter_id: null,
        parameter_name: row.parameter_name,
        display_name:
          parameterAliasOptionsMap.get(row.parameter_id)?.[0] || row.parameter_name,
        aliases: parameterAliasOptionsMap.get(row.parameter_id) || [],
        symbol: row.symbol,
        category: row.category,
        unit_id: unitId,
        unit_symbol: unitSymbol,
        is_custom: false,
        available_units: buildExpandedUnitOptions(
          databaseUnitId,
          databaseUnitSymbol,
          unitAliasOptionsMap.get(databaseUnitId) || [
            {
              unit_id: databaseUnitId,
              unit_symbol: databaseUnitSymbol,
              display_symbol: getFriendlyUnitSymbol(databaseUnitSymbol),
            },
          ],
          unitId,
          unitSymbol
        ),
      };
    });

    const customParameters: Parameter[] = customRows.map((row) => {
      const unitData = Array.isArray(row.units) ? row.units[0] : row.units;

      const unitId = unitData?.unit_id ?? row.default_unit_id;
      const unitSymbol = unitData?.unit_symbol ?? "";
      const displayUnitSymbol = getFriendlyUnitSymbol(unitSymbol);

      return {
        parameter_key: `c-${row.custom_parameter_id}`,
        parameter_id: null,
        custom_parameter_id: row.custom_parameter_id,
        parameter_name: row.parameter_name,
        display_name: row.parameter_name,
        aliases: [],
        symbol: row.symbol,
        category: row.category || "Custom",
        unit_id: unitId,
        unit_symbol: unitSymbol,
        is_custom: true,
        available_units: buildExpandedUnitOptions(
          unitId,
          unitSymbol,
          unitAliasOptionsMap.get(unitId) || [
            {
              unit_id: unitId,
              unit_symbol: unitSymbol,
              display_symbol: displayUnitSymbol,
            },
          ]
        ),
      };
    });

    const formattedParameters = [...officialParameters, ...customParameters];

    setParameters(formattedParameters);
    setParametersSampleType(column);

    const defaultSelectedUnits: Record<string, number> = {};
    const defaultSelectedUnitDisplayKeys: Record<string, string> = {};

    for (const parameter of formattedParameters) {
      defaultSelectedUnits[parameter.parameter_key] = parameter.unit_id;
      const defaultUnit = parameter.available_units[0];
      if (defaultUnit) {
        defaultSelectedUnitDisplayKeys[parameter.parameter_key] =
          getUnitOptionKey(defaultUnit);
      }
    }

    const sampleTypeChanged = parametersSampleType !== column;

    setSelectedUnits((previous) =>
      sampleTypeChanged
        ? { ...previous, ...defaultSelectedUnits }
        : { ...defaultSelectedUnits, ...previous }
    );
    setSelectedUnitDisplayKeys((previous) =>
      sampleTypeChanged
        ? { ...previous, ...defaultSelectedUnitDisplayKeys }
        : { ...defaultSelectedUnitDisplayKeys, ...previous }
    );
  }

  function updateValue(parameterKey: string, newValue: string) {
    setValues((previous) => ({
      ...previous,
      [parameterKey]: newValue,
    }));
    setResults([]);
    setMissingResults([]);
    setSavedAnalysisSignature(null);
    setSaveMessage("");
    setSavedAnalysisSignature(null);
  }

function updateUnit(parameterKey: string, unitId: number, displayKey?: string) {
    setSelectedUnits((previous) => ({
      ...previous,
      [parameterKey]: unitId,
    }));
    if (displayKey) {
      setSelectedUnitDisplayKeys((previous) => ({
        ...previous,
        [parameterKey]: displayKey,
      }));
    }
    setResults([]);
    setMissingResults([]);
    setSavedAnalysisSignature(null);
    setSaveMessage("");
  }

  function clearAllValues() {
    setValues({});
    setResults([]);
    setMissingResults([]);
    setSavedAnalysisSignature(null);
    setSaveMessage("");
    setMessage("");
  }

  function resetSampleTypeState(nextSampleType: "soil" | "foliar") {
    if (nextSampleType === sampleType) return;

    const hasValues = Object.values(values).some((value) => value?.trim());
    if (hasValues) {
      const keepValues = window.confirm(
        "You have entered values. Keep them while switching sample type?"
      );

      if (keepValues) {
        setSampleType(nextSampleType);
        setMessage("Values were kept. Review units and ranges for the new sample type.");
        return;
      }
    }

    setSampleType(nextSampleType);
    setValues({});
    setSelectedUnits({});
    setSelectedUnitDisplayKeys({});
    setResults([]);
    setMissingResults([]);
    setSelectedCategory("All");
    setShowAllParameters(true);
    setParameterSearch("");
    setSortMode("type");
    setSaveMessage("");
    setSavedAnalysisSignature(null);

    if (!pendingEditableAnalysis) {
      setMessage("");
    }
  }

  function importLabValues(
    importedValues: Record<string, string>,
    importedUnits: Record<string, number>,
    metadata?: ImportedLabMetadata,
    importedUnitDisplayKeys: Record<string, string> = {}
  ) {
    applyImportedMetadata(metadata);

    setValues((previous) => ({
      ...previous,
      ...importedValues,
    }));

    setSelectedUnits((previous) => ({
      ...previous,
      ...importedUnits,
    }));
    setSelectedUnitDisplayKeys((previous) => {
      const next = { ...previous };
      for (const [key, unitId] of Object.entries(importedUnits)) {
        const parameter = parameters.find((item) => item.parameter_key === key);
        const unitOption =
          parameter?.available_units.find(
            (unit) => getUnitOptionKey(unit) === importedUnitDisplayKeys[key]
          ) ||
          parameter?.available_units.find((unit) => unit.unit_id === unitId) ||
          parameter?.available_units[0];
        if (unitOption) next[key] = getUnitOptionKey(unitOption);
      }
      return next;
    });

    setResults([]);
    setMissingResults([]);
    setSaveMessage("");
    setSavedAnalysisSignature(null);
    setMessage(
      formatMessage(t.valuesImported, {
        count: Object.keys(importedValues).length,
      })
    );
    setCurrentStep("values");
  }

  function requestCreateCustomParameterFromImport(draft: {
    parameterName: string;
    unitSymbol?: string;
  }) {
    const normalizedUnit = normalizeForMatching(draft.unitSymbol || "");
    const unitOption = parameters
      .flatMap((parameter) => parameter.available_units)
      .find((unit) => {
        const symbols = [
          unit.display_symbol,
          unit.unit_symbol,
          unit.canonical_symbol || "",
        ].map((value) => normalizeForMatching(value));
        return symbols.includes(normalizedUnit);
      });

    const normalizedName = normalizeForMatching(draft.parameterName);
    const looksLikeSodium =
      /\b(sodio|sodium|na)\b/.test(normalizedName) &&
      !/\b(nitrato|nitrate|nitrogen|nitrogeno)\b/.test(normalizedName);
    const looksLikeCec =
      /\b(cice|cic|cec|cation exchange capacity|intercambio cationico)\b/.test(
        normalizedName
      );

    setCustomParameterDraft({
      parameterName: draft.parameterName,
      unitSymbol:
        unitOption?.unit_symbol ||
        draft.unitSymbol ||
        (looksLikeSodium || looksLikeCec ? "cmol(+)/kg" : undefined),
      applySodiumTropicalPreset: looksLikeSodium,
    });
    resumeImporterAfterCustomParameterSaveRef.current = true;
    customParameterSavedFromImporterRef.current = false;
    setShowLabValueImporter(false);
    setShowCustomParameterModal(true);
  }

  function applyImportedMetadata(metadata?: ImportedLabMetadata) {
    if (!metadata) return;

    const detectedType = String(metadata.analysisType || "").toLowerCase();
    if (detectedType.includes("foliar") || detectedType.includes("leaf")) {
      setSampleType("foliar");
    } else if (detectedType.includes("soil") || detectedType.includes("suelo")) {
      setSampleType("soil");
    }

    if (metadata.labName?.trim()) setLabName(metadata.labName.trim());
    if (metadata.farmName?.trim()) setFarmName(metadata.farmName.trim());
    if (metadata.lotName?.trim()) setLotName(metadata.lotName.trim());
    if (metadata.reportDate?.trim()) setReportDate(metadata.reportDate.trim());
    if (metadata.cropName?.trim()) {
      const normalizedCrop = normalizeForMatching(metadata.cropName);
      const matchedCrop = crops.find((crop) =>
        [crop.crop_name, crop.display_name].some((name) =>
          normalizeForMatching(name).includes(normalizedCrop) ||
          normalizedCrop.includes(normalizeForMatching(name))
        )
      );
      if (matchedCrop) setCropId(matchedCrop.crop_id);
    }

  }

  function resetAnalysis() {
    setCropId(999);
    setSampleType("soil");
    setValues({});
    setSelectedUnits({});
    setSelectedUnitDisplayKeys({});
    setSelectedCategory("All");
    setShowAllParameters(true);
    setParameterSearch("");
    setSortMode("type");
    setResults([]);
    setMissingResults([]);
    setAnalysisName("");
    setFarmName("");
    setLotName("");
    setLabName("");
    setSamplingDate("");
    setReportDate("");
    setCountry("");
    setCustomCountry("");
    setProvinceState("");
    setMessage("");
    setSaveMessage("");
    setSavedAnalysisSignature(null);
    setEditingRootAnalysisId(null);
    setEditingNextVersionNumber(1);
    setPendingEditableAnalysis(null);
    setExtractionMethod("general");
    setCurrentStep("setup");
  }

  function loadEditableAnalysis(payload: EditableAnalysisPayload) {
    setCropId(payload.cropId);
    setAnalysisName(payload.analysisName);
    setFarmName(payload.farmName);
    setLotName(payload.lotName);
    setLabName(payload.labName);
    setCountry(payload.country);
    setCustomCountry("");
    setProvinceState(payload.provinceState);
    setSamplingDate(payload.samplingDate);
    setReportDate(payload.reportDate);

    setResults([]);
    setMissingResults([]);
    setSaveMessage("");

    setEditingRootAnalysisId(payload.rootAnalysisId);
    setEditingNextVersionNumber(payload.nextVersionNumber);
    setPendingEditableAnalysis(payload);

    setMessage(
      formatMessage(t.editingAnalysis, {
        id: payload.analysisId,
        version: payload.nextVersionNumber,
      })
    );


    setCurrentStep("values");
    setSampleType(payload.sampleType);
  }

  function goToValues() {
    setSamplingDate((current) => current || getTodayIsoDate());
    setMessage("");
    setCurrentStep("values");
  }

  async function findUserCustomRange(item: {
    parameter_id: number | null;
    custom_parameter_id: number | null;
    unit_id: number;
  }) {
    if (!session?.user || guestMode || !cropId) return null;
  
    let query = supabase
      .from("user_custom_ranges")
      .select(
        `
        custom_range_id,
        custom_parameter_id,
        parameter_id,
        crop_id,
        sample_type,
        unit_id,
        min_value,
        max_value,
        interpretation_note,
        source_name
      `
      )
      .eq("user_id", session.user.id)
      .eq("sample_type", sampleType)
      .eq("is_deleted", false);
  
    if (item.custom_parameter_id) {
      query = query
        .eq("custom_parameter_id", item.custom_parameter_id)
        .is("parameter_id", null);
    } else if (item.parameter_id) {
      query = query
        .eq("parameter_id", item.parameter_id)
        .is("custom_parameter_id", null);
    } else {
      return null;
    }
  
    const { data, error } = await query;
  
    if (error) {
      throw new Error(error.message);
    }
  
    const rows = ((data || []) as UserCustomRange[]).filter((range) => {
      const cropMatches = range.crop_id === cropId || range.crop_id === null;
      const unitMatches = range.unit_id === item.unit_id || range.unit_id === null;
  
      return cropMatches && unitMatches;
    });
  
    if (rows.length === 0) return null;
  
    const exactCropExactUnit = rows.find(
      (range) => range.crop_id === cropId && range.unit_id === item.unit_id
    );
  
    if (exactCropExactUnit) return exactCropExactUnit;
  
    const generalCropExactUnit = rows.find(
      (range) => range.crop_id === null && range.unit_id === item.unit_id
    );
  
    if (generalCropExactUnit) return generalCropExactUnit;
  
    const exactCropAnyUnit = rows.find(
      (range) => range.crop_id === cropId && range.unit_id === null
    );
  
    if (exactCropAnyUnit) return exactCropAnyUnit;
  
    const generalCropAnyUnit = rows.find(
      (range) => range.crop_id === null && range.unit_id === null
    );
  
    if (generalCropAnyUnit) return generalCropAnyUnit;
  
    return rows[0] || null;
  }

  async function interpretAnalysis() {
    setMessage("");
    setSaveMessage("");
    setResults([]);
    setMissingResults([]);

    if (!cropId) {
      setMessage(t.selectCropOnValues || t.selectCropMessage);
      return;
    }

    const filledValues = parameters
      .map((parameter) => {
        const rawValue = values[parameter.parameter_key];

        if (!rawValue || rawValue.trim() === "") {
          return null;
        }

        const numericValue = Number(rawValue.replace(",", "."));

        if (Number.isNaN(numericValue)) {
          return null;
        }

        const selectedUnitId = selectedUnits[parameter.parameter_key] || parameter.unit_id;
        const selectedUnitDisplayKey = selectedUnitDisplayKeys[parameter.parameter_key];
        const selectedUnit =
          parameter.available_units.find(
            (unit) =>
              getUnitOptionKey(unit) === selectedUnitDisplayKey &&
              unit.unit_id === selectedUnitId
          ) ||
          parameter.available_units.find((unit) => unit.unit_id === selectedUnitId) ||
          parameter.available_units[0];

        return {
          parameter_key: parameter.parameter_key,
          parameter_id: parameter.parameter_id,
          custom_parameter_id: parameter.custom_parameter_id,
          parameter_name: parameter.parameter_name,
          display_name: parameter.display_name,
          value: numericValue,
          unit_id: selectedUnitId,
          unit_symbol:
            selectedUnit?.display_symbol ||
            selectedUnit?.unit_symbol ||
            parameter.unit_symbol,
          is_custom: parameter.is_custom,
        };
      })
      .filter(Boolean) as {
      parameter_key: string;
      parameter_id: number | null;
      custom_parameter_id: number | null;
      parameter_name: string;
      display_name: string;
      value: number;
      unit_id: number;
      unit_symbol: string;
      is_custom: boolean;
    }[];

    if (filledValues.length === 0) {
      setMessage(t.enterOneValueMessage);
      return;
    }

    setLoading(true);

    const interpretedResults: InterpretationResult[] = [];
    const notFoundResults: MissingResult[] = [];
    const rpcQueue: typeof filledValues = [];

    try {
    for (const item of filledValues) {
        const userRange = await findUserCustomRange({
          parameter_id: item.parameter_id,
          custom_parameter_id: item.custom_parameter_id,
          unit_id: item.unit_id,
        });

        if (userRange) {
          const logicInput = {
            parameter_id: item.parameter_id || 0,
            parameter_name: item.parameter_name,
            value: item.value,
            min: userRange.min_value,
            max: userRange.max_value,
          };

          interpretedResults.push({
            crop_id: userRange.crop_id,
            crop_name: userRange.crop_id
              ? t.customCropRange
              : t.generalCustomRange,
            sample_type: sampleType,
            parameter_id: item.parameter_id,
            custom_parameter_id: item.custom_parameter_id,
            parameter_name: item.parameter_name,
            unit_id: userRange.unit_id || item.unit_id,
            unit_symbol: item.unit_symbol,
            min: userRange.min_value,
            max: userRange.max_value,
            confidence: "user",
            is_proxy: false,
            source_name:
  userRange.source_name ||
  (userRange.crop_id === cropId
    ? t.userRangeSelectedCrop
    : t.userRangeGeneral),
            interpretation_note: userRange.interpretation_note,
            value: item.value,
            level_code: getLevelCode(logicInput),
            final_group_code: getFinalGroupCode(logicInput),
            advice:
              userRange.interpretation_note?.trim() ||
              getSimpleAdvice(logicInput),
            display_parameter_name: item.display_name,
          });

          continue;
        }

        if (item.custom_parameter_id) {
          notFoundResults.push({
            parameter_key: item.parameter_key,
            parameter_id: item.parameter_id,
            custom_parameter_id: item.custom_parameter_id,
            parameter_name: item.parameter_name,
            display_name: item.display_name,
            value: item.value,
          });

          continue;
        }

        rpcQueue.push(item);
    }

    const parameterCatalog = parameters.map((parameter) => ({
      parameter_id: parameter.parameter_id,
      parameter_name: parameter.parameter_name,
      display_name: parameter.display_name,
      symbol: parameter.symbol,
    }));

    const rpcOutcomes = await Promise.all(
      rpcQueue.map(async (item) => {
        const resolved = resolveInterpretationParameter(
          {
            parameter_id: item.parameter_id,
            parameter_name: item.parameter_name,
            display_name: item.display_name,
            symbol:
              parameters.find(
                (parameter) => parameter.parameter_key === item.parameter_key
              )?.symbol ?? null,
          },
          parameterCatalog,
          extractionMethod
        );

        const { data, error } = await supabase.rpc("get_range_match", {
          input_crop_id: interpretationCropId,
          input_sample_type: sampleType,
          input_parameter_id: resolved.parameter_id,
        });

        return { item, data, error, resolved };
      })
    );

    for (const outcome of rpcOutcomes) {
      const { item, data, error } = outcome;

      if (error) {
        throw error;
      }

      if (!data || data.length === 0) {
        notFoundResults.push({
          parameter_key: item.parameter_key,
          parameter_id: item.parameter_id,
          custom_parameter_id: item.custom_parameter_id,
          parameter_name: item.parameter_name,
          display_name: item.display_name,
          value: item.value,
        });
        continue;
      }

      const range = data[0] as RangeMatch;
      const convertedRange = convertRangeToUnit(
        range.min,
        range.max,
        range.unit_symbol,
        item.unit_symbol
      );
      const rangeMin = convertedRange.min;
      const rangeMax = convertedRange.max;
      const rangeUnitSymbol = convertedRange.converted
        ? item.unit_symbol
        : range.unit_symbol;

      const logicInput = {
        parameter_id: item.parameter_id || 0,
        parameter_name: item.parameter_name,
        value: item.value,
        min: rangeMin,
        max: rangeMax,
      };

      interpretedResults.push({
        ...range,
        custom_parameter_id: null,
        unit_symbol: rangeUnitSymbol,
        min: rangeMin,
        max: rangeMax,
        value: item.value,
        level_code: getLevelCode(logicInput),
        final_group_code: getFinalGroupCode(logicInput),
        advice: getSimpleAdvice(logicInput),
        display_parameter_name: item.display_name,
      });
    }

    setResults(interpretedResults);
    setMissingResults(notFoundResults);
    setSavedAnalysisSignature(null);
    setSaveMessage("");
    setCurrentStep("results");

    if (interpretedResults.length === 0 && notFoundResults.length > 0) {
      setMessage(t.noRangeFoundDesc);
    }
    } catch (error) {
      console.error("interpretAnalysis:", error);
      setMessage(formatRequestError(error));
    } finally {
      setLoading(false);
    }
  }

  async function saveAnalysis() {
    setSaveMessage("");

    if (!session?.user || guestMode) {
      setSaveMessage(t.loginToSave);
      return;
    }

    if (!cropId) {
      setSaveMessage(t.selectCropMessage);
      return;
    }

    if (results.length === 0) {
      setSaveMessage(t.interpretBeforeSaving);
      return;
    }

    const signature = buildAnalysisSignature();

    if (savedAnalysisSignature === signature) {
      setSaveMessage(t.analysisAlreadySaved);
      return;
    }

    setSaving(true);

    const sampleTypeId = sampleType === "soil" ? 1 : 2;
    const userId = session.user.id;

    let farmId: number | null = null;
    let lotId: number | null = null;
    let labId: number | null = null;

    if (farmName.trim()) {
      const { data: farmData, error: farmError } = await supabase
        .from("farms")
        .insert({
          user_id: userId,
          farm_name: farmName.trim(),
          location: [provinceState.trim(), finalCountry]
            .filter(Boolean)
            .join(", "),
        })
        .select("farm_id")
        .single();

      if (farmError) {
        setSaving(false);
        setSaveMessage(farmError.message);
        return;
      }

      farmId = farmData.farm_id;
    }

    if (lotName.trim() && farmId) {
      const { data: lotData, error: lotError } = await supabase
        .from("lots")
        .insert({
          farm_id: farmId,
          lot_name: lotName.trim(),
        })
        .select("lot_id")
        .single();

      if (lotError) {
        setSaving(false);
        setSaveMessage(lotError.message);
        return;
      }

      lotId = lotData.lot_id;
    }

    if (labName.trim()) {
      const { data: labData, error: labError } = await supabase
        .from("labs")
        .insert({
          user_id: userId,
          lab_name: labName.trim(),
        })
        .select("lab_id")
        .single();

      if (labError) {
        setSaving(false);
        setSaveMessage(labError.message);
        return;
      }

      labId = labData.lab_id;
    }

    const { data: analysisData, error: analysisError } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        crop_id: cropId,
        sample_type_id: sampleTypeId,
        farm_id: farmId,
        lot_id: lotId,
        lab_id: labId,
        parent_analysis_id: editingRootAnalysisId,
        version_number: editingRootAnalysisId ? editingNextVersionNumber : 1,
        is_deleted: false,
        analysis_name:
          analysisName.trim() ||
          `${sampleType} analysis - ${new Date().toLocaleDateString()}`,
        sampling_date: samplingDate || getTodayIsoDate(),
        report_date: reportDate || null,
        country: finalCountry || null,
        province_state: provinceState.trim() || null,
        latitude: null,
        longitude: null,
        location_source: finalCountry || provinceState.trim() ? "manual" : null,
        status: "completed",
      })
      .select("analysis_id")
      .single();

    if (analysisError) {
      setSaving(false);
      setSaveMessage(analysisError.message);
      return;
    }

    const analysisId = analysisData.analysis_id;

    const valuesToInsert = results.map((result) => ({
      analysis_id: analysisId,
      parameter_id: result.parameter_id,
      custom_parameter_id: result.custom_parameter_id || null,
      unit_id: result.unit_id,
      value: result.value,
      min: result.min,
      max: result.max,
      level_code: result.level_code,
      group_code: result.final_group_code,
      confidence: result.confidence,
      is_proxy: result.is_proxy,
      source_name: result.source_name,
      advice: result.advice,
    }));

    const { error: valuesError } = await supabase
      .from("analysis_values")
      .insert(valuesToInsert);

    if (valuesError) {
      setSaving(false);
      setSaveMessage(valuesError.message);
      return;
    }

    setSaving(false);

    if (editingRootAnalysisId) {
      setSaveMessage(
        formatMessage(t.versionSaved, { version: editingNextVersionNumber })
      );
    } else {
      setSaveMessage(t.analysisSaved);
    }

    setSavedAnalysisSignature(signature);
    setEditingRootAnalysisId(editingRootAnalysisId || analysisId);
    setEditingNextVersionNumber(
      editingRootAnalysisId ? editingNextVersionNumber + 1 : 2
    );
    setPendingEditableAnalysis(null);
  }

  const groupedResults = useMemo(() => {
    return {
      negative: results.filter((r) => r.final_group_code === "negative"),
      warning: results.filter((r) => r.final_group_code === "warning"),
      normal: results.filter((r) => r.final_group_code === "normal"),
      positive: results.filter((r) => r.final_group_code === "positive"),
      neutral: results.filter((r) => r.final_group_code === "neutral"),
      other: results.filter(
        (r) =>
          !["negative", "warning", "normal", "positive", "neutral"].includes(
            r.final_group_code
          )
      ),
    };
  }, [results]);

  const currentAnalysisSignature = buildAnalysisSignature(results);
  const isCurrentAnalysisSaved =
    results.length > 0 && savedAnalysisSignature === currentAnalysisSignature;

  const textureSummary = useMemo<TextureSummary | null>(() => {
    function findTextureValue(keywords: string[]) {
      const match = results.find((result) => {
        const name = result.parameter_name.toLowerCase();
        const displayName = result.display_parameter_name.toLowerCase();

        return keywords.some(
          (keyword) => name.includes(keyword) || displayName.includes(keyword)
        );
      });

      return match?.value ?? null;
    }

    const sand = findTextureValue(["sand", "arena", "sable", "sab"]);
    const silt = findTextureValue(["silt", "limo", "limon"]);
    const clay = findTextureValue(["clay", "arcilla", "argile", "ajil"]);

    if (sand === null || silt === null || clay === null) {
      return null;
    }

    const texture = calculateSoilTexture({
      sand,
      silt,
      clay,
    });

    if (!texture) return null;

    return {
      className: texture.className,
      explanation: texture.explanation,
      sand,
      silt,
      clay,
    };
  }, [results]);

  const totalEnteredValues = Object.values(values).filter(
    (value) => value.trim() !== ""
  ).length;
  const hasHistoryOrProgress =
    results.length > 0 ||
    totalEnteredValues > 0 ||
    Boolean(session?.user && !guestMode);

  const parameterCategories = useMemo(() => {
    if (parameters.length === 0) return [];
    return ["Chemical", "Physical"];
  }, [parameters]);

  const filteredParameters = useMemo(() => {
    const search = parameterSearch.trim().toLowerCase();

    let list = [...parameters];

    if (!showAllParameters && selectedCategory !== "All") {
      list = list.filter(
        (parameter) => getParameterFilterGroup(parameter) === selectedCategory
      );
    }

    if (search) {
      list = list.filter((parameter) => {
        const displayName = parameter.display_name.toLowerCase();
        const baseName = parameter.parameter_name.toLowerCase();
        const symbol = parameter.symbol?.toLowerCase() || "";
        const category = parameter.category?.toLowerCase() || "";

        return (
          displayName.includes(search) ||
          baseName.includes(search) ||
          symbol.includes(search) ||
          category.includes(search)
        );
      });
    }

    if (sortMode === "name") {
      list.sort((a, b) => a.display_name.localeCompare(b.display_name));
    }

    if (sortMode === "type") {
      list.sort((a, b) => {
        const rankCompare = getParameterSortRank(a) - getParameterSortRank(b);

        if (rankCompare !== 0) return rankCompare;

        return a.display_name.localeCompare(b.display_name);
      });
    }

    return list;
  }, [
    parameters,
    selectedCategory,
    showAllParameters,
    parameterSearch,
    sortMode,
  ]);

  const selectedCrop = crops.find((crop) => crop.crop_id === cropId);
  const isGeneralCrop = cropId === 999;
  const showFoliarExtractionPicker = !cropId && sampleType === "foliar";
  const interpretationCropId = cropId || 999;

  useEffect(() => {
    if (showFoliarExtractionPicker) {
      setExtractionMethod(
        getDefaultExtractionMethod({ isGeneralCrop: true, sampleType })
      );
      return;
    }

    setExtractionMethod("general");
  }, [showFoliarExtractionPicker, sampleType]);
  const hasAccess = Boolean((session?.user && !showAuthScreen) || guestMode);
  const isAdmin = isAdminEmail(session?.user?.email);

  const displayName = useMemo(() => {
    if (guestMode) return t.guestMode;
    if (!session?.user) return "";
    const meta = session.user.user_metadata as Record<string, unknown>;
    const first = meta?.first_name;
    if (typeof first === "string" && first.trim()) return first.trim();
    const full = meta?.full_name;
    if (typeof full === "string" && full.trim()) {
      return full.trim().split(/\s+/)[0] || full.trim();
    }
    const email = session.user.email;
    if (email) return email.split("@")[0];
    return t.account;
  }, [guestMode, session, t]);

  const isBusy = loading || saving;

  const headerProps = {
    language,
    setLanguage: changeLanguage,
    t,
    session,
    guestMode,
    displayName,
    onHome: () => setCurrentStep("home"),
    onUseAccount: () => {
      if (session?.user) {
        setShowAuthScreen(false);
        setGuestMode(false);
        setCurrentStep("home");
      }
    },
    onSwitchAccount: () => {
      setShowAuthScreen(true);
      setGuestMode(false);
      setCurrentStep("home");
    },
    onContinueAsGuest: () => {
      setShowAuthScreen(false);
      setGuestMode(true);
      setCurrentStep("home");
    },
    onLogout: logout,
    onOpenSettings: () => setCurrentStep("settings"),
    onOpenRecycleBin: () => setCurrentStep("recycle"),
    onOpenAbout: () => setCurrentStep("about"),
    theme,
    onToggleTheme: () =>
      setTheme((currentTheme) => {
        if (currentTheme === "light") {
          const currentPreference = getSettings().general.theme;
          const nextPreference =
            currentPreference === "dark_black" ? "dark_black" : "dark";
          updateSetting("general", "theme", nextPreference);
          return "dark";
        }
        updateSetting("general", "theme", "light");
        return "light";
      }),
  };

  if (sessionRestoring) {
    return (
      <main className="app-main-gradient flex min-h-screen items-center justify-center px-4 text-slate-900">
        <div className="app-main-backdrop" aria-hidden="true" />
        <div className="app-boot-spinner" aria-label={t.loadingSavedValues} />
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="app-main-gradient auth-page flex min-h-screen flex-col text-slate-900">
        <div className="app-main-backdrop" aria-hidden="true" />
        <header className="auth-top-bar">
          <LanguageSwitcher
            language={language}
            onChange={changeLanguage}
            compact
          />
        </header>
        <div className="relative z-[1] flex flex-1 items-center justify-center px-4 py-6 sm:py-8">
          <LoadingOverlay
            open={isBusy}
            label={loading ? t.interpreting : t.saving}
          />
          <section className="mx-auto w-full max-w-md animate-slide-up lg:max-w-5xl">
            <AuthPanel
              t={t}
              language={language}
              activeSession={session}
              activeDisplayName={displayName}
              onAuthSuccess={() => {
                loadSession();
                setShowAuthScreen(false);
                setGuestMode(false);
                setCurrentStep("home");
              }}
              onContinueAsGuest={() => {
                setShowAuthScreen(false);
                setGuestMode(true);
                setCurrentStep("home");
              }}
              onResumeSession={() => {
                setShowAuthScreen(false);
                setGuestMode(false);
                setCurrentStep("home");
              }}
            />
          </section>
        </div>
      </main>
    );
  }

  return (
    <>
      {currentStep !== "about" ? <AppHeader {...headerProps} /> : null}
      <WelcomeGuide open={showWelcomeGuide && Boolean(session?.user) && !guestMode} t={t} onClose={closeWelcomeGuide} />
      <main
        className={`app-main-gradient app-main-shell text-slate-900 ${
          currentStep === "home"
            ? "app-main-shell--home"
            : currentStep === "about"
              ? "app-main-shell--about"
              : "app-main-shell--default"
        }`}
      >
        <div className="app-main-backdrop" aria-hidden="true" />
        <LoadingOverlay
          open={isBusy}
          label={loading ? t.interpreting : t.saving}
        />
        <section
          className={
            currentStep === "about"
              ? "about-route-shell"
              : "app-visual-tone mx-auto w-full max-w-[min(100%,42rem)] sm:max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-[56rem] px-0"
          }
        >
        {currentStep === "home" ? (
          <section className="home-screen-wrap">
            <HomeScreen
              t={t}
              session={session}
              guestMode={guestMode}
              displayName={displayName}
              isReturningUser={Boolean(session?.user && !guestMode)}
              startNewAnalysis={resetAnalysis}
              goImport={() => setCurrentStep("import")}
              goResults={() => setCurrentStep("history")}
              goCalculators={() => setCurrentStep("calculators")}
              hasResultsOrProgress={hasHistoryOrProgress}
            />
          </section>
        ) : currentStep === "import" ? (
          <ImportDataScreen
            t={t}
            onBack={() => setCurrentStep("home")}
            onImportDocument={() => {
              setLabValueImporterMode("import");
              setShowLabValueImporter(true);
            }}
            onTakePhoto={() => {
              setLabValueImporterMode("scan");
              setShowLabValueImporter(true);
            }}
          />
        ) : currentStep === "setup" ? (
          <SetupScreen
            t={t}
            cropId={cropId}
            setCropId={setCropId}
            crops={crops}
            cropsLoading={cropsLoading}
            loadCrops={loadCrops}
            sampleType={sampleType}
            setSampleType={resetSampleTypeState}
            isGeneralCrop={isGeneralCrop}
            extractionMethod={extractionMethod}
            setExtractionMethod={setExtractionMethod}
            message={message}
            analysisName={analysisName}
            setAnalysisName={setAnalysisName}
            farmName={farmName}
            setFarmName={setFarmName}
            lotName={lotName}
            setLotName={setLotName}
            country={country}
            setCountry={setCountry}
            customCountry={customCountry}
            setCustomCountry={setCustomCountry}
            provinceState={provinceState}
            setProvinceState={setProvinceState}
            samplingDate={samplingDate}
            setSamplingDate={setSamplingDate}
            goHome={() => setCurrentStep("home")}
            goToValues={goToValues}
          />
        ) : currentStep === "values" ? (
          <ValuesScreen
            t={t}
            language={language}
            selectedCrop={selectedCrop}
            sampleType={sampleType}
            isGeneralCrop={isGeneralCrop}
            showFoliarExtractionPicker={showFoliarExtractionPicker}
            extractionMethod={extractionMethod}
            setExtractionMethod={setExtractionMethod}
            parameters={parameters}
            totalEnteredValues={totalEnteredValues}
            parameterSearch={parameterSearch}
            setParameterSearch={setParameterSearch}
            setShowAllParameters={setShowAllParameters}
            selectedCategory={selectedCategory}
            setSelectedCategory={setSelectedCategory}
            parameterCategories={parameterCategories}
            sortMode={sortMode}
            setSortMode={setSortMode}
            filteredParameters={filteredParameters}
            values={values}
            selectedUnits={selectedUnits}
            selectedUnitDisplayKeys={selectedUnitDisplayKeys}
            showParameterDetails={appSettings.data.showParameterDetails}
            showParameterSymbolsOnly={appSettings.data.showParameterSymbolsOnly}
            updateValue={updateValue}
            updateUnit={updateUnit}
            clearAllValues={clearAllValues}
            message={message}
            pendingEditableAnalysis={pendingEditableAnalysis}
            loading={loading}
            cropId={cropId}
            setCropId={setCropId}
            crops={crops}
            interpretAnalysis={interpretAnalysis}
            backToSetup={() => setCurrentStep("setup")}
            openImporter={() => {
              setLabValueImporterMode("import");
              setShowLabValueImporter(true);
            }}
            openCustomParameterModal={() => {
              setCustomParameterDraft(null);
              setShowCustomParameterModal(true);
            }}
            openCustomParameterManager={() =>
              setShowCustomParameterManager(true)
            }
            openCustomRangeManager={() => setShowCustomRangeManager(true)}
          />
        ) : currentStep === "results" ? (
          <section>
            {results.length === 0 ? (
              <div className="glass-panel rounded-3xl p-6">
                <BackButton
                  onClick={() => setCurrentStep("values")}
                  label={t.goToValues}
                />

                <h2 className="mt-4 text-2xl font-bold text-green-900">
                  {t.noResultsYet}
                </h2>
                <p className="mt-2 text-slate-600">{t.noResultsYetDesc}</p>
              </div>
            ) : (
              <ResultsSection
                results={results}
                groupedResults={groupedResults}
                missingResults={missingResults}
                textureSummary={textureSummary}
                calculatorOutputs={calculatorOutputs}
                language={language}
                t={t}
                saving={saving}
                saveMessage={saveMessage}
                saveAnalysis={saveAnalysis}
                isSaved={isCurrentAnalysisSaved}
                reportMeta={{
                  title:
                    analysisName.trim() ||
                    `${sampleType === "soil" ? t.soil : t.foliar} ${t.analysisSummary}`,
                  details: [
                    selectedCrop ? `${t.crop}: ${selectedCrop.display_name}` : "",
                    `${t.sampleType}: ${sampleType === "soil" ? t.soil : t.foliar}`,
                    farmName.trim() ? `${t.farmName}: ${farmName.trim()}` : "",
                    lotName.trim() ? `${t.lotName}: ${lotName.trim()}` : "",
                    labName.trim() ? `${t.labName}: ${labName.trim()}` : "",
                    [provinceState.trim(), finalCountry].filter(Boolean).length
                      ? `${t.location}: ${[provinceState.trim(), finalCountry]
                          .filter(Boolean)
                          .join(", ")}`
                      : "",
                  ].filter(Boolean),
                }}
                isGeneralCrop={isGeneralCrop}
                showFoliarExtractionPicker={showFoliarExtractionPicker}
                extractionMethod={extractionMethod}
                showHorizontalGraphs={appSettings.reports.includeHorizontalResultGraph}
                backToValues={() => setCurrentStep("values")}
              />
            )}
          </section>
        ) : currentStep === "history" ? (
          <ResultsDashboard
            session={session}
            guestMode={guestMode}
            language={language}
            t={t}
            enteredValuesCount={totalEnteredValues}
            interpretedResultsCount={results.length}
            hasCurrentResults={results.length > 0}
            goToValues={() => setCurrentStep("values")}
            goToCurrentResults={() => setCurrentStep("results")}
            onEditAnalysis={loadEditableAnalysis}
          />
        ) : currentStep === "calculators" ? (
          <CalculatorHub
            language={language}
            parameters={parameters}
            values={values}
            results={results}
            sampleType={sampleType}
            selectedCropName={selectedCrop?.display_name || selectedCrop?.crop_name || null}
            goToValues={() => setCurrentStep("values")}
            onBack={() => setCurrentStep("home")}
            onOutputsChange={setCalculatorOutputs}
          />
        ) : currentStep === "settings" ? (
          <AppSettingsScreen
            language={language}
            onBack={() => setCurrentStep("home")}
            session={session}
            onLanguageChange={changeLanguage}
            onThemePreferenceChange={(preference) =>
              setTheme(resolveThemePreference(preference))
            }
            onFontSizeChange={(delta) =>
              document.documentElement.style.setProperty(
                "--app-root-font-size",
                `${16 + delta}px`
              )
            }
            onSettingsChange={setAppSettings}
          />
        ) : currentStep === "about" ? (
          <AboutScreen
            t={t}
            language={language}
            session={session}
            country={finalCountry}
            isAdmin={isAdmin}
            onBack={() => setCurrentStep("home")}
          />
        ) : currentStep === "recycle" ? (
          <RecycleBinScreen
            t={t}
            language={language}
            session={session}
            onBack={() => setCurrentStep("home")}
            onChanged={() => {
              loadParameters();
            }}
          />
        ) : null}
      </section>

      {currentStep !== "settings" &&
      currentStep !== "recycle" &&
      currentStep !== "about" &&
      currentStep !== "import" ? (
        <AppDock
          currentStep={currentStep}
          onStepChange={setCurrentStep}
          hasResults={results.length > 0}
          hasHistoryOrProgress={hasHistoryOrProgress}
          labels={{
            home: t.home,
            setup: t.setup,
            values: t.values,
            results: t.results,
            calculators: t.calculators,
            history: t.history,
          }}
        />
      ) : null}

      <LabValueImporter
        key={labValueImporterMode}
        open={showLabValueImporter}
        mode={labValueImporterMode}
        autoRestoreToken={importerAutoRestoreToken}
        onClose={() => setShowLabValueImporter(false)}
        language={language}
        parameters={parameters}
        existingValues={values}
        onRequestCreateParameter={requestCreateCustomParameterFromImport}
        onImportValues={importLabValues}
      />

      <CustomParameterModal
        open={showCustomParameterModal}
        onClose={() => {
          const shouldResumeImporter =
            resumeImporterAfterCustomParameterSaveRef.current &&
            customParameterSavedFromImporterRef.current;
          setShowCustomParameterModal(false);
          setCustomParameterDraft(null);
          resumeImporterAfterCustomParameterSaveRef.current = false;
          customParameterSavedFromImporterRef.current = false;
          if (shouldResumeImporter) {
            setLabValueImporterMode("import");
            setShowLabValueImporter(true);
            setImporterAutoRestoreToken((previous) => previous + 1);
          }
        }}
        onCreated={() => {
          void loadParameters();
          customParameterSavedFromImporterRef.current = true;
        }}
        session={session}
        language={language}
        sampleType={sampleType}
        cropId={cropId}
        importDraft={customParameterDraft}
      />

      <CustomParameterManager
        open={showCustomParameterManager}
        onClose={() => setShowCustomParameterManager(false)}
        onChanged={loadParameters}
        session={session}
        language={language}
        sampleType={sampleType}
      />

      <CustomRangeManager
        open={showCustomRangeManager}
        onClose={() => setShowCustomRangeManager(false)}
        onChanged={loadParameters}
        session={session}
        language={language}
        sampleType={sampleType}
        currentCropId={cropId}
      />
      </main>
    </>
  );
}

function SetupScreen({
  t,
  cropId,
  setCropId,
  crops,
  cropsLoading,
  loadCrops,
  sampleType,
  setSampleType,
  isGeneralCrop,
  extractionMethod,
  setExtractionMethod,
  message,
  analysisName,
  setAnalysisName,
  farmName,
  setFarmName,
  lotName,
  setLotName,
  country,
  setCountry,
  customCountry,
  setCustomCountry,
  provinceState,
  setProvinceState,
  samplingDate,
  setSamplingDate,
  goHome,
  goToValues,
}: {
  t: (typeof translations)[Language];
  cropId: number | "";
  setCropId: (value: number | "") => void;
  crops: Crop[];
  cropsLoading: boolean;
  loadCrops: () => void;
  sampleType: "soil" | "foliar";
  setSampleType: (value: "soil" | "foliar") => void;
  isGeneralCrop: boolean;
  extractionMethod: ExtractionMethod;
  setExtractionMethod: (value: ExtractionMethod) => void;
  message: string;
  analysisName: string;
  setAnalysisName: (value: string) => void;
  farmName: string;
  setFarmName: (value: string) => void;
  lotName: string;
  setLotName: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  customCountry: string;
  setCustomCountry: (value: string) => void;
  provinceState: string;
  setProvinceState: (value: string) => void;
  samplingDate: string;
  setSamplingDate: (value: string) => void;
  goHome: () => void;
  goToValues: () => void;
}) {
  const cropOptions = buildSetupCropOptions(crops, t.generalCropOther);
  const [additionalInfoOpen, setAdditionalInfoOpen] = useState(false);

  function handleSetupKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter") return;

    const target = event.target as HTMLElement;
    if (
      target.tagName === "BUTTON" ||
      target.getAttribute("role") === "button"
    ) {
      return;
    }

    event.preventDefault();
    goToValues();
  }

  function handleSkipCrop() {
    setCropId(999);
    if (!samplingDate) setSamplingDate(getTodayIsoDate());
    goToValues();
  }

  return (
    <section onKeyDown={handleSetupKeyDown} className="flex flex-col gap-4 pb-32">
      <div className="flex items-center gap-3 px-1 pb-1 pt-2">
        <BackButton variant="icon" onClick={goHome} label={t.start} />
        <h1 className="flex-1 text-lg font-bold dark-text-primary">{t.setupTitle}</h1>
        <button
          type="button"
          onClick={goToValues}
          className="inline-flex items-center gap-1.5 rounded-full bg-green-700 px-4 py-2 text-sm font-semibold text-white shadow-sm active:scale-[0.97] hover:bg-green-800"
        >
          {t.continueShort}
          <ArrowRight size={15} />
        </button>
      </div>

      <div className="calc-surface calc-page px-4 py-1">
        <SetupInlineField label={t.sampleType}>
          <div className="setup-segmented-inline app-segmented-control">
            <button
              type="button"
              onClick={() => setSampleType("soil")}
              className={`app-segmented-control__btn ${
                sampleType === "soil" ? "app-segmented-control__btn--active" : ""
              }`}
            >
              {t.soil}
            </button>
            <button
              type="button"
              onClick={() => setSampleType("foliar")}
              className={`app-segmented-control__btn ${
                sampleType === "foliar" ? "app-segmented-control__btn--active" : ""
              }`}
            >
              {t.foliar}
            </button>
          </div>
        </SetupInlineField>

        <SetupInlineField label={t.crop}>
          <AppSelect
            value={cropId}
            placeholder={t.generalCropOther}
            compact
            floatingMenu
            icon={<Sprout size={18} />}
            options={cropOptions}
            onChange={setCropId}
          />
        </SetupInlineField>

        {isGeneralCrop ? (
          <>
            <SetupInlineField label={t.extractionMethodLabel}>
              <div className="setup-extraction-inline">
                <ExtractionMethodChips
                  t={t}
                  value={extractionMethod}
                  onChange={setExtractionMethod}
                  options={GENERAL_CROP_EXTRACTION_OPTIONS}
                />
              </div>
            </SetupInlineField>
            <p className="setup-inline-hint">{t.generalCropWarning}</p>
          </>
        ) : null}

        <div className="setup-skip-row">
          <button type="button" onClick={handleSkipCrop} className="setup-skip-btn">
            {t.skip}
          </button>
        </div>

        {cropsLoading && (
          <p className="px-0 py-2 text-sm text-[#6c6c70]">{t.loadingCrops}</p>
        )}

        {!cropsLoading && crops.length === 0 && (
          <div className="my-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <p>{t.noCropsLoaded}</p>
            <button
              type="button"
              onClick={loadCrops}
              className="mt-2 rounded-xl bg-red-100 px-4 py-2 font-semibold text-red-800 hover:bg-red-200"
            >
              {t.reloadCrops}
            </button>
          </div>
        )}

        {message && (
          <div className="my-2 rounded-xl bg-yellow-50 p-3 text-sm text-yellow-900">
            {message}
          </div>
        )}
      </div>

      <div className="calc-surface calc-page px-4 py-1">
        <button
          type="button"
          onClick={() => setAdditionalInfoOpen((previous) => !previous)}
          className="setup-section-toggle"
          aria-expanded={additionalInfoOpen}
        >
          <span className="setup-section-heading">{t.additionalInfo}</span>
          <ChevronDown
            size={17}
            className={`settings-section-chevron transition-transform duration-200 ${additionalInfoOpen ? "rotate-180" : ""}`}
            aria-hidden
          />
        </button>

        {additionalInfoOpen ? (
          <ReportDetailsPanel
            analysisName={analysisName}
            setAnalysisName={setAnalysisName}
            farmName={farmName}
            setFarmName={setFarmName}
            lotName={lotName}
            setLotName={setLotName}
            country={country}
            setCountry={setCountry}
            customCountry={customCountry}
            setCustomCountry={setCustomCountry}
            provinceState={provinceState}
            setProvinceState={setProvinceState}
            samplingDate={samplingDate}
            setSamplingDate={setSamplingDate}
            t={t}
          />
        ) : null}
      </div>

      <div className="app-fixed-action-bar fixed inset-x-0 z-[11000]">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <button
            type="button"
            onClick={goToValues}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3.5 font-semibold text-white shadow-sm transition-all active:scale-[0.98] hover:bg-green-800"
          >
            {t.continueShort}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </section>
  );
}

function ValuesScreen({
  t,
  language,
  selectedCrop,
  sampleType,
  isGeneralCrop,
  showFoliarExtractionPicker,
  extractionMethod,
  setExtractionMethod,
  parameters,
  totalEnteredValues,
  parameterSearch,
  setParameterSearch,
  setShowAllParameters,
  selectedCategory,
  setSelectedCategory,
  parameterCategories,
  sortMode,
  setSortMode,
  filteredParameters,
  values,
  selectedUnits,
  selectedUnitDisplayKeys,
  showParameterDetails,
  showParameterSymbolsOnly,
  updateValue,
  updateUnit,
  clearAllValues,
  message,
  pendingEditableAnalysis,
  loading,
  cropId,
  setCropId,
  crops,
  interpretAnalysis,
  backToSetup,
  openImporter,
  openCustomParameterModal,
  openCustomParameterManager,
  openCustomRangeManager,
}: {
  t: (typeof translations)[Language];
  language: Language;
  selectedCrop: Crop | undefined;
  sampleType: "soil" | "foliar";
  isGeneralCrop: boolean;
  showFoliarExtractionPicker: boolean;
  extractionMethod: ExtractionMethod;
  setExtractionMethod: (value: ExtractionMethod) => void;
  parameters: Parameter[];
  totalEnteredValues: number;
  parameterSearch: string;
  setParameterSearch: (value: string) => void;
  setShowAllParameters: (value: boolean) => void;
  selectedCategory: string;
  setSelectedCategory: (value: string) => void;
  parameterCategories: string[];
  sortMode: "name" | "type";
  setSortMode: (value: "name" | "type") => void;
  filteredParameters: Parameter[];
  values: Record<string, string>;
  selectedUnits: Record<string, number>;
  selectedUnitDisplayKeys: Record<string, string>;
  showParameterDetails: boolean;
  showParameterSymbolsOnly: boolean;
  updateValue: (parameterKey: string, newValue: string) => void;
  updateUnit: (parameterKey: string, unitId: number, displayKey?: string) => void;
  clearAllValues: () => void;
  message: string;
  pendingEditableAnalysis: EditableAnalysisPayload | null;
  loading: boolean;
  cropId: number | "";
  setCropId: (value: number | "") => void;
  crops: Crop[];
  interpretAnalysis: () => void;
  backToSetup: () => void;
  openImporter: () => void;
  openCustomParameterModal: () => void;
  openCustomParameterManager: () => void;
  openCustomRangeManager: () => void;
}) {
  const [showCustomDataMenu, setShowCustomDataMenu] = useState(false);
  const [showStickyCustomDataMenu, setShowStickyCustomDataMenu] = useState(false);
  const [showParameterActions, setShowParameterActions] = useState(false);
  const [canRenderFloatingActions, setCanRenderFloatingActions] = useState(false);
  const customMenuRef = useRef<HTMLDivElement | null>(null);
  const stickyCustomMenuRef = useRef<HTMLDivElement | null>(null);
  const parameterGridRef = useRef<HTMLDivElement | null>(null);
  const [valueEntryView, setValueEntryView] = useState<ValueEntryView>("cards");
  const hasVisibleParameters = filteredParameters.length > 0;
  const hasEnteredValues = totalEnteredValues > 0;
  const showStickyAddAction = hasVisibleParameters && showParameterActions;
  const showInterpretAction =
    hasVisibleParameters &&
    (showParameterActions || hasEnteredValues) &&
    !showCustomDataMenu &&
    !showStickyCustomDataMenu;

  useDismissible(showCustomDataMenu, () => setShowCustomDataMenu(false), customMenuRef);
  useDismissible(
    showStickyCustomDataMenu,
    () => setShowStickyCustomDataMenu(false),
    stickyCustomMenuRef
  );

  useEffect(() => {
    queueMicrotask(() => setCanRenderFloatingActions(true));
  }, []);

  function openManager(type: "parameters" | "ranges") {
    setShowCustomDataMenu(false);
    setShowStickyCustomDataMenu(false);

    if (type === "parameters") {
      openCustomParameterManager();
      return;
    }

    openCustomRangeManager();
  }

  useEffect(() => {
    if (!hasVisibleParameters) {
      queueMicrotask(() => setShowParameterActions(false));
      return;
    }

    function updateParameterActions() {
      const parameterGrid = parameterGridRef.current;

      if (!parameterGrid) {
        setShowParameterActions(false);
        return;
      }

      const headerOffset = window.innerWidth >= 768 ? 92 : 88;
      setShowParameterActions(
        parameterGrid.getBoundingClientRect().top <= headerOffset
      );
    }

    updateParameterActions();
    const animationFrame = window.requestAnimationFrame(updateParameterActions);
    const timeout = window.setTimeout(updateParameterActions, 150);
    window.addEventListener("scroll", updateParameterActions, { passive: true });
    document.addEventListener("scroll", updateParameterActions, {
      capture: true,
      passive: true,
    });
    window.addEventListener("resize", updateParameterActions);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(timeout);
      window.removeEventListener("scroll", updateParameterActions);
      document.removeEventListener("scroll", updateParameterActions, {
        capture: true,
      });
      window.removeEventListener("resize", updateParameterActions);
    };
  }, [hasVisibleParameters]);

  useEffect(() => {
    if (showParameterActions) {
      queueMicrotask(() => setShowCustomDataMenu(false));
      return;
    }

    queueMicrotask(() => setShowStickyCustomDataMenu(false));
  }, [showParameterActions]);

  return (
    <section
      className={`values-screen-panel values-screen-panel--open px-0 pb-4 pt-0 md:px-0 md:pb-5 md:pt-0 ${
        hasVisibleParameters ? "pb-28" : ""
      }`}
    >
      {/* Page header: back, title, enter count badge */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-2">
        <BackButton variant="icon" onClick={backToSetup} label={t.backToSetup} />
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold dark-text-primary">{t.enterValues}</h2>
          {selectedCrop && (
            <p className="text-xs text-[#6c6c70] mt-0.5">
              {selectedCrop.display_name} · {sampleType === "soil" ? t.soil : t.foliar}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {totalEnteredValues > 0 && (
            <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-800">
              {totalEnteredValues}
            </span>
          )}
        </div>
      </div>

      {/* Crop + extraction (when crop skipped or general) */}
      {!cropId ? (
        <div className="values-skip-crop-block">
          <p className="mb-2 text-xs font-semibold text-[#6c6c70]">{t.crop}</p>
          <AppSelect
            value={cropId}
            placeholder={t.selectCrop}
            inlineMenu
            options={[
              { label: t.selectCrop, value: "" },
              ...crops.map((crop) => ({
                label: crop.display_name,
                value: crop.crop_id,
              })),
            ]}
            onChange={setCropId}
          />
          <p className="mt-2 text-xs text-[#6c6c70]">{t.selectCropOnValues}</p>
        </div>
      ) : null}

      {showFoliarExtractionPicker ? (
        <div className="values-skip-crop-block">
          <p className="mb-2 text-xs font-semibold text-[#6c6c70]">{t.extractionMethodLabel}</p>
          <ExtractionMethodChips
            t={t}
            value={extractionMethod}
            onChange={setExtractionMethod}
            options={FOLIAR_SKIP_CROP_EXTRACTION_OPTIONS}
          />
          <p className="mt-2 text-xs text-[#6c6c70]">{t.foliarExtractionHint}</p>
        </div>
      ) : null}

      {/* Extraction method (general crop only) - removed duplicate */}

      {/* Compact toolbar: search + controls */}
      <div className="values-toolbar px-4">
        <div className="values-toolbar__row">
          <div className="relative min-w-0 flex-1">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#aeaeb2]"
              />
              <input
                className="w-full rounded-xl border border-transparent bg-[#f2f2f2] py-2 pl-9 pr-3 text-sm outline-none focus:border-green-600 focus:bg-white focus:ring-0"
                placeholder={t.searchPlaceholder}
                value={parameterSearch}
                onChange={(e) => setParameterSearch(e.target.value)}
              />
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <AppSelect
                value={sortMode}
                placeholder={t.sortByType}
                options={[
                  { label: t.sortByType, value: "type" },
                  { label: t.sortByName, value: "name" },
                ]}
                onChange={(value) =>
                  setSortMode((value || "type") as "name" | "type")
                }
                compact
                icon={<SlidersHorizontal size={16} />}
                iconOnlyOnMobile
                floatingMenu
              />
            </div>

            {/* Import */}
            <button
              type="button"
              onClick={openImporter}
              title={t.importCsvExcel}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f2f2f2] text-[#3c3c43] transition hover:bg-[#e5e5ea] active:scale-95"
            >
              <Upload size={16} />
            </button>

            {/* Add custom data */}
            <div
              ref={customMenuRef}
              className={`relative shrink-0 ${
                showCustomDataMenu ? "z-[19000]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setShowStickyCustomDataMenu(false);
                  setShowCustomDataMenu((previous) => !previous);
                }}
                title={t.addNewParameter}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(0,0,0,0.08)] bg-[#f2f2f2] text-green-800 transition hover:bg-green-50 active:scale-95"
              >
                <Plus size={16} />
              </button>

              {showCustomDataMenu && canRenderFloatingActions
                ? createPortal(
                    <>
                  <button
                    type="button"
                    aria-label={t.close}
                    className="dismiss-backdrop"
                    onClick={() => setShowCustomDataMenu(false)}
                  />
                  <section className="add-data-menu z-[19000] rounded-3xl p-3 shadow-2xl md:fixed md:right-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))] md:top-36 md:w-80">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCustomDataMenu(false);
                        openCustomParameterModal();
                      }}
                      className="add-data-menu-item w-full px-4 py-3 text-left"
                    >
                      <p className="font-bold text-green-900">
                        {t.addCustomParameter}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t.addNewParameter}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => openManager("parameters")}
                      className="add-data-menu-item mt-2 w-full px-4 py-3 text-left"
                    >
                      <p className="font-bold text-green-900">
                        {t.manageCustomParameters}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t.manageCustomParametersDesc}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => openManager("ranges")}
                      className="add-data-menu-item mt-2 w-full px-4 py-3 text-left"
                    >
                      <p className="font-bold text-green-900">
                        {t.manageCustomRanges}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {t.manageCustomRangesDesc}
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCustomDataMenu(false)}
                      className="add-data-menu-item add-data-menu-item--muted mt-2 w-full px-4 py-2 text-sm font-semibold text-slate-600"
                    >
                      {t.close}
                    </button>
                  </section>
                    </>,
                    document.body
                  )
                : null}
            </div>
          </div>

          {/* Category filter */}
          <div className="mt-2.5 w-full">
            <ParameterCategoryFilter
              categories={parameterCategories}
              selectedCategory={selectedCategory}
              onChange={(category) => {
                setSelectedCategory(category);
                setShowAllParameters(category === "All");
              }}
              language={language}
              allLabel={t.all}
            />
          </div>

          {/* View toggle — own row to avoid overlap */}
          <div className="mt-2 flex justify-end">
            <div className="inline-flex shrink-0 rounded-xl bg-[#f2f2f2] p-0.5">
              {(["cards", "table"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setValueEntryView(view)}
                  className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-semibold transition ${
                    valueEntryView === view
                      ? "bg-white text-green-900 shadow-sm"
                      : "text-[#6c6c70] hover:text-[#3c3c43]"
                  }`}
                  aria-pressed={valueEntryView === view}
                >
                  {view === "table" ? <Table2 size={13} /> : <SlidersHorizontal size={13} />}
                  {view === "table" ? t.tableView : t.cardView}
                </button>
              ))}
            </div>
          </div>
      </div>

      {canRenderFloatingActions
        ? createPortal(
            <>
              {showStickyAddAction && (
                <div className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+0.85rem)] z-[16000] animate-float-in sm:right-5 md:right-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]">
                  <div className="rounded-full border border-white/70 bg-white/65 p-1.5 shadow-2xl shadow-green-950/16 backdrop-blur-2xl">
                    <div className="flex justify-end">
                      <div
                        ref={stickyCustomMenuRef}
                        className={`relative ${
                          showStickyCustomDataMenu ? "z-[19000]" : ""
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setShowCustomDataMenu(false);
                            setShowStickyCustomDataMenu((previous) => !previous);
                          }}
                            className="group inline-flex min-h-10 items-center justify-center gap-2 rounded-full border border-white/50 bg-white/72 px-3.5 py-1.5 text-xs font-extrabold text-green-900 shadow-lg shadow-green-900/12 ring-1 ring-white/50 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/92 active:scale-[0.98]"
                        >
                            <span className="grid h-6 w-6 place-items-center rounded-full bg-green-600/12 ring-1 ring-green-700/15 transition group-hover:bg-green-600/18">
                              <Plus size={15} strokeWidth={2.5} />
                            </span>
                          <span>{t.addShort}</span>
                        </button>

                        {showStickyCustomDataMenu
                          ? createPortal(
                              <>
                            <button
                              type="button"
                              aria-label={t.close}
                              className="dismiss-backdrop"
                              onClick={() => setShowStickyCustomDataMenu(false)}
                            />
                            <section className="add-data-menu z-[19000] rounded-3xl p-3 shadow-2xl md:fixed md:right-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))] md:top-20 md:w-80">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowStickyCustomDataMenu(false);
                                  openCustomParameterModal();
                                }}
                                className="add-data-menu-item w-full px-4 py-3 text-left"
                              >
                                <p className="font-bold text-green-900">
                                  {t.addCustomParameter}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {t.addNewParameter}
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => openManager("parameters")}
                                className="add-data-menu-item mt-2 w-full px-4 py-3 text-left"
                              >
                                <p className="font-bold text-green-900">
                                  {t.manageCustomParameters}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {t.manageCustomParametersDesc}
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => openManager("ranges")}
                                className="add-data-menu-item mt-2 w-full px-4 py-3 text-left"
                              >
                                <p className="font-bold text-green-900">
                                  {t.manageCustomRanges}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {t.manageCustomRangesDesc}
                                </p>
                              </button>

                              <button
                                type="button"
                                onClick={() => setShowStickyCustomDataMenu(false)}
                                className="add-data-menu-item add-data-menu-item--muted mt-2 w-full px-4 py-2 text-sm font-semibold text-slate-600"
                              >
                                {t.close}
                              </button>
                            </section>
                              </>,
                              document.body
                            )
                          : null}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {showInterpretAction && (
                <div className="app-fixed-action-bar fixed inset-x-0 z-[14000] animate-slide-up">
                  <div className="mx-auto max-w-2xl px-4 py-3">
                    <button
                      type="button"
                      onClick={interpretAnalysis}
                      disabled={loading || Boolean(pendingEditableAnalysis)}
                      className="touch-target flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3.5 font-semibold text-white shadow-sm active:scale-[0.98] hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 transition-all"
                    >
                      <FlaskConical size={18} strokeWidth={2} />
                      {loading ? t.interpreting : t.interpretAnalysis}
                      {hasEnteredValues && !loading && (
                        <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                          {totalEnteredValues}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </>,
            document.body
          )
        : null}

      {message && (
        <div className="mt-5 rounded-2xl bg-yellow-50 p-4 text-yellow-900">
          {message}
        </div>
      )}

      {pendingEditableAnalysis && (
        <div className="mt-5 rounded-2xl bg-blue-50 p-4 text-blue-900">
          {t.loadingSavedValues}
        </div>
      )}

      {hasVisibleParameters && valueEntryView === "table" && (
        <div
          ref={parameterGridRef}
          className="relative z-0 mt-4 overflow-hidden rounded-2xl border border-white/65 bg-white/58 shadow-sm backdrop-blur-xl animate-slide-up md:overflow-x-auto"
        >
          <table className="w-full table-fixed border-collapse text-xs sm:text-sm md:min-w-[520px]">
            <colgroup>
              <col className="w-[30%] sm:w-[34%]" />
              <col className="w-[36%] sm:w-[38%]" />
              <col className="w-[34%] sm:w-[28%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-green-900/10 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
                <th className="px-2 py-3 sm:px-3">{t.parameterLabel}</th>
                <th className="px-2 py-3 sm:px-3">{t.valueLabel}</th>
                <th className="px-2 py-3 sm:px-3">{t.unitLabel}</th>
              </tr>
            </thead>
            <tbody>
              {filteredParameters.map((parameter) => {
                const selectedUnitId =
                  selectedUnits[parameter.parameter_key] || parameter.unit_id;
                const selectedUnit =
                  parameter.available_units.find(
                    (unit) => unit.unit_id === selectedUnitId
                  ) || parameter.available_units[0];
                const selectedUnitDisplayKey =
                  getPreferredUnitDisplayKey(
                    parameter,
                    selectedUnitId,
                    selectedUnitDisplayKeys[parameter.parameter_key]
                  ) || (selectedUnit ? getUnitOptionKey(selectedUnit) : "");
                const displayParameterLabel =
                  parameter.symbol?.trim() || parameter.display_name;
                const aliasTitle = [
                  `${t.aliasLabel}: ${parameter.display_name}`,
                  parameter.parameter_name !== parameter.display_name
                    ? `${t.originalName}: ${parameter.parameter_name}`
                    : "",
                  `${t.unitLabel}: ${
                    selectedUnit?.display_symbol ||
                    selectedUnit?.unit_symbol ||
                    parameter.unit_symbol
                  }`,
                ]
                  .filter(Boolean)
                  .join("\n");

                return (
                  <tr
                    key={parameter.parameter_key}
                    title={aliasTitle}
                    className="border-b border-green-900/6 last:border-0"
                  >
                    <td className="px-2 py-2 align-middle sm:px-3">
                      <div className="truncate font-bold text-slate-900">
                        {displayParameterLabel}
                      </div>
                    </td>
                    <td className="px-2 py-2 align-middle sm:px-3">
                      <input
                        className="min-h-11 w-full min-w-0 rounded-xl border border-green-700/16 bg-white/65 px-2 py-2 text-xs font-semibold outline-none backdrop-blur-md placeholder:text-xs focus:border-green-700/60 focus:bg-white/90 focus:ring-4 focus:ring-green-700/10 sm:px-3 sm:text-sm"
                        type="text"
                        inputMode="decimal"
                        value={values[parameter.parameter_key] || ""}
                        onChange={(e) =>
                          updateValue(parameter.parameter_key, e.target.value)
                        }
                        placeholder={t.valuePlaceholder}
                      />
                    </td>
                    <td className="px-2 py-2 align-middle sm:px-3">
                      {parameter.available_units.length > 1 ? (
                        <select
                          value={selectedUnitDisplayKey}
                          onChange={(event) => {
                            const unit = parameter.available_units.find(
                              (option) =>
                                getUnitOptionKey(option) === event.target.value
                            );
                            if (!unit) return;
                            updateUnit(
                              parameter.parameter_key,
                              unit.unit_id,
                              getUnitOptionKey(unit)
                            );
                          }}
                          className="app-native-select min-h-11 w-full min-w-0 px-2 py-2 text-[11px] sm:px-3 sm:text-xs"
                          title={t.changeUnit}
                        >
                          {parameter.available_units.map((unit) => (
                            (() => {
                              const canConvert =
                                !selectedUnit ||
                                canConvertLabUnit(
                                  getUnitSymbolForConversion(selectedUnit),
                                  getUnitSymbolForConversion(unit)
                                );
                              return (
                            <option
                              key={getUnitOptionKey(unit)}
                              value={getUnitOptionKey(unit)}
                              disabled={!canConvert}
                            >
                              {unit.display_symbol || unit.unit_symbol}
                            </option>
                              );
                            })()
                          ))}
                        </select>
                      ) : (
                        <span
                          className="inline-flex min-h-11 w-full max-w-full items-center truncate rounded-xl border border-green-700/10 bg-white/55 px-2 py-2 text-[11px] font-bold text-green-800 sm:px-3 sm:text-xs"
                          title={selectedUnit?.unit_symbol || parameter.unit_symbol}
                        >
                          {selectedUnit?.display_symbol ||
                            selectedUnit?.unit_symbol ||
                            parameter.unit_symbol}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasVisibleParameters && valueEntryView === "cards" && (
        <div
          ref={parameterGridRef}
          className="relative z-0 mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {filteredParameters.map((parameter, index) => {
            const selectedUnitId =
              selectedUnits[parameter.parameter_key] || parameter.unit_id;

            const selectedUnit =
              parameter.available_units.find(
                (unit) => unit.unit_id === selectedUnitId
              ) || parameter.available_units[0];
            const selectedUnitDisplayKey =
              getPreferredUnitDisplayKey(
                parameter,
                selectedUnitId,
                selectedUnitDisplayKeys[parameter.parameter_key]
              ) || (selectedUnit ? getUnitOptionKey(selectedUnit) : "");
            const displayParameterLabel =
              showParameterSymbolsOnly && parameter.symbol
                ? parameter.symbol
                : `${parameter.display_name}${
                    parameter.symbol && !showParameterSymbolsOnly
                      ? ` (${parameter.symbol})`
                      : ""
                  }`;

            const aliasTitle = [
              `${t.aliasLabel}: ${parameter.display_name}`,
              parameter.parameter_name !== parameter.display_name
                ? `${t.originalName}: ${parameter.parameter_name}`
                : "",
              `${t.unitLabel}: ${
                selectedUnit?.display_symbol ||
                selectedUnit?.unit_symbol ||
                parameter.unit_symbol
              }`,
            ]
              .filter(Boolean)
              .join("\n");

            return (
              <div
                key={parameter.parameter_key}
                title={aliasTitle}
                style={{ animationDelay: `${Math.min(index, 8) * 35}ms` }}
                className={`animate-slide-up rounded-2xl border px-3 py-2.5 shadow-sm backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/72 hover:shadow-md ${
                  parameter.is_custom
                    ? "border-green-200/80 bg-green-50/52"
                    : "border-white/62 bg-white/50"
                }`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <label className="text-sm font-bold text-slate-900">
                      {displayParameterLabel}
                    </label>

                    {showParameterDetails ? (
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      {parameter.category && (
                        <p className="text-xs text-slate-500">
                          {translateCategory(parameter.category, language, translations)}
                        </p>
                      )}

                      {parameter.is_custom && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                          {t.customBadge}
                        </span>
                      )}
                    </div>
                    ) : null}
                  </div>
                </div>

                <div className="relative">
                  <input
                    className="w-full rounded-2xl border border-green-700/16 bg-white/50 p-2.5 pr-28 text-base font-semibold outline-none backdrop-blur-md focus:border-green-700/60 focus:bg-white/85 focus:ring-4 focus:ring-green-700/10"
                    type="text"
                    inputMode="decimal"
                    value={values[parameter.parameter_key] || ""}
                    onChange={(e) =>
                      updateValue(parameter.parameter_key, e.target.value)
                    }
                    placeholder={t.valuePlaceholder}
                  />

                  {parameter.available_units.length > 1 ? (
                    <select
                      value={selectedUnitDisplayKey}
                      onChange={(event) => {
                        const unit = parameter.available_units.find(
                          (option) => getUnitOptionKey(option) === event.target.value
                        );
                        if (!unit) return;
                        updateUnit(
                          parameter.parameter_key,
                          unit.unit_id,
                          getUnitOptionKey(unit)
                        );
                      }}
                      className="app-native-select absolute right-2 top-1/2 max-w-24 -translate-y-1/2 px-2 py-1 text-xs"
                      title={t.changeUnit}
                    >
                      {parameter.available_units.map((unit) => (
                        (() => {
                          const canConvert =
                            !selectedUnit ||
                            canConvertLabUnit(
                              getUnitSymbolForConversion(selectedUnit),
                              getUnitSymbolForConversion(unit)
                            );
                          return (
                            <option
                              key={getUnitOptionKey(unit)}
                              value={getUnitOptionKey(unit)}
                              disabled={!canConvert}
                            >
                              {unit.display_symbol || unit.unit_symbol}
                            </option>
                          );
                        })()
                      ))}
                    </select>
                  ) : (
                    <span
                      className="pointer-events-none absolute right-2 top-1/2 max-w-24 -translate-y-1/2 truncate rounded-xl border border-green-700/10 bg-white/55 px-3 py-1 text-xs font-bold text-green-800"
                      title={selectedUnit?.unit_symbol || parameter.unit_symbol}
                    >
                      {selectedUnit?.display_symbol ||
                        selectedUnit?.unit_symbol ||
                        parameter.unit_symbol}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!hasVisibleParameters && parameters.length > 0 && (
        <div className="mt-6 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-yellow-900">
          {t.noParametersCategory}
        </div>
      )}

      {!hasVisibleParameters && (
        <div className="mt-6 flex justify-end">
          <button
          type="button"
          onClick={interpretAnalysis}
          disabled={loading || !cropId || Boolean(pendingEditableAnalysis)}
          className="touch-target rounded-2xl bg-green-700 px-6 py-3 font-semibold text-white shadow-sm active:scale-[0.98] hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-64"
          >
            {loading ? t.interpreting : t.interpretAnalysis}
          </button>
        </div>
      )}
    </section>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="auth-panel-muted rounded-2xl px-4 py-2 text-center">
      <p className="text-lg font-bold text-green-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ReportDetailsPanel({
  analysisName,
  setAnalysisName,
  farmName,
  setFarmName,
  lotName,
  setLotName,
  country,
  setCountry,
  customCountry,
  setCustomCountry,
  provinceState,
  setProvinceState,
  samplingDate,
  setSamplingDate,
  t,
}: {
  analysisName: string;
  setAnalysisName: (value: string) => void;
  farmName: string;
  setFarmName: (value: string) => void;
  lotName: string;
  setLotName: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  customCountry: string;
  setCustomCountry: (value: string) => void;
  provinceState: string;
  setProvinceState: (value: string) => void;
  samplingDate: string;
  setSamplingDate: (value: string) => void;
  t: (typeof translations)[Language];
}) {
  const [countryRegion, setCountryRegion] = useState<CountryRegion | "">("");
  const filteredCountries = countryRegion
    ? countryRegions.find((group) => group.region === countryRegion)?.countries || []
    : countries;

  const countryOptions = filteredCountries.map((item) => ({
    label: item === "Other" ? t.countryOther : item,
    value: item,
  }));

  return (
    <>
      <SetupInlineField label={t.analysisName}>
        <input
          className="setup-inline-input"
          value={analysisName}
          onChange={(e) => setAnalysisName(e.target.value)}
        />
      </SetupInlineField>

      <SetupInlineField label={t.farmName}>
        <input
          className="setup-inline-input"
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
        />
      </SetupInlineField>

      <SetupInlineField label={t.lotName}>
        <input
          className="setup-inline-input"
          value={lotName}
          onChange={(e) => setLotName(e.target.value)}
        />
      </SetupInlineField>

      <SetupInlineField label={t.region}>
        <AppSelect
          value={countryRegion}
          placeholder={t.allRegions}
          compact
          floatingMenu
          options={[
            { label: t.allRegions, value: "" },
            ...countryRegions.map((group) => ({
              label: translateCountryRegion(group.region, t),
              value: group.region,
            })),
          ]}
          onChange={(value) => {
            setCountryRegion(value as CountryRegion | "");
            if (
              value &&
              country &&
              !countryRegions
                .find((group) => group.region === value)
                ?.countries.includes(country)
            ) {
              setCountry("");
            }
          }}
        />
      </SetupInlineField>

      <SetupInlineField label={t.country}>
        <AppSelect
          value={country}
          placeholder={t.selectCountry}
          compact
          floatingMenu
          searchable
          options={[
            { label: t.selectCountry, value: "" },
            ...countryOptions,
          ]}
          onChange={setCountry}
        />
      </SetupInlineField>

      <SetupInlineField label={t.provinceState}>
        <input
          className="setup-inline-input"
          value={provinceState}
          onChange={(e) => setProvinceState(e.target.value)}
        />
      </SetupInlineField>

      {country === "Other" && (
        <SetupInlineField label={t.typeCountry}>
          <input
            className="setup-inline-input"
            placeholder={t.typeCountry}
            value={customCountry}
            onChange={(e) => setCustomCountry(e.target.value)}
          />
        </SetupInlineField>
      )}

      <SetupInlineField label={t.date}>
        <input
          className="setup-inline-input"
          type="date"
          value={samplingDate}
          onChange={(e) => setSamplingDate(e.target.value)}
        />
      </SetupInlineField>
    </>
  );
}

function SetupInlineField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="setup-inline-row">
      <span className="setup-inline-row__label">{label}</span>
      <div className="setup-inline-row__control">{children}</div>
    </div>
  );
}

function AppSelect<T extends string | number>({
  value,
  options,
  placeholder,
  onChange,
  compact = false,
  inlineMenu = false,
  icon,
  iconOnlyOnMobile = false,
  floatingMenu = false,
  searchable = false,
}: {
  value: T | "";
  options: { label: string; value: T | "" }[];
  placeholder: string;
  onChange: (value: T | "") => void;
  compact?: boolean;
  inlineMenu?: boolean;
  icon?: React.ReactNode;
  iconOnlyOnMobile?: boolean;
  floatingMenu?: boolean;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const presence = useAnimatedPresence(open);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuPanelRef = useRef<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const [menuOpensAbove, setMenuOpensAbove] = useState(false);
  const [menuListMaxHeight, setMenuListMaxHeight] = useState("min(20rem, 55vh)");
  const selectedOption = options.find((option) => option.value === value);
  const visibleOptions = searchable
    ? options.filter((option) => {
        if (option.value === "") return searchTerm.trim() === "";
        if (!searchTerm.trim()) return true;
        return option.label.toLowerCase().includes(searchTerm.trim().toLowerCase());
      })
    : options;
  const useFloatingMenu = floatingMenu || iconOnlyOnMobile;
  const dismissRefs = useMemo(
    () => (useFloatingMenu ? [menuPanelRef] : []),
    [useFloatingMenu]
  );

  useDismissible(open, () => setOpen(false), menuRef, dismissRefs);

  useEffect(() => {
    if (!open) setSearchTerm("");
  }, [open]);

  useEffect(() => {
    if (!open || !searchable) return;
    searchInputRef.current?.focus();
  }, [open, searchable]);

  useLayoutEffect(() => {
    if (!open) return;

    function updateMenuPosition() {
      const anchor = searchable ? searchInputRef.current : triggerRef.current;
      const rect = anchor?.getBoundingClientRect();
      if (!rect) return;

      const gap = 8;
      const viewportPadding = 12;
      const menuHeight = menuPanelRef.current?.offsetHeight ?? 280;
      const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
      const spaceAbove = rect.top - gap - viewportPadding;
      const opensAbove =
        spaceBelow < Math.min(menuHeight, 180) && spaceAbove > spaceBelow;
      const available = opensAbove ? spaceAbove : spaceBelow;
      const maxHeight = Math.max(
        100,
        Math.min(available, Math.round(window.innerHeight * 0.55))
      );

      setMenuOpensAbove(opensAbove);
      setMenuListMaxHeight(`${maxHeight}px`);

      if (!useFloatingMenu || inlineMenu) return;

      const width = Math.max(rect.width, searchable ? 280 : 220);
      const left = Math.min(
        Math.max(viewportPadding, rect.left),
        window.innerWidth - width - viewportPadding
      );

      if (opensAbove) {
        setMenuStyle({
          position: "fixed",
          bottom: window.innerHeight - rect.top + gap,
          top: "auto",
          left,
          width,
          zIndex: 16000,
        });
      } else {
        setMenuStyle({
          position: "fixed",
          top: rect.bottom + gap,
          bottom: "auto",
          left,
          width,
          zIndex: 16000,
        });
      }
    }

    updateMenuPosition();
    const raf = requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [
    open,
    useFloatingMenu,
    inlineMenu,
    searchable,
    visibleOptions.length,
    searchTerm,
  ]);

  const menu = presence.mounted ? (
    <section
      ref={menuPanelRef}
      style={useFloatingMenu && !inlineMenu ? menuStyle : undefined}
      className={`app-menu-select-menu z-[16000] overflow-hidden p-2 ${
        presence.leaving ? "animate-scale-out" : "animate-scale-in"
      } ${
        useFloatingMenu && !inlineMenu
          ? menuOpensAbove
            ? "app-menu-select-menu--floating-above"
            : ""
          : inlineMenu
            ? "relative mt-2"
            : menuOpensAbove
              ? "app-menu-select-menu--flip-above"
              : "absolute inset-x-0 top-full mt-2"
      }`}
    >
      <div
        className="overflow-y-auto pr-1"
        style={{ maxHeight: menuListMaxHeight }}
      >
        {visibleOptions.length > 0 ? (
          visibleOptions.map((option) => {
            const selected = option.value === value;

            return (
              <button
                key={`${option.value}`}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`app-menu-select-option flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                  selected ? "app-menu-select-option-active" : ""
                }`}
              >
                <span className="min-w-0 text-left">{option.label}</span>
                {selected ? (
                  <Check size={16} className="shrink-0" aria-hidden="true" />
                ) : null}
              </button>
            );
          })
        ) : (
          <p className="px-3 py-2 text-sm font-medium text-slate-500">No matches</p>
        )}
      </div>
    </section>
  ) : null;

  return (
    <div ref={menuRef} className={`relative ${open ? "z-[16000]" : "z-0"}`}>
      {presence.mounted && !inlineMenu && !useFloatingMenu ? (
        <button
          type="button"
          aria-label="Close menu"
          className={`dismiss-backdrop ${presence.leaving ? "animate-fade-out" : "animate-fade-in"}`}
          onClick={() => setOpen(false)}
        />
      ) : null}
      {presence.mounted && useFloatingMenu && !inlineMenu
        ? createPortal(
            <button
              type="button"
              aria-label="Close menu"
              className={`dismiss-backdrop ${presence.leaving ? "animate-fade-out" : "animate-fade-in"}`}
              onClick={() => setOpen(false)}
            />,
            document.body
          )
        : null}
      {searchable ? (
        <div
          className={`app-menu-select-trigger flex w-full items-center gap-1.5 text-left outline-none transition ${
            compact
              ? "min-h-9 rounded-xl px-2.5 text-sm sm:px-3"
              : "min-h-11 rounded-2xl px-3 text-sm"
          }`}
        >
          <Search
            size={16}
            className="shrink-0 text-[color:var(--accent-700,#15803d)]"
            aria-hidden="true"
          />
          <input
            ref={searchInputRef}
            type="text"
            inputMode="search"
            autoComplete="off"
            spellCheck={false}
            role="combobox"
            aria-expanded={open}
            aria-autocomplete="list"
            value={
              open
                ? searchTerm
                : selectedOption?.value
                  ? selectedOption.label
                  : ""
            }
            placeholder={placeholder}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            className="app-menu-select-combobox-input min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#1c1c1e] outline-none placeholder:font-medium placeholder:text-slate-400"
          />
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((previous) => !previous)}
            className="shrink-0"
          >
            <ChevronDown
              size={compact ? 16 : 18}
              className={`text-[color:var(--accent-700,#15803d)] transition ${open ? "rotate-180" : ""}`}
            />
          </button>
        </div>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
          className={`app-menu-select-trigger flex w-full items-center justify-between gap-2 text-left outline-none transition ${
            compact
              ? iconOnlyOnMobile
                ? "min-h-9 rounded-xl px-2.5 text-sm sm:px-3"
                : "min-h-9 rounded-xl px-3 text-sm"
              : "min-h-11 rounded-2xl px-3 text-sm"
          }`}
        >
          {icon ? (
            <span className="grid h-5 w-5 shrink-0 place-items-center text-[color:var(--accent-700,#15803d)]">
              {icon}
            </span>
          ) : null}
          <span
            className={`truncate ${
              iconOnlyOnMobile ? "sr-only sm:not-sr-only sm:block" : ""
            } ${
              selectedOption?.value === "" || !selectedOption
                ? "text-slate-400"
                : "text-[#1c1c1e]"
            }`}
          >
            {selectedOption?.label || placeholder}
          </span>
          <ChevronDown
            size={iconOnlyOnMobile ? 16 : 18}
            className={`shrink-0 text-[color:var(--accent-700,#15803d)] transition ${
              iconOnlyOnMobile ? "hidden sm:block" : ""
            } ${open ? "rotate-180" : ""}`}
          />
        </button>
      )}

      {useFloatingMenu && !inlineMenu
        ? presence.mounted
          ? createPortal(menu, document.body)
          : null
        : menu}
    </div>
  );
}

type ResultGraphPoint = {
  id: string;
  label: string;
  value: number;
  unit: string;
  min: number | null;
  max: number | null;
  levelCode: string;
  tone: "critical" | "warning" | "normal" | "positive" | "neutral";
  axisMin: number;
  axisMax: number;
  valuePercent: number;
  zeroPercent: number;
  barLeft: number;
  barWidth: number;
  rangeLeft: number | null;
  rangeWidth: number | null;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function percentForAxis(value: number, min: number, max: number) {
  if (max === min) return 0;
  return clampPercent(((value - min) / (max - min)) * 100);
}

function getResultGraphTone(result: InterpretationResult): ResultGraphPoint["tone"] {
  if (result.final_group_code === "negative") return "critical";
  if (result.final_group_code === "warning") return "warning";
  if (result.final_group_code === "positive") return "positive";
  if (result.final_group_code === "normal") return "normal";
  return "neutral";
}

function buildResultGraphPoint(result: InterpretationResult): ResultGraphPoint {
  const value = Number(result.value);
  const min = Number.isFinite(Number(result.min)) ? Number(result.min) : null;
  const max = Number.isFinite(Number(result.max)) ? Number(result.max) : null;
  const hasRange = min !== null && max !== null && max > min;
  const candidates = [0, value];

  if (min !== null) candidates.push(min);
  if (max !== null) candidates.push(max);

  const rawMin = Math.min(...candidates);
  const rawMax = Math.max(...candidates);
  const rawSpan = rawMax - rawMin || Math.max(Math.abs(value), 1);
  const axisMin = rawMin < 0 ? rawMin - rawSpan * 0.08 : 0;
  const axisMax = rawMax + rawSpan * 0.16 || 1;
  const valuePercent = percentForAxis(value, axisMin, axisMax);
  const zeroPercent = percentForAxis(0, axisMin, axisMax);
  const barLeft = Math.min(valuePercent, zeroPercent);
  const barWidth = Math.max(1.8, Math.abs(valuePercent - zeroPercent));
  const rangeLeft = hasRange ? percentForAxis(min, axisMin, axisMax) : null;
  const rangeWidth = hasRange
    ? Math.max(2, percentForAxis(max, axisMin, axisMax) - percentForAxis(min, axisMin, axisMax))
    : null;

  return {
    id: result.custom_parameter_id
      ? `c-${result.custom_parameter_id}`
      : `p-${result.parameter_id ?? result.parameter_name}`,
    label: result.display_parameter_name || result.parameter_name,
    value,
    unit: result.unit_symbol,
    min,
    max,
    levelCode: result.level_code,
    tone: getResultGraphTone(result),
    axisMin,
    axisMax,
    valuePercent,
    zeroPercent,
    barLeft,
    barWidth,
    rangeLeft,
    rangeWidth,
  };
}

function extractionMethodLabel(
  method: ExtractionMethod,
  t: (typeof translations)[Language]
) {
  const labels: Record<ExtractionMethod, string> = {
    general: t.extractionMethodGeneral,
    olsen: t.extractionMethodOlsen,
    mehlich: t.extractionMethodMehlich,
    bray: t.extractionMethodBray,
  };

  return labels[method];
}

function ExtractionMethodChips({
  t,
  value,
  onChange,
  options = GENERAL_CROP_EXTRACTION_OPTIONS,
}: {
  t: (typeof translations)[Language];
  value: ExtractionMethod;
  onChange: (value: ExtractionMethod) => void;
  options?: ExtractionMethod[];
}) {
  return (
    <div
      className="extraction-method-chips"
      role="group"
      aria-label={t.extractionMethodLabel}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`extraction-method-chip ${
            value === option ? "is-active" : ""
          }`}
        >
          {extractionMethodLabel(option, t)}
        </button>
      ))}
    </div>
  );
}

function ResultsSection({
  results,
  groupedResults,
  missingResults,
  textureSummary,
  calculatorOutputs,
  language,
  t,
  saving,
  saveMessage,
  saveAnalysis,
  isSaved,
  reportMeta,
  isGeneralCrop,
  showFoliarExtractionPicker,
  extractionMethod,
  showHorizontalGraphs,
  backToValues,
}: {
  results: InterpretationResult[];
  groupedResults: {
    negative: InterpretationResult[];
    warning: InterpretationResult[];
    normal: InterpretationResult[];
    positive: InterpretationResult[];
    neutral: InterpretationResult[];
    other: InterpretationResult[];
  };
  missingResults: MissingResult[];
  textureSummary: TextureSummary | null;
  calculatorOutputs: CalculationOutput[];
  language: Language;
  t: (typeof translations)[Language];
  saving: boolean;
  saveMessage: string;
  saveAnalysis: () => void;
  isSaved: boolean;
  reportMeta: {
    title?: string;
    details?: string[];
  };
  isGeneralCrop: boolean;
  showFoliarExtractionPicker: boolean;
  extractionMethod: ExtractionMethod;
  showHorizontalGraphs: boolean;
  backToValues: () => void;
}) {
  const [activeGroup, setActiveGroup] = useState<
    "all" | "negative" | "warning" | "normal" | "positive" | "neutral" | "other"
  >("all");

  const [exportingPdf, setExportingPdf] = useState(false);

  async function exportToPdf() {
    setExportingPdf(true);
    try {
      const locales = {
        en: "en-US",
        fr: "fr-FR",
        es: "es-ES",
        ht: "ht-HT",
        pt: "pt-BR",
        sw: "sw-TZ",
      };
      const translatedResults = results.map((result) => ({
        ...result,
        level_code: translateLevelCode(result.level_code, t),
        confidence: translateConfidence(result.confidence, t),
        advice: translateAdvice(result, t),
        source_name: translateSourceName(result.source_name, t),
      }));
      const translatedGroupedResults = {
        negative: translatedResults.filter((r) => r.final_group_code === "negative"),
        warning: translatedResults.filter((r) => r.final_group_code === "warning"),
        normal: translatedResults.filter((r) => r.final_group_code === "normal"),
        positive: translatedResults.filter((r) => r.final_group_code === "positive"),
        neutral: translatedResults.filter((r) => r.final_group_code === "neutral"),
        other: translatedResults.filter(
          (r) =>
            !["negative", "warning", "normal", "positive", "neutral"].includes(
              r.final_group_code
            )
        ),
      };

      await exportAnalysisPdf({
        t,
        results: translatedResults,
        groupedResults: translatedGroupedResults,
        missingResults,
        textureSummary,
        calculationValues: calculatorOutputs,
        isGeneralCrop,
        locale: locales[language] || "en-US",
        reportMeta,
        reportOptions: getSettings().reports,
      });
    } catch (error) {
      console.error("PDF export error:", error);
      alert(t.pdfExportFailed);
    } finally {
      setExportingPdf(false);
    }
  }

  const visibleGroups = {
    negative:
      activeGroup === "all" || activeGroup === "negative"
        ? groupedResults.negative
        : [],
    warning:
      activeGroup === "all" || activeGroup === "warning"
        ? groupedResults.warning
        : [],
    normal:
      activeGroup === "all" || activeGroup === "normal"
        ? groupedResults.normal
        : [],
    positive:
      activeGroup === "all" || activeGroup === "positive"
        ? groupedResults.positive
        : [],
    neutral:
      activeGroup === "all" || activeGroup === "neutral"
        ? groupedResults.neutral
        : [],
    other:
      activeGroup === "all" || activeGroup === "other"
        ? groupedResults.other
        : [],
  };
  const visibleResults = [
    ...visibleGroups.negative,
    ...visibleGroups.warning,
    ...visibleGroups.normal,
    ...visibleGroups.positive,
    ...visibleGroups.neutral,
    ...visibleGroups.other,
  ];

  return (
    <>
      <section data-pdf-report="analysis" className="results-flat-panel pb-28">
        {/* Page header: back + title + PDF export */}
        <div className="mb-4 flex items-center gap-3">
          <BackButton onClick={backToValues} label={t.goToValues} />
          <div className="min-w-0 flex-1">
            <h2 className="results-flat-title">{t.analysisSummary}</h2>
            <p className="results-flat-count">
              {formatMessage(t.interpretedValuesCount, { count: results.length })}
              {showFoliarExtractionPicker ? (
                <span className="ml-2 text-amber-600">
                  · {extractionMethodLabel(extractionMethod, t)}
                </span>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={exportToPdf}
            disabled={exportingPdf || results.length === 0}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[rgba(0,0,0,0.08)] bg-white px-3 text-xs font-semibold text-[#3c3c43] shadow-sm transition hover:bg-[#f2f2f2] active:scale-95 disabled:opacity-40"
          >
            <Download size={14} />
            {exportingPdf ? "…" : "PDF"}
          </button>
        </div>

        {/* Horizontal scrolling filter chips */}
        <div className="results-flat-filters">
          <button
            type="button"
            onClick={() => setActiveGroup("all")}
            className={`results-flat-chip ${activeGroup === "all" ? "is-active" : ""}`}
          >
            <span className="results-flat-chip-count">{results.length}</span>
            {t.allResults}
          </button>
          <SummaryBadge
            label={t.needsAttention}
            count={groupedResults.negative.length}
            active={activeGroup === "negative"}
            onClick={() => setActiveGroup("negative")}
          />
          <SummaryBadge
            label={t.warning}
            count={groupedResults.warning.length}
            active={activeGroup === "warning"}
            onClick={() => setActiveGroup("warning")}
          />
          <SummaryBadge
            label={t.normal}
            count={groupedResults.normal.length}
            active={activeGroup === "normal"}
            onClick={() => setActiveGroup("normal")}
          />
          <SummaryBadge
            label={t.positive}
            count={groupedResults.positive.length}
            active={activeGroup === "positive"}
            onClick={() => setActiveGroup("positive")}
          />
          <SummaryBadge
            label={t.neutral}
            count={groupedResults.neutral.length}
            active={activeGroup === "neutral"}
            onClick={() => setActiveGroup("neutral")}
          />
          <SummaryBadge
            label={t.other}
            count={groupedResults.other.length}
            active={activeGroup === "other"}
            onClick={() => setActiveGroup("other")}
          />
        </div>

        {textureSummary && (
          <div className="results-flat-texture">
            <p className="font-bold">
              {t.textureClass}: {textureSummary.className}
            </p>
            <div className="results-flat-texture-stats">
              <span>
                {t.sand}: {textureSummary.sand}%
              </span>
              <span>
                {t.silt}: {textureSummary.silt}%
              </span>
              <span>
                {t.clay}: {textureSummary.clay}%
              </span>
            </div>
          </div>
        )}

        {showHorizontalGraphs ? (
          <ResultsHorizontalGraphs results={visibleResults} t={t} />
        ) : null}

        <div className="mt-2">
          <ResultGroup
            title={t.needsAttention}
            results={visibleGroups.negative}
            t={t}
            tone="negative"
          />
          <ResultGroup
            title={t.warning}
            results={visibleGroups.warning}
            t={t}
            tone="warning"
          />
          <ResultGroup
            title={t.normal}
            results={visibleGroups.normal}
            t={t}
            tone="normal"
          />
          <ResultGroup
            title={t.positive}
            results={visibleGroups.positive}
            t={t}
            tone="positive"
          />
          <ResultGroup
            title={t.neutral}
            results={visibleGroups.neutral}
            t={t}
            tone="neutral"
          />
          <ResultGroup
            title={t.other}
            results={visibleGroups.other}
            t={t}
            tone="other"
          />
        </div>
      </section>

      {saveMessage && (
        <div className="mt-2 rounded-xl bg-green-50 px-4 py-3 text-sm text-green-900">
          {saveMessage}
        </div>
      )}

      {/* Fixed bottom save bar */}
      <div className="app-fixed-action-bar fixed inset-x-0 z-[12000]">
        <div className="mx-auto max-w-2xl px-4 py-3">
          <button
            type="button"
            onClick={saveAnalysis}
            disabled={saving || results.length === 0 || isSaved}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${
              isSaved
                ? "bg-[#f2f2f2] text-[#aeaeb2]"
                : "bg-green-700 text-white hover:bg-green-800"
            }`}
          >
            <Save size={18} />
            {saving ? t.saving : isSaved ? t.analysisSavedState : t.saveAnalysis}
          </button>
        </div>
      </div>

      {missingResults.length > 0 && (
        <section className="mt-6 rounded-3xl border border-orange-200 bg-orange-50 p-5 shadow-sm">
          <h2 className="text-xl font-bold text-orange-950">
            {t.noRangeFound}
          </h2>

          <p className="mt-1 text-orange-900">{t.noRangeFoundDesc}</p>

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {missingResults.map((item) => (
              <div
                key={item.parameter_key}
                className="glass-panel rounded-2xl p-3 text-sm"
              >
                <strong>{item.display_name || item.parameter_name}</strong>:{" "}
                {item.value}
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function SummaryBadge({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const disabled = count === 0;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`results-flat-chip ${active ? "is-active" : ""}`}
    >
      <span className="results-flat-chip-count">{count}</span>
      {label}
    </button>
  );
}

function ResultsHorizontalGraphs({
  results,
  t,
}: {
  results: InterpretationResult[];
  t: (typeof translations)[Language];
}) {
  const points = results
    .filter((result) => Number.isFinite(Number(result.value)))
    .map(buildResultGraphPoint);

  if (points.length === 0) {
    return null;
  }

  return (
    <section className="result-graphs-panel mt-4 rounded-3xl border border-white/65 bg-white/58 p-4 shadow-sm backdrop-blur-2xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-800">
            <BarChart3 size={16} />
            {t.resultGraphs}
          </p>
          <p className="mt-1 text-sm text-slate-600">{t.resultGraphsDesc}</p>
        </div>

        <div className="flex flex-wrap gap-2 text-[11px] font-bold text-slate-600">
          <span className="result-graph-legend result-graph-legend-range">
            {t.referenceBand}
          </span>
          <span className="result-graph-legend result-graph-legend-value">
            {t.measuredValue}
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        {points.map((point) => (
          <div key={point.id} className="result-graph-row">
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-slate-900">
                  {point.label}
                </p>
                <p className="text-xs font-semibold text-slate-500">
                  {point.min !== null && point.max !== null
                    ? `${t.rangeLabel}: ${point.min} - ${point.max} ${point.unit}`
                    : t.noReferenceRange}
                </p>
              </div>

              <div className="shrink-0 text-right">
                <p className="text-sm font-extrabold text-slate-950">
                  {point.value} {point.unit}
                </p>
                <p className={getLevelBadgeClass(point.levelCode)}>
                  {translateLevelCode(point.levelCode, t)}
                </p>
              </div>
            </div>

            <div className="result-graph-track" aria-hidden="true">
              <span
                className="result-graph-zero"
                style={{ left: `${point.zeroPercent}%` }}
              />
              {point.rangeLeft !== null && point.rangeWidth !== null ? (
                <span
                  className="result-graph-range"
                  style={{
                    left: `${point.rangeLeft}%`,
                    width: `${point.rangeWidth}%`,
                  }}
                />
              ) : null}
              <span
                className={`result-graph-value result-graph-value-${point.tone}`}
                style={{
                  left: `${point.barLeft}%`,
                  width: `${point.barWidth}%`,
                }}
              />
              <span
                className={`result-graph-marker result-graph-marker-${point.tone}`}
                style={{ left: `${point.valuePercent}%` }}
              />
            </div>

            <div className="mt-1 flex justify-between text-[10px] font-semibold text-slate-400">
              <span>{Number(point.axisMin.toFixed(2))}</span>
              <span>{Number(point.axisMax.toFixed(2))}</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function WelcomeGuide({
  open,
  t,
  onClose,
}: {
  open: boolean;
  t: (typeof translations)[Language];
  onClose: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[24000] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <section className="glass-modal-shell w-full max-w-lg rounded-3xl p-5 animate-scale-in">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-700">
          {t.authWelcome}
        </p>
        <h2 className="mt-2 text-2xl font-extrabold text-green-950">
          {t.agronomicInterpretation}
        </h2>
        <div className="mt-4 grid gap-3">
          <GuideStep title={t.step1Title} text={t.step1Text} />
          <GuideStep title={t.step2Title} text={t.step2Text} />
          <GuideStep title={t.step3Title} text={t.step3Text} />
          <GuideStep title={t.calculators} text={t.calculatorsDesc} />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="mt-5 min-h-12 w-full rounded-2xl bg-emerald-700 px-5 font-bold text-white shadow-lg shadow-emerald-950/15 hover:bg-emerald-800"
        >
          {t.continueShort}
        </button>
      </section>
    </div>,
    document.body
  );
}

function GuideStep({ title, text }: { title: string; text: string }) {
  return (
    <div className="auth-panel-muted rounded-2xl p-3">
      <p className="font-bold text-green-950">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function ResultGroup({
  title,
  results,
  t,
  tone,
}: {
  title: string;
  results: InterpretationResult[];
  t: (typeof translations)[Language];
  tone: "negative" | "warning" | "normal" | "positive" | "neutral" | "other";
}) {
  if (results.length === 0) {
    return null;
  }

  return (
    <section className={`results-flat-group results-flat-group--${tone}`}>
      <h3 className="results-flat-group-title">
        {title} · {results.length}
      </h3>

      <div className="results-flat-rows">
        {results.map((result) => (
          <div
            key={
              result.custom_parameter_id
                ? `c-${result.custom_parameter_id}`
                : `p-${result.parameter_id}`
            }
            className="results-flat-row"
          >
            <span className="results-flat-param">
              {result.display_parameter_name || result.parameter_name}
              {result.custom_parameter_id ? ` (${t.customBadge})` : ""}
            </span>
            <span className="results-flat-value">
              {result.value} {result.unit_symbol}
            </span>
            <span className="results-flat-range">
              {result.min ?? "—"}–{result.max ?? "—"}
            </span>
            <span className={getLevelBadgeClass(result.level_code)}>
              {translateLevelCode(result.level_code, t)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
