"use client";

import type { ReactNode } from "react";
import type { BlendPlan, CostScenario } from "@/lib/fertilizerCostOptimize";
import { roundBagsForPurchase } from "@/lib/fertilizerCatalog";
import type { DoseNutrientKey } from "@/lib/soilFertilityPlan";
import type { IrrigationSystem } from "@/lib/soilFertilityTables";
import MenuSelect from "@/components/ui/MenuSelect";

export type FertilizerCostViewMode = "prices" | "quantity";

type Props = {
  scenarios: CostScenario[];
  activeId: string;
  onSelect: (id: string) => void;
  onApply: (args: {
    primaryByDose: Partial<Record<DoseNutrientKey, string>>;
    scenario: CostScenario;
    snappedFromIrrigation: boolean;
  }) => void;
  areaHa: number;
  currency: string;
  missingPrices?: Array<{ key: string; label: string }>;
  viewMode: FertilizerCostViewMode;
  onViewModeChange: (mode: FertilizerCostViewMode) => void;
  /** Shown when "My selection" is active — fertilizer chooser / price editors. */
  selectionPanel?: ReactNode;
  /** When false, hide the prices/quantity toggle (rendered elsewhere). */
  showViewMode?: boolean;
  /**
   * Standalone “Compare by irrigation” select. Keep false on the Fertilizers & cost
   * page — irrigation scenarios still appear under Compare options.
   */
  showIrrigationCompare?: boolean;
  t: Record<string, string>;
};

function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function scenarioLabel(scenario: CostScenario, t: Record<string, string>) {
  if (scenario.kind === "irrigation") {
    const system = scenario.irrigationSystem as IrrigationSystem;
    const name = t[`irrigation_${system}`] || system;
    const suffix = scenario.isCurrentIrrigation
      ? ` · ${t.fertilizerScenarioCurrentIrrig || "current"}`
      : "";
    return `${t.fertilizerScenarioIrrigPrefix || "Irrigation"}: ${name}${suffix}`;
  }
  return t[scenario.labelKey] || scenario.labelKey;
}

const NUTRIENT_LABEL: Record<string, string> = {
  n: "N",
  p2o5: "P₂O₅",
  k2o: "K₂O",
  mgo: "MgO",
  cao: "CaO",
};

const PRIMARY_STRATEGY_IDS = new Set([
  "recommended",
  "fewest_products",
  "stock_first",
  "current_selection",
]);

