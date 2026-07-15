import type { CalendarEvent } from "@/lib/planningTypes";
import {
  getUptakeProfileForCrop,
  type UptakeProfile,
} from "@/lib/i18n/uptakeProfiles";
import type { Language } from "@/lib/i18n";

export type ScheduleDoseInput = {
  key?: string;
  nutrient: string;
  nutrientOxide?: string;
  dosisKgHa?: number | null;
  unitHa?: string;
  notRequired?: boolean;
  viaEncalado?: boolean;
};

/** Anchors nutrient windows — wording depends on crop cycle mode. */
export type ScheduleStageKey =
  | "amendment"
  | "basal"
  | "vegetative"
  | "reproductive";

/** annual = planting crops; perennial = banana/fruit trees; fruiting = tomato etc. */
export type ScheduleCycleMode = "annual" | "perennial" | "fruiting";

export type ScheduleLine = {
  nutrient: string;
  nutrientKey?: string;
  kgHa: number;
  unitHa: string;
  percentOfTotal: number;
  method: string;
  viaEncalado?: boolean;
};

export type ApplicationWindow = {
  sequence: number;
  stageKey: ScheduleStageKey;
  offsetDays: number;
  stageLabel: string;
  timingHint: string;
  lines: ScheduleLine[];
  cycleMode: ScheduleCycleMode;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

function addDays(isoDate: string, days: number) {
  const base = new Date(`${isoDate}T12:00:00`);
  return new Date(base.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

function nutrientFamily(dose: ScheduleDoseInput): "n" | "p" | "k" | "mg" | "ca" | "other" {
  const raw = `${dose.key || ""} ${dose.nutrient} ${dose.nutrientOxide || ""}`.toLowerCase();
  if (dose.viaEncalado || /\b(ca|cao|calcium|calcio|lime|yeso|gypsum)\b/.test(raw)) {
    return "ca";
  }
  if (/\b(n|nitrogen|nitrógeno|azote)\b/.test(raw) || dose.key === "n") return "n";
  if (/\b(p|p2o5|phosph|fósforo|fosforo)\b/.test(raw) || dose.key === "p") return "p";
  if (/\b(k|k2o|potass|potasio)\b/.test(raw) || dose.key === "k") return "k";
  if (/\b(mg|mgo|magnes)\b/.test(raw) || dose.key === "mg") return "mg";
  return "other";
}

type Family = Exclude<ReturnType<typeof nutrientFamily>, "other">;

const ANNUAL_SPLITS: Record<Family, Partial<Record<ScheduleStageKey, number>>> = {
  ca: { amendment: 1 },
  p: { basal: 1 },
  mg: { basal: 0.5, vegetative: 0.5 },
  k: { basal: 0.4, vegetative: 0.35, reproductive: 0.25 },
  n: { basal: 0.25, vegetative: 0.45, reproductive: 0.3 },
};

/** Heavier K toward flowering / filling; flush gets starter N/P. */
const PERENNIAL_SPLITS: Record<Family, Partial<Record<ScheduleStageKey, number>>> = {
  ca: { amendment: 0.7, reproductive: 0.3 },
  p: { basal: 0.55, vegetative: 0.45 },
  mg: { basal: 0.3, vegetative: 0.35, reproductive: 0.35 },
  k: { basal: 0.15, vegetative: 0.35, reproductive: 0.5 },
  n: { basal: 0.3, vegetative: 0.4, reproductive: 0.3 },
};

/** Fruiting annuals: more K/Ca toward bloom and fruit set. */
const FRUITING_SPLITS: Record<Family, Partial<Record<ScheduleStageKey, number>>> = {
  ca: { amendment: 0.4, vegetative: 0.3, reproductive: 0.3 },
  p: { basal: 0.7, vegetative: 0.3 },
  mg: { basal: 0.4, vegetative: 0.3, reproductive: 0.3 },
  k: { basal: 0.25, vegetative: 0.35, reproductive: 0.4 },
  n: { basal: 0.3, vegetative: 0.4, reproductive: 0.3 },
};

const ANNUAL_META: Record<
  ScheduleStageKey,
  { offsetDays: number; labelEn: string; hintEn: string }
> = {
  amendment: {
    offsetDays: -14,
    labelEn: "Before planting · Amendment",
    hintEn: "Apply liming / gypsum ahead of planting so soil chemistry can react.",
  },
  basal: {
    offsetDays: 0,
    labelEn: "Planting · Basal dose",
    hintEn: "Place immobile nutrients (P, part of K/Mg) and a starter share of N.",
  },
  vegetative: {
    offsetDays: 28,
    labelEn: "Vegetative · 1st topdress",
    hintEn: "Main nitrogen push while the crop is growing leaves and roots.",
  },
  reproductive: {
    offsetDays: 56,
    labelEn: "Reproductive · 2nd topdress",
    hintEn: "Finish remaining N/K for flowering, fruiting, or grain fill.",
  },
};

const PERENNIAL_META: Record<
  ScheduleStageKey,
  { offsetDays: number; labelEn: string; hintEn: string }
> = {
  amendment: {
    offsetDays: 0,
    labelEn: "Soil correction · Amendment",
    hintEn: "Correct soil chemistry any cycle — not tied to planting a new stand.",
  },
  basal: {
    offsetDays: 21,
    labelEn: "Vegetative flush · Start",
    hintEn: "Support new leaves / suckers after harvest or at cycle start.",
  },
  vegetative: {
    offsetDays: 120,
    labelEn: "Pre-flower / bunch initiation",
    hintEn: "Raise K and balance N before flowering or bunch differentiation.",
  },
  reproductive: {
    offsetDays: 210,
    labelEn: "Fruit fill · Quality",
    hintEn: "Finish K/Ca/Mg for filling, quality, and follower vigor.",
  },
};

const FRUITING_META: Record<
  ScheduleStageKey,
  { offsetDays: number; labelEn: string; hintEn: string }
> = {
  amendment: {
    offsetDays: -10,
    labelEn: "Before transplant · Amendment",
    hintEn: "Adjust pH / Ca before transplant or early growth when needed.",
  },
  basal: {
    offsetDays: 0,
    labelEn: "Transplant / early · Basal",
    hintEn: "Establish with P and a starter share of N/K.",
  },
  vegetative: {
    offsetDays: 35,
    labelEn: "Flowering / fruit set",
    hintEn: "Support bloom and early set — watch Ca and B balance.",
  },
  reproductive: {
    offsetDays: 70,
    labelEn: "Fruit fill · Harvest window",
    hintEn: "Finish K and Ca for filling and quality through harvest.",
  },
};

export function resolveScheduleCycleMode(
  cropName?: string | null,
  language: Language = "en"
): ScheduleCycleMode {
  if (!cropName?.trim()) return "annual";
  try {
    const profile = getUptakeProfileForCrop(cropName, language);
    if (profile.pattern === "perennial") return "perennial";
    if (profile.pattern === "fruiting") return "fruiting";
  } catch {
    // fall through
  }
  return "annual";
}

function splitsForMode(mode: ScheduleCycleMode) {
  if (mode === "perennial") return PERENNIAL_SPLITS;
  if (mode === "fruiting") return FRUITING_SPLITS;
  return ANNUAL_SPLITS;
}

function metaForMode(mode: ScheduleCycleMode) {
  if (mode === "perennial") return PERENNIAL_META;
  if (mode === "fruiting") return FRUITING_META;
  return ANNUAL_META;
}

function seasonSpanDays(mode: ScheduleCycleMode, profile: UptakeProfile | null) {
  if (mode === "perennial") {
    return Math.max(180, Math.min(360, (profile?.stages.length || 5) * 55));
  }
  if (mode === "fruiting") {
    return Math.max(70, Math.min(160, (profile?.stages.length || 5) * 22));
  }
  return Math.max(60, Math.min(150, (profile?.stages.length || 4) * 25));
}

/** Prefer uptake-profile stage names for perennial / fruiting crops. */
function profileLabelsForStage(
  mode: ScheduleCycleMode,
  stage: ScheduleStageKey,
  profile: UptakeProfile | null
): { label?: string; hint?: string } {
  if (!profile || profile.stages.length < 3) return {};
  const stages = profile.stages;
  if (mode === "perennial") {
    if (stage === "basal" && stages[1]) {
      return { label: stages[1].label, hint: stages[1].note };
    }
    if (stage === "vegetative" && stages[2]) {
      return { label: stages[2].label, hint: stages[2].note };
    }
    if (stage === "reproductive" && (stages[3] || stages[4])) {
      const s = stages[3] || stages[4];
      return { label: s.label, hint: s.note };
    }
  }
  if (mode === "fruiting") {
    if (stage === "basal" && stages[1]) {
      return { label: stages[1].label, hint: stages[1].note };
    }
    if (stage === "vegetative" && stages[2]) {
      return { label: stages[2].label, hint: stages[2].note };
    }
    if (stage === "reproductive" && stages[3]) {
      return { label: stages[3].label, hint: stages[3].note };
    }
  }
  return {};
}

function offsetsForMode(
  mode: ScheduleCycleMode,
  profile: UptakeProfile | null
): Record<ScheduleStageKey, number> {
  const meta = metaForMode(mode);
  const seasonDays = seasonSpanDays(mode, profile);
  const base = {
    amendment: meta.amendment.offsetDays,
    basal: meta.basal.offsetDays,
    vegetative: meta.vegetative.offsetDays,
    reproductive: meta.reproductive.offsetDays,
  };

  if (!profile || profile.stages.length < 3) return base;

  const uptakeOffset = (index: number, fallback: number) => {
    const stage = profile.stages[index];
    if (!stage) return fallback;
    return Math.round((stage.uptake / 100) * seasonDays);
  };

  if (mode === "perennial") {
    return {
      amendment: 0,
      basal: Math.max(7, uptakeOffset(1, base.basal) - 14),
      vegetative: uptakeOffset(2, base.vegetative),
      reproductive: uptakeOffset(3, base.reproductive),
    };
  }

  if (mode === "fruiting") {
    return {
      amendment: meta.amendment.offsetDays,
      basal: 0,
      vegetative: Math.max(21, Math.round(seasonDays * 0.4)),
      reproductive: Math.max(42, Math.round(seasonDays * 0.7)),
    };
  }

  // annual — stretch mid/late from profile span
  return {
    amendment: meta.amendment.offsetDays,
    basal: 0,
    vegetative: Math.round(seasonDays * 0.35),
    reproductive: Math.round(seasonDays * 0.65),
  };
}

/**
 * Build a split application schedule from nutritional-plan doses.
 * Mode follows crop uptake pattern (planting vs perennial fruiting cycles).
 */
export function buildFertilizationSchedule(args: {
  doses: ScheduleDoseInput[];
  cropName?: string | null;
  language?: Language;
  startDate?: string;
  labels?: Partial<Record<ScheduleStageKey, { label: string; hint: string }>>;
  cycleMode?: ScheduleCycleMode;
}): ApplicationWindow[] {
  const needed = args.doses.filter(
    (d) =>
      !d.notRequired &&
      d.dosisKgHa != null &&
      Number.isFinite(d.dosisKgHa) &&
      d.dosisKgHa > 0
  );
  if (needed.length === 0) return [];

  const language = args.language || "en";
  const mode =
    args.cycleMode || resolveScheduleCycleMode(args.cropName, language);

  let profile: UptakeProfile | null = null;
  if (args.cropName) {
    try {
      profile = getUptakeProfileForCrop(args.cropName, language);
    } catch {
      profile = null;
    }
  }

  const familySplits = splitsForMode(mode);
  const stageMeta = metaForMode(mode);
  const offsets = offsetsForMode(mode, profile);

  const buckets: Record<ScheduleStageKey, ScheduleLine[]> = {
    amendment: [],
    basal: [],
    vegetative: [],
    reproductive: [],
  };

  for (const dose of needed) {
    const family = nutrientFamily(dose);
    const total = dose.dosisKgHa!;
    const unit = dose.unitHa || "kg/ha";
    const method = dose.viaEncalado
      ? "Liming / amendment"
      : family === "n"
        ? "Topdress / sidedress"
        : "Incorporate / band";

    const splits =
      family === "other"
        ? ({ basal: 0.5, vegetative: 0.5 } as Partial<
            Record<ScheduleStageKey, number>
          >)
        : familySplits[family];

    for (const [stage, fraction] of Object.entries(splits) as Array<
      [ScheduleStageKey, number]
    >) {
      if (!(fraction > 0)) continue;
      const kgHa = round1(total * fraction);
      if (!(kgHa > 0)) continue;
      buckets[stage].push({
        nutrient: dose.nutrientOxide || dose.nutrient,
        nutrientKey: dose.key,
        kgHa,
        unitHa: unit,
        percentOfTotal: Math.round(fraction * 100),
        method: stage === "amendment" ? "Liming / amendment" : method,
        viaEncalado: dose.viaEncalado,
      });
    }
  }

  const order: ScheduleStageKey[] = [
    "amendment",
    "basal",
    "vegetative",
    "reproductive",
  ];

  const windows: ApplicationWindow[] = [];
  let sequence = 1;
  for (const stage of order) {
    const lines = buckets[stage];
    if (lines.length === 0) continue;
    const meta = stageMeta[stage];
    const custom = args.labels?.[stage];
    const fromProfile = profileLabelsForStage(mode, stage, profile);
    windows.push({
      sequence,
      stageKey: stage,
      offsetDays: offsets[stage],
      // Prefer crop uptake stage names (banana bunch initiation, etc.) when present.
      stageLabel: fromProfile.label || custom?.label || meta.labelEn,
      timingHint: fromProfile.hint || custom?.hint || meta.hintEn,
      lines,
      cycleMode: mode,
    });
    sequence += 1;
  }

  return windows;
}

export function scheduleWindowsToEvents(args: {
  windows: ApplicationWindow[];
  startDate: string;
  farmName: string;
  lotName?: string;
  cropName?: string | null;
  planId: string;
}): CalendarEvent[] {
  const now = new Date().toISOString();
  return args.windows.map((window) => {
    const date = addDays(args.startDate, window.offsetDays);
    const rate = window.lines
      .map((line) => `${line.nutrient} ${line.kgHa} ${line.unitHa}`)
      .join(" · ");
    return {
      id: `draft_${window.stageKey}_${window.sequence}`,
      title: `${window.sequence}. ${window.stageLabel}`,
      date,
      farmName: args.farmName,
      lotName: args.lotName,
      nutrient: window.lines.map((l) => l.nutrient).join(", "),
      rate,
      method: window.timingHint,
      placeNote: args.cropName || undefined,
      source: "recommended" as const,
      createdAt: now,
      sequence: window.sequence,
      stageKey: window.stageKey,
      stageLabel: window.stageLabel,
      planId: args.planId,
      lines: window.lines.map((line) => ({
        nutrient: line.nutrient,
        kgHa: line.kgHa,
        unitHa: line.unitHa,
        percentOfTotal: line.percentOfTotal,
        method: line.method,
      })),
    };
  });
}
