"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowUpRight,
  BadgeCheck,
  Bot,
  Check,
  CreditCard,
  Download,
  FileText,
  KeyRound,
  Settings2,
  Sparkles,
  Star,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import AppModal from "@/components/AppModal";
import BackButton from "@/components/ui/BackButton";
import {
  COMPARISON_ROWS,
  LICENSE_DEFINITIONS,
  LICENSE_ORDER,
  canUpgradeLicense,
  formatUsd,
  getBillingConfig,
  getLocalBillingBundle,
  licenseIncludesFeature,
  readUserState,
  resolveLicenseLabel,
  softwarePriceCents,
  syncLicenseToSettings,
  usagePercent,
  writeUserState,
  type LicenseType,
  type LicensingBundle,
} from "@/lib/billing";
import { getBillingText } from "@/lib/i18n/billingText";
import type { Language } from "@/lib/i18n";

type TabId = "overview" | "licenses" | "ai" | "compare" | "payments" | "invoices";

type Props = {
  language: Language;
  session: Session | null;
  guestMode: boolean;
  isAdmin?: boolean;
  onBack: () => void;
  onOpenVerification: () => void;
  onOpenAdmin?: () => void;
};

const FREE_LIST = [
  "Soil, foliar & water interpretation",
  "Manual lab input & CIC / bases",
  "Nutritional plan & basic PDF",
  "General crop ranges · Mehlich · Olsen",
  "1 farm · 3 lab reports",
  "Very limited AI trial",
];

const PLUS_EXTRA = [
  "Unlimited farms & reports",
  "Fertilizer & amendment recommendations",
  "Cost calculation & application calendar",
  "Crop-specific ranges, graphs, DOP",
  "Salinity & absorption curves",
  "Data export · Priority updates",
  "20 AI questions / month included",
];

const PRO_EXTRA = [
  "Multi-client & farm portfolio",
  "Historical comparisons",
  "Advanced analytics & inventory",
  "White-label & advanced report builder",
  "Recommendation templates · Team ready",
  "Early access · Priority support",
  "50 AI questions / month included",
];

const AI_FEATURES = [
  "Unlimited AI (fair use)",
  "Agronomic assistant",
  "Lab explanation & recommendation analysis",
  "Fertilizer guidance & follow-ups",
  "Context awareness · Faster responses",
];

