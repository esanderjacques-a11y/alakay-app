"use client";

import {
  Calculator,
  History,
  Plus,
  Upload,
} from "lucide-react";
import { formatMessage } from "@/lib/translations";
import type { Session } from "@supabase/supabase-js";
import { Language, translations } from "@/lib/translations";

type Props = {
  t: (typeof translations)[Language];
  session: Session | null;
  guestMode: boolean;
  displayName: string;
  isReturningUser: boolean;
  startNewAnalysis: () => void;
  goImport: () => void;
  goResults: () => void;
  goCalculators: () => void;
  hasResultsOrProgress: boolean;
};

export default function HomeScreen({
  t,
  session,
  guestMode,
  displayName,
  isReturningUser,
  startNewAnalysis,
  goImport,
  goResults,
  goCalculators,
  hasResultsOrProgress,
}: Props) {
  const heroName = displayName || t.guestMode;
  const welcomeLine = isReturningUser
    ? formatMessage(t.homeWelcomeBack, { name: heroName })
    : t.homeWelcomeNew;

  const heroLines = [
    formatMessage(t.homeHeroCycle1, { name: heroName }),
    t.homeHeroCycle2,
    t.homeHeroCycle3,
  ];

  return (
    <section className="home-screen animate-slide-up">
      <div className="home-screen__inner">
        <div className="home-screen__hero">
          <p className="home-screen__welcome">{welcomeLine}</p>
          <div className="home-hero-cycle home-hero-cycle--tall">
            {heroLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        </div>

        <div className="home-action-grid">
          <button
            type="button"
            onClick={startNewAnalysis}
            className="home-action-tile home-action-tile--primary"
          >
            <span className="home-action-tile__icon home-action-tile__icon--primary">
              <Plus size={20} />
            </span>
            <span className="home-action-tile__copy">
              <span className="home-action-tile__title">{t.inputData}</span>
              <span className="home-action-tile__desc">{t.inputDataShort}</span>
            </span>
          </button>

          <button type="button" onClick={goImport} className="home-action-tile w-full">
            <span className="home-action-tile__icon">
              <Upload size={20} />
            </span>
            <span className="home-action-tile__copy">
              <span className="home-action-tile__title">{t.importData}</span>
              <span className="home-action-tile__desc">{t.importDataShort}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={goResults}
            disabled={!hasResultsOrProgress}
            className="home-action-tile disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="home-action-tile__icon">
              <History size={20} />
            </span>
            <span className="home-action-tile__copy">
              <span className="home-action-tile__title">{t.savedReports}</span>
              <span className="home-action-tile__desc">{t.savedReportsShort}</span>
            </span>
          </button>

          <button type="button" onClick={goCalculators} className="home-action-tile">
            <span className="home-action-tile__icon">
              <Calculator size={20} />
            </span>
            <span className="home-action-tile__copy">
              <span className="home-action-tile__title">{t.calculators}</span>
              <span className="home-action-tile__desc">{t.calculatorsShort}</span>
            </span>
          </button>
        </div>

        {!session?.user || guestMode ? (
          <div className="home-flat-guest-note">
            <span className="text-[12px] font-medium">{t.loginOrGuestShort}</span>
          </div>
        ) : null}
      </div>
    </section>
  );
}
