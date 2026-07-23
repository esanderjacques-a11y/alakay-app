import type { SettingsSectionId } from "@/components/AppSettingsScreen";
import { getBillingText } from "@/lib/i18n/billingText";
import { calculatorHubText } from "@/lib/i18n/componentText";
import { scoreSearchMatch } from "@/lib/searchNormalize";
import type { Language, Translation } from "@/lib/translations";

export type HomeCalculatorKey =
  | "priority"
  | "cic"
  | "amendment"
  | "fertilizer"
  | "fertilizerCost"
  | "fertilizerFormulation"
  | "dop"
  | "uptake"
  | "salinity"
  | "graphs";

export type HomeSearchDestination =
  | { kind: "new-analysis" }
  | { kind: "import-camera" }
  | { kind: "import-file" }
  | { kind: "import-menu" }
  | { kind: "history" }
  | { kind: "calculators"; calculatorKey?: HomeCalculatorKey }
  | { kind: "farms" }
  | { kind: "farm"; farmId: number; farmName: string }
  | { kind: "calendar" }
  | { kind: "notes" }
  | { kind: "notifications" }
  | { kind: "settings"; section?: SettingsSectionId }
  | { kind: "billing" }
  | { kind: "about" }
  | { kind: "custom-data" }
  | { kind: "recycle" };

export type HomeSearchEntry = {
  id: string;
  title: string;
  subtitle?: string;
  section: string;
  keywords: string[];
  destination: HomeSearchDestination;
  /** Hide unless the user is signed in (not guest). */
  requiresAuth?: boolean;
};

type FarmHit = {
  farm_id: number;
  farm_name: string;
  location?: string | null;
};

const CALCULATOR_KEYS: HomeCalculatorKey[] = [
  "priority",
  "cic",
  "amendment",
  "fertilizer",
  "fertilizerCost",
  "fertilizerFormulation",
  "dop",
  "uptake",
  "salinity",
  "graphs",
];

const CALCULATOR_ALIASES: Record<HomeCalculatorKey, string[]> = {
  priority: ["recommended", "suggestions", "priority", "start here"],
  cic: [
    "cec",
    "cic",
    "bases",
    "ratios",
    "ca",
    "mg",
    "k",
    "na",
    "cation",
    "cations",
    "exchangeable",
    "base saturation",
    "saturation",
  ],
  amendment: [
    "ph",
    "p h",
    "lime",
    "liming",
    "gypsum",
    "amendment",
    "amendments",
    "acidity",
    "alkaline",
    "encalado",
    "cal",
  ],
  fertilizer: [
    "npk",
    "nutrient",
    "nutrition",
    "dose",
    "doses",
    "plan",
    "fertilisation",
    "fertilization",
    "fertiliser",
  ],
  fertilizerCost: [
    "price",
    "prices",
    "cost",
    "costs",
    "budget",
    "scenario",
    "scenarios",
    "money",
  ],
  fertilizerFormulation: [
    "blend",
    "mix",
    "formula",
    "formulation",
    "grade",
    "raw materials",
    "filler",
  ],
  dop: ["dop", "deviation", "optimum", "foliar index"],
  uptake: ["uptake", "absorption", "removal", "export"],
  salinity: [
    "ec",
    "salinity",
    "salt",
    "sar",
    "sodium",
    "conductivity",
    "leaching",
  ],
  graphs: ["graph", "graphs", "chart", "charts", "plot", "visual"],
};

