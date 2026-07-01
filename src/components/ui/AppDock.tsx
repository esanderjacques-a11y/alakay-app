"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const [hidden, setHidden] = useState(false);
  const [canPortal, setCanPortal] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    queueMicrotask(() => setCanPortal(true));
  }, []);

  useEffect(() => {
    document.documentElement.dataset.dockHidden = hidden ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.dockHidden;
    };
  }, [hidden]);

  useEffect(() => {
    function onScroll() {
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        const y = window.scrollY;
        const delta = y - lastScrollY.current;
        if (y < 60) {
          setHidden(false);
        } else if (delta > 6) {
          setHidden(true);
        } else if (delta < -6) {
          setHidden(false);
        }
        lastScrollY.current = y;
        ticking.current = false;
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const steps: DockStep[] = [
    { id: "home", label: labels.home, icon: <Home size={22} /> },
    { id: "setup", label: labels.setup, icon: <ClipboardList size={22} /> },
    { id: "values", label: labels.values, icon: <FlaskConical size={22} /> },
    {
      id: "calculators",
      label: labels.calculators,
      icon: <Calculator size={22} />,
    },
    {
      id: "history",
      label: labels.history,
      icon: <History size={22} />,
      disabled: !hasHistoryOrProgress,
    },
  ];

  const visibleSteps: DockStep[] = hasResults
    ? [
        ...steps.slice(0, 3),
        {
          id: "results" as AppStep,
          label: labels.results,
          icon: <LineChart size={22} />,
        },
        steps[3],
        steps[4],
      ]
    : steps;

  return canPortal
    ? createPortal(
        <nav
          aria-label="Main navigation"
          className="app-dock"
          style={{
            transform: hidden ? "translateY(100%)" : "translateY(0)",
            transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div className="mx-auto flex max-w-2xl items-stretch justify-around">
            {visibleSteps.map((step) => {
              const active = currentStep === step.id;
              const disabled = step.disabled;

              return (
                <button
                  key={step.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => onStepChange(step.id)}
                  className={`touch-target flex min-h-[3.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 py-1.5 transition-all ${
                    active
                      ? "app-dock-tab-active"
                      : disabled
                        ? "cursor-not-allowed opacity-30"
                        : "text-slate-500 hover:text-slate-700 active:scale-95"
                  }`}
                >
                  <span
                    className={`dock-icon-wrap flex items-center justify-center rounded-2xl transition-all duration-200 ${
                      active ? "w-14 h-7" : "w-8 h-7"
                    }`}
                  >
                    {step.icon}
                  </span>
                  <span
                    className={`text-[10px] font-semibold leading-tight transition-all ${
                      active ? "" : "text-slate-500"
                    } ${disabled ? "opacity-50" : ""}`}
                  >
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>,
        document.body
      )
    : null;
}
