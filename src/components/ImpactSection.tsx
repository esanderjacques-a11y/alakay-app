"use client";

import { useEffect, useMemo, useState, Fragment, type ReactNode } from "react";
import {
  Beaker,
  FlaskConical,
  Globe2,
  MapPin,
  MessageSquareQuote,
  Sprout,
  Star,
  Users,
} from "lucide-react";
import type { Translation } from "@/lib/translations";
import ImpactWorldMap from "@/components/ImpactWorldMap";

type NamedCount = { name: string; count: number };

type TrendMode = "day" | "week" | "month" | "year";
type MonthSpan = 1 | 3 | 6;
type TrendSeriesKey =
  | "day"
  | "week"
  | "week1"
  | "month1"
  | "month3"
  | "month6"
  | "year";

type ImpactTrends = Partial<Record<TrendSeriesKey | "month", NamedCount[]>>;

type ImpactPayload = {
  configured?: boolean;
  totalAnalyses: number;
  totalCountries: number;
  totalRegions: number;
  totalFeedback: number;
  averageRating: number | null;
  soilShare: number;
  foliarShare: number;
  countries: NamedCount[];
  regions: NamedCount[];
  languages: NamedCount[];
  crops: NamedCount[];
  months: NamedCount[];
  trends: ImpactTrends;
  sampleTypes: NamedCount[];
  featured: {
    name: string | null;
    country: string | null;
    message: string;
    rating: number | null;
  } | null;
};

type LoadState = "loading" | "unavailable" | "error" | "ready";

type Props = {
  t: Translation;
};

function pickTrendSeries(
  trends: ImpactTrends,
  key: TrendSeriesKey,
  fallback: NamedCount[] = []
) {
  const direct = trends[key];
  if (Array.isArray(direct)) return direct;
  if (key === "week" && Array.isArray(trends.week1)) return trends.week1;
  if (key === "week1" && Array.isArray(trends.week)) return trends.week;
  if (key === "month1" && Array.isArray(trends.month)) return trends.month;
  return fallback;
}

function normalizeTrends(raw: unknown, months: NamedCount[]): ImpactTrends {
  if (!raw || typeof raw !== "object") {
    return {
      day: [],
      week: [],
      week1: [],
      month1: [],
      month3: months.slice(-3),
      month6: months.slice(-6),
      year: months,
    };
  }
  const obj = raw as ImpactTrends & { month2?: NamedCount[]; week2?: NamedCount[] };
  const asList = (value: unknown, fallback: NamedCount[] = []) =>
    Array.isArray(value) ? (value as NamedCount[]) : fallback;

  const week = asList(obj.week, asList(obj.week1));
  const month1 = asList(obj.month1, asList(obj.month));
  return {
    day: asList(obj.day),
    week,
    week1: week,
    month1,
    month3: asList(obj.month3, asList(obj.month2, months.slice(-3))),
    month6: asList(obj.month6, months.slice(-6)),
    year: asList(obj.year, months),
    month: month1,
  };
}

function normalizeImpactPayload(raw: Partial<ImpactPayload>): ImpactPayload {
  const months = Array.isArray(raw.months) ? raw.months : [];
  return {
    configured: raw.configured !== false,
    totalAnalyses: typeof raw.totalAnalyses === "number" ? raw.totalAnalyses : 0,
    totalCountries: typeof raw.totalCountries === "number" ? raw.totalCountries : 0,
    totalRegions:
      typeof raw.totalRegions === "number"
        ? raw.totalRegions
        : Array.isArray(raw.regions)
          ? raw.regions.length
          : 0,
    totalFeedback: typeof raw.totalFeedback === "number" ? raw.totalFeedback : 0,
    averageRating: typeof raw.averageRating === "number" ? raw.averageRating : null,
    soilShare: typeof raw.soilShare === "number" ? raw.soilShare : 0,
    foliarShare: typeof raw.foliarShare === "number" ? raw.foliarShare : 0,
    countries: Array.isArray(raw.countries) ? raw.countries : [],
    regions: Array.isArray(raw.regions) ? raw.regions : [],
    languages: Array.isArray(raw.languages) ? raw.languages : [],
    crops: Array.isArray(raw.crops) ? raw.crops : [],
    months,
    trends: normalizeTrends(raw.trends, months),
    sampleTypes: Array.isArray(raw.sampleTypes) ? raw.sampleTypes : [],
    featured: raw.featured ?? null,
  };
}

