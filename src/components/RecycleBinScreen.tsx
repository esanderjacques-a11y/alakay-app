"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Beaker,
  CheckSquare,
  FileText,
  Layers,
  RefreshCw,
  RotateCcw,
  Ruler,
  Square,
  Trash2,
  X,
} from "lucide-react";

import BackButton from "@/components/ui/BackButton";
import { StickyPageTitle } from "@/components/ui/StickyPageTitle";
import { deleteAnalysisPermanently } from "@/lib/analysisDeletion";
import { supabase } from "@/lib/supabase";
import type { Language, Translation } from "@/lib/translations";

type DeletedParameter = {
  custom_parameter_id: number;
  parameter_name: string;
  symbol: string | null;
  sample_type: "soil" | "foliar";
  deleted_at: string | null;
};

type DeletedRange = {
  custom_range_id: number;
  sample_type: "soil" | "foliar";
  min_value: number | null;
  max_value: number | null;
  deleted_at: string | null;
  parameters:
    | { parameter_name: string; symbol: string | null }
    | { parameter_name: string; symbol: string | null }[]
    | null;
  user_custom_parameters:
    | { parameter_name: string; symbol: string | null }
    | { parameter_name: string; symbol: string | null }[]
    | null;
  units: { unit_symbol: string } | { unit_symbol: string }[] | null;
};

type DeletedAnalysis = {
  analysis_id: number;
  analysis_name: string | null;
  sample_type_id: number | null;
  deleted_at: string | null;
  created_at: string;
  crops: { crop_name: string } | { crop_name: string }[] | null;
};

type FilterId = "all" | "reports" | "parameters" | "ranges";
type ItemKind = "analysis" | "parameter" | "range";

type Props = {
  t: Translation;
  language: Language;
  session: Session | null;
  onBack: () => void;
  onChanged: () => void;
};

function getOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function formatDate(value: string | null) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function parseRowKey(key: string): { kind: ItemKind; id: number } | null {
  const [kind, idText] = key.split("-");
  const id = Number(idText);
  if (
    (kind !== "analysis" && kind !== "parameter" && kind !== "range") ||
    !Number.isFinite(id)
  ) {
    return null;
  }
  return { kind, id };
}

