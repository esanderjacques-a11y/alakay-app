import type {
  AppNotification,
  CalendarEvent,
  PlanningSource,
  UserNote,
} from "@/lib/planningTypes";
import {
  buildFertilizationSchedule,
  scheduleWindowsToEvents,
} from "@/lib/fertilizationSchedule";
import type { Language } from "@/lib/i18n";
import {
  deleteCalendarEventRemote,
  deleteUserNoteRemote,
  fetchPlanningBundle,
  pushPlanningBundle,
  replaceRecommendedEventsRemote,
  upsertCalendarEventRemote,
  upsertNotificationRemote,
  upsertUserNoteRemote,
} from "@/lib/planningRepository";

const STORAGE_KEY = "cultosol_planning_v1";

type PlanningState = {
  events: CalendarEvent[];
  notes: UserNote[];
  notifications: AppNotification[];
};

const EMPTY: PlanningState = {
  events: [],
  notes: [],
  notifications: [],
};

let activeUserId: string | null = null;
let hydratePromise: Promise<void> | null = null;

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function readState(): PlanningState {
  if (typeof window === "undefined") return { ...EMPTY };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed = JSON.parse(raw) as Partial<PlanningState>;
    return {
      events: Array.isArray(parsed.events) ? parsed.events : [],
      notes: Array.isArray(parsed.notes) ? parsed.notes : [],
      notifications: Array.isArray(parsed.notifications)
        ? parsed.notifications
        : [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function writeState(state: PlanningState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota
  }
}

function queueRemote(task: () => Promise<void>) {
  if (!activeUserId) return;
  void task().catch((error) => {
    console.warn("planning sync:", error);
  });
}

function mergeById<T extends { id: string; createdAt?: string; updatedAt?: string }>(
  local: T[],
  remote: T[],
  preferUpdated = false
): T[] {
  const map = new Map<string, T>();
  for (const item of remote) map.set(item.id, item);
  for (const item of local) {
    const existing = map.get(item.id);
    if (!existing) {
      map.set(item.id, item);
      continue;
    }
    if (!preferUpdated) continue;
    const localTs = Date.parse(item.updatedAt || item.createdAt || "") || 0;
    const remoteTs =
      Date.parse(existing.updatedAt || existing.createdAt || "") || 0;
    if (localTs >= remoteTs) map.set(item.id, item);
  }
  return Array.from(map.values());
}

export function getPlanningUserId() {
  return activeUserId;
}

export function setPlanningUserId(userId: string | null) {
  activeUserId = userId;
}

/** Load cloud planning for signed-in user; merge with any guest local data and push up. */
export async function hydratePlanningFromCloud(userId: string): Promise<void> {
  activeUserId = userId;
  if (hydratePromise) return hydratePromise;
  hydratePromise = (async () => {
    const local = readState();
    const remote = await fetchPlanningBundle(userId);
    const merged: PlanningState = {
      events: mergeById(local.events, remote.events),
      notes: mergeById(local.notes, remote.notes, true),
      notifications: mergeById(local.notifications, remote.notifications),
    };
    writeState(merged);

    const remoteIds = {
      events: new Set(remote.events.map((e) => e.id)),
      notes: new Set(remote.notes.map((n) => n.id)),
      notifications: new Set(remote.notifications.map((n) => n.id)),
    };
    const onlyLocal: PlanningState = {
      events: merged.events.filter((e) => !remoteIds.events.has(e.id)),
      notes: merged.notes.filter((n) => !remoteIds.notes.has(n.id)),
      notifications: merged.notifications.filter(
        (n) => !remoteIds.notifications.has(n.id)
      ),
    };
    if (
      onlyLocal.events.length ||
      onlyLocal.notes.length ||
      onlyLocal.notifications.length
    ) {
      await pushPlanningBundle(userId, onlyLocal);
    }
  })()
    .catch((error) => {
      console.warn("planning hydrate failed:", error);
    })
    .finally(() => {
      hydratePromise = null;
    });
  return hydratePromise;
}

export function loadPlanningState(): PlanningState {
  return readState();
}

export function saveCalendarEvent(
  input: Omit<CalendarEvent, "id" | "createdAt"> & { id?: string }
): CalendarEvent {
  const state = readState();
  const now = new Date().toISOString();
  if (input.id) {
    const index = state.events.findIndex((e) => e.id === input.id);
    const next: CalendarEvent = {
      ...(index >= 0 ? state.events[index] : { createdAt: now }),
      ...input,
      id: input.id,
      createdAt: index >= 0 ? state.events[index].createdAt : now,
    } as CalendarEvent;
    if (index >= 0) state.events[index] = next;
    else state.events.unshift(next);
    writeState(state);
    queueRemote(() => upsertCalendarEventRemote(activeUserId!, next));
    return next;
  }
  const created: CalendarEvent = {
    ...input,
    id: uid(),
    createdAt: now,
  };
  state.events.unshift(created);
  writeState(state);
  queueRemote(() => upsertCalendarEventRemote(activeUserId!, created));
  return created;
}

export function deleteCalendarEvent(id: string) {
  const state = readState();
  state.events = state.events.filter((e) => e.id !== id);
  writeState(state);
  queueRemote(() => deleteCalendarEventRemote(activeUserId!, id));
}

export function toggleCalendarEventCompleted(id: string) {
  const state = readState();
  const item = state.events.find((e) => e.id === id);
  if (!item) return;
  item.completed = !item.completed;
  writeState(state);
  queueRemote(() => upsertCalendarEventRemote(activeUserId!, item));
}

/** Remove previous recommended schedule for a farm (keeps manual events). */
export function clearRecommendedPlanForFarm(farmName: string, planId?: string) {
  const state = readState();
  const farm = farmName.trim().toLocaleLowerCase();
  const removed = state.events.filter((event) => {
    if (event.source !== "recommended") return false;
    if ((event.farmName || "").trim().toLocaleLowerCase() !== farm) return false;
    if (planId && event.planId && event.planId !== planId) return false;
    return true;
  });
  state.events = state.events.filter((event) => !removed.includes(event));
  writeState(state);
  queueRemote(async () => {
    await replaceRecommendedEventsRemote(activeUserId!, farmName, planId);
  });
}

export function updateCalendarEventDate(id: string, date: string) {
  const state = readState();
  const item = state.events.find((e) => e.id === id);
  if (!item) return;
  item.date = date;
  writeState(state);
  queueRemote(() => upsertCalendarEventRemote(activeUserId!, item));
}

export function saveUserNote(
  input: Omit<UserNote, "id" | "createdAt" | "updatedAt"> & { id?: string }
): UserNote {
  const state = readState();
  const now = new Date().toISOString();
  if (input.id) {
    const index = state.notes.findIndex((n) => n.id === input.id);
    const next: UserNote = {
      ...(index >= 0
        ? state.notes[index]
        : {
            createdAt: now,
            updatedAt: now,
            source: "manual" as PlanningSource,
          }),
      ...input,
      id: input.id,
      createdAt: index >= 0 ? state.notes[index].createdAt : now,
      updatedAt: now,
    } as UserNote;
    if (index >= 0) state.notes[index] = next;
    else state.notes.unshift(next);
    writeState(state);
    maybeNotifyFromNote(next);
    queueRemote(() => upsertUserNoteRemote(activeUserId!, next));
    return next;
  }
  const created: UserNote = {
    ...input,
    id: uid(),
    createdAt: now,
    updatedAt: now,
  };
  state.notes.unshift(created);
  writeState(state);
  maybeNotifyFromNote(created);
  queueRemote(() => upsertUserNoteRemote(activeUserId!, created));
  return created;
}

export function deleteUserNote(id: string) {
  const state = readState();
  state.notes = state.notes.filter((n) => n.id !== id);
  writeState(state);
  queueRemote(() => deleteUserNoteRemote(activeUserId!, id));
}

export function pushNotification(
  input: Omit<AppNotification, "id" | "createdAt" | "read"> & {
    id?: string;
    read?: boolean;
  }
): AppNotification {
  const state = readState();
  const created: AppNotification = {
    ...input,
    id: input.id || uid(),
    createdAt: new Date().toISOString(),
    read: input.read ?? false,
  };
  if (created.relatedId) {
    const existing = state.notifications.find(
      (n) =>
        !n.read &&
        n.kind === created.kind &&
        n.relatedId === created.relatedId
    );
    if (existing) {
      existing.title = created.title;
      existing.body = created.body;
      existing.dueAt = created.dueAt;
      writeState(state);
      queueRemote(() => upsertNotificationRemote(activeUserId!, existing));
      return existing;
    }
  }
  state.notifications.unshift(created);
  writeState(state);
  queueRemote(() => upsertNotificationRemote(activeUserId!, created));
  return created;
}

export function markNotificationRead(id: string) {
  const state = readState();
  const item = state.notifications.find((n) => n.id === id);
  if (item) item.read = true;
  writeState(state);
  if (item) {
    queueRemote(() => upsertNotificationRemote(activeUserId!, item));
  }
}

export function markAllNotificationsRead() {
  const state = readState();
  for (const item of state.notifications) item.read = true;
  writeState(state);
  queueRemote(async () => {
    await Promise.all(
      state.notifications.map((item) =>
        upsertNotificationRemote(activeUserId!, item)
      )
    );
  });
}

export function unreadNotificationCount(now = new Date()): number {
  const state = readState();
  return state.notifications.filter((n) => {
    if (n.read) return false;
    if (n.dueAt && new Date(n.dueAt).getTime() > now.getTime()) return false;
    return true;
  }).length;
}

export function dueNotifications(now = new Date()): AppNotification[] {
  const state = readState();
  return state.notifications.filter((n) => {
    if (n.read) return false;
    if (n.dueAt && new Date(n.dueAt).getTime() > now.getTime()) return false;
    return true;
  });
}

function maybeNotifyFromNote(note: UserNote) {
  if (!note.remindAt) return;
  pushNotification({
    title: note.title || "Reminder",
    body: note.body.slice(0, 120) || "Note reminder",
    kind: "reminder",
    hrefStep: "notes",
    relatedId: note.id,
    dueAt: note.remindAt,
  });
}

/** Create draft fertilization calendar rows from nutritional plan doses. */
export function suggestEventsFromPlan(args: {
  doses: Array<{
    key?: string;
    nutrient: string;
    nutrientOxide?: string;
    dosisKgHa?: number | null;
    unitHa?: string;
    notRequired?: boolean;
    viaEncalado?: boolean;
  }>;
  cropName?: string | null;
  farmName?: string;
  lotName?: string;
  startDate?: string;
  language?: Language;
  stageLabels?: Parameters<typeof buildFertilizationSchedule>[0]["labels"];
}): CalendarEvent[] {
  const start = args.startDate || new Date().toISOString().slice(0, 10);
  const farmName = (args.farmName || "").trim();
  if (!farmName) return [];

  const windows = buildFertilizationSchedule({
    doses: args.doses,
    cropName: args.cropName,
    language: args.language,
    startDate: start,
    labels: args.stageLabels,
  });
  if (windows.length === 0) return [];

  const planId = uid();
  return scheduleWindowsToEvents({
    windows,
    startDate: start,
    farmName,
    lotName: args.lotName,
    cropName: args.cropName,
    planId,
  });
}

export function acceptSuggestedEvents(
  drafts: CalendarEvent[],
  options?: { replaceFarmPlan?: boolean }
) {
  if (drafts.length === 0) return;
  const farmName = drafts[0]?.farmName?.trim();
  if (options?.replaceFarmPlan !== false && farmName) {
    clearRecommendedPlanForFarm(farmName);
  }
  const state = readState();
  const now = new Date().toISOString();
  const createdEvents: CalendarEvent[] = [];
  const createdNotifications: AppNotification[] = [];
  for (const draft of drafts) {
    const event: CalendarEvent = {
      ...draft,
      id: uid(),
      source: "recommended",
      createdAt: now,
    };
    const notification: AppNotification = {
      id: uid(),
      title: event.title,
      body: `${event.date}${event.rate ? ` · ${event.rate}` : ""}`,
      kind: "calendar",
      hrefStep: "calendar",
      relatedId: event.id,
      dueAt: `${event.date}T08:00:00`,
      createdAt: now,
      read: false,
    };
    state.events.unshift(event);
    state.notifications.unshift(notification);
    createdEvents.push(event);
    createdNotifications.push(notification);
  }
  writeState(state);
  queueRemote(async () => {
    await Promise.all([
      ...createdEvents.map((event) =>
        upsertCalendarEventRemote(activeUserId!, event)
      ),
      ...createdNotifications.map((n) =>
        upsertNotificationRemote(activeUserId!, n)
      ),
    ]);
  });
}

/** Recommend a note from calendar gap / farm context (manual-editable). */
export function suggestNoteFromCalendar(args: {
  farmName?: string;
  lotName?: string;
  title: string;
  body: string;
  remindAt?: string | null;
}): UserNote {
  return saveUserNote({
    title: args.title,
    body: args.body,
    farmName: args.farmName,
    lotName: args.lotName,
    remindAt: args.remindAt ?? null,
    source: "recommended",
  });
}
