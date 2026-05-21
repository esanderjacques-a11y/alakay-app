"use client";

import { AppStep } from "@/lib/appSteps";
import {
  ClipboardList,
  Calculator,
  FlaskConical,
  History,
  Home,
  LineChart,
} from "lucide-react";

type Props = {
  currentStep: AppStep;
  onStepChange: (step: AppStep) => void;
  hasResults: boolean;
  hasHistoryOrProgress: boolean;
  labels: {
    home: string;
    setup: string;
    values: string;
    results: string;
    calculators: string;
    history: string;
  };
};

type DockStep = {
  id: AppStep;
  label: string;
  icon: React.ReactNode;
  disabled?: boolean;
};

export default function AppDock({
  currentStep,
  onStepChange,
  hasResults,
  hasHistoryOrProgress,
  labels,
}: Props) {
  const steps: DockStep[] = [
    { id: "home", label: labels.home, icon: <Home size={20} /> },
    { id: "setup", label: labels.setup, icon: <ClipboardList size={20} /> },
    { id: "values", label: labels.values, icon: <FlaskConical size={20} /> },
    { id: "calculators", label: labels.calculators, icon: <Calculator size={20} /> },
    { id: "history", label: labels.history, icon: <History size={20} />, disabled: !hasHistoryOrProgress },
  ];

  const visibleSteps: DockStep[] = hasResults
    ? [
        ...steps.slice(0, 3),
        {
          id: "results" as AppStep,
          label: labels.results,
          icon: <LineChart size={20} />,
        },
        steps[3],
        steps[4],
      ]
    : steps;

  return (
    <nav
      aria-label="Main navigation"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[15000] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
    >
      <section className="app-dock pointer-events-auto mx-auto flex max-w-lg items-stretch justify-between gap-1 rounded-[1.75rem] p-2 sm:gap-1.5">
        {visibleSteps.map((step) => {
          const active = currentStep === step.id;
          const disabled = step.disabled;

          return (
            <button
              key={step.id}
              type="button"
              disabled={disabled}
              onClick={() => onStepChange(step.id)}
              className={`touch-target flex min-h-[52px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2 text-[10px] font-semibold transition sm:text-xs ${
                active
                  ? "bg-white/68 text-green-900 shadow-lg shadow-green-950/10 ring-1 ring-white/70 backdrop-blur-md"
                  : disabled
                    ? "cursor-not-allowed text-slate-300"
                    : "text-green-950/80 active:scale-95 hover:bg-white/46"
              }`}
            >
              {step.icon}
              <span className="truncate">{step.label}</span>
            </button>
          );
        })}
      </section>
    </nav>
  );
}
