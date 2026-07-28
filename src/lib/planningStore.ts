import type {
  AppNotification,
  CalendarEvent,
  PlanningSource,
  SavedCalendar,
  UserNote,
} from "@/lib/planningTypes";
import {
  buildFertilizationSchedule,
  scheduleWindowsToEvents,
} from "@/lib/fertilizationSchedule";
import type { Language } from "@/lib/i18n";
import {
  deleteCalendarEventRemote,
  deleteNotificationsRemote,
  deleteSavedCalendarRemote,
  deleteUserNoteRemote,
  fetchPlanningBundle,
  pushPlanningBundle,
  replaceRecommendedEventsRemote,
  upsertCalendarEventRemote,
  upsertNotificationRemote,
  upsertSavedCalendarRemote,
  upsertUserNoteRemote,
} from "@/lib/planningRepository";

const STORAGE_KEY = "cultosol_planning_v1";
const DISMISSED_NOTIFS_KEY = "cultosol_notif_dismissed_v1";

/** Hours before the application morning (08:00) when the reminder becomes due. */
export const CALENDAR_NOTIFY_LEAD_MS = 18 * 60 * 60 * 1000;
/** How far ahead a notification may appear in the inbox (upcoming). */
export const NOTIFICATION_INBOX_LEAD_MS = 24 * 60 * 60 * 1000;
/** Drop stale delivered calendar reminders older than this. */
const NOTIFICATION_STALE_MS = 14 * 24 * 60 * 60 * 1000;

function dismissKey(kind: string, relatedId: string) {
  return `${kind}:${relatedId}`;
}

function readDismissedNotificationKeys(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DISMISSED_NOTIFS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeDismissedNotificationKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    DISMISSED_NOTIFS_KEY,
    JSON.stringify([...keys].slice(-300))
  );
}

/** Remember a dismissed related item so sync does not recreate it immediately. */
export function dismissNotificationRelation(
  kind: string,
  relatedId: string | null | undefined
) {
  if (!relatedId) return;
  const keys = readDismissedNotificationKeys();
  keys.add(dismissKey(kind, relatedId));
  writeDismissedNotificationKeys(keys);
}

function isNotificationRelationDismissed(
  kind: string,
  relatedId: string | null | undefined
) {
  if (!relatedId) return false;
  return readDismissedNotificationKeys().has(dismissKey(kind, relatedId));
}

type PlanningState = {
  events: CalendarEvent[];
  notes: UserNote[];
  notifications: AppNotification[];
  calendars: SavedCalendar[];
};