export default function RecycleBinScreen({
  t,
  session,
  onBack,
  onChanged,
}: Props) {
  const labels = t.recycleBinScreen;
  const [parameters, setParameters] = useState<DeletedParameter[]>([]);
  const [ranges, setRanges] = useState<DeletedRange[]>([]);
  const [analyses, setAnalyses] = useState<DeletedAnalysis[]>([]);
  const [activeType, setActiveType] = useState<FilterId>("all");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"info" | "warn">("warn");

  const totalCount = parameters.length + ranges.length + analyses.length;

  useEffect(() => {
    void loadDeletedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    setSelectedKeys(new Set());
    setSelectMode(false);
  }, [activeType]);

  const filters: Array<{
    id: FilterId;
    label: string;
    count: number;
    icon: ReactNode;
  }> = useMemo(
    () => [
      {
        id: "all",
        label: labels.all,
        count: totalCount,
        icon: <Layers size={16} />,
      },
      {
        id: "reports",
        label: labels.reports,
        count: analyses.length,
        icon: <FileText size={16} />,
      },
      {
        id: "parameters",
        label: labels.parameters,
        count: parameters.length,
        icon: <Beaker size={16} />,
      },
      {
        id: "ranges",
        label: labels.ranges,
        count: ranges.length,
        icon: <Ruler size={16} />,
      },
    ],
    [
      analyses.length,
      labels.all,
      labels.parameters,
      labels.ranges,
      labels.reports,
      parameters.length,
      ranges.length,
      totalCount,
    ]
  );

  const showReports = activeType === "all" || activeType === "reports";
  const showParameters = activeType === "all" || activeType === "parameters";
  const showRanges = activeType === "all" || activeType === "ranges";

  const visibleKeys = useMemo(() => {
    const keys: string[] = [];
    if (showReports) {
      for (const analysis of analyses) {
        keys.push(`analysis-${analysis.analysis_id}`);
      }
    }
    if (showParameters) {
      for (const parameter of parameters) {
        keys.push(`parameter-${parameter.custom_parameter_id}`);
      }
    }
    if (showRanges) {
      for (const range of ranges) {
        keys.push(`range-${range.custom_range_id}`);
      }
    }
    return keys;
  }, [
    analyses,
    parameters,
    ranges,
    showParameters,
    showRanges,
    showReports,
  ]);

  const visibleCount = visibleKeys.length;
  const allVisibleSelected =
    visibleCount > 0 && visibleKeys.every((key) => selectedKeys.has(key));

  async function loadDeletedItems(options?: { keepMessage?: boolean }) {
    if (!session?.user) {
      setMessageKind("warn");
      setMessage(labels.login);
      setParameters([]);
      setRanges([]);
      setAnalyses([]);
      return;
    }

    setLoading(true);
    if (!options?.keepMessage) setMessage("");

    const [parameterResponse, rangeResponse, analysisResponse] =
      await Promise.all([
        supabase
          .from("user_custom_parameters")
          .select(
            "custom_parameter_id, parameter_name, symbol, sample_type, deleted_at"
          )
          .eq("user_id", session.user.id)
          .eq("is_deleted", true)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("user_custom_ranges")
          .select(
            `
          custom_range_id,
          sample_type,
          min_value,
          max_value,
          deleted_at,
          parameters ( parameter_name, symbol ),
          user_custom_parameters ( parameter_name, symbol ),
          units ( unit_symbol )
        `
          )
          .eq("user_id", session.user.id)
          .eq("is_deleted", true)
          .order("deleted_at", { ascending: false }),
        supabase
          .from("analyses")
          .select(
            `
          analysis_id,
          analysis_name,
          sample_type_id,
          deleted_at,
          created_at,
          crops ( crop_name )
        `
          )
          .eq("user_id", session.user.id)
          .eq("is_deleted", true)
          .order("deleted_at", { ascending: false }),
      ]);

    setLoading(false);

    const firstError =
      parameterResponse.error || rangeResponse.error || analysisResponse.error;

    if (firstError) {
      setMessageKind("warn");
      setMessage(firstError.message);
      return;
    }

    setParameters((parameterResponse.data || []) as DeletedParameter[]);
    setRanges((rangeResponse.data || []) as DeletedRange[]);
    setAnalyses((analysisResponse.data || []) as DeletedAnalysis[]);
  }

  function toggleSelected(key: string) {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function clearSelection() {
    setSelectedKeys(new Set());
  }

  function exitSelectMode() {
    setSelectMode(false);
    setSelectedKeys(new Set());
  }

  function selectAllVisible() {
    setSelectedKeys(new Set(visibleKeys));
  }

  async function restoreKeys(keys: string[]) {
    if (!session?.user || keys.length === 0) return;

    const analysisIds: number[] = [];
    const parameterIds: number[] = [];
    const rangeIds: number[] = [];

    for (const key of keys) {
      const parsed = parseRowKey(key);
      if (!parsed) continue;
      if (parsed.kind === "analysis") analysisIds.push(parsed.id);
      if (parsed.kind === "parameter") parameterIds.push(parsed.id);
      if (parsed.kind === "range") rangeIds.push(parsed.id);
    }

    if (analysisIds.length) {
      const { error } = await supabase
        .from("analyses")
        .update({ is_deleted: false, deleted_at: null })
        .in("analysis_id", analysisIds)
        .eq("user_id", session.user.id);
      if (error) throw new Error(error.message);
    }
    if (parameterIds.length) {
      const { error } = await supabase
        .from("user_custom_parameters")
        .update({ is_deleted: false, deleted_at: null })
        .in("custom_parameter_id", parameterIds)
        .eq("user_id", session.user.id);
      if (error) throw new Error(error.message);
    }
    if (rangeIds.length) {
      const { error } = await supabase
        .from("user_custom_ranges")
        .update({ is_deleted: false, deleted_at: null })
        .in("custom_range_id", rangeIds)
        .eq("user_id", session.user.id);
      if (error) throw new Error(error.message);
    }
  }

  async function permanentlyDeleteKeys(keys: string[]) {
    if (!session?.user || keys.length === 0) return;

    const analysisIds: number[] = [];
    const parameterIds: number[] = [];
    const rangeIds: number[] = [];

    for (const key of keys) {
      const parsed = parseRowKey(key);
      if (!parsed) continue;
      if (parsed.kind === "analysis") analysisIds.push(parsed.id);
      if (parsed.kind === "parameter") parameterIds.push(parsed.id);
      if (parsed.kind === "range") rangeIds.push(parsed.id);
    }

    for (const analysisId of analysisIds) {
      await deleteAnalysisPermanently(analysisId, session.user.id);
    }

    if (parameterIds.length) {
      const { error } = await supabase
        .from("user_custom_parameters")
        .delete()
        .in("custom_parameter_id", parameterIds)
        .eq("user_id", session.user.id)
        .eq("is_deleted", true);
      if (error) throw new Error(error.message);
    }

    if (rangeIds.length) {
      const { error } = await supabase
        .from("user_custom_ranges")
        .delete()
        .in("custom_range_id", rangeIds)
        .eq("user_id", session.user.id)
        .eq("is_deleted", true);
      if (error) throw new Error(error.message);
    }
  }

  async function restore(
    table: "analyses" | "user_custom_parameters" | "user_custom_ranges",
    idColumn: string,
    id: number,
    rowKey: string
  ) {
    if (!session?.user) return;

    setRestoringId(rowKey);
    setMessage("");

    const { error } = await supabase
      .from(table)
      .update({ is_deleted: false, deleted_at: null })
      .eq(idColumn, id)
      .eq("user_id", session.user.id);

    setRestoringId(null);

    if (error) {
      setMessageKind("warn");
      setMessage(error.message);
      return;
    }

    await loadDeletedItems({ keepMessage: true });
    setMessageKind("info");
    setMessage(labels.restored);
    onChanged();
  }

  async function handleBulkRestore() {
    if (!session?.user || selectedKeys.size === 0) return;
    const keys = [...selectedKeys];
    setBusy(true);
    setMessage("");
    try {
      await restoreKeys(keys);
      clearSelection();
      await loadDeletedItems({ keepMessage: true });
      setMessageKind("info");
      setMessage(
        labels.bulkRestored.replace("{count}", String(keys.length))
      );
      onChanged();
    } catch (error) {
      setMessageKind("warn");
      setMessage(error instanceof Error ? error.message : labels.couldNotUpdate);
    } finally {
      setBusy(false);
    }
  }

  async function handleBulkPermanentDelete() {
    if (!session?.user || selectedKeys.size === 0) return;
    const keys = [...selectedKeys];
    const confirmed = window.confirm(
      labels.confirmPermanentDelete.replace("{count}", String(keys.length))
    );
    if (!confirmed) return;

    setBusy(true);
    setMessage("");
    try {
      await permanentlyDeleteKeys(keys);
      clearSelection();
      await loadDeletedItems({ keepMessage: true });
      setMessageKind("info");
      setMessage(
        labels.bulkPermanentlyDeleted.replace("{count}", String(keys.length))
      );
      onChanged();
    } catch (error) {
      setMessageKind("warn");
      setMessage(error instanceof Error ? error.message : labels.couldNotUpdate);
    } finally {
      setBusy(false);
    }
  }

  async function handleClearAll() {
    if (!session?.user || totalCount === 0) return;
    const confirmed = window.confirm(
      labels.confirmClearAll.replace("{count}", String(totalCount))
    );
    if (!confirmed) return;

    const allKeys = [
      ...analyses.map((item) => `analysis-${item.analysis_id}`),
      ...parameters.map((item) => `parameter-${item.custom_parameter_id}`),
      ...ranges.map((item) => `range-${item.custom_range_id}`),
    ];

    setBusy(true);
    setMessage("");
    try {
      await permanentlyDeleteKeys(allKeys);
      exitSelectMode();
      await loadDeletedItems({ keepMessage: true });
      setMessageKind("info");
      setMessage(labels.clearedAll.replace("{count}", String(allKeys.length)));
      onChanged();
    } catch (error) {
      setMessageKind("warn");
      setMessage(error instanceof Error ? error.message : labels.couldNotUpdate);
    } finally {
      setBusy(false);
    }
  }

  function getRangeTitle(range: DeletedRange) {
    const custom = getOne(range.user_custom_parameters);
    const official = getOne(range.parameters);
    const name =
      custom?.parameter_name || official?.parameter_name || labels.ranges;
    const symbol = custom?.symbol || official?.symbol;
    return `${name}${symbol ? ` (${symbol})` : ""}`;
  }

  function getRangeMeta(range: DeletedRange) {
    const unit = getOne(range.units);
    const band =
      `${range.min_value ?? "—"} – ${range.max_value ?? "—"} ${unit?.unit_symbol || ""}`.trim();
    return `${band} · ${range.sample_type} · ${formatDate(range.deleted_at)}`;
  }

  return (
    <section className="animate-slide-up recycle-bin">
      <div className="values-screen-panel values-screen-panel--open px-0 pb-6 pt-0">
        <div>
          <StickyPageTitle className="page-title-row items-center">
            <BackButton variant="icon" onClick={onBack} label={t.home} />
            <div className="page-title-row__title min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                {t.dataTools}
              </p>
              <h1 className="text-xl font-extrabold leading-tight text-green-950 dark-text-primary sm:text-2xl">
                {t.recycleBin}
              </h1>
            </div>
            <button
              type="button"
              onClick={() => void loadDeletedItems()}
              className="page-title-row__spacer inline-flex size-9 items-center justify-center rounded-xl border border-emerald-900/10 bg-white/70 text-emerald-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-100"
              aria-label={labels.refresh}
              title={labels.refresh}
              disabled={busy}
            >
              <RefreshCw
                size={16}
                className={loading ? "animate-spin" : undefined}
              />
            </button>
          </StickyPageTitle>
        </div>

        <div className="mt-3">
          <nav
            className="settings-nav recycle-bin__nav"
            aria-label={t.recycleBin}
            style={
              {
                "--settings-nav-count": filters.length,
              } as CSSProperties
            }
          >
            {filters.map((item) => {
              const active = activeType === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveType(item.id)}
                  className={`settings-nav__item${active ? " is-active" : ""}`}
                  disabled={busy}
                >
                  {item.icon}
                  <span>
                    {item.label}{" "}
                    <span className="settings-nav__count">{item.count}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          {session?.user && totalCount > 0 ? (
            <div className="recycle-bin__actions mt-2.5">
              <button
                type="button"
                className={`history-icon-button history-icon-button--sm${
                  selectMode ? " history-icon-button-active" : ""
                }`}
                title={selectMode ? labels.exitSelect : labels.select}
                aria-label={selectMode ? labels.exitSelect : labels.select}
                aria-pressed={selectMode}
                onClick={() =>
                  selectMode ? exitSelectMode() : setSelectMode(true)
                }
                disabled={busy}
              >
                {selectMode ? <X size={15} /> : <CheckSquare size={15} />}
              </button>
              <button
                type="button"
                className="recycle-bin__clear-btn"
                onClick={() => void handleClearAll()}
                disabled={busy || totalCount === 0}
              >
                <Trash2 size={14} />
                {labels.clearAll}
              </button>
            </div>
          ) : null}

          {selectMode && visibleCount > 0 ? (
            <div
              className="history-bulk-bar mt-2.5"
              role="toolbar"
              aria-label={labels.select}
            >
              <div className="history-bulk-selection">
                <button
                  type="button"
                  className="history-bulk-link"
                  onClick={() =>
                    allVisibleSelected ? clearSelection() : selectAllVisible()
                  }
                  disabled={busy}
                >
                  {allVisibleSelected
                    ? labels.clearSelection
                    : labels.selectAll}
                </button>
                <span className="history-bulk-count">
                  {labels.selectedCount.replace(
                    "{count}",
                    String(selectedKeys.size)
                  )}
                </span>
              </div>
              <div className="history-bulk-actions">
                <button
                  type="button"
                  className="history-bulk-btn history-bulk-btn-restore"
                  onClick={() => void handleBulkRestore()}
                  disabled={busy || selectedKeys.size === 0}
                >
                  <RotateCcw size={15} />
                  {labels.restoreSelected}
                </button>
                <button
                  type="button"
                  className="history-bulk-btn history-bulk-btn-delete"
                  onClick={() => void handleBulkPermanentDelete()}
                  disabled={busy || selectedKeys.size === 0}
                >
                  <Trash2 size={15} />
                  {labels.deleteForever}
                </button>
              </div>
            </div>
          ) : null}

          <div className="custom-data-portal__panel recycle-bin__panel mt-3">
            {message ? (
              <div
                className={`app-modal-message mb-2 app-modal-message--${messageKind}`}
              >
                {message}
              </div>
            ) : null}

            {loading && totalCount === 0 ? (
              <p className="custom-data-portal__empty">{labels.loading}</p>
            ) : null}

            {!loading && !session?.user ? (
              <p className="custom-data-portal__empty">{labels.login}</p>
            ) : null}

            {!loading && session?.user && totalCount === 0 ? (
              <p className="custom-data-portal__empty">{labels.empty}</p>
            ) : null}

            {!loading &&
            session?.user &&
            totalCount > 0 &&
            visibleCount === 0 ? (
              <p className="custom-data-portal__empty">{labels.emptyFilter}</p>
            ) : null}

            {session?.user && visibleCount > 0 ? (
              <div className="recycle-bin__list">
                {showReports
                  ? analyses.map((analysis) => {
                      const crop = getOne(analysis.crops);
                      const rowKey = `analysis-${analysis.analysis_id}`;
                      return (
                        <RecycleRow
                          key={rowKey}
                          icon={<FileText size={15} />}
                          type={labels.reports}
                          title={
                            analysis.analysis_name ||
                            crop?.crop_name ||
                            t.analysisSummary
                          }
                          desc={formatDate(analysis.deleted_at)}
                          restoreLabel={labels.restore}
                          restoring={restoringId === rowKey}
                          selectMode={selectMode}
                          selected={selectedKeys.has(rowKey)}
                          onToggleSelect={() => toggleSelected(rowKey)}
                          onRestore={() =>
                            void restore(
                              "analyses",
                              "analysis_id",
                              analysis.analysis_id,
                              rowKey
                            )
                          }
                        />
                      );
                    })
                  : null}

                {showParameters
                  ? parameters.map((parameter) => {
                      const rowKey = `parameter-${parameter.custom_parameter_id}`;
                      return (
                        <RecycleRow
                          key={rowKey}
                          icon={<Beaker size={15} />}
                          type={labels.parameters}
                          title={`${parameter.parameter_name}${
                            parameter.symbol ? ` (${parameter.symbol})` : ""
                          }`}
                          desc={`${parameter.sample_type} · ${formatDate(parameter.deleted_at)}`}
                          restoreLabel={labels.restore}
                          restoring={restoringId === rowKey}
                          selectMode={selectMode}
                          selected={selectedKeys.has(rowKey)}
                          onToggleSelect={() => toggleSelected(rowKey)}
                          onRestore={() =>
                            void restore(
                              "user_custom_parameters",
                              "custom_parameter_id",
                              parameter.custom_parameter_id,
                              rowKey
                            )
                          }
                        />
                      );
                    })
                  : null}

                {showRanges
                  ? ranges.map((range) => {
                      const rowKey = `range-${range.custom_range_id}`;
                      return (
                        <RecycleRow
                          key={rowKey}
                          icon={<Ruler size={15} />}
                          type={labels.ranges}
                          title={getRangeTitle(range)}
                          desc={getRangeMeta(range)}
                          restoreLabel={labels.restore}
                          restoring={restoringId === rowKey}
                          selectMode={selectMode}
                          selected={selectedKeys.has(rowKey)}
                          onToggleSelect={() => toggleSelected(rowKey)}
                          onRestore={() =>
                            void restore(
                              "user_custom_ranges",
                              "custom_range_id",
                              range.custom_range_id,
                              rowKey
                            )
                          }
                        />
                      );
                    })
                  : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function RecycleRow({
  icon,
  type,
  title,
  desc,
  restoreLabel,
  restoring,
  selectMode,
  selected,
  onToggleSelect,
  onRestore,
}: {
  icon: ReactNode;
  type: string;
  title: string;
  desc: string;
  restoreLabel: string;
  restoring: boolean;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onRestore: () => void;
}) {
  return (
    <article
      className={`recycle-bin__row${selected ? " recycle-bin__row--selected" : ""}`}
    >
      {selectMode ? (
        <button
          type="button"
          className={`history-select-checkbox${selected ? " is-checked" : ""}`}
          onClick={onToggleSelect}
          aria-pressed={selected}
          aria-label={title}
        >
          {selected ? <CheckSquare size={18} /> : <Square size={18} />}
        </button>
      ) : (
        <span className="recycle-bin__row-icon" aria-hidden>
          {icon}
        </span>
      )}
      {selectMode ? (
        <button
          type="button"
          className="recycle-bin__row-main min-w-0 flex-1 text-left"
          onClick={onToggleSelect}
        >
          <p className="recycle-bin__row-type">{type}</p>
          <p className="recycle-bin__row-title truncate">{title}</p>
          {desc ? (
            <p className="recycle-bin__row-meta truncate">{desc}</p>
          ) : null}
        </button>
      ) : (
        <div className="recycle-bin__row-main min-w-0 flex-1">
          <p className="recycle-bin__row-type">{type}</p>
          <p className="recycle-bin__row-title truncate">{title}</p>
          {desc ? (
            <p className="recycle-bin__row-meta truncate">{desc}</p>
          ) : null}
        </div>
      )}
      {!selectMode ? (
        <button
          type="button"
          onClick={onRestore}
          disabled={restoring}
          className="recycle-bin__restore"
          aria-label={restoreLabel}
          title={restoreLabel}
        >
          <RotateCcw
            size={14}
            className={restoring ? "animate-spin" : undefined}
          />
          <span className="recycle-bin__restore-label">{restoreLabel}</span>
        </button>
      ) : null}
    </article>
  );
}
