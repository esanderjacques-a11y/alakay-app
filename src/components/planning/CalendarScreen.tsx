"use client";

import { useEffect, useMemo, useState } from "react";
import type { Language, Translation } from "@/lib/translations";
import type { CalendarEvent } from "@/lib/planningTypes";
import {
  resolveScheduleCycleMode,
  type ScheduleCycleMode,
  type ScheduleStageKey,
} from "@/lib/fertilizationSchedule";
import {
  acceptSuggestedEvents,
  deleteCalendarEvent,
  loadPlanningState,
  saveCalendarEvent,
  suggestEventsFromPlan,
  toggleCalendarEventCompleted,
  updateCalendarEventDate,
} from "@/lib/planningStore";
import { exportFertilizationPlanPdf } from "@/lib/fertilizationPlanPdf";
import ExportPdfIconButton from "@/components/ExportPdfIconButton";

type DoseHint = {
  key?: string;
  nutrient: string;
  nutrientOxide?: string;
  dosisKgHa?: number | null;
  unitHa?: string;
  notRequired?: boolean;
  viaEncalado?: boolean;
};

type Props = {
  t: Translation;
  language: Language;
  onBack: () => void;
  onOpenSetup?: () => void;
  onOpenCalculators?: () => void;
  cropName?: string | null;
  farmName?: string;
  lotName?: string;
  onFarmNameChange?: (value: string) => void;
  onLotNameChange?: (value: string) => void;
  planDoses?: DoseHint[];
  /** Prefill for PDF “responsible” field. */
  responsibleName?: string;
};

function stageLabelsFromI18n(
  p: Translation["planning"],
  mode: ScheduleCycleMode
): Partial<Record<ScheduleStageKey, { label: string; hint: string }>> {
  if (mode === "perennial") {
    return {
      amendment: {
        label: p.stageAmendmentPerennial,
        hint: p.stageAmendmentPerennialHint,
      },
      basal: { label: p.stageFlush, hint: p.stageFlushHint },
      vegetative: {
        label: p.stagePreFlower,
        hint: p.stagePreFlowerHint,
      },
      reproductive: {
        label: p.stageFruitFill,
        hint: p.stageFruitFillHint,
      },
    };
  }
  if (mode === "fruiting") {
    return {
      amendment: {
        label: p.stageAmendmentFruiting,
        hint: p.stageAmendmentFruitingHint,
      },
      basal: { label: p.stageBasalFruiting, hint: p.stageBasalFruitingHint },
      vegetative: {
        label: p.stageFlowering,
        hint: p.stageFloweringHint,
      },
      reproductive: {
        label: p.stageFruitFill,
        hint: p.stageFruitFillHint,
      },
    };
  }
  return {
    amendment: { label: p.stageAmendment, hint: p.stageAmendmentHint },
    basal: { label: p.stageBasal, hint: p.stageBasalHint },
    vegetative: { label: p.stageVegetative, hint: p.stageVegetativeHint },
    reproductive: { label: p.stageReproductive, hint: p.stageReproductiveHint },
  };
}