const EMPTY: PlanningState = {
  events: [],
  notes: [],
  notifications: [],
  calendars: [],
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
      calendars: Array.isArray(parsed.calendars) ? parsed.calendars : [],
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

function voidRemote(task: () => Promise<void>) {
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
      calendars: mergeById(local.calendars, remote.calendars, true),
    };
    writeState(merged);

    const remoteIds = {
      events: new Set(remote.events.map((e) => e.id)),
      notes: new Set(remote.notes.map((n) => n.id)),
      notifications: new Set(remote.notifications.map((n) => n.id)),
      calendars: new Set(remote.calendars.map((c) => c.id)),
    };
    const onlyLocal: PlanningState = {
      events: merged.events.filter((e) => !remoteIds.events.has(e.id)),
      notes: merged.notes.filter((n) => !remoteIds.notes.has(n.id)),
      notifications: merged.notifications.filter(
        (n) => !remoteIds.notifications.has(n.id)
      ),
      calendars: merged.calendars.filter((c) => !remoteIds.calendars.has(c.id)),
    };
    if (
      onlyLocal.events.length ||
      onlyLocal.notes.length ||
      onlyLocal.notifications.length ||
      onlyLocal.calendars.length
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

export function listSavedCalendars(farmName?: string): SavedCalendar[] {
  const state = readState();
  const farm = (farmName || "").trim().toLocaleLowerCase();
  const list = [...state.calendars].sort(
    (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)
  );
  if (!farm) return list;
  return list.filter(
    (c) => (c.farmName || "").trim().toLocaleLowerCase() === farm
  );
}

export function getSavedCalendar(id: string): SavedCalendar | null {
  return readState().calendars.find((c) => c.id === id) || null;
}

export function eventsForCalendar(calendarId: string): CalendarEvent[] {
  return readState().events.filter((e) => e.calendarId === calendarId);
}

export function upsertSavedCalendar(
  input: Omit<SavedCalendar, "id" | "createdAt" | "updatedAt"> & {
    id?: string;
  }
): SavedCalendar {
  const state = readState();
  const now = new Date().toISOString();
  if (input.id) {
    const index = state.calendars.findIndex((c) => c.id === input.id);
    const next: SavedCalendar = {
      ...(index >= 0
        ? state.calendars[index]
        : { createdAt: now, updatedAt: now }),
      ...input,
      id: input.id,
      name: input.name.trim() || input.farmName.trim() || "Calendar",
      farmName: input.farmName.trim(),
      createdAt: index >= 0 ? state.calendars[index].createdAt : now,
      updatedAt: now,
    };
    if (index >= 0) state.calendars[index] = next;
    else state.calendars.unshift(next);
    writeState(state);
    voidRemote(() => upsertSavedCalendarRemote(activeUserId!, next));
    return next;
  }
  const created: SavedCalendar = {
    ...input,
    id: uid(),
    name: input.name.trim() || input.farmName.trim() || "Calendar",
    farmName: input.farmName.trim(),
    createdAt: now,
    updatedAt: now,
  };
  state.calendars.unshift(created);
  writeState(state);
  voidRemote(() => upsertSavedCalendarRemote(activeUserId!, created));
  return created;
}

export function renameSavedCalendar(id: string, name: string): SavedCalendar | null {
  const existing = getSavedCalendar(id);
  if (!existing) return null;
  return upsertSavedCalendar({ ...existing, name: name.trim() || existing.name });
}

export function deleteSavedCalendar(id: string) {
  const state = readState();
  const removedEvents = state.events.filter((e) => e.calendarId === id);
  state.calendars = state.calendars.filter((c) => c.id !== id);
  state.events = state.events.filter((e) => e.calendarId !== id);
  writeState(state);
  voidRemote(async () => {
    await deleteSavedCalendarRemote(activeUserId!, id);
    await Promise.all(
      removedEvents.map((event) =>
        deleteCalendarEventRemote(activeUserId!, event.id)
      )
    );
  });
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
    voidRemote(() => upsertCalendarEventRemote(activeUserId!, next));
    return next;
  }
  const created: CalendarEvent = {
    ...input,
    id: uid(),
    createdAt: now,
  };
  state.events.unshift(created);
  writeState(state);
  voidRemote(() => upsertCalendarEventRemote(activeUserId!, created));
  return created;
}

export function deleteCalendarEvent(id: string) {
  const state = readState();
  state.events = state.events.filter((e) => e.id !== id);
  writeState(state);
  voidRemote(() => deleteCalendarEventRemote(activeUserId!, id));
}

export function toggleCalendarEventCompleted(id: string) {
  const state = readState();
  const item = state.events.find((e) => e.id === id);
  if (!item) return;
  item.completed = !item.completed;
  writeState(state);
  voidRemote(() => upsertCalendarEventRemote(activeUserId!, item));
}

/** Remove previous recommended schedule for a farm (keeps manual events). */
export function clearRecommendedPlanForFarm(
  farmName: string,
  planId?: string,
  calendarId?: string
) {
  const state = readState();
  const farm = farmName.trim().toLocaleLowerCase();
  const removed = state.events.filter((event) => {
    if (event.source !== "recommended") return false;
    if ((event.farmName || "").trim().toLocaleLowerCase() !== farm) return false;
    if (calendarId && event.calendarId !== calendarId) return false;
    if (planId && event.planId && event.planId !== planId) return false;
    return true;
  });
  state.events = state.events.filter((event) => !removed.includes(event));
  writeState(state);
  voidRemote(async () => {
    await replaceRecommendedEventsRemote(
      activeUserId!,
      farmName,
      planId,
      calendarId
    );
  });
}

export function updateCalendarEventDate(id: string, date: string) {
  const state = readState();
  const item = state.events.find((e) => e.id === id);
  if (!item) return;
  item.date = date;
  writeState(state);
  voidRemote(() => upsertCalendarEventRemote(activeUserId!, item));
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
    voidRemote(() => upsertUserNoteRemote(activeUserId!, next));
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
  voidRemote(() => upsertUserNoteRemote(activeUserId!, created));
  return created;
}

export function deleteUserNote(id: string) {
  const state = readState();
  state.notes = state.notes.filter((n) => n.id !== id);
  writeState(state);
  voidRemote(() => deleteUserNoteRemote(activeUserId!, id));
}

export function calendarEventNotifyAt(eventDate: string): string {
  const morning = new Date(`${eventDate}T08:00:00`);
  if (!Number.isFinite(morning.getTime())) {
    return `${eventDate}T08:00:00`;
  }
  return new Date(morning.getTime() - CALENDAR_NOTIFY_LEAD_MS).toISOString();
}

function notificationDueMs(item: AppNotification): number | null {
  if (!item.dueAt) return null;
  const ms = new Date(item.dueAt).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** True when the reminder should count as pending / actionable. */
export function isNotificationDue(
  item: AppNotification,
  now = new Date()
): boolean {
  if (item.read) return false;
  const dueMs = notificationDueMs(item);
  if (dueMs == null) return true;
  return dueMs <= now.getTime();
}

/**
 * Inbox visibility: already due, or becoming due within the next 24h.
 * Far-future calendar rows (months/years ahead) stay out of the list.
 */
export function isNotificationInInbox(
  item: AppNotification,
  now = new Date()
): boolean {
  const dueMs = notificationDueMs(item);
  if (dueMs == null) return true;
  if (dueMs > now.getTime() + NOTIFICATION_INBOX_LEAD_MS) return false;
  if (dueMs < now.getTime() - NOTIFICATION_STALE_MS) return false;
  return true;
}

export function inboxNotifications(now = new Date()): AppNotification[] {
  const state = readState();
  return state.notifications
    .filter((item) => isNotificationInInbox(item, now))
    .sort((a, b) => {
      const aDue = a.dueAt || a.createdAt;
      const bDue = b.dueAt || b.createdAt;
      return bDue.localeCompare(aDue);
    });
}

/** Remove far-future calendar spam left from older app versions. */
export function pruneFarFutureNotifications(now = new Date()): number {
  const state = readState();
  const before = state.notifications.length;
  const keep: AppNotification[] = [];
  const removedIds: string[] = [];
  for (const item of state.notifications) {
    const dueMs = notificationDueMs(item);
    const farFuture =
      item.kind === "calendar" &&
      dueMs != null &&
      dueMs > now.getTime() + NOTIFICATION_INBOX_LEAD_MS;
    const stale =
      dueMs != null && dueMs < now.getTime() - NOTIFICATION_STALE_MS && item.read;
    if (farFuture || stale) {
      removedIds.push(item.id);
      continue;
    }
    keep.push(item);
  }
  if (removedIds.length === 0) return 0;
  state.notifications = keep;
  writeState(state);
  voidRemote(() => deleteNotificationsRemote(activeUserId!, removedIds));
  return before - keep.length;
}

/**
 * Create near-term calendar reminders from accepted events.
 * Far applications stay on the calendar only until they enter the lead window.
 */
export function syncCalendarDueNotifications(now = new Date()): number {
  const state = readState();
  let created = 0;
  const horizon = now.getTime() + NOTIFICATION_INBOX_LEAD_MS;

  for (const event of state.events) {
    if (!event.date) continue;
    const dueAt = calendarEventNotifyAt(event.date);
    const dueMs = new Date(dueAt).getTime();
    if (!Number.isFinite(dueMs)) continue;
    // Not yet in the near window
    if (dueMs > horizon) continue;
    // Too old to resurface
    if (dueMs < now.getTime() - NOTIFICATION_STALE_MS) continue;

    const existing = state.notifications.find(
      (n) => n.kind === "calendar" && n.relatedId === event.id
    );
    if (existing) continue;
    if (isNotificationRelationDismissed("calendar", event.id)) continue;

    const notification: AppNotification = {
      id: uid(),
      title: event.title,
      body: event.rate?.trim() || event.placeNote?.trim() || "",
      kind: "calendar",
      hrefStep: "calendar",
      relatedId: event.id,
      dueAt,
      createdAt: now.toISOString(),
      read: false,
    };
    state.notifications.unshift(notification);
    created += 1;
    voidRemote(() => upsertNotificationRemote(activeUserId!, notification));
  }

  if (created > 0) writeState(state);
  return created;
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
      voidRemote(() => upsertNotificationRemote(activeUserId!, existing));
      return existing;
    }
  }
  state.notifications.unshift(created);
  writeState(state);
  voidRemote(() => upsertNotificationRemote(activeUserId!, created));
  return created;
}

