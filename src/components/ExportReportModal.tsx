"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Download } from "lucide-react";
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
  hasCalendar?: boolean;
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
  disabled?: boolean;
};

export default function ExportReportModal({
  open,
  onClose,
  onConfirm,
  t,
  isFoliar,
  exporting,
  checklist = [],
  calculatorPacks = [],
  hasFertilizerProducts = false,
  hasCalendar = false,
  hasRecommendations = false,
  onOpenCalculators,
}: Props) {
  const defaults = useMemo(
    () => defaultPdfReportSections(getSettings().reports),
    []
  );

  const hasCic = calculatorPacks.some((p) => p.id === "cic" && p.outputs.length > 0);
  const hasAmendment = calculatorPacks.some(
    (p) => p.id === "amendment" && p.outputs.length > 0
  );
  const hasNutrient = calculatorPacks.some(
    (p) => p.id === "fertilizer" && p.outputs.length > 0
  );
  const hasDop = calculatorPacks.some((p) => p.id === "dop" && p.outputs.length > 0);

  const [includeLogo, setIncludeLogo] = useState(defaults.includeLogo);
  const [includeSoilStatus, setIncludeSoilStatus] = useState(
    defaults.includeSoilStatus
  );
  const [includeTexture, setIncludeTexture] = useState(defaults.includeTexture);
  const [includeLabValues, setIncludeLabValues] = useState(
    defaults.includeLabValues
  );
  const [includeCicBases, setIncludeCicBases] = useState(defaults.includeCicBases);
  const [includePhAmendments, setIncludePhAmendments] = useState(
    defaults.includePhAmendments
  );
  const [includeNutrientPlan, setIncludeNutrientPlan] = useState(
    defaults.includeNutrientPlan
  );
  const [includeFertilizerPlan, setIncludeFertilizerPlan] = useState(
    defaults.includeFertilizerPlan
  );
  const [includeCalendar, setIncludeCalendar] = useState(
    defaults.includeCalendar
  );
  const [includeRecommendations, setIncludeRecommendations] = useState(
    defaults.includeRecommendations
  );
  const [includeDop, setIncludeDop] = useState(defaults.includeDop);
  const [includeNutrientPie, setIncludeNutrientPie] = useState(
    defaults.includeNutrientPie
  );
  const [includeInterpretation, setIncludeInterpretation] = useState(
    defaults.includeInterpretation
  );

  useEffect(() => {
    if (!open) return;
    const next = defaultPdfReportSections(getSettings().reports);
    setIncludeLogo(next.includeLogo);
    setIncludeSoilStatus(next.includeSoilStatus);
    setIncludeTexture(next.includeTexture);
    setIncludeLabValues(next.includeLabValues);
    setIncludeCicBases(next.includeCicBases);
    setIncludePhAmendments(next.includePhAmendments);
    setIncludeNutrientPlan(next.includeNutrientPlan);
    setIncludeFertilizerPlan(next.includeFertilizerPlan);
    setIncludeCalendar(next.includeCalendar);
    setIncludeRecommendations(next.includeRecommendations);
    setIncludeDop(isFoliar ? next.includeDop : true);
    setIncludeNutrientPie(isFoliar ? true : false);
    setIncludeInterpretation(isFoliar ? true : next.includeInterpretation);
    if (isFoliar) {
      setIncludeRecommendations(true);
    }
  }, [open, isFoliar]);

  function handleConfirm() {
    const selectedCalculatorIds = [
      !isFoliar && includeCicBases && hasCic ? "cic" : null,
      !isFoliar && includePhAmendments && hasAmendment ? "amendment" : null,
      !isFoliar && includeNutrientPlan && hasNutrient ? "fertilizer" : null,
      isFoliar && includeDop && hasDop ? "dop" : null,
    ].filter(Boolean) as string[];

    onConfirm({
      includeLogo,
      includeCover: true,
      includeSoilStatus,
      includeTexture: !isFoliar && includeTexture,
      includeInterpretation: isFoliar ? includeInterpretation : false,
      includeMissingValues: false,
      includeLabValues,
      includeSummary: false,
      includeCalculations: selectedCalculatorIds.length > 0,
      includeDop: isFoliar ? includeDop : false,
      includeNutrientPie: isFoliar ? includeNutrientPie : false,
      includeRatios: !isFoliar,
      includeCicBases: !isFoliar && includeCicBases && hasCic,
      includePhAmendments: !isFoliar && includePhAmendments && hasAmendment,
      includeNutrientPlan: !isFoliar && includeNutrientPlan && hasNutrient,
      includeFertilizerPlan: includeFertilizerPlan && hasFertilizerProducts,
      includeCalendar: includeCalendar && hasCalendar,
      includeRecommendations: includeRecommendations && hasRecommendations,
      selectedCalculatorIds,
    });
  }

  const soilMainItems: ToggleItem[] = [
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
      onChange: () => setIncludeSoilStatus((v) => !v),
    },
    {
      key: "cic",
      label: t.exportSectionCicBases || "CIC, bases and ratios",
      checked: includeCicBases && hasCic,
      onChange: () => setIncludeCicBases((v) => !v),
      disabled: !hasCic,
      hint: hasCic
        ? undefined
        : t.exportNeedCalculatorsHint || "Run CIC in Calculators first",
    },
    {
      key: "amendment",
      label: t.exportSectionPhAmendments || "pH and amendments",
      checked: includePhAmendments && hasAmendment,
      onChange: () => setIncludePhAmendments((v) => !v),
      disabled: !hasAmendment,
      hint: hasAmendment
        ? undefined
        : t.exportNeedCalculatorsHint || "Run amendments in Calculators first",
    },
    {
      key: "nutrient",
      label: t.exportSectionNutrientPlan || "Nutrient plan",
      checked: includeNutrientPlan && hasNutrient,
      onChange: () => setIncludeNutrientPlan((v) => !v),
      disabled: !hasNutrient,
      hint: hasNutrient
        ? undefined
        : t.exportNeedCalculatorsHint || "Run nutrient plan in Calculators first",
    },
    {
      key: "fertilizer",
      label:
        t.exportSectionFertilizerProducts ||
        "Fertilizer products & costs",
      checked: includeFertilizerPlan && hasFertilizerProducts,
      onChange: () => setIncludeFertilizerPlan((v) => !v),
      disabled: !hasFertilizerProducts,
      hint: hasFertilizerProducts
        ? t.exportFertilizerPriceNote || "Product table with rates and costs"
        : t.exportNeedCostsHint || "Build fertilizer costs in Calculators first",
    },
    {
      key: "calendar",
      label: t.exportSectionCalendar || "Fertilization calendar",
      checked: includeCalendar && hasCalendar,
      onChange: () => setIncludeCalendar((v) => !v),
      disabled: !hasCalendar,
      hint: hasCalendar
        ? undefined
        : t.exportNeedCalendarHint || "Save a farm calendar first",
    },
    {
      key: "recommendations",
      label: t.exportSectionRecommendations || "General recommendations",
      checked: includeRecommendations && hasRecommendations,
      onChange: () => setIncludeRecommendations((v) => !v),
      disabled: !hasRecommendations,
    },
  ];

  const foliarMainItems: ToggleItem[] = [
    {
      key: "cover",
      label: t.exportSectionCover || "Cover (analysis details)",
      checked: true,
      onChange: () => undefined,
      locked: true,
    },
    {
      key: "status",
      label:
        t.exportSectionFoliarStatus ||
        t.analysisSummary ||
        "Foliar status summary",
      checked: includeSoilStatus,
      onChange: () => setIncludeSoilStatus((v) => !v),
    },
    {
      key: "dop",
      label: t.exportSectionDop || "DOP graph",
      checked: includeDop,
      onChange: () => setIncludeDop((v) => !v),
      hint: hasDop
        ? undefined
        : t.exportDopFromRangesHint ||
          "Built from sufficiency-range midpoints when DOP calculator has not been run",
    },
    {
      key: "pie",
      label: t.exportSectionNutrientPie || "Nutrient distribution pie",
      checked: includeNutrientPie,
      onChange: () => setIncludeNutrientPie((v) => !v),
      hint:
        t.exportNutrientPieHint ||
        "Shows how nutrients are distributed in the plant tissue",
    },
    {
      key: "interpretation",
      label: t.exportSectionInterpretation || "Full parameter detail",
      checked: includeInterpretation,
      onChange: () => setIncludeInterpretation((v) => !v),
      hint:
        t.exportInterpretationHint ||
        "Value, range, level and advice for each parameter",
    },
    {
      key: "recommendations",
      label: t.exportSectionRecommendations || "Recommendations",
      checked: includeRecommendations && hasRecommendations,
      onChange: () => setIncludeRecommendations((v) => !v),
      disabled: !hasRecommendations,
    },
    {
      key: "fertilizer",
      label:
        t.exportSectionFertilizerProducts ||
        "Fertilizer products & costs",
      checked: includeFertilizerPlan && hasFertilizerProducts,
      onChange: () => setIncludeFertilizerPlan((v) => !v),
      disabled: !hasFertilizerProducts,
      hint: hasFertilizerProducts
        ? t.exportFertilizerPriceNote || "Product table with rates and costs"
        : undefined,
    },
    {
      key: "calendar",
      label: t.exportSectionCalendar || "Fertilization calendar",
      checked: includeCalendar && hasCalendar,
      onChange: () => setIncludeCalendar((v) => !v),
      disabled: !hasCalendar,
    },
  ];

  const mainItems = isFoliar ? foliarMainItems : soilMainItems;

  const optionalItems: ToggleItem[] = [
    ...(!isFoliar
      ? [
          {
            key: "texture",
            label: t.exportSectionTexture || "Soil texture",
            checked: includeTexture,
            onChange: () => setIncludeTexture((v) => !v),
          } satisfies ToggleItem,
        ]
      : []),
    {
      key: "lab",
      label: t.exportSectionLabValues || "Original lab values",
      checked: includeLabValues,
      onChange: () => setIncludeLabValues((v) => !v),
    },
    {
      key: "logo",
      label: t.exportSectionLogo || "Logo",
      checked: includeLogo,
      onChange: () => setIncludeLogo((v) => !v),
    },
  ];

  return (
    <AppModal
      open={open}
      onClose={() => {
        if (!exporting) onClose();
      }}
      title={t.exportReportTitle || "Download summary PDF"}
      description={
        t.exportReportDesc || "Choose what to include in this shareable summary."
      }
      size="md"
      className="export-report-modal"
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
            <Download size={15} aria-hidden />
            {exporting
              ? t.exportingPdf || "Exporting…"
              : t.exportDownloadSummary || t.exportPdf || "Download summary PDF"}
          </button>
        </>
      }
    >
      <div className="export-report">
        {checklist.length > 0 ? (
          <div className="export-report__alert" role="status">
            <p className="export-report__alert-title">
              {t.exportChecklistTitle || "Before you export"}
            </p>
            <p className="export-report__alert-desc">
              {t.exportChecklistHint ||
                "Some details are missing. You can continue — blank fields will be omitted."}
            </p>
            <ul className="export-report__alert-list">
              {checklist.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}

        <ExportGroup title={t.exportGroupSummary || "Report content"}>
          {mainItems.map((item) => (
            <ExportToggleRow key={item.key} item={item} />
          ))}
        </ExportGroup>

        {!isFoliar && !hasCic && !hasAmendment && !hasNutrient && onOpenCalculators ? (
          <div className="export-report__empty">
            <p>
              {t.exportCalculatorsEmptyHint ||
                "Run calculators first — CIC, amendments and nutrient plan will appear here."}
            </p>
            <button
              type="button"
              className="export-report__link-btn"
              onClick={() => {
                onClose();
                onOpenCalculators();
              }}
            >
              {t.exportOpenCalculators || "Open Calculators"}
            </button>
          </div>
        ) : null}

        <ExportGroup title={t.exportGroupOptional || "Optional details"}>
          {optionalItems.map((item) => (
            <ExportToggleRow key={item.key} item={item} />
          ))}
        </ExportGroup>
      </div>
    </AppModal>
  );
}

function ExportGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="export-report__group">
      <h3 className="export-report__group-title">{title}</h3>
      <div className="export-report__list">{children}</div>
    </section>
  );
}

function ExportToggleRow({ item }: { item: ToggleItem }) {
  return (
    <label
      className={`export-toggle-row${item.locked ? " export-toggle-row--locked" : ""}${item.checked ? " export-toggle-row--on" : ""}${item.disabled ? " export-toggle-row--disabled" : ""}`}
    >
      <input
        type="checkbox"
        checked={item.checked}
        disabled={item.locked || item.disabled}
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