export default function CalendarScreen({
  t,
  language,
  onBack,
  onOpenSetup,
  onOpenCalculators,
  cropName,
  farmName = "",
  lotName = "",
  onFarmNameChange,
  onLotNameChange,
  planDoses = [],
  responsibleName = "",
}: Props) {
  const p = t.planning;
  const [tick, setTick] = useState(0);
  const [localFarm, setLocalFarm] = useState(farmName);
  const [localLot, setLocalLot] = useState(lotName);
  const [responsible, setResponsible] = useState(responsibleName);
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [drafts, setDrafts] = useState<CalendarEvent[]>([]);
  const [showManual, setShowManual] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState("");
  const [method, setMethod] = useState("");
  const [error, setError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => {
    if (responsibleName) setResponsible(responsibleName);
  }, [responsibleName]);

  const effectiveFarm = (onFarmNameChange ? farmName : localFarm).trim();
  const effectiveLot = (onLotNameChange ? lotName : localLot).trim();

  const cycleMode = useMemo(
    () => resolveScheduleCycleMode(cropName, language),
    [cropName, language]
  );

  const activeDoses = useMemo(
    () =>
      planDoses.filter(
        (d) => !d.notRequired && (d.dosisKgHa == null || d.dosisKgHa > 0)
      ),
    [planDoses]
  );

  const events = useMemo(() => {
    void tick;
    const all = loadPlanningState().events;
    const farm = effectiveFarm.toLocaleLowerCase();
    const filtered = farm
      ? all.filter(
          (e) => (e.farmName || "").trim().toLocaleLowerCase() === farm
        )
      : all;
    return filtered.sort((a, b) => {
      const seq = (a.sequence || 99) - (b.sequence || 99);
      if (seq !== 0) return seq;
      return a.date.localeCompare(b.date);
    });
  }, [tick, effectiveFarm]);

  const exportEvents = events.length > 0 ? events : drafts;

  const inferredFarm = useMemo(() => {
    if (effectiveFarm) return "";
    const names = [
      ...new Set(
        exportEvents
          .map((e) => (e.farmName || "").trim())
          .filter(Boolean)
      ),
    ];
    return names[0] || "";
  }, [effectiveFarm, exportEvents]);

  const pdfFarmName = effectiveFarm || inferredFarm;

  function refresh() {
    setTick((value) => value + 1);
  }

  function setFarm(value: string) {
    if (onFarmNameChange) onFarmNameChange(value);
    else setLocalFarm(value);
  }

  function setLot(value: string) {
    if (onLotNameChange) onLotNameChange(value);
    else setLocalLot(value);
  }

  function handleBuildSchedule() {
    setError("");
    if (!effectiveFarm) {
      setError(p.farmRequired);
      return;
    }
    if (activeDoses.length === 0) {
      setError(p.needPlanHint);
      return;
    }
    const next = suggestEventsFromPlan({
      doses: activeDoses,
      cropName,
      farmName: effectiveFarm,
      lotName: effectiveLot,
      startDate,
      language,
      stageLabels: stageLabelsFromI18n(p, cycleMode),
    });
    if (next.length === 0) {
      setError(p.needPlanHint);
      return;
    }
    setDrafts(next);
  }

  function handleAcceptDrafts() {
    if (drafts.length === 0) return;
    acceptSuggestedEvents(drafts, { replaceFarmPlan: true });
    setDrafts([]);
    refresh();
  }

  function handleAddManual(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!effectiveFarm) {
      setError(p.farmRequired);
      return;
    }
    if (!title.trim() || !date) return;
    saveCalendarEvent({
      title: title.trim(),
      date,
      farmName: effectiveFarm,
      lotName: effectiveLot || undefined,
      rate: rate.trim() || undefined,
      method: method.trim() || undefined,
      placeNote: cropName || undefined,
      source: "manual",
      sequence: events.length + 1,
    });
    setTitle("");
    setRate("");
    setMethod("");
    setShowManual(false);
    refresh();
  }

  const completedCount = events.filter((e) => e.completed).length;

  async function handleExportPdf() {
    setError("");
    if (exportEvents.length === 0) {
      setError(p.pdfNoEvents);
      return;
    }
    if (!pdfFarmName) {
      setError(p.farmRequired);
      return;
    }
    setExportingPdf(true);
    try {
      await exportFertilizationPlanPdf({
        t,
        farmName: pdfFarmName,
        lotName: effectiveLot || exportEvents[0]?.lotName,
        cropName,
        responsible,
        seasonStart: startDate,
        events: exportEvents,
        locale: language,
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : p.pdfNoEvents
      );
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <section className="animate-slide-up space-y-4 px-0 pb-8 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-xl">
          <h1 className="text-xl font-bold text-[#1c1c1e] dark-text-primary">
            {p.calendarTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {p.calendarDesc}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportPdfIconButton
            onClick={() => void handleExportPdf()}
            busy={exportingPdf}
            disabled={exportEvents.length === 0 || !pdfFarmName}
            label={exportingPdf ? p.exportingPlanPdf : p.exportPlanPdf}
          />
          <button
            type="button"
            className="calc-guided-stepper__nav-btn text-sm"
            onClick={onBack}
          >
            {p.back}
          </button>
        </div>
      </div>

      <div className="calc-surface space-y-3 p-4">
        <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
          {p.howItWorksTitle}
        </h2>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>{p.howItWorks1}</li>
          <li>
            {cycleMode === "perennial"
              ? p.howItWorks2Perennial
              : cycleMode === "fruiting"
                ? p.howItWorks2Fruiting
                : p.howItWorks2}
          </li>
          <li>{p.howItWorks3}</li>
        </ol>
      </div>

      <div className="calc-surface space-y-3 p-4">
        <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
          {p.contextTitle}
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="calc-field-label grid gap-1">
            {p.farmLabel} *
            <input
              className="calc-field-input"
              value={onFarmNameChange ? farmName : localFarm}
              onChange={(e) => setFarm(e.target.value)}
              placeholder={p.farmPlaceholder}
              required
            />
          </label>
          <label className="calc-field-label grid gap-1">
            {p.lotLabel}
            <input
              className="calc-field-input"
              value={onLotNameChange ? lotName : localLot}
              onChange={(e) => setLot(e.target.value)}
              placeholder={p.lotPlaceholder}
            />
          </label>
          <label className="calc-field-label grid gap-1">
            {cycleMode === "perennial"
              ? p.seasonStartPerennial
              : cycleMode === "fruiting"
                ? p.seasonStartFruiting
                : p.seasonStart}
            <input
              className="calc-field-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label className="calc-field-label grid gap-1">
            {p.responsibleLabel}
            <input
              className="calc-field-input"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder={p.responsiblePlaceholder}
            />
          </label>
          <div className="plan-timeline-line sm:col-span-2">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wide plan-timeline-card__action">
                {p.cropLabel}
              </p>
              <p className="plan-timeline-line__nutrient mt-1">
                {cropName || p.cropUnknown}
              </p>
              <p className="plan-timeline-card__meta mt-1 text-xs">
                {cycleMode === "perennial"
                  ? p.cycleModePerennial
                  : cycleMode === "fruiting"
                    ? p.cycleModeFruiting
                    : p.cycleModeAnnual}
              </p>
            </div>
          </div>
        </div>
        {!effectiveFarm ? (
          <div className="plan-callout">
            <span className="flex-1">
              {inferredFarm
                ? p.farmInferredHint.replace("{farm}", inferredFarm)
                : p.farmRequired}
            </span>
            {inferredFarm ? (
              <button
                type="button"
                className="plan-callout__link"
                onClick={() => setFarm(inferredFarm)}
              >
                {p.useInferredFarm.replace("{farm}", inferredFarm)}
              </button>
            ) : null}
            {onOpenSetup ? (
              <button
                type="button"
                className="plan-callout__link"
                onClick={onOpenSetup}
              >
                {p.goToSetup}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="calc-surface space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
              {p.scheduleBuilderTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {activeDoses.length > 0
                ? p.scheduleBuilderHint.replace(
                    "{count}",
                    String(activeDoses.length)
                  )
                : p.needPlanHint}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {activeDoses.length === 0 && onOpenCalculators ? (
              <button
                type="button"
                className="plan-btn-secondary"
                onClick={onOpenCalculators}
              >
                {p.goToPlan}
              </button>
            ) : null}
            <button
              type="button"
              className="plan-btn-primary"
              onClick={handleBuildSchedule}
              disabled={!effectiveFarm || activeDoses.length === 0}
            >
              {p.buildSchedule}
            </button>
          </div>
        </div>

        {activeDoses.length > 0 ? (
          <ul className="flex flex-wrap gap-1.5">
            {activeDoses.map((dose) => (
              <li
                key={`${dose.key || dose.nutrient}-${dose.dosisKgHa}`}
                className="farm-chip text-[11px]"
              >
                {dose.nutrientOxide || dose.nutrient}
                {dose.dosisKgHa != null
                  ? ` · ${dose.dosisKgHa} ${dose.unitHa || "kg/ha"}`
                  : ""}
                {dose.viaEncalado ? ` · ${p.viaLimeShort}` : ""}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <div className="plan-callout">{error}</div> : null}

        {drafts.length > 0 ? (
          <div className="space-y-3 border-t border-[color:var(--glass-border)] pt-3">
            <p className="text-xs font-bold uppercase tracking-wide plan-timeline-card__action">
              {p.previewTitle}
            </p>
            <Timeline
              items={drafts}
              editableDates
              onDateChange={(id, nextDate) => {
                setDrafts((prev) =>
                  prev.map((item) =>
                    item.id === id ? { ...item, date: nextDate } : item
                  )
                );
              }}
              t={p}
              preview
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="plan-btn-primary"
                onClick={handleAcceptDrafts}
              >
                {p.acceptRecommended}
              </button>
              <button
                type="button"
                className="plan-btn-secondary"
                onClick={() => setDrafts([])}
              >
                {p.discardRecommended}
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="calc-surface space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
              {p.timelineTitle}
            </h2>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {events.length === 0
                ? p.emptyCalendar
                : p.timelineProgress
                    .replace("{done}", String(completedCount))
                    .replace("{total}", String(events.length))}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="plan-btn-primary"
              onClick={() => void handleExportPdf()}
              disabled={exportEvents.length === 0 || !pdfFarmName || exportingPdf}
            >
              {exportingPdf ? p.exportingPlanPdf : p.exportPlanPdf}
            </button>
            <button
              type="button"
              className="plan-timeline-card__action"
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? p.hideManual : p.manualEventTitle}
            </button>
          </div>
        </div>

        {showManual ? (
          <form className="space-y-3 border-t border-[color:var(--glass-border)] pt-3" onSubmit={handleAddManual}>
            <label className="calc-field-label grid gap-1">
              {p.eventTitle}
              <input
                className="calc-field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="calc-field-label grid gap-1">
                {p.eventDate}
                <input
                  className="calc-field-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label className="calc-field-label grid gap-1">
                {p.eventRate}
                <input
                  className="calc-field-input"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </label>
            </div>
            <label className="calc-field-label grid gap-1">
              {p.eventMethod}
              <input
                className="calc-field-input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </label>
            <button
              type="submit"
              className="plan-btn-primary"
            >
              {p.saveEvent}
            </button>
          </form>
        ) : null}

        {events.length > 0 ? (
          <Timeline
            items={events}
            t={p}
            onToggle={(id) => {
              toggleCalendarEventCompleted(id);
              refresh();
            }}
            onDelete={(id) => {
              deleteCalendarEvent(id);
              refresh();
            }}
            onDateChange={(id, nextDate) => {
              updateCalendarEventDate(id, nextDate);
              refresh();
            }}
            editableDates
          />
        ) : null}
      </div>
    </section>
  );
}

function Timeline({
  items,
  t,
  preview = false,
  editableDates = false,
  onToggle,
  onDelete,
  onDateChange,
}: {
  items: CalendarEvent[];
  t: Translation["planning"];
  preview?: boolean;
  editableDates?: boolean;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
  onDateChange?: (id: string, date: string) => void;
}) {
  return (
    <ol className="plan-timeline">
      {items.map((item) => (
        <li key={item.id} className="relative">
          <span
            className={`plan-timeline__marker ${
              item.completed ? "plan-timeline__marker--done" : ""
            }`}
          >
            {item.sequence || "·"}
          </span>
          <article
            className={`plan-timeline-card ${
              item.completed ? "plan-timeline-card--done" : ""
            } ${preview ? "plan-timeline-card--preview" : ""}`}
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="plan-timeline-card__title">
                  {item.stageLabel || item.title}
                </p>
                <div className="plan-timeline-card__meta mt-1 flex flex-wrap items-center gap-2 text-xs">
                  {editableDates && onDateChange ? (
                    <input
                      type="date"
                      className="calc-field-input w-auto py-1 text-xs"
                      value={item.date}
                      onChange={(e) => onDateChange(item.id, e.target.value)}
                    />
                  ) : (
                    <span>{item.date}</span>
                  )}
                  <span>
                    {item.source === "recommended"
                      ? t.sourceRecommended
                      : t.sourceManual}
                  </span>
                  {item.completed ? (
                    <span className="plan-status-pill">
                      {t.statusDone}
                    </span>
                  ) : null}
                </div>
                {item.method ? (
                  <p className="plan-timeline-card__hint mt-1 text-xs">
                    {item.method}
                  </p>
                ) : null}
              </div>
              {!preview ? (
                <div className="flex flex-col items-end gap-1">
                  {onToggle ? (
                    <button
                      type="button"
                      className="plan-timeline-card__action"
                      onClick={() => onToggle(item.id)}
                    >
                      {item.completed ? t.markPending : t.markDone}
                    </button>
                  ) : null}
                  {onDelete ? (
                    <button
                      type="button"
                      className="plan-timeline-card__action plan-timeline-card__action--danger"
                      onClick={() => onDelete(item.id)}
                    >
                      {t.delete}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            {item.lines && item.lines.length > 0 ? (
              <ul className="mt-2 grid gap-1.5">
                {item.lines.map((line) => (
                  <li
                    key={`${item.id}-${line.nutrient}-${line.kgHa}`}
                    className="plan-timeline-line"
                  >
                    <span className="plan-timeline-line__nutrient">
                      {line.nutrient}
                      {line.percentOfTotal != null
                        ? ` · ${line.percentOfTotal}%`
                        : ""}
                    </span>
                    <span className="plan-timeline-line__qty">
                      {line.kgHa} {line.unitHa}
                    </span>
                  </li>
                ))}
              </ul>
            ) : item.rate ? (
              <p className="plan-timeline-card__meta mt-2 text-xs font-medium">
                {item.rate}
              </p>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}
