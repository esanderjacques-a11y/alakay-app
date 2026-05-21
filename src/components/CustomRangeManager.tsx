"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Edit3, PlusCircle, RefreshCw, Trash2, X } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Language } from "@/lib/translations";
import { customRangeManagerText } from "@/lib/i18n/componentText";

type Crop = {
  crop_id: number;
  crop_name: string;
};

type Unit = {
  unit_id: number;
  unit_symbol: string;
};

type OfficialParameter = {
  parameter_id: number;
  parameter_name: string;
  symbol: string | null;
  category: string | null;
  default_unit_id: number | null;
  units:
    | {
        unit_id: number;
        unit_symbol: string;
      }
    | {
        unit_id: number;
        unit_symbol: string;
      }[]
    | null;
};

type CustomParameter = {
  custom_parameter_id: number;
  parameter_name: string;
  symbol: string | null;
  category: string | null;
  default_unit_id: number | null;
  units:
    | {
        unit_id: number;
        unit_symbol: string;
      }
    | {
        unit_id: number;
        unit_symbol: string;
      }[]
    | null;
};

type CustomRange = {
  custom_range_id: number;
  parameter_id: number | null;
  custom_parameter_id: number | null;
  crop_id: number | null;
  sample_type: "soil" | "foliar";
  unit_id: number | null;
  min_value: number | null;
  max_value: number | null;
  interpretation_note: string | null;
  source_name: string | null;
  created_at: string;
  is_deleted: boolean | null;
  parameters:
    | {
        parameter_name: string;
        symbol: string | null;
      }
    | {
        parameter_name: string;
        symbol: string | null;
      }[]
    | null;
  user_custom_parameters:
    | {
        parameter_name: string;
        symbol: string | null;
      }
    | {
        parameter_name: string;
        symbol: string | null;
      }[]
    | null;
  crops:
    | {
        crop_name: string;
      }
    | {
        crop_name: string;
      }[]
    | null;
  units:
    | {
        unit_symbol: string;
      }
    | {
        unit_symbol: string;
      }[]
    | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  session: Session | null;
  language: Language;
  sampleType: "soil" | "foliar";
  currentCropId: number | "";
};


function getOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export default function CustomRangeManager({
  open,
  onClose,
  onChanged,
  session,
  language,
  sampleType,
  currentCropId,
}: Props) {
  const l = customRangeManagerText[language as keyof typeof customRangeManagerText] || customRangeManagerText.en;

  const [crops, setCrops] = useState<Crop[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [officialParameters, setOfficialParameters] = useState<
    OfficialParameter[]
  >([]);
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>(
    []
  );
  const [ranges, setRanges] = useState<CustomRange[]>([]);

  const [parameterType, setParameterType] = useState<"official" | "custom">(
    "official"
  );
  const [selectedParameterId, setSelectedParameterId] = useState<number | "">(
    ""
  );
  const [cropScope, setCropScope] = useState<
    "general" | "current" | "specific"
  >(currentCropId ? "current" : "general");
  const [selectedCropId, setSelectedCropId] = useState<number | "">(
    currentCropId || ""
  );
  const [unitId, setUnitId] = useState<number | "">("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [note, setNote] = useState("");
  const [sourceName, setSourceName] = useState("User custom range");
  const [editingRangeId, setEditingRangeId] = useState<number | null>(null);

  const [showDeleted, setShowDeleted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const parameterOptions = useMemo(() => {
    if (parameterType === "official") {
      return officialParameters.map((parameter) => {
        const unit = getOne(parameter.units);

        return {
          id: parameter.parameter_id,
          name: `${parameter.parameter_name}${
            parameter.symbol ? ` (${parameter.symbol})` : ""
          }`,
          unitId: unit?.unit_id || parameter.default_unit_id || "",
        };
      });
    }

    return customParameters.map((parameter) => {
      const unit = getOne(parameter.units);

      return {
        id: parameter.custom_parameter_id,
        name: `${parameter.parameter_name}${
          parameter.symbol ? ` (${parameter.symbol})` : ""
        }`,
        unitId: unit?.unit_id || parameter.default_unit_id || "",
      };
    });
  }, [parameterType, officialParameters, customParameters]);

  const visibleRanges = useMemo(() => {
    return ranges.filter((range) => (showDeleted ? true : !range.is_deleted));
  }, [ranges, showDeleted]);

  useEffect(() => {
    if (!open) return;

    queueMicrotask(() => {
      setCropScope(currentCropId ? "current" : "general");
      setSelectedCropId(currentCropId || "");
    });
    loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sampleType, session?.user?.id]);

  function selectParameter(nextParameterId: number | "") {
    setSelectedParameterId(nextParameterId);
  
    if (!nextParameterId) {
      setUnitId("");
      return;
    }
  
    const option = parameterOptions.find(
      (item) => item.id === nextParameterId
    );
  
    if (option?.unitId) {
      setUnitId(Number(option.unitId));
    }
  }

  function selectCropScope(nextCropScope: "general" | "current" | "specific") {
    setCropScope(nextCropScope);
  
    if (nextCropScope === "current") {
      setSelectedCropId(currentCropId || "");
    }
  
    if (nextCropScope === "general") {
      setSelectedCropId("");
    }
  }

  async function loadInitialData() {
    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    setLoading(true);
    setMessage("");

    const column = sampleType;

    const [
      cropsResponse,
      unitsResponse,
      officialResponse,
      customResponse,
      rangesResponse,
    ] = await Promise.all([
      supabase.from("crops").select("crop_id, crop_name").order("crop_name"),
      supabase.from("units").select("unit_id, unit_symbol").order("unit_symbol"),
      supabase
        .from("parameters")
        .select(
          `
          parameter_id,
          parameter_name,
          symbol,
          category,
          default_unit_id,
          units (
            unit_id,
            unit_symbol
          )
        `
        )
        .eq(column, true)
        .order("parameter_name"),
      supabase
        .from("user_custom_parameters")
        .select(
          `
          custom_parameter_id,
          parameter_name,
          symbol,
          category,
          default_unit_id,
          units (
            unit_id,
            unit_symbol
          )
        `
        )
        .eq("user_id", session.user.id)
        .eq("sample_type", sampleType)
        .eq("is_deleted", false)
        .order("parameter_name"),
      supabase
        .from("user_custom_ranges")
        .select(
          `
          custom_range_id,
          parameter_id,
          custom_parameter_id,
          crop_id,
          sample_type,
          unit_id,
          min_value,
          max_value,
          interpretation_note,
          source_name,
          created_at,
          is_deleted,
          parameters (
            parameter_name,
            symbol
          ),
          user_custom_parameters (
            parameter_name,
            symbol
          ),
          crops (
            crop_name
          ),
          units (
            unit_symbol
          )
        `
        )
        .eq("user_id", session.user.id)
        .eq("sample_type", sampleType)
        .order("created_at", { ascending: false }),
    ]);

    setLoading(false);

    const firstError =
      cropsResponse.error ||
      unitsResponse.error ||
      officialResponse.error ||
      customResponse.error ||
      rangesResponse.error;

    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    setCrops((cropsResponse.data || []) as Crop[]);
    setUnits((unitsResponse.data || []) as Unit[]);
    setOfficialParameters((officialResponse.data || []) as OfficialParameter[]);
    setCustomParameters((customResponse.data || []) as CustomParameter[]);
    setRanges((rangesResponse.data || []) as CustomRange[]);
  }

  function resetForm() {
    setParameterType("official");
    setSelectedParameterId("");
    setCropScope(currentCropId ? "current" : "general");
    setSelectedCropId(currentCropId || "");
    setUnitId("");
    setMinValue("");
    setMaxValue("");
    setNote("");
    setSourceName("User custom range");
    setEditingRangeId(null);
    setMessage("");
  }

  function closeModal() {
    resetForm();
    onClose();
  }

  function getRangeName(range: CustomRange) {
    const official = getOne(range.parameters);
    const custom = getOne(range.user_custom_parameters);

    return custom?.parameter_name || official?.parameter_name || "Parameter";
  }

  function getRangeSymbol(range: CustomRange) {
    const official = getOne(range.parameters);
    const custom = getOne(range.user_custom_parameters);

    return custom?.symbol || official?.symbol || "";
  }

  function getRangeCropName(range: CustomRange) {
    const crop = getOne(range.crops);
    return crop?.crop_name || l.generalRange;
  }

  function getRangeUnit(range: CustomRange) {
    const unit = getOne(range.units);
    return unit?.unit_symbol || "";
  }

  function editRange(range: CustomRange) {
    const isCustom = Boolean(range.custom_parameter_id);

    setEditingRangeId(range.custom_range_id);
    setParameterType(isCustom ? "custom" : "official");
    setSelectedParameterId(
      isCustom ? range.custom_parameter_id || "" : range.parameter_id || ""
    );

    if (range.crop_id === null) {
      setCropScope("general");
      setSelectedCropId("");
    } else if (currentCropId && range.crop_id === currentCropId) {
      setCropScope("current");
      setSelectedCropId(currentCropId);
    } else {
      setCropScope("specific");
      setSelectedCropId(range.crop_id);
    }

    setUnitId(range.unit_id || "");
    setMinValue(range.min_value === null ? "" : String(range.min_value));
    setMaxValue(range.max_value === null ? "" : String(range.max_value));
    setNote(range.interpretation_note || "");
    setSourceName(range.source_name || "User custom range");
    setMessage("");
  }

  async function saveRange() {
    setMessage("");

    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    const parsedMin = minValue.trim() === "" ? null : Number(minValue.trim());
    const parsedMax = maxValue.trim() === "" ? null : Number(maxValue.trim());

    const hasInvalidMin = parsedMin !== null && Number.isNaN(parsedMin);
    const hasInvalidMax = parsedMax !== null && Number.isNaN(parsedMax);

    if (
      !selectedParameterId ||
      !unitId ||
      (parsedMin === null && parsedMax === null) ||
      hasInvalidMin ||
      hasInvalidMax
    ) {
      setMessage(l.required);
      return;
    }

    if (cropScope === "specific" && !selectedCropId) {
      setMessage(l.selectCrop);
      return;
    }

    const cropIdToSave =
      cropScope === "general" ? null : selectedCropId ? selectedCropId : null;

    setSaving(true);

    const payload = {
      user_id: session.user.id,
      parameter_id:
        parameterType === "official" ? Number(selectedParameterId) : null,
      custom_parameter_id:
        parameterType === "custom" ? Number(selectedParameterId) : null,
      crop_id: cropIdToSave,
      sample_type: sampleType,
      unit_id: Number(unitId),
      min_value: parsedMin,
      max_value: parsedMax,
      interpretation_note: note.trim() || null,
      source_name: sourceName.trim() || "User custom range",
      is_deleted: false,
      deleted_at: null,
    };

    if (editingRangeId) {
      const { error } = await supabase
        .from("user_custom_ranges")
        .update(payload)
        .eq("custom_range_id", editingRangeId)
        .eq("user_id", session.user.id);

      setSaving(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(l.updated);
    } else {
      const { error } = await supabase
        .from("user_custom_ranges")
        .insert(payload);

      setSaving(false);

      if (error) {
        setMessage(error.message);
        return;
      }

      setMessage(l.saved);
    }

    resetForm();
    await loadInitialData();
    onChanged();
  }

  async function softDeleteRange(range: CustomRange) {
    if (!session?.user) return;

    const confirmed = window.confirm(`Delete range for ${getRangeName(range)}?`);

    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("user_custom_ranges")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("custom_range_id", range.custom_range_id)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(l.deleted);
    await loadInitialData();
    onChanged();
  }

  async function restoreRange(range: CustomRange) {
    if (!session?.user) return;

    setSaving(true);

    const { error } = await supabase
      .from("user_custom_ranges")
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq("custom_range_id", range.custom_range_id)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(l.restored);
    await loadInitialData();
    onChanged();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-green-900">{l.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{l.desc}</p>
          </div>

          <button
            type="button"
            onClick={closeModal}
            className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        {loading && (
          <div className="mt-5 rounded-2xl bg-slate-50 p-4 text-slate-700">
            {l.loading}
          </div>
        )}

        <section className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-green-900">
                {editingRangeId ? l.editRange : l.addNew}
              </h3>
              <p className="mt-1 text-sm text-slate-600">{l.checkedFirst}</p>
            </div>

            <button
              type="button"
              onClick={resetForm}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              {l.cancel}
            </button>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="grid gap-1">
              <span className="text-sm font-semibold text-slate-700">
                {l.parameterType}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                value={parameterType}
                onChange={(event) => {
                  setParameterType(event.target.value as "official" | "custom");
                  setSelectedParameterId("");
                  setUnitId("");
                }}
              >
                <option value="official">{l.official}</option>
                <option value="custom">{l.custom}</option>
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-slate-700">
                {l.parameter}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                value={selectedParameterId}
                onChange={(event) =>
                  selectParameter(event.target.value ? Number(event.target.value) : "")
                }
              >
                <option value="">{l.selectParameter}</option>
                {parameterOptions.map((parameter) => (
                  <option key={parameter.id} value={parameter.id}>
                    {parameter.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-slate-700">
                {l.cropScope}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                value={cropScope}
                onChange={(event) =>
                  selectCropScope(
                    event.target.value as "general" | "current" | "specific"
                  )
                }
              >
                <option value="general">{l.generalRange}</option>
                <option value="current" disabled={!currentCropId}>
                  {l.currentCrop}
                </option>
                <option value="specific">{l.specificCrop}</option>
              </select>
            </label>

            {cropScope === "specific" && (
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-slate-700">
                  {l.crop}
                </span>
                <select
                  className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                  value={selectedCropId}
                  onChange={(event) =>
                    setSelectedCropId(
                      event.target.value ? Number(event.target.value) : ""
                    )
                  }
                >
                  <option value="">{l.selectCrop}</option>
                  {crops.map((crop) => (
                    <option key={crop.crop_id} value={crop.crop_id}>
                      {crop.crop_name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="grid gap-1">
              <span className="text-sm font-semibold text-slate-700">
                {l.unit}
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                value={unitId}
                onChange={(event) =>
                  setUnitId(event.target.value ? Number(event.target.value) : "")
                }
              >
                <option value="">{l.selectUnit}</option>
                {units.map((unit) => (
                  <option key={unit.unit_id} value={unit.unit_id}>
                    {unit.unit_symbol}
                  </option>
                ))}
              </select>
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-sm font-semibold text-slate-700">
                  {l.min}
                </span>
                <input
                  type="number"
                  step="any"
                  className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                  value={minValue}
                  onChange={(event) => setMinValue(event.target.value)}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold text-slate-700">
                  {l.max}
                </span>
                <input
                  type="number"
                  step="any"
                  className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                  value={maxValue}
                  onChange={(event) => setMaxValue(event.target.value)}
                />
              </label>
            </div>

            <label className="grid gap-1 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                {l.note}
              </span>
              <textarea
                className="min-h-24 rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Example: This range is based on my local reference."
              />
            </label>

            <label className="grid gap-1 md:col-span-2">
              <span className="text-sm font-semibold text-slate-700">
                {l.source}
              </span>
              <input
                className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
              />
            </label>
          </div>

          <button
            type="button"
            onClick={saveRange}
            disabled={saving}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60 md:w-auto"
          >
            <PlusCircle size={18} />
            {saving ? l.saving : editingRangeId ? l.update : l.save}
          </button>
        </section>

        {message && (
          <div className="mt-5 rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900">
            {message}
          </div>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-green-900">
                {l.existingRanges}
              </h3>
              <p className="mt-1 text-sm text-slate-600">
                {visibleRanges.length} range(s)
              </p>
            </div>

            <div className="flex flex-col gap-2 md:flex-row">
              <label className="flex items-center gap-2 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
                <input
                  type="checkbox"
                  checked={showDeleted}
                  onChange={(event) => setShowDeleted(event.target.checked)}
                />
                {l.showDeleted}
              </label>

              <button
                type="button"
                onClick={loadInitialData}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 px-4 py-3 text-sm font-semibold text-green-800 hover:bg-green-50"
              >
                <RefreshCw size={16} />
                {l.refresh}
              </button>
            </div>
          </div>

          {visibleRanges.length === 0 && (
            <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-yellow-900">
              {l.noRanges}
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {visibleRanges.map((range) => {
              const symbol = getRangeSymbol(range);
              const unit = getRangeUnit(range);

              return (
                <div
                  key={range.custom_range_id}
                  className={`rounded-2xl border p-4 ${
                    range.is_deleted
                      ? "border-red-200 bg-red-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-slate-900">
                          {getRangeName(range)}
                          {symbol ? ` (${symbol})` : ""}
                        </h4>

                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                          {range.custom_parameter_id ? l.custom : l.official}
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 text-xs font-bold ${
                            range.is_deleted
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-800"
                          }`}
                        >
                          {range.is_deleted ? l.deletedStatus : l.active}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-600">
                        {getRangeCropName(range)} · {range.sample_type}
                      </p>

                      <p className="mt-1 text-sm font-semibold text-slate-800">
                        {range.min_value ?? "—"} - {range.max_value ?? "—"}{" "}
                        {unit}
                      </p>

                      {range.interpretation_note && (
                        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                          {range.interpretation_note}
                        </p>
                      )}

                      <p className="mt-2 text-xs text-slate-500">
                        {range.source_name || "User custom range"}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {!range.is_deleted && (
                        <button
                          type="button"
                          onClick={() => editRange(range)}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          <Edit3 size={15} />
                          Edit
                        </button>
                      )}

                      {range.is_deleted ? (
                        <button
                          type="button"
                          onClick={() => restoreRange(range)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800"
                        >
                          {l.restore}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => softDeleteRange(range)}
                          className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700"
                        >
                          <Trash2 size={15} />
                          {l.delete}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}