export default function BillingScreen({
  language,
  session,
  guestMode,
  isAdmin = false,
  onBack,
  onOpenVerification,
  onOpenAdmin,
}: Props) {
  const t = getBillingText(language);
  const userId = session?.user?.id ?? "guest";
  const [tab, setTab] = useState<TabId>("overview");
  const [bundle, setBundle] = useState<LicensingBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkout, setCheckout] = useState<{
    kind: "license" | "ai";
    target?: LicenseType;
    planId?: string;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const config = getBillingConfig();
    try {
      if (!session?.user || guestMode) {
        setBundle(getLocalBillingBundle(userId));
        return;
      }
      const response = await fetch(
        `/api/billing?userId=${encodeURIComponent(session.user.id)}`
      );
      const payload = (await response.json()) as LicensingBundle & { error?: string };
      if (!response.ok) {
        setBundle(getLocalBillingBundle(session.user.id));
        setError(payload.error || t.error);
        return;
      }
      writeUserState(session.user.id, readUserState(session.user.id));
      setBundle({ ...payload, config: payload.config ?? config });
      syncLicenseToSettings(payload.license.licenseType);
    } catch {
      setBundle(getLocalBillingBundle(userId));
      setError(t.error);
    } finally {
      setLoading(false);
    }
  }, [guestMode, session?.user, t.error, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function confirmCheckout() {
    if (!session?.user || guestMode || !checkout) return;
    setBusy(true);
    try {
      const url =
        checkout.kind === "license"
          ? "/api/billing/license"
          : "/api/billing/ai";
      const body =
        checkout.kind === "license"
          ? { userId: session.user.id, licenseType: checkout.target }
          : { userId: session.user.id, action: "subscribe", planId: checkout.planId ?? "standard" };
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as LicensingBundle & { error?: string };
      if (!response.ok) {
        setError(payload.error || t.error);
        return;
      }
      setBundle(payload);
      syncLicenseToSettings(payload.license.licenseType);
      setCheckout(null);
    } catch {
      setError(t.error);
    } finally {
      setBusy(false);
    }
  }

  async function aiAction(action: "cancel" | "resume") {
    if (!session?.user || guestMode) return;
    setBusy(true);
    try {
      const response = await fetch("/api/billing/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: session.user.id, action }),
      });
      const payload = (await response.json()) as LicensingBundle;
      setBundle(payload);
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: TabId; label: string; icon: LucideIcon }[] = [
    { id: "overview", label: t.tabs.overview, icon: CreditCard },
    { id: "licenses", label: t.tabs.licenses, icon: KeyRound },
    { id: "ai", label: t.tabs.ai, icon: Bot },
    { id: "compare", label: t.tabs.compare, icon: Sparkles },
    { id: "payments", label: t.tabs.payments, icon: Wallet },
    { id: "invoices", label: t.tabs.invoices, icon: FileText },
  ];

  const licenseLabel = bundle
    ? resolveLicenseLabel(bundle.license.licenseType, bundle.verification)
    : "";

  return (
    <section className="billing-screen animate-slide-up">
      <div className="billing-screen__inner">
        <header className="billing-page-header">
          <div className="page-title-row">
            <BackButton variant="icon" onClick={onBack} label={t.tabs.overview} />
            <div className="page-title-row__title flex min-w-0 items-center gap-2">
              <CreditCard size={18} className="billing-page-icon shrink-0" aria-hidden />
              <h1 className="billing-page-title truncate">{t.title}</h1>
            </div>
            {isAdmin && onOpenAdmin ? (
              <button
                type="button"
                className="billing-page-admin-btn touch-target"
                onClick={onOpenAdmin}
                aria-label={t.adminTitle}
                title={t.adminTitle}
              >
                <Settings2 size={17} aria-hidden />
              </button>
            ) : (
              <span className="page-title-row__spacer" aria-hidden />
            )}
          </div>
          <p className="billing-page-intro">{t.intro}</p>
        </header>

        <div className="billing-layout">
          <nav className="billing-nav" aria-label={t.title}>
            {tabs.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`billing-nav__item ${tab === item.id ? "is-active" : ""}`}
                  onClick={() => setTab(item.id)}
                >
                  <Icon size={16} aria-hidden />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="billing-main">
            {(guestMode || !session?.user) && (
              <div className="billing-empty">
                <p className="billing-empty__title">{t.guestNotice}</p>
              </div>
            )}

            {error ? <p className="billing-banner billing-banner--error">{error}</p> : null}

            {loading ? (
              <p className="billing-note">{t.loading}</p>
            ) : bundle ? (
              <>
                {tab === "overview" && (
                  <OverviewPanel
                    bundle={bundle}
                    t={t}
                    licenseLabel={licenseLabel}
                    onUpgrade={() => setTab("licenses")}
                    onManageAi={() => setTab("ai")}
                    onVerification={onOpenVerification}
                  />
                )}
                {tab === "licenses" && (
                  <LicenseCarousel
                    bundle={bundle}
                    t={t}
                    onPurchase={(target) => setCheckout({ kind: "license", target })}
                  />
                )}
                {tab === "ai" && (
                  <AiPanel
                    bundle={bundle}
                    t={t}
                    busy={busy}
                    onSubscribe={() => setCheckout({ kind: "ai", planId: "standard" })}
                    onCancel={() => void aiAction("cancel")}
                    onResume={() => void aiAction("resume")}
                  />
                )}
                {tab === "compare" && <ComparePanel t={t} bundle={bundle} />}
                {tab === "payments" && <PaymentsPanel t={t} bundle={bundle} />}
                {tab === "invoices" && <InvoicesPanel t={t} bundle={bundle} />}
              </>
            ) : null}
          </div>
        </div>
      </div>

      <AppModal
        open={checkout !== null}
        onClose={() => setCheckout(null)}
        title={checkout?.kind === "license" ? t.purchaseLifetime : t.subscribe}
      >
        <p className="billing-note">{t.checkoutMock}</p>
        <button
          type="button"
          className="billing-btn billing-btn--primary billing-btn--block"
          disabled={busy}
          onClick={() => void confirmCheckout()}
        >
          {t.checkoutSuccess}
        </button>
      </AppModal>
    </section>
  );
}

