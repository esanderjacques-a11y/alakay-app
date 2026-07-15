"use client";

import { useMemo, useState } from "react";
import type { Translation } from "@/lib/translations";
import {
  deleteUserNote,
  loadPlanningState,
  saveUserNote,
  suggestNoteFromCalendar,
} from "@/lib/planningStore";

type Props = {
  t: Translation;
  onBack: () => void;
  farmName?: string;
  lotName?: string;
};

export default function NotesScreen({ t, onBack, farmName, lotName }: Props) {
  const p = t.planning;
  const [tick, setTick] = useState(0);
  const notes = useMemo(() => {
    void tick;
    return loadPlanningState().notes;
  }, [tick]);

  const upcomingEvent = useMemo(() => {
    void tick;
    const today = new Date().toISOString().slice(0, 10);
    const farmKey = (farmName || "").trim().toLocaleLowerCase();
    return loadPlanningState()
      .events.filter((event) => {
        if (event.completed) return false;
        if (event.date < today) return false;
        if (!farmKey) return true;
        return (event.farmName || "").trim().toLocaleLowerCase() === farmKey;
      })
      .sort((a, b) => a.date.localeCompare(b.date))[0];
  }, [tick, farmName]);

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [remindAt, setRemindAt] = useState("");
  const [sourceMode, setSourceMode] = useState<"manual" | "recommended">(
    "manual"
  );

  function refresh() {
    setTick((value) => value + 1);
  }

  function applyRecommendedFromCalendar() {
    if (!upcomingEvent) return;
    setSourceMode("recommended");
    setTitle(upcomingEvent.title);
    setBody(
      [
        upcomingEvent.rate ? `${upcomingEvent.rate}` : "",
        upcomingEvent.method ? upcomingEvent.method : "",
        upcomingEvent.stageLabel || "",
      ]
        .filter(Boolean)
        .join(" · ")
    );
    setRemindAt(`${upcomingEvent.date}T08:00`);
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    if (sourceMode === "recommended") {
      suggestNoteFromCalendar({
        farmName,
        lotName,
        title: title.trim(),
        body: body.trim(),
        remindAt: remindAt ? new Date(remindAt).toISOString() : null,
      });
    } else {
      saveUserNote({
        title: title.trim(),
        body: body.trim(),
        farmName,
        lotName,
        remindAt: remindAt ? new Date(remindAt).toISOString() : null,
        source: "manual",
      });
    }
    setTitle("");
    setBody("");
    setRemindAt("");
    setSourceMode("manual");
    refresh();
  }

  return (
    <section className="animate-slide-up space-y-4 px-3 pb-8 pt-2 sm:px-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#1c1c1e] dark-text-primary">
            {p.notesTitle}
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {p.notesDesc}
          </p>
        </div>
        <button type="button" className="calc-guided-stepper__nav-btn text-sm" onClick={onBack}>
          {p.back}
        </button>
      </div>

      <form className="calc-surface space-y-3 p-4" onSubmit={handleSave}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
            {p.newNote}
          </h2>
          {upcomingEvent ? (
            <button
              type="button"
              className="plan-timeline-card__action text-xs"
              onClick={applyRecommendedFromCalendar}
            >
              {p.useRecommendedNote}
            </button>
          ) : null}
        </div>
        {sourceMode === "recommended" ? (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {p.recommendedNoteHint}
          </p>
        ) : null}
        <label className="calc-field-label grid gap-1">
          {p.noteTitle}
          <input
            className="calc-field-input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSourceMode("manual");
            }}
            required
          />
        </label>
        <label className="calc-field-label grid gap-1">
          {p.noteBody}
          <textarea
            className="calc-field-input min-h-[5rem]"
            value={body}
            onChange={(e) => {
              setBody(e.target.value);
              setSourceMode("manual");
            }}
          />
        </label>
        <label className="calc-field-label grid gap-1">
          {p.remindAt}
          <input
            className="calc-field-input"
            type="datetime-local"
            value={remindAt}
            onChange={(e) => {
              setRemindAt(e.target.value);
              setSourceMode("manual");
            }}
          />
        </label>
        <p className="text-xs text-slate-500 dark:text-slate-400">{p.remindHint}</p>
        <button type="submit" className="plan-btn-primary">
          {p.saveNote}
        </button>
      </form>

      <div className="calc-surface space-y-3 p-4">
        <h2 className="text-sm font-bold text-[#1c1c1e] dark-text-primary">
          {p.yourNotes}
        </h2>
        {notes.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">{p.emptyNotes}</p>
        ) : (
          <ul className="grid gap-2">
            {notes.map((note) => (
              <li key={note.id} className="farm-detail-row">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold dark-text-primary">
                      {note.title}
                      {note.source === "recommended" ? (
                        <span className="ml-2 text-[10px] font-bold uppercase text-emerald-700">
                          {p.recommendedBadge}
                        </span>
                      ) : null}
                    </p>
                    {note.body ? (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                        {note.body}
                      </p>
                    ) : null}
                    {note.remindAt ? (
                      <p className="plan-timeline-card__action mt-1 text-xs">
                        {p.remindAt}: {new Date(note.remindAt).toLocaleString()}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-700"
                    onClick={() => {
                      deleteUserNote(note.id);
                      refresh();
                    }}
                  >
                    {p.delete}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
