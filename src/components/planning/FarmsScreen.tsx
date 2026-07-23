"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Edit3,
  Eye,
  FileText,
  Landmark,
  MapPin,
  NotebookPen,
  Package,
  Plus,
  Sprout,
  Trash2,
  Warehouse,
} from "lucide-react";
import type { EditableAnalysisPayload } from "@/components/AnalysisHistory";
import type { Translation } from "@/lib/translations";
import {
  createFarm,
  createLot,
  deleteBodegaItem,
  listBodegaItems,
  listFarmAnalyses,
  listFarmLots,
  listUserFarms,
  updateFarmLocation,
  upsertBodegaItem,
  type BodegaItem,
  type FarmAnalysisSummary,
  type FarmRecord,
  type LotRecord,
} from "@/lib/farmRepository";
import {
  loadEditableAnalysisById,
  softDeleteAnalysis,
} from "@/lib/loadEditableAnalysis";
import { loadPlanningState } from "@/lib/planningStore";
import { detectLocation } from "@/lib/geolocation";
import {
  listAllFertilizers,
  matchCatalogProductKey,
} from "@/lib/fertilizerCatalog";
import MenuSelect from "@/components/ui/MenuSelect";

type View = "list" | "detail" | "bodega";

type Props = {
  t: Translation;
  userId?: string | null;
  onBack: () => void;
  onOpenCalendar: (farmName: string, lotName?: string) => void;
  onOpenNotes: (farmName: string) => void;
  onOpenHistory: (farmName?: string) => void;
  onOpenAnalysis?: (analysisId: number, farmName?: string) => void;
  onEditAnalysis?: (payload: EditableAnalysisPayload) => void;
  onOpenSetup: (farmName: string, lotName?: string) => void;
  selectedFarmName?: string;
  initialFarmId?: number | null;
};