export function buildHomeSearchCatalog(
  t: Translation,
  language: Language
): HomeSearchEntry[] {
  const p = t.planning;
  const hub = calculatorHubText[language] || calculatorHubText.en;
  const billing = getBillingText(language);
  const portal = t.customDataPortal;
  const entries: HomeSearchEntry[] = [
    {
      id: "action-input",
      title: t.inputData,
      subtitle: t.inputDataShort,
      section: t.home,
      keywords: [
        t.insertNew,
        t.insertNewDesc,
        t.startNewAnalysis,
        "manual",
        "enter values",
        "lab values",
        "soil",
        "foliar",
        "analysis",
      ],
      destination: { kind: "new-analysis" },
    },
    {
      id: "action-import",
      title: t.importData,
      subtitle: t.importDataShort,
      section: t.home,
      keywords: [
        t.importDataDesc,
        "upload",
        "excel",
        "csv",
        "pdf",
        "txt",
        "document",
        "camera",
        "photo",
        "scan",
      ],
      destination: { kind: "import-menu" },
    },
    {
      id: "action-import-camera",
      title: t.takePhoto,
      subtitle: t.takePhotoShort,
      section: `${t.home} › ${t.importData}`,
      keywords: [
        t.takePhotoDesc,
        "camera",
        "photo",
        "scan",
        "picture",
        "image",
        "ocr",
      ],
      destination: { kind: "import-camera" },
    },
    {
      id: "action-import-file",
      title: t.importDocument,
      subtitle: t.importDocumentShort,
      section: `${t.home} › ${t.importData}`,
      keywords: [
        "excel",
        "xlsx",
        "xls",
        "csv",
        "pdf",
        "txt",
        "file",
        "document",
        "spreadsheet",
      ],
      destination: { kind: "import-file" },
    },
    {
      id: "action-history",
      title: t.savedReports,
      subtitle: t.savedReportsShort,
      section: t.home,
      keywords: [t.history, "reports", "saved", "past", "results", "progress"],
      destination: { kind: "history" },
    },
    {
      id: "action-calculators",
      title: t.calculators,
      subtitle: t.calculatorsShort,
      section: t.home,
      keywords: [t.calculatorsDesc, "tools", "field tools", "hub"],
      destination: { kind: "calculators" },
    },
  ];

  for (const key of CALCULATOR_KEYS) {
    entries.push({
      id: `calculator-${key}`,
      title: hub[key] || key,
      subtitle: t.calculators,
      section: t.calculators,
      keywords: [
        ...(CALCULATOR_ALIASES[key] || []),
        hub[`${key}Desc`] || "",
        t.calculatorsDesc,
      ],
      destination: { kind: "calculators", calculatorKey: key },
    });
  }

  entries.push(
    {
      id: "planning-farms",
      title: p.myFarms,
      subtitle: p.viewAllFarms,
      section: p.farmsTitle,
      keywords: [
        p.farmsTitle,
        p.farmsDesc,
        p.addFarm,
        "farm",
        "farms",
        "lot",
        "lots",
        "field",
      ],
      destination: { kind: "farms" },
      requiresAuth: true,
    },
    {
      id: "planning-calendar",
      title: p.calendarTitle,
      subtitle: p.calendarDesc,
      section: p.farmsTitle,
      keywords: [
        t.planningCalendar,
        "schedule",
        "application",
        "timing",
        "season",
        "calendar",
      ],
      destination: { kind: "calendar" },
    },
    {
      id: "planning-notes",
      title: p.notesTitle,
      subtitle: p.notesDesc,
      section: p.farmsTitle,
      keywords: ["notes", "reminders", "memo", "field notes"],
      destination: { kind: "notes" },
    },
    {
      id: "planning-notifications",
      title: p.notificationsTitle,
      subtitle: p.notificationsDesc,
      section: p.farmsTitle,
      keywords: ["alerts", "reminders", "due", "notifications", "bell"],
      destination: { kind: "notifications" },
    },
    {
      id: "nav-settings",
      title: t.appSettings,
      subtitle: t.appSettingsDesc,
      section: t.appSettings,
      keywords: [
        t.quickSettings,
        t.appearance,
        "settings",
        "preferences",
        "theme",
        "language",
        "display",
      ],
      destination: { kind: "settings" },
    },
    {
      id: "settings-general",
      title: t.selectLanguage,
      subtitle: t.appearance,
      section: `${t.appSettings} › ${t.appearance}`,
      keywords: [
        "language",
        "theme",
        "dark",
        "light",
        "brightness",
        "saturation",
        "contrast",
        "font",
        "glass",
        "accent",
        "display",
      ],
      destination: { kind: "settings", section: "general" },
    },
    {
      id: "settings-account",
      title: t.account,
      subtitle: t.appSettings,
      section: `${t.appSettings} › ${t.account}`,
      keywords: ["profile", "login", "user", "account", "sign in"],
      destination: { kind: "settings", section: "account" },
    },
    {
      id: "settings-analysis",
      title: t.agronomicInterpretation,
      subtitle: t.appSettings,
      section: `${t.appSettings} › ${t.dataTools}`,
      keywords: [
        "analysis",
        "interpretation",
        "import",
        "ai",
        "reports",
        "export",
        "data",
        "formulas",
        "methodology",
      ],
      destination: { kind: "settings", section: "analysisData" },
    },
    {
      id: "nav-billing",
      title: billing.title,
      subtitle: billing.currentPlan,
      section: t.appSettings,
      keywords: [
        "billing",
        "plan",
        "subscription",
        "pro",
        "business",
        "payment",
        "invoice",
        billing.currentPlan,
      ],
      destination: { kind: "billing" },
    },
    {
      id: "nav-custom-data",
      title: t.customData,
      subtitle: t.customDataDesc,
      section: t.dataTools,
      keywords: [
        portal.parameters,
        portal.ranges,
        portal.fertilizers,
        "custom",
        "manage",
      ],
      destination: { kind: "custom-data" },
    },
    {
      id: "nav-recycle",
      title: t.recycleBin,
      subtitle: t.recycleBinDesc,
      section: t.dataTools,
      keywords: ["trash", "deleted", "restore", "bin", "recycle"],
      destination: { kind: "recycle" },
    },
    {
      id: "nav-about",
      title: t.about,
      subtitle: t.shortTagline,
      section: t.about,
      keywords: ["about", "info", "cultosol", "jacko", "help", "story"],
      destination: { kind: "about" },
    }
  );

  return entries;
}

export function buildFarmSearchEntries(
  farms: FarmHit[],
  t: Translation,
  locationUnknown: string
): HomeSearchEntry[] {
  return farms.map((farm) => ({
    id: `farm-${farm.farm_id}`,
    title: farm.farm_name,
    subtitle: farm.location || locationUnknown,
    section: t.planning.myFarms,
    keywords: [farm.farm_name, farm.location || "", "farm", "lote", "lot"],
    destination: {
      kind: "farm",
      farmId: farm.farm_id,
      farmName: farm.farm_name,
    },
    requiresAuth: true,
  }));
}

export function searchHomeCatalog(
  entries: HomeSearchEntry[],
  query: string,
  options?: { includeAuthOnly?: boolean }
): Array<HomeSearchEntry & { score: number }> {
  const includeAuthOnly = options?.includeAuthOnly !== false;
  const scored: Array<HomeSearchEntry & { score: number }> = [];

  for (const entry of entries) {
    if (entry.requiresAuth && !includeAuthOnly) continue;
    const score = scoreSearchMatch(
      [entry.title, entry.subtitle, entry.section, ...entry.keywords],
      query
    );
    if (score == null) continue;
    scored.push({ ...entry, score });
  }

  scored.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return scored;
}
