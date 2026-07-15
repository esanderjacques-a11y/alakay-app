import { translations, type Language } from "@/lib/i18n";

/** Canonical About-page facts Jacko should answer instantly (localized). */
export function formatJackoAboutForPrompt(language: string) {
  const lang = (language in translations ? language : "en") as Language;
  const t = translations[lang];
  return [
    "ABOUT CULTOSOL (from the About page — answer these immediately when asked; do not say you lack this information):",
    `- Product: Cultosol`,
    `- Tagline: ${t.aboutTagline}`,
    `- Developer / desarrollador / créateur: ${t.aboutCreatorFullName}`,
    `- Developer title: ${t.aboutDeveloperTitle}`,
    `- Developer country: ${t.aboutCreatorCountry}`,
    `- ${t.aboutMissionLabel}: ${t.aboutMission}`,
    `- ${t.aboutVisionLabel}: ${t.aboutVision}`,
    `- Intro: ${t.aboutIntro}`,
    `- Disclaimer: ${t.aboutDisclaimerShort}`,
    `- Contact email: jesander@earth.ac.cr`,
    `- Phone ${t.aboutPhoneCr}: +506 8828 7831`,
    `- Phone ${t.aboutPhoneHt}: +509 4422 9395`,
    `- LinkedIn: https://www.linkedin.com/in/jacques-esander/`,
    "When asked who created/built/developed Cultosol, answer: Esander Jacques (Agricultural Engineer and Data Analyst, Haiti).",
    "When asked for mission or vision, quote the About text above concisely.",
  ].join("\n");
}

export type JackoScreen =
  | "home"
  | "import"
  | "setup"
  | "values"
  | "results"
  | "calculators"
  | "history"
  | "about"
  | "recycle"
  | "settings"
  | "farms"
  | "calendar"
  | "notes"
  | "notifications"
  | string;

export type JackoEnteredValue = {
  key: string;
  name: string;
  value: string;
  unit?: string;
};

export type JackoInterpretation = {
  key: string;
  name: string;
  value: number;
  unit?: string;
  level: string;
  group: string;
  advice?: string;
};

export type JackoDose = {
  nutrient: string;
  oxide?: string;
  doseKgHa: number | null;
  notRequired?: boolean;
  viaEncalado?: boolean;
};

export type JackoCalendarHint = {
  title: string;
  date?: string;
  farmName?: string;
};

export type JackoAppContext = {
  screen: JackoScreen;
  sampleType?: "soil" | "foliar";
  crop?: string;
  farmName?: string;
  lotName?: string;
  analysisName?: string;
  country?: string;
  province?: string;
  extractionMethod?: string;
  enteredValues?: JackoEnteredValue[];
  interpretations?: JackoInterpretation[];
  missingParameters?: string[];
  fertilizerDoses?: JackoDose[];
  fertilizerAreaHa?: number;
  planRecommendations?: string[];
  upcomingEvents?: JackoCalendarHint[];
  noteCount?: number;
};

const GROUP_PRIORITY: Record<string, number> = {
  negative: 0,
  warning: 1,
  positive: 2,
  normal: 3,
  neutral: 4,
};

