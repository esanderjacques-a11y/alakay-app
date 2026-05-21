"use client";

import { useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, ClipboardList, FileText, History, PlayCircle } from "lucide-react";

import AnalysisHistory, {
  EditableAnalysisPayload,
} from "@/components/AnalysisHistory";
import GlassPanel from "@/components/ui/GlassPanel";
import { formatMessage, Language, Translation } from "@/lib/translations";

type Props = {
  session: Session | null;
  guestMode: boolean;
  language: Language;
  t: Translation;
  enteredValuesCount: number;
  interpretedResultsCount: number;
  hasCurrentResults: boolean;
  goToValues: () => void;
  goToCurrentResults: () => void;
  onEditAnalysis: (payload: EditableAnalysisPayload) => void;
};

export default function ResultsDashboard({
  session,
  guestMode,
  language,
  t,
  enteredValuesCount,
  interpretedResultsCount,
  hasCurrentResults,
  goToValues,
  goToCurrentResults,
  onEditAnalysis,
}: Props) {
  const [activeTab, setActiveTab] = useState<"progress" | "history">(
    hasCurrentResults || enteredValuesCount > 0 ? "progress" : "history"
  );

  const canViewHistory = Boolean(session?.user && !guestMode);
  const hasProgress = enteredValuesCount > 0 || hasCurrentResults;

  return (
    <section className="mt-4 grid gap-3 animate-fade-in">
      <GlassPanel className="p-3 sm:p-4">
        <article className="flex flex-col gap-2">
          <span>
            <h1 className="text-base font-extrabold uppercase tracking-wide text-green-900">
              {t.results}
            </h1>
            <p className="mt-0.5 max-w-xl text-xs text-slate-600">{t.resultsPageDesc}</p>
          </span>
        </article>

        <span className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={`touch-target rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
              activeTab === "progress"
                ? "border-green-300 bg-green-50/90"
                : "border-white/60 bg-white/40 hover:bg-white/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <PlayCircle size={17} className="shrink-0 text-green-800" />
              <span className="min-w-0">
                <p className="truncate text-sm font-bold text-green-900">{t.inProgress}</p>
                <p className="text-[11px] font-semibold text-slate-500">
                  {enteredValuesCount} {t.entered} · {interpretedResultsCount} {t.interpreted}
                </p>
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`touch-target rounded-xl border px-3 py-2 text-left transition active:scale-[0.98] ${
              activeTab === "history"
                ? "border-green-300 bg-green-50/90"
                : "border-white/60 bg-white/40 hover:bg-white/70"
            }`}
          >
            <span className="flex items-center gap-2">
              <History size={17} className="shrink-0 text-green-800" />
              <span className="min-w-0">
                <p className="truncate text-sm font-bold text-green-900">{t.history}</p>
                <p className="truncate text-[11px] font-semibold text-slate-500">
                  {t.savedReports}
                </p>
              </span>
            </span>
          </button>
        </span>
      </GlassPanel>

      {activeTab === "progress" ? (
        <GlassPanel className="p-4 sm:p-5">
          <span className="flex items-start gap-3">
            <span className="rounded-2xl bg-green-100 p-3 text-green-800">
              <ClipboardList size={24} />
            </span>
            <span>
              <h2 className="text-xl font-bold text-green-900">
                {t.inProgressAnalysis}
              </h2>
              <p className="mt-1 text-sm text-slate-600">{t.inProgressSectionDesc}</p>
            </span>
          </span>

          {hasProgress ? (
            <span className="mt-5 grid gap-4 md:grid-cols-2">
              <span className="rounded-2xl border border-white/60 bg-white/50 p-5">
                <span className="flex items-center gap-3">
                  <FileText size={22} className="text-green-800" />
                  <span>
                    <p className="font-bold text-slate-900">{t.labValues}</p>
                    <p className="text-sm text-slate-600">
                      {formatMessage(t.valuesEnteredCount, {
                        count: enteredValuesCount,
                      })}
                    </p>
                  </span>
                </span>

                <button
                  type="button"
                  onClick={goToValues}
                  className="touch-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98] hover:bg-green-800"
                >
                  {t.continueEditing}
                  <ArrowRight size={16} />
                </button>
              </span>

              <span
                className={`rounded-2xl border p-5 ${
                  hasCurrentResults
                    ? "border-white/60 bg-white/50"
                    : "border-white/60 bg-white/50 opacity-50"
                }`}
              >
                <span className="flex items-center gap-3">
                  <ClipboardList size={22} className="text-green-800" />
                  <span>
                    <p className="font-bold text-slate-900">{t.currentResults}</p>
                    <p className="text-sm text-slate-600">
                      {formatMessage(t.interpretedResultsShort, {
                        count: interpretedResultsCount,
                      })}
                    </p>
                  </span>
                </span>

                <button
                  type="button"
                  onClick={goToCurrentResults}
                  disabled={!hasCurrentResults}
                  className="touch-target mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-4 py-3 text-sm font-semibold text-white active:scale-[0.98] hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {t.openResults}
                  <ArrowRight size={16} />
                </button>
              </span>
            </span>
          ) : (
            <p className="mt-5 rounded-2xl bg-yellow-50/90 p-4 text-yellow-900">
              {t.noInProgressDetail}
            </p>
          )}
        </GlassPanel>
      ) : (
        <GlassPanel className="p-4 sm:p-5">
          {canViewHistory ? (
            <AnalysisHistory
              session={session}
              language={language}
              t={t}
              onEditAnalysis={onEditAnalysis}
            />
          ) : (
            <p className="rounded-2xl bg-yellow-50/90 p-4 text-yellow-900">
              {t.loginForHistory}
            </p>
          )}
        </GlassPanel>
      )}
    </section>
  );
}
