import type { LicenseType } from "./types";

export type LicenseFeatureKey =
  | "soilInterpretation"
  | "foliarInterpretation"
  | "waterInterpretation"
  | "manualLabInput"
  | "cicBases"
  | "nutritionalPlan"
  | "fertilizerRecommendation"
  | "amendmentRecommendation"
  | "costCalculation"
  | "applicationCalendar"
  | "cropSpecificRanges"
  | "graphs"
  | "dop"
  | "salinity"
  | "absorptionCurves"
  | "farmManagement"
  | "inventory"
  | "historicalComparison"
  | "clientManagement"
  | "whiteLabelReports"
  | "aiIncluded"
  | "additionalAiAvailable"
  | "support";

export type LicenseDefinition = {
  id: LicenseType;
  name: string;
  subtitle: string;
  description: string;
  priceLabel: string;
  lifetime: boolean;
  popular?: boolean;
  featureKeys: LicenseFeatureKey[];
  limits: {
    farms: number | null;
    labReports: number | null;
    storageMb: number | null;
  };
  includedAiPerMonth: number;
};

const FREE_FEATURES: LicenseFeatureKey[] = [
  "soilInterpretation",
  "foliarInterpretation",
  "waterInterpretation",
  "manualLabInput",
  "cicBases",
  "nutritionalPlan",
  "farmManagement",
  "aiIncluded",
];

const PLUS_FEATURES: LicenseFeatureKey[] = [
  ...FREE_FEATURES,
  "fertilizerRecommendation",
  "amendmentRecommendation",
  "costCalculation",
  "applicationCalendar",
  "cropSpecificRanges",
  "graphs",
  "dop",
  "salinity",
  "absorptionCurves",
  "additionalAiAvailable",
  "support",
];

const PRO_FEATURES: LicenseFeatureKey[] = [
  ...PLUS_FEATURES,
  "clientManagement",
  "historicalComparison",
  "inventory",
  "whiteLabelReports",
];

export const LICENSE_DEFINITIONS: Record<LicenseType, LicenseDefinition> = {
  free: {
    id: "free",
    name: "Free",
    subtitle: "Perfect for individual farmers.",
    description: "Perfect for individual farmers.",
    priceLabel: "FREE",
    lifetime: true,
    featureKeys: FREE_FEATURES,
    limits: { farms: 1, labReports: 3, storageMb: 100 },
    includedAiPerMonth: 3,
  },
  plus: {
    id: "plus",
    name: "Plus",
    subtitle: "Personal Edition",
    description: "Personal Edition — lifetime license for serious farmers.",
    priceLabel: "$15 USD",
    lifetime: true,
    popular: true,
    featureKeys: PLUS_FEATURES,
    limits: { farms: null, labReports: null, storageMb: 5120 },
    includedAiPerMonth: 20,
  },
  pro: {
    id: "pro",
    name: "Pro",
    subtitle: "Professional Edition",
    description: "Professional Edition — for agronomists and consultants.",
    priceLabel: "$30 USD",
    lifetime: true,
    featureKeys: PRO_FEATURES,
    limits: { farms: null, labReports: null, storageMb: 20480 },
    includedAiPerMonth: 50,
  },
};

export const LICENSE_ORDER: LicenseType[] = ["free", "plus", "pro"];

export const COMPARISON_ROWS: { key: LicenseFeatureKey; label: string }[] = [
  { key: "soilInterpretation", label: "Soil Interpretation" },
  { key: "foliarInterpretation", label: "Foliar Interpretation" },
  { key: "waterInterpretation", label: "Water Interpretation" },
  { key: "manualLabInput", label: "Manual Lab Input" },
  { key: "cicBases", label: "CEC / Bases" },
  { key: "nutritionalPlan", label: "Nutritional Plan" },
  { key: "fertilizerRecommendation", label: "Fertilizer Recommendation" },
  { key: "applicationCalendar", label: "Calendar" },
  { key: "graphs", label: "Graphs" },
  { key: "farmManagement", label: "Farm Management" },
  { key: "inventory", label: "Inventory" },
  { key: "historicalComparison", label: "Historical Comparison" },
  { key: "clientManagement", label: "Client Management" },
  { key: "whiteLabelReports", label: "White-label Reports" },
  { key: "aiIncluded", label: "AI Included" },
  { key: "additionalAiAvailable", label: "Additional AI Available" },
  { key: "support", label: "Support" },
];

export function licenseIncludesFeature(
  licenseType: LicenseType,
  feature: LicenseFeatureKey
) {
  return LICENSE_DEFINITIONS[licenseType].featureKeys.includes(feature);
}

export function licenseRank(licenseType: LicenseType) {
  return LICENSE_ORDER.indexOf(licenseType);
}

export function normalizeLicenseType(value: unknown): LicenseType {
  if (value === "plus" || value === "pro") return value;
  if (value === "premium" || value === "business") return "pro";
  return "free";
}

export function canUpgradeLicense(current: LicenseType, target: LicenseType) {
  return licenseRank(target) > licenseRank(current);
}

/** @deprecated Use LicenseType */
export type BillingPlanId = LicenseType;

export function normalizePlanId(value: unknown): LicenseType {
  return normalizeLicenseType(value);
}

export const PLAN_DEFINITIONS = LICENSE_DEFINITIONS;

export function planRank(id: LicenseType) {
  return licenseRank(id);
}

export function planIncludesFeature(id: LicenseType, key: LicenseFeatureKey) {
  return licenseIncludesFeature(id, key);
}

export const EARTH_PROGRAM_LIMITS = {
  farms: 5,
  labReports: 100,
  storageMb: 5120,
};
