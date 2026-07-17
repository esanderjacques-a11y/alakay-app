import { DEFAULT_AI_PLANS } from "./aiPlans";
import { DEFAULT_BILLING_CONFIG, mergeBillingConfig } from "./config";
import { normalizeLicenseType } from "./licenses";
import {
  mockCancelAi,
  mockPurchaseLicense,
  mockSubscribeAi,
  readUserState,
  stateToBundle,
  writeUserState,
  type PersistedUserState,
} from "./mockService";
import type { BillingConfig, LicenseType, LicensingBundle } from "./types";

let serverConfig: BillingConfig = DEFAULT_BILLING_CONFIG;

export function getServerBillingConfig(): BillingConfig {
  return serverConfig;
}

export function setServerBillingConfig(config: BillingConfig) {
  serverConfig = mergeBillingConfig(config);
}

export function fetchLicensingBundleFromServer(userId: string): LicensingBundle {
  return stateToBundle(userId, readUserState(userId), serverConfig);
}

export function purchaseLicenseOnServer(
  userId: string,
  licenseType: LicenseType
): LicensingBundle {
  return mockPurchaseLicense(userId, licenseType, serverConfig);
}

export function subscribeAiOnServer(userId: string, planId: string): LicensingBundle {
  return mockSubscribeAi(userId, planId, serverConfig);
}

export function cancelAiOnServer(userId: string): LicensingBundle {
  return mockCancelAi(userId, serverConfig);
}

export function syncServerUserState(userId: string, state: PersistedUserState) {
  writeUserState(userId, state);
}

export async function submitVerificationApplication(
  userId: string,
  input: {
    program: "haiti_farmer" | "earth_university";
    fullName: string;
    email: string;
    country: string;
    institution?: string;
    studentId?: string;
    message?: string;
  }
) {
  return { userId, ...input, status: "pending" as const };
}

/** @deprecated use fetchLicensingBundleFromServer */
export async function fetchBillingBundle(userId: string): Promise<LicensingBundle> {
  return fetchLicensingBundleFromServer(userId);
}

export {
  buildLicensingBundle,
  defaultLicense,
  defaultVerification,
  resolveUsageLimits,
} from "./resolver";

export { normalizeLicenseType, DEFAULT_AI_PLANS };
