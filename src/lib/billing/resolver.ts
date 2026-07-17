import { DEFAULT_AI_PLANS, getActiveAiPlans } from "./aiPlans";
import { DEFAULT_BILLING_CONFIG, getBillingConfig } from "./config";
import {
  EARTH_PROGRAM_LIMITS,
  LICENSE_DEFINITIONS,
  normalizeLicenseType,
} from "./licenses";
import type {
  AIUsage,
  BillingConfig,
  BillingNotification,
  License,
  LicenseType,
  LicensingBundle,
  UsageLimits,
  VerificationRecord,
} from "./types";

export function usagePercent(used: number, limit: number) {
  if (limit <= 0) return 0;
  return Math.min(100, Math.round((used / limit) * 100));
}

function monthPeriod(now = new Date()) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));
  const reset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return {
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
    resetDate: reset.toISOString(),
  };
}

export function resolveIncludedAiAllowance(
  licenseType: LicenseType,
  config: BillingConfig
) {
  return config.licenseIncludedAi[licenseType] ?? LICENSE_DEFINITIONS[licenseType].includedAiPerMonth;
}

export function resolveAiQuestionLimit(
  licenseType: LicenseType,
  hasActiveAiSub: boolean,
  config: BillingConfig
): number {
  const included = resolveIncludedAiAllowance(licenseType, config);
  if (hasActiveAiSub) {
    return Math.max(included, config.aiMonthlyLimit);
  }
  return included;
}

export function resolveUsageLimits(
  licenseType: LicenseType,
  verification: VerificationRecord
): UsageLimits {
  if (
    verification.status === "approved" &&
    verification.program === "earth_university"
  ) {
    return {
      farms: EARTH_PROGRAM_LIMITS.farms,
      labReports: EARTH_PROGRAM_LIMITS.labReports,
      storageMb: EARTH_PROGRAM_LIMITS.storageMb,
    };
  }
  const def = LICENSE_DEFINITIONS[licenseType].limits;
  return { farms: def.farms, labReports: def.labReports, storageMb: def.storageMb };
}

export function resolveLicenseLabel(
  licenseType: LicenseType,
  verification: VerificationRecord
): string {
  if (
    verification.status === "approved" &&
    verification.program === "earth_university"
  ) {
    return "Plus (EARTH Program)";
  }
  if (
    verification.status === "approved" &&
    verification.program === "haiti_farmer"
  ) {
    return "Free (Haiti Verified)";
  }
  return LICENSE_DEFINITIONS[licenseType].name;
}

export function defaultLicense(userId = "", type: LicenseType = "free"): License {
  return {
    userId,
    licenseType: type,
    status: "active",
    purchasedAt: null,
    purchasePriceCents: null,
    currency: "USD",
  };
}

export function defaultVerification(): VerificationRecord {
  return {
    program: null,
    status: "none",
    badgeLabel: null,
    appliedAt: null,
    reviewedAt: null,
    notes: null,
  };
}

export function defaultAiUsage(userId: string, limit: number): AIUsage {
  const period = monthPeriod();
  return {
    userId,
    ...period,
    questionsUsed: 0,
    questionsLimit: limit,
  };
}

export function defaultUsage() {
  return { farms: 0, labReports: 0, storageMb: 0 };
}

export function licenseAllowsAdvancedFeatures(licenseType: LicenseType) {
  return licenseType === "plus" || licenseType === "pro";
}

export function licenseAllowsProFeatures(licenseType: LicenseType) {
  return licenseType === "pro";
}

export function computeAiAccess(
  aiUsage: AIUsage,
  hasActiveAiSub: boolean
): { hasAiAccess: boolean; aiLimitReached: boolean } {
  const remaining = Math.max(0, aiUsage.questionsLimit - aiUsage.questionsUsed);
  const aiLimitReached = remaining <= 0;
  const hasAiAccess = !aiLimitReached;
  return { hasAiAccess, aiLimitReached };
}

export function buildLicensingBundle(partial: Partial<LicensingBundle>): LicensingBundle {
  const config = partial.config ?? DEFAULT_BILLING_CONFIG;
  const license = partial.license ?? defaultLicense();
  const licenseType = normalizeLicenseType(license.licenseType);
  const verification = partial.verification ?? defaultVerification();
  const aiSubscription = partial.aiSubscription ?? {
    userId: license.userId,
    planId: null,
    status: "none" as const,
    priceMonthlyCents: config.aiStandardPriceCents,
    renewalDate: null,
    cancelledAt: null,
  };
  const hasActiveAiSub = aiSubscription.status === "active";
  const limit = resolveAiQuestionLimit(licenseType, hasActiveAiSub, config);
  const aiUsage = partial.aiUsage ?? defaultAiUsage(license.userId, limit);
  aiUsage.questionsLimit = limit;
  const { hasAiAccess, aiLimitReached } = computeAiAccess(aiUsage, hasActiveAiSub);

  return {
    configured: partial.configured ?? false,
    license: { ...license, licenseType },
    aiSubscription,
    aiUsage,
    aiPlans: partial.aiPlans ?? getActiveAiPlans(DEFAULT_AI_PLANS),
    config,
    usage: partial.usage ?? defaultUsage(),
    limits: partial.limits ?? resolveUsageLimits(licenseType, verification),
    verification,
    payments: partial.payments ?? [],
    invoices: partial.invoices ?? [],
    notifications: partial.notifications ?? [],
    hasAiAccess,
    aiLimitReached,
  };
}

export function makeNotification(
  type: BillingNotification["type"],
  title: string,
  body: string
): BillingNotification {
  return {
    id: `bn_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    type,
    title,
    body,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

/** Client-side config reader */
export function readClientConfig() {
  return typeof window !== "undefined" ? getBillingConfig() : DEFAULT_BILLING_CONFIG;
}
