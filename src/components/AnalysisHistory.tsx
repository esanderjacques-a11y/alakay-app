"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Download,
  Edit3,
  Eye,
  GitBranch,
  RefreshCw,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import MenuSelect from "@/components/ui/MenuSelect";
import {
  backfillMissingDeletedAt,
  deleteAnalysisPermanently,
  getDaysUntilPermanentDelete,
  purgeExpiredDeletedAnalyses,
} from "@/lib/analysisDeletion";
import {
  buildTextureSummaryFromResults,
  exportAnalysisPdf as exportStyledAnalysisPdf,
  groupPdfResults,
  normalizeGroupCode,
  type PdfReportSectionOptions,
  type PdfResult,
} from "@/lib/pdfReport";
import { getSettings } from "@/lib/appSettings";
import ExportReportModal from "@/components/ExportReportModal";

type PreviewGroupKey =
  | "all"
  | "negative"
  | "warning"
  | "normal"
  | "positive"
  | "neutral";
import { Language, Translation } from "@/lib/translations";
import { analysisHistoryText } from "@/lib/i18n/componentText";
import BackButton from "@/components/ui/BackButton";

export type EditableAnalysisPayload = {
  analysisId: number;
  rootAnalysisId: number;
  nextVersionNumber: number;
  cropId: number | "";
  sampleType: "soil" | "foliar";
  analysisName: string;
  farmName: string;
  lotName: string;
  labName: string;
  country: string;
  provinceState: string;
  samplingDate: string;
  reportDate: string;
  values: Record<string, string>;
  selectedUnits: Record<string, number>;
};

type RelationOne<T> = T | T[] | null;

type SavedAnalysis = {
  analysis_id: number;
  analysis_name: string | null;
  crop_id: number | null;
  sample_type_id: number | null;
  parent_analysis_id: number | null;
  version_number: number | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
  sampling_date: string | null;
  report_date: string | null;
  country: string | null;
  province_state: string | null;
  created_at: string | null;
  crops: RelationOne<{
    crop_name: string;
  }>;
  farms: RelationOne<{
    farm_name: string;
  }>;
  lots: RelationOne<{
    lot_name: string;
  }>;
  labs: RelationOne<{
    lab_name: string;
  }>;
};

type HistorySortKey = "date" | "name" | "crop" | "type" | "location";
type SortDirection = "asc" | "desc";

type AnalysisValue = {
  parameter_id: number | null;
  custom_parameter_id: number | null;
  value: number | string | null;
  min: number | null;
  max: number | null;
  unit_id: number | null;
  level_code: string | null;
  group_code: string | null;
  confidence: string | null;
  source_name: string | null;
  advice: string | null;
  parameters: RelationOne<{
    parameter_name: string;
    symbol: string | null;
  }>;
  user_custom_parameters: RelationOne<{
    parameter_name: string;
    symbol: string | null;
  }>;
  units: RelationOne<{
    unit_symbol: string;
  }>;
};

type Props = {
  session: Session | null;
  language: Language;
  t: Translation;
  onEditAnalysis?: (payload: EditableAnalysisPayload) => void;
  onReadingChange?: (reading: boolean) => void;
};


function getOne<T>(value: RelationOne<T>): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return value;
  }
}

function formatPurgeCountdown(template: string, days: number) {
  return template.replace("{days}", String(days));
}

function getRootAnalysisId(analysis: SavedAnalysis) {
  return analysis.parent_analysis_id || analysis.analysis_id;
}

function getSampleTypeCode(analysis: SavedAnalysis): "soil" | "foliar" {
  return analysis.sample_type_id === 2 ? "foliar" : "soil";
}

function getVersionLabel(analysis: SavedAnalysis, language: Language) {
  const l = analysisHistoryText[language as keyof typeof analysisHistoryText] || analysisHistoryText.en;

  if (!analysis.parent_analysis_id && (analysis.version_number || 1) === 1) {
    return l.original;
  }

  return `${l.version} ${analysis.version_number || 1}`;
}

function getAnalysisTitle(analysis: SavedAnalysis) {
  return analysis.analysis_name || `Analysis #${analysis.analysis_id}`;
}

function getCropName(analysis: SavedAnalysis) {
  return getOne(analysis.crops)?.crop_name || "—";
}

function getFarmName(analysis: SavedAnalysis) {
  return getOne(analysis.farms)?.farm_name || "";
}

function getLotName(analysis: SavedAnalysis) {
  return getOne(analysis.lots)?.lot_name || "";
}

function getLabName(analysis: SavedAnalysis) {
  return getOne(analysis.labs)?.lab_name || "";
}

