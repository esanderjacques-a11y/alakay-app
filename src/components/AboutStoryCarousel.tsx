"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Eye,
  Globe2,
  HeartHandshake,
  MapPin,
  Sparkles,
} from "lucide-react";
import { continentForCountryName } from "@/lib/countries";
import {
  fetchImpactPayload,
  readImpactCache,
} from "@/lib/impactClient";
import type { Translation } from "@/lib/translations";

type NamedCount = { name: string; count: number };

type ImpactPayload = {
  totalAnalyses: number;
  totalCountries: number;
  totalRegions: number;
  countries: NamedCount[];
};

type StoryMode = "journey" | "mission" | "vision" | "values";

type Props = {
  t: Translation;
  language: string;
};

const AUTO_MS = 5200;
const FOUNDED_YEAR = 2026;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function useCountUp(target: number, active: boolean, durationMs = 900) {
  const [value, setValue] = useState(0);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    if (!active) return;
    if (reduced || target <= 0) {
      setValue(target);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(target * eased));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active, durationMs, reduced, target]);

  return value;
}

function formatToday(language: string) {
  try {
    return new Intl.DateTimeFormat(language || "en", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date());
  } catch {
    return new Date().toLocaleDateString();
  }
}

export default function AboutStoryCarousel({ t, language }: Props) {
  const reducedMotion = usePrefersReducedMotion();
  const [mode, setMode] = useState<StoryMode>("journey");
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  const [payload, setPayload] = useState<ImpactPayload | null>(() =>
    readImpactCache<ImpactPayload>()
  );
  const [loadState, setLoadState] = useState<"loading" | "ready" | "empty">(
    () => (readImpactCache<ImpactPayload>() ? "ready" : "loading")
  );

  useEffect(() => {
    const cached = readImpactCache<ImpactPayload>();
    if (cached) {
      setPayload(cached);
      setLoadState("ready");
    }
    const controller = new AbortController();
    fetchImpactPayload(controller.signal)
      .then((data) => {
        const next = data as ImpactPayload;
        setPayload(next);
        setLoadState(
          typeof next?.totalAnalyses === "number" ? "ready" : "empty"
        );
      })
      .catch(() => {
        if (!cached) setLoadState("empty");
      });
    return () => controller.abort();
  }, []);

  const continents = useMemo(() => {
    const set = new Set<string>();
    for (const row of payload?.countries || []) {
      const c = continentForCountryName(row.name);
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [payload]);

  const analyses = payload?.totalAnalyses ?? 0;
  const countries = payload?.totalCountries ?? 0;
  const regions = payload?.totalRegions ?? 0;
  const continentCount = continents.length;
  const todayLabel = formatToday(language);

  const slides = useMemo(
    () => [
      {
        id: "founded",
        kicker: t.aboutStoryFoundedKicker,
        title: t.aboutStoryFoundedTitle.replace("{year}", String(FOUNDED_YEAR)),
        body: t.aboutIntro,
        icon: CalendarDays,
        metric: String(FOUNDED_YEAR),
        metricHint: t.aboutStoryFoundedHint,
        animate: false as const,
      },
      {
        id: "analyses",
        kicker: t.aboutStoryImpactKicker,
        title: t.aboutStoryAnalysesTitle,
        body: t.aboutStoryAnalysesBody.replace("{date}", todayLabel),
        icon: Sparkles,
        metric: analyses,
        metricHint: t.impactAnalyses,
        animate: true as const,
      },
      {
        id: "continents",
        kicker: t.aboutStoryReachKicker,
        title: t.aboutStoryContinentsTitle,
        body: t.aboutStoryContinentsBody
          .replace("{continents}", String(Math.max(continentCount, 1)))
          .replace("{countries}", String(Math.max(countries, 0)))
          .replace("{date}", todayLabel),
        icon: Globe2,
        metric: Math.max(continentCount, countries > 0 ? 1 : 0),
        metricHint: t.aboutStoryContinentsHint,
        animate: true as const,
        chips: continents,
      },
      {
        id: "regions",
        kicker: t.aboutStoryFieldKicker,
        title: t.aboutStoryRegionsTitle,
        body: t.aboutStoryRegionsBody.replace("{date}", todayLabel),
        icon: MapPin,
        metric: regions,
        metricHint: t.impactRegions,
        animate: true as const,
      },
    ],
    [
      analyses,
      continentCount,
      continents,
      countries,
      regions,
      t,
      todayLabel,
    ]
  );

  const modes: { id: StoryMode; label: string }[] = [
    { id: "journey", label: t.aboutStoryEyebrow },
    { id: "mission", label: t.aboutMissionLabel },
    { id: "vision", label: t.aboutVisionLabel },
    { id: "values", label: t.aboutValuesLabel },
  ];

  const slideCount = slides.length;
  const slide = slides[index] ?? slides[0];
  const journeyActive = mode === "journey";
  const animatedMetric = useCountUp(
    typeof slide.metric === "number" ? slide.metric : 0,
    journeyActive && Boolean(slide.animate) && loadState !== "loading",
    950
  );

  useEffect(() => {
    if (!journeyActive || paused || reducedMotion || slideCount < 2) return;
    const id = window.setInterval(() => {
      setDir(1);
      setIndex((i) => (i + 1) % slideCount);
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [journeyActive, paused, reducedMotion, slideCount]);

  function go(next: number, direction: 1 | -1) {
    setDir(direction);
    setIndex(((next % slideCount) + slideCount) % slideCount);
  }

  function onTouchStart(e: React.TouchEvent) {
    if (!journeyActive) return;
    touchX.current = e.touches[0]?.clientX ?? null;
    setPaused(true);
  }

  function onTouchEnd(e: React.TouchEvent) {
    if (!journeyActive) return;
    const start = touchX.current;
    touchX.current = null;
    setPaused(false);
    if (start == null) return;
    const end = e.changedTouches[0]?.clientX ?? start;
    const delta = end - start;
    if (Math.abs(delta) < 40) return;
    if (delta < 0) go(index + 1, 1);
    else go(index - 1, -1);
  }

  const Icon = slide.icon;
  const displayMetric = slide.animate
    ? loadState === "loading"
      ? "…"
      : animatedMetric.toLocaleString(language || undefined)
    : String(slide.metric);

  return (
    <section
      className="about-story"
      aria-roledescription={journeyActive ? "carousel" : undefined}
      aria-label={t.aboutStoryLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setPaused(false);
        }
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <div className="about-story__glow" aria-hidden />
      <div className="about-story__top">
        <div className="about-story__modes" role="tablist" aria-label={t.aboutPillarsLabel}>
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={mode === item.id}
              className={`about-story__mode${mode === item.id ? " is-active" : ""}`}
              onClick={() => setMode(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
        {journeyActive ? (
          <div className="about-story__nav">
            <button
              type="button"
              className="about-story__arrow"
              aria-label={t.aboutStoryPrev}
              onClick={() => go(index - 1, -1)}
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="about-story__arrow"
              aria-label={t.aboutStoryNext}
              onClick={() => go(index + 1, 1)}
            >
              <ChevronRight size={18} aria-hidden />
            </button>
          </div>
        ) : null}
      </div>

      <div className="about-story__stage" aria-live="polite">
        {journeyActive ? (
          <article
            key={slide.id}
            className={`about-story__slide about-story__slide--${dir > 0 ? "in-right" : "in-left"}`}
          >
            <div
              className="about-story__metric"
              aria-hidden={slide.id === "founded"}
            >
              <span className="about-story__metric-icon">
                <Icon size={20} aria-hidden />
              </span>
              <strong className="about-story__metric-value">{displayMetric}</strong>
              <span className="about-story__metric-hint">{slide.metricHint}</span>
            </div>
            <div className="about-story__copy">
              <p className="about-story__kicker">{slide.kicker}</p>
              <h3 className="about-story__title">{slide.title}</h3>
              <p className="about-story__body">{slide.body}</p>
              {"chips" in slide && slide.chips && slide.chips.length > 0 ? (
                <ul className="about-story__chips">
                  {slide.chips.map((name) => (
                    <li key={name}>{name}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </article>
        ) : mode === "mission" ? (
          <article key="mission" className="about-story__pillar about-story__slide--in-right">
            <div className="about-story__pillar-head">
              <span className="about-story__pillar-icon" aria-hidden>
                <Compass size={20} />
              </span>
              <h3 className="about-story__title">{t.aboutMissionLabel}</h3>
            </div>
            <p className="about-story__body about-story__body--long">{t.aboutMission}</p>
          </article>
        ) : mode === "vision" ? (
          <article key="vision" className="about-story__pillar about-story__slide--in-right">
            <div className="about-story__pillar-head">
              <span className="about-story__pillar-icon" aria-hidden>
                <Eye size={20} />
              </span>
              <h3 className="about-story__title">{t.aboutVisionLabel}</h3>
            </div>
            <p className="about-story__body about-story__body--long">{t.aboutVision}</p>
          </article>
        ) : (
          <article key="values" className="about-story__pillar about-story__slide--in-right">
            <div className="about-story__pillar-head">
              <span className="about-story__pillar-icon" aria-hidden>
                <HeartHandshake size={20} />
              </span>
              <h3 className="about-story__title">{t.aboutValuesLabel}</h3>
            </div>
            <ul className="about-story__values">
              <li>
                <strong>{t.aboutValue1Title}</strong>
                <span>{t.aboutValue1Body}</span>
              </li>
              <li>
                <strong>{t.aboutValue2Title}</strong>
                <span>{t.aboutValue2Body}</span>
              </li>
              <li>
                <strong>{t.aboutValue3Title}</strong>
                <span>{t.aboutValue3Body}</span>
              </li>
            </ul>
          </article>
        )}
      </div>

      {journeyActive ? (
        <>
          <div className="about-story__dots" role="tablist" aria-label={t.aboutStoryLabel}>
            {slides.map((item, i) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${item.kicker}`}
                className={`about-story__dot${i === index ? " is-active" : ""}`}
                onClick={() => go(i, i > index ? 1 : -1)}
              />
            ))}
          </div>

          <div className="about-story__progress" aria-hidden>
            <span
              key={index}
              className={`about-story__progress-bar${
                paused || reducedMotion ? " is-paused" : ""
              }`}
            />
          </div>
        </>
      ) : null}
    </section>
  );
}
