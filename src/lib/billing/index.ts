import { getBillingConfig } from "./config";
import {
  getLocalLicensingBundle,
  readUserState,
  syncLicenseToSettings,
  writeUserState,
} from "./mockService";
import type { LicenseType } from "./types";

export type {
  AIPlan,
  AIPlanId,
  AIUsage,
  AISubscription,
  AISubscriptionStatus,
  BillingConfig,
  BillingNotification,
  BillingNotificationType,
  BillingPromotion,
  Invoice,
  InvoiceKind,
  InvoiceStatus,
  License,
  LicenseStatus,
  LicenseType,
  LicensingBundle,
  Payment,
  PaymentProvider,
  UsageLimits,
  UsageSnapshot,
  VerificationApplicationInput,
  VerificationProgram,
  VerificationRecord,
  VerificationStatus,
} from "./types";

export type { LicenseFeatureKey, BillingPlanId } from "./licenses";

export {
  COMPARISON_ROWS,
  EARTH_PROGRAM_LIMITS,
  LICENSE_DEFINITIONS,
  LICENSE_ORDER,
  canUpgradeLicense,
  canUpgradeLicense as canUpgradeTo,
  licenseIncludesFeature,
  licenseRank,
  licenseRank as planRank,
  normalizeLicenseType,
  normalizeLicenseType as normalizePlanId,
  licenseIncludesFeature as planIncludesFeature,
  LICENSE_DEFINITIONS as PLAN_DEFINITIONS,
} from "./licenses";

export { DEFAULT_AI_PLANS, findAiPlan, getActiveAiPlans } from "./aiPlans";

export {
  BILLING_CONFIG_STORAGE_KEY,
  DEFAULT_BILLING_CONFIG,
  formatUsd,
  getBillingConfig,
  mergeBillingConfig,
  saveBillingConfig,
  softwarePriceCents,
} from "./config";

export {
  buildLicensingBundle,
  defaultAiUsage,
  defaultLicense,
  defaultUsage,
  defaultVerification,
  licenseAllowsAdvancedFeatures,
  licenseAllowsAdvancedFeatures as planAllowsAdvancedFeatures,
  licenseAllowsProFeatures,
  licenseAllowsProFeatures as planAllowsPremiumFeatures,
  makeNotification,
  readClientConfig,
  resolveAiQuestionLimit,
  resolveIncludedAiAllowance,
  resolveLicenseLabel,
  resolveLicenseLabel as resolvePlanDisplayLabel,
  resolveUsageLimits,
  usagePercent,
} from "./resolver";

export function planAllowsBusinessFeatures() {
  return false;
}

export {
  getLocalLicensingBundle,
  mockCancelAi,
  mockPurchaseLicense,
  mockRecordAiQuestion,
  mockSubscribeAi,
  readUserState,
  stateToBundle,
  syncLicenseToSettings,
  syncLicenseToSettings as syncLocalPlanToSettings,
  writeUserState,
} from "./mockService";

export const LICENSING_STORAGE_KEY = "cultosol_licensing_state";

/** @deprecated */
export type BillingBundle = import("./types").LicensingBundle;

export function getLocalBillingBundle(userId: string) {
  const config = typeof window !== "undefined" ? getBillingConfig() : undefined;
  return getLocalLicensingBundle(userId, config);
}

export function setLocalPlan(userId: string, licenseType: LicenseType) {
  const state = readUserState(userId);
  state.licenseType = licenseType;
  writeUserState(userId, state);
  syncLicenseToSettings(licenseType);
}
