"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { PlusCircle } from "lucide-react";

import AppModal from "@/components/AppModal";
import MenuSelect from "@/components/ui/MenuSelect";
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
  importDraft?: {
    parameterName?: string;
    unitSymbol?: string;
    applySodiumTropicalPreset?: boolean;
  } | null;
};

export default function CustomParameterModal({
  open,
  onClose,
  onCreated,
  session,
  language,
  sampleType,
  cropId,
  importDraft,
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

  function normalize(value: string) {
    return value.toLowerCase().replace(/\s+/g, "").trim();
  }

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

  useEffect(() => {
    if (!open || !importDraft) return;

    if (importDraft.parameterName?.trim()) {
      setParameterName(importDraft.parameterName.trim());
    }

    if (!importDraft.unitSymbol?.trim() || units.length === 0) return;

    const normalizedDraftUnit = normalize(importDraft.unitSymbol);
    const matchedUnit = units.find(
      (unit) =>
        normalize(unit.unit_symbol) === normalizedDraftUnit ||
        normalizedDraftUnit.includes(normalize(unit.unit_symbol))
    );

    if (matchedUnit) {
      setUnitId(matchedUnit.unit_id);
    }

    if (importDraft.applySodiumTropicalPreset) {
      setSymbol((previous) => previous || "Na");
      setMinValue((previous) => previous || "0");
      setMaxValue((previous) => previous || "0.5");
      setNote(
        (previous) =>
          previous ||
          "Global sodium thresholds: safe <0.5, slightly elevated 0.5-1.0, sodic >1.0, highly sodic >2.0 (cmol(+)/kg)"
      );
    }
  }, [open, importDraft, units]);

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

    let parsedMin = minValue.trim() === "" ? null : Number(minValue.trim());
    let parsedMax = maxValue.trim() === "" ? null : Number(maxValue.trim());
    let rangeNote = note.trim() || null;
    let hasRange = minValue.trim() !== "" || maxValue.trim() !== "";

    const normalizedName = parameterName.toLowerCase();
    const looksLikeSodium =
      /\b(sodio|sodium|na)\b/.test(normalizedName) &&
      !/\b(nitrato|nitrate|nitrogen|nitrogeno)\b/.test(normalizedName);
    const useGlobalSodiumPreset =
      Boolean(importDraft?.applySodiumTropicalPreset) && looksLikeSodium;

    if (!hasRange && useGlobalSodiumPreset) {
      parsedMin = 0;
      parsedMax = 0.5;
      rangeNote =
        "Global sodium thresholds: safe <0.5, slightly elevated 0.5-1.0, sodic >1.0, highly sodic >2.0 (cmol(+)/kg)";
      hasRange = true;
    } else if (!hasRange && looksLikeSodium) {
      const applyPreset = window.confirm(
        "Apply sodium thresholds preset (safe <0.5, slightly elevated 0.5-1.0, sodic >1.0, highly sodic >2.0 cmol(+)/kg)?"
      );
      if (applyPreset) {
        parsedMin = 0;
        parsedMax = 0.5;
        rangeNote =
          "Global sodium thresholds: safe <0.5, slightly elevated 0.5-1.0, sodic >1.0, highly sodic >2.0 (cmol(+)/kg)";
        hasRange = true;
      }
    }

    if (hasRange) {
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
          crop_id: useGlobalSodiumPreset ? null : cropId || null,
          sample_type: sampleType,
          unit_id: unitId,
          min_value: parsedMin,
          max_value: parsedMax,
          interpretation_note: rangeNote,
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
    <AppModal
      open={open}
      onClose={() => {
        resetForm();
        onClose();
      }}
      title={l.title}
      description={l.desc}
      closeLabel={l.cancel}
      footer={
        <>
          <button
            type="button"
            onClick={() => {
              resetForm();
              onClose();
            }}
            disabled={saving}
            className="app-modal-btn app-modal-btn--secondary"
          >
            {l.cancel}
          </button>
          <button
            type="button"
            onClick={saveCustomParameter}
            disabled={saving}
            className="app-modal-btn app-modal-btn--primary"
          >
            <PlusCircle size={18} aria-hidden />
            {saving ? l.saving : l.save}
          </button>
        </>
      }
    >
      <form
        className="app-modal-form"
        onSubmit={(event) => {
          event.preventDefault();
          void saveCustomParameter();
        }}
      >
        <section className="app-modal-section">
          <h3 className="app-modal-section__title">{l.identitySection}</h3>
          <div className="app-modal-fields app-modal-fields--flush">
            <label className="app-modal-field app-modal-field--wide">
              <span className="app-modal-label">{l.name}</span>
              <input
                className="calc-field-input"
                value={parameterName}
                onChange={(event) => setParameterName(event.target.value)}
                placeholder={l.parameterPlaceholder}
                autoComplete="off"
              />
            </label>

            <div className="app-modal-field-pair app-modal-field--wide">
              <label className="app-modal-field">
                <span className="app-modal-label">{l.symbol}</span>
                <input
                  className="calc-field-input"
                  value={symbol}
                  onChange={(event) => setSymbol(event.target.value)}
                  placeholder={l.symbolPlaceholder}
                  autoComplete="off"
                />
              </label>

              <MenuSelect
                label={l.category}
                value={category}
                heading={l.category}
                variant="field"
                onChange={setCategory}
                options={[
                  ["Custom", appText.categoryCustom],
                  ["Chemical", l.chemical],
                  ["Physical", l.physical],
                  ["Biological", l.biological],
                  ["Other", appText.categoryOther],
                ]}
              />
            </div>

            <MenuSelect
              label={l.unit}
              value={unitId === "" ? "" : String(unitId)}
              heading={l.unit}
              variant="field"
              fullWidth
              placeholder={l.selectUnit}
              onChange={(next) => setUnitId(next ? Number(next) : "")}
              options={[
                { value: "", label: l.selectUnit },
                ...units.map((unit) => ({
                  value: String(unit.unit_id),
                  label: unit.unit_symbol,
                })),
              ]}
            />
          </div>
        </section>

        <section className="app-modal-section">
          <h3 className="app-modal-section__title">{l.rangeSection}</h3>
          <p className="app-modal-section__desc">{l.rangeInfo}</p>
          <div className="app-modal-fields app-modal-fields--flush">
            <div className="app-modal-field-pair app-modal-field--wide">
              <label className="app-modal-field">
                <span className="app-modal-label">{l.min}</span>
                <input
                  type="number"
                  step="any"
                  inputMode="decimal"
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
                  inputMode="decimal"
                  className="calc-field-input"
                  value={maxValue}
                  onChange={(event) => setMaxValue(event.target.value)}
                />
              </label>
            </div>

            <label className="app-modal-field app-modal-field--wide">
              <span className="app-modal-label">{l.note}</span>
              <textarea
                className="calc-field-input app-modal-textarea"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={l.notePlaceholder}
                rows={3}
              />
            </label>
          </div>
        </section>

        {message ? (
          <div className="app-modal-message app-modal-message--warn" role="alert">
            {message}
          </div>
        ) : null}
      </form>
    </AppModal>
  );
}
