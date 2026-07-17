import { DEFAULT_AI_PLANS, findAiPlan } from "./aiPlans";
import {
  DEFAULT_BILLING_CONFIG,
  formatUsd,
  softwarePriceCents,
} from "./config";
import {
  buildLicensingBundle,
  defaultAiUsage,
  makeNotification,
  resolveAiQuestionLimit,
} from "./resolver";
import type {
  BillingConfig,
  BillingNotification,
  Invoice,
  LicenseType,
  LicensingBundle,
  Payment,
} from "./types";

const USER_STATE_KEY = "cultosol_licensing_state";
const memoryStates = new Map<string, PersistedUserState>();

export type PersistedUserState = {
  licenseType: LicenseType;
  licensePurchasedAt: string | null;
  licensePriceCents: number | null;
  aiPlanId: string | null;
  aiStatus: LicensingBundle["aiSubscription"]["status"];
  aiRenewalDate: string | null;
  aiCancelledAt: string | null;
  aiQuestionsUsed: number;
  payments: Payment[];
  invoices: Invoice[];
  notifications: BillingNotification[];
};

function defaultUserState(): PersistedUserState {
  return {
    licenseType: "free",
    licensePurchasedAt: null,
    licensePriceCents: null,
    aiPlanId: null,
    aiStatus: "none",
    aiRenewalDate: null,
    aiCancelledAt: null,
    aiQuestionsUsed: 0,
    payments: [],
    invoices: [],
    notifications: [],
  };
}

export function readUserState(userId: string): PersistedUserState {
  if (memoryStates.has(userId)) {
    return { ...defaultUserState(), ...memoryStates.get(userId)! };
  }
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(`${USER_STATE_KEY}:${userId}`);
      if (raw) {
        const parsed = { ...defaultUserState(), ...(JSON.parse(raw) as PersistedUserState) };
        memoryStates.set(userId, parsed);
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return defaultUserState();
}

export function writeUserState(userId: string, state: PersistedUserState) {
  memoryStates.set(userId, state);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(`${USER_STATE_KEY}:${userId}`, JSON.stringify(state));
  }
}

export function stateToBundle(
  userId: string,
  state: PersistedUserState,
  config: BillingConfig = DEFAULT_BILLING_CONFIG
): LicensingBundle {
  const hasActiveAiSub = state.aiStatus === "active";
  const limit = resolveAiQuestionLimit(state.licenseType, hasActiveAiSub, config);

  return buildLicensingBundle({
    configured: true,
    config,
    license: {
      userId,
      licenseType: state.licenseType,
      status: "active",
      purchasedAt: state.licensePurchasedAt,
      purchasePriceCents: state.licensePriceCents,
      currency: "USD",
    },
    aiSubscription: {
      userId,
      planId: state.aiPlanId,
      status: state.aiStatus,
      priceMonthlyCents: config.aiStandardPriceCents,
      renewalDate: state.aiRenewalDate,
      cancelledAt: state.aiCancelledAt,
    },
    aiUsage: {
      ...defaultAiUsage(userId, limit),
      questionsUsed: state.aiQuestionsUsed,
      questionsLimit: limit,
    },
    aiPlans: DEFAULT_AI_PLANS.map((p) => ({
      ...p,
      priceMonthlyCents: config.aiStandardPriceCents,
      monthlyQuestionLimit: config.aiMonthlyLimit,
    })),
    payments: state.payments,
    invoices: state.invoices,
    notifications: state.notifications,
  });
}

export function getLocalLicensingBundle(
  userId: string,
  config: BillingConfig = DEFAULT_BILLING_CONFIG
): LicensingBundle {
  return stateToBundle(userId, readUserState(userId), config);
}

function nextInvoiceNumber(invoices: Invoice[]) {
  return `INV-${String(invoices.length + 1).padStart(5, "0")}`;
}

