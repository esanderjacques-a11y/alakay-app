"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { BellRing, Trash2 } from "lucide-react";
import BackButton from "@/components/ui/BackButton";
import type { Translation } from "@/lib/translations";
import type { AppStep } from "@/lib/appSteps";
import type { AppNotification } from "@/lib/planningTypes";
import {
  clearAllNotifications,
  dueNotifications,
  inboxNotifications,
  isNotificationDue,
  markAllNotificationsRead,
  markNotificationRead,
  pruneFarFutureNotifications,
  removeNotification,
  syncCalendarDueNotifications,
} from "@/lib/planningStore";
import {
  getNotificationPermission,
  requestDeviceNotificationPermission,
  deliverDueDeviceNotifications,
} from "@/lib/deviceNotifications";

type Props = {
  t: Translation;
  onBack: () => void;
  onNavigate: (step: AppStep) => void;
};

type NotificationGroupId =
  | "upcoming"
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

const SWIPE_DELETE_PX = 72;
const SWIPE_MAX_PX = 108;
const EXIT_MS = 280;
/** iOS-like settle curve */
const SPRING_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

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
  const due = notificationSortDate(item);
  if (due.getTime() > now.getTime()) return "upcoming";

  const when = startOfDay(due);
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

/** Soft rubber-band past the max swipe distance. */
function rubberBand(offset: number, max = SWIPE_MAX_PX) {
  if (offset <= 0) return 0;
  if (offset <= max) return offset;
  const over = offset - max;
  return max + over / (1 + over / (max * 0.55));
}

function SwipeDeleteRow({
  item,
  due,
  deleteLabel,
  soonLabel,
  index,
  onOpen,
  onDelete,
}: {
  item: AppNotification;
  due: boolean;
  deleteLabel: string;
  soonLabel: string;
  index: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const rowRef = useRef<HTMLLIElement>(null);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [exitStyle, setExitStyle] = useState<CSSProperties | undefined>();
  const startX = useRef(0);
  const startY = useRef(0);
  const startTime = useRef(0);
  const axisLocked = useRef<"x" | "y" | null>(null);
  const offsetRef = useRef(0);
  const suppressClick = useRef(false);

  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  function finishDelete() {
    if (exiting) return;
    const el = rowRef.current;
    const height = el?.getBoundingClientRect().height ?? 0;
    setExiting(true);
    setExitStyle({
      height,
      opacity: 1,
      marginBottom: 0,
      transform: `translate3d(${Math.max(offsetRef.current, SWIPE_MAX_PX + 24)}px, 0, 0)`,
    });
    // Next frame: collapse + fade for iOS Mail-style dismissal.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setExitStyle({
          height: 0,
          opacity: 0,
          marginBottom: 0,
          paddingTop: 0,
          paddingBottom: 0,
          transform: `translate3d(${SWIPE_MAX_PX + 80}px, 0, 0)`,
          overflow: "hidden",
        });
      });
    });
    window.setTimeout(() => onDelete(), EXIT_MS);
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (exiting) return;
    if (event.button !== 0 && event.pointerType === "mouse") return;
    startX.current = event.clientX;
    startY.current = event.clientY;
    startTime.current = performance.now();
    axisLocked.current = null;
    suppressClick.current = false;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging || exiting) return;
    const dx = event.clientX - startX.current;
    const dy = event.clientY - startY.current;

    if (!axisLocked.current) {
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) * 1.15 ? "x" : "y";
      if (axisLocked.current === "y") return;
    }
    if (axisLocked.current !== "x") return;

    setOffset(rubberBand(dx));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }

    const elapsed = Math.max(16, performance.now() - startTime.current);
    const velocity = offsetRef.current / elapsed; // px/ms

    if (
      axisLocked.current === "x" &&
      (offsetRef.current >= SWIPE_DELETE_PX || velocity > 0.55)
    ) {
      suppressClick.current = true;
      finishDelete();
      return;
    }

    if (axisLocked.current === "x" && offsetRef.current > 6) {
      suppressClick.current = true;
    }
    setOffset(0);
    axisLocked.current = null;
  }

  const panelStyle: CSSProperties = {
    transform: `translate3d(${offset}px, 0, 0)`,
    transition: dragging
      ? "none"
      : `transform 0.42s ${SPRING_EASE}`,
  };

  return (
    <li
      ref={rowRef}
      className={`notifications-item notifications-item--swipe${
        exiting ? " is-exiting" : ""
      }${due && !item.read ? " is-unread" : ""}`}
      style={
        {
          ...exitStyle,
          transition: exiting
            ? `height ${EXIT_MS}ms ${SPRING_EASE}, opacity ${EXIT_MS}ms ${SPRING_EASE}, transform ${EXIT_MS}ms ${SPRING_EASE}, margin ${EXIT_MS}ms ${SPRING_EASE}, padding ${EXIT_MS}ms ${SPRING_EASE}`
            : undefined,
          ["--notif-stagger" as string]: `${Math.min(index, 10) * 38}ms`,
        } as CSSProperties
      }
    >
      <div className="notifications-item__rail" aria-hidden>
        <Trash2 size={16} strokeWidth={2.25} />
        <span>{deleteLabel}</span>
      </div>
      <div
        className={`notifications-item__panel${dragging ? " is-dragging" : ""}`}
        style={panelStyle}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <button
          type="button"
          className="notifications-item__main"
          onClick={() => {
            if (suppressClick.current) {
              suppressClick.current = false;
              return;
            }
            onOpen();
          }}
        >
          <span className="notifications-item__copy">
            <span className="notifications-item__title">{item.title}</span>
            <span className="notifications-item__body">{item.body}</span>
            <span className="notifications-item__meta">
              {formatNotificationTime(item)}
              {!due && !item.read ? ` · ${soonLabel}` : ""}
            </span>
          </span>
          {due && !item.read ? (
            <span className="notifications-item__dot" aria-hidden />
          ) : null}
        </button>
        <button
          type="button"
          className="notifications-item__clear"
          aria-label={deleteLabel}
          title={deleteLabel}
          onClick={(event) => {
            event.stopPropagation();
            finishDelete();
          }}
        >
          <Trash2 size={15} strokeWidth={2.25} aria-hidden />
        </button>
      </div>
    </li>
  );
}

