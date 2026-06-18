"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { PdfReportSectionOptions } from "@/lib/pdfReport";
import type { Translation } from "@/lib/translations";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (sections: PdfReportSectionOptions) => void;
  t: Translation;
  isFoliar: boolean;
  exporting?: boolean;
};

const defaultSections = (): PdfReportSectionOptions => ({
  includeLogo: true,
  includeSummary: true,
  includeInterpretation: true,
  includeMissingValues: true,
  includeTexture: true,
  includeCalculations: true,
  includeLabValues: true,
  includeDop: true,
  includeRatios: true,
});

export default function ExportReportModal({
  open,
  onClose,
  onConfirm,
  t,
  isFoliar,
  exporting,
}: Props) {
  const [sections, setSections] = useState<PdfReportSectionOptions>(defaultSections);

  if (!open) return null;

  function toggle(key: keyof PdfReportSectionOptions) {
    setSections((previous) => ({ ...previous, [key]: !previous[key] }));
  }

  function selectAll(value: boolean) {
    setSections({
      includeLogo: value,
      includeSummary: value,
      includeInterpretation: value,
      includeMissingValues: value,
      includeTexture: value,
      includeCalculations: value,
      includeLabValues: value,
      includeDop: value,
      includeRatios: value,
    });
  }

  const items: Array<{ key: keyof PdfReportSectionOptions; label: string; foliarOnly?: boolean }> = [
    { key: "includeLogo", label: t.exportSectionLogo || "Logo & header" },
    { key: "includeSummary", label: t.exportSectionSummary || "Summary cards" },
    { key: "includeInterpretation", label: t.exportSectionInterpretation || "Interpretation results" },
    { key: "includeMissingValues", label: t.exportSectionMissing || "Missing / no range values" },
    { key: "includeTexture", label: t.exportSectionTexture || "Soil texture" },
    { key: "includeCalculations", label: t.exportSectionCalculations || "Calculator outputs" },
    { key: "includeLabValues", label: t.exportSectionLabValues || "Original lab values" },
    { key: "includeDop", label: t.exportSectionDop || "DOP (foliar)", foliarOnly: true },
    { key: "includeRatios", label: t.exportSectionRatios || "Nutrient ratios" },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center bg-slate-950/45 p-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        className="glass-modal-shell w-full max-w-md rounded-3xl p-5"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 className="app-section-title text-green-950">
              {t.exportReportTitle || "Export report"}
            </h2>
            <p className="app-section-desc mt-1">
              {t.exportReportDesc || "Choose which sections to include in the PDF."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600"
            aria-label={t.close || "Close"}
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-3 flex gap-2">
          <button
            type="button"
            onClick={() => selectAll(true)}
            className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800"
          >
            {t.exportSelectAll || "All sections"}
          </button>
          <button
            type="button"
            onClick={() => selectAll(false)}
            className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700"
          >
            {t.exportSelectNone || "None"}
          </button>
        </div>

        <ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
          {items.map((item) => {
            if (item.foliarOnly && !isFoliar) return null;
            return (
              <li key={item.key}>
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-emerald-900/10 bg-white/80 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={Boolean(sections[item.key])}
                    onChange={() => toggle(item.key)}
                    className="h-4 w-4 accent-emerald-700"
                  />
                  <span className="text-sm font-semibold text-green-950">{item.label}</span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700"
          >
            {t.exportCancel || "Cancel"}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={() => onConfirm(sections)}
            className="rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {exporting ? t.exportingPdf || "Exporting…" : t.exportPdf || "Export PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