export function mockPurchaseLicense(
  userId: string,
  target: LicenseType,
  config: BillingConfig = DEFAULT_BILLING_CONFIG
): LicensingBundle {
  const state = readUserState(userId);
  const now = new Date().toISOString();
  let priceCents = 0;
  if (target === "plus") priceCents = softwarePriceCents("plus", config);
  if (target === "pro") priceCents = softwarePriceCents("pro", config);

  state.licenseType = target;
  state.licensePurchasedAt = now;
  state.licensePriceCents = priceCents;

  state.invoices = [
    {
      id: `inv_${Date.now()}`,
      kind: "license",
      invoiceNumber: nextInvoiceNumber(state.invoices),
      amountCents: priceCents,
      currency: "USD",
      status: "paid",
      issuedAt: now,
    },
    ...state.invoices,
  ];
  state.notifications = [
    makeNotification(
      "license_purchased",
      "License activated",
      `Your ${target.toUpperCase()} lifetime license is now active (${formatUsd(priceCents)}).`
    ),
    ...state.notifications,
  ].slice(0, 20);

  writeUserState(userId, state);
  return stateToBundle(userId, state, config);
}

export function mockSubscribeAi(
  userId: string,
  planId: string,
  config: BillingConfig = DEFAULT_BILLING_CONFIG
): LicensingBundle {
  const state = readUserState(userId);
  const plan = findAiPlan(planId);
  const now = new Date();
  const renewal = new Date(now);
  renewal.setMonth(renewal.getMonth() + 1);

  state.aiPlanId = plan?.id ?? "standard";
  state.aiStatus = "active";
  state.aiRenewalDate = renewal.toISOString();
  state.aiCancelledAt = null;

  state.invoices = [
    {
      id: `inv_${Date.now()}`,
      kind: "ai_subscription",
      invoiceNumber: nextInvoiceNumber(state.invoices),
      amountCents: config.aiStandardPriceCents,
      currency: "USD",
      status: "paid",
      issuedAt: now.toISOString(),
    },
    ...state.invoices,
  ];
  state.notifications = [
    makeNotification(
      "ai_activated",
      "AI subscription active",
      `AI Assistant subscribed at ${formatUsd(config.aiStandardPriceCents)}/month.`
    ),
    ...state.notifications,
  ].slice(0, 20);

  writeUserState(userId, state);
  return stateToBundle(userId, state, config);
}

export function mockCancelAi(
  userId: string,
  config: BillingConfig = DEFAULT_BILLING_CONFIG
): LicensingBundle {
  const state = readUserState(userId);
  state.aiStatus = "cancelled";
  state.aiCancelledAt = new Date().toISOString();
  writeUserState(userId, state);
  return stateToBundle(userId, state, config);
}

export function mockRecordAiQuestion(
  userId: string,
  config: BillingConfig = DEFAULT_BILLING_CONFIG
): { bundle: LicensingBundle; allowed: boolean } {
  const state = readUserState(userId);
  const bundle = stateToBundle(userId, state, config);
  if (bundle.aiLimitReached) return { bundle, allowed: false };

  state.aiQuestionsUsed += 1;
  const remaining = bundle.aiUsage.questionsLimit - state.aiQuestionsUsed;
  if (remaining <= 3 && remaining > 0) {
    state.notifications = [
      makeNotification(
        "ai_nearly_exhausted",
        "AI usage nearly exhausted",
        `${remaining} AI questions remaining this month.`
      ),
      ...state.notifications,
    ].slice(0, 20);
  }
  writeUserState(userId, state);
  return { bundle: stateToBundle(userId, state, config), allowed: true };
}

export function syncLicenseToSettings(licenseType: LicenseType) {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem("cultosol_app_settings");
    if (!raw) return;
    const settings = JSON.parse(raw) as { billing?: { planTier?: string } };
    if (!settings.billing) settings.billing = { planTier: "free" };
    settings.billing.planTier = licenseType;
    window.localStorage.setItem("cultosol_app_settings", JSON.stringify(settings));
  } catch {
    // ignore
  }
}
