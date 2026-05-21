"use client";

import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Camera,
  Calculator,
  FileSpreadsheet,
  FileText,
  History,
  Plus,
  Settings,
  Upload,
} from "lucide-react";
import GlassPanel from "@/components/ui/GlassPanel";
import { useAnimatedPresence } from "@/hooks/useAnimatedPresence";
import { useDismissible } from "@/hooks/useDismissible";
import { Language, translations } from "@/lib/translations";

type Props = {
  t: (typeof translations)[Language];
  session: Session | null;
  guestMode: boolean;
  startNewAnalysis: () => void;
  openImporter: (mode?: "scan" | "import") => void;
  goResults: () => void;
  goCalculators: () => void;
  goSettings: () => void;
  hasResultsOrProgress: boolean;
};

export default function HomeScreen({
  t,
  session,
  guestMode,
  startNewAnalysis,
  openImporter,
  goResults,
  goCalculators,
  goSettings,
  hasResultsOrProgress,
}: Props) {
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importPresence = useAnimatedPresence(showImportMenu);
  const importMenuRef = useRef<HTMLDivElement | null>(null);

  useDismissible(showImportMenu, () => setShowImportMenu(false), importMenuRef);

  const historyDisabled = !hasResultsOrProgress;

  return (
    <section className="w-full animate-slide-up">
      <GlassPanel className="home-entry-panel mx-auto w-full p-5 sm:p-6 md:p-7">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-base font-extrabold uppercase text-green-900 sm:text-lg md:text-xl">
            {t.startNewAnalysis}
          </h2>
        </div>

        <button
          type="button"
          onClick={startNewAnalysis}
          className="touch-target home-primary-action mt-4 sm:mt-5"
        >
          <span className="home-primary-icon" aria-hidden>
            <Plus size={30} strokeWidth={2.4} />
          </span>
          <span className="home-primary-copy">
            <span className="home-primary-title">{t.insertNew}</span>
            <span className="home-primary-desc">{t.insertNewDesc}</span>
          </span>
        </button>

        <div className="home-actions-grid mt-4 grid gap-3">
          <div ref={importMenuRef} className="relative min-w-0">
            {importPresence.mounted ? (
              <button
                type="button"
                aria-label={t.close}
                className={`dismiss-backdrop home-import-backdrop ${
                  importPresence.leaving ? "animate-fade-out" : "animate-fade-in"
                }`}
                onClick={() => setShowImportMenu(false)}
              />
            ) : null}

            <button
              type="button"
              onClick={() => setShowImportMenu((previous) => !previous)}
              className="touch-target home-secondary-action"
            >
              <Upload size={20} className="shrink-0" />
              <span className="home-action-copy">
                <span className="home-action-title">{t.importData}</span>
                <span className="home-action-desc">{t.importDataDesc}</span>
              </span>
            </button>

            {importPresence.mounted ? (
              <section
                className={`home-import-menu fixed left-1/2 top-1/2 z-[13001] w-[min(92vw,24rem)] -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white p-3 shadow-2xl ${
                  importPresence.leaving ? "animate-scale-out" : "animate-scale-in"
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowImportMenu(false);
                    openImporter("import");
                  }}
                  className="touch-target flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left hover:bg-green-50"
                >
                  <FileSpreadsheet
                    size={20}
                    className="mt-0.5 shrink-0 text-green-800"
                  />
                  <span>
                    <p className="font-bold text-green-900">{t.excel}</p>
                    <p className="mt-1 text-xs text-slate-500">{t.excelDesc}</p>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowImportMenu(false);
                    openImporter("import");
                  }}
                  className="touch-target mt-2 flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left hover:bg-green-50"
                >
                  <FileText size={20} className="mt-0.5 shrink-0 text-green-800" />
                  <span>
                    <p className="font-bold text-green-900">{t.csv}</p>
                    <p className="mt-1 text-xs text-slate-500">{t.csvDesc}</p>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowImportMenu(false);
                    openImporter("import");
                  }}
                  className="touch-target mt-2 flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left hover:bg-green-50"
                >
                  <FileText size={20} className="mt-0.5 shrink-0 text-green-800" />
                  <span>
                    <p className="font-bold text-green-900">{t.pdf}</p>
                    <p className="mt-1 text-xs text-slate-500">{t.comingSoonPdf}</p>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowImportMenu(false);
                    openImporter("scan");
                  }}
                  className="touch-target mt-2 flex w-full items-start gap-3 rounded-2xl px-4 py-3 text-left hover:bg-green-50"
                >
                  <Camera size={20} className="mt-0.5 shrink-0 text-green-800" />
                  <span>
                    <p className="font-bold text-green-900">{t.photos}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {t.comingSoonPhotos}
                    </p>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowImportMenu(false)}
                  className="touch-target mt-2 w-full rounded-2xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                >
                  {t.close}
                </button>
              </section>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => openImporter("scan")}
            className="touch-target home-secondary-action"
          >
            <Camera size={20} className="shrink-0" />
            <span className="home-action-copy">
              <span className="home-action-title">{t.takePhoto}</span>
              <span className="home-action-desc">{t.takePhotoDesc}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={goResults}
            disabled={historyDisabled}
            className="touch-target home-secondary-action disabled:cursor-not-allowed disabled:opacity-50"
          >
            <History size={20} className="shrink-0" />
            <span className="home-action-copy">
              <span className="home-action-title">{t.savedReports}</span>
              <span className="home-action-desc">
                {session?.user && !guestMode
                  ? t.openHistoryDesc
                  : t.loginToViewHistory}
              </span>
            </span>
          </button>

          <button
            type="button"
            onClick={goCalculators}
            className="touch-target home-secondary-action"
          >
            <Calculator size={20} className="shrink-0" />
            <span className="home-action-copy">
              <span className="home-action-title">{t.calculators}</span>
              <span className="home-action-desc">{t.calculatorsDesc}</span>
            </span>
          </button>

          <button
            type="button"
            onClick={goSettings}
            className="touch-target home-secondary-action"
          >
            <Settings size={20} className="shrink-0" />
            <span className="home-action-copy">
              <span className="home-action-title">{t.appSettings}</span>
              <span className="home-action-desc">{t.appSettingsDesc}</span>
            </span>
          </button>
        </div>

        {!session?.user || guestMode ? (
          <p className="mt-4 rounded-2xl bg-green-50/80 px-4 py-2.5 text-center text-xs font-medium text-green-900">
            {t.loginOrGuestShort}
          </p>
        ) : null}
      </GlassPanel>
    </section>
  );
}