function resolveTrendKey(mode: TrendMode, monthSpan: MonthSpan): TrendSeriesKey {
  if (mode === "day") return "day";
  if (mode === "year") return "year";
  if (mode === "week") return "week";
  if (monthSpan === 6) return "month6";
  if (monthSpan === 3) return "month3";
  return "month1";
}

function formatTrendLabel(key: string, seriesKey: TrendSeriesKey) {
  if (seriesKey === "day") {
    const hourPart = key.includes("T") ? key.slice(-2) : key;
    const hour = Number(hourPart);
    if (Number.isNaN(hour)) return key;
    const suffix = hour >= 12 ? "p" : "a";
    const h12 = hour % 12 || 12;
    return `${h12}${suffix}`;
  }

  if (seriesKey === "week" || seriesKey === "week1" || seriesKey === "month1") {
    const [year, month, day] = key.split("-").map(Number);
    const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
    if (Number.isNaN(date.getTime())) return key;
    if (seriesKey === "week" || seriesKey === "week1") {
      return date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
    }
    return String(day);
  }

  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
}

function shouldShowTrendLabel(index: number, total: number, seriesKey: TrendSeriesKey) {
  if (seriesKey === "day") return index % 4 === 0 || index === total - 1;
  if (seriesKey === "month1") return index % 5 === 0 || index === total - 1;
  return true;
}

function trendDensityClass(seriesKey: TrendSeriesKey) {
  if (seriesKey === "day" || seriesKey === "month1") {
    return "impact-trend--dense";
  }
  return "";
}

function floorToNearestTen(n: number) {
  if (n <= 0) return 0;
  if (n < 10) return n;
  return Math.floor(n / 10) * 10;
}

function renderImpactHook(
  template: string,
  vars: {
    reports: number;
    regions: number;
    countries: number;
    regionLabel: string;
    countryLabel: string;
  }
): ReactNode[] {
  return template
    .split(/(\{reports\}|\{regions\}|\{countries\}|\{regionLabel\}|\{countryLabel\})/g)
    .map((part, index) => {
      if (part === "{reports}") {
        return <strong key={index}>{vars.reports}</strong>;
      }
      if (part === "{regions}") {
        return <strong key={index}>{vars.regions}</strong>;
      }
      if (part === "{countries}") {
        return <strong key={index}>{vars.countries}</strong>;
      }
      if (part === "{regionLabel}" || part === "{countryLabel}") {
        return (
          <Fragment key={index}>
            {part === "{regionLabel}" ? vars.regionLabel : vars.countryLabel}
          </Fragment>
        );
      }
      return <Fragment key={index}>{part}</Fragment>;
    });
}

function languageLabel(code: string) {
  const map: Record<string, string> = {
    en: "English",
    es: "Español",
    fr: "Français",
    ht: "Kreyòl",
    pt: "Português",
    sw: "Kiswahili",
  };
  return map[code] || code.toUpperCase();
}

