"use client";

import { X } from "lucide-react";

import type { Translation } from "@/lib/translations";

type Props = {
  open: boolean;
  parameterLabel: string;
  fromUnit: string;
  toUnit: string;
  currentValue: number;
  convertedValue: number;
  onConfirm: () => void;
  onCancel: () => void;
  t: Translation;
};

export default function UnitConversionModal({
  open,
  parameterLabel,
  fromUnit,
  toUnit,
  currentValue,
  convertedValue,
  onConfirm,
  onCancel,
  t,
}: Props) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="glass-modal-shell w-full max-w-md rounded-3xl p-5"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-green-950">
              {t.unitConversionTitle || "Convert unit?"}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t.unitConversionDesc ||
                "This will convert the entered value to the selected unit."}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
            aria-label={t.close || "Close"}
          >
            <X size={18} />
          </button>
        </div>

        <div className="rounded-2xl border border-emerald-900/10 bg-emerald-50/70 p-4 text-sm">
          <p className="font-bold text-green-950">{parameterLabel}</p>
          <p className="mt-2 text-slate-700">
            {currentValue} {fromUnit} → <strong>{convertedValue.toFixed(2)}</strong> {toUnit}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
          >
            {t.exportCancel || "Cancel"}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white"
          >
            {t.unitConversionConfirm || "Convert"}
          </button>
        </div>
      </div>
    </div>
  );
}
