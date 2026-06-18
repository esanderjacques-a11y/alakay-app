"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { ArrowLeft, FileText, RefreshCw, RotateCcw, SlidersHorizontal } from "lucide-react";

import BackButton from "@/components/ui/BackButton";
import { StickyPageTitle } from "@/components/ui/StickyPageTitle";
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
  parameters: { parameter_name: string; symbol: string | null } | { parameter_name: string; symbol: string | null }[] | null;
  user_custom_parameters: { parameter_name: string; symbol: string | null } | { parameter_name: string; symbol: string | null }[] | null;
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
  const [activeType, setActiveType] = useState<"all" | "reports" | "parameters" | "ranges">("all");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const totalCount = parameters.length + ranges.length + analyses.length;

  useEffect(() => {
    loadDeletedItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const visibleCounts = useMemo(
    () => ({
      all: totalCount,
      reports: analyses.length,
      parameters: parameters.length,
      ranges: ranges.length,
    }),
    [analyses.length, parameters.length, ranges.length, totalCount]
  );

  async function loadDeletedItems() {
    if (!session?.user) {
      setMessage(labels.login);
      return;
    }

    setLoading(true);
    setMessage("");

    const [parameterResponse, rangeResponse, analysisResponse] = await Promise.all([
      supabase
        .from("user_custom_parameters")
        .select("custom_parameter_id, parameter_name, symbol, sample_type, deleted_at")
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
      setMessage(firstError.message);
      return;
    }

    setParameters((parameterResponse.data || []) as DeletedParameter[]);
    setRanges((rangeResponse.data || []) as DeletedRange[]);
    setAnalyses((analysisResponse.data || []) as DeletedAnalysis[]);
  }

  async function restore(table: "analyses" | "user_custom_parameters" | "user_custom_ranges", idColumn: string, id: number) {
    if (!session?.user) return;

    setLoading(true);
    setMessage("");

    const { error } = await supabase
      .from(table)
      .update({ is_deleted: false, deleted_at: null })
      .eq(idColumn, id)
      .eq("user_id", session.user.id);

    setLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadDeletedItems();
    onChanged();
  }

  function getRangeName(range: DeletedRange) {
    const custom = getOne(range.user_custom_parameters);
    const official = getOne(range.parameters);
    const unit = getOne(range.units);
    const name = custom?.parameter_name || official?.parameter_name || labels.ranges;
    const symbol = custom?.symbol || official?.symbol;
    const value = `${range.min_value ?? "—"} - ${range.max_value ?? "—"} ${unit?.unit_symbol || ""}`.trim();
    return `${name}${symbol ? ` (${symbol})` : ""} · ${value}`;
  }

  return (
    <section className="animate-slide-up">
      <div className="values-screen-panel values-screen-panel--open px-4 pb-4 pt-1 sm:px-5 sm:pb-5 sm:pt-1">
        <StickyPageTitle className="page-title-row items-end sm:items-center">
          <BackButton variant="icon" onClick={onBack} label={t.home} />
          <div className="page-title-row__title min-w-0">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700">
              {labels.allDeleted}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold text-green-950">{t.recycleBin}</h1>
            <p className="mt-1 max-w-xl text-sm font-medium text-slate-600">
              {t.recycleBinDesc}
            </p>
          </div>
          <button
            type="button"
            onClick={loadDeletedItems}
            className="page-title-row__spacer inline-flex min-w-9 items-center justify-center gap-2 rounded-2xl border border-emerald-100 bg-white/70 px-3 py-2 text-sm font-bold text-green-900 sm:min-w-0 sm:px-4 sm:py-3"
            aria-label={labels.refresh}
            title={labels.refresh}
          >
            <RefreshCw size={16} />
            <span className="hidden sm:inline">{labels.refresh}</span>
          </button>
        </StickyPageTitle>

        <div className="app-scroll-x mt-5 flex gap-2 pb-1">
          {[
            ["all", labels.allDeleted],
            ["reports", labels.reports],
            ["parameters", labels.parameters],
            ["ranges", labels.ranges],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveType(id as typeof activeType)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition ${
                activeType === id
                  ? "bg-emerald-700 text-white"
                  : "bg-white/64 text-green-900"
              }`}
            >
              {label} ({visibleCounts[id as keyof typeof visibleCounts]})
            </button>
          ))}
        </div>

        {loading ? (
          <p className="mt-5 rounded-2xl bg-white/64 p-4 text-sm font-semibold text-slate-600">
            {labels.loading}
          </p>
        ) : null}

        {message ? (
          <p className="mt-5 rounded-2xl bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            {message}
          </p>
        ) : null}

        {!loading && totalCount === 0 ? (
          <p className="mt-5 rounded-2xl bg-white/64 p-4 text-sm font-semibold text-slate-600">
            {session?.user ? labels.empty : labels.login}
          </p>
        ) : null}

        <div className="mt-5 grid gap-2">
          {(activeType === "all" || activeType === "reports") &&
            analyses.map((analysis) => {
              const crop = getOne(analysis.crops);
              return (
                <RecycleRow
                  key={`analysis-${analysis.analysis_id}`}
                  icon={<FileText size={18} />}
                  type={labels.reports}
                  title={analysis.analysis_name || crop?.crop_name || t.analysisSummary}
                  desc={formatDate(analysis.deleted_at)}
                  restoreLabel={labels.restore}
                  onRestore={() => restore("analyses", "analysis_id", analysis.analysis_id)}
                />
              );
            })}

          {(activeType === "all" || activeType === "parameters") &&
            parameters.map((parameter) => (
              <RecycleRow
                key={`parameter-${parameter.custom_parameter_id}`}
                icon={<SlidersHorizontal size={18} />}
                type={labels.parameters}
                title={`${parameter.parameter_name}${parameter.symbol ? ` (${parameter.symbol})` : ""}`}
                desc={`${parameter.sample_type} · ${formatDate(parameter.deleted_at)}`}
                restoreLabel={labels.restore}
                onRestore={() =>
                  restore(
                    "user_custom_parameters",
                    "custom_parameter_id",
                    parameter.custom_parameter_id
                  )
                }
              />
            ))}

          {(activeType === "all" || activeType === "ranges") &&
            ranges.map((range) => (
              <RecycleRow
                key={`range-${range.custom_range_id}`}
                icon={<RotateCcw size={18} />}
                type={labels.ranges}
                title={getRangeName(range)}
                desc={`${range.sample_type} · ${formatDate(range.deleted_at)}`}
                restoreLabel={labels.restore}
                onRestore={() =>
                  restore("user_custom_ranges", "custom_range_id", range.custom_range_id)
                }
              />
            ))}
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
  onRestore,
}: {
  icon: ReactNode;
  type: string;
  title: string;
  desc: string;
  restoreLabel: string;
  onRestore: () => void;
}) {
  return (
    <div className="flex items-center gap-3 border-t border-emerald-900/10 py-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-emerald-800">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-emerald-700">
          {type}
        </p>
        <p className="truncate font-extrabold text-green-950">{title}</p>
        {desc ? <p className="text-xs font-semibold text-slate-500">{desc}</p> : null}
      </div>
      <button
        type="button"
        onClick={onRestore}
        className="shrink-0 rounded-2xl bg-emerald-700 px-3 py-2 text-xs font-extrabold text-white"
      >
        {restoreLabel}
      </button>
    </div>
  );
}

