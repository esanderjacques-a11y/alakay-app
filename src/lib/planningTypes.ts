export type PlanningSource = "recommended" | "manual";

export type CalendarEventLine = {
  nutrient: string;
  kgHa: number;
  unitHa: string;
  percentOfTotal?: number;
  method?: string;
};

export type CalendarEvent = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  farmName?: string;
  lotName?: string;
  nutrient?: string;
  rate?: string;
  method?: string;
  placeNote?: string;
  source: PlanningSource;
  createdAt: string;
  completed?: boolean;
  /** Order in the fertilization sequence (1 = first application). */
  sequence?: number;
  stageKey?: string;
  stageLabel?: string;
  /** Groups events from one generated schedule. */
  planId?: string;
  lines?: CalendarEventLine[];
};

export type UserNote = {
  id: string;
  title: string;
  body: string;
  farmName?: string;
  lotName?: string;
  remindAt?: string | null; // ISO
  source: PlanningSource;
  createdAt: string;
  updatedAt: string;
};

export type AppNotificationKind =
  | "reminder"
  | "calendar"
  | "location"
  | "cost"
  | "general";

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  kind: AppNotificationKind;
  createdAt: string;
  read: boolean;
  /** Deep-link step when supported. */
  hrefStep?:
    | "calendar"
    | "notes"
    | "setup"
    | "calculators"
    | "notifications"
    | "farms"
    | "history";
  relatedId?: string;
  /** When to surface (ISO); if missing, immediate. */
  dueAt?: string | null;
};