export default function ImpactSection({ t }: Props) {
  const [data, setData] = useState<ImpactPayload | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [trendMode, setTrendMode] = useState<TrendMode>("month");
  const [monthSpan, setMonthSpan] = useState<MonthSpan>(1);

  useEffect(() => {
    let cancelled = false;

    void fetch("/api/impact")
      .then(async (response) => {
        const payload = (await response.json()) as Partial<ImpactPayload>;
        if (cancelled) return;

        if (!response.ok) {
          setLoadState("error");
          return;
        }
        if (payload.configured === false) {
          setLoadState("unavailable");
          return;
        }
        setData(normalizeImpactPayload(payload));
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const maxCrop = data?.crops[0]?.count || 1;
  const maxLanguage = data?.languages[0]?.count || 1;

  const trendModes: { id: TrendMode; label: string }[] = [
    { id: "day", label: t.impactTrendDay },
    { id: "week", label: t.impactTrendWeek },
    { id: "month", label: t.impactTrendMonth },
    { id: "year", label: t.impactTrendYear },
  ];

  const monthSpans: { id: MonthSpan; label: string }[] = [
    { id: 1, label: t.impactTrendThisMonth },
    { id: 3, label: t.impactTrendLast3Months },
    { id: 6, label: t.impactTrendLast6Months },
  ];

  const trendKey = resolveTrendKey(trendMode, monthSpan);
  const trendSeries = data
    ? pickTrendSeries(data.trends, trendKey, data.months)
    : [];
  const maxMonth = Math.max(1, ...trendSeries.map((m) => m.count), 1);
  const hasTrendData = (
    ["day", "week", "month1", "month3", "month6", "year"] as TrendSeriesKey[]
  ).some((key) =>
    (data ? pickTrendSeries(data.trends, key) : []).some((point) => point.count > 0)
  );

  const hasImpactData =
    !!data &&
    (data.totalAnalyses > 0 ||
      data.totalCountries > 0 ||
      data.countries.length > 0 ||
      data.regions.length > 0 ||
      data.crops.length > 0 ||
      data.featured !== null ||
      data.totalFeedback > 0);

  const soilPct = data?.soilShare ?? 0;
  const foliarPct = data?.foliarShare ?? 0;

  const monthlyMaxIndex = useMemo(() => {
    if (!trendSeries.length) return -1;
    let best = 0;
    trendSeries.forEach((point, index) => {
      if (point.count > (trendSeries[best]?.count || 0)) best = index;
    });
    return best;
  }, [trendSeries]);

  return (
    <div className="about-flow impact-dashboard">
      <div className="impact-hero">
        <p className="impact-in-numbers">{t.impactInNumbers}</p>
        {loadState === "ready" && data && hasImpactData ? (
          <h2 className="impact-hook">
            {renderImpactHook(t.impactHook, {
              reports: floorToNearestTen(data.totalAnalyses),
              regions: data.totalRegions || data.regions.length,
              countries: data.totalCountries,
              regionLabel:
                (data.totalRegions || data.regions.length) === 1
                  ? t.impactRegionOne
                  : t.impactRegionMany,
              countryLabel:
                data.totalCountries === 1
                  ? t.impactCountryOne
                  : t.impactCountryMany,
            })}
          </h2>
        ) : loadState === "loading" ? (
          <div className="impact-hook impact-hook--skeleton" aria-hidden />
        ) : null}
      </div>

      {loadState === "loading" ? (
        <div className="impact-skeleton" aria-busy="true">
          <div className="impact-skeleton-row" />
          <div className="impact-skeleton-row impact-skeleton-row--short" />
          <div className="impact-skeleton-grid">
            <div className="impact-skeleton-card" />
            <div className="impact-skeleton-card" />
            <div className="impact-skeleton-card" />
            <div className="impact-skeleton-card" />
          </div>
          <p className="about-note">{t.loadingApp}</p>
        </div>
      ) : loadState === "unavailable" ? (
        <p className="about-status about-status--err">{t.impactUnavailable}</p>
      ) : loadState === "error" ? (
        <p className="about-status about-status--err">{t.impactError}</p>
      ) : !data || !hasImpactData ? (
        <p className="about-note">{t.impactEmpty}</p>
      ) : (
        <>
          <div className="impact-stat-grid">
            <ImpactStat
              icon={<Users size={18} />}
              label={t.impactAnalyses}
              value={String(data.totalAnalyses)}
              hint={t.impactAnalysesHint}
              targetId="impact-sample-mix"
            />
            <ImpactStat
              icon={<Globe2 size={18} />}
              label={t.impactCountries}
              value={String(data.totalCountries)}
              hint={t.impactCountriesHint}
              targetId="impact-countries"
            />
            <ImpactStat
              icon={<MapPin size={18} />}
              label={t.impactRegions}
              value={String(data.totalRegions || data.regions.length)}
              hint={t.impactRegionsHint}
              targetId="impact-regions"
            />
            <ImpactStat
              icon={<Star size={18} />}
              label={t.impactRating}
              value={data.averageRating != null ? String(data.averageRating) : "—"}
              hint={
                data.totalFeedback > 0
                  ? `${data.totalFeedback} ${t.impactFeedbackCount}`
                  : t.impactRatingHint
              }
              targetId={data.featured ? "impact-featured" : "impact-sample-mix"}
            />
          </div>

          {data.featured ? (
            <blockquote id="impact-featured" className="about-quote">
              <MessageSquareQuote size={18} className="about-quote-icon" aria-hidden />
              <p className="about-quote-text">“{data.featured.message}”</p>
              <footer className="about-quote-foot">
                — {data.featured.name || t.feedbackAnonymous}
                {data.featured.country ? `, ${data.featured.country}` : ""}
                {data.featured.rating ? ` · ${data.featured.rating}/5` : ""}
              </footer>
            </blockquote>
          ) : null}

          <div className="impact-panel-grid">
            <section id="impact-sample-mix" className="impact-panel">
              <div className="impact-panel-head">
                <h3 className="about-kicker">{t.impactSampleMix}</h3>
                <p className="impact-panel-note">{t.impactSampleMixHint}</p>
              </div>
              <div className="impact-donut-wrap">
                <div
                  className="impact-donut"
                  style={{
                    background: `conic-gradient(
                      var(--accent-600, #059669) 0 ${soilPct}%,
                      rgb(56 189 248 / 0.85) ${soilPct}% 100%
                    )`,
                  }}
                  aria-hidden
                >
                  <div className="impact-donut-center">
                    <span>{data.totalAnalyses}</span>
                    <small>{t.impactAnalyses}</small>
                  </div>
                </div>
                <ul className="impact-legend">
                  <li>
                    <Beaker size={14} />
                    <span>{t.impactSoil}</span>
                    <strong>{soilPct}%</strong>
                  </li>
                  <li>
                    <FlaskConical size={14} />
                    <span>{t.impactFoliar}</span>
                    <strong>{foliarPct}%</strong>
                  </li>
                </ul>
              </div>
            </section>

            {hasTrendData ? (
              <section className="impact-panel">
                <div className="impact-panel-head">
                  <h3 className="about-kicker">{t.impactTrend}</h3>
                  <p className="impact-panel-note">{t.impactTrendHint}</p>
                </div>
                <div
                  className="impact-trend-range app-segmented-control"
                  role="tablist"
                  aria-label={t.impactTrend}
                >
                  {trendModes.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      role="tab"
                      aria-selected={trendMode === mode.id}
                      className={`app-segmented-control__btn${
                        trendMode === mode.id ? " app-segmented-control__btn--active" : ""
                      }`}
                      onClick={() => setTrendMode(mode.id)}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
                {trendMode === "month" ? (
                  <div
                    className="impact-trend-span app-segmented-control"
                    role="tablist"
                    aria-label={t.impactTrendMonth}
                  >
                    {monthSpans.map((span) => (
                      <button
                        key={span.id}
                        type="button"
                        role="tab"
                        aria-selected={monthSpan === span.id}
                        className={`app-segmented-control__btn${
                          monthSpan === span.id ? " app-segmented-control__btn--active" : ""
                        }`}
                        onClick={() => setMonthSpan(span.id)}
                      >
                        {span.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div
                  className={`impact-trend impact-trend--${trendKey} ${trendDensityClass(trendKey)}`}
                  role="img"
                  aria-label={t.impactTrend}
                  style={{
                    gridTemplateColumns: `repeat(${Math.max(1, trendSeries.length)}, minmax(0, 1fr))`,
                  }}
                >
                  {trendSeries.map((point, index) => {
                    const height = Math.max(8, (point.count / maxMonth) * 100);
                    const showLabel = shouldShowTrendLabel(
                      index,
                      trendSeries.length,
                      trendKey
                    );
                    return (
                      <div key={point.name} className="impact-trend-col">
                        <span className="impact-trend-count">
                          {point.count || ""}
                        </span>
                        <div
                          className={`impact-trend-bar ${index === monthlyMaxIndex ? "is-peak" : ""}`}
                          style={{ height: `${height}%` }}
                          title={`${point.name}: ${point.count}`}
                        />
                        <span
                          className={`impact-trend-label${showLabel ? "" : " is-hidden"}`}
                        >
                          {showLabel ? formatTrendLabel(point.name, trendKey) : ""}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>

          {data.countries.length > 0 ? (
            <section id="impact-countries" className="impact-panel impact-panel--geo">
              <div className="impact-panel-head">
                <h3 className="about-kicker">{t.impactMapTitle}</h3>
                <p className="impact-panel-note">{t.impactMapHint}</p>
              </div>
              <ImpactWorldMap
                countries={data.countries}
                totalAnalyses={data.totalAnalyses}
                listLimit={10}
              />
            </section>
          ) : null}

          <div className="impact-panel-grid">
            {data.crops.length > 0 ? (
              <section className="impact-panel">
                <div className="impact-panel-head">
                  <h3 className="about-kicker">{t.impactTopCrops}</h3>
                  <p className="impact-panel-note">{t.impactTopCropsHint}</p>
                </div>
                <ul className="impact-bars">
                  {data.crops.map((crop) => (
                    <li key={crop.name}>
                      <div className="about-flat-bar-label">
                        <span className="impact-crop-label">
                          <Sprout size={12} />
                          {crop.name}
                        </span>
                        <span>{crop.count}</span>
                      </div>
                      <div className="about-flat-bar-track">
                        <div
                          className="about-flat-bar-fill about-flat-bar-fill--alt"
                          style={{
                            width: `${Math.max(6, (crop.count / maxCrop) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {data.languages.length > 0 ? (
              <section className="impact-panel">
                <div className="impact-panel-head">
                  <h3 className="about-kicker">{t.impactLanguages}</h3>
                  <p className="impact-panel-note">{t.impactLanguagesHint}</p>
                </div>
                <ul className="impact-bars">
                  {data.languages.map((lang) => (
                    <li key={lang.name}>
                      <div className="about-flat-bar-label">
                        <span>{languageLabel(lang.name)}</span>
                        <span>{lang.count}</span>
                      </div>
                      <div className="about-flat-bar-track">
                        <div
                          className="about-flat-bar-fill about-flat-bar-fill--lang"
                          style={{
                            width: `${Math.max(6, (lang.count / maxLanguage) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          {data.regions.length > 0 ? (
            <section id="impact-regions" className="impact-panel">
              <div className="impact-panel-head">
                <h3 className="about-kicker">{t.impactTopRegions}</h3>
                <p className="impact-panel-note">{t.impactTopRegionsHint}</p>
              </div>
              <ul className="about-flat-list about-flat-region-list">
                {data.regions.map((region, index) => (
                  <li key={region.name} className="about-flat-region-item">
                    <span className="impact-rank">{index + 1}</span>
                    <span>{region.name}</span>
                    <span className="about-flat-region-count">{region.count}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function ImpactStat({
  icon,
  label,
  value,
  hint,
  targetId,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
  targetId?: string;
}) {
  function handleActivate() {
    if (!targetId) return;
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.add("impact-panel--flash");
    window.setTimeout(() => target.classList.remove("impact-panel--flash"), 900);
  }

  return (
    <button
      type="button"
      className="impact-stat"
      onClick={handleActivate}
      disabled={!targetId}
      aria-label={hint ? `${label}: ${value}. ${hint}` : `${label}: ${value}`}
    >
      <span className="impact-stat-icon" aria-hidden>
        {icon}
      </span>
      <p className="impact-stat-value">{value}</p>
      <p className="impact-stat-label">{label}</p>
      {hint ? <p className="impact-stat-hint">{hint}</p> : null}
    </button>
  );
}
