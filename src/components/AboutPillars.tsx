"use client";

import { useState } from "react";
import { Compass, Eye, HeartHandshake } from "lucide-react";
import type { Translation } from "@/lib/translations";

type PillarId = "mission" | "vision" | "values";

type Props = {
  t: Translation;
};

const PILLARS: {
  id: PillarId;
  icon: typeof Compass;
  labelKey: "aboutMissionLabel" | "aboutVisionLabel" | "aboutValuesLabel";
  bodyKey: "aboutMission" | "aboutVision" | "aboutValues";
}[] = [
  {
    id: "mission",
    icon: Compass,
    labelKey: "aboutMissionLabel",
    bodyKey: "aboutMission",
  },
  {
    id: "vision",
    icon: Eye,
    labelKey: "aboutVisionLabel",
    bodyKey: "aboutVision",
  },
  {
    id: "values",
    icon: HeartHandshake,
    labelKey: "aboutValuesLabel",
    bodyKey: "aboutValues",
  },
];

export default function AboutPillars({ t }: Props) {
  const [active, setActive] = useState<PillarId>("mission");
  const current = PILLARS.find((p) => p.id === active) ?? PILLARS[0];
  const Icon = current.icon;

  return (
    <section className="about-pillars" aria-label={t.aboutPillarsLabel}>
      <div className="about-pillars__head">
        <p className="about-pillars__eyebrow">{t.aboutPillarsEyebrow}</p>
        <h2 className="about-pillars__title">{t.aboutPillarsTitle}</h2>
        <p className="about-pillars__lede">{t.aboutPillarsLede}</p>
      </div>

      <div className="about-pillars__tabs" role="tablist" aria-label={t.aboutPillarsLabel}>
        {PILLARS.map((pillar) => {
          const TabIcon = pillar.icon;
          const selected = pillar.id === active;
          return (
            <button
              key={pillar.id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`about-pillar-tab-${pillar.id}`}
              aria-controls={`about-pillar-panel-${pillar.id}`}
              className={`about-pillars__tab${selected ? " is-active" : ""}`}
              onClick={() => setActive(pillar.id)}
            >
              <span className="about-pillars__tab-icon" aria-hidden>
                <TabIcon size={16} />
              </span>
              <span>{t[pillar.labelKey]}</span>
            </button>
          );
        })}
      </div>

      <div
        key={current.id}
        id={`about-pillar-panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`about-pillar-tab-${current.id}`}
        className="about-pillars__panel"
      >
        <div className="about-pillars__panel-icon" aria-hidden>
          <Icon size={22} />
        </div>
        <h3 className="about-pillars__panel-label">{t[current.labelKey]}</h3>
        <p className="about-pillars__panel-body">{t[current.bodyKey]}</p>

        {current.id === "values" ? (
          <ul className="about-pillars__values">
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
        ) : null}
      </div>
    </section>
  );
}
