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
  Eraser,
  FlaskConical,
  BarChart3,
  Info,
  Plus,
  Save,
  Search,
  SlidersHorizontal,
  Sprout,
  Upload,
  X,
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
import AddDataMenu from "@/components/AddDataMenu";
import ValuesDisplayMenu from "@/components/ValuesDisplayMenu";
import ParameterUnitPicker from "@/components/ParameterUnitPicker";
import ResultsDashboard from "@/components/ResultsDashboard";
import RecycleBinScreen from "@/components/RecycleBinScreen";
import CalculatorHub from "@/components/CalculatorHub";
import type { FertilizerPlanSnapshot } from "@/components/CalculatorHub";
import AppSettingsScreen, {
  type SettingsSectionId,
} from "@/components/AppSettingsScreen";
import AboutScreen from "@/components/AboutScreen";
import CalendarScreen from "@/components/planning/CalendarScreen";
import FarmsScreen from "@/components/planning/FarmsScreen";
import NotesScreen from "@/components/planning/NotesScreen";
import NotificationsScreen from "@/components/planning/NotificationsScreen";
import AppDock from "@/components/ui/AppDock";
import LoadingOverlay from "@/components/ui/LoadingOverlay";
import HomeScreen from "@/components/HomeScreen";
import BillingScreen from "@/components/billing/BillingScreen";
import BillingAdminScreen from "@/components/billing/BillingAdminScreen";
import VerificationScreen from "@/components/billing/VerificationScreen";
import FarmLotSelector from "@/components/FarmLotSelector";
import { detectLocation } from "@/lib/geolocation";
import {
  hydratePlanningFromCloud,
  loadPlanningState,
  pushNotification,
  setPlanningUserId,
  unreadNotificationCount,
} from "@/lib/planningStore";
import type { JackoAppContext } from "@/lib/jackoContext";

