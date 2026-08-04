"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Edit3, PlusCircle, RefreshCw, RotateCcw, Trash2, X } from "lucide-react";

import AppModal from "@/components/AppModal";
import MenuSelect from "@/components/ui/MenuSelect";
import {
  cicOverridesToRows,
  emptyCicPlantillaRows,
  fetchCustomRangeSets,
  getParameterBoundMode,
  parseOptionalNumber,
  rowHasValues,
  rowsToCicOverrides,
  setActiveRangeSetId,
  type CicPlantillaRow,
  type CustomRangeSet,
  type PlantillaRowDraft,
} from "@/lib/customRangePlantilla";
import { supabase } from "@/lib/supabase";
import { Language } from "@/lib/translations";
import { customRangeManagerText } from "@/lib/i18n/componentText";

type Crop = {
  crop_id: number;
  crop_name: string;
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
  sample_type: "soil" | "foliar" | "water";
  unit_id: number | null;
  min_value: number | null;
  max_value: number | null;
  interpretation_note: string | null;
  source_name: string | null;
  range_set_id: number | null;
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
  sampleType: "soil" | "foliar" | "water";
  currentCropId: number | "";
  /** Render inline (no modal) for the custom-data portal. */
  embedded?: boolean;
};

function getOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

function formatFilledCount(template: string, count: number) {
  return template.replace("{count}", String(count));
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
  const l =
    customRangeManagerText[language as keyof typeof customRangeManagerText] ||
    customRangeManagerText.en;

  const [crops, setCrops] = useState<Crop[]>([]);
  const [officialParameters, setOfficialParameters] = useState<OfficialParameter[]>(
    []
  );
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [ranges, setRanges] = useState<CustomRange[]>([]);
  const [sets, setSets] = useState<CustomRangeSet[]>([]);

  const [plantillaName, setPlantillaName] = useState("");
  const [cropScope, setCropScope] = useState<"general" | "current" | "specific">(
    currentCropId ? "current" : "general"
  );
  const [selectedCropId, setSelectedCropId] = useState<number | "">(
    currentCropId || ""
  );
  const [rows, setRows] = useState<PlantillaRowDraft[]>([]);
  const [cicRows, setCicRows] = useState<CicPlantillaRow[]>(() =>
    emptyCicPlantillaRows(language)
  );
  const [editingSetId, setEditingSetId] = useState<number | null>(null);

  const [showDeleted, setShowDeleted] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const filledCount = useMemo(
    () => rows.filter((row) => rowHasValues(row.min, row.max)).length,
    [rows]
  );

  const visibleSets = useMemo(
    () => sets.filter((set) => (showDeleted ? true : !set.is_deleted)),
    [sets, showDeleted]
  );

  const orphanRanges = useMemo(
    () =>
      ranges.filter(
        (range) =>
          !range.range_set_id && (showDeleted ? true : !range.is_deleted)
      ),
    [ranges, showDeleted]
  );

  useEffect(() => {
    if (!open) return;

    queueMicrotask(() => {
      setCropScope(currentCropId ? "current" : "general");
      setSelectedCropId(currentCropId || "");
    });
    void loadInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sampleType, session?.user?.id]);

  function buildEmptyRows(
    official: OfficialParameter[],
    custom: CustomParameter[]
  ): PlantillaRowDraft[] {
    const officialRows: PlantillaRowDraft[] = official.map((parameter) => {
      const unit = getOne(parameter.units);
      return {
        key: `official-${parameter.parameter_id}`,
        kind: "official",
        parameterId: parameter.parameter_id,
        name: parameter.parameter_name,
        symbol: parameter.symbol,
        unitId: unit?.unit_id || parameter.default_unit_id || null,
        unitSymbol: unit?.unit_symbol || "",
        boundMode: getParameterBoundMode({
          parameter_name: parameter.parameter_name,
          symbol: parameter.symbol,
          category: parameter.category,
        }),
        min: "",
        max: "",
        existingRangeId: null,
      };
    });

    const customRows: PlantillaRowDraft[] = custom.map((parameter) => {
      const unit = getOne(parameter.units);
      return {
        key: `custom-${parameter.custom_parameter_id}`,
        kind: "custom",
        parameterId: parameter.custom_parameter_id,
        name: parameter.parameter_name,
        symbol: parameter.symbol,
        unitId: unit?.unit_id || parameter.default_unit_id || null,
        unitSymbol: unit?.unit_symbol || "",
        boundMode: getParameterBoundMode({
          parameter_name: parameter.parameter_name,
          symbol: parameter.symbol,
          category: parameter.category,
        }),
        min: "",
        max: "",
        existingRangeId: null,
      };
    });

    return [...officialRows, ...customRows].sort((a, b) =>
      a.name.localeCompare(b.name)
    );
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
      officialResponse,
      customResponse,
      rangesResponse,
      setsResponse,
    ] = await Promise.all([
      supabase.from("crops").select("crop_id, crop_name").order("crop_name"),
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
          range_set_id,
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
      fetchCustomRangeSets(supabase, session.user.id, sampleType, true).catch(
        () => [] as CustomRangeSet[]
      ),
    ]);

    setLoading(false);

    const firstError =
      cropsResponse.error ||
      officialResponse.error ||
      customResponse.error ||
      rangesResponse.error;

    if (firstError) {
      setMessage(firstError.message);
      return;
    }

    const nextOfficial = (officialResponse.data || []) as OfficialParameter[];
    const nextCustom = (customResponse.data || []) as CustomParameter[];

    setCrops((cropsResponse.data || []) as Crop[]);
    setOfficialParameters(nextOfficial);
    setCustomParameters(nextCustom);
    setRanges((rangesResponse.data || []) as CustomRange[]);
    setSets(setsResponse);

    if (!editingSetId && !composerOpen) {
      setRows(buildEmptyRows(nextOfficial, nextCustom));
      setCicRows(emptyCicPlantillaRows(language));
    }
  }

  function resetForm() {
    setPlantillaName("");
    setCropScope(currentCropId ? "current" : "general");
    setSelectedCropId(currentCropId || "");
    setRows(buildEmptyRows(officialParameters, customParameters));
    setCicRows(emptyCicPlantillaRows(language));
    setEditingSetId(null);
    if (embedded) setComposerOpen(false);
    setMessage("");
  }

  function closeModal() {
    resetForm();
    onClose();
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

  function updateRow(key: string, field: "min" | "max", value: string) {
    setRows((previous) =>
      previous.map((row) => {
        if (row.key !== key) return row;
        if (row.boundMode === "max_only" && field === "min") return row;
        if (row.boundMode === "min_only" && field === "max") return row;
        return { ...row, [field]: value };
      })
    );
  }

  function updateCicRow(key: CicPlantillaRow["key"], field: "min" | "max", value: string) {
    setCicRows((previous) =>
      previous.map((row) => (row.key === key ? { ...row, [field]: value } : row))
    );
  }

  function editSet(set: CustomRangeSet) {
    const memberRanges = ranges.filter(
      (range) => range.range_set_id === set.range_set_id && !range.is_deleted
    );
    const nextRows = buildEmptyRows(officialParameters, customParameters).map(
      (row) => {
        const match = memberRanges.find((range) =>
          row.kind === "official"
            ? range.parameter_id === row.parameterId
            : range.custom_parameter_id === row.parameterId
        );
        if (!match) return row;
        return {
          ...row,
          min: match.min_value === null ? "" : String(match.min_value),
          max: match.max_value === null ? "" : String(match.max_value),
          unitId: match.unit_id || row.unitId,
          existingRangeId: match.custom_range_id,
        };
      }
    );

    setEditingSetId(set.range_set_id);
    setPlantillaName(set.name);
    setCicRows(cicOverridesToRows(set.cic_overrides, language));

    if (set.crop_id === null) {
      setCropScope("general");
      setSelectedCropId("");
    } else if (currentCropId && set.crop_id === currentCropId) {
      setCropScope("current");
      setSelectedCropId(currentCropId);
    } else {
      setCropScope("specific");
      setSelectedCropId(set.crop_id);
    }

    setRows(nextRows);
    setMessage("");
    if (embedded) setComposerOpen(true);
  }

  async function savePlantilla() {
    setMessage("");

    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    const name = plantillaName.trim();
    if (!name) {
      setMessage(l.nameRequired);
      return;
    }

    if (cropScope === "specific" && !selectedCropId) {
      setMessage(l.selectCrop);
      return;
    }

    const filled = rows.filter((row) => rowHasValues(row.min, row.max));
    if (filled.length === 0) {
      setMessage(l.required);
      return;
    }

    for (const row of filled) {
      const min =
        row.boundMode === "max_only" ? null : parseOptionalNumber(row.min);
      const max =
        row.boundMode === "min_only" ? null : parseOptionalNumber(row.max);
      if (Number.isNaN(min as number) || Number.isNaN(max as number)) {
        setMessage(l.invalidNumber);
        return;
      }
      if (min === null && max === null) {
        setMessage(l.required);
        return;
      }
    }

    const cropIdToSave =
      cropScope === "general" ? null : selectedCropId ? selectedCropId : null;
    const cicOverrides = rowsToCicOverrides(cicRows);

    setSaving(true);

    let rangeSetId = editingSetId;

    if (editingSetId) {
      const { error } = await supabase
        .from("user_custom_range_sets")
        .update({
          name,
          crop_id: cropIdToSave,
          cic_overrides: cicOverrides,
          sample_type: sampleType,
          is_deleted: false,
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("range_set_id", editingSetId)
        .eq("user_id", session.user.id);

      if (error) {
        setSaving(false);
        setMessage(error.message);
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("user_custom_range_sets")
        .insert({
          user_id: session.user.id,
          name,
          sample_type: sampleType,
          crop_id: cropIdToSave,
          cic_overrides: cicOverrides,
          is_deleted: false,
        })
        .select("range_set_id")
        .single();

      if (error) {
        setSaving(false);
        setMessage(
          error.message.includes("user_custom_range_sets")
            ? `${error.message} (Apply migration user_custom_range_sets.)`
            : error.message
        );
        return;
      }

      rangeSetId = data.range_set_id as number;
    }

    if (!rangeSetId) {
      setSaving(false);
      setMessage(l.required);
      return;
    }

    const keepIds = new Set<number>();
    const toInsert: Record<string, unknown>[] = [];

    for (const row of filled) {
      const min =
        row.boundMode === "max_only" ? null : parseOptionalNumber(row.min);
      const max =
        row.boundMode === "min_only" ? null : parseOptionalNumber(row.max);
      const payload = {
        user_id: session.user.id,
        parameter_id: row.kind === "official" ? row.parameterId : null,
        custom_parameter_id: row.kind === "custom" ? row.parameterId : null,
        crop_id: cropIdToSave,
        sample_type: sampleType,
        unit_id: row.unitId,
        min_value: min,
        max_value: max,
        interpretation_note: null,
        source_name: name,
        range_set_id: rangeSetId,
        is_deleted: false,
        deleted_at: null,
      };

      if (row.existingRangeId) {
        keepIds.add(row.existingRangeId);
        const { error: updateError } = await supabase
          .from("user_custom_ranges")
          .update(payload)
          .eq("custom_range_id", row.existingRangeId)
          .eq("user_id", session.user.id);
        if (updateError) {
          setSaving(false);
          setMessage(updateError.message);
          return;
        }
      } else {
        toInsert.push(payload);
      }
    }

    if (toInsert.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from("user_custom_ranges")
        .insert(toInsert)
        .select("custom_range_id");

      if (insertError) {
        setSaving(false);
        setMessage(insertError.message);
        return;
      }

      for (const row of inserted || []) {
        keepIds.add(row.custom_range_id as number);
      }
    }

    const filledKeys = new Set(
      filled.map((row) =>
        row.kind === "official"
          ? `o:${row.parameterId}`
          : `c:${row.parameterId}`
      )
    );

    const staleMembers = ranges.filter((range) => {
      if (range.range_set_id !== rangeSetId || range.is_deleted) return false;
      if (keepIds.has(range.custom_range_id)) return false;
      const key = range.parameter_id
        ? `o:${range.parameter_id}`
        : range.custom_parameter_id
          ? `c:${range.custom_parameter_id}`
          : null;
      return !key || !filledKeys.has(key);
    });

    if (staleMembers.length > 0) {
      await supabase
        .from("user_custom_ranges")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .in(
          "custom_range_id",
          staleMembers.map((range) => range.custom_range_id)
        )
        .eq("user_id", session.user.id);
    }

    setActiveRangeSetId(rangeSetId);
    setSaving(false);
    setMessage(editingSetId ? l.updated : l.saved);
    resetForm();
    await loadInitialData();
    onChanged();
  }

  async function softDeleteSet(set: CustomRangeSet) {
    if (!session?.user) return;

    const confirmed = window.confirm(`Delete plantilla "${set.name}"?`);
    if (!confirmed) return;

    setSaving(true);

    const { error } = await supabase
      .from("user_custom_range_sets")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("range_set_id", set.range_set_id)
      .eq("user_id", session.user.id);

    if (!error) {
      await supabase
        .from("user_custom_ranges")
        .update({
          is_deleted: true,
          deleted_at: new Date().toISOString(),
        })
        .eq("range_set_id", set.range_set_id)
        .eq("user_id", session.user.id);
    }

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(l.deleted);
    await loadInitialData();
    onChanged();
  }

  async function restoreSet(set: CustomRangeSet) {
    if (!session?.user) return;

    setSaving(true);

    const { error } = await supabase
      .from("user_custom_range_sets")
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq("range_set_id", set.range_set_id)
      .eq("user_id", session.user.id);

    if (!error) {
      await supabase
        .from("user_custom_ranges")
        .update({
          is_deleted: false,
          deleted_at: null,
        })
        .eq("range_set_id", set.range_set_id)
        .eq("user_id", session.user.id);
    }

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

  const showComposer = !embedded || composerOpen || Boolean(editingSetId);

  const composer = (
    <section className="app-modal-section custom-data-manager__composer">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="app-modal-section__title">
            {editingSetId ? l.editRange : l.addNew}
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
        <label className="app-modal-field app-modal-field--wide">
          <span className="app-modal-label">{l.plantillaName}</span>
          <input
            className="calc-field-input"
            value={plantillaName}
            onChange={(event) => setPlantillaName(event.target.value)}
            placeholder={l.plantillaNamePlaceholder}
          />
        </label>

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
      </div>

      <div className="plantilla-legend" role="note">
        <p className="plantilla-legend__title">{l.legendTitle}</p>
        <p className="plantilla-legend__line">{l.legendBoth}</p>
        <p className="plantilla-legend__line">{l.legendMaxOnly}</p>
        <p className="plantilla-legend__line">{l.legendMinOnly}</p>
      </div>

      <p className="plantilla-filled-meta">
        {formatFilledCount(l.filledCount, filledCount)}
      </p>

      <div className="plantilla-grid" role="table" aria-label={l.parameter}>
        <div className="plantilla-grid__head" role="row">
          <span role="columnheader">{l.parameter}</span>
          <span role="columnheader">{l.min}</span>
          <span role="columnheader">{l.max}</span>
        </div>
        {rows.map((row) => {
          const label = `${row.name}${row.symbol ? ` (${row.symbol})` : ""}${
            row.unitSymbol ? ` · ${row.unitSymbol}` : ""
          }`;
          const hint =
            row.boundMode === "max_only"
              ? l.maxOnlyHint
              : row.boundMode === "min_only"
                ? l.minOnlyHint
                : "";

          return (
            <div key={row.key} className="plantilla-grid__row" role="row">
              <div className="plantilla-grid__param" role="cell">
                <span className="plantilla-grid__name">{label}</span>
                {hint ? (
                  <span className="plantilla-grid__hint">{hint}</span>
                ) : null}
              </div>
              <label className="plantilla-grid__cell" role="cell">
                <span className="sr-only">{l.min}</span>
                <input
                  type="number"
                  step="any"
                  className="calc-field-input"
                  value={row.min}
                  disabled={row.boundMode === "max_only"}
                  onChange={(event) =>
                    updateRow(row.key, "min", event.target.value)
                  }
                />
              </label>
              <label className="plantilla-grid__cell" role="cell">
                <span className="sr-only">{l.max}</span>
                <input
                  type="number"
                  step="any"
                  className="calc-field-input"
                  value={row.max}
                  disabled={row.boundMode === "min_only"}
                  onChange={(event) =>
                    updateRow(row.key, "max", event.target.value)
                  }
                />
              </label>
            </div>
          );
        })}
      </div>

      {sampleType === "soil" ? (
        <div className="plantilla-cic">
          <h4 className="app-modal-section__title">{l.cicSection}</h4>
          <p className="app-modal-section__desc">{l.cicSectionDesc}</p>
          <div className="plantilla-grid" role="table" aria-label={l.cicSection}>
            <div className="plantilla-grid__head" role="row">
              <span role="columnheader">{l.parameter}</span>
              <span role="columnheader">{l.min}</span>
              <span role="columnheader">{l.max}</span>
            </div>
            {cicRows.map((row) => (
              <div key={row.key} className="plantilla-grid__row" role="row">
                <div className="plantilla-grid__param" role="cell">
                  <span className="plantilla-grid__name">
                    {row.label}
                    {row.unit ? ` (${row.unit})` : ""}
                  </span>
                </div>
                <label className="plantilla-grid__cell" role="cell">
                  <span className="sr-only">{l.min}</span>
                  <input
                    type="number"
                    step="any"
                    className="calc-field-input"
                    value={row.min}
                    onChange={(event) =>
                      updateCicRow(row.key, "min", event.target.value)
                    }
                  />
                </label>
                <label className="plantilla-grid__cell" role="cell">
                  <span className="sr-only">{l.max}</span>
                  <input
                    type="number"
                    step="any"
                    className="calc-field-input"
                    value={row.max}
                    onChange={(event) =>
                      updateCicRow(row.key, "max", event.target.value)
                    }
                  />
                </label>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => void savePlantilla()}
        disabled={saving}
        className="app-modal-btn app-modal-btn--primary mt-3 w-full sm:w-auto"
      >
        <PlusCircle size={18} />
        {saving ? l.saving : editingSetId ? l.update : l.save}
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
            {visibleSets.length} plantilla(s)
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
              onClick={() => void loadInitialData()}
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

      {visibleSets.length === 0 ? (
        <div className="app-modal-message app-modal-message--warn">
          {l.noRanges}
        </div>
      ) : (
        <div className="app-modal-list">
          {visibleSets.map((set) => {
            const memberCount = ranges.filter(
              (range) =>
                range.range_set_id === set.range_set_id && !range.is_deleted
            ).length;
            const cropName =
              set.crop_id == null
                ? l.generalRange
                : crops.find((crop) => crop.crop_id === set.crop_id)?.crop_name ||
                  l.specificCrop;
            const meta = [
              cropName,
              set.sample_type,
              formatFilledCount(l.filledCount, memberCount),
              set.is_deleted ? l.deletedStatus : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <article
                key={set.range_set_id}
                className={`app-modal-list-item custom-data-row${
                  set.is_deleted ? " app-modal-list-item--deleted" : ""
                }`}
              >
                <div
                  className="custom-data-row__main"
                  title={`${set.name} · ${meta}`}
                >
                  <p className="custom-data-row__title truncate">{set.name}</p>
                  <p className="custom-data-row__meta truncate">{meta}</p>
                </div>
                <div className="custom-data-row__actions">
                  {!set.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => editSet(set)}
                      className="app-modal-btn app-modal-btn--secondary app-modal-btn--sm app-modal-btn--icon"
                      aria-label={l.editRange}
                      title={l.editRange}
                    >
                      <Edit3 size={15} />
                    </button>
                  ) : null}

                  {set.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => void restoreSet(set)}
                      className="app-modal-btn app-modal-btn--primary app-modal-btn--sm app-modal-btn--icon"
                      aria-label={l.restore}
                      title={l.restore}
                    >
                      <RotateCcw size={15} />
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void softDeleteSet(set)}
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

      {orphanRanges.length > 0 ? (
        <div className="plantilla-orphans">
          <p className="app-modal-section__title">{l.orphanRanges}</p>
          <div className="app-modal-list">
            {orphanRanges.map((range) => {
              const official = getOne(range.parameters);
              const custom = getOne(range.user_custom_parameters);
              const title =
                custom?.parameter_name ||
                official?.parameter_name ||
                "Parameter";
              const band = `${range.min_value ?? "—"}–${range.max_value ?? "—"}`;
              return (
                <article
                  key={range.custom_range_id}
                  className="app-modal-list-item custom-data-row"
                >
                  <div className="custom-data-row__main">
                    <p className="custom-data-row__title truncate">{title}</p>
                    <p className="custom-data-row__meta truncate">
                      {range.source_name || l.generalRange} · {band}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ) : null}
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
