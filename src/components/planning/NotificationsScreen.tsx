"use client";

import { useMemo, useState } from "react";
import type { Translation } from "@/lib/translations";
import type { AppStep } from "@/lib/appSteps";
import {
  dueNotifications,
  loadPlanningState,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/planningStore";

type Props = {
  t: Translation;
  onBack: () => void;
  onNavigate: (step: AppStep) => void;
};

export default function NotificationsScreen({ t, onBack, onNavigate }: Props) {
  const p = t.planning;
  const [tick, setTick] = useState(0);
  const items = useMemo(() => {
    void tick;
    // Include future scheduled so users see upcoming, but sort due first
    return loadPlanningState().notifications.slice().sort((a, b) => {
      const aDue = a.dueAt || a.createdAt;
      const bDue = b.dueAt || b.createdAt;
      return aDue.localeCompare(bDue);
    });
  }, [tick]);

  const dueCount = useMemo(() => {
    void tick;
    return dueNotifications().length;
  }, [tick]);

  function refresh() {
    setTick((value) => value + 1);
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
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {p.emptyNotifications}
          </p>
        ) : (
          <ul className="grid gap-2">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`w-full text-left transition ${
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
                    {item.kind}
                    {item.dueAt
                      ? ` · ${new Date(item.dueAt).toLocaleString()}`
                      : ""}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
