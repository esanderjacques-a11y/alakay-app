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
import AppDock from "@/components/ui/AppDock";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import HomeScreen from "@/components/HomeScreen";
import { AppStep } from "@/lib/appSteps";
import { exportAnalysisPdf } from "@/lib/pdfReport";
import { RequestTimeoutError } from "@/lib/fetchWithTimeout";
import { formatMessage, Language, translations } from "@/lib/translations";
import {
  applyAccentColor,
  applyBrightness,
  applyTheme,
  persistLanguage,
  readStoredAccent,
  readStoredBrightness,
  readStoredLanguage,
  readStoredTheme,
  resolveThemePreference,
  type AppTheme,
} from "@/lib/uiPreferences";
import { getSettings, updateSetting, type AppSettings } from "@/lib/appSettings";
import { translateCategory } from "@/lib/categoryLabels";
import { countries, countryRegions, type CountryRegion } from "@/lib/countries";
import { supabase } from "@/lib/supabase";
import {
  loadCropAliasMap,
  loadParameterAliasMap,
  loadUnitAliasMap,
  loadUnitAliasOptionsMap,
} from "@/lib/aliases";
import {
  getFinalGroupCode,
  getLevelCode,
  getSimpleAdvice,
} from "@/lib/interpretationLogic";
import { calculateSoilTexture } from "@/lib/soilTexture";

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
  symbol: string | null;
  category: string | null;
  unit_id: number;
  unit_symbol: string;
  is_custom: boolean;
  available_units: {
    unit_id: number;
    unit_symbol: string;
    display_symbol: string;
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

function normalizeParameterText(value: string | null | undefined) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
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
}) {
  return `${unit.unit_id}::${unit.display_symbol || unit.unit_symbol}`;
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
    if (level === "high") return t.adviceSodiumHigh;
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
  "setup",
  "values",
  "results",
  "calculators",
  "history",
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
  const [language, setLanguage] = useState<Language>(() => readStoredLanguage());
  const t = translations[language];
  const [theme, setTheme] = useState<AppTheme>(() => readStoredTheme());

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

  const [cropId, setCropId] = useState<number | "">("");
  const [sampleType, setSampleType] = useState<"soil" | "foliar">("soil");
  const [values, setValues] = useState<Record<string, string>>({});
  const [selectedUnits, setSelectedUnits] = useState<Record<string, number>>({});
  const [selectedUnitDisplayKeys, setSelectedUnitDisplayKeys] = useState<
    Record<string, string>
  >({});
  const [appSettings, setAppSettings] = useState<AppSettings>(() => getSettings());

  const [selectedCategory, setSelectedCategory] = useState("All");
  const [showAllParameters, setShowAllParameters] = useState(true);
  const [parameterSearch, setParameterSearch] = useState("");
  const [sortMode, setSortMode] = useState<"name" | "type">("type");

  const [showReportDetails, setShowReportDetails] = useState(false);
  const [showCustomParameterModal, setShowCustomParameterModal] =
    useState(false);
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

  useEffect(() => {
    applyTheme(theme);
    applyAccentColor(readStoredAccent(), theme);
    applyBrightness(readStoredBrightness());
    document.documentElement.style.setProperty(
      "--app-root-font-size",
      `${16 + getSettings().general.appFontSizeDelta}px`
    );
  }, [theme]);

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

    const parameterAliasMap = await loadParameterAliasMap(
      language,
      officialParameterIds
    );

    const unitAliasMap = await loadUnitAliasMap(language, unitIds);
    const unitAliasOptionsMap = await loadUnitAliasOptionsMap(language, unitIds);

    const officialParameters: Parameter[] = officialRows.map((row) => {
      const unitData = Array.isArray(row.units) ? row.units[0] : row.units;

      const unitId = unitData?.unit_id ?? row.default_unit_id;
      const unitSymbol = unitData?.unit_symbol ?? "";
      const displayUnitSymbol = unitAliasMap.get(unitId) || unitSymbol;

      return {
        parameter_key: `p-${row.parameter_id}`,
        parameter_id: row.parameter_id,
        custom_parameter_id: null,
        parameter_name: row.parameter_name,
        display_name:
          parameterAliasMap.get(row.parameter_id) || row.parameter_name,
        symbol: row.symbol,
        category: row.category,
        unit_id: unitId,
        unit_symbol: unitSymbol,
        is_custom: false,
        available_units:
          unitAliasOptionsMap.get(unitId) || [
            {
              unit_id: unitId,
              unit_symbol: unitSymbol,
              display_symbol: displayUnitSymbol,
            },
          ],
      };
    });

    const customParameters: Parameter[] = customRows.map((row) => {
      const unitData = Array.isArray(row.units) ? row.units[0] : row.units;

      const unitId = unitData?.unit_id ?? row.default_unit_id;
      const unitSymbol = unitData?.unit_symbol ?? "";
      const displayUnitSymbol = unitAliasMap.get(unitId) || unitSymbol;

      return {
        parameter_key: `c-${row.custom_parameter_id}`,
        parameter_id: null,
        custom_parameter_id: row.custom_parameter_id,
        parameter_name: row.parameter_name,
        display_name: row.parameter_name,
        symbol: row.symbol,
        category: row.category || "Custom",
        unit_id: unitId,
        unit_symbol: unitSymbol,
        is_custom: true,
        available_units:
          unitAliasOptionsMap.get(unitId) || [
            {
              unit_id: unitId,
              unit_symbol: unitSymbol,
              display_symbol: displayUnitSymbol,
            },
          ],
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

    setSelectedUnits((previous) => ({
      ...defaultSelectedUnits,
      ...previous,
    }));
    setSelectedUnitDisplayKeys((previous) => ({
      ...defaultSelectedUnitDisplayKeys,
      ...previous,
    }));
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
    importedUnits: Record<string, number>
  ) {
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
  }

  function resetAnalysis() {
    setCropId("");
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
    setShowReportDetails(false);
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

    setShowReportDetails(true);
    setCurrentStep("values");
    setSampleType(payload.sampleType);
  }

  function goToValues() {
    if (!cropId) {
      setMessage(t.selectCropMessage);
      setCurrentStep("setup");
      return;
    }

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
      setMessage(t.selectCropMessage);
      setCurrentStep("setup");
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

    const rpcOutcomes = await Promise.all(
      rpcQueue.map(async (item) => {
        const { data, error } = await supabase.rpc("get_range_match", {
          input_crop_id: cropId,
          input_sample_type: sampleType,
          input_parameter_id: item.parameter_id,
        });

        return { item, data, error };
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

      const logicInput = {
        parameter_id: item.parameter_id || 0,
        parameter_name: item.parameter_name,
        value: item.value,
        min: range.min,
        max: range.max,
      };

      interpretedResults.push({
        ...range,
        custom_parameter_id: null,
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
        sampling_date: samplingDate || null,
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
  const hasAccess = Boolean((session?.user && !showAuthScreen) || guestMode);

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
    theme,
    onToggleTheme: () =>
      setTheme((currentTheme) => {
        const nextTheme = currentTheme === "light" ? "dark" : "light";
        updateSetting("general", "theme", nextTheme);
        return nextTheme;
      }),
  };

  if (sessionRestoring) {
    return (
      <main className="app-main-gradient flex min-h-screen items-center justify-center px-4 text-slate-900">
        <div className="app-boot-spinner" aria-label={t.loadingSavedValues} />
      </main>
    );
  }

  if (!hasAccess) {
    return (
      <main className="auth-page relative flex min-h-screen items-center justify-center px-4 py-8 text-slate-900">
        <div className="absolute right-3 top-3 z-10 sm:right-4 sm:top-4">
          <LanguageSwitcher
            language={language}
            onChange={changeLanguage}
            compact
          />
        </div>
          <LoadingOverlay
            open={isBusy}
            label={loading ? t.interpreting : t.saving}
          />
          <section className="w-full max-w-md animate-slide-up">
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
        </main>
    );
  }

  return (
    <>
      <AppHeader {...headerProps} />
      <WelcomeGuide open={showWelcomeGuide && Boolean(session?.user) && !guestMode} t={t} onClose={closeWelcomeGuide} />
      <main
        className={`app-main-gradient px-4 text-slate-900 ${
          currentStep === "home"
            ? "h-[100dvh] overflow-hidden pb-[5.25rem] pt-[4.25rem]"
            : "min-h-screen pb-28 pt-[4.75rem]"
        }`}
      >
        <LoadingOverlay
          open={isBusy}
          label={loading ? t.interpreting : t.saving}
        />
        <section className="mx-auto max-w-6xl">
        {currentStep === "home" ? (
          <section className="home-screen-wrap">
            <HomeScreen
              t={t}
              session={session}
              guestMode={guestMode}
              startNewAnalysis={resetAnalysis}
              openImporter={(mode = "import") => {
                setLabValueImporterMode(mode);
                setShowLabValueImporter(true);
              }}
              goResults={() => setCurrentStep("history")}
              goCalculators={() => setCurrentStep("calculators")}
              goSettings={() => setCurrentStep("settings")}
              hasResultsOrProgress={hasHistoryOrProgress}
            />
          </section>
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
            message={message}
            showReportDetails={showReportDetails}
            setShowReportDetails={setShowReportDetails}
            analysisName={analysisName}
            setAnalysisName={setAnalysisName}
            labName={labName}
            setLabName={setLabName}
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
            reportDate={reportDate}
            setReportDate={setReportDate}
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
            interpretAnalysis={interpretAnalysis}
            backToSetup={() => setCurrentStep("setup")}
            openImporter={() => {
              setLabValueImporterMode("import");
              setShowLabValueImporter(true);
            }}
            openCustomParameterModal={() => setShowCustomParameterModal(true)}
            openCustomParameterManager={() =>
              setShowCustomParameterManager(true)
            }
            openCustomRangeManager={() => setShowCustomRangeManager(true)}
          />
        ) : currentStep === "results" ? (
          <section className="mt-6">
            {results.length === 0 ? (
              <div className="rounded-3xl bg-white p-6 shadow-sm">
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
            goToValues={() => setCurrentStep("values")}
            onBack={() => setCurrentStep("home")}
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

      <LabValueImporter
        key={labValueImporterMode}
        open={showLabValueImporter}
        mode={labValueImporterMode}
        onClose={() => setShowLabValueImporter(false)}
        parameters={parameters}
        existingValues={values}
        onImportValues={importLabValues}
      />

      <CustomParameterModal
        open={showCustomParameterModal}
        onClose={() => setShowCustomParameterModal(false)}
        onCreated={loadParameters}
        session={session}
        language={language}
        sampleType={sampleType}
        cropId={cropId}
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
  message,
  showReportDetails,
  setShowReportDetails,
  analysisName,
  setAnalysisName,
  labName,
  setLabName,
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
  reportDate,
  setReportDate,
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
  message: string;
  showReportDetails: boolean;
  setShowReportDetails: (
    value: boolean | ((previous: boolean) => boolean)
  ) => void;
  analysisName: string;
  setAnalysisName: (value: string) => void;
  labName: string;
  setLabName: (value: string) => void;
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
  reportDate: string;
  setReportDate: (value: string) => void;
  goHome: () => void;
  goToValues: () => void;
}) {
  function handleSetupKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key !== "Enter" || !cropId) return;

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

  return (
    <section className="mt-4 grid gap-3" onKeyDown={handleSetupKeyDown}>
      <div className="values-screen-panel rounded-3xl p-4 shadow-sm sm:p-5">
        <BackButton onClick={goHome} label={t.start} />

        <h2 className="mt-4 text-lg font-extrabold uppercase tracking-wide text-green-900">
          {t.setupTitle}
        </h2>

        <div className="mt-4 grid gap-4 md:grid-cols-[0.75fr_1fr]">
          <div>
            <label className="mb-1 block text-sm font-semibold">
              {t.sampleType}
            </label>

            <div className="grid grid-cols-2 gap-1 rounded-2xl border border-white/60 bg-white/48 p-1 shadow-sm backdrop-blur-xl">
              <button
                type="button"
                onClick={() => setSampleType("soil")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  sampleType === "soil"
                    ? "bg-white/85 text-green-900 shadow-sm ring-1 ring-green-700/15"
                    : "text-slate-600 hover:bg-white/55"
                }`}
              >
                {t.soil}
              </button>

              <button
                type="button"
                onClick={() => setSampleType("foliar")}
                className={`rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
                  sampleType === "foliar"
                    ? "bg-white/85 text-green-900 shadow-sm ring-1 ring-green-700/15"
                    : "text-slate-600 hover:bg-white/55"
                }`}
              >
                {t.foliar}
              </button>
            </div>
          </div>

          <div>
            <div className="mb-1 flex items-center justify-between gap-2">
              <label className="block text-sm font-semibold">{t.crop}</label>

              {cropId ? (
                <button
                  type="button"
                  onClick={goToValues}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/65 bg-white/70 px-3 text-xs font-extrabold text-green-900 shadow-sm backdrop-blur-xl transition hover:bg-white/90 active:scale-[0.98]"
                >
                  {t.continueShort}
                  <ArrowRight size={15} />
                </button>
              ) : null}
            </div>

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

            {cropsLoading && (
              <p className="mt-2 text-sm text-slate-500">{t.loadingCrops}</p>
            )}

            {!cropsLoading && crops.length === 0 && (
              <div className="mt-3 rounded-2xl bg-red-50 p-3 text-sm text-red-700">
                <p>{t.noCropsLoaded}</p>

                <button
                  type="button"
                  onClick={loadCrops}
                  className="mt-3 rounded-xl bg-red-100 px-4 py-2 font-semibold text-red-800 hover:bg-red-200"
                >
                  {t.reloadCrops}
                </button>
              </div>
            )}
          </div>
        </div>

        {isGeneralCrop && (
          <div className="mt-4 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            {t.generalCropWarning}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-yellow-900">
            {message}
          </div>
        )}
      </div>

      <div className="values-screen-panel rounded-3xl p-3 shadow-sm sm:p-4">
        <div className="flex justify-start">
          <button
            type="button"
            onClick={() => setShowReportDetails((previous) => !previous)}
            className="inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/45 px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-xl hover:bg-white/70"
          >
            <Plus size={16} />
            {showReportDetails ? t.hideReportDetails : t.additionalInfoRecommended}
          </button>
        </div>

        {showReportDetails && (
          <div className="mt-5">
            <ReportDetailsPanel
              analysisName={analysisName}
              setAnalysisName={setAnalysisName}
              labName={labName}
              setLabName={setLabName}
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
              reportDate={reportDate}
              setReportDate={setReportDate}
              t={t}
            />
          </div>
        )}
      </div>

      {cropId ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={goToValues}
            className="touch-target inline-flex items-center gap-2 rounded-2xl border border-white/65 bg-white/72 px-5 py-3 font-extrabold text-green-900 shadow-lg shadow-green-900/10 backdrop-blur-xl hover:bg-white/92 active:scale-[0.98]"
          >
            {t.continueShort}
            <ArrowRight size={18} />
          </button>
        </div>
      ) : null}
    </section>
  );
}

function ValuesScreen({
  t,
  language,
  selectedCrop,
  sampleType,
  isGeneralCrop,
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
  const hasVisibleParameters = Boolean(cropId && filteredParameters.length > 0);
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
      className={`values-screen-panel mt-4 rounded-3xl p-4 shadow-sm md:p-5 ${
        hasVisibleParameters ? "pb-32" : ""
      }`}
    >
      <BackButton onClick={backToSetup} label={t.backToSetup} />

      <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-extrabold uppercase tracking-wide text-green-900 sm:text-lg">
            {t.enterValues}
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            {selectedCrop
              ? `${selectedCrop.display_name} · ${
                  sampleType === "soil" ? t.soil : t.foliar
                }`
              : t.enterValuesHelp}
          </p>

          {isGeneralCrop && (
            <p className="mt-2 rounded-xl bg-yellow-50 px-4 py-2 text-sm text-yellow-900">
              {t.generalReferenceMode}
            </p>
          )}
        </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
            <div className="flex gap-2">
              <StatPill label={t.parameters} value={parameters.length} />
              <StatPill label={t.entered} value={totalEnteredValues} />
            </div>

            {hasEnteredValues ? (
              <button
                type="button"
                onClick={clearAllValues}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-red-100 bg-white/64 px-3 text-xs font-extrabold text-red-700 shadow-sm transition hover:bg-red-50"
              >
                <Eraser size={15} />
                {t.clearAllValues}
              </button>
            ) : null}
          </div>
        </div>

      <div className="relative z-[100] mt-4 rounded-2xl border border-white/65 bg-white/55 p-2 shadow-sm shadow-green-900/5 backdrop-blur-xl animate-slide-up">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                className="w-full rounded-2xl border border-green-700/15 bg-white py-2.5 pl-10 pr-4 text-sm outline-none focus:border-green-700 focus:ring-4 focus:ring-green-700/10"
                placeholder={t.searchPlaceholder}
                value={parameterSearch}
                onChange={(e) => setParameterSearch(e.target.value)}
              />
            </div>

            <div className="relative shrink-0 sm:w-52">
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
          </div>

          <div className="flex gap-2 lg:justify-end">
            <button
              type="button"
              onClick={openImporter}
              title={t.importCsvExcel}
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-green-200 bg-white px-3 text-sm font-semibold text-green-800 transition hover:bg-green-50 lg:flex-none"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">{t.importCsvExcel}</span>
              <span className="sm:hidden">{t.importData}</span>
            </button>

            <div
              ref={customMenuRef}
              className={`relative flex-1 lg:flex-none ${
                showCustomDataMenu ? "z-[19000]" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setShowStickyCustomDataMenu(false);
                  setShowCustomDataMenu((previous) => !previous);
                }}
                title={hasVisibleParameters ? t.addNewParameter : t.addNewParameter}
                className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-white/45 bg-white/60 px-3 text-sm font-bold text-green-900 shadow-sm shadow-green-900/10 backdrop-blur-md transition hover:bg-white/85 active:scale-[0.98] lg:w-auto"
              >
                <Plus size={16} />
                <span>{t.addShort}</span>
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
                      className="w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-green-100 hover:bg-green-50"
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
                      className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-green-100 hover:bg-green-50"
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
                      className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-green-100 hover:bg-green-50"
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
                      className="mt-2 w-full rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-100 hover:bg-slate-100"
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

        <div className="mt-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
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

            <div className="inline-flex shrink-0 rounded-2xl border border-white/70 bg-white/58 p-1 shadow-sm">
              {(["cards", "table"] as const).map((view) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setValueEntryView(view)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-extrabold transition ${
                    valueEntryView === view
                      ? "bg-[var(--accent-600)] text-white shadow-sm"
                      : "text-green-900 hover:bg-white/70"
                  }`}
                  aria-pressed={valueEntryView === view}
                >
                  {view === "table" ? <Table2 size={15} /> : <SlidersHorizontal size={15} />}
                  {view === "table" ? t.tableView : t.cardView}
                </button>
              ))}
            </div>
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
                                className="w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-green-100 hover:bg-green-50"
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
                                className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-green-100 hover:bg-green-50"
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
                                className="mt-2 w-full rounded-2xl bg-white px-4 py-3 text-left shadow-sm ring-1 ring-green-100 hover:bg-green-50"
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
                                className="mt-2 w-full rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 ring-1 ring-slate-100 hover:bg-slate-100"
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
                <div className="fixed inset-x-0 bottom-[5.45rem] z-[14000] px-4 animate-slide-up">
                  <div className="mx-auto flex max-w-lg rounded-[1.75rem] border border-white/70 bg-white/70 p-1.5 shadow-2xl shadow-green-950/16 backdrop-blur-2xl">
                    <button
                      type="button"
                      onClick={interpretAnalysis}
                      disabled={loading || !cropId || Boolean(pendingEditableAnalysis)}
                      className="touch-target group flex w-full items-center justify-center gap-3 rounded-[1.35rem] border border-white/45 bg-white/72 px-6 py-3.5 font-extrabold text-green-900 shadow-lg shadow-green-900/12 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/92 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="grid h-8 w-8 place-items-center rounded-full bg-green-600/12 ring-1 ring-green-700/15 transition group-hover:bg-green-600/18">
                        <FlaskConical size={18} strokeWidth={2.4} />
                      </span>
                      {loading ? t.interpreting : t.interpretAnalysis}
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

      {cropId && filteredParameters.length > 0 && valueEntryView === "table" && (
        <div
          ref={parameterGridRef}
          className="relative z-0 mt-4 overflow-x-auto rounded-2xl border border-white/65 bg-white/58 shadow-sm backdrop-blur-xl animate-slide-up"
        >
          <table className="w-full min-w-[620px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-green-900/10 text-left text-xs font-extrabold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-3">{t.parameterLabel}</th>
                <th className="px-3 py-3">{t.valueLabel}</th>
                <th className="px-3 py-3">{t.unitLabel}</th>
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
                  selectedUnitDisplayKeys[parameter.parameter_key] ||
                  (selectedUnit ? getUnitOptionKey(selectedUnit) : "");
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
                  <tr
                    key={parameter.parameter_key}
                    title={aliasTitle}
                    className="border-b border-green-900/6 last:border-0"
                  >
                    <td className="px-3 py-2 align-middle">
                      <div className="font-bold text-slate-900">
                        {displayParameterLabel}
                      </div>
                      {showParameterDetails && parameter.category ? (
                        <div className="mt-0.5 text-xs text-slate-500">
                          {translateCategory(parameter.category, language, translations)}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 align-middle">
                      <input
                        className="w-full rounded-xl border border-green-700/16 bg-white/65 p-2.5 text-sm font-semibold outline-none backdrop-blur-md focus:border-green-700/60 focus:bg-white/90 focus:ring-4 focus:ring-green-700/10"
                        type="text"
                        inputMode="decimal"
                        value={values[parameter.parameter_key] || ""}
                        onChange={(e) =>
                          updateValue(parameter.parameter_key, e.target.value)
                        }
                        placeholder={t.valuePlaceholder}
                      />
                    </td>
                    <td className="px-3 py-2 align-middle">
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
                          className="w-full rounded-xl border border-green-700/10 bg-white/82 px-3 py-2 text-xs font-bold text-green-800 outline-none focus:border-green-700"
                          title={t.changeUnit}
                        >
                          {parameter.available_units.map((unit) => (
                            <option
                              key={getUnitOptionKey(unit)}
                              value={getUnitOptionKey(unit)}
                            >
                              {unit.display_symbol || unit.unit_symbol}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="inline-flex max-w-28 truncate rounded-xl border border-green-700/10 bg-white/55 px-3 py-2 text-xs font-bold text-green-800"
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

      {cropId && filteredParameters.length > 0 && valueEntryView === "cards" && (
        <div
          ref={parameterGridRef}
          className="relative z-0 mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3"
        >
          {filteredParameters.map((parameter, index) => {
            const selectedUnitId =
              selectedUnits[parameter.parameter_key] || parameter.unit_id;

            const selectedUnit =
              parameter.available_units.find(
                (unit) => unit.unit_id === selectedUnitId
              ) || parameter.available_units[0];
            const selectedUnitDisplayKey =
              selectedUnitDisplayKeys[parameter.parameter_key] ||
              (selectedUnit ? getUnitOptionKey(selectedUnit) : "");
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
                      className="absolute right-2 top-1/2 max-w-24 -translate-y-1/2 rounded-xl border border-green-700/10 bg-white/82 px-2 py-1 text-xs font-bold text-green-800 outline-none focus:border-green-700"
                      title={t.changeUnit}
                    >
                      {parameter.available_units.map((unit) => (
                        <option key={getUnitOptionKey(unit)} value={getUnitOptionKey(unit)}>
                          {unit.display_symbol || unit.unit_symbol}
                        </option>
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

      {cropId && filteredParameters.length === 0 && (
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

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="touch-target inline-flex items-center gap-2 rounded-2xl border border-white/60 bg-white/50 px-4 py-2 text-sm font-semibold text-slate-700 active:scale-[0.98] hover:bg-white/80"
    >
      <ArrowLeft size={16} />
      {label}
    </button>
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-4 py-2 text-center">
      <p className="text-lg font-bold text-green-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

function ReportDetailsPanel({
  analysisName,
  setAnalysisName,
  labName,
  setLabName,
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
  reportDate,
  setReportDate,
  t,
}: {
  analysisName: string;
  setAnalysisName: (value: string) => void;
  labName: string;
  setLabName: (value: string) => void;
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
  reportDate: string;
  setReportDate: (value: string) => void;
  t: (typeof translations)[Language];
}) {
  const [countryRegion, setCountryRegion] = useState<CountryRegion | "">("");
  const filteredCountries = countryRegion
    ? countryRegions.find((group) => group.region === countryRegion)?.countries || []
    : countries;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Field label={t.analysisName}>
        <input
          className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
          placeholder={t.analysisName}
          value={analysisName}
          onChange={(e) => setAnalysisName(e.target.value)}
        />
      </Field>

      <Field label={t.labName}>
        <input
          className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
          placeholder={t.labName}
          value={labName}
          onChange={(e) => setLabName(e.target.value)}
        />
      </Field>

      <Field label={t.farmName}>
        <input
          className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
          placeholder={t.farmName}
          value={farmName}
          onChange={(e) => setFarmName(e.target.value)}
        />
      </Field>

      <Field label={t.lotName}>
        <input
          className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
          placeholder={t.lotName}
          value={lotName}
          onChange={(e) => setLotName(e.target.value)}
        />
      </Field>

      <Field label={t.region}>
        <AppSelect
          value={countryRegion}
          placeholder={t.allRegions}
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
      </Field>

      <Field label={t.country}>
        <AppSelect
          value={country}
          placeholder={t.selectCountry}
          searchable
          options={[
            { label: t.selectCountry, value: "" },
            ...filteredCountries.map((item) => ({ label: item, value: item })),
          ]}
          onChange={setCountry}
        />
      </Field>

      <Field label={t.provinceState}>
        <input
          className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
          placeholder={t.provinceState}
          value={provinceState}
          onChange={(e) => setProvinceState(e.target.value)}
        />
      </Field>

      {country === "Other" && (
        <Field label={t.typeCountry}>
          <input
            className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
            placeholder={t.typeCountry}
            value={customCountry}
            onChange={(e) => setCustomCountry(e.target.value)}
          />
        </Field>
      )}

      <div className="md:col-span-2">
        <details className="rounded-2xl bg-slate-50 p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">
            {t.optionalDates}
          </summary>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Field label={t.samplingDate}>
              <input
                className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
                type="date"
                value={samplingDate}
                onChange={(e) => setSamplingDate(e.target.value)}
              />
            </Field>

            <Field label={t.reportDate}>
              <input
                className="w-full rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </Field>
          </div>
        </details>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
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
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const selectedOption = options.find((option) => option.value === value);
  const visibleOptions = searchable
    ? options.filter((option) => {
        if (option.value === "") return true;
        return option.label.toLowerCase().includes(searchTerm.trim().toLowerCase());
      })
    : options;
  const useFloatingMenu = floatingMenu || iconOnlyOnMobile;

  useDismissible(open, () => setOpen(false), menuRef);

  useEffect(() => {
    if (!open) setSearchTerm("");
  }, [open]);

  useLayoutEffect(() => {
    if (!open || !useFloatingMenu || !triggerRef.current) return;

    function updateMenuPosition() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const width = Math.max(rect.width, 220);
      const left = Math.min(
        Math.max(12, rect.left),
        window.innerWidth - width - 12
      );

      setMenuStyle({
        position: "fixed",
        top: rect.bottom + 8,
        left,
        width,
        zIndex: 16000,
      });
    }

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [open, useFloatingMenu]);

  const menu = presence.mounted ? (
    <section
      style={useFloatingMenu && !inlineMenu ? menuStyle : undefined}
      className={`z-[16000] overflow-hidden rounded-3xl border border-green-100 bg-white p-2 shadow-2xl shadow-green-900/15 ${
        presence.leaving ? "animate-scale-out" : "animate-scale-in"
      } ${
        useFloatingMenu && !inlineMenu
          ? ""
          : inlineMenu
            ? "relative mt-2"
            : "absolute inset-x-0 top-full mt-2"
      }`}
    >
      {searchable ? (
        <div className="relative mb-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={placeholder}
            className="w-full rounded-2xl border border-green-100 bg-white/90 px-3 py-2 pl-9 text-sm font-semibold text-slate-900 outline-none focus:border-green-500"
          />
        </div>
      ) : null}
      <div className="max-h-72 overflow-y-auto pr-1">
        {visibleOptions.map((option) => {
          const selected = option.value === value;

          return (
            <button
              key={`${option.value}`}
              type="button"
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold transition ${
                selected
                  ? "bg-green-50 text-green-900"
                  : "text-slate-700 hover:bg-green-50/80"
              }`}
            >
              <span className="whitespace-nowrap">{option.label}</span>
              {selected ? (
                <Check size={16} className="shrink-0 text-green-700" />
              ) : null}
            </button>
          );
        })}
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
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        className={`flex w-full items-center justify-between gap-2 rounded-2xl border bg-white text-left shadow-sm outline-none transition focus:border-green-700 focus:ring-4 focus:ring-green-700/10 ${
          compact
            ? iconOnlyOnMobile
              ? "px-2.5 py-2.5 text-sm font-semibold sm:px-3.5"
              : "px-3.5 py-2.5 text-sm font-semibold"
            : "px-4 py-3 text-base"
        } ${
          open
            ? "border-green-600 ring-4 ring-green-700/10"
            : "border-green-700/20 hover:border-green-400"
        }`}
      >
        {icon ? (
          <span className="grid h-5 w-5 shrink-0 place-items-center text-green-800">
            {icon}
          </span>
        ) : null}
        <span
          className={`truncate ${
            iconOnlyOnMobile ? "sr-only sm:not-sr-only sm:block" : ""
          } ${
            selectedOption?.value === "" || !selectedOption
              ? "text-slate-400"
              : "text-slate-900"
          }`}
        >
          {selectedOption?.label || placeholder}
        </span>
        <ChevronDown
          size={iconOnlyOnMobile ? 16 : 18}
          className={`shrink-0 text-green-800 transition ${
            iconOnlyOnMobile ? "hidden sm:block" : ""
          } ${open ? "rotate-180" : ""}`}
        />
      </button>

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

function ResultsSection({
  results,
  groupedResults,
  missingResults,
  textureSummary,
  language,
  t,
  saving,
  saveMessage,
  saveAnalysis,
  isSaved,
  reportMeta,
  isGeneralCrop,
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
      <section
        data-pdf-report="analysis"
        className="values-screen-panel rounded-3xl p-4 shadow-sm sm:p-5"
      >
        <div className="mb-4 flex flex-col gap-3 border-b border-white/55 pb-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <img
              src="/app-icon.png"
              alt="Alakay logo"
              className="app-logo-frame h-16 w-16 rounded-2xl object-cover"
            />

            <div>
              <h1 className="text-xl font-extrabold text-green-900">
                Alakay
              </h1>
              <p className="text-sm font-medium text-slate-500">
                {t.reportSubtitle}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {t.generatedOn} {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="text-left text-sm text-slate-600 md:text-right">
            <p className="font-semibold text-slate-800">
              {t.agronomicSummary}
            </p>
            <p>{formatMessage(t.interpretedValuesCount, { count: results.length })}</p>
          </div>
        </div>

        <BackButton onClick={backToValues} label={t.goToValues} />

        <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-extrabold text-green-900">
              {t.analysisSummary}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {formatMessage(t.interpretedValuesCount, { count: results.length })}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setActiveGroup("all")}
            className={`rounded-2xl px-4 py-3 text-sm font-bold ${
              activeGroup === "all"
                ? "bg-green-700 text-white"
                : "bg-slate-50 text-slate-700 hover:bg-green-50"
            }`}
          >
            {t.allResults} · {results.length}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
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
        </div>

        {isGeneralCrop && (
          <div className="mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-900">
            {t.generalCropWarning}
          </div>
        )}

        {textureSummary && (
          <div className="mt-4 rounded-2xl border border-white/55 bg-white/52 p-4 text-emerald-950 backdrop-blur-xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-bold">
                  {t.textureClass}: {textureSummary.className}
                </h3>

                <p className="mt-1 text-sm text-emerald-900">
                  {textureSummary.explanation}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/70 px-3 py-2">
                  <p className="font-bold">{textureSummary.sand}%</p>
                  <p>{t.sand}</p>
                </div>

                <div className="rounded-xl bg-white/70 px-3 py-2">
                  <p className="font-bold">{textureSummary.silt}%</p>
                  <p>{t.silt}</p>
                </div>

                <div className="rounded-xl bg-white/70 px-3 py-2">
                  <p className="font-bold">{textureSummary.clay}%</p>
                  <p>{t.clay}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        <ResultsHorizontalGraphs results={visibleResults} t={t} />

        <div className="mt-4 grid gap-3">
          <ResultGroup
            title={t.needsAttention}
            description={t.needsAttentionDesc}
            results={visibleGroups.negative}
            t={t}
            tone="red"
          />
          <ResultGroup
            title={t.warning}
            description={t.warningDesc}
            results={visibleGroups.warning}
            t={t}
            tone="yellow"
          />
          <ResultGroup
            title={t.normal}
            description={t.normalDesc}
            results={visibleGroups.normal}
            t={t}
            tone="green"
          />
          <ResultGroup
            title={t.positive}
            description={t.positiveDesc}
            results={visibleGroups.positive}
            t={t}
            tone="emerald"
          />
          <ResultGroup
            title={t.neutral}
            description={t.neutralDesc}
            results={visibleGroups.neutral}
            t={t}
            tone="slate"
          />
          <ResultGroup
            title={t.other}
            description={t.otherDesc}
            results={visibleGroups.other}
            t={t}
            tone="slate"
          />
        </div>
      </section>

      <div className="sticky bottom-[5.25rem] z-[12000] mt-4 grid gap-2 rounded-3xl border border-white/65 bg-white/68 p-2 shadow-2xl shadow-green-950/12 backdrop-blur-2xl md:grid-cols-2">
        <button
          type="button"
          onClick={exportToPdf}
          disabled={exportingPdf || results.length === 0}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/45 bg-white/72 px-5 py-3 font-semibold text-green-950 shadow-sm hover:bg-white/92 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download size={18} />
          {exportingPdf ? t.exportingPdf : t.exportPdf}
        </button>

        <button
          type="button"
          onClick={saveAnalysis}
          disabled={saving || results.length === 0 || isSaved}
          className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3 font-semibold shadow-sm disabled:cursor-not-allowed ${
            isSaved
              ? "border border-white/45 bg-white/50 text-slate-400"
              : "border border-white/45 bg-green-700/88 text-white hover:bg-green-800"
          }`}
        >
          <Save size={18} />
          {saving ? t.saving : isSaved ? t.analysisSavedState : t.saveAnalysis}
        </button>
      </div>

      {saveMessage && (
        <div className="mt-4 rounded-2xl bg-green-50 p-4 text-green-900">
          {saveMessage}
        </div>
      )}

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
                className="rounded-2xl bg-white p-3 text-sm"
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
      className={`rounded-2xl px-3 py-3 text-center transition ${
        active
          ? "bg-green-700 text-white"
          : disabled
            ? "cursor-not-allowed bg-slate-50 text-slate-300"
            : "bg-slate-50 text-slate-700 hover:bg-green-50"
      }`}
    >
      <p className="text-lg font-bold">{count}</p>
      <p className="text-xs">{label}</p>
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
      <section className="w-full max-w-lg rounded-3xl border border-white/70 bg-white/90 p-5 shadow-2xl animate-scale-in">
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
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-3">
      <p className="font-bold text-green-950">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{text}</p>
    </div>
  );
}

function ResultGroup({
  title,
  description,
  results,
  t,
  tone,
}: {
  title: string;
  description: string;
  results: InterpretationResult[];
  t: (typeof translations)[Language];
  tone: "red" | "yellow" | "green" | "emerald" | "slate";
}) {
  if (results.length === 0) {
    return null;
  }

  const toneClasses = {
    red: "border-red-300/80 bg-red-100/78 text-red-950 shadow-red-950/6",
    yellow: "border-amber-300/80 bg-amber-100/78 text-amber-950 shadow-amber-950/6",
    green: "border-emerald-300/80 bg-emerald-100/76 text-emerald-950 shadow-emerald-950/6",
    emerald: "border-teal-300/80 bg-teal-100/76 text-teal-950 shadow-teal-950/6",
    slate: "border-slate-300/80 bg-slate-100/76 text-slate-950 shadow-slate-950/6",
  };

  return (
    <section className={`rounded-2xl border p-4 shadow-sm backdrop-blur-xl ${toneClasses[tone]}`}>
      <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-lg font-bold">{title}</h3>
          <p className="text-sm opacity-80">{description}</p>
        </div>

        <span className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold">
          {results.length}
        </span>
      </div>

      <div className="mt-4 grid gap-3">
        {results.map((result) => (
          <div
            key={
              result.custom_parameter_id
                ? `c-${result.custom_parameter_id}`
                : `p-${result.parameter_id}`
            }
            className="rounded-2xl bg-white/72 p-4 text-slate-900 shadow-sm backdrop-blur-xl"
          >
            <div className="flex flex-col justify-between gap-2 md:flex-row">
              <div>
                <p className="font-bold">
                  {result.display_parameter_name || result.parameter_name}
                  {result.custom_parameter_id ? (
                    <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">
                      {t.customBadge}
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-slate-600">
                  {result.value} {result.unit_symbol}
                </p>
                <p className="text-xs text-slate-500">
                  {t.rangeLabel}: {result.min ?? "—"} - {result.max ?? "—"}{" "}
                  {result.unit_symbol}
                </p>
              </div>

              <div className="text-left md:text-right">
                <p className={getLevelBadgeClass(result.level_code)}>
                  {translateLevelCode(result.level_code, t)}
                </p>
                <p className="text-sm text-slate-600">
                  {t.confidence}: {translateConfidence(result.confidence, t)}
                </p>
              </div>
            </div>

            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
              {translateAdvice(result, t)}
            </p>

            <div className="mt-2 text-sm text-slate-600">
              {t.source}: {translateSourceName(result.source_name, t)}
              {result.is_proxy ? ` · ${t.proxyRange}` : ""}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