export default function FertilizerCostScenarios({
  scenarios,
  activeId,
  onSelect,
  onApply,
  areaHa,
  currency,
  missingPrices = [],
  viewMode,
  onViewModeChange,
  selectionPanel = null,
  showViewMode = true,
  showIrrigationCompare = true,
  t,
}: Props) {
  const active =
    scenarios.find((s) => s.id === activeId) ||
    scenarios.find((s) => s.recommended) ||
    scenarios[0];

  if (!active) return null;

  const primaryStrategies = scenarios.filter(
    (s) => s.kind !== "irrigation" && PRIMARY_STRATEGY_IDS.has(s.id)
  );
  const irrigFilters = scenarios.filter((s) => s.kind === "irrigation");
  const plan = active.plan;
  const plotCost = plan ? plan.costHa * areaHa : null;
  const plotKg = plan
    ? plan.lines.reduce((sum, line) => sum + line.kgHa * areaHa, 0)
    : null;

  const baseline =
    scenarios.find((s) => s.recommended && s.plan)?.plan?.costHa ??
    scenarios.find((s) => s.plan)?.plan?.costHa ??
    null;
  const baselineKg =
    scenarios.find((s) => s.recommended && s.plan)?.plan?.lines.reduce(
      (sum, line) => sum + line.kgHa,
      0
    ) ??
    scenarios.find((s) => s.plan)?.plan?.lines.reduce(
      (sum, line) => sum + line.kgHa,
      0
    ) ??
    null;

  const comparable = scenarios.filter(
    (s) => s.id !== active.id && s.feasible && s.plan
  );

  const irrigSelectValue =
    active.kind === "irrigation" && active.irrigationSystem
      ? active.irrigationSystem
      : "__none__";

  const showPrices = viewMode === "prices";
  const isMySelection = active.id === "current_selection";

  return (
    <section className="grid gap-3">
      {showViewMode ? (
        <div className="fertilizer-view-mode">
          <p className="fertilizer-view-mode__label">
            {t.fertilizerViewLabel || "View as"}
          </p>
          <div
            className="app-segmented-control fertilizer-view-mode__control"
            role="group"
            aria-label={t.fertilizerViewLabel || "View as"}
          >
            <button
              type="button"
              onClick={() => onViewModeChange("quantity")}
              aria-pressed={viewMode === "quantity"}
              className={`app-segmented-control__btn${
                viewMode === "quantity"
                  ? " app-segmented-control__btn--active"
                  : ""
              }`}
            >
              {t.fertilizerViewQuantity || "Quantity"}
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("prices")}
              aria-pressed={viewMode === "prices"}
              className={`app-segmented-control__btn${
                viewMode === "prices"
                  ? " app-segmented-control__btn--active"
                  : ""
              }`}
            >
              {t.fertilizerViewPrices || "Prices"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-1.5">
        {primaryStrategies.map((scenario) => (
          <FilterChip
            key={scenario.id}
            active={active.id === scenario.id}
            recommended={scenario.recommended}
            disabled={!scenario.feasible && scenario.kind !== "current_selection"}
            onClick={() => onSelect(scenario.id)}
            label={scenarioLabel(scenario, t)}
          />
        ))}
      </div>

      {isMySelection && selectionPanel ? selectionPanel : null}

      {!plan || !active.feasible ? (
        <div className="space-y-2">
          <p className="fertilizer-cost-alert rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {showPrices
              ? t.fertilizerScenarioNeedPrices ||
                "Add bag prices for the fertilizers you can buy so the optimizer can build scenarios."
              : t.fertilizerScenarioNeedDoses ||
                "Enter nutrient doses above to see product quantities for this mix."}
          </p>
          {showPrices && missingPrices.length > 0 ? (
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t.fertilizerScenarioMissingPrices || "Missing prices for"}:{" "}
              {missingPrices
                .slice(0, 8)
                .map((item) => item.label)
                .join(", ")}
              {missingPrices.length > 8 ? "…" : ""}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-2">
          <div className="flex flex-wrap items-baseline justify-between gap-2 py-1.5">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {plan.productCount} {t.fertilizerProductsCount || "products"}
              {active.recommended
                ? ` · ${t.fertilizerScenarioRecommended || "Recommended"}`
                : ""}
            </p>
            <p className="text-sm font-bold text-green-950 dark-text-primary">
              {showPrices
                ? plotCost == null
                  ? "—"
                  : formatMoney(plotCost, currency)
                : plotKg == null
                  ? "—"
                  : `${plotKg.toFixed(1)} kg`}
              {showPrices && Math.abs(areaHa - 1) > 0.001 ? (
                <span className="ml-1 text-xs font-semibold text-slate-500">
                  ({formatMoney(plan.costHa, currency)}/ha)
                </span>
              ) : null}
            </p>
          </div>

          <BlendLinesList
            plan={plan}
            areaHa={areaHa}
            currency={currency}
            viewMode={viewMode}
            t={t}
          />

          {plan.credits.length > 0 ? (
            <div className="fertilizer-cost-credit-note" role="note">
              {plan.credits.map((credit) => (
                <p
                  key={`${credit.fromProductKey}-${credit.nutrient}`}
                  className="fertilizer-cost-credit-note__line"
                >
                  {t.fertilizerScenarioCreditLine
                    ?.replace("{product}", credit.fromLabel)
                    .replace(
                      "{nutrient}",
                      NUTRIENT_LABEL[credit.nutrient] || credit.nutrient
                    )
                    .replace("{kg}", credit.kgHa.toFixed(1)) ||
                    `${credit.fromLabel}: ${credit.kgHa.toFixed(1)} kg ${NUTRIENT_LABEL[credit.nutrient] || credit.nutrient}/ha`}
                </p>
              ))}
            </div>
          ) : null}

          {active.kind === "irrigation" ? (
            <p className="text-xs text-amber-800 dark:text-amber-200">
              {t.fertilizerScenarioApplyIrrigNote ||
                "Applying this mix uses these products on your current plan doses (not the rebuilt irrigation targets)."}
            </p>
          ) : null}

          {active.kind !== "current_selection" &&
          Object.keys(plan.primaryByDose).length > 0 ? (
            <button
              type="button"
              className="rounded-xl bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
              onClick={() =>
                onApply({
                  primaryByDose: plan.primaryByDose,
                  scenario: active,
                  snappedFromIrrigation: active.kind === "irrigation",
                })
              }
            >
              {t.fertilizerScenarioApply || "Use this mix"}
            </button>
          ) : null}
        </div>
      )}

      {showIrrigationCompare && irrigFilters.length > 0 ? (
        <MenuSelect
          label={t.fertilizerScenarioCompareIrrig || "Compare by irrigation"}
          value={irrigSelectValue}
          options={[
            ["__none__", t.fertilizerScenarioIrrigOff || "Current plan doses"],
            ...irrigFilters.map(
              (scenario) =>
                [
                  scenario.irrigationSystem || scenario.id,
                  `${t[`irrigation_${scenario.irrigationSystem}`] || scenario.irrigationSystem}${
                    scenario.isCurrentIrrigation
                      ? ` · ${t.fertilizerScenarioCurrentIrrig || "current"}`
                      : ""
                  }`,
                ] as [string, string]
            ),
          ]}
          onChange={(value) => {
            if (value === "__none__") {
              const recommended =
                scenarios.find((s) => s.recommended)?.id || "recommended";
              onSelect(recommended);
              return;
            }
            onSelect(`irrigation_${value}`);
          }}
          fullWidth
          variant="field"
          compact
        />
      ) : null}

      {plan && active.feasible && comparable.length > 0 ? (
        <details className="fertilizer-plan__hint">
          <summary className="cursor-pointer text-xs font-bold text-emerald-800">
            {t.fertilizerScenarioCompare || "Compare options"}
          </summary>
          <ul className="mt-2 grid gap-1">
            {comparable.slice(0, 8).map((scenario) => {
              const cost = scenario.plan!.costHa * areaHa;
              const kg = scenario.plan!.lines.reduce(
                (sum, line) => sum + line.kgHa * areaHa,
                0
              );
              const delta = showPrices
                ? baseline != null
                  ? scenario.plan!.costHa - baseline
                  : null
                : baselineKg != null
                  ? scenario.plan!.lines.reduce(
                      (sum, line) => sum + line.kgHa,
                      0
                    ) - baselineKg
                  : null;
              return (
                <li key={scenario.id}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/70 dark:hover:bg-white/10"
                    onClick={() => onSelect(scenario.id)}
                  >
                    <span className="text-slate-700 dark:text-slate-200">
                      {scenarioLabel(scenario, t)}
                    </span>
                    <span className="shrink-0 font-semibold text-green-950 dark-text-primary">
                      {showPrices
                        ? formatMoney(cost, currency)
                        : `${kg.toFixed(1)} kg`}
                      {delta != null &&
                      Math.abs(delta) > (showPrices ? 0.01 : 0.05) ? (
                        <span
                          className={
                            delta > 0
                              ? "ml-1 font-normal text-amber-700"
                              : "ml-1 font-normal text-emerald-700"
                          }
                        >
                          {delta > 0 ? "+" : ""}
                          {showPrices
                            ? formatMoney(delta * areaHa, currency)
                            : `${(delta * areaHa).toFixed(1)} kg`}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

function BlendLinesList({
  plan,
  areaHa,
  currency,
  viewMode,
  t,
}: {
  plan: BlendPlan;
  areaHa: number;
  currency: string;
  viewMode: FertilizerCostViewMode;
  t: Record<string, string>;
}) {
  const showPrices = viewMode === "prices";
  return (
    <ul className="grid">
      {plan.lines.map((line, index) => (
        <li
          key={line.productKey}
          className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5 text-[0.8125rem] ${
            index > 0
              ? "border-t border-emerald-900/10 dark:border-white/10"
              : "pt-0"
          }`}
        >
          <div className="min-w-0">
            <p className="font-semibold text-green-950 dark-text-primary">
              {line.label}{" "}
              <span className="font-normal text-slate-500">· {line.analysis}</span>
            </p>
            {showPrices ? (
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                {`${line.kgHa.toFixed(1)} kg/ha`}
              </p>
            ) : null}
          </div>
          <div className="shrink-0 text-right">
            <p className="font-semibold text-green-950 dark-text-primary">
              {showPrices
                ? formatMoney(line.costHa * areaHa, currency)
                : `${(line.kgHa * areaHa).toFixed(1)} kg`}
            </p>
            {!showPrices ? (
              <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                {roundBagsForPurchase(line.bagsHa * areaHa)}{" "}
                {t.fertilizerBags || "bags"}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function FilterChip({
  label,
  active,
  recommended,
  disabled,
  onClick,
}: {
  label: string;
  active: boolean;
  recommended: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "fertilizer-cost-chip rounded-full border px-2.5 py-1 text-[11px] font-semibold transition",
        active
          ? "fertilizer-cost-chip--active border-emerald-800 bg-emerald-800 text-white"
          : "border-emerald-900/20 bg-white/70 text-green-950 hover:border-emerald-700 dark:bg-white/10 dark:text-slate-100",
        recommended && !active ? "ring-1 ring-emerald-600/40" : "",
        disabled ? "cursor-not-allowed opacity-40" : "",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