export function markNotificationRead(id: string) {
  const state = readState();
  const item = state.notifications.find((n) => n.id === id);
  if (item) item.read = true;
  writeState(state);
  if (item) {
    voidRemote(() => upsertNotificationRemote(activeUserId!, item));
  }
}

export function markAllNotificationsRead() {
  const state = readState();
  for (const item of state.notifications) item.read = true;
  writeState(state);
  voidRemote(async () => {
    await Promise.all(
      state.notifications.map((item) =>
        upsertNotificationRemote(activeUserId!, item)
      )
    );
  });
}

export function removeNotification(id: string) {
  const state = readState();
  const target = state.notifications.find((item) => item.id === id);
  const next = state.notifications.filter((item) => item.id !== id);
  if (next.length === state.notifications.length) return;
  if (target) {
    dismissNotificationRelation(target.kind, target.relatedId);
  }
  state.notifications = next;
  writeState(state);
  voidRemote(() => deleteNotificationsRemote(activeUserId!, [id]));
}

export function clearAllNotifications() {
  const state = readState();
  const ids = state.notifications.map((item) => item.id);
  if (ids.length === 0) return;
  for (const item of state.notifications) {
    dismissNotificationRelation(item.kind, item.relatedId);
  }
  state.notifications = [];
  writeState(state);
  voidRemote(() => deleteNotificationsRemote(activeUserId!, ids));
}

