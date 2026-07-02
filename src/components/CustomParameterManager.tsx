"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Edit3,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";

import AppModal from "@/components/AppModal";
import { supabase } from "@/lib/supabase";
import { Language } from "@/lib/translations";
import { customParameterManagerText } from "@/lib/i18n/componentText";

type Unit = {
  unit_id: number;
  unit_symbol: string;
};

type CustomParameter = {
  custom_parameter_id: number;
  parameter_name: string;
  symbol: string | null;
  category: string | null;
  sample_type: "soil" | "foliar";
  default_unit_id: number | null;
  created_at: string;
  updated_at: string | null;
  is_deleted: boolean | null;
  deleted_at: string | null;
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

type Props = {
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
  session: Session | null;
  language: Language;
  sampleType: "soil" | "foliar";
};


function getOne<T>(value: T | T[] | null): T | null {
  if (!value) return null;
  return Array.isArray(value) ? value[0] || null : value;
}

export default function CustomParameterManager({
  open,
  onClose,
  onChanged,
  session,
  language,
  sampleType,
}: Props) {
  const l = customParameterManagerText[language as keyof typeof customParameterManagerText] || customParameterManagerText.en;

  const [parameters, setParameters] = useState<CustomParameter[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  const [showDeleted, setShowDeleted] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [parameterName, setParameterName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [category, setCategory] = useState("Custom");
  const [unitId, setUnitId] = useState<number | "">("");

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const visibleParameters = useMemo(() => {
    return parameters.filter((parameter) =>
      showDeleted ? true : !parameter.is_deleted
    );
  }, [parameters, showDeleted]);

  useEffect(() => {
    if (!open) return;
    loadData();
    resetEditForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.user?.id, sampleType]);

  async function loadData() {
    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    setLoading(true);
    setMessage("");

    const [parametersResponse, unitsResponse] = await Promise.all([
      supabase
        .from("user_custom_parameters")
        .select(
          `
          custom_parameter_id,
          parameter_name,
          symbol,
          category,
          sample_type,
          default_unit_id,
          created_at,
          updated_at,
          is_deleted,
          deleted_at,
          units (
            unit_id,
            unit_symbol
          )
        `
        )
        .eq("user_id", session.user.id)
        .eq("sample_type", sampleType)
        .order("created_at", { ascending: false }),
      supabase.from("units").select("unit_id, unit_symbol").order("unit_symbol"),
    ]);

    setLoading(false);

    if (parametersResponse.error) {
      setMessage(parametersResponse.error.message);
      return;
    }

    if (unitsResponse.error) {
      setMessage(unitsResponse.error.message);
      return;
    }

    setParameters((parametersResponse.data || []) as CustomParameter[]);
    setUnits((unitsResponse.data || []) as Unit[]);
  }

  function resetEditForm() {
    setEditingId(null);
    setParameterName("");
    setSymbol("");
    setCategory("Custom");
    setUnitId("");
  }

  function closeModal() {
    resetEditForm();
    setMessage("");
    onClose();
  }

  function startEdit(parameter: CustomParameter) {
    const unit = getOne(parameter.units);

    setEditingId(parameter.custom_parameter_id);
    setParameterName(parameter.parameter_name || "");
    setSymbol(parameter.symbol || "");
    setCategory(parameter.category || "Custom");
    setUnitId(unit?.unit_id || parameter.default_unit_id || "");
    setMessage("");
  }

  async function saveEdit() {
    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    if (!editingId) return;

    if (!parameterName.trim() || !unitId) {
      setMessage(l.required);
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("user_custom_parameters")
      .update({
        parameter_name: parameterName.trim(),
        symbol: symbol.trim() || null,
        category: category.trim() || "Custom",
        default_unit_id: Number(unitId),
      })
      .eq("custom_parameter_id", editingId)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(l.updatedMessage);
    resetEditForm();
    await loadData();
    onChanged();
  }

  async function softDeleteParameter(parameter: CustomParameter) {
    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    const confirmed = window.confirm(
      `${l.delete}: ${parameter.parameter_name}?\n\n${l.usedWarning}`
    );

    if (!confirmed) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("user_custom_parameters")
      .update({
        is_deleted: true,
        deleted_at: new Date().toISOString(),
      })
      .eq("custom_parameter_id", parameter.custom_parameter_id)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (editingId === parameter.custom_parameter_id) {
      resetEditForm();
    }

    setMessage(l.deletedMessage);
    await loadData();
    onChanged();
  }

  async function restoreParameter(parameter: CustomParameter) {
    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("user_custom_parameters")
      .update({
        is_deleted: false,
        deleted_at: null,
      })
      .eq("custom_parameter_id", parameter.custom_parameter_id)
      .eq("user_id", session.user.id);

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage(l.restoredMessage);
    await loadData();
    onChanged();
  }

  function getUnitSymbol(parameter: CustomParameter) {
    const unit = getOne(parameter.units);
    return unit?.unit_symbol || "";
  }

  function formatDate(value: string | null) {
    if (!value) return "—";

    try {
      return new Date(value).toLocaleDateString();
    } catch {
      return value;
    }
  }

  if (!open) return null;

  return (
    <AppModal
      open={open}
      onClose={closeModal}
      title={l.title}
      description={l.desc}
      size="lg"
      closeLabel={l.cancel}
    >
      {loading ? (
        <div className="app-modal-message app-modal-message--info">
          {l.loading}
        </div>
      ) : null}

      {message ? (
        <div className="app-modal-message app-modal-message--warn mt-3">
          {message}
        </div>
      ) : null}

      {editingId ? (
        <section className="app-modal-section mt-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="app-modal-section__title">{l.edit}</h3>
              <p className="app-modal-section__desc">
                Changes will affect how this custom parameter appears in new
                analyses and in history.
              </p>
            </div>
            <button
              type="button"
              onClick={resetEditForm}
              className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
            >
              {l.cancel}
            </button>
          </div>

          <div className="app-modal-fields">
            <label className="app-modal-field app-modal-field--wide">
              <span className="app-modal-label">{l.name}</span>
              <input
                className="calc-field-input"
                value={parameterName}
                onChange={(event) => setParameterName(event.target.value)}
              />
            </label>

            <label className="app-modal-field">
              <span className="app-modal-label">{l.symbol}</span>
              <input
                className="calc-field-input"
                value={symbol}
                onChange={(event) => setSymbol(event.target.value)}
              />
            </label>

            <label className="app-modal-field">
              <span className="app-modal-label">{l.category}</span>
              <select
                className="app-native-select"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="Custom">Custom</option>
                <option value="Chemical">Chemical</option>
                <option value="Physical">Physical</option>
                <option value="Biological">Biological</option>
                <option value="Other">Other</option>
              </select>
            </label>

            <label className="app-modal-field app-modal-field--wide">
              <span className="app-modal-label">{l.unit}</span>
              <select
                className="app-native-select"
                value={unitId}
                onChange={(event) =>
                  setUnitId(event.target.value ? Number(event.target.value) : "")
                }
              >
                <option value="">Select unit</option>
                {units.map((unit) => (
                  <option key={unit.unit_id} value={unit.unit_id}>
                    {unit.unit_symbol}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={saveEdit}
            disabled={saving}
            className="app-modal-btn app-modal-btn--primary mt-4 w-full sm:w-auto"
          >
            <Save size={18} />
            {saving ? l.saving : l.save}
          </button>
        </section>
      ) : null}

      <section className="app-modal-section mt-3">
        <div className="app-modal-toolbar">
          <p className="app-modal-toolbar__meta">
            {visibleParameters.length} parameter(s)
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
              onClick={loadData}
              className="app-modal-btn app-modal-btn--ghost app-modal-btn--sm"
            >
              <RefreshCw size={16} />
              {l.refresh}
            </button>
          </div>
        </div>

        {visibleParameters.length === 0 ? (
          <div className="app-modal-message app-modal-message--warn">
            {l.noParameters}
          </div>
        ) : (
          <div className="app-modal-list">
            {visibleParameters.map((parameter) => (
              <article
                key={parameter.custom_parameter_id}
                className={`app-modal-list-item${
                  parameter.is_deleted ? " app-modal-list-item--deleted" : ""
                }`}
              >
                <div className="app-modal-list-item__head">
                  <h4 className="app-modal-list-item__title">
                    {parameter.parameter_name}
                    {parameter.symbol ? ` (${parameter.symbol})` : ""}
                  </h4>
                  <span className="app-modal-badge app-modal-badge--muted">
                    {parameter.category || "Custom"}
                  </span>
                  <span
                    className={`app-modal-badge ${
                      parameter.is_deleted
                        ? "app-modal-badge--deleted"
                        : "app-modal-badge--active"
                    }`}
                  >
                    {parameter.is_deleted ? l.deleted : l.active}
                  </span>
                </div>

                <div className="app-modal-list-item__meta">
                  <p>
                    <strong>{l.sampleType}:</strong> {parameter.sample_type}
                  </p>
                  <p>
                    <strong>{l.unit}:</strong> {getUnitSymbol(parameter)}
                  </p>
                  <p>
                    <strong>{l.created}:</strong>{" "}
                    {formatDate(parameter.created_at)}
                  </p>
                  <p>
                    <strong>{l.updated}:</strong>{" "}
                    {formatDate(parameter.updated_at)}
                  </p>
                </div>

                {parameter.is_deleted && parameter.deleted_at ? (
                  <p className="mt-2 text-xs text-red-700">
                    Deleted: {formatDate(parameter.deleted_at)}
                  </p>
                ) : null}

                <div className="app-modal-list-item__actions">
                  {!parameter.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => startEdit(parameter)}
                      className="app-modal-btn app-modal-btn--secondary app-modal-btn--sm"
                    >
                      <Edit3 size={15} />
                      {l.edit}
                    </button>
                  ) : null}

                  {parameter.is_deleted ? (
                    <button
                      type="button"
                      onClick={() => restoreParameter(parameter)}
                      disabled={saving}
                      className="app-modal-btn app-modal-btn--primary app-modal-btn--sm"
                    >
                      <RotateCcw size={15} />
                      {l.restore}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => softDeleteParameter(parameter)}
                      disabled={saving}
                      className="app-modal-btn app-modal-btn--danger app-modal-btn--sm"
                    >
                      <Trash2 size={15} />
                      {l.delete}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </AppModal>
  );
}


