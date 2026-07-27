"use client";

import type { Session } from "@supabase/supabase-js";
import { CreditCard, Settings2 } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import { getBillingText } from "@/lib/i18n/billingText";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  session: Session | null;
  guestMode: boolean;
  isAdmin?: boolean;
  onBack: () => void;
  onOpenVerification: () => void;
  onOpenAdmin?: () => void;
};

export default function BillingScreen({
  language,
  isAdmin = false,
  onBack,
  onOpenAdmin,
}: Props) {
  const t = getBillingText(language);

  return (
    <section className="billing-screen animate-slide-up">
      <div className="billing-screen__inner">
        <header className="billing-page-header">
          <div className="page-title-row">
            <BackButton variant="icon" onClick={onBack} label={t.title} />
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
        </header>

        <div className="billing-coming-soon" role="status">
          <span className="billing-coming-soon__icon" aria-hidden>
            <CreditCard size={28} />
          </span>
          <p className="billing-coming-soon__badge">{t.comingSoon}</p>
          <h2 className="billing-coming-soon__title">{t.title}</h2>
          <p className="billing-coming-soon__desc">{t.comingSoonDesc}</p>
        </div>
      </div>
    </section>
  );
}
