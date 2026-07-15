import { supabase } from "@/lib/supabase";
import type {
  AppNotification,
  CalendarEvent,
  CalendarEventLine,
  UserNote,
} from "@/lib/planningTypes";

type PlanningBundle = {
  events: CalendarEvent[];
  notes: UserNote[];
  notifications: AppNotification[];
};

function asLines(value: unknown): CalendarEventLine[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  return value as CalendarEventLine[];
}

export function eventToRow(userId: string, event: CalendarEvent) {
  return {
    id: event.id,
    user_id: userId,
    title: event.title,
    event_date: event.date,
    farm_name: event.farmName || null,
    lot_name: event.lotName || null,
    nutrient: event.nutrient || null,
    rate: event.rate || null,
    method: event.method || null,
    place_note: event.placeNote || null,
    source: event.source,
    completed: Boolean(event.completed),
    sequence: event.sequence ?? null,
    stage_key: event.stageKey || null,
    stage_label: event.stageLabel || null,
    plan_id: event.planId || null,
    lines: event.lines || [],
    created_at: event.createdAt,
    updated_at: new Date().toISOString(),
  };
}

export function rowToEvent(row: Record<string, unknown>): CalendarEvent {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    date: String(row.event_date || "").slice(0, 10),
    farmName: (row.farm_name as string | null) || undefined,
    lotName: (row.lot_name as string | null) || undefined,
    nutrient: (row.nutrient as string | null) || undefined,
    rate: (row.rate as string | null) || undefined,
    method: (row.method as string | null) || undefined,
    placeNote: (row.place_note as string | null) || undefined,
    source: row.source === "recommended" ? "recommended" : "manual",
    createdAt: String(row.created_at || new Date().toISOString()),
    completed: Boolean(row.completed),
    sequence: typeof row.sequence === "number" ? row.sequence : undefined,
    stageKey: (row.stage_key as string | null) || undefined,
    stageLabel: (row.stage_label as string | null) || undefined,
    planId: (row.plan_id as string | null) || undefined,
    lines: asLines(row.lines),
  };
}

export function noteToRow(userId: string, note: UserNote) {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    body: note.body || "",
    farm_name: note.farmName || null,
    lot_name: note.lotName || null,
    remind_at: note.remindAt || null,
    source: note.source,
    created_at: note.createdAt,
    updated_at: note.updatedAt,
  };
}

export function rowToNote(row: Record<string, unknown>): UserNote {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    body: String(row.body || ""),
    farmName: (row.farm_name as string | null) || undefined,
    lotName: (row.lot_name as string | null) || undefined,
    remindAt: (row.remind_at as string | null) || null,
    source: row.source === "recommended" ? "recommended" : "manual",
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || row.created_at || new Date().toISOString()),
  };
}

export function notificationToRow(userId: string, note: AppNotification) {
  return {
    id: note.id,
    user_id: userId,
    title: note.title,
    body: note.body || "",
    kind: note.kind,
    href_step: note.hrefStep || null,
    related_id: note.relatedId || null,
    due_at: note.dueAt || null,
    read: Boolean(note.read),
    created_at: note.createdAt,
  };
}

export function rowToNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: String(row.id),
    title: String(row.title || ""),
    body: String(row.body || ""),
    kind: (row.kind as AppNotification["kind"]) || "general",
    createdAt: String(row.created_at || new Date().toISOString()),
    read: Boolean(row.read),
    hrefStep: (row.href_step as AppNotification["hrefStep"]) || undefined,
    relatedId: (row.related_id as string | null) || undefined,
    dueAt: (row.due_at as string | null) || null,
  };
}

export async function fetchPlanningBundle(
  userId: string
): Promise<PlanningBundle> {
  const [eventsRes, notesRes, notificationsRes] = await Promise.all([
    supabase
      .from("calendar_events")
      .select("*")
      .eq("user_id", userId)
      .order("event_date", { ascending: true }),
    supabase
      .from("user_notes")
      .select("*")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false }),
    supabase
      .from("app_notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  if (eventsRes.error) throw new Error(eventsRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);
  if (notificationsRes.error) throw new Error(notificationsRes.error.message);

  return {
    events: (eventsRes.data || []).map((row) =>
      rowToEvent(row as Record<string, unknown>)
    ),
    notes: (notesRes.data || []).map((row) =>
      rowToNote(row as Record<string, unknown>)
    ),
    notifications: (notificationsRes.data || []).map((row) =>
      rowToNotification(row as Record<string, unknown>)
    ),
  };
}

export async function upsertCalendarEventRemote(
  userId: string,
  event: CalendarEvent
) {
  const { error } = await supabase
    .from("calendar_events")
    .upsert(eventToRow(userId, event), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function deleteCalendarEventRemote(userId: string, id: string) {
  const { error } = await supabase
    .from("calendar_events")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function upsertUserNoteRemote(userId: string, note: UserNote) {
  const { error } = await supabase
    .from("user_notes")
    .upsert(noteToRow(userId, note), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function deleteUserNoteRemote(userId: string, id: string) {
  const { error } = await supabase
    .from("user_notes")
    .delete()
    .eq("user_id", userId)
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function upsertNotificationRemote(
  userId: string,
  notification: AppNotification
) {
  const { error } = await supabase
    .from("app_notifications")
    .upsert(notificationToRow(userId, notification), { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function deleteNotificationsRemote(
  userId: string,
  ids: string[]
) {
  if (ids.length === 0) return;
  const { error } = await supabase
    .from("app_notifications")
    .delete()
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw new Error(error.message);
}

/** Push a full local bundle up (used after guest→auth migration merge). */
export async function pushPlanningBundle(
  userId: string,
  bundle: PlanningBundle
) {
  if (bundle.events.length > 0) {
    const { error } = await supabase
      .from("calendar_events")
      .upsert(
        bundle.events.map((event) => eventToRow(userId, event)),
        { onConflict: "id" }
      );
    if (error) throw new Error(error.message);
  }
  if (bundle.notes.length > 0) {
    const { error } = await supabase
      .from("user_notes")
      .upsert(
        bundle.notes.map((note) => noteToRow(userId, note)),
        { onConflict: "id" }
      );
    if (error) throw new Error(error.message);
  }
  if (bundle.notifications.length > 0) {
    const { error } = await supabase
      .from("app_notifications")
      .upsert(
        bundle.notifications.map((n) => notificationToRow(userId, n)),
        { onConflict: "id" }
      );
    if (error) throw new Error(error.message);
  }
}

export async function replaceRecommendedEventsRemote(
  userId: string,
  farmName: string,
  keepPlanId?: string
) {
  const farm = farmName.trim().toLocaleLowerCase();
  const { data, error } = await supabase
    .from("calendar_events")
    .select("id, farm_name, source, plan_id")
    .eq("user_id", userId)
    .eq("source", "recommended");
  if (error) throw new Error(error.message);

  const toDelete = (data || [])
    .filter((row) => {
      const name = String(row.farm_name || "")
        .trim()
        .toLocaleLowerCase();
      if (name !== farm) return false;
      if (keepPlanId && row.plan_id && row.plan_id !== keepPlanId) return false;
      return true;
    })
    .map((row) => String(row.id));

  if (toDelete.length === 0) return;
  const { error: delError } = await supabase
    .from("calendar_events")
    .delete()
    .eq("user_id", userId)
    .in("id", toDelete);
  if (delError) throw new Error(delError.message);
}
