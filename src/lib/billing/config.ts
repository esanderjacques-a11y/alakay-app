import type { BillingConfig, LicenseType } from "./types";

export const BILLING_CONFIG_STORAGE_KEY = "cultosol_billing_config";

export const DEFAULT_BILLING_CONFIG: BillingConfig = {
  softwarePricesCents: {
    plus: 1500,
    pro: 3000,
  },
  aiStandardPriceCents: 1000,
  aiMonthlyLimit: 500,
  freeAiTrial: 3,
  licenseIncludedAi: {
    free: 3,
    plus: 20,
    pro: 50,
  },
  lifetimeDiscountPercent: 0,
  promotions: [],
  verificationProgramsEnabled: true,
};

export function mergeBillingConfig(partial: Partial<BillingConfig>): BillingConfig {
  return {
    ...DEFAULT_BILLING_CONFIG,
    ...partial,
    softwarePricesCents: {
      ...DEFAULT_BILLING_CONFIG.softwarePricesCents,
      ...partial.softwarePricesCents,
    },
    licenseIncludedAi: {
      ...DEFAULT_BILLING_CONFIG.licenseIncludedAi,
      ...partial.licenseIncludedAi,
    },
    promotions: partial.promotions ?? DEFAULT_BILLING_CONFIG.promotions,
  };
}

export function getBillingConfig(): BillingConfig {
  if (typeof window === "undefined") return DEFAULT_BILLING_CONFIG;
  try {
    const raw = window.localStorage.getItem(BILLING_CONFIG_STORAGE_KEY);
    if (!raw) return DEFAULT_BILLING_CONFIG;
    return mergeBillingConfig(JSON.parse(raw) as Partial<BillingConfig>);
  } catch {
    return DEFAULT_BILLING_CONFIG;
  }
}

export function saveBillingConfig(config: BillingConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(BILLING_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function softwarePriceCents(
  licenseType: Exclude<LicenseType, "free">,
  config: BillingConfig = DEFAULT_BILLING_CONFIG
) {
  const base = config.softwarePricesCents[licenseType];
  const discount = config.lifetimeDiscountPercent;
  if (discount <= 0) return base;
  return Math.round(base * (1 - discount / 100));
}

export function formatUsd(cents: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
