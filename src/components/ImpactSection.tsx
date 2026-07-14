"use client";

import { useEffect, useMemo, useState } from "react";
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

type NamedCount = { name: string; count: number };

type ImpactPayload = {
  configured?: boolean;
  totalAnalyses: number;
  totalCountries: number;
  totalFeedback: number;
  averageRating: number | null;
  soilShare: number;
  foliarShare: number;
  countries: NamedCount[];
  regions: NamedCount[];
  languages: NamedCount[];
  crops: NamedCount[];
  months: NamedCount[];
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

function normalizeImpactPayload(raw: Partial<ImpactPayload>): ImpactPayload {
  return {
    configured: raw.configured !== false,
    totalAnalyses: typeof raw.totalAnalyses === "number" ? raw.totalAnalyses : 0,
    totalCountries: typeof raw.totalCountries === "number" ? raw.totalCountries : 0,
    totalFeedback: typeof raw.totalFeedback === "number" ? raw.totalFeedback : 0,
    averageRating: typeof raw.averageRating === "number" ? raw.averageRating : null,
    soilShare: typeof raw.soilShare === "number" ? raw.soilShare : 0,
    foliarShare: typeof raw.foliarShare === "number" ? raw.foliarShare : 0,
    countries: Array.isArray(raw.countries) ? raw.countries : [],
    regions: Array.isArray(raw.regions) ? raw.regions : [],
    languages: Array.isArray(raw.languages) ? raw.languages : [],
    crops: Array.isArray(raw.crops) ? raw.crops : [],
    months: Array.isArray(raw.months) ? raw.months : [],
    sampleTypes: Array.isArray(raw.sampleTypes) ? raw.sampleTypes : [],
    featured: raw.featured ?? null,
  };
}

function formatMonthLabel(key: string) {
  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  if (Number.isNaN(date.getTime())) return key;
  return date.toLocaleDateString(undefined, { month: "short" });
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

  const maxCountry = data?.countries[0]?.count || 1;
  const maxCrop = data?.crops[0]?.count || 1;
  const maxLanguage = data?.languages[0]?.count || 1;
  const maxMonth = Math.max(1, ...(data?.months.map((m) => m.count) || [1]));

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
    if (!data?.months.length) return -1;
    let best = 0;
    data.months.forEach((month, index) => {
      if (month.count > (data.months[best]?.count || 0)) best = index;
    });
    return best;
  }, [data]);

  return (
    <div className="about-flat-section impact-dashboard">
      <div className="impact-hero">
        <p className="about-flat-lead">{t.impactDesc}</p>
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
          <p className="about-flat-muted">{t.loadingApp}</p>
        </div>
      ) : loadState === "unavailable" ? (
        <p className="about-flat-banner about-flat-banner--error">{t.impactUnavailable}</p>
      ) : loadState === "error" ? (
        <p className="about-flat-banner about-flat-banner--error">{t.impactError}</p>
      ) : !data || !hasImpactData ? (
        <p className="about-flat-muted">{t.impactEmpty}</p>
      ) : (
        <>
          <div className="impact-stat-grid">
            <ImpactStat
              icon={<Users size={18} />}
              label={t.impactAnalyses}
              value={String(data.totalAnalyses)}
              hint={t.impactAnalysesHint}
            />
            <ImpactStat
              icon={<Globe2 size={18} />}
              label={t.impactCountries}
              value={String(data.totalCountries)}
              hint={t.impactCountriesHint}
            />
            <ImpactStat
              icon={<MapPin size={18} />}
              label={t.impactRegions}
              value={String(data.regions.length)}
              hint={t.impactRegionsHint}
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
            />
          </div>

          {data.featured ? (
            <blockquote className="about-flat-quote impact-quote">
              <MessageSquareQuote size={18} className="about-flat-quote-icon" />
              <p className="about-flat-quote-text">“{data.featured.message}”</p>
              <footer className="about-flat-quote-footer">
                — {data.featured.name || t.feedbackAnonymous}
                {data.featured.country ? `, ${data.featured.country}` : ""}
                {data.featured.rating ? ` · ${data.featured.rating}/5` : ""}
              </footer>
            </blockquote>
          ) : null}

          <div className="impact-panel-grid">
            <section className="impact-panel">
              <div className="impact-panel-head">
                <h3 className="about-flat-subtitle">{t.impactSampleMix}</h3>
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

            {data.months.some((m) => m.count > 0) ? (
              <section className="impact-panel">
                <div className="impact-panel-head">
                  <h3 className="about-flat-subtitle">{t.impactTrend}</h3>
                  <p className="impact-panel-note">{t.impactTrendHint}</p>
                </div>
                <div className="impact-trend" role="img" aria-label={t.impactTrend}>
                  {data.months.map((month, index) => {
                    const height = Math.max(8, (month.count / maxMonth) * 100);
                    return (
                      <div key={month.name} className="impact-trend-col">
                        <span className="impact-trend-count">{month.count || ""}</span>
                        <div
                          className={`impact-trend-bar ${index === monthlyMaxIndex ? "is-peak" : ""}`}
                          style={{ height: `${height}%` }}
                          title={`${month.name}: ${month.count}`}
                        />
                        <span className="impact-trend-label">{formatMonthLabel(month.name)}</span>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}
          </div>

          {data.countries.length > 0 ? (
            <section className="impact-panel">
              <div className="impact-panel-head">
                <h3 className="about-flat-subtitle">{t.impactMapTitle}</h3>
                <p className="impact-panel-note">{t.impactMapHint}</p>
              </div>
              <ul className="impact-bars">
                {data.countries.map((country) => {
                  const pct = Math.round((country.count / Math.max(1, data.totalAnalyses)) * 100);
                  return (
                    <li key={country.name}>
                      <div className="about-flat-bar-label">
                        <span>{country.name}</span>
                        <span>
                          {country.count}
                          <em> · {pct}%</em>
                        </span>
                      </div>
                      <div className="about-flat-bar-track">
                        <div
                          className="about-flat-bar-fill"
                          style={{
                            width: `${Math.max(6, (country.count / maxCountry) * 100)}%`,
                          }}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <div className="impact-panel-grid">
            {data.crops.length > 0 ? (
              <section className="impact-panel">
                <div className="impact-panel-head">
                  <h3 className="about-flat-subtitle">{t.impactTopCrops}</h3>
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
                  <h3 className="about-flat-subtitle">{t.impactLanguages}</h3>
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
            <section className="impact-panel">
              <div className="impact-panel-head">
                <h3 className="about-flat-subtitle">{t.impactTopRegions}</h3>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="about-flat-stat impact-stat">
      <span className="about-flat-stat-icon">{icon}</span>
      <p className="about-flat-stat-value">{value}</p>
      <p className="about-flat-stat-label">{label}</p>
      {hint ? <p className="impact-stat-hint">{hint}</p> : null}
    </div>
  );
}
