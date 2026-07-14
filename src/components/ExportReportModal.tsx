"use client";

import { useEffect, useMemo, useState } from "react";
import { Calculator, Download } from "lucide-react";
import AppModal from "@/components/AppModal";
import {
  defaultPdfReportSections,
  type CalculatorOutputPack,
  type PdfReportSectionOptions,
} from "@/lib/pdfReport";
import { getSettings } from "@/lib/appSettings";
import type { Translation } from "@/lib/translations";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (sections: PdfReportSectionOptions) => void;
  t: Translation;
  isFoliar: boolean;
  exporting?: boolean;
  checklist?: string[];
  calculatorPacks?: CalculatorOutputPack[];
  hasFertilizerProducts?: boolean;
  hasRecommendations?: boolean;
  onOpenCalculators?: () => void;
};

type ToggleItem = {
  key: string;
  label: string;
  checked: boolean;
  onChange: () => void;
  locked?: boolean;
  hint?: string;
};

export default function ExportReportModal({
  open,
  onClose,
  onConfirm,
  t,
  isFoliar: _isFoliar,
  exporting,
  checklist = [],
  calculatorPacks = [],
  hasFertilizerProducts = false,
  hasRecommendations = false,
  onOpenCalculators,
}: Props) {
  const defaults = useMemo(
    () => defaultPdfReportSections(getSettings().reports),
    []
  );

  const [includeLogo, setIncludeLogo] = useState(defaults.includeLogo);
  const [includeSoilStatus, setIncludeSoilStatus] = useState(
    defaults.includeSoilStatus
  );
  const [includeTexture, setIncludeTexture] = useState(defaults.includeTexture);
  const [includeInterpretation, setIncludeInterpretation] = useState(
    defaults.includeInterpretation
  );
  const [includeLabValues, setIncludeLabValues] = useState(
    defaults.includeLabValues
  );
  const [includeFertilizerPlan, setIncludeFertilizerPlan] = useState(
    defaults.includeFertilizerPlan
  );
  const [includeRecommendations, setIncludeRecommendations] = useState(
    defaults.includeRecommendations
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const next = defaultPdfReportSections(getSettings().reports);
    setIncludeLogo(next.includeLogo);
    setIncludeSoilStatus(next.includeSoilStatus);
    setIncludeTexture(next.includeTexture);
    setIncludeInterpretation(next.includeInterpretation);
    setIncludeLabValues(next.includeLabValues);
    setIncludeFertilizerPlan(next.includeFertilizerPlan);
    setIncludeRecommendations(next.includeRecommendations);
    setSelectedIds(calculatorPacks.map((pack) => pack.id));
  }, [open, calculatorPacks]);

  function togglePack(id: string) {
    setSelectedIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  function handleConfirm() {
    onConfirm({
      includeLogo,
      includeCover: true,
      includeSoilStatus,
      includeTexture,
      includeInterpretation,
      includeMissingValues: false,
      includeLabValues,
      includeSummary: false,
      includeCalculations: selectedIds.length > 0,
      includeDop: true,
      includeRatios: true,
      includeFertilizerPlan: includeFertilizerPlan && hasFertilizerProducts,
      includeRecommendations: includeRecommendations && hasRecommendations,
      selectedCalculatorIds: selectedIds,
    });
  }

  const summaryItems: ToggleItem[] = [
    {
      key: "cover",
      label: t.exportSectionCover || "Cover (analysis details)",
      checked: true,
      onChange: () => undefined,
      locked: true,
    },
    {
      key: "soil",
      label: t.exportSectionSoilStatus || "Soil status summary",
      checked: includeSoilStatus,
      onChange: () => setIncludeSoilStatus((value) => !value),
    },
  ];

  if (hasFertilizerProducts) {
    summaryItems.push({
      key: "fertilizer",
      label:
        t.exportSectionFertilizerProducts ||
        t.exportSectionFertilizerPlan ||
        "Fertilizer products & prices",
      checked: includeFertilizerPlan,
      onChange: () => setIncludeFertilizerPlan((value) => !value),
      hint:
        t.exportFertilizerPriceNote ||
        "Includes product type, grade, rate, and price.",
    });
  }

  if (hasRecommendations) {
    summaryItems.push({
      key: "recommendations",
      label: t.exportSectionRecommendations || "Recommendations",
      checked: includeRecommendations,
      onChange: () => setIncludeRecommendations((value) => !value),
      hint:
        t.exportRecommendationsHint ||
        "Action list at the end of the report (no formulas).",
    });
  }

  const optionalItems: ToggleItem[] = [
    {
      key: "texture",
      label: t.exportSectionTexture || "Soil texture",
      checked: includeTexture,
      onChange: () => setIncludeTexture((value) => !value),
    },
    {
      key: "interpretation",
      label: t.exportSectionInterpretation || "Full parameter detail",
      checked: includeInterpretation,
      onChange: () => setIncludeInterpretation((value) => !value),
    },
    {
      key: "lab",
      label: t.exportSectionLabValues || "Original lab values",
      checked: includeLabValues,
      onChange: () => setIncludeLabValues((value) => !value),
    },
    {
      key: "logo",
      label: t.exportSectionLogo || "Logo",
      checked: includeLogo,
      onChange: () => setIncludeLogo((value) => !value),
    },
  ];

  const hasCalculatorPacks = calculatorPacks.length > 0;

  return (
    <AppModal
      open={open}
      onClose={() => {
        if (!exporting) onClose();
      }}
      title={t.exportReportTitle || "Download summary PDF"}
      description={
        t.exportReportDesc ||
        "Choose what to include. This report is a shareable summary — it does not include calculation steps."
      }
      size="md"
      closeLabel={t.close || "Close"}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={exporting}
            className="app-modal-btn app-modal-btn--secondary"
          >
            {t.exportCancel || "Cancel"}
          </button>
          <button
            type="button"
            disabled={exporting}
            onClick={handleConfirm}
            className="app-modal-btn app-modal-btn--primary"
          >
            <Download size={16} aria-hidden />
            {exporting
              ? t.exportingPdf || "Exporting…"
              : t.exportDownloadSummary || t.exportPdf || "Download summary PDF"}
          </button>
        </>
      }
    >
      {checklist.length > 0 ? (
        <section className="app-modal-section export-checklist">
          <h3 className="app-modal-section__title">
            {t.exportChecklistTitle || "Before you export"}
          </h3>
          <p className="app-modal-section__desc">
            {t.exportChecklistHint ||
              "Some details are missing. You can continue anyway — the PDF will omit blank fields."}
          </p>
          <ul className="export-checklist__list">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="app-modal-section">
        <h3 className="app-modal-section__title">
          {t.exportGroupSummary || "Analysis summary"}
        </h3>
        <div className="export-toggle-list">
          {summaryItems.map((item) => (
            <ExportToggleRow key={item.key} item={item} />
          ))}
        </div>
      </section>

      <section className="app-modal-section">
        <h3 className="app-modal-section__title">
          {t.exportGroupCalculators || "Calculator answers"}
        </h3>
        {hasCalculatorPacks ? (
          <div className="export-toggle-list">
            {calculatorPacks.map((pack) => (
              <ExportToggleRow
                key={pack.id}
                item={{
                  key: pack.id,
                  label: pack.label,
                  checked: selectedIds.includes(pack.id),
                  onChange: () => togglePack(pack.id),
                  hint:
                    pack.outputs.length === 1
                      ? t.exportCalculatorAnswerOne || "1 answer"
                      : (
                          t.exportCalculatorAnswersCount || "{count} answers"
                        ).replace("{count}", String(pack.outputs.length)),
                }}
              />
            ))}
          </div>
        ) : (
          <div className="export-empty-calculators">
            <p className="app-modal-section__desc">
              {t.exportCalculatorsEmptyHint ||
                "Open Calculators, run the tools you need, then come back here. Their answers will appear as optional sections."}
            </p>
            {onOpenCalculators ? (
              <button
                type="button"
                className="export-open-calculators-btn"
                onClick={() => {
                  onClose();
                  onOpenCalculators();
                }}
              >
                <Calculator size={15} aria-hidden />
                {t.exportOpenCalculators || "Open Calculators"}
              </button>
            ) : null}
          </div>
        )}
      </section>

      <section className="app-modal-section">
        <h3 className="app-modal-section__title">
          {t.exportGroupOptional || "Optional details"}
        </h3>
        <div className="export-toggle-list">
          {optionalItems.map((item) => (
            <ExportToggleRow key={item.key} item={item} />
          ))}
        </div>
      </section>

      <p className="export-disclaimer">
        {t.exportNoStepsDisclaimer ||
          "This PDF is a summary for sharing; it does not include calculation steps."}
      </p>
    </AppModal>
  );
}

function ExportToggleRow({ item }: { item: ToggleItem }) {
  return (
    <label
      className={`export-toggle-row ${item.locked ? "export-toggle-row--locked" : ""}`}
    >
      <input
        type="checkbox"
        checked={item.checked}
        disabled={item.locked}
        onChange={item.onChange}
        className="export-toggle-row__input"
      />
      <span className="export-toggle-row__text">
        <span className="export-toggle-row__label">{item.label}</span>
        {item.hint ? (
          <span className="export-toggle-row__hint">{item.hint}</span>
        ) : null}
      </span>
    </label>
  );
}