function OverviewPanel({
  bundle,
  t,
  licenseLabel,
  onUpgrade,
  onManageAi,
  onVerification,
}: {
  bundle: LicensingBundle;
  t: ReturnType<typeof getBillingText>;
  licenseLabel: string;
  onUpgrade: () => void;
  onManageAi: () => void;
  onVerification: () => void;
}) {
  const { license, aiSubscription, aiUsage } = bundle;
  const aiActive = aiSubscription.status === "active";
  const remaining = Math.max(0, aiUsage.questionsLimit - aiUsage.questionsUsed);

  return (
    <div className="billing-stack">
      <div className="billing-dual-cards">
        <article className="billing-card billing-card--summary">
          <header className="billing-card__header">
            <p className="billing-kicker">
              <KeyRound size={13} aria-hidden /> {t.softwareLicense}
            </p>
            <h2 className="billing-plan-name">{licenseLabel}</h2>
            {bundle.verification.badgeLabel ? (
              <span className="billing-badge">
                <BadgeCheck size={13} aria-hidden />
                {bundle.verification.badgeLabel}
              </span>
            ) : null}
          </header>
          <dl className="billing-detail-list">
            <div className="billing-detail-list__row">
              <dt>{t.purchaseDate}</dt>
              <dd>
                {license.purchasedAt
                  ? new Date(license.purchasedAt).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="billing-detail-list__row">
              <dt>{t.licenseStatus}</dt>
              <dd>{license.status === "active" ? t.active : license.status}</dd>
            </div>
            <div className="billing-detail-list__row">
              <dt>{t.lifetime}</dt>
              <dd>{license.licenseType === "free" ? "—" : t.active}</dd>
            </div>
            <div className="billing-detail-list__row">
              <dt>{t.currentLicense}</dt>
              <dd>{LICENSE_DEFINITIONS[license.licenseType].name}</dd>
            </div>
          </dl>
          {canUpgradeLicense(license.licenseType, "pro") ? (
            <footer className="billing-card__footer">
              <button type="button" className="billing-btn billing-btn--primary billing-btn--block" onClick={onUpgrade}>
                {t.upgradeLicense}
              </button>
            </footer>
          ) : null}
        </article>

        <article className="billing-card billing-card--summary">
          <header className="billing-card__header">
            <p className="billing-kicker">
              <Bot size={13} aria-hidden /> {t.aiSubscription}
            </p>
            <h2 className="billing-plan-name">
              {aiActive ? t.active : aiSubscription.status === "cancelled" ? t.cancelled : t.none}
            </h2>
          </header>
          <dl className="billing-detail-list">
            <div className="billing-detail-list__row">
              <dt>{t.monthlyCost}</dt>
              <dd>
                {aiActive
                  ? formatUsd(bundle.config.aiStandardPriceCents) + "/mo"
                  : "—"}
              </dd>
            </div>
            <div className="billing-detail-list__row">
              <dt>{t.renewalDate}</dt>
              <dd>
                {aiSubscription.renewalDate
                  ? new Date(aiSubscription.renewalDate).toLocaleDateString()
                  : "—"}
              </dd>
            </div>
            <div className="billing-detail-list__row">
              <dt>{t.remainingAi}</dt>
              <dd>{remaining}</dd>
            </div>
            <div className="billing-detail-list__row">
              <dt>{t.monthlyUsage}</dt>
              <dd>
                {aiUsage.questionsUsed} / {aiUsage.questionsLimit}
              </dd>
            </div>
          </dl>
          <footer className="billing-card__footer">
            <button type="button" className="billing-btn billing-btn--ghost billing-btn--block" onClick={onManageAi}>
              {t.manageAi}
            </button>
          </footer>
        </article>
      </div>

      {bundle.notifications.length > 0 ? (
        <section className="billing-card">
          <h3 className="billing-section-title">{t.notifications}</h3>
          <ul className="billing-notify-list">
            {bundle.notifications.slice(0, 5).map((n) => (
              <li key={n.id}>
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <button type="button" className="billing-card billing-card--link" onClick={onVerification}>
        <div className="billing-card__header billing-card__header--inline">
          <p className="billing-kicker">{t.verificationTitle}</p>
          <p className="billing-note">Haiti Farmer · EARTH University</p>
        </div>
        <ArrowUpRight size={16} aria-hidden />
      </button>
    </div>
  );
}

function LicenseCarousel({
  bundle,
  t,
  onPurchase,
}: {
  bundle: LicensingBundle;
  t: ReturnType<typeof getBillingText>;
  onPurchase: (target: LicenseType) => void;
}) {
  return (
    <div className="billing-h-scroll-wrap">
      <div className="billing-h-scroll" role="list">
        {LICENSE_ORDER.map((id) => {
          const def = LICENSE_DEFINITIONS[id];
          const copy = t.licenses[id];
          const isCurrent = bundle.license.licenseType === id;
          const isPopular = def.popular;
          const priceCents =
            id === "plus"
              ? softwarePriceCents("plus", bundle.config)
              : id === "pro"
                ? softwarePriceCents("pro", bundle.config)
                : 0;
          const features =
            id === "free" ? FREE_LIST : id === "plus" ? PLUS_EXTRA : PRO_EXTRA;
          const intro =
            id === "plus" ? t.everythingInFree : id === "pro" ? t.everythingInPlus : null;

          return (
            <article
              key={id}
              role="listitem"
              className={`billing-price-card billing-h-scroll__item ${isPopular ? "billing-price-card--popular" : ""}`}
            >
              {isPopular ? (
                <span className="billing-price-card__badge">
                  <Star size={12} aria-hidden />
                  {t.mostPopular}
                </span>
              ) : null}
              <h3 className="billing-price-card__name">{copy.name}</h3>
              <p className="billing-price-card__subtitle">{copy.subtitle}</p>
              <p className="billing-price-card__price">
                {id === "free" ? copy.price : formatUsd(priceCents)}
              </p>
              {id !== "free" ? (
                <p className="billing-price-card__intro">{t.oneTimePurchase} · {t.lifetime}</p>
              ) : null}
              {intro ? <p className="billing-price-card__intro">{intro}</p> : null}
              <ul className="billing-feature-list">
                {features.map((line) => (
                  <li key={line}>
                    <Check size={14} aria-hidden />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className={`billing-btn ${isPopular ? "billing-btn--primary" : "billing-btn--ghost"} billing-btn--block`}
                disabled={isCurrent || id === "free"}
                onClick={() => onPurchase(id)}
              >
                {isCurrent ? t.currentPlan : id === "free" ? t.currentPlan : t.purchaseLifetime}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function AiPanel({
  bundle,
  t,
  busy,
  onSubscribe,
  onCancel,
  onResume,
}: {
  bundle: LicensingBundle;
  t: ReturnType<typeof getBillingText>;
  busy: boolean;
  onSubscribe: () => void;
  onCancel: () => void;
  onResume: () => void;
}) {
  const { aiUsage, aiSubscription, config } = bundle;
  const remaining = Math.max(0, aiUsage.questionsLimit - aiUsage.questionsUsed);
  const pct = usagePercent(aiUsage.questionsUsed, aiUsage.questionsLimit);

  return (
    <div className="billing-stack">
      <section className="billing-card">
        <header className="billing-card__header">
          <h3 className="billing-section-title">{t.aiSectionTitle}</h3>
          <p className="billing-note">{t.aiSectionDesc}</p>
        </header>
        <p className="billing-price-highlight">
          {formatUsd(config.aiStandardPriceCents)}
          <span className="billing-price-highlight__suffix">/ month</span>
        </p>
        <p className="billing-note billing-note--compact">{t.aiFairUseNote}</p>
        <ul className="billing-feature-list billing-feature-list--compact">
          {AI_FEATURES.map((line) => (
            <li key={line}>
              <Check size={13} aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <div className="billing-action-row billing-action-row--start">
          {aiSubscription.status === "active" ? (
            <button type="button" className="billing-btn billing-btn--danger" disabled={busy} onClick={onCancel}>
              {t.cancelAi}
            </button>
          ) : (
            <button type="button" className="billing-btn billing-btn--primary" disabled={busy} onClick={onSubscribe}>
              {t.subscribe}
            </button>
          )}
          {aiSubscription.status === "cancelled" ? (
            <button type="button" className="billing-btn billing-btn--ghost" disabled={busy} onClick={onResume}>
              {t.resumeAi}
            </button>
          ) : null}
        </div>
      </section>

      <section className="billing-card">
        <h3 className="billing-section-title">{t.monthlyUsage}</h3>
        <div className="billing-usage-grid">
          <div className="billing-usage-card">
            <span className="billing-usage-card__label">{t.questionsUsed}</span>
            <strong className="billing-usage-card__value">{aiUsage.questionsUsed}</strong>
          </div>
          <div className="billing-usage-card">
            <span className="billing-usage-card__label">{t.questionsRemaining}</span>
            <strong className="billing-usage-card__value">{remaining}</strong>
          </div>
          <div className="billing-usage-card">
            <span className="billing-usage-card__label">{t.resetDate}</span>
            <strong className="billing-usage-card__value billing-usage-card__value--date">
              {new Date(aiUsage.resetDate).toLocaleDateString()}
            </strong>
          </div>
        </div>
        <div className="billing-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span className="billing-progress__bar" style={{ width: `${pct}%` }} />
        </div>
        {bundle.aiLimitReached ? (
          <div className="billing-empty billing-empty--compact">
            <Sparkles size={20} aria-hidden />
            <p className="billing-empty__title">{t.aiLimitReached}</p>
            <div className="billing-action-row">
              <button type="button" className="billing-btn billing-btn--primary" onClick={onSubscribe}>
                {t.upgradeAi}
              </button>
              <button type="button" className="billing-btn billing-btn--ghost">
                {t.waitUntilReset}
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ComparePanel({
  t,
  bundle,
}: {
  t: ReturnType<typeof getBillingText>;
  bundle: LicensingBundle;
}) {
  const includedAi = bundle.config.licenseIncludedAi;
  return (
    <section className="billing-card billing-card--flush">
      <h3 className="billing-section-title">{t.featureComparison}</h3>
      <div className="billing-compare-scroll">
        <table className="billing-compare-table">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              {LICENSE_ORDER.map((id) => (
                <th key={id} scope="col">
                  {t.licenses[id].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.key}>
                <th scope="row">{t.features[row.key] || row.label}</th>
                {LICENSE_ORDER.map((id) => (
                  <td key={id}>
                    {licenseIncludesFeature(id, row.key) ? (
                      <Check size={16} className="billing-check" aria-label="Yes" />
                    ) : (
                      <X size={16} className="billing-x" aria-label="No" />
                    )}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row">{t.aiIncluded}</th>
              {LICENSE_ORDER.map((id) => (
                <td key={id}>{includedAi[id]}/mo</td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PaymentsPanel({
  t,
  bundle,
}: {
  t: ReturnType<typeof getBillingText>;
  bundle: LicensingBundle;
}) {
  if (bundle.payments.length === 0) {
    return (
      <div className="billing-stack">
        <div className="billing-empty">
          <CreditCard size={22} aria-hidden />
          <p className="billing-empty__title">{t.emptyPayments}</p>
          <p className="billing-empty__desc">{t.emptyPaymentsDesc}</p>
        </div>
        <p className="billing-note">{t.paymentProvidersNote}</p>
        <div className="billing-provider-row">
          {["Paddle", "PayPal", "2Checkout"].map((p) => (
            <span key={p} className="billing-badge">
              {p}
            </span>
          ))}
        </div>
      </div>
    );
  }
  return (
    <ul className="billing-payment-list">
      {bundle.payments.map((p) => (
        <li key={p.id} className="billing-payment-item">
          <span>{p.label}</span>
        </li>
      ))}
    </ul>
  );
}

function InvoicesPanel({
  t,
  bundle,
}: {
  t: ReturnType<typeof getBillingText>;
  bundle: LicensingBundle;
}) {
  if (bundle.invoices.length === 0) {
    return (
      <div className="billing-empty">
        <Download size={22} aria-hidden />
        <p className="billing-empty__title">{t.emptyInvoices}</p>
        <p className="billing-empty__desc">{t.emptyInvoicesDesc}</p>
      </div>
    );
  }
  return (
    <section className="billing-card billing-card--flush">
      <h3 className="billing-section-title">{t.invoiceHistory}</h3>
      <div className="billing-compare-scroll">
        <table className="billing-invoice-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Type</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {bundle.invoices.map((inv) => (
              <tr key={inv.id}>
                <td>{inv.invoiceNumber}</td>
                <td>{new Date(inv.issuedAt).toLocaleDateString()}</td>
                <td>{formatUsd(inv.amountCents)}</td>
                <td>{inv.kind}</td>
                <td>
                  <button type="button" className="billing-btn billing-btn--ghost">
                    {t.downloadInvoice}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
