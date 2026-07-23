"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Edit3, PlusCircle, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";

import AppModal from "@/components/AppModal";
import MenuSelect from "@/components/ui/MenuSelect";
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
  /** Render inline (no modal) for the custom-data portal. */
  embedded?: boolean;
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
  embedded = false,
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
  const [composerOpen, setComposerOpen] = useState(false);
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
    if (embedded) setComposerOpen(false);
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
    if (embedded) setComposerOpen(true);
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

  const showComposer = !embedded || composerOpen || Boolean(editingRangeId);

  const composer = (
    <section className="app-modal-section custom-data-manager__composer">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="app-modal-section__title">
            {editingRangeId ? l.editRange : l.addNew}
          </h3>
          {!embedded ? (
            <p className="app-modal-section__desc">{l.checkedFirst}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={resetForm}
          className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
          aria-label={l.cancel}
        >
          {embedded ? <X size={16} /> : l.cancel}
        </button>
      </div>

      <div className="app-modal-fields">
        <MenuSelect
          label={l.parameterType}
          value={parameterType}
          heading={l.parameterType}
          variant="field"
          onChange={(next) => {
            setParameterType(next as "official" | "custom");
            setSelectedParameterId("");
            setUnitId("");
          }}
          options={[
            ["official", l.official],
            ["custom", l.custom],
          ]}
        />

        <MenuSelect
          label={l.parameter}
          value={selectedParameterId === "" ? "" : String(selectedParameterId)}
          heading={l.parameter}
          variant="field"
          placeholder={l.selectParameter}
          onChange={(next) => selectParameter(next ? Number(next) : "")}
          options={[
            { value: "", label: l.selectParameter },
            ...parameterOptions.map((parameter) => ({
              value: String(parameter.id),
              label: parameter.name,
            })),
          ]}
        />

        <MenuSelect
          label={l.cropScope}
          value={cropScope}
          heading={l.cropScope}
          variant="field"
          onChange={(next) =>
            selectCropScope(next as "general" | "current" | "specific")
          }
          options={[
            { value: "general", label: l.generalRange },
            {
              value: "current",
              label: l.currentCrop,
              disabled: !currentCropId,
            },
            { value: "specific", label: l.specificCrop },
          ]}
        />

        {cropScope === "specific" ? (
          <MenuSelect
            label={l.crop}
            value={selectedCropId === "" ? "" : String(selectedCropId)}
            heading={l.crop}
            variant="field"
            placeholder={l.selectCrop}
            onChange={(next) => setSelectedCropId(next ? Number(next) : "")}
            options={[
              { value: "", label: l.selectCrop },
              ...crops.map((crop) => ({
                value: String(crop.crop_id),
                label: crop.crop_name,
              })),
            ]}
          />
        ) : null}

        <MenuSelect
          label={l.unit}
          value={unitId === "" ? "" : String(unitId)}
          heading={l.unit}
          variant="field"
          placeholder={l.selectUnit || "Select unit"}
          onChange={(next) => setUnitId(next ? Number(next) : "")}
          options={[
            { value: "", label: l.selectUnit || "Select unit" },
            ...units.map((unit) => ({
              value: String(unit.unit_id),
              label: unit.unit_symbol,
            })),
          ]}
        />

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
            className={`calc-field-input ${embedded ? "min-h-16" : "min-h-24"}`}
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
        className="app-modal-btn app-modal-btn--primary mt-3 w-full sm:w-auto"
      >
        <PlusCircle size={18} />
        {saving ? l.saving : editingRangeId ? l.update : l.save}
      </button>
    </section>
  );

  const listSection = (
    <section className="app-modal-section">
      <div
        className={`app-modal-toolbar${
          embedded ? " app-modal-toolbar--actions-only" : ""
        }`}
      >
        {!embedded ? (
          <p className="app-modal-toolbar__meta">
            {visibleRanges.length} range(s)
          </p>
        ) : null}
        <div className="app-modal-toolbar__actions">
          <label className="app-modal-chip-toggle">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(event) => setShowDeleted(event.target.checked)}
            />
            {l.showDeleted}
          </label>
          {!embedded ? (
            <button
              type="button"
              onClick={loadInitialData}
              className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
            >
              <RefreshCw size={16} />
              {l.refresh}
            </button>
          ) : null}
          {embedded && !showComposer ? (
            <button
              type="button"
              onClick={() => {
                resetForm();
                setComposerOpen(true);
              }}
              className="app-modal-btn app-modal-btn--primary app-modal-btn--sm"
            >
              <PlusCircle size={16} />
              {l.addNew}
            </button>
          ) : null}
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
            const title = `${getRangeName(range)}${symbol ? ` (${symbol})` : ""}`;
            const band =
              `${range.min_value ?? "—"}–${range.max_value ?? "—"}${unit ? ` ${unit}` : ""}`.trim();
            const meta = [
              getRangeCropName(range),
              range.sample_type,
              band,
              range.is_deleted ? l.deletedStatus : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <article
                key={range.custom_range_id}
                className={`app-modal-list-item custom-data-row${
                  range.is_deleted ? " app-modal-list-item--deleted" : ""
                }`}
              >
                <div className="custom-data-row__main" title={`${title} · ${meta}`}>
                  <p className="custom-data-row__title truncate">{title}</p>
                  <p className="custom-data-row__meta truncate">{meta}</p>
                </div>
                <div className="custom-data-row__actions">
                  {!range.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => editRange(range)}
                      className="app-modal-btn app-modal-btn--secondary app-modal-btn--sm app-modal-btn--icon"
                      aria-label={l.editRange}
                      title={l.editRange}
                    >
                      <Edit3 size={15} />
                    </button>
                  ) : null}

                  {range.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => restoreRange(range)}
                      className="app-modal-btn app-modal-btn--primary app-modal-btn--sm app-modal-btn--icon"
                      aria-label={l.restore}
                      title={l.restore}
                    >
                      <RotateCcw size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => softDeleteRange(range)}
                      className="app-modal-btn app-modal-btn--danger app-modal-btn--sm app-modal-btn--icon"
                      aria-label={l.delete}
                      title={l.delete}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );

  const body = (
    <>
      {loading ? (
        <div className="app-modal-message app-modal-message--info">
          {l.loading}
        </div>
      ) : null}

      {message ? (
        <div className="app-modal-message app-modal-message--warn">
          {message}
        </div>
      ) : null}

      {embedded ? (
        <>
          {showComposer ? composer : null}
          {listSection}
        </>
      ) : (
        <>
          {composer}
          {listSection}
        </>
      )}
    </>
  );

  if (embedded) {
    return <div className="custom-data-manager">{body}</div>;
  }

  return (
    <AppModal
      open={open}
      onClose={closeModal}
      title={l.title}
      description={l.desc}
      size="xl"
      closeLabel={l.cancel}
    >
      {body}
    </AppModal>
  );
}