function getHistorySortValue(analysis: SavedAnalysis, key: HistorySortKey) {
  if (key === "name") return getAnalysisTitle(analysis).toLowerCase();
  if (key === "crop") return getCropName(analysis).toLowerCase();
  if (key === "type") return getSampleTypeCode(analysis);
  if (key === "location") {
    return [analysis.province_state, analysis.country, getFarmName(analysis), getLotName(analysis)]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  return new Date(
    analysis.report_date || analysis.sampling_date || analysis.created_at || 0
  ).getTime();
}

function getValueParameterName(value: AnalysisValue) {
  const custom = getOne(value.user_custom_parameters);
  const official = getOne(value.parameters);

  return custom?.parameter_name || official?.parameter_name || "Parameter";
}

function getValueParameterSymbol(value: AnalysisValue) {
  const custom = getOne(value.user_custom_parameters);
  const official = getOne(value.parameters);

  return custom?.symbol || official?.symbol || "";
}

function getUnitSymbol(value: AnalysisValue) {
  return getOne(value.units)?.unit_symbol || "";
}

function mapValueToPdfResult(value: AnalysisValue): PdfResult | null {
  const numericValue = Number(value.value);
  if (!Number.isFinite(numericValue)) return null;

  const parameterName = getValueParameterName(value);
  const symbol = getValueParameterSymbol(value);

  return {
    display_parameter_name: symbol
      ? `${parameterName} (${symbol})`
      : parameterName,
    parameter_name: parameterName,
    value: numericValue,
    unit_symbol: getUnitSymbol(value),
    min: value.min,
    max: value.max,
    level_code: value.level_code || "—",
    final_group_code: normalizeGroupCode(value.group_code),
    confidence: value.confidence || "—",
    advice: value.advice || "",
    source_name: value.source_name,
    is_proxy: false,
    custom_parameter_id: value.custom_parameter_id,
  };
}

const pdfLocales: Record<Language, string> = {
  en: "en-US",
  fr: "fr-FR",
  es: "es-ES",
  ht: "ht-HT",
  pt: "pt-BR",
  sw: "sw-TZ",
};

export default function AnalysisHistory({
  session,
  language,
  t,
  onEditAnalysis,
  onReadingChange,
}: Props) {
  const l = analysisHistoryText[language as keyof typeof analysisHistoryText] || analysisHistoryText.en;

  const [analyses, setAnalyses] = useState<SavedAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysis | null>(
    null
  );
  const [selectedValues, setSelectedValues] = useState<AnalysisValue[]>([]);
  const [versionRootId, setVersionRootId] = useState<number | null>(null);
  const [expandedRootId, setExpandedRootId] = useState<number | null>(null);

  const [historyFilter, setHistoryFilter] = useState<
    "active" | "deleted" | "versions"
  >("active");
  const [sortKey, setSortKey] = useState<HistorySortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [loading, setLoading] = useState(false);
  const [valuesLoading, setValuesLoading] = useState(false);
  const [editingLoading, setEditingLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pendingExportAnalysis, setPendingExportAnalysis] =
    useState<SavedAnalysis | null>(null);

  useEffect(() => {
    if (!session?.user) return;
    loadAnalyses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  useEffect(() => {
    onReadingChange?.(Boolean(selectedAnalysis));
  }, [onReadingChange, selectedAnalysis]);

  async function loadAnalyses() {
    if (!session?.user) return;

    setLoading(true);
    setMessage("");

    await backfillMissingDeletedAt(session.user.id);
    await purgeExpiredDeletedAnalyses(session.user.id);

    const { data, error } = await supabase
      .from("analyses")
      .select(
        `
        analysis_id,
        analysis_name,
        crop_id,
        sample_type_id,
        parent_analysis_id,
        version_number,
        is_deleted,
        deleted_at,
        sampling_date,
        report_date,
        country,
        province_state,
        created_at,
        crops (
          crop_name
        ),
        farms (
          farm_name
        ),
        lots (
          lot_name
        ),
        labs (
          lab_name
        )
      `
      )
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });

    setLoading(false);

    if (error) {
      setMessage(error.message);
      setAnalyses([]);
      return;
    }

    setAnalyses((data || []) as SavedAnalysis[]);
  }

  async function loadValuesForAnalysis(analysisId: number) {
    const { data, error } = await supabase
      .from("analysis_values")
      .select(
        `
        parameter_id,
        custom_parameter_id,
        value,
        min,
        max,
        unit_id,
        level_code,
        group_code,
        confidence,
        source_name,
        advice,
        parameters (
          parameter_name,
          symbol
        ),
        user_custom_parameters (
          parameter_name,
          symbol
        ),
        units (
          unit_symbol
        )
      `
      )
      .eq("analysis_id", analysisId);
  
    if (error) {
      throw new Error(error.message);
    }
  
    return (data || []) as AnalysisValue[];
  }

  async function viewAnalysis(analysis: SavedAnalysis) {
    setSelectedAnalysis(analysis);
    setSelectedValues([]);
    setValuesLoading(true);
    setMessage("");

    try {
      const values = await loadValuesForAnalysis(analysis.analysis_id);
      setSelectedValues(values);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l.couldNotLoad);
    } finally {
      setValuesLoading(false);
    }
  }

  async function editAnalysis(analysis: SavedAnalysis) {
    if (!onEditAnalysis) return;

    if (analysis.is_deleted) {
      setMessage(l.restoreBeforeEdit);
      return;
    }

    setEditingLoading(true);
    setMessage("");

    try {
      const loadedValues = await loadValuesForAnalysis(analysis.analysis_id);

      const valueMap: Record<string, string> = {};
      const unitMap: Record<string, number> = {};

      for (const item of loadedValues) {
        let parameterKey = "";

        if (typeof item.custom_parameter_id === "number") {
          parameterKey = `c-${item.custom_parameter_id}`;
        } else if (typeof item.parameter_id === "number") {
          parameterKey = `p-${item.parameter_id}`;
        }

        if (!parameterKey) continue;

        valueMap[parameterKey] = String(item.value ?? "");

        if (typeof item.unit_id === "number") {
          unitMap[parameterKey] = item.unit_id;
        }
      }

      const rootId = getRootAnalysisId(analysis);

      const existingVersions = analyses.filter(
        (item) =>
          item.analysis_id === rootId || item.parent_analysis_id === rootId
      );

      const maxVersion = Math.max(
        1,
        ...existingVersions.map((item) => item.version_number || 1)
      );

      onEditAnalysis({
        analysisId: analysis.analysis_id,
        rootAnalysisId: rootId,
        nextVersionNumber: maxVersion + 1,
        cropId: analysis.crop_id || "",
        sampleType: getSampleTypeCode(analysis),
        analysisName: analysis.analysis_name
          ? `${analysis.analysis_name} - v${maxVersion + 1}`
          : `Analysis #${analysis.analysis_id} - v${maxVersion + 1}`,
        farmName: getFarmName(analysis),
        lotName: getLotName(analysis),
        labName: getLabName(analysis),
        country: analysis.country || "",
        provinceState: analysis.province_state || "",
        samplingDate: analysis.sampling_date || "",
        reportDate: analysis.report_date || "",
        values: valueMap,
        selectedUnits: unitMap,
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : l.couldNotLoad);
    } finally {
      setEditingLoading(false);
    }
  }

  async function handleDeleteAnalysis(analysis: SavedAnalysis) {
    if (!session?.user) return;

    if (analysis.is_deleted) {
      const confirmed = window.confirm(l.confirmPermanentDelete);
      if (!confirmed) return;

      setMessage("");

      try {
        await deleteAnalysisPermanently(
          analysis.analysis_id,
          session.user.id
        );

        if (selectedAnalysis?.analysis_id === analysis.analysis_id) {
          setSelectedAnalysis(null);
          setSelectedValues([]);
        }

        setMessage(l.permanentlyDeleted);
        await loadAnalyses();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : l.couldNotLoad);
      }

      return;
    }

    const confirmed = window.confirm(l.confirmDelete);
    if (!confirmed) return;

    setMessage("");

    const { error } = await supabase
      .from("analyses")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("analysis_id", analysis.analysis_id)
      .eq("user_id", session.user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(l.deletedMessage);
    setHistoryFilter("deleted");
    await loadAnalyses();
  }

  async function restoreAnalysis(analysis: SavedAnalysis) {
    if (!session?.user) return;

    setMessage("");

    const { error } = await supabase
      .from("analyses")
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq("analysis_id", analysis.analysis_id)
      .eq("user_id", session.user.id);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(l.restored);
    await loadAnalyses();
  }

  function requestExportAnalysisPdf(analysis: SavedAnalysis) {
    setMessage("");
    setPendingExportAnalysis(analysis);
    setExportModalOpen(true);
  }

  async function exportAnalysisPdf(
    analysis: SavedAnalysis,
    sections: PdfReportSectionOptions
  ) {
    setMessage("");
    setExportingPdf(true);

    try {
      const values = await loadValuesForAnalysis(analysis.analysis_id);
      const results = values
        .map(mapValueToPdfResult)
        .filter((item): item is PdfResult => item !== null);

      if (results.length === 0) {
        setMessage(l.noValues);
        return;
      }

      const groupedResults = groupPdfResults(results);
      const textureSummary = buildTextureSummaryFromResults(results);
      const farmName = getFarmName(analysis);
      const lotName = getLotName(analysis);
      const labName = getLabName(analysis);
      const location =
        [analysis.province_state, analysis.country].filter(Boolean).join(", ") ||
        "—";

      const reportDetails = [
        `${l.crop}: ${getCropName(analysis)}`,
        `${l.sampleType}: ${
          getSampleTypeCode(analysis) === "soil" ? l.soil : l.foliar
        }`,
        `${l.date}: ${formatDate(
          analysis.report_date || analysis.sampling_date || analysis.created_at
        )}`,
        `${l.location}: ${location}`,
      ];

      if (farmName) reportDetails.push(`${l.farm}: ${farmName}`);
      if (lotName) reportDetails.push(`${l.lot}: ${lotName}`);
      if (labName) reportDetails.push(`${l.lab}: ${labName}`);

      const fileName = `${getAnalysisTitle(analysis).replace(/[^\w\d-]+/g, "-")}.pdf`;

      await exportStyledAnalysisPdf({
        t,
        results,
        groupedResults,
        missingResults: [],
        textureSummary,
        isGeneralCrop: analysis.crop_id === 999,
        locale: pdfLocales[language] || "en-US",
        reportMeta: {
          title: getAnalysisTitle(analysis),
          details: reportDetails,
        },
        reportOptions: getSettings().reports,
        sections,
        fileName,
      });

      setMessage(l.exported);
      setExportModalOpen(false);
      setPendingExportAnalysis(null);
    } catch (error) {
      console.error("PDF export error:", error);
      setMessage(error instanceof Error ? error.message : t.pdfExportFailed);
    } finally {
      setExportingPdf(false);
    }
  }

  const rootGroups = useMemo(() => {
    const map = new Map<
      number,
      {
        rootId: number;
        versions: SavedAnalysis[];
        latest: SavedAnalysis;
      }
    >();

    for (const analysis of analyses) {
      const rootId = getRootAnalysisId(analysis);
      const existing = map.get(rootId);

      if (!existing) {
        map.set(rootId, {
          rootId,
          versions: [analysis],
          latest: analysis,
        });
        continue;
      }

      existing.versions.push(analysis);

      const currentVersion = analysis.version_number || 1;
      const latestVersion = existing.latest.version_number || 1;

      if (currentVersion > latestVersion) {
        existing.latest = analysis;
      }
    }

    return Array.from(map.values()).map((group) => ({
      ...group,
      versions: group.versions.sort(
        (a, b) => (b.version_number || 1) - (a.version_number || 1)
      ),
    }));
  }, [analyses]);

  const visibleGroups = useMemo(() => {
    let groups = rootGroups;

    if (historyFilter === "deleted") {
      groups = rootGroups.filter((group) => group.latest.is_deleted);
    } else if (historyFilter === "versions") {
      groups = rootGroups.filter(
        (group) => !group.latest.is_deleted && group.versions.length > 1
      );
    } else {
      groups = rootGroups.filter((group) => !group.latest.is_deleted);
    }

    return [...groups].sort((left, right) => {
      const leftValue = getHistorySortValue(left.latest, sortKey);
      const rightValue = getHistorySortValue(right.latest, sortKey);
      const compare =
        sortKey === "date"
          ? Number(leftValue) - Number(rightValue)
          : String(leftValue).localeCompare(String(rightValue));

      return sortDirection === "asc" ? compare : -compare;
    });
  }, [rootGroups, historyFilter, sortDirection, sortKey]);

  const activeCount = rootGroups.filter(
    (group) => !group.latest.is_deleted
  ).length;
  const versionedCount = rootGroups.filter(
    (group) => !group.latest.is_deleted && group.versions.length > 1
  ).length;
  const deletedCount = rootGroups.filter(
    (group) => group.latest.is_deleted
  ).length;

  const selectedVersionGroup = versionRootId
    ? rootGroups.find((group) => group.rootId === versionRootId)
    : null;

  if (!session?.user) {
    return (
      <div className="rounded-2xl bg-yellow-50 p-4 text-yellow-900">
        {l.login}
      </div>
    );
  }

  if (selectedAnalysis) {
    return (
      <>
        <ReportPreviewModal
          analysis={selectedAnalysis}
          values={selectedValues}
          loading={valuesLoading}
          language={language}
          onClose={() => {
            setSelectedAnalysis(null);
            setSelectedValues([]);
          }}
          onEdit={() => editAnalysis(selectedAnalysis)}
          onExport={() => requestExportAnalysisPdf(selectedAnalysis)}
        />

        {selectedVersionGroup && (
          <VersionsModal
            group={selectedVersionGroup}
            language={language}
            onClose={() => setVersionRootId(null)}
            onView={viewAnalysis}
            onEdit={editAnalysis}
            onExport={requestExportAnalysisPdf}
            onDelete={handleDeleteAnalysis}
            onRestore={restoreAnalysis}
          />
        )}

        <ExportReportModal
          open={exportModalOpen}
          onClose={() => {
            if (exportingPdf) return;
            setExportModalOpen(false);
            setPendingExportAnalysis(null);
          }}
          onConfirm={(sections) => {
            if (!pendingExportAnalysis) return;
            void exportAnalysisPdf(pendingExportAnalysis, sections);
          }}
          t={t}
          isFoliar={
            pendingExportAnalysis
              ? getSampleTypeCode(pendingExportAnalysis) === "foliar"
              : false
          }
          exporting={exportingPdf}
        />
      </>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 px-1 pb-1">
        <h2 className="flex-1 text-lg font-bold text-[#1c1c1e]">{l.title}</h2>
        <button
          type="button"
          title={l.refresh}
          aria-label={l.refresh}
          onClick={loadAnalyses}
          className="history-icon-button shrink-0"
        >
          <RefreshCw size={16} />
        </button>
      </div>

      {/* Filter chips + sort */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
          <HistoryFilterButton
            label={l.activeReports}
            value={activeCount}
            active={historyFilter === "active"}
            onClick={() => setHistoryFilter("active")}
          />
          <HistoryFilterButton
            label={l.versions}
            value={versionedCount}
            active={historyFilter === "versions"}
            onClick={() => setHistoryFilter("versions")}
          />
          <HistoryFilterButton
            label={l.showDeleted}
            value={deletedCount}
            active={historyFilter === "deleted"}
            onClick={() => setHistoryFilter("deleted")}
          />
        </div>

        <div className="flex shrink-0 gap-1">
          <MenuSelect
            value={sortKey}
            heading={l.sortBy}
            compact
            variant="chip"
            onChange={(next) => setSortKey(next as HistorySortKey)}
            options={[
              ["date", l.date],
              ["name", l.name],
              ["crop", l.crop],
              ["type", l.sampleType],
              ["location", l.location],
            ]}
          />
          <button
            type="button"
            title={sortDirection === "asc" ? l.ascending : l.descending}
            aria-label={sortDirection === "asc" ? l.ascending : l.descending}
            onClick={() =>
              setSortDirection((current) => (current === "asc" ? "desc" : "asc"))
            }
            className="history-icon-button shrink-0"
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {message && (
        <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900">
          {message}
        </div>
      )}

      {(loading || editingLoading) && (
        <div className="calc-surface-muted rounded-2xl p-4 glass-text-muted">
          {l.loading}
        </div>
      )}

      {!loading && visibleGroups.length === 0 && (
        <div className="rounded-2xl bg-yellow-50 p-4 text-yellow-900">
          {l.noReports}
        </div>
      )}

      <div className="grid gap-3">
        {visibleGroups.map((group) => {
          const analysis = group.latest;
          const versionCount = group.versions.length;
          const isExpanded = expandedRootId === group.rootId;

          return (
            <article
              key={group.rootId}
              role="button"
              tabIndex={0}
              onClick={() =>
                setExpandedRootId((current) =>
                  current === group.rootId ? null : group.rootId
                )
              }
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setExpandedRootId((current) =>
                    current === group.rootId ? null : group.rootId
                  );
                }
              }}
              className={`history-report-card cursor-pointer rounded-xl px-4 py-3 transition ${
                analysis.is_deleted
                  ? "history-report-card-deleted"
                  : isExpanded
                    ? "history-report-card-expanded"
                    : ""
              }`}
            >
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="min-w-0 truncate text-left text-base font-extrabold leading-tight text-green-900">
                      {getAnalysisTitle(analysis)}
                    </span>

                    <span className="history-badge history-badge-neutral">
                      {getVersionLabel(analysis, language)}
                    </span>

                    {versionCount > 1 && (
                      <span className="history-badge history-badge-accent">
                        {versionCount} {l.versions}
                      </span>
                    )}

                    {analysis.is_deleted ? (
                      <span className="history-badge history-badge-danger">
                        {l.deleted}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
                    <p className="min-w-0">
                      <strong>{l.crop}:</strong> {getCropName(analysis)}
                    </p>
                    <p className="min-w-0">
                      <strong>{l.sampleType}:</strong>{" "}
                      {getSampleTypeCode(analysis) === "soil"
                        ? l.soil
                        : l.foliar}
                    </p>
                    <p className="min-w-0">
                      <strong>{l.date}:</strong>{" "}
                      {formatDate(
                        analysis.report_date ||
                          analysis.sampling_date ||
                        analysis.created_at
                      )}
                    </p>
                    <p className="min-w-0">
                      <strong>{l.location}:</strong>{" "}
                      {[analysis.province_state, analysis.country]
                        .filter(Boolean)
                        .join(", ") || "—"}
                    </p>
                    {analysis.is_deleted ? (
                      <p className="text-xs font-semibold text-red-700">
                        {formatPurgeCountdown(
                          l.purgeCountdown,
                          getDaysUntilPermanentDelete(analysis.deleted_at)
                        )}
                      </p>
                    ) : null}
                  </div>
                </div>

                {isExpanded ? (
                  <div
                    className="flex flex-wrap gap-1.5 md:justify-end"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <IconButton
                      title={l.view}
                      onClick={() => viewAnalysis(analysis)}
                      tone="green"
                    >
                      <Eye size={17} />
                    </IconButton>

                    <IconButton
                      title={l.edit}
                      onClick={() => editAnalysis(analysis)}
                      disabled={Boolean(analysis.is_deleted)}
                    >
                      <Edit3 size={17} />
                    </IconButton>

                    <IconButton
                      title={l.export}
                      onClick={() => requestExportAnalysisPdf(analysis)}
                    >
                      <Download size={17} />
                    </IconButton>

                    <IconButton
                      title={l.versions}
                      onClick={() => setVersionRootId(group.rootId)}
                    >
                      <GitBranch size={17} />
                    </IconButton>

                    {analysis.is_deleted ? (
                      <>
                        <IconButton
                          title={l.restore}
                          onClick={() => restoreAnalysis(analysis)}
                          tone="green"
                        >
                          <RotateCcw size={17} />
                        </IconButton>
                        <IconButton
                          title={l.deletePermanently}
                          onClick={() => handleDeleteAnalysis(analysis)}
                          tone="red"
                        >
                          <Trash2 size={17} />
                        </IconButton>
                      </>
                    ) : (
                      <IconButton
                        title={l.delete}
                        onClick={() => handleDeleteAnalysis(analysis)}
                        tone="mutedRed"
                      >
                        <Trash2 size={17} />
                      </IconButton>
                    )}
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>

      {selectedVersionGroup && (
        <VersionsModal
          group={selectedVersionGroup}
          language={language}
          onClose={() => setVersionRootId(null)}
          onView={viewAnalysis}
          onEdit={editAnalysis}
          onExport={requestExportAnalysisPdf}
          onDelete={handleDeleteAnalysis}
          onRestore={restoreAnalysis}
        />
      )}

      <ExportReportModal
        open={exportModalOpen}
        onClose={() => {
          if (exportingPdf) return;
          setExportModalOpen(false);
          setPendingExportAnalysis(null);
        }}
        onConfirm={(sections) => {
          if (!pendingExportAnalysis) return;
          void exportAnalysisPdf(pendingExportAnalysis, sections);
        }}
        t={t}
        isFoliar={
          pendingExportAnalysis
            ? getSampleTypeCode(pendingExportAnalysis) === "foliar"
            : false
        }
        exporting={exportingPdf}
      />
    </section>
  );
}

function HistoryFilterButton({
  label,
  value,
  active,
  onClick,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
        active
          ? "bg-green-700 text-white"
          : "glass-chip text-[#3c3c43] shadow-[0_1px_3px_rgba(0,0,0,0.08)]"
      }`}
    >
      {label}
      <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
        active ? "bg-white/25" : "bg-[#f2f2f2] text-[#6c6c70]"
      }`}>{value}</span>
    </button>
  );
}

function IconButton({
  children,
  title,
  onClick,
  disabled,
  tone = "normal",
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "normal" | "red" | "green" | "mutedRed";
}) {
  const toneClass =
    tone === "red"
      ? "border-red-200 text-red-700 hover:bg-red-50"
      : tone === "green"
        ? "border-green-200 text-green-800 hover:bg-green-50"
        : tone === "mutedRed"
          ? "glass-icon-btn border-slate-200 text-slate-400 opacity-70 hover:border-red-200 hover:bg-red-50 hover:text-red-700 hover:opacity-100"
          : "glass-icon-btn glass-icon-btn--accent";

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${toneClass} disabled:cursor-not-allowed disabled:opacity-40`}
    >
      {children}
    </button>
  );
}

function ActionButton({
  children,
  title,
  onClick,
  disabled,
  primary,
}: {
  children: React.ReactNode;
  title: string;
  onClick: () => void;
  disabled?: boolean;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
        primary
          ? "border-green-700 bg-green-700 text-white hover:bg-green-800"
          : "glass-btn-secondary"
      }`}
    >
      {children}
    </button>
  );
}

function getValueGroup(value: AnalysisValue) {
  const stored = normalizeGroupCode(value.group_code);
  if (stored !== "other") {
    return stored;
  }

  const group = String(value.group_code || "").toLowerCase();
  const level = String(value.level_code || "").toLowerCase();

  if (
    group.includes("negative") ||
    level.includes("low") ||
    level.includes("deficient") ||
    level.includes("deficiency")
  ) {
    return "negative";
  }

  if (
    group.includes("warning") ||
    level.includes("high") ||
    level.includes("excess") ||
    level.includes("excessive")
  ) {
    return "warning";
  }

  if (
    group.includes("normal") ||
    level.includes("normal") ||
    level.includes("adequate") ||
    level.includes("optimal")
  ) {
    return "normal";
  }

  if (group.includes("positive")) {
    return "positive";
  }

  return "neutral";
}

function getGroupLabel(group: string, language: Language) {
  const labelsByLanguage = {
    en: {
      negative: "Needs attention",
      warning: "Warning",
      normal: "Adequate",
      positive: "Positive",
      neutral: "Neutral",
    },
    es: {
      negative: "Necesita atención",
      warning: "Advertencia",
      normal: "Adecuado",
      positive: "Positivo",
      neutral: "Neutral",
    },
    fr: {
      negative: "À surveiller",
      warning: "Avertissement",
      normal: "Adéquat",
      positive: "Positif",
      neutral: "Neutre",
    },
    ht: {
      negative: "Bezwen atansyon",
      warning: "Avètisman",
      normal: "Bon",
      positive: "Pozitif",
      neutral: "Net",
    },
  };

  return (labelsByLanguage[language as keyof typeof labelsByLanguage] || labelsByLanguage.en)[
    group as keyof typeof labelsByLanguage.en
  ];
}

function ReportPreviewModal({
  analysis,
  values,
  loading,
  language,
  onClose,
  onEdit,
  onExport,
}: {
  analysis: SavedAnalysis;
  values: AnalysisValue[];
  loading: boolean;
  language: Language;
  onClose: () => void;
  onEdit: () => void;
  onExport: () => void;
}) {
  const l = analysisHistoryText[language as keyof typeof analysisHistoryText] || analysisHistoryText.en;
  const [activeFilter, setActiveFilter] = useState<PreviewGroupKey>("all");
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [analysis.analysis_id, loading]);

  const groupedValues = useMemo(
    () => ({
      negative: values.filter((value) => getValueGroup(value) === "negative"),
      warning: values.filter((value) => getValueGroup(value) === "warning"),
      normal: values.filter((value) => getValueGroup(value) === "normal"),
      positive: values.filter((value) => getValueGroup(value) === "positive"),
      neutral: values.filter((value) => getValueGroup(value) === "neutral"),
    }),
    [values]
  );

  const attentionCount =
    groupedValues.negative.length + groupedValues.warning.length;

  const filterChips: {
    key: PreviewGroupKey;
    label: string;
    count: number;
    tone: "red" | "yellow" | "green" | "emerald" | "slate" | "all";
  }[] = [
    { key: "all", label: l.allGroups, count: values.length, tone: "all" },
    {
      key: "negative",
      label: getGroupLabel("negative", language),
      count: groupedValues.negative.length,
      tone: "red",
    },
    {
      key: "warning",
      label: getGroupLabel("warning", language),
      count: groupedValues.warning.length,
      tone: "yellow",
    },
    {
      key: "normal",
      label: getGroupLabel("normal", language),
      count: groupedValues.normal.length,
      tone: "green",
    },
    {
      key: "positive",
      label: getGroupLabel("positive", language),
      count: groupedValues.positive.length,
      tone: "emerald",
    },
    {
      key: "neutral",
      label: getGroupLabel("neutral", language),
      count: groupedValues.neutral.length,
      tone: "slate",
    },
  ];

  const previewGroups: {
    key: Exclude<PreviewGroupKey, "all">;
    title: string;
    values: AnalysisValue[];
    tone: "red" | "yellow" | "green" | "emerald" | "slate";
  }[] = [
    {
      key: "negative",
      title: getGroupLabel("negative", language),
      values: groupedValues.negative,
      tone: "red",
    },
    {
      key: "warning",
      title: getGroupLabel("warning", language),
      values: groupedValues.warning,
      tone: "yellow",
    },
    {
      key: "normal",
      title: getGroupLabel("normal", language),
      values: groupedValues.normal,
      tone: "green",
    },
    {
      key: "positive",
      title: getGroupLabel("positive", language),
      values: groupedValues.positive,
      tone: "emerald",
    },
    {
      key: "neutral",
      title: getGroupLabel("neutral", language),
      values: groupedValues.neutral,
      tone: "slate",
    },
  ];

  const visiblePreviewGroups =
    activeFilter === "all"
      ? previewGroups.filter((group) => group.values.length > 0)
      : previewGroups.filter((group) => group.key === activeFilter);

  const metaItems = [
    { label: l.crop, value: getCropName(analysis) },
    {
      label: l.sampleType,
      value: getSampleTypeCode(analysis) === "soil" ? l.soil : l.foliar,
    },
    { label: l.farm, value: getFarmName(analysis) },
    { label: l.lot, value: getLotName(analysis) },
    { label: l.lab, value: getLabName(analysis) },
    {
      label: l.location,
      value: [analysis.province_state, analysis.country].filter(Boolean).join(", "),
    },
  ].filter((item) => item.value);

  return (
    <section className="animate-slide-up">
      <div className="values-screen-panel flex max-h-[calc(100dvh-7.5rem)] w-full flex-col overflow-hidden rounded-3xl">
        <header className="values-screen-panel__header shrink-0 px-4 py-3 sm:px-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <BackButton onClick={onClose} label={l.back} className="mb-2" />
              <h2 className="dark-text-primary truncate text-lg font-extrabold sm:text-xl">
                {getAnalysisTitle(analysis)}
              </h2>
              <p className="glass-text-muted text-xs">
                {getVersionLabel(analysis, language)} ·{" "}
                {getSampleTypeCode(analysis) === "soil" ? l.soil : l.foliar}
                {metaItems.length > 0
                  ? ` · ${metaItems.map((item) => item.value).join(" · ")}`
                  : ""}
              </p>
            </div>

            <div className="flex shrink-0 gap-1.5">
              <IconButton
                title={l.edit}
                onClick={onEdit}
                disabled={Boolean(analysis.is_deleted)}
              >
                <Edit3 size={16} />
              </IconButton>

              <IconButton title={l.export} onClick={onExport}>
                <Download size={16} />
              </IconButton>

              <IconButton title={l.close} onClick={onClose}>
                <X size={16} />
              </IconButton>
            </div>
          </div>
        </header>

        <div ref={contentRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {loading ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-700">
              {l.loading}
            </div>
          ) : values.length === 0 ? (
            <div className="rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900">
              {l.noValues}
            </div>
          ) : (
            <>
              <section className="calc-surface-muted mx-auto w-full max-w-3xl rounded-2xl p-3">
                <div>
                  <h3 className="text-sm font-bold text-green-900">{l.analysisSummary}</h3>
                  <p className="text-xs text-slate-600">
                    {values.length} {l.interpretedValues}
                    {attentionCount > 0
                      ? ` · ${attentionCount} ${l.needReview}`
                      : ` · ${l.noMajorAlerts}`}
                  </p>
                </div>

                <div className="mt-2.5 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:grid-cols-6">
                  {filterChips.map((chip) => (
                    <SummaryFilterChip
                      key={chip.key}
                      label={chip.label}
                      count={chip.count}
                      tone={chip.tone}
                      active={activeFilter === chip.key}
                      disabled={chip.key !== "all" && chip.count === 0}
                      onClick={() =>
                        setActiveFilter((current) =>
                          current === chip.key ? "all" : chip.key
                        )
                      }
                    />
                  ))}
                </div>
              </section>

              <section className="mx-auto mt-3 grid w-full max-w-3xl gap-3">
                {visiblePreviewGroups.length === 0 ? (
                  <p className="rounded-2xl bg-slate-50 p-4 text-center text-sm text-slate-600">
                    {l.noValues}
                  </p>
                ) : (
                  visiblePreviewGroups.map((group) => (
                    <PreviewValueGroup
                      key={group.key}
                      title={group.title}
                      values={group.values}
                      language={language}
                      tone={group.tone}
                      compact
                    />
                  ))
                )}
              </section>

              <details className="preview-details-panel mx-auto mt-4 w-full max-w-5xl rounded-2xl p-3">
                <summary className="cursor-pointer text-sm font-bold text-green-900">
                  {l.viewFullTable}
                </summary>

                <div className="preview-table-wrap mt-3 overflow-x-auto rounded-xl">
                  <table className="w-full min-w-[720px] border-collapse text-xs sm:text-sm">
                    <thead className="glass-section-muted text-left glass-text-muted">
                      <tr>
                        <th className="border-b border-slate-200 p-2.5">Parameter</th>
                        <th className="border-b border-slate-200 p-2.5">Value</th>
                        <th className="border-b border-slate-200 p-2.5">{l.range}</th>
                        <th className="border-b border-slate-200 p-2.5">{l.level}</th>
                        <th className="border-b border-slate-200 p-2.5">
                          {l.confidence}
                        </th>
                        <th className="border-b border-slate-200 p-2.5">{l.source}</th>
                      </tr>
                    </thead>

                    <tbody>
                      {values.map((item, index) => {
                        const symbol = getValueParameterSymbol(item);
                        const unit = getUnitSymbol(item);

                        return (
                          <tr
                            key={`${item.parameter_id}-${item.custom_parameter_id}-${index}`}
                          >
                            <td className="border-b border-slate-100 p-2.5 font-semibold">
                              {getValueParameterName(item)}
                              {symbol ? ` (${symbol})` : ""}
                            </td>
                            <td className="border-b border-slate-100 p-2.5">
                              {item.value ?? "—"} {unit}
                            </td>
                            <td className="border-b border-slate-100 p-2.5">
                              {item.min ?? "—"} - {item.max ?? "—"} {unit}
                            </td>
                            <td className="border-b border-slate-100 p-2.5">
                              {item.level_code || "—"}
                            </td>
                            <td className="border-b border-slate-100 p-2.5">
                              {item.confidence || "—"}
                            </td>
                            <td className="border-b border-slate-100 p-2.5">
                              {item.source_name || "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function VersionsModal({
  group,
  language,
  onClose,
  onView,
  onEdit,
  onExport,
  onDelete,
  onRestore,
}: {
  group: {
    rootId: number;
    versions: SavedAnalysis[];
    latest: SavedAnalysis;
  };
  language: Language;
  onClose: () => void;
  onView: (analysis: SavedAnalysis) => void;
  onEdit: (analysis: SavedAnalysis) => void;
  onExport: (analysis: SavedAnalysis) => void;
  onDelete: (analysis: SavedAnalysis) => void;
  onRestore: (analysis: SavedAnalysis) => void;
}) {
  const l = analysisHistoryText[language as keyof typeof analysisHistoryText] || analysisHistoryText.en;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <div className="glass-modal-shell max-h-[92vh] w-full max-w-4xl overflow-y-auto rounded-3xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-green-900">{l.versions}</h2>
            <p className="mt-1 text-sm text-slate-600">
              {getAnalysisTitle(group.latest)}
            </p>
          </div>

          <IconButton title={l.close} onClick={onClose}>
            <X size={17} />
          </IconButton>
        </div>

        <div className="mt-5 grid gap-3">
          {group.versions.map((analysis) => (
            <article
              key={analysis.analysis_id}
              className={`rounded-2xl border p-4 ${
                analysis.is_deleted
                  ? "border-red-200 bg-red-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onView(analysis)}
                      className="font-bold text-green-900 hover:underline"
                    >
                      {getVersionLabel(analysis, language)}
                    </button>

                    <span
                      className={`rounded-full px-2 py-1 text-xs font-bold ${
                        analysis.is_deleted
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-800"
                      }`}
                    >
                      {analysis.is_deleted ? l.deleted : l.active}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    {formatDate(
                      analysis.report_date ||
                        analysis.sampling_date ||
                        analysis.created_at
                    )}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    title={l.view}
                    onClick={() => onView(analysis)}
                    primary
                  >
                    <Eye size={17} />
                    <span>{l.view}</span>
                  </ActionButton>

                  <ActionButton
                    title={l.edit}
                    onClick={() => onEdit(analysis)}
                    disabled={Boolean(analysis.is_deleted)}
                  >
                    <Edit3 size={17} />
                    <span>{l.edit}</span>
                  </ActionButton>

                  <IconButton title={l.export} onClick={() => onExport(analysis)}>
                    <Download size={17} />
                  </IconButton>

                  {analysis.is_deleted ? (
                    <>
                      <IconButton
                        title={l.restore}
                        onClick={() => onRestore(analysis)}
                        tone="green"
                      >
                        <RotateCcw size={17} />
                      </IconButton>
                      <IconButton
                        title={l.deletePermanently}
                        onClick={() => onDelete(analysis)}
                        tone="red"
                      >
                        <Trash2 size={17} />
                      </IconButton>
                    </>
                  ) : (
                    <IconButton
                      title={l.delete}
                      onClick={() => onDelete(analysis)}
                      tone="red"
                    >
                      <Trash2 size={17} />
                    </IconButton>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryFilterChip({
  label,
  count,
  tone,
  active,
  disabled,
  onClick,
}: {
  label: string;
  count: number;
  tone: "red" | "yellow" | "green" | "emerald" | "slate" | "all";
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const toneStyles: Record<typeof tone, { idle: string; active: string }> = {
    all: {
      idle: "preview-filter-chip-idle ring-slate-200 hover:bg-green-50",
      active: "bg-green-700 text-white ring-green-700",
    },
    red: {
      idle: "bg-red-50 text-red-900 ring-red-200 hover:bg-red-100",
      active: "bg-red-600 text-white ring-red-600",
    },
    yellow: {
      idle: "bg-yellow-50 text-yellow-900 ring-yellow-200 hover:bg-yellow-100",
      active: "bg-yellow-600 text-white ring-yellow-600",
    },
    green: {
      idle: "bg-green-50 text-green-900 ring-green-200 hover:bg-green-100",
      active: "bg-green-600 text-white ring-green-600",
    },
    emerald: {
      idle: "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100",
      active: "bg-emerald-600 text-white ring-emerald-600",
    },
    slate: {
      idle: "bg-slate-100 text-slate-800 ring-slate-200 hover:bg-slate-200",
      active: "bg-slate-600 text-white ring-slate-600",
    },
  };

  const palette = toneStyles[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`w-full rounded-xl px-3 py-2 text-left ring-1 transition active:scale-[0.98] ${
        active ? palette.active : palette.idle
      } disabled:cursor-not-allowed disabled:opacity-40`}
    >
      <span className="block text-base font-extrabold leading-none">{count}</span>
      <span className="mt-0.5 block truncate text-[10px] font-semibold leading-tight">
        {label}
      </span>
    </button>
  );
}

function PreviewValueGroup({
  title,
  values,
  language,
  tone,
  compact = false,
}: {
  title: string;
  values: AnalysisValue[];
  language: Language;
  tone: "red" | "yellow" | "green" | "emerald" | "slate";
  compact?: boolean;
}) {
  if (values.length === 0) return null;

  const l = analysisHistoryText[language as keyof typeof analysisHistoryText] || analysisHistoryText.en;

  const styles = {
    red: "border-red-200 bg-red-50",
    yellow: "border-yellow-200 bg-yellow-50",
    green: "border-green-200 bg-green-50",
    emerald: "border-emerald-200 bg-emerald-50",
    slate: "border-slate-200 bg-slate-50",
  };

  return (
    <section
      className={`rounded-2xl border ${compact ? "p-3" : "rounded-3xl p-5"} ${styles[tone]}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-bold text-slate-900 ${compact ? "text-sm" : "text-lg"}`}>
          {title}
        </h3>
        <span
          className={`calc-value-pill font-bold ${
            compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
          }`}
        >
          {values.length}
        </span>
      </div>

      <div className={`grid gap-2 ${compact ? "mt-2" : "mt-4 gap-3"}`}>
        {values.map((item, index) => {
          const symbol = getValueParameterSymbol(item);
          const unit = getUnitSymbol(item);

          return (
            <article
              key={`${item.parameter_id}-${item.custom_parameter_id}-${index}`}
              className={`preview-value-card ${compact ? "p-2.5" : "rounded-2xl p-4"}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className={`font-bold text-slate-900 ${compact ? "text-sm" : ""}`}>
                    {getValueParameterName(item)}
                    {symbol ? ` (${symbol})` : ""}
                  </p>

                  <p className={`text-slate-600 ${compact ? "text-xs" : "mt-1 text-sm"}`}>
                    {item.value ?? "—"} {unit}
                    <span className="text-slate-400">
                      {" "}
                      · {l.range} {item.min ?? "—"}–{item.max ?? "—"} {unit}
                    </span>
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p
                    className={`font-bold uppercase text-green-800 ${
                      compact ? "text-[10px]" : ""
                    }`}
                  >
                    {item.level_code || "—"}
                  </p>
                  <p className="text-[10px] text-slate-500">
                    {item.confidence || "—"}
                  </p>
                </div>
              </div>

              {item.advice ? (
                <p
                  className={`rounded-lg bg-slate-50 text-slate-700 ${
                    compact ? "mt-1.5 p-2 text-xs" : "mt-3 rounded-xl p-3 text-sm"
                  }`}
                >
                  {item.advice}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}


