"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { X, PlusCircle } from "lucide-react";

import { supabase } from "@/lib/supabase";
import { Language, translations } from "@/lib/translations";

type Unit = {
  unit_id: number;
  unit_symbol: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  session: Session | null;
  language: Language;
  sampleType: "soil" | "foliar";
  cropId: number | "";
};

export default function CustomParameterModal({
  open,
  onClose,
  onCreated,
  session,
  language,
  sampleType,
  cropId,
}: Props) {
  const appText = translations[language];
  const l = appText.customParameterModal;

  const [units, setUnits] = useState<Unit[]>([]);
  const [parameterName, setParameterName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [category, setCategory] = useState("Custom");
  const [unitId, setUnitId] = useState<number | "">("");
  const [minValue, setMinValue] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [note, setNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function loadUnits() {
    const { data, error } = await supabase
      .from("units")
      .select("unit_id, unit_symbol")
      .order("unit_symbol");

    if (error) {
      setMessage(error.message);
      return;
    }

    setUnits((data || []) as Unit[]);
  }

  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        void loadUnits();
      });
    }
  }, [open]);

  function resetForm() {
    setParameterName("");
    setSymbol("");
    setCategory("Custom");
    setUnitId("");
    setMinValue("");
    setMaxValue("");
    setNote("");
    setMessage("");
  }

  async function saveCustomParameter() {
    setMessage("");

    if (!session?.user) {
      setMessage(l.login);
      return;
    }

    if (!parameterName.trim() || !unitId) {
      setMessage(l.required);
      return;
    }

    setSaving(true);

    const { data: parameterData, error: parameterError } = await supabase
      .from("user_custom_parameters")
      .insert({
        user_id: session.user.id,
        parameter_name: parameterName.trim(),
        symbol: symbol.trim() || null,
        category: category.trim() || "Custom",
        sample_type: sampleType,
        default_unit_id: unitId,
        is_deleted: false,
      })
      .select("custom_parameter_id")
      .single();

    if (parameterError) {
      setSaving(false);
      setMessage(parameterError.message);
      return;
    }

    const hasRange = minValue.trim() !== "" || maxValue.trim() !== "";

    if (hasRange) {
      const parsedMin =
        minValue.trim() === "" ? null : Number(minValue.trim());
      const parsedMax =
        maxValue.trim() === "" ? null : Number(maxValue.trim());

      if (
        (parsedMin !== null && Number.isNaN(parsedMin)) ||
        (parsedMax !== null && Number.isNaN(parsedMax))
      ) {
        setSaving(false);
        setMessage(l.invalidRange);
        return;
      }

      const { error: rangeError } = await supabase
        .from("user_custom_ranges")
        .insert({
          user_id: session.user.id,
          custom_parameter_id: parameterData.custom_parameter_id,
          parameter_id: null,
          crop_id: cropId || null,
          sample_type: sampleType,
          unit_id: unitId,
          min_value: parsedMin,
          max_value: parsedMax,
          interpretation_note: note.trim() || null,
          source_name: appText.userCustomRange,
          is_deleted: false,
        });

      if (rangeError) {
        setSaving(false);
        setMessage(rangeError.message);
        return;
      }
    }

    setSaving(false);
    setMessage(l.success);
    resetForm();
    onCreated();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[20000] flex items-center justify-center bg-slate-950/35 px-4 backdrop-blur-md">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-green-900">{l.title}</h2>
            <p className="mt-1 text-sm text-slate-600">{l.desc}</p>
          </div>

          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            className="rounded-2xl border border-slate-200 p-2 text-slate-600 hover:bg-slate-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              {l.name}
            </span>
            <input
              className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
              value={parameterName}
              onChange={(event) => setParameterName(event.target.value)}
              placeholder={l.parameterPlaceholder}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">
              {l.symbol}
            </span>
            <input
              className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
              value={symbol}
              onChange={(event) => setSymbol(event.target.value)}
              placeholder={l.symbolPlaceholder}
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
              <option value="Custom">{appText.categoryCustom}</option>
              <option value="Chemical">{l.chemical}</option>
              <option value="Physical">{l.physical}</option>
              <option value="Biological">{l.biological}</option>
              <option value="Other">{appText.categoryOther}</option>
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
              <option value="">{l.selectUnit}</option>
              {units.map((unit) => (
                <option key={unit.unit_id} value={unit.unit_id}>
                  {unit.unit_symbol}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 rounded-2xl bg-green-50 p-4 text-sm text-green-900">
          {l.rangeInfo}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-sm font-semibold text-slate-700">
              {l.min}
            </span>
            <input
              type="number"
              step="any"
              className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
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
              className="rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
              value={maxValue}
              onChange={(event) => setMaxValue(event.target.value)}
            />
          </label>

          <label className="grid gap-1 md:col-span-2">
            <span className="text-sm font-semibold text-slate-700">
              {l.note}
            </span>
            <textarea
              className="min-h-24 rounded-2xl border border-slate-200 p-3 outline-none focus:border-green-600"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={l.notePlaceholder}
            />
          </label>
        </div>

        {message && (
          <div className="mt-5 rounded-2xl bg-yellow-50 p-4 text-sm text-yellow-900">
            {message}
          </div>
        )}

        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={saving}
            className="rounded-2xl border border-slate-200 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {l.cancel}
          </button>

          <button
            type="button"
            onClick={saveCustomParameter}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-700 px-5 py-3 font-semibold text-white hover:bg-green-800 disabled:opacity-60"
          >
            <PlusCircle size={18} />
            {saving ? l.saving : l.save}
          </button>
        </div>
      </div>
    </div>
  );
}

