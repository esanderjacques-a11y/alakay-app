"use client";

import { useEffect, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import BackButton from "@/components/ui/BackButton";
import {
  Heart,
  Linkedin,
  Mail,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import AboutStoryCarousel from "@/components/AboutStoryCarousel";
import FeedbackSection from "@/components/FeedbackSection";
import ImpactSection from "@/components/ImpactSection";
import type { Translation } from "@/lib/translations";
import { prefetchImpactPayload } from "@/lib/impactClient";

const CONTACT_EMAIL = "jesander@earth.ac.cr";
const PHONE_CR = "+506 8828 7831";
const PHONE_HT = "+509 4422 9395";
const LINKEDIN_URL = "https://www.linkedin.com/in/jacques-esander/";

/** Public PayPal hosted-button URL — keeps Donate working on Vercel even if env is unset. */
const DEFAULT_PAYPAL_DONATE_URL =
  "https://www.paypal.com/donate/?hosted_button_id=CX8WKQWMD8NW4";

const PAYPAL_DONATE_URL =
  process.env.NEXT_PUBLIC_PAYPAL_DONATE_URL?.trim() || DEFAULT_PAYPAL_DONATE_URL;

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
  return (
    <div className="about-flat-donate-bar">
      <a
        href={PAYPAL_DONATE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="about-flat-donate-btn about-flat-donate-btn--paypal"
      >
        <Heart size={16} aria-hidden />
        <span className="about-flat-donate-copy">
          <strong>{t.aboutDonate}</strong>
          <span className="about-flat-donate-hint">{t.aboutDonateSupport}</span>
        </span>
      </a>
    </div>
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
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">(
    "idle"
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [photoError, setPhotoError] = useState(false);

  useEffect(() => {
    prefetchImpactPayload();
  }, []);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        root,
        threshold: 0.18,
        rootMargin: "0px 0px -18% 0px",
      }
    );

    const elements = root.querySelectorAll(".fade-in-section");
    elements.forEach((el) => {
      el.classList.remove("is-visible");
    });
    // Ensure opacity:0 paints before IntersectionObserver marks visible items.
    void root.offsetHeight;
    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [tab]);

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
    window.setTimeout(() => {
      requestSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  return (
    <section className="animate-slide-up about-screen-wrap">
      <div className="about-shell">
        <div className="about-scroll" ref={scrollRef}>
          <div className="about-header">
            <div className="page-title-row page-title-row--centered">
              <BackButton variant="icon" onClick={onBack} label={t.home} />
              <h1 className="about-page-title page-title-row__title !mt-0">
                {t.aboutTitle}
              </h1>
              <span className="page-title-row__spacer" aria-hidden="true" />
            </div>

            <header className="about-hero about-hero--stage">
              <div className="about-hero__inner">
                {!photoError ? (
                  <img
                    src={CREATOR_PHOTO}
                    alt={t.aboutCreatorFullName}
                    className="about-hero-photo"
                    onError={() => setPhotoError(true)}
                  />
                ) : (
                  <img
                    src="/app-icon.png"
                    alt={t.appName}
                    className="about-hero-photo about-hero-photo--logo"
                  />
                )}
                <div className="about-hero__copy">
                  <p className="about-brand">{t.appName}</p>
                  <p className="about-tagline">{t.aboutTagline}</p>
                </div>
              </div>
            </header>
          </div>

          <nav className="about-tabs" aria-label={t.aboutTitle}>
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`about-tab ${tab === item.id ? "is-active" : ""}`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="about-content">
            {tab === "about" ? (
              <div className="about-flow about-flow--story">
                <div className="fade-in-section">
                  <AboutStoryCarousel t={t} language={language} />
                </div>

                <section className="about-our-story fade-in-section" aria-labelledby="about-our-story-title">
                  <p className="about-our-story__eyebrow">{t.aboutOurStoryEyebrow}</p>
                  <h2 id="about-our-story-title" className="about-our-story__title">
                    {t.aboutOurStoryTitle}
                  </h2>
                  <p className="about-our-story__body">{t.aboutOurStoryBody}</p>
                </section>

                <section className="about-section about-section--contact fade-in-section">
                  <h2 className="about-kicker">{t.aboutContactLabel}</h2>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600 dark:text-slate-400">
                    <a href={`mailto:${CONTACT_EMAIL}`} className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                      <Mail size={14} /> {CONTACT_EMAIL}
                    </a>
                    <a href={`tel:${PHONE_CR.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                      <Phone size={14} /> {PHONE_CR}
                    </a>
                    <a href={`tel:${PHONE_HT.replace(/\s/g, "")}`} className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                      <Phone size={14} /> {PHONE_HT}
                    </a>
                    <a href={LINKEDIN_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-emerald-600 transition-colors">
                      <Linkedin size={14} /> LinkedIn
                    </a>
                  </div>
                </section>

                <p className="about-note fade-in-section">{t.aboutDisclaimerShort}</p>

                <div className="about-actions fade-in-section">
                  <button
                    type="button"
                    onClick={openRequestForm}
                    className="about-action"
                  >
                    <Sparkles size={15} aria-hidden />
                    {t.aboutAddRequest}
                  </button>
                </div>

                {showRequestForm ? (
                  <section ref={requestSectionRef} className="about-section fade-in-section">
                    <h2 className="about-kicker">{t.featureRequest}</h2>
                    <p className="about-copy">{t.featureRequestDesc}</p>
                    <form
                      className="about-form"
                      onSubmit={handleFeatureRequest}
                    >
                      <label className="about-field">
                        <span>{t.featureRequestName}</span>
                        <input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                        />
                      </label>
                      <label className="about-field">
                        <span>{t.featureRequestEmail}</span>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </label>
                      <label className="about-field">
                        <span>{t.featureRequestSubject}</span>
                        <input
                          required
                          value={subject}
                          onChange={(e) => setSubject(e.target.value)}
                        />
                      </label>
                      <label className="about-field">
                        <span>{t.featureRequestMessage}</span>
                        <textarea
                          required
                          rows={3}
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                        />
                      </label>
                      {status === "success" ? (
                        <p className="about-status about-status--ok">
                          {t.featureRequestSuccess}
                        </p>
                      ) : null}
                      {status === "error" ? (
                        <p className="about-status about-status--err">
                          {errorMessage}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={status === "sending"}
                        className="about-action"
                      >
                        <Send size={15} aria-hidden />
                        {status === "sending"
                          ? t.featureRequestSending
                          : t.featureRequestSend}
                      </button>
                    </form>
                  </section>
                ) : null}

                {isAdmin && onOpenAdmin ? (
                  <button
                    type="button"
                    onClick={onOpenAdmin}
                    className="about-action about-action--ghost"
                  >
                    {t.adminOpen}
                  </button>
                ) : null}
              </div>
            ) : null}

            {tab === "feedback" ? (
              <FeedbackSection
                t={t}
                language={language}
                session={session}
                country={country}
              />
            ) : null}

            {tab === "impact" ? <ImpactSection t={t} /> : null}
          </div>
        </div>

        <div
          className="about-flat-bottom-bar"
          aria-label={t.aboutDeveloperLabel}
        >
          <AboutDonateBar t={t} />
          <footer className="about-flat-developer-footer">
            <p className="about-flat-developer-label">{t.aboutDeveloperLabel}</p>
            <p className="about-flat-developer-line">
              <span>{t.aboutCreatorFullName}</span>
              <span aria-hidden> · </span>
              <span>{t.aboutCreatorCountry}</span>
              <span aria-hidden> · </span>
              <span>{t.aboutDeveloperTitle}</span>
            </p>
          </footer>
        </div>
      </div>
    </section>
  );
}
