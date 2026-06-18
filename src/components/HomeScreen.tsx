"use client";

import { useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Calculator,
  Camera,
  ChevronRight,
  FileText,
  History,
  Plus,
  Upload,
  X,
} from "lucide-react";
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
  hasResultsOrProgress,
}: Props) {
  const [showImportMenu, setShowImportMenu] = useState(false);
  const importPresence = useAnimatedPresence(showImportMenu);
  const importMenuRef = useRef<HTMLDivElement | null>(null);

  useDismissible(showImportMenu, () => setShowImportMenu(false), importMenuRef);

  const importOptions = [
    {
      icon: <FileText size={19} />,
      label: t.importDocument,
      sub: t.importDocumentShort,
      onClick: () => {
        setShowImportMenu(false);
        openImporter("import");
      },
    },
    {
      icon: <Camera size={19} />,
      label: t.takePhoto,
      sub: t.takePhotoShort,
      onClick: () => {
        setShowImportMenu(false);
        openImporter("scan");
      },
    },
  ];

  return (
    <section className="home-screen animate-slide-up">
      <div className="home-screen__inner">
        <div className="home-screen__hero">
          <div className="home-hero-cycle">
            <span>{t.homeHeroCycle1}</span>
            <span>{t.homeHeroCycle2}</span>
            <span>{t.homeHeroCycle3}</span>
          </div>
        </div>

        <div className="home-action-grid">
          <button
            type="button"
            onClick={startNewAnalysis}
            className="home-action-tile home-action-tile--primary"
          >
            <span className="home-action-tile__icon home-action-tile__icon--primary">
              <Plus size={20} />
            </span>
            <span className="home-action-tile__copy">
              <span className="home-action-tile__title">{t.insertNew}</span>
              <span className="home-action-tile__desc">{t.insertNewShort}</span>
            </span>
          </button>

          <div ref={importMenuRef} className="relative min-w-0">
            <button
              type="button"
              onClick={() => setShowImportMenu((prev) => !prev)}
              className="home-action-tile w-full"
            >
              <span className="home-action-tile__icon">
                <Upload size={20} />
              </span>
              <span className="home-action-tile__copy">
                <span className="home-action-tile__title">{t.importData}</span>
                <span className="home-action-tile__desc">{t.importDataShort}</span>
              </span>
            </button>

            {importPresence.mounted ? (
              <>
                <button
                  type="button"
                  aria-label={t.close}
                  className={`fixed inset-0 z-[13000] bg-black/30 ${
                    importPresence.leaving ? "animate-fade-out" : "animate-fade-in"
                  }`}
                  onClick={() => setShowImportMenu(false)}
                />
                <div
                  className={`fixed bottom-0 inset-x-0 z-[13001] sm:absolute sm:bottom-auto sm:inset-x-auto sm:left-0 sm:top-full sm:mt-2 sm:w-56 ${
                    importPresence.leaving ? "animate-scale-out" : "animate-scale-in"
                  }`}
                >
                  <div className="home-import-menu glass-panel-strong mx-2 mb-2 sm:mx-0 sm:mb-0 overflow-hidden rounded-2xl shadow-xl shadow-black/10">
                    <div className="px-4 py-3 border-b border-black/6 flex items-center justify-between">
                      <span className="text-sm font-bold text-slate-800">{t.importData}</span>
                      <button
                        type="button"
                        onClick={() => setShowImportMenu(false)}
                        className="h-7 w-7 grid place-items-center rounded-lg text-slate-400 hover:bg-slate-100"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    {importOptions.map((opt, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={opt.onClick}
                        className="touch-target flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 active:bg-slate-100 transition-colors"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-green-50 text-green-700">
                          {opt.icon}
                        </span>
                        <div className="min-w-0">
                          <span className="block text-sm font-semibold text-slate-800">
                            {opt.label}
                          </span>
                          <span className="block text-xs text-slate-400">{opt.sub}</span>
                        </div>
                        <ChevronRight size={15} className="ml-auto text-slate-300 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={goResults}
            disabled={!hasResultsOrProgress}
            className="home-action-tile disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <span className="home-action-tile__icon">
              <History size={20} />
            </span>
            <span className="home-action-tile__copy">
              <span className="home-action-tile__title">{t.savedReports}</span>
              <span className="home-action-tile__desc">{t.savedReportsShort}</span>
            </span>
          </button>

          <button type="button" onClick={goCalculators} className="home-action-tile">
            <span className="home-action-tile__icon">
              <Calculator size={20} />
            </span>
            <span className="home-action-tile__copy">
              <span className="home-action-tile__title">{t.calculators}</span>
              <span className="home-action-tile__desc">{t.calculatorsShort}</span>
            </span>
          </button>
        </div>

        {!session?.user || guestMode ? (
          <div className="home-flat-guest-note">
            <span className="text-[12px] font-medium">{t.loginOrGuestShort}</span>
          </div>
        ) : null}

        <div className="home-info-strip">
          <div className="home-info-strip__dot" />
          <span className="home-info-strip__text">{t.shortTagline}</span>
        </div>
      </div>
    </section>
  );
}
