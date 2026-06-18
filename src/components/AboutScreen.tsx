"use client";

import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import BackButton from "@/components/ui/BackButton";
import {
  Heart,
  Linkedin,
  Mail,
  Phone,
  Send,
} from "lucide-react";
import FeedbackSection from "@/components/FeedbackSection";
import ImpactSection from "@/components/ImpactSection";
import type { Translation } from "@/lib/translations";

const CONTACT_EMAIL = "jesander@earth.ac.cr";
const PHONE_CR = "+506 8828 7831";
const PHONE_HT = "+509 4422 9395";
const LINKEDIN_URL = "https://www.linkedin.com/in/jacques-esander/";
const PAYPAL_DONATE_URL =
  process.env.NEXT_PUBLIC_PAYPAL_DONATE_URL?.trim() || "";
const CREATOR_PHOTO =
  process.env.NEXT_PUBLIC_CREATOR_PHOTO_URL?.trim() || "/creator/esander.jpg";

type AboutTab = "about" | "feedback" | "impact";

type Props = {
  t: Translation;
  language: string;
  session: Session | null;
  country?: string;
  isAdmin?: boolean;
  onOpenAdmin?: () => void;
  onBack: () => void;
};

function AboutDonateBar({ t }: { t: Translation }) {
  if (PAYPAL_DONATE_URL) {
    return (
      <a
        href={PAYPAL_DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="about-flat-donate-btn"
      >
        <Heart size={16} />
        {t.aboutDonate}
      </a>
    );
  }

  return (
    <button type="button" disabled className="about-flat-donate-btn is-disabled">
      <Heart size={16} />
      {t.aboutDonate}
      <span className="about-flat-donate-hint">{t.aboutDonateSoon}</span>
    </button>
  );
}

export default function AboutScreen({
  t,
  language,
  session,
  country,
  isAdmin,
  onOpenAdmin,
  onBack,
}: Props) {
  const [tab, setTab] = useState<AboutTab>("about");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const requestSectionRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [photoError, setPhotoError] = useState(false);

  const tabs: { id: AboutTab; label: string }[] = [
    { id: "about", label: t.about },
    { id: "feedback", label: t.feedbackTab },
    { id: "impact", label: t.impactTab },
  ];

  async function handleFeatureRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subject.trim() || !message.trim()) return;

    setStatus("sending");
    setErrorMessage("");

    try {
      const response = await fetch("/api/feature-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject: subject.trim(),
          message: message.trim(),
          language,
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setStatus("error");
        setErrorMessage(payload.error || t.featureRequestError);
        return;
      }

      setStatus("success");
      setSubject("");
      setMessage("");
    } catch {
      setStatus("error");
      setErrorMessage(t.featureRequestError);
    }
  }

  function openRequestForm() {
    setShowRequestForm(true);
    setTab("about");
    requestSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <section className="animate-slide-up about-screen-wrap">
      <div className="about-flat-panel">
        <div className="about-flat-header">
          <div className="page-title-row page-title-row--centered">
            <BackButton variant="icon" onClick={onBack} label={t.home} />
            <h1 className="about-flat-title page-title-row__title !mt-0">
              {t.aboutTitle}
            </h1>
            <span className="page-title-row__spacer" aria-hidden="true" />
          </div>

          <header className="about-flat-hero">
            {!photoError ? (
              <img
                src={CREATOR_PHOTO}
                alt={t.aboutCreatorFullName}
                className="about-flat-avatar"
                onError={() => setPhotoError(true)}
              />
            ) : (
              <img
                src="/app-icon.png"
                alt={t.appName}
                className="about-flat-avatar app-logo-frame object-contain"
              />
            )}
          </header>

          <nav className="about-flat-tabs" aria-label={t.aboutTitle}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`about-flat-tab ${tab === item.id ? "is-active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="about-flat-scroll">
        <div className="about-flat-content">
          {tab === "about" ? (
            <div className="about-flat-section">
              <p className="about-flat-intro">{t.aboutIntro}</p>

              <div className="about-flat-block">
                <h2 className="about-flat-subtitle">{t.aboutMissionLabel}</h2>
                <p className="about-flat-body">{t.aboutMission}</p>
              </div>

              <div className="about-flat-block">
                <h2 className="about-flat-subtitle">{t.aboutVisionLabel}</h2>
                <p className="about-flat-body">{t.aboutVision}</p>
              </div>

              <div className="about-flat-block about-flat-block--contact">
                <h2 className="about-flat-subtitle">{t.aboutContactLabel}</h2>
                <ul className="about-flat-contact-list">
                  <li>
                    <Mail size={16} />
                    <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
                  </li>
                  <li>
                    <Phone size={16} />
                    <a href={`tel:${PHONE_CR.replace(/\s/g, "")}`}>
                      {PHONE_CR}
                    </a>
                  </li>
                  <li>
                    <Phone size={16} />
                    <a href={`tel:${PHONE_HT.replace(/\s/g, "")}`}>
                      {PHONE_HT}
                    </a>
                  </li>
                  <li>
                    <Linkedin size={16} />
                    <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer">
                      LinkedIn
                    </a>
                  </li>
                </ul>
              </div>

              <p className="about-flat-disclaimer">{t.aboutDisclaimerShort}</p>

              <button type="button" onClick={openRequestForm} className="about-flat-btn">
                {t.aboutAddRequest}
              </button>

              {showRequestForm ? (
                <div ref={requestSectionRef} className="about-flat-block mt-3">
                  <h2 className="about-flat-subtitle">{t.featureRequest}</h2>
                  <form className="about-flat-form" onSubmit={handleFeatureRequest}>
                    <label className="about-flat-field">
                      <span>{t.featureRequestName}</span>
                      <input value={name} onChange={(e) => setName(e.target.value)} />
                    </label>
                    <label className="about-flat-field">
                      <span>{t.featureRequestEmail}</span>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </label>
                    <label className="about-flat-field">
                      <span>{t.featureRequestSubject}</span>
                      <input
                        required
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                      />
                    </label>
                    <label className="about-flat-field">
                      <span>{t.featureRequestMessage}</span>
                      <textarea
                        required
                        rows={3}
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                      />
                    </label>
                    {status === "success" ? (
                      <p className="about-flat-banner about-flat-banner--success">
                        {t.featureRequestSuccess}
                      </p>
                    ) : null}
                    {status === "error" ? (
                      <p className="about-flat-banner about-flat-banner--error">
                        {errorMessage}
                      </p>
                    ) : null}
                    <button
                      type="submit"
                      disabled={status === "sending"}
                      className="about-flat-btn about-flat-btn--secondary"
                    >
                      <Send size={16} />
                      {status === "sending" ? t.featureRequestSending : t.featureRequestSend}
                    </button>
                  </form>
                </div>
              ) : null}

              {isAdmin && onOpenAdmin ? (
                <button
                  type="button"
                  onClick={onOpenAdmin}
                  className="about-flat-btn about-flat-btn--secondary mt-3"
                >
                  {t.adminOpen}
                </button>
              ) : null}
            </div>
          ) : null}

          {tab === "feedback" ? (
            <FeedbackSection t={t} language={language} session={session} country={country} />
          ) : null}

          {tab === "impact" ? (
            <ImpactSection t={t} />
          ) : null}
        </div>
        </div>

        <div className="about-flat-bottom-bar" aria-label={t.aboutDeveloperLabel}>
          <footer className="about-flat-developer-footer">
            <p className="about-flat-developer-label">{t.aboutDeveloperLabel}</p>
            <p className="about-flat-developer-line">
              <span>{t.aboutCreatorFullName}</span>
              <span className="about-flat-developer-sep" aria-hidden>
                |
              </span>
              <span>{t.aboutCreatorCountry}</span>
              <span className="about-flat-developer-sep" aria-hidden>
                |
              </span>
              <span>{t.aboutDeveloperTitle}</span>
            </p>
          </footer>

          <div className="about-flat-donate-bar">
            <AboutDonateBar t={t} />
          </div>
        </div>
      </div>
    </section>
  );
}
