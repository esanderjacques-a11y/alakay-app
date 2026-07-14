"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowRight, ClipboardList, FileText, History, PlayCircle } from "lucide-react";

import AnalysisHistory, {
  EditableAnalysisPayload,
} from "@/components/AnalysisHistory";
import { formatMessage, Language, Translation } from "@/lib/translations";

type Props = {
  session: Session | null;
  guestMode: boolean;
  language: Language;
  t: Translation;
  generatedBy?: string;
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
  generatedBy,
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
  const [readingReport, setReadingReport] = useState(false);

  const canViewHistory = Boolean(session?.user && !guestMode);
  const hasProgress = enteredValuesCount > 0 || hasCurrentResults;
  const historyDisabled = !canViewHistory;

  useEffect(() => {
    if (historyDisabled && activeTab === "history") {
      setActiveTab("progress");
    }
  }, [activeTab, historyDisabled]);

  return (
    <section className="flex flex-col gap-3 animate-fade-in">
      {/* Compact tab switcher — only show when not reading a report */}
      {!readingReport && (
        <div className="auth-mode-tabs flex gap-1 rounded-2xl p-1">
          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            className={`auth-mode-tabs__btn flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold ${
              activeTab === "progress" ? "auth-mode-tabs__btn--active" : ""
            }`}
          >
            <PlayCircle size={16} />
            {t.inProgress}
            {(enteredValuesCount > 0 || hasCurrentResults) && activeTab !== "progress" && (
              <span className="rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-bold text-green-800">
                {enteredValuesCount}
              </span>
            )}
          </button>

          <button
            type="button"
            disabled={historyDisabled}
            onClick={() => {
              if (historyDisabled) return;
              setActiveTab("history");
            }}
            className={`auth-mode-tabs__btn flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold disabled:cursor-not-allowed ${
              activeTab === "history" && !historyDisabled
                ? "auth-mode-tabs__btn--active"
                : historyDisabled
                ? "text-[#aeaeb2]"
                : ""
            }`}
          >
            <History size={16} />
            {t.history}
          </button>
        </div>
      )}

      {activeTab === "progress" ? (
        <div className="flex flex-col gap-3">
          {hasProgress ? (
            <>
              {/* Lab values card */}
              <div className="glass-panel rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-700">
                    <FileText size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1c1c1e]">{t.labValues}</p>
                    <p className="text-xs text-[#6c6c70]">
                      {formatMessage(t.valuesEnteredCount, { count: enteredValuesCount })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToValues}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 active:scale-95"
                  >
                    {t.continueEditing}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>

              {/* Current results card */}
              <div className={`glass-panel rounded-2xl p-4 ${!hasCurrentResults ? "opacity-50" : ""}`}>
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-green-50 text-green-700">
                    <ClipboardList size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-[#1c1c1e]">{t.currentResults}</p>
                    <p className="text-xs text-[#6c6c70]">
                      {formatMessage(t.interpretedResultsShort, { count: interpretedResultsCount })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={goToCurrentResults}
                    disabled={!hasCurrentResults}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {t.openResults}
                    <ArrowRight size={15} />
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              {t.noInProgressDetail}
            </div>
          )}
        </div>
      ) : (
        <div>
          {canViewHistory ? (
            <AnalysisHistory
              session={session}
              language={language}
              t={t}
              generatedBy={generatedBy}
              onEditAnalysis={onEditAnalysis}
              onReadingChange={setReadingReport}
            />
          ) : (
            <div className="rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">
              {t.loginForHistory}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
