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

function isTextEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;

  const tag = target.tagName;
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag !== "INPUT") return false;

  const type = (target as HTMLInputElement).type || "text";
  return ![
    "button",
    "checkbox",
    "color",
    "file",
    "hidden",
    "image",
    "radio",
    "range",
    "reset",
    "submit",
  ].includes(type);
}

export default function AppDock({
  currentStep,
  onStepChange,
  hasResults,
  hasHistoryOrProgress,
  labels,
}: Props) {
  const [scrollHidden, setScrollHidden] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [canPortal, setCanPortal] = useState(false);
  const lastScrollY = useRef(0);
  const ticking = useRef(false);
  const keyboardOpenRef = useRef(false);
  const blurTimer = useRef<number | null>(null);
  const baselineViewportHeight = useRef(0);

  const hidden = scrollHidden || keyboardOpen;

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
    keyboardOpenRef.current = keyboardOpen;
  }, [keyboardOpen]);

  useEffect(() => {
    function setKeyboard(next: boolean) {
      keyboardOpenRef.current = next;
      setKeyboardOpen(next);
      if (next) setScrollHidden(true);
    }

    function onFocusIn(event: FocusEvent) {
      if (!isTextEditable(event.target)) return;
      if (blurTimer.current != null) {
        window.clearTimeout(blurTimer.current);
        blurTimer.current = null;
      }
      setKeyboard(true);
    }

    function onFocusOut() {
      if (blurTimer.current != null) window.clearTimeout(blurTimer.current);
      // Allow focus to move between fields without flashing the dock.
      blurTimer.current = window.setTimeout(() => {
        blurTimer.current = null;
        if (isTextEditable(document.activeElement)) return;
        setKeyboard(false);
        if (window.scrollY < 60) setScrollHidden(false);
      }, 120);
    }

    function syncViewportKeyboard() {
      const vv = window.visualViewport;
      if (!vv) return;
      if (!baselineViewportHeight.current) {
        baselineViewportHeight.current = Math.max(vv.height, window.innerHeight);
      }
      // Grow baseline when chrome expands (keyboard closed / URL bar hidden).
      if (vv.height > baselineViewportHeight.current) {
        baselineViewportHeight.current = vv.height;
      }
      const shrinkage = baselineViewportHeight.current - vv.height;
      const likelyKeyboard = shrinkage > 140;
      if (likelyKeyboard) {
        setKeyboard(true);
        return;
      }
      if (!isTextEditable(document.activeElement)) {
        setKeyboard(false);
        if (window.scrollY < 60) setScrollHidden(false);
      }
    }

    baselineViewportHeight.current = Math.max(
      window.visualViewport?.height || 0,
      window.innerHeight
    );

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    window.visualViewport?.addEventListener("resize", syncViewportKeyboard);
    window.visualViewport?.addEventListener("scroll", syncViewportKeyboard);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      window.visualViewport?.removeEventListener("resize", syncViewportKeyboard);
      window.visualViewport?.removeEventListener("scroll", syncViewportKeyboard);
      if (blurTimer.current != null) window.clearTimeout(blurTimer.current);
    };
  }, []);

  useEffect(() => {
    function onScroll() {
      if (keyboardOpenRef.current) return;
      if (ticking.current) return;
      ticking.current = true;
      window.requestAnimationFrame(() => {
        if (keyboardOpenRef.current) {
          ticking.current = false;
          return;
        }
        const y = window.scrollY;
        const delta = y - lastScrollY.current;
        if (y < 60) {
          setScrollHidden(false);
        } else if (delta > 6) {
          setScrollHidden(true);
        } else if (delta < -6) {
          setScrollHidden(false);
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
          className={`app-dock${keyboardOpen ? " app-dock--keyboard" : ""}`}
          style={{
            transform: hidden ? "translateY(100%)" : "translateY(0)",
            transition: "transform 0.28s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <div className="app-dock__inner flex items-stretch justify-around">
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
                        ? "app-dock-tab cursor-not-allowed opacity-30"
                        : "app-dock-tab hover:text-slate-700 active:scale-95"
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
                    className={`app-dock-tab__label text-[10px] font-semibold leading-tight transition-all ${
                      disabled ? "opacity-50" : ""
                    }`}
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
