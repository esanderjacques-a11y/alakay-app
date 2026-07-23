"use client";

import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  Camera,
  ChevronRight,
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
import {
  buildFarmSearchEntries,
  buildHomeSearchCatalog,
  searchHomeCatalog,
  type HomeSearchDestination,
} from "@/lib/homeSearchCatalog";
import { normalizeSearchText } from "@/lib/searchNormalize";

type Props = {
  t: (typeof translations)[Language];
  language: Language;
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
  onNavigateSearch: (destination: HomeSearchDestination) => void;
};

type HomeActionId = "input" | "import" | "reports" | "calculators";

function matchesAction(terms: string[], query: string): boolean {
  if (!normalizeSearchText(query)) return true;
  return searchHomeCatalog(
    [
      {
        id: "tmp",
        title: terms[0] || "",
        subtitle: terms.slice(1).join(" "),
        section: "",
        keywords: terms,
        destination: { kind: "new-analysis" },
      },
    ],
    query
  ).length > 0;
}

export default function HomeScreen({
  t,
  language,
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
  onNavigateSearch,
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

  const isAuthed = Boolean(session?.user && !guestMode);

  useEffect(() => {
    if (!isAuthed) {
      setDash(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const next = await getUserFarmDashboard(session!.user.id, (farmNames) => {
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
  }, [session, isAuthed]);

  const needle = normalizeSearchText(searchQuery);
  const isSearching = Boolean(needle);

  const catalog = buildHomeSearchCatalog(t, language);
  const farmEntries = isAuthed
    ? buildFarmSearchEntries(dash?.farms ?? [], t, p.locationUnknown)
    : [];
  const searchResults = isSearching
    ? searchHomeCatalog([...catalog, ...farmEntries], searchQuery, {
        includeAuthOnly: isAuthed,
      }).slice(0, 24)
    : [];

  const visibleActions = new Set<HomeActionId>(
    (
      [
        {
          id: "input" as const,
          terms: [t.inputData, t.inputDataShort, t.insertNew],
        },
        {
          id: "import" as const,
          terms: [
            t.importData,
            t.importDataShort,
            t.importDocument,
            t.takePhoto,
          ],
        },
        {
          id: "reports" as const,
          terms: [t.savedReports, t.savedReportsShort, t.history],
        },
        {
          id: "calculators" as const,
          terms: [t.calculators, t.calculatorsShort, t.calculatorsDesc],
        },
      ] as const
    )
      .filter((action) => matchesAction([...action.terms], searchQuery))
      .map((action) => action.id)
  );

  const farms = dash?.farms ?? [];
  const visibleFarms = (
    isSearching
      ? farms.filter((farm) =>
          searchHomeCatalog(
            buildFarmSearchEntries([farm], t, p.locationUnknown),
            searchQuery,
            { includeAuthOnly: true }
          ).length > 0
        )
      : farms
  ).slice(0, 8);

  const showFarmsPanel =
    isAuthed &&
    (!isSearching ||
      visibleFarms.length > 0 ||
      matchesAction([p.myFarms, p.addFarm, p.viewAllFarms, p.farmsTitle], searchQuery));

  const showAddFarmChip =
    !isSearching || matchesAction([p.addFarm, p.myFarms], searchQuery);

  const hasVisibleActions = visibleActions.size > 0;
  const hasAnyBrowseResults =
    hasVisibleActions ||
    (showFarmsPanel && (visibleFarms.length > 0 || showAddFarmChip));
  const hasAnyResults = isSearching
    ? searchResults.length > 0
    : hasAnyBrowseResults;

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
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="search"
            inputMode="search"
          />
        </div>

        {isSearching ? (
          searchResults.length === 0 ? (
            <p className="home-search__empty">{t.homeSearchEmpty}</p>
          ) : (
            <div className="home-search-results" role="listbox">
              {searchResults.map((entry) => {
                const meta =
                  entry.subtitle &&
                  entry.subtitle !== entry.section &&
                  entry.subtitle !== entry.title
                    ? entry.subtitle
                    : entry.section;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="home-search-result"
                    role="option"
                    onClick={() => onNavigateSearch(entry.destination)}
                  >
                    <span className="home-search-result__copy">
                      <span className="home-search-result__title">
                        {entry.title}
                      </span>
                      {meta ? (
                        <span className="home-search-result__meta">{meta}</span>
                      ) : null}
                    </span>
                    <ChevronRight
                      size={16}
                      className="home-search-result__chevron"
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
          )
        ) : (
          <>
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
                      <span className="home-action-tile__desc">
                        {t.inputDataShort}
                      </span>
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
                          <span className="home-action-tile__title">
                            {t.importData}
                          </span>
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
                      <span className="home-action-tile__title">
                        {t.savedReports}
                      </span>
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
                      <span className="home-action-tile__title">
                        {t.calculators}
                      </span>
                      <span className="home-action-tile__desc">
                        {t.calculatorsShort}
                      </span>
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}

            {isAuthed ? (
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
                  {!dash || dash.farms.length === 0 ? (
                    <p className="text-xs text-slate-500">{p.emptyFarms}</p>
                  ) : (
                    <div className="home-farms-strip">
                      {visibleFarms.map((farm) => (
                        <button
                          key={farm.farm_id}
                          type="button"
                          className="home-farm-chip"
                          onClick={() => openFarm(farm.farm_name, farm.farm_id)}
                        >
                          <span className="home-farm-chip__name">
                            {farm.farm_name}
                          </span>
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
              <div className="home-flat-guest-note">
                <span className="text-[12px] font-medium">
                  {t.loginOrGuestShort}
                </span>
              </div>
            )}

            {!hasAnyResults ? (
              <p className="home-search__empty">{t.homeSearchEmpty}</p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
