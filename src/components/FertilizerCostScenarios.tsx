"use client";

import type { BlendPlan, CostScenario } from "@/lib/fertilizerCostOptimize";
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
  const plotBags = plan
    ? plan.lines.reduce((sum, line) => sum + line.bagsHa * areaHa, 0)
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

  return (
    <section className="grid gap-3">
      <div className="grid gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
          {t.fertilizerViewLabel || "Show"}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            active={viewMode === "prices"}
            recommended={false}
            disabled={false}
            onClick={() => onViewModeChange("prices")}
            label={t.fertilizerViewPrices || "Prices"}
          />
          <FilterChip
            active={viewMode === "quantity"}
            recommended={false}
            disabled={false}
            onClick={() => onViewModeChange("quantity")}
            label={t.fertilizerViewQuantity || "Quantity"}
          />
        </div>
      </div>

      <div className="grid gap-1.5">
        <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
          {t.fertilizerScenarioPickLabel || "Mix strategy"}
        </p>
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
      </div>

      {irrigFilters.length > 0 ? (
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

      {!plan || !active.feasible ? (
        <div className="space-y-2">
          <p className="fertilizer-cost-alert rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
            {t.fertilizerScenarioNeedPrices ||
              "Add bag prices for the fertilizers you can buy so the optimizer can build scenarios."}
          </p>
          {missingPrices.length > 0 ? (
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
        <div className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-green-950 dark-text-primary">
                  {scenarioLabel(active, t)}
                </p>
                {active.recommended ? (
                  <span className="rounded-full bg-emerald-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {t.fertilizerScenarioRecommended || "Recommended"}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {plan.productCount} {t.fertilizerProductsCount || "products"}
                {active.kind === "irrigation"
                  ? ` · ${t.fertilizerScenarioVsCurrentDose || "doses rebuilt for this irrigation"}`
                  : ""}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
                {showPrices
                  ? t.fertilizerCostPlot || "Plot cost"
                  : t.fertilizerQuantityPlot || "Plot quantity"}
              </p>
              <p className="text-lg font-bold text-green-950 dark-text-primary">
                {showPrices
                  ? plotCost == null
                    ? "—"
                    : formatMoney(plotCost, currency)
                  : plotKg == null
                    ? "—"
                    : `${plotKg.toFixed(1)} kg`}
              </p>
              {showPrices && Math.abs(areaHa - 1) > 0.001 ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {formatMoney(plan.costHa, currency)} / ha
                </p>
              ) : null}
              {!showPrices && plotBags != null ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {plotBags.toFixed(1)} {t.fertilizerBags || "bags"}
                  {Math.abs(areaHa - 1) > 0.001
                    ? ` · ${plan.lines.reduce((sum, line) => sum + line.kgHa, 0).toFixed(1)} kg/ha`
                    : ""}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-1.5">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
              {t.fertilizerScenarioProductsIn || "Products in this mix"}
            </p>
            <BlendLinesList
              plan={plan}
              areaHa={areaHa}
              currency={currency}
              viewMode={viewMode}
              t={t}
            />
          </div>

          {plan.credits.length > 0 ? (
            <div className="rounded-xl border border-emerald-900/10 bg-white/40 p-3 text-xs text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
              <p className="font-semibold text-emerald-900 dark:text-emerald-300">
                {t.fertilizerScenarioCredits || "Nutrient credits"}
              </p>
              <ul className="mt-1.5 space-y-1 leading-relaxed">
                {plan.credits.map((credit) => (
                  <li key={`${credit.fromProductKey}-${credit.nutrient}`}>
                    {t.fertilizerScenarioCreditLine
                      ?.replace("{product}", credit.fromLabel)
                      .replace(
                        "{nutrient}",
                        NUTRIENT_LABEL[credit.nutrient] || credit.nutrient
                      )
                      .replace("{kg}", credit.kgHa.toFixed(1)) ||
                      `${credit.fromLabel} supplies ${credit.kgHa.toFixed(1)} kg ${NUTRIENT_LABEL[credit.nutrient] || credit.nutrient}/ha — reducing the need for a second product.`}
                  </li>
                ))}
              </ul>
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

          {comparable.length > 0 ? (
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
        </div>
      )}
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
          className={`flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 py-2.5 text-xs ${
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
            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              {showPrices
                ? `${line.kgHa.toFixed(1)} kg/ha · ${(line.bagsHa * areaHa).toFixed(1)} ${t.fertilizerBags || "bags"} ${t.fertilizerPerPlot || "per plot"}`
                : `${(line.kgHa * areaHa).toFixed(1)} kg ${t.fertilizerPerPlot || "per plot"} · ${line.kgHa.toFixed(1)} kg/ha`}
            </p>
          </div>
          <p className="shrink-0 font-semibold text-green-950 dark-text-primary">
            {showPrices
              ? formatMoney(line.costHa * areaHa, currency)
              : `${(line.bagsHa * areaHa).toFixed(1)} ${t.fertilizerBags || "bags"}`}
          </p>
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
