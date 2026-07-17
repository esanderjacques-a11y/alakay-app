"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  FileUp,
  History,
  PlayCircle,
} from "lucide-react";

import AnalysisHistory, {
  EditableAnalysisPayload,
} from "@/components/AnalysisHistory";
import ImportedLabCachePanel from "@/components/ImportedLabCachePanel";
import { listImportCache } from "@/lib/importCache";
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
  onResumeImport: (cacheId: string) => void;
  focusAnalysisId?: number | null;
  onFocusAnalysisConsumed?: () => void;
};

type DashboardTab = "progress" | "history" | "imports";

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
  onResumeImport,
  focusAnalysisId = null,
  onFocusAnalysisConsumed,
}: Props) {
  const canViewHistory = Boolean(session?.user && !guestMode);
  const hasProgress = enteredValuesCount > 0 || hasCurrentResults;
  const historyDisabled = !canViewHistory;
  const [importCount, setImportCount] = useState(0);

  const refreshImportCount = useCallback(() => {
    setImportCount(listImportCache().length);
  }, []);

  const [activeTab, setActiveTab] = useState<DashboardTab>(
    canViewHistory ? "history" : hasProgress ? "progress" : "imports"
  );
  const [readingReport, setReadingReport] = useState(false);

  useEffect(() => {
    refreshImportCount();
    const id = window.setInterval(refreshImportCount, 60_000);
    return () => window.clearInterval(id);
  }, [refreshImportCount]);

  useEffect(() => {
    if (historyDisabled && activeTab === "history") {
      setActiveTab(importCount > 0 ? "imports" : "progress");
    }
  }, [activeTab, historyDisabled, importCount]);

  useEffect(() => {
    if (focusAnalysisId && !historyDisabled) {
      setActiveTab("history");
    }
  }, [focusAnalysisId, historyDisabled]);

  const showTabs = !readingReport && (hasProgress || canViewHistory || importCount > 0);

  return (
    <section className="results-dashboard flex flex-col gap-2 animate-fade-in">
      {showTabs ? (
        <div className="history-seg results-dashboard__tabs">
          {hasProgress ? (
            <button
              type="button"
              onClick={() => setActiveTab("progress")}
              className={`history-seg__btn${
                activeTab === "progress" ? " history-seg__btn--active" : ""
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <PlayCircle size={14} />
                {t.inProgress}
                {enteredValuesCount > 0 && activeTab !== "progress" ? (
                  <span className="text-[10px] opacity-80">{enteredValuesCount}</span>
                ) : null}
              </span>
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setActiveTab("imports")}
            className={`history-seg__btn${
              activeTab === "imports" ? " history-seg__btn--active" : ""
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <FileUp size={14} />
              {t.imports}
              {importCount > 0 && activeTab !== "imports" ? (
                <span className="text-[10px] opacity-80">{importCount}</span>
              ) : null}
            </span>
          </button>

          <button
            type="button"
            disabled={historyDisabled}
            onClick={() => {
              if (historyDisabled) return;
              setActiveTab("history");
            }}
            className={`history-seg__btn${
              activeTab === "history" && !historyDisabled
                ? " history-seg__btn--active"
                : ""
            }${historyDisabled ? " opacity-45" : ""}`}
          >
            <span className="inline-flex items-center gap-1.5">
              <History size={14} />
              {t.history}
            </span>
          </button>
        </div>
      ) : null}

      {activeTab === "progress" && hasProgress ? (
        <div className="flex flex-col gap-2">
          <div className="glass-panel rounded-xl px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <FileText size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1c1c1e]">{t.labValues}</p>
                <p className="text-[11px] text-[#6c6c70]">
                  {formatMessage(t.valuesEnteredCount, { count: enteredValuesCount })}
                </p>
              </div>
              <button
                type="button"
                onClick={goToValues}
                className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-800 active:scale-95"
              >
                {t.continueEditing}
                <ArrowRight size={13} />
              </button>
            </div>
          </div>

          <div
            className={`glass-panel rounded-xl px-3 py-2.5 ${
              !hasCurrentResults ? "opacity-50" : ""
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                <ClipboardList size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[#1c1c1e]">{t.currentResults}</p>
                <p className="text-[11px] text-[#6c6c70]">
                  {formatMessage(t.interpretedResultsShort, {
                    count: interpretedResultsCount,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={goToCurrentResults}
                disabled={!hasCurrentResults}
                className="inline-flex items-center gap-1 rounded-lg bg-green-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-green-800 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {t.openResults}
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>
      ) : activeTab === "progress" ? (
        <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          {t.noInProgressDetail}
        </div>
      ) : activeTab === "imports" ? (
        <ImportedLabCachePanel
          language={language}
          onResume={(cacheId) => {
            refreshImportCount();
            onResumeImport(cacheId);
          }}
        />
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
              focusAnalysisId={focusAnalysisId}
              onFocusAnalysisConsumed={onFocusAnalysisConsumed}
            />
          ) : (
            <div className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {t.loginForHistory}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