function clipText(value: string, max = 220) {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function sortInterpretations(items: JackoInterpretation[]) {
  return [...items].sort((a, b) => {
    const ga = GROUP_PRIORITY[a.group] ?? 9;
    const gb = GROUP_PRIORITY[b.group] ?? 9;
    if (ga !== gb) return ga - gb;
    return a.name.localeCompare(b.name);
  });
}

/** Compact, model-friendly snapshot of the user's current Cultosol session. */
export function formatJackoContextForPrompt(context: JackoAppContext | null | undefined) {
  if (!context) return "";

  const lines: string[] = [
    "APP CONTEXT (live Cultosol session — use this instead of asking the user to retype values):",
    `- Screen: ${context.screen}`,
  ];

  if (context.sampleType) lines.push(`- Sample type: ${context.sampleType}`);
  if (context.crop) lines.push(`- Crop: ${context.crop}`);
  if (context.farmName) lines.push(`- Farm: ${context.farmName}`);
  if (context.lotName) lines.push(`- Lot: ${context.lotName}`);
  if (context.analysisName) lines.push(`- Analysis: ${context.analysisName}`);
  if (context.country || context.province) {
    lines.push(
      `- Location: ${[context.province, context.country].filter(Boolean).join(", ")}`
    );
  }
  if (context.extractionMethod) {
    lines.push(`- Extraction method: ${context.extractionMethod}`);
  }

  const entered = (context.enteredValues || []).slice(0, 40);
  if (entered.length > 0) {
    lines.push("- Entered lab values:");
    for (const item of entered) {
      const unit = item.unit ? ` ${item.unit}` : "";
      lines.push(`  • ${item.name} (${item.key}): ${item.value}${unit}`);
    }
  }

  const interpretations = sortInterpretations(context.interpretations || []).slice(
    0,
    36
  );
  if (interpretations.length > 0) {
    lines.push("- Interpretation results (prioritized):");
    for (const item of interpretations) {
      const unit = item.unit ? ` ${item.unit}` : "";
      const advice = item.advice ? ` — ${clipText(item.advice, 140)}` : "";
      lines.push(
        `  • ${item.name}: ${item.value}${unit} · level=${item.level} · group=${item.group}${advice}`
      );
    }
  }

  if (context.missingParameters?.length) {
    lines.push(
      `- Missing / unmatched parameters: ${context.missingParameters
        .slice(0, 12)
        .join(", ")}`
    );
  }

  const doses = (context.fertilizerDoses || []).filter(
    (dose) => !dose.notRequired && (dose.doseKgHa == null || dose.doseKgHa > 0 || dose.viaEncalado)
  );
  if (doses.length > 0 || context.fertilizerAreaHa) {
    lines.push(
      `- Fertilizer plan area: ${
        context.fertilizerAreaHa != null ? `${context.fertilizerAreaHa} ha` : "n/a"
      }`
    );
    if (doses.length > 0) {
      lines.push("- Fertilizer / amendment doses:");
      for (const dose of doses.slice(0, 20)) {
        if (dose.viaEncalado) {
          lines.push(`  • ${dose.nutrient}: via liming/encalado`);
          continue;
        }
        const oxide = dose.oxide ? ` (${dose.oxide})` : "";
        lines.push(
          `  • ${dose.nutrient}${oxide}: ${
            dose.doseKgHa == null ? "—" : `${dose.doseKgHa} kg/ha`
          }`
        );
      }
    }
  }

  if (context.planRecommendations?.length) {
    lines.push("- Plan recommendations:");
    for (const tip of context.planRecommendations.slice(0, 8)) {
      lines.push(`  • ${clipText(tip, 180)}`);
    }
  }

  if (context.upcomingEvents?.length) {
    lines.push("- Upcoming calendar events:");
    for (const event of context.upcomingEvents.slice(0, 8)) {
      const when = event.date ? ` @ ${event.date}` : "";
      const farm = event.farmName ? ` · ${event.farmName}` : "";
      lines.push(`  • ${clipText(event.title, 120)}${when}${farm}`);
    }
  }

  if (typeof context.noteCount === "number") {
    lines.push(`- Saved notes: ${context.noteCount}`);
  }

  lines.push(
    "If the user asks for a quick recommendation, answer from this context first. Only ask for missing details that are truly not listed above."
  );

  return lines.join("\n").slice(0, 12000);
}

export function jackoContextHasData(context: JackoAppContext | null | undefined) {
  if (!context) return false;
  return Boolean(
    context.enteredValues?.length ||
      context.interpretations?.length ||
      context.fertilizerDoses?.some(
        (dose) => !dose.notRequired && ((dose.doseKgHa || 0) > 0 || dose.viaEncalado)
      ) ||
      context.planRecommendations?.length ||
      context.upcomingEvents?.length ||
      context.farmName ||
      context.crop
  );
}
