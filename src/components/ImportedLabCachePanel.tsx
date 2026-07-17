"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock3, FileUp, RefreshCcw, ScanLine, Trash2 } from "lucide-react";
import {
  formatImportCacheExpiry,
  listImportCache,
  purgeExpiredImportCache,
  removeImportCache,
  type CachedImportEntry,
} from "@/lib/importCache";
import { importedLabCacheText } from "@/lib/i18n/componentText";
import { formatMessage } from "@/lib/translations";
import type { Language } from "@/lib/translations";

type Props = {
  language: Language;
  onResume: (cacheId: string) => void;
};

export default function ImportedLabCachePanel({ language, onResume }: Props) {
  const l =
    importedLabCacheText[language as keyof typeof importedLabCacheText] ||
    importedLabCacheText.en;
  const [entries, setEntries] = useState<CachedImportEntry[]>([]);

  const refresh = useCallback(() => {
    setEntries(listImportCache());
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(() => {
      purgeExpiredImportCache();
      refresh();
    }, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  if (entries.length === 0) {
    return (
      <div className="import-cache-empty rounded-xl bg-amber-50 px-3 py-3 text-sm text-amber-950">
        {l.empty}
      </div>
    );
  }

  return (
    <section className="import-cache-panel flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <p className="text-xs leading-relaxed text-[#6c6c70]">{l.desc}</p>
        <button
          type="button"
          onClick={refresh}
          className="history-icon-button history-icon-button--sm shrink-0"
          aria-label={l.refresh}
          title={l.refresh}
        >
          <RefreshCcw size={14} />
        </button>
      </div>

      <ul className="import-cache-list">
        {entries.map((entry) => {
          const Icon =
            entry.sourceKind === "scan"
              ? ScanLine
              : FileUp;
          return (
            <li key={entry.id} className="import-cache-card">
              <div className="import-cache-card__main">
                <span className="import-cache-card__icon" aria-hidden>
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="import-cache-card__title truncate">{entry.sourceLabel}</p>
                  <p className="import-cache-card__meta">
                    {formatMessage(l.matched, { count: entry.matchedCount })}
                    {entry.reviewCount > 0
                      ? ` · ${formatMessage(l.toCheck, { count: entry.reviewCount })}`
                      : ""}
                  </p>
                  <p className="import-cache-card__expiry">
                    <Clock3 size={12} aria-hidden />
                    {formatImportCacheExpiry(entry.expiresAt)}
                  </p>
                </div>
              </div>
              <div className="import-cache-card__actions">
                <button
                  type="button"
                  className="import-cache-card__resume"
                  onClick={() => onResume(entry.id)}
                >
                  {l.resume}
                </button>
                <button
                  type="button"
                  className="import-cache-card__delete"
                  aria-label={l.delete}
                  title={l.delete}
                  onClick={() => {
                    removeImportCache(entry.id);
                    refresh();
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
