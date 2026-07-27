"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Language, Translation } from "@/lib/translations";
import type { CalendarEvent } from "@/lib/planningTypes";
import {
  resolveScheduleCycleMode,
  suggestSeasonEndDate,
  type ScheduleCycleMode,
  type SchedulePurpose,
  type ScheduleStageKey,
} from "@/lib/fertilizationSchedule";
import {
  acceptSuggestedEvents,
  deleteCalendarEvent,
  deleteSavedCalendar,
  getSavedCalendar,
  listSavedCalendars,
  loadPlanningState,
  renameSavedCalendar,
  saveCalendarEvent,
  suggestEventsFromPlan,
  toggleCalendarEventCompleted,
  updateCalendarEventDate,
  upsertSavedCalendar,
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
  /** Open directly into this saved calendar (from Farms). */
  initialCalendarId?: string | null;
  /** When set, list is filtered to this farm. */
  farmFilter?: string;
  onActiveCalendarChange?: (calendarId: string | null) => void;
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
  initialCalendarId = null,
  farmFilter,
  onActiveCalendarChange,
}: Props) {
  const p = t.planning;
  const [tick, setTick] = useState(0);
  const [activeCalendarId, setActiveCalendarId] = useState<string | null>(
    initialCalendarId || null
  );
  const [calendarNameDraft, setCalendarNameDraft] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [localFarm, setLocalFarm] = useState(farmName);
  const [localLot, setLocalLot] = useState(lotName);
  const [responsible, setResponsible] = useState(responsibleName);
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(() =>
    suggestSeasonEndDate({
      startDate: new Date().toISOString().slice(0, 10),
      language,
    })
  );
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [purpose, setPurpose] = useState<SchedulePurpose>("full_cycle");
  /** True when purpose/dates no longer match the saved timeline until rebuild. */
  const [scheduleStale, setScheduleStale] = useState(false);
  const [showManual, setShowManual] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState("");
  const [method, setMethod] = useState("");
  const [error, setError] = useState("");
  const [exportingPdf, setExportingPdf] = useState(false);
  const exportingPdfRef = useRef(false);

  useEffect(() => {
    if (responsibleName) setResponsible(responsibleName);
  }, [responsibleName]);

  useEffect(() => {
    if (initialCalendarId) {
      setActiveCalendarId(initialCalendarId);
    }
  }, [initialCalendarId]);

  useEffect(() => {
    if (!activeCalendarId) return;
    const saved = getSavedCalendar(activeCalendarId);
    if (!saved) return;
    setCalendarNameDraft(saved.name);
    if (saved.farmName) setFarm(saved.farmName);
    if (saved.lotName) setLot(saved.lotName);
    if (saved.startDate) setStartDate(saved.startDate);
    if (saved.endDate) {
      setEndDate(saved.endDate);
      setEndDateTouched(true);
    }
    if (saved.purpose) setPurpose(saved.purpose as SchedulePurpose);
    if (saved.responsible) setResponsible(saved.responsible);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when calendar opens
  }, [activeCalendarId]);

  const effectiveFarm = (onFarmNameChange ? farmName : localFarm).trim();
  const effectiveLot = (onLotNameChange ? lotName : localLot).trim();

  const savedCalendars = useMemo(() => {
    void tick;
    return listSavedCalendars(farmFilter || undefined);
  }, [tick, farmFilter]);

  function openCalendar(id: string) {
    setActiveCalendarId(id);
    onActiveCalendarChange?.(id);
    setStatusMessage("");
    setError("");
  }

  function closeToList() {
    setActiveCalendarId(null);
    onActiveCalendarChange?.(null);
    setStatusMessage("");
    setError("");
    refresh();
  }

  function handleNewCalendar() {
    const autoName = effectiveFarm
      ? `${effectiveFarm} · ${startDate}`
      : `${p.newCalendar} · ${startDate}`;
    const name =
      typeof window !== "undefined"
        ? window.prompt(p.calendarName, autoName)?.trim() || autoName
        : autoName;
    const created = upsertSavedCalendar({
      name,
      farmName: effectiveFarm || farmFilter || "",
      lotName: effectiveLot || undefined,
      cropName: cropName || undefined,
      startDate,
      endDate,
      purpose,
      cycleMode: cycleMode,
      responsible: responsible || undefined,
    });
    openCalendar(created.id);
    refresh();
  }

  function handleSaveCalendar(asNew = false) {
    setError("");
    if (!effectiveFarm) {
      setError(p.farmRequired);
      return;
    }
    const autoName = `${effectiveFarm} · ${startDate}`;
    let name = calendarNameDraft.trim();
    if (asNew || !name) {
      name =
        (typeof window !== "undefined"
          ? window.prompt(p.calendarName, name || autoName)?.trim()
          : null) ||
        name ||
        autoName;
    }
    const saved = upsertSavedCalendar({
      id: asNew ? undefined : activeCalendarId || undefined,
      name,
      farmName: effectiveFarm,
      lotName: effectiveLot || undefined,
      cropName: cropName || undefined,
      startDate,
      endDate,
      purpose,
      cycleMode,
      responsible: responsible || undefined,
    });
    setCalendarNameDraft(saved.name);
    openCalendar(saved.id);
    setStatusMessage(p.calendarSaved);
    refresh();
  }

  function handleRenameCalendar(id: string) {
    const current = getSavedCalendar(id);
    if (!current) return;
    const next =
      typeof window !== "undefined"
        ? window.prompt(p.calendarName, current.name)?.trim()
        : null;
    if (!next) return;
    renameSavedCalendar(id, next);
    if (id === activeCalendarId) setCalendarNameDraft(next);
    refresh();
  }

  function handleDeleteCalendar(id: string) {
    const ok =
      typeof window === "undefined" ||
      window.confirm(p.confirmDeleteCalendar);
    if (!ok) return;
    deleteSavedCalendar(id);
    if (activeCalendarId === id) closeToList();
    else refresh();
  }

  const cycleMode = useMemo(
    () => resolveScheduleCycleMode(cropName, language),
    [cropName, language]
  );

  useEffect(() => {
    if (endDateTouched) return;
    setEndDate(
      suggestSeasonEndDate({
        startDate,
        cropName,
        language,
        cycleMode,
      })
    );
  }, [startDate, cropName, language, cycleMode, endDateTouched]);

  const purposeOptions = useMemo(() => {
    const reproductiveLabel =
      cycleMode === "perennial"
        ? p.purposeReproductivePerennial
        : p.purposeReproductive;
    const establishmentLabel =
      cycleMode === "perennial"
        ? p.purposeEstablishmentPerennial
        : p.purposeEstablishment;
    return [
      {
        key: "full_cycle" as const,
        label: p.purposeFullCycle,
        hint: p.purposeFullCycleHint,
      },
      {
        key: "establishment" as const,
        label: establishmentLabel,
        hint: p.purposeEstablishmentHint,
      },
      {
        key: "vegetative" as const,
        label: p.purposeVegetative,
        hint: p.purposeVegetativeHint,
      },
      {
        key: "reproductive" as const,
        label: reproductiveLabel,
        hint: p.purposeReproductiveHint,
      },
      {
        key: "maintenance" as const,
        label: p.purposeMaintenance,
        hint: p.purposeMaintenanceHint,
      },
    ];
  }, [cycleMode, p]);

  function purposeLabel(value: SchedulePurpose) {
    return (
      purposeOptions.find((option) => option.key === value)?.label ||
      p.purposeFullCycle
    );
  }

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
    if (activeCalendarId) {
      return all
        .filter((e) => e.calendarId === activeCalendarId)
        .sort((a, b) => {
          const seq = (a.sequence || 99) - (b.sequence || 99);
          if (seq !== 0) return seq;
          return a.date.localeCompare(b.date);
        });
    }
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
  }, [tick, effectiveFarm, activeCalendarId]);

  const exportEvents = events;

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

  function markScheduleStale() {
    setScheduleStale(true);
  }

  function handlePurposeChange(next: SchedulePurpose) {
    if (next === purpose) return;
    setPurpose(next);
    if (events.length > 0) markScheduleStale();
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
    if (endDate && endDate <= startDate) {
      setError(p.seasonEndBeforeStart);
      return;
    }
    const next = suggestEventsFromPlan({
      doses: activeDoses,
      cropName,
      farmName: effectiveFarm,
      lotName: effectiveLot,
      startDate,
      endDate,
      purpose,
      language,
      stageLabels: stageLabelsFromI18n(p, cycleMode),
    });
    if (next.length === 0) {
      setError(p.needPlanHint);
      return;
    }
    let calendarId = activeCalendarId;
    if (!calendarId) {
      const autoName = `${effectiveFarm} · ${startDate}`;
      const name =
        (typeof window !== "undefined"
          ? window.prompt(p.calendarName, autoName)?.trim()
          : null) || autoName;
      const created = upsertSavedCalendar({
        name,
        farmName: effectiveFarm,
        lotName: effectiveLot || undefined,
        cropName: cropName || undefined,
        startDate,
        endDate,
        purpose,
        cycleMode,
        responsible: responsible || undefined,
      });
      calendarId = created.id;
      setCalendarNameDraft(created.name);
      openCalendar(created.id);
    } else {
      upsertSavedCalendar({
        id: calendarId,
        name: calendarNameDraft.trim() || `${effectiveFarm} · ${startDate}`,
        farmName: effectiveFarm,
        lotName: effectiveLot || undefined,
        cropName: cropName || undefined,
        startDate,
        endDate,
        purpose,
        cycleMode,
        responsible: responsible || undefined,
      });
    }
    acceptSuggestedEvents(next, {
      replaceFarmPlan: true,
      calendarId,
    });
    setScheduleStale(false);
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
      calendarId: activeCalendarId || undefined,
    });
    setTitle("");
    setRate("");
    setMethod("");
    setShowManual(false);
    refresh();
  }

  const completedCount = events.filter((e) => e.completed).length;

  async function handleExportPdf() {
    if (exportingPdfRef.current) return;
    setError("");
    if (exportEvents.length === 0) {
      setError(p.pdfNoEvents);
      return;
    }
    if (!pdfFarmName) {
      setError(p.farmRequired);
      return;
    }
    exportingPdfRef.current = true;
    setExportingPdf(true);
    try {
      await exportFertilizationPlanPdf({
        t,
        farmName: pdfFarmName,
        lotName: effectiveLot || exportEvents[0]?.lotName,
        cropName,
        responsible,
        seasonStart: startDate,
        seasonEnd: endDate,
        purposeLabel: purposeLabel(purpose),
        events: exportEvents,
        locale: language,
      });
    } catch (exportError) {
      setError(
        exportError instanceof Error ? exportError.message : p.pdfNoEvents
      );
    } finally {
      exportingPdfRef.current = false;
      setExportingPdf(false);
    }
  }

  if (!activeCalendarId) {
    return (
      <section className="animate-slide-up space-y-4 px-0 pb-8 pt-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="max-w-xl">
            <h1 className="text-xl font-bold text-[#1c1c1e] dark-text-primary">
              {p.savedCalendarsTitle}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="calc-guided-stepper__nav-btn calc-guided-stepper__nav-btn--primary text-sm"
              onClick={handleNewCalendar}
            >
              {p.newCalendar}
            </button>
            <button
              type="button"
              className="calc-guided-stepper__nav-btn text-sm"
              onClick={onBack}
            >
              {p.back}
            </button>
          </div>
        </div>
        {savedCalendars.length === 0 ? (
          <p className="text-sm text-slate-500">{p.noSavedCalendars}</p>
        ) : (
          <ul className="space-y-2">
            {savedCalendars.map((calendar) => (
              <li
                key={calendar.id}
                className="calc-surface flex flex-wrap items-center justify-between gap-2 px-3 py-2.5"
              >
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => openCalendar(calendar.id)}
                >
                  <span className="block font-semibold dark-text-primary">
                    {calendar.name}
                  </span>
                  <span className="block text-xs text-slate-500">
                    {[calendar.farmName, calendar.lotName]
                      .filter(Boolean)
                      .join(" · ")}
                    {calendar.startDate
                      ? ` · ${calendar.startDate}${
                          calendar.endDate ? ` → ${calendar.endDate}` : ""
                        }`
                      : ""}
                  </span>
                </button>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    className="plan-timeline-card__action"
                    onClick={() => openCalendar(calendar.id)}
                  >
                    {p.openSavedCalendar}
                  </button>
                  <button
                    type="button"
                    className="plan-timeline-card__action"
                    onClick={() => handleRenameCalendar(calendar.id)}
                  >
                    {p.renameCalendar}
                  </button>
                  <button
                    type="button"
                    className="plan-timeline-card__action"
                    onClick={() => handleDeleteCalendar(calendar.id)}
                  >
                    {p.deleteCalendar}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    );
  }

  return (
    <section className="animate-slide-up space-y-4 px-0 pb-8 pt-2">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-xl">
          <button
            type="button"
            className="mb-1 text-xs font-semibold text-slate-500 hover:underline"
            onClick={closeToList}
          >
            ← {p.backToCalendars}
          </button>
          <h1 className="text-xl font-bold text-[#1c1c1e] dark-text-primary">
            {calendarNameDraft || p.calendarTitle}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="calc-guided-stepper__nav-btn text-sm"
            onClick={() => handleSaveCalendar(false)}
          >
            {p.saveCalendar}
          </button>
          <button
            type="button"
            className="calc-guided-stepper__nav-btn text-sm"
            onClick={() => handleSaveCalendar(true)}
          >
            {p.saveCalendarAs}
          </button>
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
      {statusMessage ? (
        <p
          className="text-sm font-medium text-emerald-700 dark:text-emerald-300"
          role="status"
        >
          {statusMessage}
        </p>
      ) : null}
      <label className="block text-sm">
        <span className="font-semibold dark-text-primary">{p.calendarName}</span>
        <input
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
          value={calendarNameDraft}
          onChange={(e) => setCalendarNameDraft(e.target.value)}
          placeholder={p.calendarNamePlaceholder}
        />
      </label>

      <div className="calc-surface calendar-how-card">
        <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
          {p.howItWorksTitle}
        </h2>
        <ol className="calendar-how-card__list">
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

      <div className="calc-surface calendar-context-card">
        <div className="calendar-context-card__head">
          <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {p.contextTitle}
          </h2>
          <p className="calendar-context-card__meta">
            <span>{cropName || p.cropUnknown}</span>
            <span aria-hidden>·</span>
            <span>
              {cycleMode === "perennial"
                ? p.cycleModePerennialShort
                : cycleMode === "fruiting"
                  ? p.cycleModeFruitingShort
                  : p.cycleModeAnnualShort}
            </span>
          </p>
        </div>

        <div className="calendar-context-card__grid">
          <label className="calc-field-label grid gap-0.5">
            {p.farmLabel} *
            <input
              className="calc-field-input"
              value={onFarmNameChange ? farmName : localFarm}
              onChange={(e) => setFarm(e.target.value)}
              placeholder={p.farmPlaceholder}
              required
            />
          </label>
          <label className="calc-field-label grid gap-0.5">
            {p.lotLabel}
            <input
              className="calc-field-input"
              value={onLotNameChange ? lotName : localLot}
              onChange={(e) => setLot(e.target.value)}
              placeholder={p.lotPlaceholder}
            />
          </label>
          <label className="calc-field-label grid gap-0.5">
            {cycleMode === "perennial"
              ? p.seasonStartPerennial
              : cycleMode === "fruiting"
                ? p.seasonStartFruiting
                : p.seasonStart}
            <input
              className="calc-field-input"
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                if (events.length > 0) markScheduleStale();
              }}
            />
          </label>
          <label className="calc-field-label grid gap-0.5">
            {p.seasonEnd}
            <input
              className="calc-field-input"
              type="date"
              value={endDate}
              min={startDate}
              title={p.seasonEndHint}
              onChange={(e) => {
                setEndDateTouched(true);
                setEndDate(e.target.value);
                if (events.length > 0) markScheduleStale();
              }}
            />
          </label>
          <label className="calc-field-label grid gap-0.5 calendar-context-card__span">
            {p.responsibleLabel}
            <input
              className="calc-field-input"
              value={responsible}
              onChange={(e) => setResponsible(e.target.value)}
              placeholder={p.responsiblePlaceholder}
            />
          </label>
        </div>

        <div className="calendar-context-card__purpose">
          <p className="calc-field-label">{p.purposeTitle}</p>
          <div className="calendar-context-card__chips" role="group" aria-label={p.purposeHint}>
            {purposeOptions.map((option) => {
              const active = purpose === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className={`calendar-purpose-chip${
                    active ? " calendar-purpose-chip--active" : ""
                  }`}
                  aria-pressed={active}
                  title={option.hint}
                  onClick={() => handlePurposeChange(option.key)}
                >
                  {option.label}
                </button>
              );
            })}
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

        {scheduleStale && events.length > 0 ? (
          <div className="plan-callout">{p.scheduleNeedsRebuild}</div>
        ) : null}
      </div>

      <div className="calc-surface calendar-timeline-panel">
        <div className="calendar-timeline-panel__head">
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
              {p.timelineTitle}
            </h2>
            <p className="calendar-timeline-panel__progress">
              {events.length === 0
                ? p.emptyCalendar
                : p.timelineProgress
                    .replace("{done}", String(completedCount))
                    .replace("{total}", String(events.length))}
            </p>
          </div>
          <div className="calendar-timeline-panel__actions">
            <button
              type="button"
              className="plan-btn-secondary"
              onClick={() => setShowManual((v) => !v)}
            >
              {showManual ? p.hideManual : p.manualEventTitle}
            </button>
            <button
              type="button"
              className="plan-btn-primary"
              onClick={() => void handleExportPdf()}
              disabled={exportEvents.length === 0 || !pdfFarmName || exportingPdf}
            >
              {exportingPdf ? p.exportingPlanPdf : p.exportPlanPdf}
            </button>
          </div>
        </div>

        {showManual ? (
          <form className="calendar-timeline-panel__manual" onSubmit={handleAddManual}>
            <label className="calc-field-label grid gap-0.5">
              {p.eventTitle}
              <input
                className="calc-field-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </label>
            <div className="calendar-context-card__grid">
              <label className="calc-field-label grid gap-0.5">
                {p.eventDate}
                <input
                  className="calc-field-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </label>
              <label className="calc-field-label grid gap-0.5">
                {p.eventRate}
                <input
                  className="calc-field-input"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                />
              </label>
            </div>
            <label className="calc-field-label grid gap-0.5">
              {p.eventMethod}
              <input
                className="calc-field-input"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              />
            </label>
            <button type="submit" className="plan-btn-primary">
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
    <ol className="plan-timeline plan-timeline--compact">
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
            className={`plan-timeline-card plan-timeline-card--compact ${
              item.completed ? "plan-timeline-card--done" : ""
            } ${preview ? "plan-timeline-card--preview" : ""}`}
          >
            <div className="plan-timeline-card__row">
              <div className="min-w-0 flex-1">
                <div className="plan-timeline-card__topline">
                  <p className="plan-timeline-card__title">
                    {item.stageLabel || item.title}
                  </p>
                  {item.completed ? (
                    <span className="plan-status-pill">{t.statusDone}</span>
                  ) : null}
                </div>
                <div className="plan-timeline-card__meta plan-timeline-card__meta-row">
                  {editableDates && onDateChange ? (
                    <input
                      type="date"
                      className="calc-field-input plan-timeline-card__date"
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
                </div>
              </div>
              {!preview ? (
                <div className="plan-timeline-card__ops">
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

            {item.method ? (
              <p className="plan-timeline-card__hint" title={item.method}>
                {item.method}
              </p>
            ) : null}

            {item.lines && item.lines.length > 0 ? (
              <ul className="plan-timeline-nutrients">
                {item.lines.map((line) => (
                  <li
                    key={`${item.id}-${line.nutrient}-${line.kgHa}`}
                    className="plan-timeline-nutrient"
                  >
                    <span className="plan-timeline-line__nutrient">
                      {line.nutrient}
                      {line.percentOfTotal != null
                        ? ` ${line.percentOfTotal}%`
                        : ""}
                    </span>
                    <span className="plan-timeline-line__qty">
                      {line.kgHa} {line.unitHa}
                    </span>
                  </li>
                ))}
              </ul>
            ) : item.rate ? (
              <p className="plan-timeline-card__meta plan-timeline-card__rate">
                {item.rate}
              </p>
            ) : null}
          </article>
        </li>
      ))}
    </ol>
  );
}
