"use client";

import { useEffect, useState } from "react";
import {
  Calculator,
  History,
  Landmark,
  Plus,
  Upload,
} from "lucide-react";
import { formatMessage } from "@/lib/translations";
import type { Session } from "@supabase/supabase-js";
import { Language, translations } from "@/lib/translations";
import {
  getUserFarmDashboard,
  type UserFarmDashboard,
} from "@/lib/farmRepository";
import { loadPlanningState } from "@/lib/planningStore";

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
  goFarms: () => void;
  openFarm: (farmName: string, farmId?: number) => void;
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
  goFarms,
  openFarm,
  hasResultsOrProgress,
}: Props) {
  const p = t.planning;
  const heroName = displayName || t.guestMode;
  const welcomeLine = isReturningUser
    ? formatMessage(t.homeWelcomeBack, { name: heroName })
    : t.homeWelcomeNew;
  const [dash, setDash] = useState<UserFarmDashboard | null>(null);

  const heroLines = [
    formatMessage(t.homeHeroCycle1, { name: heroName }),
    t.homeHeroCycle2,
    t.homeHeroCycle3,
  ];

  useEffect(() => {
    if (!session?.user || guestMode) {
      setDash(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await getUserFarmDashboard(session.user.id, (farmNames) => {
          const keys = new Set(
            farmNames.map((name) => name.trim().toLocaleLowerCase())
          );
          return loadPlanningState().events.filter((event) =>
            keys.has((event.farmName || "").trim().toLocaleLowerCase())
          ).length;
        });
        if (!cancelled) setDash(next);
      } catch {
        if (!cancelled) setDash(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user, guestMode]);

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

        {session?.user && !guestMode ? (
          <>
            <div className="home-farms-panel">
              <div className="home-farms-panel__head">
                <h2 className="home-farms-panel__title">{p.myFarms}</h2>
                <button
                  type="button"
                  className="plan-timeline-card__action"
                  onClick={goFarms}
                >
                  {p.viewAllFarms}
                </button>
              </div>
              {!dash || dash.farms.length === 0 ? (
                <p className="text-xs text-slate-500">{p.emptyFarms}</p>
              ) : (
                <div className="home-farms-strip">
                  {dash.farms.slice(0, 8).map((farm) => (
                    <button
                      key={farm.farm_id}
                      type="button"
                      className="home-farm-chip"
                      onClick={() => openFarm(farm.farm_name, farm.farm_id)}
                    >
                      <span className="home-farm-chip__name">{farm.farm_name}</span>
                      <span className="home-farm-chip__meta">
                        {farm.location || p.locationUnknown}
                      </span>
                    </button>
                  ))}
                  <button
                    type="button"
                    className="home-farm-chip"
                    onClick={goFarms}
                  >
                    <span className="inline-flex items-center gap-1 home-farm-chip__name">
                      <Landmark size={14} />
                      {p.addFarm}
                    </span>
                  </button>
                </div>
              )}
            </div>

            <div className="home-dash-panel">
              <div className="home-dash-panel__head">
                <h2 className="home-dash-panel__title">{p.userDashboard}</h2>
              </div>
              <div className="home-dash-grid">
                <div className="home-dash-stat">
                  <span className="home-dash-stat__value">
                    {dash?.farmCount ?? "—"}
                  </span>
                  <span className="home-dash-stat__label">{p.dashFarms}</span>
                </div>
                <div className="home-dash-stat">
                  <span className="home-dash-stat__value">
                    {dash?.lotCount ?? "—"}
                  </span>
                  <span className="home-dash-stat__label">{p.dashLots}</span>
                </div>
                <div className="home-dash-stat">
                  <span className="home-dash-stat__value">
                    {dash?.reportCount ?? "—"}
                  </span>
                  <span className="home-dash-stat__label">{p.dashReports}</span>
                </div>
                <div className="home-dash-stat">
                  <span className="home-dash-stat__value">
                    {dash?.calendarCount ?? "—"}
                  </span>
                  <span className="home-dash-stat__label">{p.dashCalendar}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="home-flat-guest-note">
            <span className="text-[12px] font-medium">{t.loginOrGuestShort}</span>
          </div>
        )}
      </div>
    </section>
  );
}
