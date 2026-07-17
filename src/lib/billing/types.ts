/** Lifetime software license tier — one-time purchase, no recurring fee. */
export type LicenseType = "free" | "plus" | "pro";

export type LicenseStatus = "active" | "revoked";

/** Extensible AI plan slug — supports future Basic / Pro / Enterprise tiers. */
export type AIPlanId = string;

export type AISubscriptionStatus =
  | "none"
  | "active"
  | "cancelled"
  | "past_due"
  | "expired";

export type PaymentProvider = "paddle" | "paypal" | "2checkout" | "mock";

export type InvoiceKind = "license" | "ai_subscription";

export type InvoiceStatus = "paid" | "open" | "void" | "draft";

export type BillingNotificationType =
  | "license_purchased"
  | "ai_activated"
  | "ai_expiring"
  | "ai_nearly_exhausted"
  | "ai_reset";

export type VerificationProgram = "haiti_farmer" | "earth_university";

export type VerificationStatus = "none" | "pending" | "approved" | "rejected";

export type License = {
  userId: string;
  licenseType: LicenseType;
  status: LicenseStatus;
  purchasedAt: string | null;
  purchasePriceCents: number | null;
  currency: string;
};

export type AIPlan = {
  id: AIPlanId;
  slug: string;
  name: string;
  description: string;
  priceMonthlyCents: number;
  /** Fair-use monthly cap when subscribed (admin-configurable default). */
  monthlyQuestionLimit: number;
  features: string[];
  active: boolean;
  sortOrder: number;
};

export type AISubscription = {
  userId: string;
  planId: AIPlanId | null;
  status: AISubscriptionStatus;
  priceMonthlyCents: number;
  renewalDate: string | null;
  cancelledAt: string | null;
};

export type AIUsage = {
  userId: string;
  periodStart: string;
  periodEnd: string;
  questionsUsed: number;
  /** Included from license + optional subscription fair-use cap. */
  questionsLimit: number;
  resetDate: string;
};

export type Invoice = {
  id: string;
  kind: InvoiceKind;
  invoiceNumber: string;
  amountCents: number;
  currency: string;
  status: InvoiceStatus;
  issuedAt: string;
  downloadUrl?: string | null;
};

export type Payment = {
  id: string;
  provider: PaymentProvider;
  label: string;
  last4?: string;
  isDefault: boolean;
  createdAt: string;
};

export type UsageSnapshot = {
  farms: number;
  labReports: number;
  storageMb: number;
};

export type UsageLimits = {
  farms: number | null;
  labReports: number | null;
  storageMb: number | null;
};

export type BillingPromotion = {
  id: string;
  label: string;
  discountPercent: number;
  appliesTo: "license" | "ai" | "both";
  active: boolean;
};

/** Admin-editable pricing & limits — no code changes required. */
export type BillingConfig = {
  softwarePricesCents: Record<Exclude<LicenseType, "free">, number>;
  aiStandardPriceCents: number;
  /** Fair-use cap for active AI subscription (not truly unlimited). */
  aiMonthlyLimit: number;
  freeAiTrial: number;
  licenseIncludedAi: Record<LicenseType, number>;
  lifetimeDiscountPercent: number;
  promotions: BillingPromotion[];
  verificationProgramsEnabled: boolean;
};

export type BillingNotification = {
  id: string;
  type: BillingNotificationType;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
};

export type VerificationRecord = {
  program: VerificationProgram | null;
  status: VerificationStatus;
  badgeLabel: string | null;
  appliedAt: string | null;
  reviewedAt: string | null;
  notes: string | null;
};

export type LicensingBundle = {
  configured: boolean;
  license: License;
  aiSubscription: AISubscription;
  aiUsage: AIUsage;
  aiPlans: AIPlan[];
  config: BillingConfig;
  usage: UsageSnapshot;
  limits: UsageLimits;
  verification: VerificationRecord;
  payments: Payment[];
  invoices: Invoice[];
  notifications: BillingNotification[];
  /** Can open Jacko / AI assistant right now. */
  hasAiAccess: boolean;
  /** Included allowance exhausted but software still works. */
  aiLimitReached: boolean;
};

export type VerificationApplicationInput = {
  program: VerificationProgram;
  fullName: string;
  email: string;
  country: string;
  institution?: string;
  studentId?: string;
  message?: string;
};