export function unreadNotificationCount(now = new Date()): number {
  return dueNotifications(now).length;
}

export function dueNotifications(now = new Date()): AppNotification[] {
  const state = readState();
  return state.notifications.filter((n) => isNotificationDue(n, now));
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
  endDate?: string;
  purpose?: Parameters<typeof buildFertilizationSchedule>[0]["purpose"];
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
    endDate: args.endDate,
    purpose: args.purpose,
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
  options?: {
    replaceFarmPlan?: boolean;
    calendarId?: string;
  }
) {
  if (drafts.length === 0) return;
  const farmName = drafts[0]?.farmName?.trim();
  if (options?.replaceFarmPlan !== false && farmName) {
    clearRecommendedPlanForFarm(farmName, undefined, options?.calendarId);
  }
  const state = readState();
  const now = new Date().toISOString();
  const createdEvents: CalendarEvent[] = [];
  for (const draft of drafts) {
    const event: CalendarEvent = {
      ...draft,
      id: uid(),
      source: "recommended",
      createdAt: now,
      calendarId: options?.calendarId || draft.calendarId,
    };
    state.events.unshift(event);
    createdEvents.push(event);
  }
  writeState(state);
  // Near-term reminders only - far dates stay on the calendar until lead time.
  syncCalendarDueNotifications();
  pruneFarFutureNotifications();
  voidRemote(async () => {
    await Promise.all(
      createdEvents.map((event) =>
        upsertCalendarEventRemote(activeUserId!, event)
      )
    );
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
