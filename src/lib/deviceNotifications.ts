/**
 * Device (OS) notifications for Cultosol planning reminders.
 * Uses the Web Notification API + service worker when available (installed PWA).
 * True silent push while the app is fully closed requires a push server (not here);
 * while the app/PWA is open or recently used, due items can alert on the phone.
 */

import type { AppNotification } from "@/lib/planningTypes";
import {
  dueNotifications,
  markNotificationRead,
  syncCalendarDueNotifications,
} from "@/lib/planningStore";

const DEVICE_NOTIFIED_KEY = "cultosol_device_notified_v1";
const PERMISSION_PROMPTED_KEY = "cultosol_notif_permission_prompted";

function readNotifiedIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(DEVICE_NOTIFIED_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as string[];
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function writeNotifiedIds(ids: Set<string>) {
  if (typeof window === "undefined") return;
  const trimmed = [...ids].slice(-200);
  localStorage.setItem(DEVICE_NOTIFIED_KEY, JSON.stringify(trimmed));
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function wasNotificationPermissionPrompted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(PERMISSION_PROMPTED_KEY) === "1";
  } catch {
    return false;
  }
}

export async function requestDeviceNotificationPermission(): Promise<
  NotificationPermission | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  try {
    localStorage.setItem(PERMISSION_PROMPTED_KEY, "1");
  } catch {
    /* ignore */
  }
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  return Notification.requestPermission();
}

function deepLinkFor(item: AppNotification): string {
  const step = item.hrefStep || "notifications";
  const url = new URL(window.location.href);
  url.searchParams.set("step", step);
  if (item.relatedId) url.searchParams.set("related", item.relatedId);
  url.searchParams.set("notif", item.id);
  return url.pathname + url.search + url.hash;
}

async function showViaServiceWorker(item: AppNotification): Promise<boolean> {
  if (!("serviceWorker" in navigator)) return false;
  try {
    const reg = await navigator.serviceWorker.ready;
    if (!reg?.showNotification) return false;
    await reg.showNotification(item.title, {
      body: item.body,
      icon: "/icon-192x192.png",
      badge: "/icon-32x32.png",
      tag: `cultosol-${item.id}`,
      renotify: true,
      data: {
        step: item.hrefStep || "notifications",
        relatedId: item.relatedId || null,
        notifId: item.id,
        url: deepLinkFor(item),
      },
    } as NotificationOptions);
    return true;
  } catch {
    return false;
  }
}

function showViaPageNotification(item: AppNotification): boolean {
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return false;
  }
  try {
    const n = new Notification(item.title, {
      body: item.body,
      icon: "/icon-192x192.png",
      tag: `cultosol-${item.id}`,
      data: {
        step: item.hrefStep || "notifications",
        relatedId: item.relatedId || null,
        notifId: item.id,
      },
    });
    n.onclick = () => {
      window.focus();
      const url = deepLinkFor(item);
      if (`${window.location.pathname}${window.location.search}` !== url) {
        window.history.replaceState(null, "", url);
        window.dispatchEvent(new CustomEvent("cultosol:open-step", {
          detail: {
            step: item.hrefStep || "notifications",
            relatedId: item.relatedId || null,
            notifId: item.id,
          },
        }));
      }
      n.close();
      markNotificationRead(item.id);
    };
    return true;
  } catch {
    return false;
  }
}

/** Fire OS notifications for newly due unread items (once each). */
export async function deliverDueDeviceNotifications(
  now = new Date()
): Promise<number> {
  if (typeof window === "undefined") return 0;
  if (!("Notification" in window) || Notification.permission !== "granted") {
    return 0;
  }

  syncCalendarDueNotifications(now);
  const due = dueNotifications(now);
  const notified = readNotifiedIds();
  let shown = 0;

  for (const item of due) {
    if (notified.has(item.id)) continue;
    const viaSw = await showViaServiceWorker(item);
    const ok = viaSw || showViaPageNotification(item);
    if (ok) {
      notified.add(item.id);
      shown += 1;
    }
  }

  if (shown > 0) writeNotifiedIds(notified);
  return shown;
}

/**
 * Keep calendar notifications in sync and deliver OS alerts while the app is alive.
 * Returns an unsubscribe function.
 */
export function startDeviceNotificationWatch(
  onChange?: () => void
): () => void {
  if (typeof window === "undefined") return () => undefined;

  let cancelled = false;

  const tick = () => {
    if (cancelled) return;
    void deliverDueDeviceNotifications().then((shown) => {
      if (shown > 0 || onChange) onChange?.();
    });
  };

  tick();
  const intervalId = window.setInterval(tick, 60_000);

  const onVisibility = () => {
    if (document.visibilityState === "visible") tick();
  };
  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("focus", tick);

  return () => {
    cancelled = true;
    window.clearInterval(intervalId);
    document.removeEventListener("visibilitychange", onVisibility);
    window.removeEventListener("focus", tick);
  };
}
