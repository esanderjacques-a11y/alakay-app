"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { Translation } from "@/lib/translations";
import type { AppStep } from "@/lib/appSteps";
import type { AppNotification } from "@/lib/planningTypes";
import {
  clearAllNotifications,
  dueNotifications,
  loadPlanningState,
  markAllNotificationsRead,
  markNotificationRead,
  removeNotification,
} from "@/lib/planningStore";

type Props = {
  t: Translation;
  onBack: () => void;
  onNavigate: (step: AppStep) => void;
};

type NotificationGroupId =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "thisMonth"
  | "older";

type NotificationGroup = {
  id: NotificationGroupId;
  label: string;
  items: AppNotification[];
};

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function notificationSortDate(item: AppNotification) {
  return new Date(item.dueAt || item.createdAt);
}

function getNotificationGroupId(
  item: AppNotification,
  now = new Date()
): NotificationGroupId {
  const when = startOfDay(notificationSortDate(item));
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const dayDiff = Math.floor(
    (today.getTime() - when.getTime()) / (24 * 60 * 60 * 1000)
  );

  if (dayDiff <= 0) return "today";
  if (dayDiff === 1) return "yesterday";
  if (dayDiff < 7) return "thisWeek";
  if (
    when.getFullYear() === today.getFullYear() &&
    when.getMonth() === today.getMonth()
  ) {
    return "thisMonth";
  }
  return "older";
}

function formatNotificationTime(item: AppNotification) {
  const date = notificationSortDate(item);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function NotificationsScreen({ t, onBack, onNavigate }: Props) {
  const p = t.planning;
  const [tick, setTick] = useState(0);

  const items = useMemo(() => {
    void tick;
    return loadPlanningState()
      .notifications.slice()
      .sort((a, b) => {
        const aDue = a.dueAt || a.createdAt;
        const bDue = b.dueAt || b.createdAt;
        return bDue.localeCompare(aDue);
      });
  }, [tick]);

  const dueCount = useMemo(() => {
    void tick;
    return dueNotifications().length;
  }, [tick]);

  const groups = useMemo((): NotificationGroup[] => {
    const buckets: Record<NotificationGroupId, AppNotification[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      thisMonth: [],
      older: [],
    };

    for (const item of items) {
      buckets[getNotificationGroupId(item)].push(item);
    }

    const labels: Record<NotificationGroupId, string> = {
      today: p.notifGroupToday,
      yesterday: p.notifGroupYesterday,
      thisWeek: p.notifGroupThisWeek,
      thisMonth: p.notifGroupThisMonth,
      older: p.notifGroupOlder,
    };

    return (
      ["today", "yesterday", "thisWeek", "thisMonth", "older"] as const
    )
      .filter((id) => buckets[id].length > 0)
      .map((id) => ({
        id,
        label: labels[id],
        items: buckets[id],
      }));
  }, [items, p]);

  function refresh() {
    setTick((value) => value + 1);
  }

  function handleClearAll() {
    if (items.length === 0) return;
    const confirmed = window.confirm(p.clearAllNotificationsConfirm);
    if (!confirmed) return;
    clearAllNotifications();
    refresh();
  }

  return (
    <section className="animate-slide-up space-y-4 px-3 pb-8 pt-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#1c1c1e] dark-text-primary">
            {p.notificationsTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {p.notificationsDesc}
          </p>
        </div>
        <button type="button" className="calc-guided-stepper__nav-btn text-sm" onClick={onBack}>
          {p.back}
        </button>
      </div>

      <div className="calc-surface space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold dark-text-primary">
            {dueCount > 0
              ? p.unreadCount.replace("{count}", String(dueCount))
              : p.allCaughtUp}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {items.some((item) => !item.read) ? (
              <button
                type="button"
                className="plan-timeline-card__action"
                onClick={() => {
                  markAllNotificationsRead();
                  refresh();
                }}
              >
                {p.markAllRead}
              </button>
            ) : null}
            {items.length > 0 ? (
              <button
                type="button"
                className="plan-timeline-card__action plan-timeline-card__action--danger"
                onClick={handleClearAll}
              >
                {p.clearAllNotifications}
              </button>
            ) : null}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {p.emptyNotifications}
          </p>
        ) : (
          <div className="grid gap-4">
            {groups.map((group) => (
              <section key={group.id} className="grid gap-2">
                <h2 className="notifications-group__title">{group.label}</h2>
                <ul className="grid gap-2">
                  {group.items.map((item) => (
                    <li key={item.id} className="notifications-item">
                      <button
                        type="button"
                        className={`notifications-item__main ${
                          item.read
                            ? "farm-detail-row"
                            : "plan-timeline-card plan-timeline-card--done"
                        }`}
                        onClick={() => {
                          markNotificationRead(item.id);
                          refresh();
                          if (item.hrefStep) onNavigate(item.hrefStep);
                        }}
                      >
                        <p className="text-sm font-semibold dark-text-primary">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                          {item.body}
                        </p>
                        <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">
                          {item.kind} · {formatNotificationTime(item)}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="notifications-item__clear"
                        aria-label={p.clearNotification}
                        title={p.clearNotification}
                        onClick={() => {
                          removeNotification(item.id);
                          refresh();
                        }}
                      >
                        <Trash2 size={14} aria-hidden />
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
