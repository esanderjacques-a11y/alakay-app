"use client";

import { useEffect, useState } from "react";
import { Globe2, MapPin, MessageSquareQuote, Users } from "lucide-react";
import type { Translation } from "@/lib/translations";

type ImpactPayload = {
  configured?: boolean;
  totalAnalyses: number;
  totalCountries: number;
  countries: Array<{ name: string; count: number }>;
  regions: Array<{ name: string; count: number }>;
  languages: Array<{ name: string; count: number }>;
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
    totalCountries:
      typeof raw.totalCountries === "number" ? raw.totalCountries : 0,
    countries: Array.isArray(raw.countries) ? raw.countries : [],
    regions: Array.isArray(raw.regions) ? raw.regions : [],
    languages: Array.isArray(raw.languages) ? raw.languages : [],
    featured: raw.featured ?? null,
  };
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
  const hasImpactData =
    !!data &&
    (data.totalAnalyses > 0 ||
      data.totalCountries > 0 ||
      data.countries.length > 0 ||
      data.regions.length > 0 ||
      data.featured !== null);

  return (
    <div className="about-flat-section">
      <p className="about-flat-lead">{t.impactDesc}</p>

      {loadState === "loading" ? (
        <p className="about-flat-muted">{t.loadingApp}</p>
      ) : loadState === "unavailable" ? (
        <p className="about-flat-banner about-flat-banner--error mt-4">
          {t.impactUnavailable}
        </p>
      ) : loadState === "error" ? (
        <p className="about-flat-banner about-flat-banner--error mt-4">
          {t.impactError}
        </p>
      ) : !data || !hasImpactData ? (
        <p className="about-flat-muted mt-4">{t.impactEmpty}</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <ImpactStat
              icon={<Users size={18} />}
              label={t.impactAnalyses}
              value={String(data.totalAnalyses)}
            />
            <ImpactStat
              icon={<Globe2 size={18} />}
              label={t.impactCountries}
              value={String(data.totalCountries)}
            />
            <ImpactStat
              icon={<MapPin size={18} />}
              label={t.impactRegions}
              value={String(data.regions.length)}
            />
          </div>

          {data.featured ? (
            <blockquote className="about-flat-quote mt-5">
              <MessageSquareQuote size={18} className="about-flat-quote-icon" />
              <p className="about-flat-quote-text">“{data.featured.message}”</p>
              <footer className="about-flat-quote-footer">
                — {data.featured.name || t.feedbackAnonymous}
                {data.featured.country ? `, ${data.featured.country}` : ""}
              </footer>
            </blockquote>
          ) : null}

          {data.countries.length > 0 ? (
            <div className="mt-6">
              <h3 className="about-flat-subtitle">{t.impactMapTitle}</h3>
              <ul className="mt-3 space-y-2">
                {data.countries.map((country) => (
                  <li key={country.name}>
                    <div className="about-flat-bar-label">
                      <span>{country.name}</span>
                      <span>{country.count}</span>
                    </div>
                    <div className="about-flat-bar-track">
                      <div
                        className="about-flat-bar-fill"
                        style={{
                          width: `${Math.max(8, (country.count / maxCountry) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {data.regions.length > 0 ? (
            <div className="mt-6">
              <h3 className="about-flat-subtitle">{t.impactTopRegions}</h3>
              <ul className="about-flat-list about-flat-region-list mt-2">
                {data.regions.map((region) => (
                  <li key={region.name} className="about-flat-region-item">
                    <span>{region.name}</span>
                    <span className="about-flat-region-count">{region.count}</span>
                  </li>
                ))}
              </ul>
            </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="about-flat-stat">
      <span className="about-flat-stat-icon">{icon}</span>
      <p className="about-flat-stat-value">{value}</p>
      <p className="about-flat-stat-label">{label}</p>
    </div>
  );
}
