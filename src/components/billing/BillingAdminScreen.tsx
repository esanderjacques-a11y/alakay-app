"use client";

import { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import {
  DEFAULT_BILLING_CONFIG,
  getBillingConfig,
  mergeBillingConfig,
  saveBillingConfig,
  type BillingConfig,
} from "@/lib/billing";
import { getBillingText } from "@/lib/i18n/billingText";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  adminEmail: string;
  onBack: () => void;
};

export default function BillingAdminScreen({ language, adminEmail, onBack }: Props) {
  const t = getBillingText(language);
  const a = t.admin;
  const [config, setConfig] = useState<BillingConfig>(DEFAULT_BILLING_CONFIG);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setConfig(getBillingConfig());
    void fetch("/api/billing/config")
      .then((r) => r.json())
      .then((remote) => setConfig(mergeBillingConfig(remote as Partial<BillingConfig>)))
      .catch(() => setConfig(getBillingConfig()));
  }, []);

  async function save() {
    setBusy(true);
    setMessage("");
    saveBillingConfig(config);
    try {
      const response = await fetch("/api/billing/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, config }),
      });
      if (!response.ok) {
        setMessage(t.error);
        return;
      }
      setMessage(a.saved);
    } catch {
      setMessage(t.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="billing-screen animate-slide-up">
      <div className="billing-screen__inner">
        <header className="billing-page-header">
          <div className="page-title-row">
            <BackButton variant="icon" onClick={onBack} label={t.title} />
            <div className="page-title-row__title flex min-w-0 items-center gap-2">
              <Settings2 size={18} className="billing-page-icon shrink-0" aria-hidden />
              <h1 className="billing-page-title truncate">{t.adminTitle}</h1>
            </div>
            <span className="page-title-row__spacer" aria-hidden />
          </div>
        </header>

        <div className="billing-form billing-card">
          <label className="billing-field">
            <span>{a.softwarePrices} — Plus</span>
            <input
              type="number"
              value={config.softwarePricesCents.plus}
              onChange={(e) =>
                setConfig({
                  ...config,
                  softwarePricesCents: {
                    ...config.softwarePricesCents,
                    plus: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.softwarePrices} — Pro</span>
            <input
              type="number"
              value={config.softwarePricesCents.pro}
              onChange={(e) =>
                setConfig({
                  ...config,
                  softwarePricesCents: {
                    ...config.softwarePricesCents,
                    pro: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.aiPrice}</span>
            <input
              type="number"
              value={config.aiStandardPriceCents}
              onChange={(e) =>
                setConfig({ ...config, aiStandardPriceCents: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.aiMonthlyLimit}</span>
            <input
              type="number"
              value={config.aiMonthlyLimit}
              onChange={(e) =>
                setConfig({ ...config, aiMonthlyLimit: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.freeAiTrial}</span>
            <input
              type="number"
              value={config.freeAiTrial}
              onChange={(e) =>
                setConfig({ ...config, freeAiTrial: Number(e.target.value) || 0 })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.lifetimeDiscount}</span>
            <input
              type="number"
              value={config.lifetimeDiscountPercent}
              onChange={(e) =>
                setConfig({
                  ...config,
                  lifetimeDiscountPercent: Number(e.target.value) || 0,
                })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.freeIncludedAi}</span>
            <input
              type="number"
              value={config.licenseIncludedAi.free}
              onChange={(e) =>
                setConfig({
                  ...config,
                  licenseIncludedAi: {
                    ...config.licenseIncludedAi,
                    free: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.plusIncludedAi}</span>
            <input
              type="number"
              value={config.licenseIncludedAi.plus}
              onChange={(e) =>
                setConfig({
                  ...config,
                  licenseIncludedAi: {
                    ...config.licenseIncludedAi,
                    plus: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </label>
          <label className="billing-field">
            <span>{a.proIncludedAi}</span>
            <input
              type="number"
              value={config.licenseIncludedAi.pro}
              onChange={(e) =>
                setConfig({
                  ...config,
                  licenseIncludedAi: {
                    ...config.licenseIncludedAi,
                    pro: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </label>
          <label className="billing-field">
            <span>Verification programs enabled</span>
            <input
              type="checkbox"
              checked={config.verificationProgramsEnabled}
              onChange={(e) =>
                setConfig({ ...config, verificationProgramsEnabled: e.target.checked })
              }
            />
          </label>
          <button
            type="button"
            className="billing-btn billing-btn--primary"
            disabled={busy}
            onClick={() => void save()}
          >
            {a.save}
          </button>
          {message ? <p className="billing-note">{message}</p> : null}
        </div>
      </div>
    </section>
  );
}