import BackButton from "@/components/ui/BackButton";
import { ViewLayoutToggle } from "@/components/ui/ViewLayoutToggle";
import { AppStep } from "@/lib/appSteps";
import { isAdminEmail } from "@/lib/admin";
import {
  buildExportRecommendations,
  buildPdfExportChecklist,
  exportAnalysisPdf,
  mergeCalculatorOutputPacks,
  type CalculatorOutputPack,
  type PdfFertilizerProduct,
  type PdfReportMeta,
  type PdfReportSectionOptions,
} from "@/lib/pdfReport";
import ExportReportModal from "@/components/ExportReportModal";
import ExportPdfIconButton from "@/components/ExportPdfIconButton";
import { RequestTimeoutError } from "@/lib/fetchWithTimeout";
import { formatMessage, Language, translations } from "@/lib/translations";
import { calculatorHubText } from "@/lib/i18n/componentText";
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
  effectiveShowCalculatorFormulas,
  getSettings,
  updateSetting,
  type AppSettings,
} from "@/lib/appSettings";
import { translateCategory } from "@/lib/categoryLabels";
import { countries, countryRegions, type CountryRegion } from "@/lib/countries";
import { supabase } from "@/lib/supabase";
import {
  enqueueAnalysisSave,
  flushOfflineAnalysisQueue,
  getOfflineQueueCount,
  isSignatureQueued,
  shouldQueueAnalysisSave,
  subscribeOfflineQueue,
} from "@/lib/offlineAnalysisQueue";
import { saveAnalysisToSupabase } from "@/lib/saveAnalysisToSupabase";
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
import {
  migrateLegacyImportMemory,
  purgeExpiredImportCache,
} from "@/lib/importCache";
import {
  FOLIAR_EXTRACTION_OPTIONS,
  GENERAL_CROP_EXTRACTION_OPTIONS,
  SOIL_EXTRACTION_OPTIONS,
  getDefaultExtractionMethod,
  convertTable1RangeToDisplayUnit,
  resolveInterpretationParameter,
  table1SufficientRange,
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
  /** Friendly default shown in Values (% | mg/kg | cmol(+)/kg when applicable). */
  preferred_display_symbol: string;
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
  parameter_key?: string;
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

/** Exchangeable bases + related: searching "bases" should surface Ca, Mg, K, Na. */
const PARAMETER_SEARCH_GROUPS: Array<{
  triggers: RegExp;
  match: (parameter: Parameter) => boolean;
}> = [
  {
    triggers:
      /\b(bas|bases?|baz|besi|cations?|cationes?|cationiques?|intercambiables?|echangeables?|exchangeable)\b/i,
    match: (parameter) => {
      const symbol = String(parameter.symbol || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
      if (["ca", "mg", "k", "na"].includes(symbol)) return true;
      const text = normalizeParameterText(
        [
          parameter.display_name,
          parameter.parameter_name,
          ...(parameter.aliases || []),
        ].join(" ")
      );
      return /\b(calcium|calcio|magnesium|magnesio|potassium|potasio|sodium|sodio|base saturation|saturacion de bases|saturation en bases|saturacao de bases|exchangeable|intercambiable|echangeable)\b/.test(
        text
      );
    },
  },
];

function parameterSearchHaystack(parameter: Parameter) {
  return {
    displayName: normalizeParameterText(parameter.display_name),
    baseName: normalizeParameterText(parameter.parameter_name),
    symbol: normalizeParameterText(parameter.symbol || ""),
    category: normalizeParameterText(parameter.category || ""),
    aliases: (parameter.aliases || []).map((alias) => normalizeParameterText(alias)),
  };
}

/**
 * Lower is better. Names containing the typed letters rank ahead of synonym-only
 * matches (e.g. "Base saturation" before Ca when searching "bases").
 */
function getParameterSearchRank(parameter: Parameter, search: string): number | null {
  const needle = normalizeParameterText(search).trim();
  if (!needle) return 0;

  const { displayName, baseName, symbol, category, aliases } =
    parameterSearchHaystack(parameter);

  if (displayName.startsWith(needle) || baseName.startsWith(needle)) return 0;
  if (displayName.includes(needle) || baseName.includes(needle)) return 1;
  if (aliases.some((alias) => alias.startsWith(needle))) return 2;
  if (aliases.some((alias) => alias.includes(needle))) return 3;
  if (symbol && (symbol === needle || symbol.startsWith(needle))) return 4;
  if (category.includes(needle)) return 5;

  for (const group of PARAMETER_SEARCH_GROUPS) {
    if (group.triggers.test(needle) && group.match(parameter)) return 6;
  }

  return null;
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

function dedupeUnitOptions<
  T extends {
    unit_id: number;
    unit_symbol: string;
    display_symbol: string;
    canonical_symbol?: string;
  },
>(options: T[]) {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const option of options) {
    const key = getUnitOptionKey(option);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(option);
  }

  return result;
}

function getUnitSymbolForConversion(unit: {
  unit_symbol: string;
  display_symbol: string;
  canonical_symbol?: string;
}) {
  return unit.canonical_symbol || unit.unit_symbol || unit.display_symbol;
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
    "g/100g": "%",
    "percent": "%",
    "ug/g": "mg/kg",
    "µg/g": "mg/kg",
    "ppm": "mg/kg",
    "cmolc/kg": "cmol(+)/kg",
    "cmol/kg": "cmol(+)/kg",
    "cmol(+)kg-1": "cmol(+)/kg",
    "cmolckg-1": "cmol(+)/kg",
    "cmolkg-1": "cmol(+)/kg",
    "meq/100g": "cmol(+)/kg",
    "meq100g-1": "cmol(+)/kg",
    "meq/100g-1": "cmol(+)/kg",
    "mmhos/cm": "dS/m",
    "mmhoscm-1": "dS/m",
    "mmho/cm": "dS/m",
    "mmhocm-1": "dS/m",
  };

  return friendlySymbols[compact] || unitSymbol;
}

function resolvePreferredDisplaySymbol(
  parameter: {
    parameter_name: string;
    symbol: string | null;
    category: string | null;
  },
  sampleType: "soil" | "foliar",
  fallbackUnitSymbol: string
) {
  const preferred =
    sampleType === "foliar"
      ? getPreferredFoliarUnitSymbol(parameter)
      : getPreferredSoilUnitSymbol(parameter);

  return preferred || getFriendlyUnitSymbol(fallbackUnitSymbol);
}

function getPreferredUnitDisplayKey(
  parameter: Parameter,
  selectedUnitId: number,
  currentDisplayKey?: string
) {
  if (currentDisplayKey) {
    const currentOption = parameter.available_units.find(
      (unit) => getUnitOptionKey(unit) === currentDisplayKey
    );
    if (currentOption) return currentDisplayKey;
  }

  const preferredDisplay =
    parameter.preferred_display_symbol ||
    getFriendlyUnitSymbol(parameter.unit_symbol);

  const selectedOption = pickPreferredDisplayOption(
    parameter.available_units,
    preferredDisplay,
    selectedUnitId
  );

  return selectedOption ? getUnitOptionKey(selectedOption) : "";
}

function resolveParameterUnitState(
  parameter: Parameter,
  selectedUnits: Record<string, number>,
  selectedUnitDisplayKeys: Record<string, string>
) {
  const selectedUnitId =
    selectedUnits[parameter.parameter_key] || parameter.unit_id;
  const selectedUnit =
    pickPreferredDisplayOption(
      parameter.available_units.filter((unit) => unit.unit_id === selectedUnitId),
      parameter.preferred_display_symbol || getFriendlyUnitSymbol(parameter.unit_symbol),
      selectedUnitId
    ) || parameter.available_units[0];
  const selectedUnitDisplayKey =
    getPreferredUnitDisplayKey(
      parameter,
      selectedUnitId,
      selectedUnitDisplayKeys[parameter.parameter_key]
    ) || (selectedUnit ? getUnitOptionKey(selectedUnit) : "");

  return { selectedUnitId, selectedUnit, selectedUnitDisplayKey };
}

function normalizeUnitSymbol(unitSymbol: string) {
  return getFriendlyUnitSymbol(unitSymbol)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function compactUnitSymbol(unitSymbol: string) {
  return String(unitSymbol || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/\u00b5/g, "u")
    .replace(/\u03bc/g, "u");
}

/** mg/kg and ppm are equivalent; always prefer the literal mg/kg label for display. */
function massDisplayRank(unitSymbol: string) {
  const raw = compactUnitSymbol(unitSymbol);
  if (raw === "mg/kg" || raw === "mgkg-1" || raw === "mg.kg-1") return 0;
  // Keep ppm (and ug/g) selectable, but never pick them as the default label.
  if (raw === "ppm" || raw === "ug/g") return 2;
  const normalized = normalizeUnitSymbol(unitSymbol);
  if (normalized === "mg/kg") return 1;
  return 3;
}

function pickPreferredDisplayOption<
  T extends {
    unit_id: number;
    unit_symbol: string;
    display_symbol: string;
    canonical_symbol?: string;
  },
>(options: T[], preferredDisplay: string, selectedUnitId?: number) {
  const normalizedPreferred = normalizeUnitSymbol(preferredDisplay);
  const compactPreferred = compactUnitSymbol(preferredDisplay);

  // Prefer an option whose visible label matches the preferred text literally
  // (so "mg/kg" wins over "ppm" even though they are numerically equivalent).
  let candidates = options.filter(
    (unit) =>
      compactUnitSymbol(unit.display_symbol || unit.unit_symbol) === compactPreferred
  );

  if (candidates.length === 0) {
    candidates = options.filter(
      (unit) =>
        normalizeUnitSymbol(unit.display_symbol || unit.unit_symbol) ===
        normalizedPreferred
    );
    // When preferring mg/kg, drop ppm labels if a true mg/kg label exists among matches.
    if (normalizedPreferred === "mg/kg") {
      const withoutPpm = candidates.filter((unit) => {
        const raw = compactUnitSymbol(unit.display_symbol || unit.unit_symbol);
        return raw !== "ppm" && raw !== "ug/g";
      });
      if (withoutPpm.length > 0) candidates = withoutPpm;
    }
  }

  if (selectedUnitId !== undefined) {
    const withUnit = candidates.filter((unit) => unit.unit_id === selectedUnitId);
    if (withUnit.length > 0) candidates = withUnit;
  }

  if (candidates.length === 0) {
    const unitMatches =
      selectedUnitId !== undefined
        ? options.filter((unit) => unit.unit_id === selectedUnitId)
        : options;
    candidates = unitMatches.length > 0 ? unitMatches : options;
  }

  return (
    [...candidates].sort(
      (left, right) =>
        massDisplayRank(left.display_symbol || left.unit_symbol) -
          massDisplayRank(right.display_symbol || right.unit_symbol) ||
        String(left.display_symbol || "").localeCompare(String(right.display_symbol || ""))
    )[0] || options[0]
  );
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

function getPreferredSoilUnitSymbol(parameter: {
  parameter_name: string;
  symbol: string | null;
  category: string | null;
}) {
  const symbol = String(parameter.symbol || "").trim().toLowerCase();
  const name = parameter.parameter_name.toLowerCase();
  const category = String(parameter.category || "").toLowerCase();

  if (
    category.includes("physical") ||
    /\b(organic matter|materia organica|matiere organique|matye oganik)\b/.test(
      name
    ) ||
    /\b(base saturation|saturacion de bases|saturation en bases|saturacao de bases)\b/.test(
      name
    )
  ) {
    return "%";
  }

  if (
    /\b(cec|cic|cice|cation exchange|intercambio cationico|capacidad de intercambio)\b/.test(
      name
    ) ||
    /\b(exchangeable acidity|acidez intercambiable|acidite echangeable|h\+al)\b/.test(
      name
    ) ||
    ["k", "ca", "mg", "na"].includes(symbol)
  ) {
    return "cmol(+)/kg";
  }

  if (
    category.includes("micro") ||
    category.includes("toxic") ||
    /\b(phosphorus|fosforo|phosphore|phosphate|fosfato|nitrate|nitrato|nitrogen|nitrogeno|ammonium|amonio|sulfur|sulphur|azufre|soufre|zinc|iron|hierro|manganese|manganeso|copper|cobre|boron|boro|aluminum|aluminium|aluminio|molybdenum|molibdeno|chloride|cloruro)\b/.test(
      name
    ) ||
    ["p", "s", "n", "no3", "nh4", "b", "cu", "fe", "mn", "zn", "mo", "cl", "al"].includes(
      symbol
    )
  ) {
    return "mg/kg";
  }

  return null;
}

function findUnitBySymbol(
  units: Array<{ unit_id: number; unit_symbol: string }>,
  unitSymbol: string | null
) {
  if (!unitSymbol) return null;
  const preferredDisplay = getFriendlyUnitSymbol(unitSymbol);
  const normalizedSymbol = normalizeUnitSymbol(preferredDisplay);

  const exactMatch = units.find(
    (unit) =>
      unit.unit_symbol === preferredDisplay ||
      getFriendlyUnitSymbol(unit.unit_symbol) === preferredDisplay
  );
  if (exactMatch) return exactMatch;

  const normalizedMatch = units.find(
    (unit) => normalizeUnitSymbol(unit.unit_symbol) === normalizedSymbol
  );
  if (normalizedMatch) return normalizedMatch;

  return (
    units.find((unit) => canConvertLabUnit(unit.unit_symbol, preferredDisplay)) ||
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

type ParameterPriorityTier = "key" | "standard" | "secondary";

function getParameterPriorityTier(parameter: Parameter): ParameterPriorityTier {
  const rank = getParameterSortRank(parameter);
  if (rank < 100) return "key";
  if (rank < 300) return "standard";
  return "secondary";
}

function resolveParameterSymbol(parameter: Parameter) {
  const direct = parameter.symbol?.trim();
  if (direct) return direct;

  const fromDisplay = parameter.display_name.match(/\(([^)]+)\)\s*$/);
  if (fromDisplay?.[1]?.trim()) return fromDisplay[1].trim();

  return null;
}

function formatParameterEntryLabel(
  parameter: Parameter,
  showSymbolsOnly: boolean
) {
  const symbol = resolveParameterSymbol(parameter);

  if (showSymbolsOnly && symbol) {
    return { primary: symbol };
  }

  const primary = parameter.display_name;
  const secondary =
    symbol && symbol.toLowerCase() !== primary.trim().toLowerCase()
      ? symbol
      : undefined;

  return { primary, secondary };
}

function priorityTierLabel(
  tier: ParameterPriorityTier,
  t: (typeof translations)[Language]
) {
  if (tier === "key") return t.valuesGroupKey;
  if (tier === "standard") return t.valuesGroupStandard;
  return t.valuesGroupSecondary;
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

  // Red — excess / out of range (not good)
  if (
    key === "very_high" ||
    key === "high" ||
    key === "acidic" ||
    key === "alkaline"
  ) {
    return "level-badge level-badge-high";
  }

  // Yellow — low / deficient
  if (
    key === "very_low" ||
    key === "low" ||
    key === "moderate" ||
    key === "medium"
  ) {
    return "level-badge level-badge-low";
  }

  // Green — adequate / normal
  return "level-badge level-badge-normal";
}

function getLevelToneClass(code: string) {
  const key = code.toLowerCase().trim().replace(/[\s-]+/g, "_");

  if (
    key === "very_high" ||
    key === "high" ||
    key === "acidic" ||
    key === "alkaline"
  ) {
    return "values-level-tone--high";
  }

  if (
    key === "very_low" ||
    key === "low" ||
    key === "moderate" ||
    key === "medium"
  ) {
    return "values-level-tone--low";
  }

  return "values-level-tone--normal";
}

function findResultForParameter(
  results: InterpretationResult[],
  parameter: Parameter
) {
  return (
    results.find((result) => result.parameter_key === parameter.parameter_key) ||
    results.find(
      (result) =>
        parameter.custom_parameter_id != null &&
        result.custom_parameter_id === parameter.custom_parameter_id
    ) ||
    results.find(
      (result) =>
        !parameter.custom_parameter_id &&
        parameter.parameter_id != null &&
        result.parameter_id === parameter.parameter_id
    )
  );
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

  return labels[normalized] || sourceName.replace(/Tabla\s*N\.?\s*°?\s*\d+\s*[—–-]?\s*/gi, "").trim() || sourceName;
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
  "billing",
  "verification",
  "farms",
  "calendar",
  "notes",
  "notifications",
  "lab-scan",
  "lab-import",
]);

function readHistoryStep(state: unknown): AppStep | null {
  if (!state || typeof state !== "object") return null;
  const step = (state as { cultosolStep?: unknown }).cultosolStep;
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
  const stepBeforeSettingsRef = useRef<AppStep>("home");
  const billingReturnStepRef = useRef<AppStep>("home");
  const labScanReturnStepRef = useRef<AppStep>("home");
  const labImportReturnStepRef = useRef<AppStep>("home");
  const [settingsInitialSection, setSettingsInitialSection] =
    useState<SettingsSectionId | undefined>(undefined);
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
  const [extractionMethod, setExtractionMethod] = useState<ExtractionMethod>("olsen");
  const [values, setValues] = useState<Record<string, string>>({});
  const [labReportRanges, setLabReportRanges] = useState<
    Record<string, { min: number | null; max: number | null; raw: string; rating?: string | null }>
  >({});
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
  const [importerInitialCacheId, setImporterInitialCacheId] = useState<
    string | null
  >(null);
  const resumeImporterAfterCustomParameterSaveRef = useRef(false);
  const customParameterSavedFromImporterRef = useRef(false);
  const [showCustomParameterManager, setShowCustomParameterManager] =
    useState(false);
  const [showCustomRangeManager, setShowCustomRangeManager] = useState(false);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState(false);
  const [labValueImporterMode, setLabValueImporterMode] = useState<
    "scan" | "import"
  >("import");
  const [importerInitialFile, setImporterInitialFile] = useState<File | null>(
    null
  );
  const importFileInputRef = useRef<HTMLInputElement | null>(null);

  const [editingRootAnalysisId, setEditingRootAnalysisId] = useState<
    number | null
  >(null);
  const [editingNextVersionNumber, setEditingNextVersionNumber] = useState(1);
  const [pendingEditableAnalysis, setPendingEditableAnalysis] =
    useState<EditableAnalysisPayload | null>(null);
  const liveInterpretTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const liveInterpretGenRef = useRef(0);

  const [results, setResults] = useState<InterpretationResult[]>([]);
  const [missingResults, setMissingResults] = useState<MissingResult[]>([]);
  /** Method used for the current Results set (avoids chip/header drift after interpret). */
  const [resultsExtractionMethod, setResultsExtractionMethod] =
    useState<ExtractionMethod | null>(null);
  const [calculatorPacks, setCalculatorPacks] = useState<CalculatorOutputPack[]>([]);
  const [reportExtras, setReportExtras] = useState<{
    planRecommendations: string[];
    fertilizerProducts: PdfFertilizerProduct[];
    fertilizerApplyLines: string[];
  }>({
    planRecommendations: [],
    fertilizerProducts: [],
    fertilizerApplyLines: [],
  });
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [analysisName, setAnalysisName] = useState("");
  const [farmName, setFarmName] = useState("");
  const [openFarmId, setOpenFarmId] = useState<number | null>(null);
  const [historyFocusAnalysisId, setHistoryFocusAnalysisId] = useState<
    number | null
  >(null);
  const [lotName, setLotName] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [locationSource, setLocationSource] = useState<"gps" | "manual" | null>(
    null
  );
  const [locationStatus, setLocationStatus] = useState("");
  const [fertilizerPlanSnapshot, setFertilizerPlanSnapshot] =
    useState<FertilizerPlanSnapshot | null>(null);
  const [notificationTick, setNotificationTick] = useState(0);
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
  const [queueTick, setQueueTick] = useState(0);

  const finalCountry = country === "Other" ? customCountry.trim() : country;

  useEffect(() => {
    migrateLegacyImportMemory();
    purgeExpiredImportCache();
  }, []);

  useEffect(() => {
    currentStepRef.current = currentStep;
  }, [currentStep]);

  useEffect(() => {
    const currentState = window.history.state;
    if (!readHistoryStep(currentState)) {
      window.history.replaceState(
        { ...currentState, cultosolStep: currentStepRef.current },
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
      { ...window.history.state, cultosolStep: currentStep },
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
    const key = `cultosol-welcome-seen-${session.user.id}`;
    if (window.localStorage.getItem(key)) return;
    const frame = window.requestAnimationFrame(() => setShowWelcomeGuide(true));
    return () => window.cancelAnimationFrame(frame);
  }, [session?.user, guestMode]);

  useEffect(() => {
    if (!session?.user || guestMode) {
      setPlanningUserId(null);
      return;
    }
    void hydratePlanningFromCloud(session.user.id).then(() => {
      setNotificationTick((n) => n + 1);
    });
  }, [session?.user?.id, guestMode]);

  function closeWelcomeGuide() {
    if (session?.user) {
      window.localStorage.setItem(`cultosol-welcome-seen-${session.user.id}`, "1");
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

  function buildSaveAnalysisInput(
    userId: string,
    sourceResults: InterpretationResult[] = results
  ) {
    return {
      userId,
      cropId: Number(cropId),
      sampleType,
      results: sourceResults.map((result) => ({
        parameter_id: result.parameter_id,
        custom_parameter_id: result.custom_parameter_id || null,
        unit_id: result.unit_id,
        value: result.value,
        min: result.min,
        max: result.max,
        level_code: result.level_code,
        final_group_code: result.final_group_code,
        confidence: result.confidence,
        is_proxy: result.is_proxy,
        source_name: result.source_name,
        advice: result.advice,
      })),
      farmName,
      lotName,
      labName,
      analysisName,
      samplingDate,
      reportDate,
      country: finalCountry || null,
      provinceState,
      latitude,
      longitude,
      locationSource,
      editingRootAnalysisId,
      editingNextVersionNumber,
    };
  }

  function applySuccessfulSaveState(
    signature: string,
    result: { analysisId: number; versionNumber: number; isVersionSave: boolean }
  ) {
    if (result.isVersionSave) {
      setSaveMessage(formatMessage(t.versionSaved, { version: result.versionNumber }));
    } else {
      setSaveMessage(t.analysisSaved);
    }

    setSavedAnalysisSignature(signature);
    setEditingRootAnalysisId(editingRootAnalysisId || result.analysisId);
    setEditingNextVersionNumber(
      editingRootAnalysisId ? editingNextVersionNumber + 1 : 2
    );
    setPendingEditableAnalysis(null);
  }

  useEffect(() => {
    return subscribeOfflineQueue(() => {
      setQueueTick((current) => current + 1);
    });
  }, []);

  useEffect(() => {
    if (!session?.user || guestMode) return;

    const userId = session.user.id;

    async function syncQueuedAnalyses() {
      if (!navigator.onLine) return;

      const result = await flushOfflineAnalysisQueue(userId);
      if (result.synced === 0) return;

      setQueueTick((current) => current + 1);
      setMessage(formatMessage(t.analysisSyncComplete, { count: result.synced }));

      const signature = buildAnalysisSignature();
      if (result.syncedSignatures.includes(signature)) {
        setSavedAnalysisSignature(signature);
        setSaveMessage(t.analysisSaved);
      }
    }

    void syncQueuedAnalyses();

    const onOnline = () => {
      void syncQueuedAnalyses();
    };

    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [session?.user?.id, guestMode, t.analysisSyncComplete]);

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
      const unitOptions =
        parameter?.available_units.filter((unit) => unit.unit_id === value) || [];
      const unitOption =
        pickPreferredDisplayOption(unitOptions, "mg/kg", value) ||
        unitOptions[0] ||
        parameter?.available_units[0];
      if (unitOption) {
        incomingUnitDisplayKeys[normalizedKey] = getUnitOptionKey(unitOption);
      }
    }

    queueMicrotask(() => {
      setValues(incomingValues);
      setLabReportRanges({});

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
      preferredUnitSymbol = baseUnitSymbol,
      preferredDisplaySymbol = getFriendlyUnitSymbol(preferredUnitSymbol)
    ) {
      type UnitOption = {
        unit_id: number;
        unit_symbol: string;
        display_symbol: string;
        canonical_symbol: string;
      };

      const options: UnitOption[] = [];
      const seen = new Set<string>();
      const seenDisplay = new Set<string>();

      function addOption(option: {
        unit_id: number;
        unit_symbol: string;
        display_symbol: string;
        canonical_symbol?: string;
      }) {
        const normalized: UnitOption = {
          unit_id: option.unit_id,
          unit_symbol: option.unit_symbol,
          display_symbol: option.display_symbol || option.unit_symbol,
          canonical_symbol: option.canonical_symbol ?? option.unit_symbol,
        };
        const key = getUnitOptionKey(normalized);
        const displayKey = normalized.display_symbol.toLowerCase().trim();
        if (seen.has(key) || seenDisplay.has(displayKey)) return;
        seen.add(key);
        seenDisplay.add(displayKey);
        options.push(normalized);
      }

      for (const option of initialOptions) {
        addOption({
          ...option,
          display_symbol: getFriendlyUnitSymbol(
            option.display_symbol || option.unit_symbol
          ),
          canonical_symbol: option.unit_symbol,
        });
      }

      if (preferredUnitId && preferredUnitSymbol) {
        addOption({
          unit_id: preferredUnitId,
          unit_symbol: preferredUnitSymbol,
          display_symbol: preferredDisplaySymbol,
          canonical_symbol: preferredUnitSymbol,
        });
      }

      if (
        canConvertLabUnit(baseUnitSymbol, preferredDisplaySymbol) &&
        normalizeUnitSymbol(preferredDisplaySymbol) !==
          normalizeUnitSymbol(getFriendlyUnitSymbol(baseUnitSymbol))
      ) {
        addOption({
          unit_id: baseUnitId,
          unit_symbol: baseUnitSymbol,
          display_symbol: preferredDisplaySymbol,
          canonical_symbol: baseUnitSymbol,
        });
      }

      for (const candidate of allUnits) {
        if (!canConvertLabUnit(baseUnitSymbol, candidate.unit_symbol)) continue;
        const friendlyDisplay = getFriendlyUnitSymbol(candidate.unit_symbol);
        addOption({
          unit_id: candidate.unit_id,
          unit_symbol: candidate.unit_symbol,
          display_symbol: friendlyDisplay,
          canonical_symbol: candidate.unit_symbol,
        });
        if (candidate.unit_symbol !== friendlyDisplay) {
          addOption({
            unit_id: candidate.unit_id,
            unit_symbol: candidate.unit_symbol,
            display_symbol: candidate.unit_symbol,
            canonical_symbol: candidate.unit_symbol,
          });
        }
      }

      for (const alias of ["ppm"]) {
        if (!canConvertLabUnit(baseUnitSymbol, alias)) continue;
        addOption({
          unit_id: baseUnitId,
          unit_symbol: baseUnitSymbol,
          display_symbol: alias,
          canonical_symbol: baseUnitSymbol,
        });
      }

      const normalizedPreferredDisplay = normalizeUnitSymbol(preferredDisplaySymbol);
      const compactPreferredDisplay = compactUnitSymbol(preferredDisplaySymbol);

      options.sort((left, right) => {
        const leftCompact = compactUnitSymbol(left.display_symbol);
        const rightCompact = compactUnitSymbol(right.display_symbol);
        const leftIsLiteralPreferred = leftCompact === compactPreferredDisplay;
        const rightIsLiteralPreferred = rightCompact === compactPreferredDisplay;
        if (leftIsLiteralPreferred !== rightIsLiteralPreferred) {
          return leftIsLiteralPreferred ? -1 : 1;
        }

        const leftIsPreferredDisplay =
          normalizeUnitSymbol(left.display_symbol) === normalizedPreferredDisplay;
        const rightIsPreferredDisplay =
          normalizeUnitSymbol(right.display_symbol) === normalizedPreferredDisplay;
        if (leftIsPreferredDisplay !== rightIsPreferredDisplay) {
          return leftIsPreferredDisplay ? -1 : 1;
        }
        const leftMassRank = massDisplayRank(left.display_symbol);
        const rightMassRank = massDisplayRank(right.display_symbol);
        if (leftMassRank !== rightMassRank) return leftMassRank - rightMassRank;
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
      const preferredDisplaySymbol = resolvePreferredDisplaySymbol(
        row,
        column,
        databaseUnitSymbol
      );
      const preferredUnit = findUnitBySymbol(allUnits, preferredDisplaySymbol);
      const unitId = preferredUnit?.unit_id ?? databaseUnitId;
      const unitSymbol = preferredUnit?.unit_symbol ?? databaseUnitSymbol;

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
        preferred_display_symbol: preferredDisplaySymbol,
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
          unitSymbol,
          preferredDisplaySymbol
        ),
      };
    });

    const customParameters: Parameter[] = customRows.map((row) => {
      const unitData = Array.isArray(row.units) ? row.units[0] : row.units;

      const databaseUnitId = unitData?.unit_id ?? row.default_unit_id;
      const databaseUnitSymbol = unitData?.unit_symbol ?? "";
      const preferredDisplaySymbol = resolvePreferredDisplaySymbol(
        row,
        column,
        databaseUnitSymbol
      );
      const preferredUnit = findUnitBySymbol(allUnits, preferredDisplaySymbol);
      const unitId = preferredUnit?.unit_id ?? databaseUnitId;
      const unitSymbol = preferredUnit?.unit_symbol ?? databaseUnitSymbol;
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
        preferred_display_symbol: preferredDisplaySymbol,
        is_custom: true,
        available_units: buildExpandedUnitOptions(
          databaseUnitId,
          databaseUnitSymbol,
          unitAliasOptionsMap.get(databaseUnitId) || [
            {
              unit_id: databaseUnitId,
              unit_symbol: databaseUnitSymbol,
              display_symbol: displayUnitSymbol,
            },
          ],
          unitId,
          unitSymbol,
          preferredDisplaySymbol
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
      defaultSelectedUnitDisplayKeys[parameter.parameter_key] =
        getPreferredUnitDisplayKey(parameter, parameter.unit_id) ||
        (parameter.available_units[0]
          ? getUnitOptionKey(parameter.available_units[0])
          : "");
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
    setSaveMessage("");
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
    setSaveMessage("");
  }

  function handleExtractionMethodChange(method: ExtractionMethod) {
    if (method === extractionMethod) return;
    setExtractionMethod(method);
    setSaveMessage("");
  }

  function clearAllValues() {
    setValues({});
    setLabReportRanges({});
    setResults([]);
    setResultsExtractionMethod(null);
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
    setLabReportRanges({});
    setSelectedUnits({});
    setSelectedUnitDisplayKeys({});
    setResults([]);
    setResultsExtractionMethod(null);
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
    importedUnitDisplayKeys: Record<string, string> = {},
    importedReportRanges: Record<
      string,
      { min: number | null; max: number | null; raw: string; rating?: string | null }
    > = {}
  ) {
    applyImportedMetadata(metadata);

    setValues((previous) => ({
      ...previous,
      ...importedValues,
    }));

    setLabReportRanges((previous) => {
      const next = { ...previous };
      for (const key of Object.keys(importedValues)) {
        if (importedReportRanges[key]) {
          next[key] = importedReportRanges[key];
        } else {
          delete next[key];
        }
      }
      return next;
    });

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
    setResultsExtractionMethod(null);
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

  function openImportCamera() {
    labScanReturnStepRef.current = currentStepRef.current;
    setLabValueImporterMode("scan");
    setCurrentStep("lab-scan");
  }

  function closeLabImportFlow() {
    const returnStep =
      currentStepRef.current === "lab-scan"
        ? labScanReturnStepRef.current
        : labImportReturnStepRef.current;
    setImporterInitialCacheId(null);
    setLabValueImporterMode(
      currentStepRef.current === "lab-scan" ? "scan" : "import"
    );
    setCurrentStep((step) =>
      step === "lab-scan" || step === "lab-import" ? returnStep : step
    );
  }

  function resumeImportFromCache(cacheId: string) {
    labImportReturnStepRef.current = currentStepRef.current;
    setImporterInitialCacheId(cacheId);
    setLabValueImporterMode("import");
    setCurrentStep("lab-import");
  }

  function openImportFilePage() {
    labImportReturnStepRef.current = currentStepRef.current;
    setLabValueImporterMode("import");
    setCurrentStep("lab-import");
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
    setLabReportRanges({});
    setSelectedUnits({});
    setSelectedUnitDisplayKeys({});
    setSelectedCategory("All");
    setShowAllParameters(true);
    setParameterSearch("");
    setSortMode("type");
    setResults([]);
    setResultsExtractionMethod(null);
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
    setExtractionMethod("olsen");
    setCalculatorPacks([]);
    setReportExtras({
      planRecommendations: [],
      fertilizerProducts: [],
      fertilizerApplyLines: [],
    });
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
    setResultsExtractionMethod(null);
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

  async function interpretAnalysis(options?: {
    method?: ExtractionMethod;
    preserveResults?: boolean;
    stayOnPage?: boolean;
    silent?: boolean;
  }): Promise<InterpretationResult[] | null> {
    const activeMethod = options?.method ?? extractionMethod;
    const silent = Boolean(options?.silent);
    const stayOnPage = Boolean(options?.stayOnPage);
    const requestGen = ++liveInterpretGenRef.current;

    if (!silent) {
      setMessage("");
      setSaveMessage("");
    }
    if (!options?.preserveResults && !silent) {
      setResults([]);
      setResultsExtractionMethod(null);
      setMissingResults([]);
    }

    if (!cropId) {
      if (!silent) {
        setMessage(t.selectCropOnValues || t.selectCropMessage);
      }
      return null;
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
      if (silent) {
        if (requestGen === liveInterpretGenRef.current) {
          setResults([]);
          setResultsExtractionMethod(null);
          setMissingResults([]);
        }
        return [];
      }
      setMessage(t.enterOneValueMessage);
      return null;
    }

    if (!silent) {
      setLoading(true);
    }

    const interpretedResults: InterpretationResult[] = [];
    const notFoundResults: MissingResult[] = [];
    const rpcQueue: typeof filledValues = [];

    try {
    for (const item of filledValues) {
        const labRange = labReportRanges[item.parameter_key];
        if (
          labRange &&
          (labRange.min !== null || labRange.max !== null)
        ) {
          const logicInput = {
            parameter_id: item.parameter_id || 0,
            parameter_name: item.parameter_name,
            value: item.value,
            min: labRange.min,
            max: labRange.max,
          };

          interpretedResults.push({
            parameter_key: item.parameter_key,
            crop_id: interpretationCropId,
            crop_name: null,
            sample_type: sampleType,
            parameter_id: item.parameter_id,
            custom_parameter_id: item.custom_parameter_id,
            parameter_name: item.parameter_name,
            unit_id: item.unit_id,
            unit_symbol: item.unit_symbol,
            min: labRange.min,
            max: labRange.max,
            confidence: "exact",
            is_proxy: false,
            source_name: t.labReportRangeSource || "Lab report",
            interpretation_note: labRange.rating?.trim() || null,
            value: item.value,
            level_code: getLevelCode(logicInput),
            final_group_code: getFinalGroupCode(logicInput),
            advice: getSimpleAdvice(logicInput),
            display_parameter_name: item.display_name,
          });

          continue;
        }

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
            parameter_key: item.parameter_key,
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
        const parameterLike = {
          parameter_id: item.parameter_id,
          parameter_name: item.parameter_name,
          display_name: item.display_name,
          parameter_key: item.parameter_key,
          symbol:
            parameters.find(
              (parameter) => parameter.parameter_key === item.parameter_key
            )?.symbol ?? null,
        };
        const resolved = resolveInterpretationParameter(
          parameterLike,
          parameterCatalog,
          activeMethod
        );

        const { data, error } = await supabase.rpc("get_range_match", {
          input_crop_id: interpretationCropId,
          input_sample_type: sampleType,
          input_parameter_id: resolved.parameter_id,
        });

        return { item, data, error, resolved, parameterLike };
      })
    );

    for (const outcome of rpcOutcomes) {
      const { item, data, error, parameterLike } = outcome;

      if (error) {
        throw error;
      }

      // Olsen / Mehlich: use Tabla N.° 1 when the nutrient exists for that
      // extractant and the band can be expressed in the user's unit.
      // Otherwise keep crop / general sufficiency from the database.
      const table1Raw =
        sampleType === "soil"
          ? table1SufficientRange(activeMethod, parameterLike)
          : null;
      const table1Converted = table1Raw
        ? convertTable1RangeToDisplayUnit(table1Raw, item.unit_symbol)
        : null;

      if ((!data || data.length === 0) && !table1Converted) {
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

      const range = (data?.[0] as RangeMatch | undefined) || null;
      const convertedRange = range
        ? convertRangeToUnit(
            range.min,
            range.max,
            range.unit_symbol,
            item.unit_symbol
          )
        : null;

      let rangeMin = convertedRange?.min ?? null;
      let rangeMax = convertedRange?.max ?? null;
      let rangeUnitSymbol = convertedRange?.converted
        ? item.unit_symbol
        : range?.unit_symbol || item.unit_symbol;
      let sourceName = range?.source_name ?? null;
      let isProxy = Boolean(range?.is_proxy);
      let confidence = range?.confidence ?? "medium";

      if (table1Converted && table1Raw) {
        rangeMin = table1Converted.min;
        rangeMax = table1Converted.max;
        rangeUnitSymbol = table1Converted.unit;
        sourceName = table1Raw.sourceName;
        isProxy = Boolean(range);
        confidence = "exact";
      }

      const logicInput = {
        parameter_id: item.parameter_id || 0,
        parameter_name: item.parameter_name,
        value: item.value,
        min: rangeMin,
        max: rangeMax,
      };

      interpretedResults.push({
        parameter_key: item.parameter_key,
        crop_id: range?.crop_id ?? interpretationCropId,
        crop_name: range?.crop_name ?? null,
        sample_type: range?.sample_type ?? sampleType,
        parameter_id: range?.parameter_id ?? item.parameter_id,
        custom_parameter_id: null,
        parameter_name: range?.parameter_name ?? item.parameter_name,
        unit_id: range?.unit_id ?? item.unit_id,
        unit_symbol: rangeUnitSymbol,
        min: rangeMin,
        max: rangeMax,
        confidence,
        is_proxy: isProxy,
        source_name: sourceName,
        interpretation_note: range?.interpretation_note ?? null,
        value: item.value,
        level_code: getLevelCode(logicInput),
        final_group_code: getFinalGroupCode(logicInput),
        advice: getSimpleAdvice(logicInput),
        display_parameter_name: item.display_name,
      });
    }

    if (requestGen !== liveInterpretGenRef.current) {
      return interpretedResults;
    }

    setResults(interpretedResults);
    setResultsExtractionMethod(activeMethod);
    setMissingResults(notFoundResults);
    if (!silent) {
      setSaveMessage("");
    }
    if (!stayOnPage) {
      setCurrentStep("results");
    }

    if (
      !silent &&
      interpretedResults.length === 0 &&
      notFoundResults.length > 0
    ) {
      setMessage(t.noRangeFoundDesc);
    }

    if (
      !silent &&
      !stayOnPage &&
      appSettings.data.autoSaveAnalyses &&
      session?.user &&
      !guestMode &&
      cropId &&
      interpretedResults.length > 0
    ) {
      void saveAnalysis(interpretedResults, { automatic: true });
    }

    return interpretedResults;
    } catch (error) {
      console.error("interpretAnalysis:", error);
      if (!silent) {
        setMessage(formatRequestError(error));
      }
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }

  async function saveFromValuesPage() {
    setSaveMessage("");
    const interpreted = await interpretAnalysis({ stayOnPage: true });
    if (!interpreted || interpreted.length === 0) {
      return;
    }
    await saveAnalysis(interpreted);
  }

  const interpretAnalysisRef = useRef(interpretAnalysis);
  interpretAnalysisRef.current = interpretAnalysis;

  useEffect(() => {
    if (currentStep !== "values") return;
    if (pendingEditableAnalysis) return;

    if (liveInterpretTimerRef.current) {
      clearTimeout(liveInterpretTimerRef.current);
    }

    liveInterpretTimerRef.current = setTimeout(() => {
      void interpretAnalysisRef.current({ stayOnPage: true, silent: true });
    }, 400);

    return () => {
      if (liveInterpretTimerRef.current) {
        clearTimeout(liveInterpretTimerRef.current);
      }
    };
  }, [
    currentStep,
    pendingEditableAnalysis,
    values,
    labReportRanges,
    selectedUnits,
    selectedUnitDisplayKeys,
    extractionMethod,
    cropId,
    sampleType,
    parameters,
  ]);

  function changeExtractionMethodFromResults(method: ExtractionMethod) {
    if (loading || method === extractionMethod) return;
    setExtractionMethod(method);
    void interpretAnalysis({ method, preserveResults: true, stayOnPage: false });
  }

  async function saveAnalysis(
    sourceResults?: InterpretationResult[],
    options?: { automatic?: boolean }
  ) {
    const activeResults = sourceResults ?? results;
    const automatic = options?.automatic ?? false;

    if (!automatic) {
      setSaveMessage("");
    }

    if (!session?.user || guestMode) {
      if (!automatic) {
        setSaveMessage(t.loginToSave);
      }
      return;
    }

    if (!cropId) {
      if (!automatic) {
        setSaveMessage(t.selectCropMessage);
      }
      return;
    }

    if (activeResults.length === 0) {
      if (!automatic) {
        setSaveMessage(t.interpretBeforeSaving);
      }
      return;
    }

    const signature = buildAnalysisSignature(activeResults);
    const userId = session.user.id;

    if (savedAnalysisSignature === signature) {
      if (!automatic) {
        setSaveMessage(t.analysisAlreadySaved);
      }
      return;
    }

    if (isSignatureQueued(userId, signature)) {
      if (!automatic) {
        setSaveMessage(t.analysisAlreadyQueued);
      }
      return;
    }

    const saveInput = buildSaveAnalysisInput(userId, activeResults);

    if (!navigator.onLine) {
      enqueueAnalysisSave({
        userId,
        signature,
        payload: saveInput,
      });
      setQueueTick((current) => current + 1);
      setSaveMessage(t.analysisQueuedOffline);
      return;
    }

    setSaving(true);

    try {
      const result = await saveAnalysisToSupabase(saveInput);
      applySuccessfulSaveState(signature, result);
    } catch (error) {
      if (shouldQueueAnalysisSave(error)) {
        enqueueAnalysisSave({
          userId,
          signature,
          payload: saveInput,
        });
        setQueueTick((current) => current + 1);
        setSaveMessage(t.analysisQueuedOffline);
      } else {
        setSaveMessage(
          error instanceof Error ? error.message : formatRequestError(error)
        );
      }
    } finally {
      setSaving(false);
    }
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
  const isCurrentAnalysisQueued = Boolean(
    session?.user &&
      isSignatureQueued(session.user.id, currentAnalysisSignature)
  );
  const isCurrentAnalysisSaved =
    results.length > 0 &&
    savedAnalysisSignature !== null &&
    savedAnalysisSignature === currentAnalysisSignature;
  const needsAnalysisUpdate =
    savedAnalysisSignature !== null &&
    !isCurrentAnalysisSaved &&
    !isCurrentAnalysisQueued;
  const pendingOfflineSaves = useMemo(
    () => (session?.user ? getOfflineQueueCount(session.user.id) : 0),
    [session?.user?.id, queueTick]
  );

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
      const ranked = list
        .map((parameter) => ({
          parameter,
          rank: getParameterSearchRank(parameter, search),
        }))
        .filter((entry) => entry.rank !== null) as Array<{
        parameter: Parameter;
        rank: number;
      }>;

      ranked.sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (sortMode === "type") {
          const typeCompare =
            getParameterSortRank(a.parameter) - getParameterSortRank(b.parameter);
          if (typeCompare !== 0) return typeCompare;
        }
        return a.parameter.display_name.localeCompare(b.parameter.display_name);
      });

      return ranked.map((entry) => entry.parameter);
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
  const showFoliarExtractionPicker = sampleType === "foliar";
  const interpretationCropId = cropId || 999;

  // Keep a valid extraction method when switching soil ↔ foliar.
  useEffect(() => {
    setExtractionMethod((previous) => {
      if (previous === "bray") {
        return getDefaultExtractionMethod({
          isGeneralCrop,
          sampleType,
        });
      }
      return previous;
    });
  }, [sampleType, isGeneralCrop]);
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

  const pdfReportMeta = useMemo<PdfReportMeta>(() => {
    const place = [provinceState.trim(), finalCountry].filter(Boolean).join(", ");
    const dateValue = reportDate.trim() || samplingDate.trim();
    const methodForReport = resultsExtractionMethod ?? extractionMethod;
    const methodLabel = extractionMethodLabel(methodForReport, t);
    const usesMethodBands =
      methodForReport === "olsen" || methodForReport === "mehlich";
    const extractionNote = usesMethodBands
      ? sampleType === "soil"
        ? formatMessage(
            isGeneralCrop
              ? t.exportGeneralCropExtractionNote ||
                  "General crop with {method}: nutrient ranges follow the {method} extractant (not crop-specific sufficiency)."
              : t.exportExtractionMethodNote ||
                  "Nutrient ranges follow the {method} extractant (not crop-specific sufficiency).",
            { method: methodLabel }
          )
        : formatMessage(
            t.exportFoliarExtractionNote ||
              "Foliar analysis with {method}: phosphorus interpretation prefers {method}-linked ranges when available.",
            { method: methodLabel }
          )
      : undefined;
    return {
      title:
        analysisName.trim() ||
        `${sampleType === "soil" ? t.soil : t.foliar} ${t.analysisSummary}`,
      analysisName: analysisName.trim() || undefined,
      generatedBy: displayName || undefined,
      farm: farmName.trim() || undefined,
      lots: lotName.trim() || undefined,
      lab: labName.trim() || undefined,
      date: dateValue || undefined,
      place: place || undefined,
      crop: selectedCrop?.display_name || undefined,
      sampleType: sampleType === "soil" ? t.soil : t.foliar,
      extractionMethod: methodLabel,
      extractionNote,
      details: [
        selectedCrop ? `${t.crop}: ${selectedCrop.display_name}` : "",
        `${t.sampleType}: ${sampleType === "soil" ? t.soil : t.foliar}`,
        `${t.extractionMethodLabel}: ${methodLabel}`,
        farmName.trim() ? `${t.farmName}: ${farmName.trim()}` : "",
        lotName.trim() ? `${t.lotName}: ${lotName.trim()}` : "",
        labName.trim() ? `${t.labName}: ${labName.trim()}` : "",
        place ? `${t.location}: ${place}` : "",
      ].filter(Boolean),
    };
  }, [
    analysisName,
    displayName,
    extractionMethod,
    farmName,
    finalCountry,
    isGeneralCrop,
    labName,
    lotName,
    provinceState,
    reportDate,
    resultsExtractionMethod,
    sampleType,
    samplingDate,
    selectedCrop,
    t,
  ]);

  const pdfExportChecklist = useMemo(
    () =>
      buildPdfExportChecklist({
        meta: pdfReportMeta,
        hasResults: results.length > 0,
        calculatorPacks,
        t,
      }),
    [calculatorPacks, pdfReportMeta, results.length, t]
  );

  async function handleExportSummaryPdf(sections: PdfReportSectionOptions) {
    setExportingPdf(true);
    try {
      const locales = {
        en: "en-US",
        fr: "fr-FR",
        es: "es-ES",
        ht: "ht-HT",
        pt: "pt-BR",
        sw: "sw-TZ",
      } as const;
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
        calculatorPacks,
        fertilizerProducts: sections.includeFertilizerPlan
          ? reportExtras.fertilizerProducts
          : [],
        recommendations: sections.includeRecommendations
          ? buildExportRecommendations({
              planRecommendations: reportExtras.planRecommendations,
              results: translatedResults,
              fertilizerProducts: sections.includeFertilizerPlan
                ? reportExtras.fertilizerProducts
                : [],
              fertilizerApplyLines: reportExtras.fertilizerApplyLines,
              includeInterpretationAdvice: false,
              amendmentLabels: calculatorHubText[language] || calculatorHubText.en,
            })
          : [],
        calendarEvents: sections.includeCalendar
          ? loadPlanningState().events
              .filter((event) => {
                const farm = farmName.trim().toLocaleLowerCase();
                if (!farm) return false;
                return (
                  (event.farmName || "").trim().toLocaleLowerCase() === farm
                );
              })
              .sort((a, b) => {
                const byDate = a.date.localeCompare(b.date);
                if (byDate !== 0) return byDate;
                return (a.sequence || 0) - (b.sequence || 0);
              })
          : [],
        labels: calculatorHubText[language] || calculatorHubText.en,
        isGeneralCrop,
        locale: locales[language] || "en-US",
        reportMeta: pdfReportMeta,
        reportOptions: getSettings().reports,
        sections,
      });
      setExportModalOpen(false);
    } catch (error) {
      console.error("PDF export error:", error);
      alert(t.pdfExportFailed);
    } finally {
      setExportingPdf(false);
    }
  }

  const showExportPdfIcon =
    currentStep === "setup" ||
    currentStep === "values" ||
    currentStep === "results" ||
    currentStep === "calculators";

  const isBusy = loading || saving;

  useEffect(() => {
    if (!finalCountry && !provinceState.trim()) {
      pushNotification({
        title: t.planningCalendar,
        body: t.useMyLocationHint,
        kind: "location",
        hrefStep: "setup",
        relatedId: "complete-location",
      });
      setNotificationTick((n) => n + 1);
    }
  }, [finalCountry, provinceState, t.planningCalendar, t.useMyLocationHint]);

  useEffect(() => {
    if (!fertilizerPlanSnapshot?.doses.some((d) => !d.notRequired && (d.dosisOxideKgHa || 0) > 0)) {
      return;
    }
    pushNotification({
      title: t.calculators,
      body: t.planning.recommendHint,
      kind: "cost",
      hrefStep: "calculators",
      relatedId: "fertilizer-plan-ready",
    });
    setNotificationTick((n) => n + 1);
  }, [fertilizerPlanSnapshot, t.calculators, t.planning.recommendHint]);

  const jackoContext = useMemo((): JackoAppContext => {
    const planning = loadPlanningState();
    const today = new Date().toISOString().slice(0, 10);
    const upcomingEvents = [...planning.events]
      .filter((event) => !event.date || event.date >= today)
      .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
      .slice(0, 8)
      .map((event) => ({
        title: event.title,
        date: event.date || undefined,
        farmName: event.farmName || undefined,
      }));

    const enteredValues = parameters
      .map((parameter) => {
        const raw = values[parameter.parameter_key];
        if (!raw?.trim()) return null;
        const selectedUnitId =
          selectedUnits[parameter.parameter_key] || parameter.unit_id;
        const unit =
          parameter.available_units.find((item) => item.unit_id === selectedUnitId)
            ?.display_symbol ||
          parameter.preferred_display_symbol ||
          parameter.unit_symbol ||
          undefined;
        return {
          key: parameter.parameter_key,
          name: parameter.display_name || parameter.parameter_name,
          value: raw.trim(),
          unit,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .slice(0, 40);

    const interpretations = results.slice(0, 40).map((result) => ({
      key: result.parameter_key || result.display_parameter_name,
      name: result.display_parameter_name,
      value: result.value,
      unit: result.unit_symbol || undefined,
      level: result.level_code,
      group: result.final_group_code,
      advice: result.advice || undefined,
    }));

    const fertilizerDoses =
      fertilizerPlanSnapshot?.doses.map((dose) => ({
        nutrient: dose.nutrient,
        oxide: dose.nutrientOxide,
        doseKgHa: dose.dosisOxideKgHa ?? dose.dosisKgHa,
        notRequired: dose.notRequired,
        viaEncalado: dose.viaEncalado,
      })) || undefined;

    const methodForContext = resultsExtractionMethod ?? extractionMethod;

    return {
      screen: currentStep,
      sampleType,
      crop: selectedCrop?.display_name || undefined,
      farmName: farmName.trim() || undefined,
      lotName: lotName.trim() || undefined,
      analysisName: analysisName.trim() || undefined,
      country: finalCountry || undefined,
      province: provinceState.trim() || undefined,
      extractionMethod: extractionMethodLabel(methodForContext, t),
      enteredValues,
      interpretations,
      missingParameters: missingResults
        .slice(0, 12)
        .map((item) => item.display_name || item.parameter_name),
      fertilizerDoses,
      fertilizerAreaHa: fertilizerPlanSnapshot?.areaHa,
      planRecommendations: [
        ...(fertilizerPlanSnapshot?.recommendations || []),
        ...(reportExtras.planRecommendations || []),
      ].slice(0, 10),
      upcomingEvents,
      noteCount: planning.notes.length,
    };
  }, [
    analysisName,
    currentStep,
    extractionMethod,
    farmName,
    fertilizerPlanSnapshot,
    finalCountry,
    lotName,
    missingResults,
    parameters,
    provinceState,
    reportExtras.planRecommendations,
    results,
    resultsExtractionMethod,
    sampleType,
    selectedCrop?.display_name,
    selectedUnits,
    t,
    values,
    notificationTick,
  ]);

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
    onOpenSettings: () => {
      if (currentStep === "settings") {
        setCurrentStep(stepBeforeSettingsRef.current);
        return;
      }
      stepBeforeSettingsRef.current = currentStep;
      setSettingsInitialSection(undefined);
      setCurrentStep("settings");
    },
    onOpenAccountSettings: () => {
      if (currentStep !== "settings") {
        stepBeforeSettingsRef.current = currentStep;
      }
      setSettingsInitialSection("account");
      setCurrentStep("settings");
    },
    settingsActive: currentStep === "settings",
    onOpenBilling: () => {
      billingReturnStepRef.current = currentStepRef.current;
      setCurrentStep("billing");
    },
    onOpenRecycleBin: () => setCurrentStep("recycle"),
    onOpenAbout: () => setCurrentStep("about"),
    onOpenFarms: () => setCurrentStep("farms"),
    onOpenCalendar: () => setCurrentStep("calendar"),
    onOpenNotes: () => setCurrentStep("notes"),
    onOpenNotifications: () => setCurrentStep("notifications"),
    notificationCount: (() => {
      void notificationTick;
      return unreadNotificationCount();
    })(),
    theme,
    isAdmin,
    planTier: appSettings.billing.planTier,
    jackoContext,
    onToggleTheme: () =>
      setTheme((currentTheme) => {
        if (currentTheme === "light") {
          updateSetting("general", "theme", "dark");
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
      <main className="app-main-gradient auth-page flex flex-col">
        <div className="app-main-backdrop" aria-hidden="true" />
        <header className="auth-top-bar">
          <LanguageSwitcher
            language={language}
            onChange={changeLanguage}
            compact
          />
        </header>
        <div className="auth-page__content relative flex flex-1 items-center justify-center px-3 py-4 sm:px-4 sm:py-8">
          <LoadingOverlay
            open={isBusy}
            label={loading ? t.interpreting : t.saving}
          />
          <section className="app-content-shell auth-page__shell w-full animate-slide-up">
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
      {currentStep !== "about" &&
      currentStep !== "lab-scan" &&
      currentStep !== "lab-import" ? (
        <AppHeader {...headerProps} />
      ) : null}
      <WelcomeGuide open={showWelcomeGuide && Boolean(session?.user) && !guestMode} t={t} onClose={closeWelcomeGuide} />
      <main
        className={`app-main-gradient app-main-shell text-slate-900 ${
          currentStep === "home"
            ? "app-main-shell--home"
            : currentStep === "about"
              ? "app-main-shell--about"
              : currentStep === "lab-scan" || currentStep === "lab-import"
                ? "app-main-shell--default app-main-shell--no-dock app-main-shell--lab-scan"
                : currentStep === "billing" ||
                    currentStep === "billing-admin" ||
                    currentStep === "verification" ||
                    currentStep === "settings"
                  ? "app-main-shell--default app-main-shell--no-dock"
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
              : currentStep === "settings"
                ? "app-visual-tone app-content-shell app-content-shell--settings w-full px-0"
                : currentStep === "lab-scan" || currentStep === "lab-import"
                  ? "app-visual-tone app-content-shell app-content-shell--lab-scan w-full px-0"
                  : currentStep === "billing" ||
                    currentStep === "billing-admin" ||
                    currentStep === "verification"
                  ? "app-visual-tone app-content-shell app-content-shell--billing w-full px-0"
                  : "app-visual-tone app-content-shell w-full px-0"
          }
        >
        {currentStep === "lab-scan" || currentStep === "lab-import" ? (
          <LabValueImporter
            open
            mode={labValueImporterMode}
            presentation="page"
            autoRestoreToken={importerAutoRestoreToken}
            initialCacheId={importerInitialCacheId}
            initialFile={importerInitialFile}
            onInitialFileHandled={() => setImporterInitialFile(null)}
            onClose={closeLabImportFlow}
            onEnterImportReview={() => setLabValueImporterMode("import")}
            language={language}
            parameters={parameters}
            existingValues={values}
            onRequestCreateParameter={requestCreateCustomParameterFromImport}
            onImportValues={importLabValues}
            onDetectedSampleType={(detected) => setSampleType(detected)}
          />
        ) : currentStep === "home" ? (
          <section className="home-screen-wrap">
            <HomeScreen
              t={t}
              session={session}
              guestMode={guestMode}
              displayName={displayName}
              isReturningUser={Boolean(session?.user && !guestMode)}
              startNewAnalysis={resetAnalysis}
              onImportCamera={openImportCamera}
              onImportFile={openImportFilePage}
              goResults={() => setCurrentStep("history")}
              goCalculators={() => setCurrentStep("calculators")}
              goFarms={() => {
                setOpenFarmId(null);
                setCurrentStep("farms");
              }}
              openFarm={(name, farmId) => {
                setFarmName(name);
                setOpenFarmId(farmId ?? null);
                setCurrentStep("farms");
              }}
              hasResultsOrProgress={hasHistoryOrProgress}
            />
          </section>
        ) : currentStep === "setup" ? (
          <SetupScreen
            t={t}
            userId={session?.user.id}
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
            customCountry={customCountry}
            setCustomCountry={setCustomCountry}
            provinceState={provinceState}
            setProvinceState={(value) => {
              setProvinceState(value);
              if (locationSource === "gps") {
                setLocationSource("manual");
                setLatitude(null);
                setLongitude(null);
              }
            }}
            setCountry={(value) => {
              setCountry(value);
              if (locationSource === "gps") {
                setLocationSource("manual");
                setLatitude(null);
                setLongitude(null);
              }
            }}
            locationStatus={locationStatus}
            onDetectLocation={async () => {
              setLocationStatus(t.locationDetecting);
              try {
                const result = await detectLocation();
                setLatitude(result.latitude);
                setLongitude(result.longitude);
                setLocationSource("gps");
                if (result.country) {
                  const match = countries.find(
                    (item) =>
                      item.toLocaleLowerCase() ===
                      result.country!.toLocaleLowerCase()
                  );
                  if (match) setCountry(match);
                  else {
                    setCountry("Other");
                    setCustomCountry(result.country);
                  }
                }
                if (result.province) setProvinceState(result.province);
                setLocationStatus(t.locationFilled);
                setNotificationTick((n) => n + 1);
              } catch (error) {
                const code =
                  error && typeof error === "object" && "code" in error
                    ? String((error as { code?: string }).code)
                    : "";
                setLocationStatus(
                  code === "denied" ? t.locationDenied : t.locationFailed
                );
              }
            }}
            samplingDate={samplingDate}
            setSamplingDate={setSamplingDate}
            goHome={() => setCurrentStep("home")}
            goToValues={goToValues}
            onExportPdf={() => setExportModalOpen(true)}
            exportingPdf={exportingPdf}
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
            setExtractionMethod={handleExtractionMethodChange}
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
            onShowParameterSymbolsOnlyChange={(value) => {
              updateSetting("data", "showParameterSymbolsOnly", value);
              setAppSettings(getSettings());
            }}
            updateValue={updateValue}
            updateUnit={updateUnit}
            clearAllValues={clearAllValues}
            message={message}
            saveMessage={saveMessage}
            pendingEditableAnalysis={pendingEditableAnalysis}
            loading={loading}
            saving={saving}
            cropId={cropId}
            setCropId={setCropId}
            crops={crops}
            analysisName={analysisName}
            farmName={farmName}
            lotName={lotName}
            saveAnalysis={saveFromValuesPage}
            backToSetup={() => setCurrentStep("setup")}
            openImporter={openImportFilePage}
            openCustomParameterModal={() => {
              setCustomParameterDraft(null);
              setShowCustomParameterModal(true);
            }}
            openCustomParameterManager={() =>
              setShowCustomParameterManager(true)
            }
            openCustomRangeManager={() => setShowCustomRangeManager(true)}
            results={results}
            missingResults={missingResults}
            isSaved={isCurrentAnalysisSaved}
            isQueued={isCurrentAnalysisQueued}
            needsUpdate={needsAnalysisUpdate}
            onExportPdf={() => setExportModalOpen(true)}
            exportingPdf={exportingPdf}
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
                language={language}
                t={t}
                saving={saving}
                saveMessage={saveMessage}
                saveAnalysis={saveAnalysis}
                isSaved={isCurrentAnalysisSaved}
                isQueued={isCurrentAnalysisQueued}
                needsUpdate={needsAnalysisUpdate}
                pendingOfflineSaves={pendingOfflineSaves}
                isGeneralCrop={isGeneralCrop}
                sampleType={sampleType}
                showFoliarExtractionPicker={showFoliarExtractionPicker}
                extractionMethod={extractionMethod}
                interpreting={loading}
                onExtractionMethodChange={changeExtractionMethodFromResults}
                showHorizontalGraphs={appSettings.reports.includeHorizontalResultGraph}
                backToValues={() => setCurrentStep("values")}
                onExportPdf={() => setExportModalOpen(true)}
                exportingPdf={exportingPdf}
              />
            )}
          </section>
        ) : currentStep === "history" ? (
          <ResultsDashboard
            session={session}
            guestMode={guestMode}
            language={language}
            t={t}
            generatedBy={displayName}
            enteredValuesCount={totalEnteredValues}
            interpretedResultsCount={results.length}
            hasCurrentResults={results.length > 0}
            goToValues={() => setCurrentStep("values")}
            goToCurrentResults={() => setCurrentStep("results")}
            onEditAnalysis={loadEditableAnalysis}
            onResumeImport={resumeImportFromCache}
            focusAnalysisId={historyFocusAnalysisId}
            onFocusAnalysisConsumed={() => setHistoryFocusAnalysisId(null)}
          />
        ) : currentStep === "calculators" ? (
          <CalculatorHub
            language={language}
            parameters={parameters}
            values={values}
            results={results}
            sampleType={sampleType}
            selectedCropName={selectedCrop?.crop_name || selectedCrop?.display_name || null}
            selectedCountry={finalCountry || null}
            showCalculatorFormulas={effectiveShowCalculatorFormulas(appSettings)}
            userId={session?.user && !guestMode ? session.user.id : null}
            farmName={farmName}
            parameterUnits={Object.fromEntries(
              parameters.map((parameter) => {
                const { selectedUnit } = resolveParameterUnitState(
                  parameter,
                  selectedUnits,
                  selectedUnitDisplayKeys
                );
                return [
                  parameter.parameter_key,
                  selectedUnit?.canonical_symbol ||
                    selectedUnit?.unit_symbol ||
                    parameter.unit_symbol,
                ];
              })
            )}
            goToValues={() => setCurrentStep("values")}
            onOpenCalendar={() => setCurrentStep("calendar")}
            onBack={() => setCurrentStep("home")}
            onOutputsChange={(packs) =>
              setCalculatorPacks((previous) =>
                mergeCalculatorOutputPacks(previous, packs)
              )
            }
            onReportExtrasChange={setReportExtras}
            onFertilizerPlanChange={setFertilizerPlanSnapshot}
            onExportPdf={() => setExportModalOpen(true)}
            exportingPdf={exportingPdf}
            exportPdfLabel={t.exportPdf}
          />
        ) : currentStep === "farms" ? (
          <FarmsScreen
            t={t}
            userId={session?.user && !guestMode ? session.user.id : null}
            selectedFarmName={farmName}
            initialFarmId={openFarmId}
            onBack={() => {
              setOpenFarmId(null);
              setCurrentStep("home");
            }}
            onOpenCalendar={(name, lot) => {
              setFarmName(name);
              if (lot) setLotName(lot);
              setCurrentStep("calendar");
            }}
            onOpenNotes={(name) => {
              setFarmName(name);
              setCurrentStep("notes");
            }}
            onOpenHistory={(name) => {
              if (name) setFarmName(name);
              setHistoryFocusAnalysisId(null);
              setCurrentStep("history");
            }}
            onOpenAnalysis={(analysisId, name) => {
              if (name) setFarmName(name);
              setHistoryFocusAnalysisId(analysisId);
              setCurrentStep("history");
            }}
            onEditAnalysis={loadEditableAnalysis}
            onOpenSetup={(name, lot) => {
              setFarmName(name);
              if (lot) setLotName(lot);
              setCurrentStep("setup");
            }}
          />
        ) : currentStep === "calendar" ? (
          <CalendarScreen
            t={t}
            language={language}
            onBack={() => setCurrentStep("home")}
            onOpenSetup={() => setCurrentStep("setup")}
            onOpenCalculators={() => setCurrentStep("calculators")}
            cropName={selectedCrop?.crop_name || selectedCrop?.display_name}
            farmName={farmName}
            lotName={lotName}
            onFarmNameChange={setFarmName}
            onLotNameChange={setLotName}
            planDoses={fertilizerPlanSnapshot?.doses}
            responsibleName={displayName}
          />
        ) : currentStep === "notes" ? (
          <NotesScreen
            t={t}
            onBack={() => setCurrentStep("home")}
            farmName={farmName}
            lotName={lotName}
          />
        ) : currentStep === "notifications" ? (
          <NotificationsScreen
            t={t}
            onBack={() => setCurrentStep("home")}
            onNavigate={(step) => {
              setNotificationTick((n) => n + 1);
              setCurrentStep(step);
            }}
          />
        ) : currentStep === "settings" ? (
          <AppSettingsScreen
            language={language}
            initialSection={settingsInitialSection}
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
            onOpenBilling={() => {
              billingReturnStepRef.current = "settings";
              setCurrentStep("billing");
            }}
            onOpenVerification={() => setCurrentStep("verification")}
          />
        ) : currentStep === "billing" ? (
          <BillingScreen
            language={language}
            session={session}
            guestMode={guestMode}
            isAdmin={isAdmin}
            onBack={() => setCurrentStep(billingReturnStepRef.current)}
            onOpenVerification={() => setCurrentStep("verification")}
            onOpenAdmin={
              isAdmin ? () => setCurrentStep("billing-admin") : undefined
            }
          />
        ) : currentStep === "billing-admin" && isAdmin ? (
          <BillingAdminScreen
            language={language}
            adminEmail={session?.user?.email || ""}
            onBack={() => setCurrentStep("billing")}
          />
        ) : currentStep === "verification" ? (
          <VerificationScreen
            language={language}
            session={session}
            guestMode={guestMode}
            displayName={displayName}
            email={session?.user?.email || ""}
            country={finalCountry}
            onBack={() => setCurrentStep("settings")}
          />
        ) : currentStep === "about" ? (
          <AboutScreen
            t={t}
            language={language}
            session={session}
            country={finalCountry}
            isAdmin={isAdmin}
            onOpenAdmin={
              isAdmin ? () => setCurrentStep("billing-admin") : undefined
            }
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
      currentStep !== "billing" &&
      currentStep !== "billing-admin" &&
      currentStep !== "verification" &&
      currentStep !== "lab-scan" &&
      currentStep !== "lab-import" &&
      currentStep !== "recycle" &&
      currentStep !== "about" &&
      currentStep !== "import" &&
      currentStep !== "calendar" &&
      currentStep !== "notes" &&
      currentStep !== "notifications" ? (
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

      <input
        ref={importFileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls,.txt,.pdf,image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          labImportReturnStepRef.current = currentStepRef.current;
          setImporterInitialFile(file);
          setLabValueImporterMode("import");
          setCurrentStep("lab-import");
        }}
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
            if (
              currentStepRef.current !== "lab-scan" &&
              currentStepRef.current !== "lab-import"
            ) {
              setCurrentStep("lab-import");
            }
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

      {showExportPdfIcon ? (
        <ExportReportModal
          open={exportModalOpen}
          onClose={() => {
            if (!exportingPdf) setExportModalOpen(false);
          }}
          onConfirm={(sections) => void handleExportSummaryPdf(sections)}
          t={t}
          isFoliar={sampleType === "foliar"}
          exporting={exportingPdf}
          checklist={pdfExportChecklist}
          calculatorPacks={calculatorPacks.filter(
            (pack) => pack.id !== "fertilizerCost"
          )}
          hasFertilizerProducts={reportExtras.fertilizerProducts.length > 0}
          hasCalendar={
            Boolean(farmName.trim()) &&
            loadPlanningState().events.some(
              (event) =>
                (event.farmName || "").trim().toLocaleLowerCase() ===
                farmName.trim().toLocaleLowerCase()
            )
          }
          hasRecommendations={
            reportExtras.planRecommendations.length > 0 ||
            reportExtras.fertilizerApplyLines.length > 0 ||
            reportExtras.fertilizerProducts.length > 0 ||
            results.length > 0
          }
          onOpenCalculators={() => {
            setExportModalOpen(false);
            setCurrentStep("calculators");
          }}
        />
      ) : null}
      </main>
    </>
  );
}

function SetupScreen({
  t,
  userId,
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
  locationStatus,
  onDetectLocation,
  samplingDate,
  setSamplingDate,
  goHome,
  goToValues,
  onExportPdf,
  exportingPdf,
}: {
  t: (typeof translations)[Language];
  userId?: string;
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
  locationStatus?: string;
  onDetectLocation?: () => void | Promise<void>;
  samplingDate: string;
  setSamplingDate: (value: string) => void;
  goHome: () => void;
  goToValues: () => void;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
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
        {onExportPdf ? (
          <ExportPdfIconButton
            onClick={onExportPdf}
            busy={exportingPdf}
            label={t.exportPdf}
          />
        ) : null}
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
        <FarmLotSelector
          userId={userId}
          farmName={farmName}
          onFarmNameChange={setFarmName}
          lotNames={lotName}
          onLotNamesChange={setLotName}
          layout="inline"
          labels={{
            farm: t.farmName,
            lots: t.lotName,
            selectFarm: t.selectFarm,
            newFarm: t.newFarm,
            addLot: t.addLot,
            noLots: t.noLots,
          }}
        />

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

        <SetupInlineField label={t.extractionMethodLabel}>
          <div className="setup-extraction-inline">
            <ExtractionMethodChips
              t={t}
              value={extractionMethod}
              onChange={setExtractionMethod}
              options={
                sampleType === "foliar"
                  ? FOLIAR_EXTRACTION_OPTIONS
                  : SOIL_EXTRACTION_OPTIONS
              }
            />
          </div>
        </SetupInlineField>

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
            country={country}
            setCountry={setCountry}
            customCountry={customCountry}
            setCustomCountry={setCustomCountry}
            provinceState={provinceState}
            setProvinceState={setProvinceState}
            samplingDate={samplingDate}
            setSamplingDate={setSamplingDate}
            locationStatus={locationStatus}
            onDetectLocation={onDetectLocation}
            t={t}
          />
        ) : null}
      </div>

      <div className="app-fixed-action-bar fixed inset-x-0 z-[11000]">
        <div className="app-content-shell px-4 py-3">
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
  onShowParameterSymbolsOnlyChange,
  updateValue,
  updateUnit,
  clearAllValues,
  message,
  saveMessage,
  pendingEditableAnalysis,
  loading,
  saving,
  cropId,
  setCropId,
  crops,
  analysisName,
  farmName,
  lotName,
  saveAnalysis,
  backToSetup,
  openImporter,
  openCustomParameterModal,
  openCustomParameterManager,
  openCustomRangeManager,
  results,
  missingResults,
  isSaved,
  isQueued,
  needsUpdate,
  onExportPdf,
  exportingPdf,
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
  onShowParameterSymbolsOnlyChange: (value: boolean) => void;
  updateValue: (parameterKey: string, newValue: string) => void;
  updateUnit: (parameterKey: string, unitId: number, displayKey?: string) => void;
  clearAllValues: () => void;
  message: string;
  saveMessage: string;
  pendingEditableAnalysis: EditableAnalysisPayload | null;
  loading: boolean;
  saving: boolean;
  cropId: number | "";
  setCropId: (value: number | "") => void;
  crops: Crop[];
  analysisName: string;
  farmName: string;
  lotName: string;
  saveAnalysis: () => void;
  backToSetup: () => void;
  openImporter: () => void;
  openCustomParameterModal: () => void;
  openCustomParameterManager: () => void;
  openCustomRangeManager: () => void;
  results: InterpretationResult[];
  missingResults: MissingResult[];
  isSaved: boolean;
  isQueued: boolean;
  needsUpdate: boolean;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
}) {
  const [addDataMenuSource, setAddDataMenuSource] = useState<
    null | "toolbar" | "sticky"
  >(null);
  const [showParameterActions, setShowParameterActions] = useState(false);
  const [canRenderFloatingActions, setCanRenderFloatingActions] = useState(false);
  const parameterGridRef = useRef<HTMLDivElement | null>(null);
  const [valueEntryView, setValueEntryView] = useState<ValueEntryView>("cards");
  const [detailParameterKey, setDetailParameterKey] = useState<string | null>(
    null
  );
  const [isCompactViewport, setIsCompactViewport] = useState(false);
  const hasVisibleParameters = filteredParameters.length > 0;
  const hasEnteredValues = totalEnteredValues > 0;
  const valuesChrome = calculatorHubText[language];
  const analysisMetaBits = [
    analysisName.trim(),
    farmName.trim(),
    lotName.trim(),
  ].filter(Boolean);
  const useSymbolsOnly = showParameterSymbolsOnly || isCompactViewport;
  const missingKeySet = useMemo(
    () => new Set(missingResults.map((item) => item.parameter_key)),
    [missingResults]
  );

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)");
    const sync = () => setIsCompactViewport(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, []);

  const parameterGroups = useMemo(() => {
    if (sortMode !== "type") {
      return [
        {
          tier: null as ParameterPriorityTier | null,
          items: filteredParameters,
        },
      ];
    }

    const groups: Array<{
      tier: ParameterPriorityTier;
      items: Parameter[];
    }> = [];

    for (const parameter of filteredParameters) {
      const tier = getParameterPriorityTier(parameter);
      const last = groups[groups.length - 1];
      if (!last || last.tier !== tier) {
        groups.push({ tier, items: [parameter] });
      } else {
        last.items.push(parameter);
      }
    }

    return groups;
  }, [filteredParameters, sortMode]);

  const showStickyAddAction = hasVisibleParameters && showParameterActions;
  const showSaveAction =
    hasVisibleParameters &&
    (showParameterActions || hasEnteredValues) &&
    addDataMenuSource === null;

  const addDataMenuLabels = {
    menuHeading: t.addNewParameter,
    addCustomParameter: t.addCustomParameter,
    addCustomParameterDesc: t.addNewParameter,
    manageCustomParameters: t.manageCustomParameters,
    manageCustomParametersDesc: t.manageCustomParametersDesc,
    manageCustomRanges: t.manageCustomRanges,
    manageCustomRangesDesc: t.manageCustomRangesDesc,
    close: t.close,
  };

  useEffect(() => {
    queueMicrotask(() => setCanRenderFloatingActions(true));
  }, []);

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
    queueMicrotask(() => setAddDataMenuSource(null));
  }, [showParameterActions]);

  return (
    <>
    <section
      className={`values-screen-panel values-screen-panel--open px-0 pb-4 pt-0 md:px-0 md:pb-5 md:pt-0 ${
        hasVisibleParameters ? "pb-20" : ""
      }${isCompactViewport ? " values-screen-panel--compact" : ""}`}
    >
      {/* Page header + toolbar */}
      <div className="values-screen-panel__header">
      <div className="values-page-header">
        <BackButton variant="icon" onClick={backToSetup} label={t.backToSetup} />
        <div className="min-w-0 flex-1">
          <h2 className="values-page-title">{t.enterValues}</h2>
          {selectedCrop && (
            <p className="values-page-subtitle">
              {selectedCrop.display_name} · {sampleType === "soil" ? t.soil : t.foliar}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onExportPdf ? (
            <ExportPdfIconButton
              onClick={onExportPdf}
              busy={exportingPdf}
              label={t.exportPdf}
            />
          ) : null}
          {totalEnteredValues > 0 && (
            <span className="values-count-badge">
              {totalEnteredValues}
            </span>
          )}
        </div>
      </div>

      {analysisMetaBits.length > 0 ? (
        <p className="values-analysis-meta mx-3 mb-2 sm:mx-4">
          {analysisMetaBits.join(" · ")}
        </p>
      ) : null}

      {/* Compact toolbar: search + controls */}
      <div className="values-toolbar">
        <div className="values-toolbar__row">
          <div className="relative min-w-0 flex-1">
              <Search size={15} className="values-search-icon" />
              <input
                className="values-search-input"
                placeholder={t.searchPlaceholder}
                value={parameterSearch}
                onChange={(e) => setParameterSearch(e.target.value)}
              />
            </div>

            {/* Import */}
            <button
              type="button"
              onClick={openImporter}
              title={t.importCsvExcel}
              className="values-toolbar-btn"
            >
              <Upload size={16} />
            </button>

            {/* Add custom data */}
            <AddDataMenu
              variant="toolbar"
              open={addDataMenuSource === "toolbar"}
              onOpenChange={(open) =>
                setAddDataMenuSource(open ? "toolbar" : null)
              }
              labels={addDataMenuLabels}
              onAddParameter={openCustomParameterModal}
              onManageParameters={openCustomParameterManager}
              onManageRanges={openCustomRangeManager}
            />
          </div>

          <div className="values-toolbar__filters">
            <ViewLayoutToggle
              value={valueEntryView === "cards" ? "grid" : "list"}
              onChange={(mode) =>
                setValueEntryView(mode === "grid" ? "cards" : "table")
              }
              listLabel={valuesChrome.viewLayoutList}
              gridLabel={valuesChrome.viewLayoutGrid}
              className="values-toolbar__view-toggle"
            />

            <ParameterCategoryFilter
              categories={parameterCategories}
              selectedCategory={selectedCategory}
              onChange={(category) => {
                setSelectedCategory(category);
                setShowAllParameters(category === "All");
              }}
              language={language}
              allLabel={t.all}
              compact
              className="values-toolbar__categories min-w-0 flex-1"
            />

            <ValuesDisplayMenu
              sortMode={sortMode}
              onSortModeChange={setSortMode}
              showSymbolsOnly={showParameterSymbolsOnly}
              onShowSymbolsOnlyChange={onShowParameterSymbolsOnlyChange}
              labels={{
                sortByType: t.sortByType,
                sortByName: t.sortByName,
                showSymbolsOnly: t.showSymbolsOnlyMenu,
                menuLabel: t.valuesDisplayMenu,
              }}
            />
          </div>
      </div>
      </div>

      {!cropId ? (
        <div className="values-skip-crop-block">
          <p className="values-block-label">{t.crop}</p>
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
          <p className="values-block-hint">{t.selectCropOnValues}</p>
        </div>
      ) : null}

      {showFoliarExtractionPicker || sampleType === "soil" ? (
        <div className="values-skip-crop-block">
          <p className="values-block-label">{t.extractionMethodLabel}</p>
          <ExtractionMethodChips
            t={t}
            value={extractionMethod}
            onChange={setExtractionMethod}
            options={
              sampleType === "foliar"
                ? FOLIAR_EXTRACTION_OPTIONS
                : SOIL_EXTRACTION_OPTIONS
            }
          />
        </div>
      ) : null}

      {canRenderFloatingActions
        ? createPortal(
            <>
              {showStickyAddAction && (
                <div className="fixed right-3 top-[calc(env(safe-area-inset-top,0px)+0.85rem)] z-[16000] animate-float-in sm:right-5 md:right-[max(1.25rem,calc((100vw-72rem)/2+1.25rem))]">
                  <div className="values-sticky-add-shell">
                    <div className="flex justify-end">
                      <AddDataMenu
                        variant="sticky"
                        open={addDataMenuSource === "sticky"}
                        onOpenChange={(open) =>
                          setAddDataMenuSource(open ? "sticky" : null)
                        }
                        labels={{
                          ...addDataMenuLabels,
                          menuHeading: t.addShort,
                        }}
                        onAddParameter={openCustomParameterModal}
                        onManageParameters={openCustomParameterManager}
                        onManageRanges={openCustomRangeManager}
                      />
                    </div>
                  </div>
                </div>
              )}

              {showSaveAction && (
                <div className="values-interpret-fab fixed z-[14000] animate-slide-up">
                  <button
                    type="button"
                    onClick={() => void saveAnalysis()}
                    disabled={
                      loading ||
                      saving ||
                      Boolean(pendingEditableAnalysis) ||
                      !hasEnteredValues ||
                      !cropId ||
                      isSaved ||
                      isQueued
                    }
                    className={`values-interpret-fab__btn${
                      isSaved || isQueued
                        ? " values-interpret-fab__btn--saved"
                        : ""
                    }`}
                    aria-label={
                      saving
                        ? t.saving
                        : isSaved
                          ? t.analysisSavedState
                          : isQueued
                            ? t.analysisQueuedState
                            : needsUpdate
                              ? t.updateAnalysis
                              : t.saveAnalysis
                    }
                  >
                    {hasEnteredValues && !saving && !isSaved && !isQueued ? (
                      <span className="values-interpret-fab__count" aria-hidden>
                        {totalEnteredValues}
                      </span>
                    ) : (
                      <Save size={15} strokeWidth={2.25} aria-hidden />
                    )}
                    <span className="values-interpret-fab__label">
                      {saving
                        ? t.saving
                        : isSaved
                          ? t.analysisSavedState
                          : isQueued
                            ? t.analysisQueuedState
                            : needsUpdate
                              ? t.updateShort
                              : t.saveShort}
                    </span>
                  </button>
                </div>
              )}
            </>,
            document.body
          )
        : null}

      {message && (
        <div className="values-alert values-alert--warning">
          {message}
        </div>
      )}

      {saveMessage && (
        <div className="values-alert values-alert--info">
          {saveMessage}
        </div>
      )}

      {pendingEditableAnalysis && (
        <div className="values-alert values-alert--info">
          {t.loadingSavedValues}
        </div>
      )}

      {hasVisibleParameters && valueEntryView === "table" && (
        <div ref={parameterGridRef} className="values-entry-list">
          {parameterGroups.map((group) => (
            <section key={group.tier ?? "all"} className="values-entry-group">
              {group.tier && sortMode === "type" ? (
                <h3 className="values-entry-group__title">
                  {priorityTierLabel(group.tier, t)}
                </h3>
              ) : null}
              {group.items.map((parameter) => {
                const { selectedUnit, selectedUnitDisplayKey } =
                  resolveParameterUnitState(
                    parameter,
                    selectedUnits,
                    selectedUnitDisplayKeys
                  );
                const tier = getParameterPriorityTier(parameter);
                const label = formatParameterEntryLabel(
                  parameter,
                  useSymbolsOnly
                );
                const liveResult = findResultForParameter(results, parameter);
                const hasValue = Boolean(
                  values[parameter.parameter_key]?.trim()
                );
                const isMissing =
                  hasValue && missingKeySet.has(parameter.parameter_key);
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
                  <article
                    key={parameter.parameter_key}
                    title={aliasTitle}
                    className={`values-entry-row values-entry-row--${tier}${
                      parameter.is_custom ? " values-entry-row--custom" : ""
                    }${
                      detailParameterKey === parameter.parameter_key
                        ? " values-entry-row--interp-open"
                        : ""
                    }`}
                  >
                    <div className="values-entry-row__head">
                      <div className="values-entry-row__name">
                        <span className="values-entry-row__primary">
                          {label.primary}
                        </span>
                        {!useSymbolsOnly && label.secondary ? (
                          <span className="values-entry-row__symbol">
                            {label.secondary}
                          </span>
                        ) : null}
                      </div>
                      {showParameterDetails && parameter.category ? (
                        <p className="values-entry-row__meta">
                          {translateCategory(
                            parameter.category,
                            language,
                            translations,
                            { compact: true }
                          )}
                        </p>
                      ) : null}
                    </div>
                    <div className="values-entry-row__fields">
                      <div
                        className={`values-value-unit-box ${
                          liveResult
                            ? getLevelToneClass(liveResult.level_code)
                            : ""
                        }`}
                      >
                        <input
                          className="values-value-input values-value-input--entry values-value-input--with-unit"
                          type="text"
                          inputMode="decimal"
                          value={values[parameter.parameter_key] || ""}
                          onChange={(event) =>
                            updateValue(
                              parameter.parameter_key,
                              event.target.value
                            )
                          }
                          placeholder={isCompactViewport ? "—" : t.valuePlaceholder}
                          aria-label={`${parameter.display_name} ${t.valueLabel}`}
                        />
                        <div className="values-value-unit-box__unit">
                          <ParameterUnitPicker
                            units={parameter.available_units}
                            selectedUnit={selectedUnit}
                            selectedDisplayKey={selectedUnitDisplayKey}
                            getUnitOptionKey={getUnitOptionKey}
                            dedupeUnitOptions={dedupeUnitOptions}
                            changeUnitLabel={t.changeUnit}
                            compact
                            embedded
                            onChange={(unitId, displayKey) =>
                              updateUnit(
                                parameter.parameter_key,
                                unitId,
                                displayKey
                              )
                            }
                          />
                        </div>
                      </div>
                      <ValueLiveInterpControl
                        t={t}
                        result={liveResult}
                        isMissing={isMissing}
                        compact={isCompactViewport}
                        detailOpen={
                          detailParameterKey === parameter.parameter_key
                        }
                        onToggleDetail={() =>
                          setDetailParameterKey((current) =>
                            current === parameter.parameter_key
                              ? null
                              : parameter.parameter_key
                          )
                        }
                      />
                    </div>
                  </article>
                );
              })}
            </section>
          ))}
        </div>
      )}

      {hasVisibleParameters && valueEntryView === "cards" && (
        <div
          ref={parameterGridRef}
          className={`values-table-shell${
            isCompactViewport ? " values-table-shell--compact" : ""
          }`}
        >
          <table className="values-table w-full table-fixed border-collapse text-xs sm:text-sm">
            <colgroup>
              <col className="values-table-col values-table-col--param" />
              <col className="values-table-col values-table-col--value" />
              <col className="values-table-col values-table-col--level" />
            </colgroup>
            <thead>
              <tr>
                <th className="values-table-cell values-table-cell--param px-3 py-2 sm:px-4">
                  {t.parameterLabel}
                </th>
                <th className="values-table-cell values-table-cell--value px-2.5 py-2 sm:px-3">
                  {t.valueLabel}
                </th>
                <th className="values-table-cell values-table-cell--level px-1 py-2">
                  <span className="sr-only">{t.interpretationDetail}</span>
                  {hasEnteredValues ? (
                    <div className="values-table-clear-wrap">
                      <button
                        type="button"
                        className="values-table-clear-btn"
                        onClick={() => {
                          if (window.confirm(t.clearValuesConfirm)) {
                            clearAllValues();
                          }
                        }}
                        title={t.clearAllValues}
                        aria-label={t.clearAllValues}
                      >
                        <Eraser size={14} aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredParameters.map((parameter) => {
                const { selectedUnit, selectedUnitDisplayKey } =
                  resolveParameterUnitState(
                    parameter,
                    selectedUnits,
                    selectedUnitDisplayKeys
                  );
                const label = formatParameterEntryLabel(
                  parameter,
                  useSymbolsOnly
                );
                const displayParameterLabel = useSymbolsOnly
                  ? label.primary
                  : label.secondary
                    ? `${label.primary} (${label.secondary})`
                    : label.primary;
                const liveResult = findResultForParameter(results, parameter);
                const hasValue = Boolean(
                  values[parameter.parameter_key]?.trim()
                );
                const isMissing =
                  hasValue && missingKeySet.has(parameter.parameter_key);
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
                  <tr key={parameter.parameter_key} title={aliasTitle}>
                    <td className="values-table-cell values-table-cell--param px-2 py-1.5 align-middle sm:px-4">
                      <div className="values-table-param">
                        {displayParameterLabel}
                      </div>
                    </td>
                    <td className="values-table-cell values-table-cell--value px-1.5 py-1.5 align-middle sm:px-3">
                      <div
                        className={`values-value-unit-box ${
                          liveResult
                            ? getLevelToneClass(liveResult.level_code)
                            : ""
                        }`}
                      >
                        <input
                          className="values-value-input values-value-input--with-unit"
                          type="text"
                          inputMode="decimal"
                          value={values[parameter.parameter_key] || ""}
                          onChange={(event) =>
                            updateValue(
                              parameter.parameter_key,
                              event.target.value
                            )
                          }
                          placeholder={isCompactViewport ? "—" : t.valuePlaceholder}
                          aria-label={`${parameter.display_name} ${t.valueLabel}`}
                        />
                        <div className="values-value-unit-box__unit">
                          <ParameterUnitPicker
                            units={parameter.available_units}
                            selectedUnit={selectedUnit}
                            selectedDisplayKey={selectedUnitDisplayKey}
                            getUnitOptionKey={getUnitOptionKey}
                            dedupeUnitOptions={dedupeUnitOptions}
                            changeUnitLabel={t.changeUnit}
                            compact
                            embedded
                            onChange={(unitId, displayKey) =>
                              updateUnit(
                                parameter.parameter_key,
                                unitId,
                                displayKey
                              )
                            }
                          />
                        </div>
                      </div>
                    </td>
                    <td className="values-table-cell values-table-cell--level px-1 py-1.5 align-middle">
                      <ValueLiveInterpControl
                        t={t}
                        result={liveResult}
                        isMissing={isMissing}
                        compact={isCompactViewport}
                        detailOpen={
                          detailParameterKey === parameter.parameter_key
                        }
                        onToggleDetail={() =>
                          setDetailParameterKey((current) =>
                            current === parameter.parameter_key
                              ? null
                              : parameter.parameter_key
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!hasVisibleParameters && parameters.length > 0 && (
        <div className="values-alert values-alert--warning">
          {t.noParametersCategory}
        </div>
      )}

      {!hasVisibleParameters && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => void saveAnalysis()}
            disabled={
              loading ||
              saving ||
              !cropId ||
              Boolean(pendingEditableAnalysis) ||
              !hasEnteredValues ||
              isSaved ||
              isQueued
            }
            className="touch-target rounded-2xl bg-green-700 px-6 py-3 font-semibold text-white shadow-sm active:scale-[0.98] hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-64"
          >
            {saving
              ? t.saving
              : isSaved
                ? t.analysisSavedState
                : isQueued
                  ? t.analysisQueuedState
                  : needsUpdate
                    ? t.updateAnalysis
                    : t.saveAnalysis}
          </button>
        </div>
      )}
    </section>
    </>
  );
}

function ValueLiveInterpControl({
  t,
  result,
  isMissing,
  compact = false,
  detailOpen,
  onToggleDetail,
}: {
  t: (typeof translations)[Language];
  result: InterpretationResult | undefined;
  isMissing: boolean;
  compact?: boolean;
  detailOpen: boolean;
  onToggleDetail: () => void;
}) {
  if (!result && !isMissing) return null;

  const levelLabel = result ? translateLevelCode(result.level_code, t) : "";

  return (
    <div
      className={`values-live-interp${compact ? " values-live-interp--compact" : ""}${
        detailOpen ? " values-live-interp--open" : ""
      }`}
    >
      {result ? (
        <>
          <span
            className={`${getLevelBadgeClass(result.level_code)} values-live-interp__badge${
              compact ? " values-live-interp__badge--compact" : ""
            }`}
            title={levelLabel}
          >
            {levelLabel}
          </span>
          <button
            type="button"
            className="values-live-interp__detail"
            onClick={onToggleDetail}
            aria-expanded={detailOpen}
            aria-label={t.viewInterpretationDetail}
            title={levelLabel || t.viewInterpretationDetail}
          >
            <Info size={compact ? 13 : 14} strokeWidth={2.25} />
          </button>
        </>
      ) : (
        <span className="values-live-interp__missing" title={t.noRangeFound}>
          —
        </span>
      )}

      {detailOpen && result ? (
        <div className="values-interp-popover" role="dialog">
          <div className="values-interp-popover__head">
            <strong>{t.interpretationDetail}</strong>
            <button
              type="button"
              className="values-live-interp__detail"
              onClick={onToggleDetail}
              aria-label={t.close}
            >
              <X size={14} />
            </button>
          </div>
          <p
            className={`${getLevelBadgeClass(result.level_code)} values-interp-popover__level`}
          >
            {levelLabel}
          </p>
          <p className="values-interp-popover__line">
            <span className="values-interp-popover__label">{t.rangeLabel}</span>
            <span className="values-interp-popover__value">
              {result.min ?? "—"}–{result.max ?? "—"} {result.unit_symbol}
            </span>
          </p>
          {result.source_name ? (
            <p className="values-interp-popover__line values-interp-popover__line--stack">
              <span className="values-interp-popover__label">{t.source}</span>
              <span className="values-interp-popover__value">
                {result.source_name}
              </span>
            </p>
          ) : null}
          <p className="values-interp-popover__advice">{result.advice}</p>
        </div>
      ) : null}
    </div>
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
  country,
  setCountry,
  customCountry,
  setCustomCountry,
  provinceState,
  setProvinceState,
  samplingDate,
  setSamplingDate,
  locationStatus,
  onDetectLocation,
  t,
}: {
  analysisName: string;
  setAnalysisName: (value: string) => void;
  country: string;
  setCountry: (value: string) => void;
  customCountry: string;
  setCustomCountry: (value: string) => void;
  provinceState: string;
  setProvinceState: (value: string) => void;
  samplingDate: string;
  setSamplingDate: (value: string) => void;
  locationStatus?: string;
  onDetectLocation?: () => void | Promise<void>;
  t: (typeof translations)[Language];
}) {
  const [countryRegion, setCountryRegion] = useState<CountryRegion | "">("");
  const [detecting, setDetecting] = useState(false);
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

      <div className="rounded-xl border border-emerald-900/10 bg-emerald-50/40 px-3 py-3 dark:border-white/10 dark:bg-white/5">
        <p className="text-xs text-slate-600 dark:text-slate-300">
          {t.useMyLocationHint}
        </p>
        <button
          type="button"
          className="mt-2 rounded-xl bg-emerald-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          disabled={detecting || !onDetectLocation}
          onClick={async () => {
            if (!onDetectLocation) return;
            setDetecting(true);
            try {
              await onDetectLocation();
            } finally {
              setDetecting(false);
            }
          }}
        >
          {detecting ? t.locationDetecting : t.useMyLocation}
        </button>
        {locationStatus ? (
          <p className="mt-2 text-xs text-emerald-900 dark:text-emerald-200">
            {locationStatus}
          </p>
        ) : null}
      </div>

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
    general:
      t.extractionMethodCropSpecific ||
      t.extractionMethodGeneral ||
      "Crop-specific",
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
  disabled = false,
}: {
  t: (typeof translations)[Language];
  value: ExtractionMethod;
  onChange: (value: ExtractionMethod) => void;
  options?: ExtractionMethod[];
  disabled?: boolean;
}) {
  return (
    <div
      className="extraction-method-chips"
      role="group"
      aria-label={t.extractionMethodLabel}
      aria-busy={disabled || undefined}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          disabled={disabled}
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
  language,
  t,
  saving,
  saveMessage,
  saveAnalysis,
  isSaved,
  isQueued,
  needsUpdate,
  pendingOfflineSaves,
  isGeneralCrop,
  sampleType,
  showFoliarExtractionPicker,
  extractionMethod,
  interpreting,
  onExtractionMethodChange,
  showHorizontalGraphs,
  backToValues,
  onExportPdf,
  exportingPdf,
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
  saveAnalysis: () => void | Promise<void>;
  isSaved: boolean;
  isQueued: boolean;
  needsUpdate: boolean;
  pendingOfflineSaves: number;
  isGeneralCrop: boolean;
  sampleType: "soil" | "foliar";
  showFoliarExtractionPicker: boolean;
  extractionMethod: ExtractionMethod;
  interpreting: boolean;
  onExtractionMethodChange: (method: ExtractionMethod) => void;
  showHorizontalGraphs: boolean;
  backToValues: () => void;
  onExportPdf?: () => void;
  exportingPdf?: boolean;
}) {
  const [activeGroup, setActiveGroup] = useState<
    "all" | "negative" | "warning" | "normal" | "positive" | "neutral" | "other"
  >("all");

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
              {interpreting ? (
                <span className="ml-2 text-amber-600">
                  · {t.interpreting || "Interpreting…"}
                </span>
              ) : null}
            </p>
          </div>
          {onExportPdf ? (
            <ExportPdfIconButton
              onClick={onExportPdf}
              busy={exportingPdf}
              label={t.exportPdf}
            />
          ) : null}
        </div>

        {sampleType === "soil" || showFoliarExtractionPicker ? (
          <div className="mb-4">
            <p className="values-block-label mb-2">{t.extractionMethodLabel}</p>
            <ExtractionMethodChips
              t={t}
              value={extractionMethod}
              onChange={onExtractionMethodChange}
              disabled={interpreting}
              options={
                sampleType === "foliar"
                  ? FOLIAR_EXTRACTION_OPTIONS
                  : SOIL_EXTRACTION_OPTIONS
              }
            />
          </div>
        ) : null}

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
        <div className="app-content-shell px-4 py-3">
          <button
            type="button"
            onClick={() => void saveAnalysis()}
            disabled={saving || results.length === 0 || isSaved || isQueued}
            className={`flex w-full items-center justify-center gap-2 rounded-2xl px-5 py-3.5 font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed ${
              isSaved || isQueued
                ? "bg-[#f2f2f2] text-[#aeaeb2]"
                : "bg-green-700 text-white hover:bg-green-800"
            }`}
          >
            <Save size={18} />
            {saving
              ? t.saving
              : isSaved
                ? t.analysisSavedState
                : isQueued
                  ? t.analysisQueuedState
                  : needsUpdate
                    ? t.updateAnalysis
                    : t.saveAnalysis}
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
