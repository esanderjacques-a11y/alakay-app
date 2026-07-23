"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  Camera,
  FileText,
  History,
  Landmark,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { useDismissible } from "@/hooks/useDismissible";
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
  onImportCamera: () => void;
  onImportFile: () => void;
  goResults: () => void;
  goCalculators: () => void;
  goFarms: () => void;
  openFarm: (farmName: string, farmId?: number) => void;
  hasResultsOrProgress: boolean;
};

type HomeActionId = "input" | "import" | "reports" | "calculators";

function matchesSearch(haystack: string, needle: string): boolean {
  if (!needle) return true;
  return haystack.toLowerCase().includes(needle);
}

export default function HomeScreen({
  t,
  session,
  guestMode,
  displayName,
  isReturningUser,
  startNewAnalysis,
  onImportCamera,
  onImportFile,
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
  const [searchQuery, setSearchQuery] = useState("");

  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const importMenuRef = useRef<HTMLDivElement | null>(null);

  useDismissible(importMenuOpen, () => setImportMenuOpen(false), importMenuRef);

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

  const needle = searchQuery.trim().toLowerCase();

  const actions: { id: HomeActionId; terms: string }[] = [
    {
      id: "input",
      terms: [t.inputData, t.inputDataShort, t.insertNew].join(" "),
    },
    {
      id: "import",
      terms: [
        t.importData,
        t.importDataShort,
        t.importDocument,
        t.takePhoto,
      ].join(" "),
    },
    {
      id: "reports",
      terms: [t.savedReports, t.savedReportsShort, t.history].join(" "),
    },
    {
      id: "calculators",
      terms: [t.calculators, t.calculatorsShort].join(" "),
    },
  ];
  const visibleActions = new Set(
    actions
      .filter((action) => matchesSearch(action.terms, needle))
      .map((action) => action.id)
  );

  const farms = dash?.farms ?? [];
  const visibleFarms = (
    needle
      ? farms.filter((farm) =>
          matchesSearch(
            `${farm.farm_name} ${farm.location || ""} ${p.locationUnknown}`,
            needle
          )
        )
      : farms
  ).slice(0, 8);

  const showFarmsPanel =
    Boolean(session?.user && !guestMode) &&
    (!needle ||
      visibleFarms.length > 0 ||
      matchesSearch(`${p.myFarms} ${p.addFarm} ${p.viewAllFarms}`, needle));

  const showAddFarmChip =
    !needle || matchesSearch(`${p.addFarm} ${p.myFarms}`, needle);

  const hasVisibleActions = visibleActions.size > 0;
  const hasAnyResults =
    hasVisibleActions ||
    (showFarmsPanel && (visibleFarms.length > 0 || showAddFarmChip));

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

        <div className="home-search">
          <Search size={15} className="home-search__icon" aria-hidden />
          <input
            type="search"
            className="home-search__input"
            placeholder={t.homeSearchPlaceholder}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label={t.homeSearchPlaceholder}
            autoComplete="off"
          />
        </div>

        {!hasAnyResults ? (
          <p className="home-search__empty">{t.homeSearchEmpty}</p>
        ) : null}

        {hasVisibleActions ? (
          <div className="home-action-grid">
            {visibleActions.has("input") ? (
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
            ) : null}

            {visibleActions.has("import") ? (
              <div
                ref={importMenuRef}
                className={`home-action-tile-wrap${importMenuOpen ? " home-action-tile-wrap--open" : ""}`}
              >
                {importMenuOpen ? (
                  <div className="home-import-menu">
                    <button
                      type="button"
                      className="home-import-option"
                      onClick={() => {
                        setImportMenuOpen(false);
                        onImportCamera();
                      }}
                    >
                      <span className="home-import-option__icon">
                        <Camera size={18} />
                      </span>
                      <span className="home-import-option__copy">
                        <span className="home-import-option__title">
                          {t.takePhoto}
                        </span>
                        <span className="home-import-option__desc">
                          {t.takePhotoShort}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      className="home-import-option"
                      onClick={() => {
                        setImportMenuOpen(false);
                        onImportFile();
                      }}
                    >
                      <span className="home-import-option__icon">
                        <FileText size={18} />
                      </span>
                      <span className="home-import-option__copy">
                        <span className="home-import-option__title">
                          {t.importDocument}
                        </span>
                        <span className="home-import-option__desc">
                          {t.importDocumentShort}
                        </span>
                      </span>
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setImportMenuOpen(true)}
                    className="home-action-tile w-full"
                    aria-expanded={false}
                  >
                    <span className="home-action-tile__icon">
                      <Upload size={20} />
                    </span>
                    <span className="home-action-tile__copy">
                      <span className="home-action-tile__title">{t.importData}</span>
                      <span className="home-action-tile__desc">
                        {t.importDataShort}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            ) : null}

            {visibleActions.has("reports") ? (
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
                  <span className="home-action-tile__desc">
                    {t.savedReportsShort}
                  </span>
                </span>
              </button>
            ) : null}

            {visibleActions.has("calculators") ? (
              <button
                type="button"
                onClick={goCalculators}
                className="home-action-tile"
              >
                <span className="home-action-tile__icon">
                  <Calculator size={20} />
                </span>
                <span className="home-action-tile__copy">
                  <span className="home-action-tile__title">{t.calculators}</span>
                  <span className="home-action-tile__desc">
                    {t.calculatorsShort}
                  </span>
                </span>
              </button>
            ) : null}
          </div>
        ) : null}

        {session?.user && !guestMode ? (
          showFarmsPanel ? (
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
              {!dash || (dash.farms.length === 0 && !needle) ? (
                <p className="text-xs text-slate-500">{p.emptyFarms}</p>
              ) : visibleFarms.length === 0 && !showAddFarmChip ? (
                <p className="text-xs text-slate-500">{t.homeSearchEmpty}</p>
              ) : (
                <div className="home-farms-strip">
                  {visibleFarms.map((farm) => (
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
                  {showAddFarmChip ? (
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
                  ) : null}
                </div>
              )}
            </div>
          ) : null
        ) : (
          !needle ? (
            <div className="home-flat-guest-note">
              <span className="text-[12px] font-medium">{t.loginOrGuestShort}</span>
            </div>
          ) : null
        )}
      </div>
    </section>
  );
}
