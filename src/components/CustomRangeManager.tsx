"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Edit3, PlusCircle, RefreshCw, Trash2 } from "lucide-react";

import AppModal from "@/components/AppModal";
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
    <AppModal
      open={open}
      onClose={closeModal}
      title={l.title}
      description={l.desc}
      size="xl"
      closeLabel={l.cancel}
    >
      {loading ? (
        <div className="app-modal-message app-modal-message--info">
          {l.loading}
        </div>
      ) : null}

      <section className="app-modal-section mt-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="app-modal-section__title">
              {editingRangeId ? l.editRange : l.addNew}
            </h3>
            <p className="app-modal-section__desc">{l.checkedFirst}</p>
          </div>
          <button
            type="button"
            onClick={resetForm}
            className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
          >
            {l.cancel}
          </button>
        </div>

        <div className="app-modal-fields">
          <label className="app-modal-field">
            <span className="app-modal-label">{l.parameterType}</span>
            <select
              className="app-native-select"
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

          <label className="app-modal-field">
            <span className="app-modal-label">{l.parameter}</span>
            <select
              className="app-native-select"
              value={selectedParameterId}
              onChange={(event) =>
                selectParameter(
                  event.target.value ? Number(event.target.value) : ""
                )
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

          <label className="app-modal-field">
            <span className="app-modal-label">{l.cropScope}</span>
            <select
              className="app-native-select"
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

          {cropScope === "specific" ? (
            <label className="app-modal-field">
              <span className="app-modal-label">{l.crop}</span>
              <select
                className="app-native-select"
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
          ) : null}

          <label className="app-modal-field">
            <span className="app-modal-label">{l.unit}</span>
            <select
              className="app-native-select"
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

          <label className="app-modal-field">
            <span className="app-modal-label">{l.min}</span>
            <input
              type="number"
              step="any"
              className="calc-field-input"
              value={minValue}
              onChange={(event) => setMinValue(event.target.value)}
            />
          </label>

          <label className="app-modal-field">
            <span className="app-modal-label">{l.max}</span>
            <input
              type="number"
              step="any"
              className="calc-field-input"
              value={maxValue}
              onChange={(event) => setMaxValue(event.target.value)}
            />
          </label>

          <label className="app-modal-field app-modal-field--wide">
            <span className="app-modal-label">{l.note}</span>
            <textarea
              className="calc-field-input min-h-24"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Example: This range is based on my local reference."
            />
          </label>

          <label className="app-modal-field app-modal-field--wide">
            <span className="app-modal-label">{l.source}</span>
            <input
              className="calc-field-input"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
            />
          </label>
        </div>

        <button
          type="button"
          onClick={saveRange}
          disabled={saving}
          className="app-modal-btn app-modal-btn--primary mt-4 w-full sm:w-auto"
        >
          <PlusCircle size={18} />
          {saving ? l.saving : editingRangeId ? l.update : l.save}
        </button>
      </section>

      {message ? (
        <div className="app-modal-message app-modal-message--warn mt-3">
          {message}
        </div>
      ) : null}

      <section className="app-modal-section mt-3">
        <div className="app-modal-toolbar">
          <p className="app-modal-toolbar__meta">
            {visibleRanges.length} range(s)
          </p>
          <div className="app-modal-toolbar__actions">
            <label className="app-modal-chip-toggle">
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
              className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
            >
              <RefreshCw size={16} />
              {l.refresh}
            </button>
          </div>
        </div>

        {visibleRanges.length === 0 ? (
          <div className="app-modal-message app-modal-message--warn">
            {l.noRanges}
          </div>
        ) : (
          <div className="app-modal-list">
            {visibleRanges.map((range) => {
              const symbol = getRangeSymbol(range);
              const unit = getRangeUnit(range);

              return (
                <article
                  key={range.custom_range_id}
                  className={`app-modal-list-item${
                    range.is_deleted ? " app-modal-list-item--deleted" : ""
                  }`}
                >
                  <div className="app-modal-list-item__head">
                    <h4 className="app-modal-list-item__title">
                      {getRangeName(range)}
                      {symbol ? ` (${symbol})` : ""}
                    </h4>
                    <span className="app-modal-badge app-modal-badge--muted">
                      {range.custom_parameter_id ? l.custom : l.official}
                    </span>
                    <span
                      className={`app-modal-badge ${
                        range.is_deleted
                          ? "app-modal-badge--deleted"
                          : "app-modal-badge--active"
                      }`}
                    >
                      {range.is_deleted ? l.deletedStatus : l.active}
                    </span>
                  </div>

                  <div className="app-modal-list-item__meta">
                    <p>
                      {getRangeCropName(range)} · {range.sample_type}
                    </p>
                    <p>
                      {range.min_value ?? "—"} - {range.max_value ?? "—"} {unit}
                    </p>
                  </div>

                  {range.interpretation_note ? (
                    <p className="mt-2 rounded-xl bg-[var(--glass-surface-muted)] p-3 text-sm text-[var(--foreground)]">
                      {range.interpretation_note}
                    </p>
                  ) : null}

                  <p className="mt-2 text-xs text-[#6c6c70]">
                    {range.source_name || "User custom range"}
                  </p>

                  <div className="app-modal-list-item__actions">
                    {!range.is_deleted ? (
                      <button
                        type="button"
                        onClick={() => editRange(range)}
                        className="app-modal-btn app-modal-btn--secondary app-modal-btn--sm"
                      >
                        <Edit3 size={15} />
                        {l.editRange}
                      </button>
                    ) : null}

                    {range.is_deleted ? (
                      <button
                        type="button"
                        onClick={() => restoreRange(range)}
                        className="app-modal-btn app-modal-btn--primary app-modal-btn--sm"
                      >
                        {l.restore}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => softDeleteRange(range)}
                        className="app-modal-btn app-modal-btn--danger app-modal-btn--sm"
                      >
                        <Trash2 size={15} />
                        {l.delete}
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </AppModal>
  );
}