export default function NotificationsScreen({ t, onBack, onNavigate }: Props) {
  const p = t.planning;
  const [tick, setTick] = useState(0);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");

  useEffect(() => {
    pruneFarFutureNotifications();
    syncCalendarDueNotifications();
    setPermission(getNotificationPermission());
    void deliverDueDeviceNotifications().then(() => setTick((v) => v + 1));
  }, []);

  const items = useMemo(() => {
    void tick;
    return inboxNotifications();
  }, [tick]);

  const dueCount = useMemo(() => {
    void tick;
    return dueNotifications().length;
  }, [tick]);

  const groups = useMemo((): NotificationGroup[] => {
    const buckets: Record<NotificationGroupId, AppNotification[]> = {
      upcoming: [],
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
      upcoming: p.notifGroupUpcoming || "Upcoming",
      today: p.notifGroupToday,
      yesterday: p.notifGroupYesterday,
      thisWeek: p.notifGroupThisWeek,
      thisMonth: p.notifGroupThisMonth,
      older: p.notifGroupOlder,
    };

    return (
      [
        "upcoming",
        "today",
        "yesterday",
        "thisWeek",
        "thisMonth",
        "older",
      ] as const
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

  async function handleEnablePhone() {
    const next = await requestDeviceNotificationPermission();
    setPermission(next);
    if (next === "granted") {
      await deliverDueDeviceNotifications();
      refresh();
    }
  }

  function handleClearAll() {
    if (items.length === 0) return;
    const confirmed = window.confirm(p.clearAllNotificationsConfirm);
    if (!confirmed) return;
    clearAllNotifications();
    refresh();
  }

  function openItem(item: AppNotification) {
    markNotificationRead(item.id);
    refresh();
    if (item.hrefStep) onNavigate(item.hrefStep);
  }

  function deleteItem(id: string) {
    removeNotification(id);
    refresh();
  }

  let staggerIndex = 0;

  return (
    <section className="notifications-screen animate-slide-up">
      <header className="notifications-screen__top">
        <div className="page-title-row items-center">
          <BackButton onClick={onBack} label={p.back} variant="icon" />
          <div className="page-title-row__title min-w-0">
            <h1 className="truncate text-lg font-bold dark-text-primary">
              {p.notificationsTitle}
            </h1>
          </div>
          {permission !== "unsupported" ? (
            <button
              type="button"
              className={`notifications-screen__bell${
                permission === "granted" ? " is-on" : ""
              }${permission === "denied" ? " is-denied" : ""}`}
              onClick={() => {
                if (permission === "granted" || permission === "denied") return;
                void handleEnablePhone();
              }}
              aria-label={
                permission === "granted"
                  ? p.phoneNotificationsEnabled || "Phone alerts on"
                  : permission === "denied"
                    ? p.phoneNotificationsDenied || "Phone alerts blocked"
                    : p.enablePhoneNotificationsAction || "Enable phone alerts"
              }
              title={
                permission === "granted"
                  ? p.phoneNotificationsEnabled || "Phone alerts on"
                  : permission === "denied"
                    ? p.phoneNotificationsDenied || "Phone alerts blocked"
                    : p.enablePhoneNotifications || "Phone notifications"
              }
              disabled={permission === "granted" || permission === "denied"}
            >
              <BellRing size={16} aria-hidden />
            </button>
          ) : (
            <span className="page-title-row__spacer" aria-hidden />
          )}
        </div>

        <div className="notifications-screen__meta">
          <p className="notifications-screen__count">
            {dueCount > 0
              ? p.unreadCount.replace("{count}", String(dueCount))
              : p.allCaughtUp}
          </p>
          <div className="notifications-screen__actions">
            {items.some((item) => !item.read && isNotificationDue(item)) ? (
              <button
                type="button"
                className="notifications-screen__action"
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
                className="notifications-screen__action notifications-screen__action--danger"
                onClick={handleClearAll}
              >
                {p.clearAllNotifications}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="notifications-screen__body">
        {items.length === 0 ? (
          <p className="notifications-screen__empty">{p.emptyNotifications}</p>
        ) : (
          <div className="notifications-screen__groups">
            {groups.map((group) => (
              <section key={group.id} className="notifications-group">
                <h2 className="notifications-group__title">{group.label}</h2>
                <ul className="notifications-group__list">
                  {group.items.map((item) => {
                    const index = staggerIndex++;
                    return (
                      <SwipeDeleteRow
                        key={item.id}
                        item={item}
                        due={isNotificationDue(item)}
                        deleteLabel={p.clearNotification}
                        soonLabel={p.notifSoon || "Soon"}
                        index={index}
                        onOpen={() => openItem(item)}
                        onDelete={() => deleteItem(item.id)}
                      />
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
