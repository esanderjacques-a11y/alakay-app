"use client";

import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Edit3,
  RefreshCw,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react";

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
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <div className="glass-modal-shell max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl p-6">
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

        {message && (
          <div className="mt-5 rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900">
            {message}
          </div>
        )}

        {editingId && (
          <section className="mt-6 rounded-3xl border border-green-200 bg-green-50 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-bold text-green-900">
                  {l.edit}
                </h3>
                <p className="mt-1 text-sm text-green-900">
                  Changes will affect how this custom parameter appears in new
                  analyses and in history.
                </p>
              </div>

              <button
                type="button"
                onClick={resetEditForm}
                className="rounded-2xl border border-green-200 bg-white px-4 py-2 text-sm font-semibold text-green-800 hover:bg-green-50"
              >
                {l.cancel}
              </button>
            </div>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <label className="grid gap-1 md:col-span-2">
                <span className="text-sm font-semibold text-slate-700">
                  {l.name}
                </span>
                <input
                  className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                  value={parameterName}
                  onChange={(event) => setParameterName(event.target.value)}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold text-slate-700">
                  {l.symbol}
                </span>
                <input
                  className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                />
              </label>

              <label className="grid gap-1">
                <span className="text-sm font-semibold text-slate-700">
                  {l.category}
                </span>
                <select
                  className="rounded-2xl border border-slate-200 bg-white p-3 outline-none focus:border-green-600"
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

              <label className="grid gap-1 md:col-span-2">
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
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60 md:w-auto"
            >
              <Save size={18} />
              {saving ? l.saving : l.save}
            </button>
          </section>
        )}

        <section className="mt-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-bold text-green-900">{l.title}</h3>
              <p className="mt-1 text-sm text-slate-600">
                {visibleParameters.length} parameter(s)
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
                onClick={loadData}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 px-4 py-3 text-sm font-semibold text-green-800 hover:bg-green-50"
              >
                <RefreshCw size={16} />
                {l.refresh}
              </button>
            </div>
          </div>

          {visibleParameters.length === 0 && (
            <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-yellow-900">
              {l.noParameters}
            </div>
          )}

          <div className="mt-4 grid gap-3">
            {visibleParameters.map((parameter) => (
              <div
                key={parameter.custom_parameter_id}
                className={`rounded-2xl border p-4 ${
                  parameter.is_deleted
                    ? "border-red-200 bg-red-50"
                    : "border-slate-200 bg-white"
                }`}
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-slate-900">
                        {parameter.parameter_name}
                        {parameter.symbol ? ` (${parameter.symbol})` : ""}
                      </h4>

                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                        {parameter.category || "Custom"}
                      </span>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-bold ${
                          parameter.is_deleted
                            ? "bg-red-100 text-red-700"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {parameter.is_deleted ? l.deleted : l.active}
                      </span>
                    </div>

                    <div className="mt-2 grid gap-1 text-sm text-slate-600 md:grid-cols-2">
                      <p>
                        <strong>{l.sampleType}:</strong>{" "}
                        {parameter.sample_type}
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

                    {parameter.is_deleted && parameter.deleted_at && (
                      <p className="mt-2 text-xs text-red-700">
                        Deleted: {formatDate(parameter.deleted_at)}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {!parameter.is_deleted && (
                      <button
                        type="button"
                        onClick={() => startEdit(parameter)}
                        className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Edit3 size={15} />
                        {l.edit}
                      </button>
                    )}

                    {parameter.is_deleted ? (
                      <button
                        type="button"
                        onClick={() => restoreParameter(parameter)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-2xl bg-green-700 px-3 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:opacity-60"
                      >
                        <RotateCcw size={15} />
                        {l.restore}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => softDeleteParameter(parameter)}
                        disabled={saving}
                        className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                      >
                        <Trash2 size={15} />
                        {l.delete}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