export default function FarmsScreen({
  t,
  userId,
  onBack,
  onOpenCalendar,
  onOpenNotes,
  onOpenHistory,
  onOpenAnalysis,
  onEditAnalysis,
  onOpenSetup,
  selectedFarmName = "",
  initialFarmId = null,
}: Props) {
  const p = t.planning;
  const [view, setView] = useState<View>("list");
  const [farms, setFarms] = useState<FarmRecord[]>([]);
  const [lots, setLots] = useState<LotRecord[]>([]);
  const [analyses, setAnalyses] = useState<FarmAnalysisSummary[]>([]);
  const [bodega, setBodega] = useState<BodegaItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showAddFarm, setShowAddFarm] = useState(false);
  const [newFarmName, setNewFarmName] = useState("");
  const [newFarmLocation, setNewFarmLocation] = useState("");
  const [newLotName, setNewLotName] = useState("");
  const [locationDraft, setLocationDraft] = useState("");
  const [productName, setProductName] = useState("");
  const [productKey, setProductKey] = useState("");
  const [productQty, setProductQty] = useState("");
  const [productUnit, setProductUnit] = useState("kg");
  const [tick, setTick] = useState(0);
  const [gpsBusy, setGpsBusy] = useState(false);
  const [reportBusyId, setReportBusyId] = useState<number | null>(null);

  const selected = useMemo(
    () => farms.find((f) => f.farm_id === selectedId) || null,
    [farms, selectedId]
  );

  const planningForFarm = useMemo(() => {
    void tick;
    if (!selected) return { events: [], notes: [] };
    const state = loadPlanningState();
    const key = selected.farm_name.trim().toLocaleLowerCase();
    return {
      events: state.events
        .filter((e) => (e.farmName || "").trim().toLocaleLowerCase() === key)
        .sort((a, b) => a.date.localeCompare(b.date)),
      notes: state.notes.filter(
        (n) => (n.farmName || "").trim().toLocaleLowerCase() === key
      ),
    };
  }, [selected, tick]);

  const cropsOnFarm = useMemo(() => {
    const names = new Set<string>();
    for (const a of analyses) {
      if (a.crop_name) names.add(a.crop_name);
    }
    for (const e of planningForFarm.events) {
      if (e.placeNote) names.add(e.placeNote);
    }
    return [...names];
  }, [analyses, planningForFarm.events]);

  async function reloadFarms(preferId?: number | null, preferName?: string) {
    if (!userId) {
      setFarms([]);
      setSelectedId(null);
      return;
    }
    setLoading(true);
    setError("");
    try {
      const list = await listUserFarms(userId);
      setFarms(list);
      const byId =
        preferId != null
          ? list.find((f) => f.farm_id === preferId) || null
          : null;
      const targetName = (preferName || selectedFarmName || "").trim();
      const byName = targetName
        ? list.find(
            (f) =>
              f.farm_name.trim().toLocaleLowerCase() ===
              targetName.toLocaleLowerCase()
          )
        : null;
      const next = byId || byName || null;
      if (next && (preferId != null || preferName || initialFarmId)) {
        setSelectedId(next.farm_id);
        setView("detail");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void reloadFarms(initialFarmId, selectedFarmName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    if (!selected || !userId || view === "list") {
      if (view === "list") {
        setLots([]);
        setAnalyses([]);
        setBodega([]);
      }
      return;
    }
    setLocationDraft(selected.location || "");
    let cancelled = false;
    void (async () => {
      try {
        const [nextLots, nextAnalyses, nextBodega] = await Promise.all([
          listFarmLots(selected.farm_id),
          listFarmAnalyses(userId, selected.farm_id),
          listBodegaItems(userId, selected.farm_id),
        ]);
        if (!cancelled) {
          setLots(nextLots);
          setAnalyses(nextAnalyses);
          setBodega(nextBodega);
          setTick((n) => n + 1);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : p.farmsLoadError);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected, userId, view, p.farmsLoadError]);

  function openFarm(farm: FarmRecord) {
    setSelectedId(farm.farm_id);
    setView("detail");
    setError("");
  }

  function backToList() {
    setView("list");
    setSelectedId(null);
    setError("");
  }

  async function handleCreateFarm(event: React.FormEvent) {
    event.preventDefault();
    if (!userId || !newFarmName.trim()) return;
    setError("");
    try {
      const farm = await createFarm({
        userId,
        farmName: newFarmName,
        location: newFarmLocation,
      });
      setNewFarmName("");
      setNewFarmLocation("");
      setShowAddFarm(false);
      await reloadFarms(farm.farm_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    }
  }

  async function handleAddLot(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !newLotName.trim()) return;
    setError("");
    try {
      await createLot({ farmId: selected.farm_id, lotName: newLotName });
      setNewLotName("");
      setLots(await listFarmLots(selected.farm_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    }
  }

  async function handleSaveLocation() {
    if (!selected || !userId) return;
    setError("");
    try {
      await updateFarmLocation({
        farmId: selected.farm_id,
        userId,
        location: locationDraft,
      });
      await reloadFarms(selected.farm_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    }
  }

  async function handleDetectFarmLocation() {
    setError("");
    setGpsBusy(true);
    try {
      const result = await detectLocation();
      const label =
        [result.province, result.country].filter(Boolean).join(", ") ||
        result.displayName ||
        "";
      if (label) setLocationDraft(label);
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    } finally {
      setGpsBusy(false);
    }
  }

  function openFarmReport(analysis: FarmAnalysisSummary) {
    if (!selected) return;
    if (onOpenAnalysis) {
      onOpenAnalysis(analysis.analysis_id, selected.farm_name);
      return;
    }
    onOpenHistory(selected.farm_name);
  }

  async function editFarmReport(analysis: FarmAnalysisSummary) {
    if (!userId || !onEditAnalysis) {
      openFarmReport(analysis);
      return;
    }
    setError("");
    setReportBusyId(analysis.analysis_id);
    try {
      const payload = await loadEditableAnalysisById(
        userId,
        analysis.analysis_id
      );
      onEditAnalysis(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    } finally {
      setReportBusyId(null);
    }
  }

  async function deleteFarmReport(analysis: FarmAnalysisSummary) {
    if (!userId) return;
    if (!window.confirm(p.confirmDeleteReport)) return;
    setError("");
    setReportBusyId(analysis.analysis_id);
    try {
      await softDeleteAnalysis(userId, analysis.analysis_id);
      setAnalyses((current) =>
        current.filter((item) => item.analysis_id !== analysis.analysis_id)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    } finally {
      setReportBusyId(null);
    }
  }

  async function handleAddBodega(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || !userId || !productName.trim()) return;
    setError("");
    try {
      const resolvedKey =
        productKey || matchCatalogProductKey(productName) || null;
      await upsertBodegaItem({
        userId,
        farmId: selected.farm_id,
        productName,
        productKey: resolvedKey,
        quantity: Number(productQty) || 0,
        unit: productUnit,
      });
      setProductName("");
      setProductKey("");
      setProductQty("");
      setBodega(await listBodegaItems(userId, selected.farm_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : p.farmsLoadError);
    }
  }

  if (!userId) {
    return (
      <section className="animate-slide-up space-y-4 px-0 pb-8 pt-2">
        <Header title={p.farmsTitle} desc={p.farmsDesc} onBack={onBack} back={p.back} />
        <div className="calc-surface p-4 text-sm text-slate-600 dark:text-slate-300">
          {p.farmsSignInRequired}
        </div>
      </section>
    );
  }

  if (view === "bodega" && selected) {
    return (
      <section className="animate-slide-up space-y-4 px-0 pb-8 pt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button
              type="button"
              className="plan-timeline-card__action mb-2 inline-flex items-center gap-1"
              onClick={() => setView("detail")}
            >
              <ArrowLeft size={14} />
              {selected.farm_name}
            </button>
            <h1 className="text-xl font-bold dark-text-primary">{p.bodegaTitle}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {p.bodegaDesc}
            </p>
          </div>
          <button type="button" className="calc-guided-stepper__nav-btn text-sm" onClick={onBack}>
            {p.back}
          </button>
        </div>

        {error ? <div className="plan-callout">{error}</div> : null}

        <form className="calc-surface space-y-3 p-4" onSubmit={handleAddBodega}>
          <h2 className="text-sm font-bold dark-text-primary">{p.bodegaAdd}</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="calc-field-label grid gap-1 sm:col-span-2">
              {p.bodegaCatalog}
              <MenuSelect
                compact
                value={productKey || "__custom__"}
                onChange={(value) => {
                  if (value === "__custom__") {
                    setProductKey("");
                    return;
                  }
                  setProductKey(value);
                  const match = listAllFertilizers().find((f) => f.key === value);
                  if (match) setProductName(match.label);
                }}
                options={[
                  ["__custom__", p.bodegaCustomProduct],
                  ...listAllFertilizers().map(
                    (item) => [item.key, item.label] as [string, string]
                  ),
                ]}
                searchable
              />
            </label>
            <label className="calc-field-label grid gap-1 sm:col-span-2">
              {p.bodegaProduct}
              <input
                className="calc-field-input"
                value={productName}
                onChange={(e) => {
                  setProductName(e.target.value);
                  setProductKey(matchCatalogProductKey(e.target.value) || "");
                }}
                required
              />
            </label>
            <label className="calc-field-label grid gap-1">
              {p.bodegaQty}
              <input
                className="calc-field-input"
                type="number"
                min="0"
                step="any"
                value={productQty}
                onChange={(e) => setProductQty(e.target.value)}
              />
            </label>
            <label className="calc-field-label grid gap-1">
              {p.bodegaUnit}
              <input
                className="calc-field-input"
                value={productUnit}
                onChange={(e) => setProductUnit(e.target.value)}
              />
            </label>
          </div>
          <button
            type="submit"
            className="plan-btn-primary"
          >
            {p.bodegaSave}
          </button>
        </form>

        <div className="farm-detail-stack">
          {bodega.length === 0 ? (
            <div className="calc-surface p-4 text-sm text-slate-500">{p.bodegaEmpty}</div>
          ) : (
            bodega.map((item) => (
              <article key={item.id} className="farm-detail-row">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold dark-text-primary">{item.product_name}</p>
                  <p className="text-xs text-slate-500">
                    {item.quantity} {item.unit}
                    {item.notes ? ` · ${item.notes}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  className="plan-timeline-card__action plan-timeline-card__action--danger"
                  onClick={() =>
                    void (async () => {
                      await deleteBodegaItem(userId, item.id);
                      setBodega(await listBodegaItems(userId, selected.farm_id));
                    })()
                  }
                >
                  {p.delete}
                </button>
              </article>
            ))
          )}
        </div>
      </section>
    );
  }

  if (view === "detail" && selected) {
    return (
      <section className="animate-slide-up space-y-3 px-0 pb-8 pt-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <button
              type="button"
              className="plan-timeline-card__action mb-2 inline-flex items-center gap-1"
              onClick={backToList}
            >
              <ArrowLeft size={14} />
              {p.farmsListTitle}
            </button>
            <h1 className="text-xl font-bold dark-text-primary">{selected.farm_name}</h1>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              {selected.location || p.locationUnknown}
            </p>
          </div>
          <button type="button" className="calc-guided-stepper__nav-btn text-sm" onClick={onBack}>
            {p.back}
          </button>
        </div>

        {error ? <div className="plan-callout">{error}</div> : null}

        <div className="farm-detail-stack">
          <section className="farm-detail-block">
            <h2 className="farm-detail-block__title">
              <MapPin size={15} />
              {p.farmLocation}
            </h2>
            <label className="calc-field-label grid gap-1">
              {p.farmLocationPlaceholder}
              <input
                className="calc-field-input"
                value={locationDraft}
                onChange={(e) => setLocationDraft(e.target.value)}
              />
            </label>
            {analyses[0]?.country || analyses[0]?.province_state ? (
              <p className="mt-2 text-xs text-slate-500">
                {p.fromLatestAnalysis}:{" "}
                {[analyses[0].province_state, analyses[0].country]
                  .filter(Boolean)
                  .join(", ")}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                className="plan-btn-secondary"
                disabled={gpsBusy}
                onClick={() => void handleDetectFarmLocation()}
              >
                {gpsBusy ? p.farmsLoading : p.detectLocation}
              </button>
              <button
                type="button"
                className="plan-btn-secondary"
                onClick={() => void handleSaveLocation()}
              >
                {p.saveLocation}
              </button>
            </div>
          </section>

          <section className="farm-detail-block">
            <h2 className="farm-detail-block__title">
              <Landmark size={15} />
              {p.farmLots}
            </h2>
            {lots.length === 0 ? (
              <p className="text-sm text-slate-500">{p.noLotsYet}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {lots.map((lot) => (
                  <li key={lot.lot_id} className="farm-chip">
                    {lot.lot_name}
                  </li>
                ))}
              </ul>
            )}
            <form className="mt-2 flex flex-wrap gap-2" onSubmit={handleAddLot}>
              <input
                className="calc-field-input min-w-[10rem] flex-1"
                value={newLotName}
                onChange={(e) => setNewLotName(e.target.value)}
                placeholder={p.addLotPlaceholder}
              />
              <button
                type="submit"
                className="plan-btn-primary"
              >
                {p.addLot}
              </button>
            </form>
          </section>

          <section className="farm-detail-block">
            <h2 className="farm-detail-block__title">
              <Sprout size={15} />
              {p.farmCrops}
            </h2>
            {cropsOnFarm.length === 0 ? (
              <p className="text-sm text-slate-500">{p.noCropsYet}</p>
            ) : (
              <ul className="flex flex-wrap gap-1.5">
                {cropsOnFarm.map((crop) => (
                  <li key={crop} className="farm-chip">
                    {crop}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="farm-detail-block">
            <div className="flex items-center justify-between gap-2">
              <h2 className="farm-detail-block__title">
                <Warehouse size={15} />
                {p.bodegaTitle}
              </h2>
              <button
                type="button"
                className="plan-timeline-card__action"
                onClick={() => setView("bodega")}
              >
                {p.openBodega}
              </button>
            </div>
            <p className="text-sm text-slate-500">
              {bodega.length === 0
                ? p.bodegaEmpty
                : p.bodegaCount.replace("{count}", String(bodega.length))}
            </p>
          </section>

          <section className="farm-detail-block">
            <div className="flex items-center justify-between gap-2">
              <h2 className="farm-detail-block__title">
                <CalendarDays size={15} />
                {p.farmCalendars}
              </h2>
              <button
                type="button"
                className="plan-timeline-card__action"
                onClick={() => onOpenCalendar(selected.farm_name)}
              >
                {p.openCalendar}
              </button>
            </div>
            {planningForFarm.events.length === 0 ? (
              <p className="text-sm text-slate-500">{p.noCalendarYet}</p>
            ) : (
              <ul className="space-y-1.5">
                {planningForFarm.events.slice(0, 5).map((event) => (
                  <li key={event.id} className="farm-detail-row">
                    <span className="font-medium dark-text-primary">{event.title}</span>
                    <span className="text-xs text-slate-500">{event.date}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="farm-detail-block">
            <div className="flex items-center justify-between gap-2">
              <h2 className="farm-detail-block__title">
                <FileText size={15} />
                {p.farmReports}
              </h2>
              <button
                type="button"
                className="plan-timeline-card__action"
                onClick={() => onOpenHistory(selected.farm_name)}
              >
                {p.openHistory}
              </button>
            </div>
            {analyses.length === 0 ? (
              <p className="text-sm text-slate-500">{p.noReportsYet}</p>
            ) : (
              <ul className="space-y-1.5">
                {analyses.map((a) => {
                  const busy = reportBusyId === a.analysis_id;
                  return (
                    <li key={a.analysis_id} className="farm-detail-row farm-detail-row--actions">
                      <button
                        type="button"
                        className="farm-detail-row__main"
                        onClick={() => openFarmReport(a)}
                        disabled={busy}
                      >
                        <span className="min-w-0 text-left">
                          <span className="block font-medium dark-text-primary">
                            {a.analysis_name || a.crop_name || `#${a.analysis_id}`}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {[
                              a.lot_name,
                              a.sampling_date || a.created_at?.slice(0, 10),
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                      </button>
                      <div className="farm-detail-row__icons">
                        <button
                          type="button"
                          className="farm-detail-icon-btn"
                          title={p.openReport}
                          aria-label={p.openReport}
                          onClick={() => openFarmReport(a)}
                          disabled={busy}
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          type="button"
                          className="farm-detail-icon-btn"
                          title={p.editReport}
                          aria-label={p.editReport}
                          onClick={() => void editFarmReport(a)}
                          disabled={busy || !onEditAnalysis}
                        >
                          <Edit3 size={15} />
                        </button>
                        <button
                          type="button"
                          className="farm-detail-icon-btn farm-detail-icon-btn--danger"
                          title={p.deleteReport}
                          aria-label={p.deleteReport}
                          onClick={() => void deleteFarmReport(a)}
                          disabled={busy}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="farm-detail-block">
            <div className="flex items-center justify-between gap-2">
              <h2 className="farm-detail-block__title">
                <NotebookPen size={15} />
                {p.farmNotes}
              </h2>
              <button
                type="button"
                className="plan-timeline-card__action"
                onClick={() => onOpenNotes(selected.farm_name)}
              >
                {p.openNotes}
              </button>
            </div>
            {planningForFarm.notes.length === 0 ? (
              <p className="text-sm text-slate-500">{p.noNotesYet}</p>
            ) : (
              <ul className="space-y-1.5">
                {planningForFarm.notes.slice(0, 4).map((note) => (
                  <li key={note.id} className="farm-detail-row">
                    <div>
                      <p className="font-medium dark-text-primary">{note.title}</p>
                      <p className="line-clamp-2 text-xs text-slate-500">{note.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="flex flex-wrap gap-2 pt-1">
          <button
            type="button"
            className="plan-btn-primary"
            onClick={() => onOpenSetup(selected.farm_name, lots[0]?.lot_name)}
          >
            {p.useFarmInSetup}
          </button>
          <button
            type="button"
            className="plan-btn-secondary"
            onClick={() => setView("bodega")}
          >
            <span className="inline-flex items-center gap-1">
              <Package size={14} />
              {p.openBodega}
            </span>
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="animate-slide-up space-y-4 px-0 pb-8 pt-2">
      <Header title={p.farmsTitle} desc={p.farmsDesc} onBack={onBack} back={p.back} />

      {error ? <div className="plan-callout">{error}</div> : null}

      <div className="calc-surface space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold dark-text-primary">{p.farmsListTitle}</h2>
          <button
            type="button"
            className="plan-btn-primary"
            onClick={() => setShowAddFarm((v) => !v)}
          >
            <Plus size={14} />
            {p.addFarm}
          </button>
        </div>

        {showAddFarm ? (
          <form className="grid gap-2" onSubmit={handleCreateFarm}>
            <label className="calc-field-label grid gap-1">
              {p.newFarmName}
              <input
                className="calc-field-input"
                value={newFarmName}
                onChange={(e) => setNewFarmName(e.target.value)}
                required
              />
            </label>
            <label className="calc-field-label grid gap-1">
              {p.farmLocation}
              <input
                className="calc-field-input"
                value={newFarmLocation}
                onChange={(e) => setNewFarmLocation(e.target.value)}
                placeholder={p.farmLocationPlaceholder}
              />
            </label>
            <button
              type="submit"
              className="plan-btn-primary"
            >
              {p.saveFarm}
            </button>
          </form>
        ) : null}

        {loading ? (
          <p className="text-sm text-slate-500">{p.farmsLoading}</p>
        ) : farms.length === 0 ? (
          <p className="text-sm text-slate-500">{p.emptyFarms}</p>
        ) : (
          <ul className="farm-list">
            {farms.map((farm) => (
              <li key={farm.farm_id}>
                <button
                  type="button"
                  onClick={() => openFarm(farm)}
                  className="farm-list__item"
                >
                  <span className="min-w-0 text-left">
                    <span className="block font-semibold dark-text-primary">
                      {farm.farm_name}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">
                      {farm.location || p.locationUnknown}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 opacity-60" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function Header({
  title,
  desc,
  onBack,
  back,
}: {
  title: string;
  desc: string;
  onBack: () => void;
  back: string;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="max-w-xl">
        <h1 className="text-xl font-bold dark-text-primary">{title}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{desc}</p>
      </div>
      <button type="button" className="calc-guided-stepper__nav-btn text-sm" onClick={onBack}>
        {back}
      </button>
    </div>
  );
}
