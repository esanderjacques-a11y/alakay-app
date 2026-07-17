"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { BadgeCheck, GraduationCap, ShieldCheck } from "lucide-react";
import AppModal from "@/components/AppModal";
import BackButton from "@/components/ui/BackButton";
import type { VerificationRecord } from "@/lib/billing";
import { getBillingText } from "@/lib/i18n/billingText";
import type { Language } from "@/lib/i18n";

type Props = {
  language: Language;
  session: Session | null;
  guestMode: boolean;
  displayName: string;
  email: string;
  country?: string;
  onBack: () => void;
};

type Program = "haiti_farmer" | "earth_university";

export default function VerificationScreen({
  language,
  session,
  guestMode,
  displayName,
  email,
  country = "",
  onBack,
}: Props) {
  const t = getBillingText(language);
  const [verification, setVerification] = useState<VerificationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalProgram, setModalProgram] = useState<Program | null>(null);
  const [institution, setInstitution] = useState("EARTH University");
  const [studentId, setStudentId] = useState("");
  const [message, setMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!session?.user || guestMode) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(
        `/api/verification?userId=${encodeURIComponent(session.user.id)}`
      );
      const payload = (await response.json()) as { verification?: VerificationRecord };
      setVerification(payload.verification || null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [session?.user, guestMode]);

  async function submit(program: Program) {
    if (!session?.user || guestMode) return;
    setBusy(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session.user.id,
          program,
          fullName: displayName,
          email,
          country: country || "Haiti",
          institution: program === "earth_university" ? institution : undefined,
          studentId: program === "earth_university" ? studentId : undefined,
          message,
        }),
      });
      const payload = (await response.json()) as {
        verification?: VerificationRecord;
        error?: string;
      };
      if (!response.ok) {
        setStatusMessage(payload.error || t.error);
        return;
      }
      setVerification(payload.verification || null);
      setModalProgram(null);
      setMessage("");
      setStudentId("");
    } catch {
      setStatusMessage(t.error);
    } finally {
      setBusy(false);
    }
  }

  function programStatus(program: Program) {
    if (!verification || verification.program !== program) return "none";
    return verification.status;
  }

  function statusCopy(status: string) {
    if (status === "pending") return t.applicationPending;
    if (status === "approved") return t.applicationApproved;
    if (status === "rejected") return t.applicationRejected;
    return null;
  }

  return (
    <section className="billing-screen animate-slide-up">
      <div className="billing-screen__inner">
        <header className="billing-page-header">
          <div className="page-title-row">
            <BackButton variant="icon" onClick={onBack} label={t.title} />
            <div className="page-title-row__title flex min-w-0 items-center gap-2">
              <ShieldCheck size={18} className="billing-page-icon shrink-0" aria-hidden />
              <h1 className="billing-page-title truncate">{t.verificationTitle}</h1>
            </div>
            <span className="page-title-row__spacer" aria-hidden />
          </div>
        </header>

        {guestMode || !session?.user ? (
          <div className="billing-empty">
            <p className="billing-empty__title">{t.guestNotice}</p>
          </div>
        ) : loading ? (
          <p className="billing-note">{t.loading}</p>
        ) : (
          <div className="billing-verification-grid">
            <article className="billing-card billing-card--program">
              <div className="billing-card__head">
                <div>
                  <p className="billing-kicker">🇭🇹 {t.haitiProgram}</p>
                  <p className="billing-note">{t.haitiProgramDesc}</p>
                </div>
                <BadgeCheck size={22} className="text-emerald-600" aria-hidden />
              </div>
              <p className="billing-program-benefit">{t.haitiProgramBenefit}</p>
              {statusCopy(programStatus("haiti_farmer")) ? (
                <p className="billing-badge">{statusCopy(programStatus("haiti_farmer"))}</p>
              ) : (
                <button
                  type="button"
                  className="billing-btn billing-btn--primary"
                  onClick={() => setModalProgram("haiti_farmer")}
                >
                  {t.applyNow}
                </button>
              )}
            </article>

            <article className="billing-card billing-card--program">
              <div className="billing-card__head">
                <div>
                  <p className="billing-kicker">🎓 {t.earthProgram}</p>
                  <p className="billing-note">{t.earthProgramDesc}</p>
                </div>
                <GraduationCap size={22} className="text-emerald-600" aria-hidden />
              </div>
              <p className="billing-program-benefit">{t.earthProgramBenefit}</p>
              {statusCopy(programStatus("earth_university")) ? (
                <p className="billing-badge">{statusCopy(programStatus("earth_university"))}</p>
              ) : (
                <button
                  type="button"
                  className="billing-btn billing-btn--primary"
                  onClick={() => setModalProgram("earth_university")}
                >
                  {t.applyNow}
                </button>
              )}
            </article>
          </div>
        )}

        {statusMessage ? (
          <p className="billing-banner billing-banner--error">{statusMessage}</p>
        ) : null}
      </div>

      <AppModal
        open={modalProgram !== null}
        onClose={() => setModalProgram(null)}
        title={modalProgram === "earth_university" ? t.earthProgram : t.haitiProgram}
      >
        <form
          className="billing-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (modalProgram) void submit(modalProgram);
          }}
        >
          <label className="billing-field">
            <span>{t.fullName}</span>
            <input value={displayName} readOnly />
          </label>
          <label className="billing-field">
            <span>{t.email}</span>
            <input value={email} readOnly />
          </label>
          <label className="billing-field">
            <span>{t.country}</span>
            <input value={country || (modalProgram === "haiti_farmer" ? "Haiti" : "")} readOnly />
          </label>
          {modalProgram === "earth_university" ? (
            <>
              <label className="billing-field">
                <span>{t.institution}</span>
                <input value={institution} onChange={(e) => setInstitution(e.target.value)} />
              </label>
              <label className="billing-field">
                <span>{t.studentId}</span>
                <input value={studentId} onChange={(e) => setStudentId(e.target.value)} required />
              </label>
            </>
          ) : null}
          <label className="billing-field">
            <span>{t.message}</span>
            <textarea rows={3} value={message} onChange={(e) => setMessage(e.target.value)} />
          </label>
          <button type="submit" className="billing-btn billing-btn--primary" disabled={busy}>
            {t.submitApplication}
          </button>
        </form>
      </AppModal>
    </section>
  );
}
