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

type NavigatorWithVirtualKeyboard = Navigator & {
  virtualKeyboard?: { overlaysContent: boolean };
};

/** Mirrors `data-keyboard-open` for syncDockViewportLift (module-level). */
let dockKeyboardActive = false;

function isStandalonePwa() {
  if (typeof window === "undefined") return false;
  const mqStandalone = window.matchMedia("(display-mode: standalone)").matches;
  const mqFullscreen = window.matchMedia("(display-mode: fullscreen)").matches;
  const iosStandalone =
    "standalone" in window.navigator &&
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
  return mqStandalone || mqFullscreen || iosStandalone;
}

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

function setHtmlKeyboardOpen(open: boolean) {
  dockKeyboardActive = open;
  if (open) {
    document.documentElement.dataset.keyboardOpen = "true";
  } else {
    delete document.documentElement.dataset.keyboardOpen;
  }
}

function syncDockViewportLift() {
  const vv = window.visualViewport;
  if (!vv) {
    document.documentElement.style.setProperty("--dock-vv-lift", "0px");
    return;
  }

  // Installed PWA: never shift the dock with the visual viewport.
  // Keyboard overlays content; the dock hides instead of riding up.
  // Applying lift here is what made the dock visibly jump on focus.
  if (isStandalonePwa()) {
    document.documentElement.style.setProperty("--dock-vv-lift", "0px");
    return;
  }

  // How far the visual viewport has shrunk/shifted — browsers that pin
  // `position: fixed` to the visual viewport lift the dock by this amount.
  const raw = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);

  // Browser tabs: ignore tiny URL-bar noise; keep real keyboard compensation.
  const lift = dockKeyboardActive || raw >= 80 ? raw : 0;
  document.documentElement.style.setProperty("--dock-vv-lift", `${lift}px`);
}

/**
 * True when the focused field is already high enough that iOS scroll-into-view
 * would only nudge the layout (home search) — not when a lower field needs it.
 */
function shouldBlockFocusScrollNudge(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  const vvHeight = window.visualViewport?.height || window.innerHeight;
  return window.scrollY < 160 || rect.top < vvHeight * 0.42;
}

/** Cancel iOS/PWA scroll-into-view nudge while the soft keyboard opens. */
function pinScrollAgainstKeyboardNudge(anchorY: number) {
  if (anchorY >= 160) return;

  const pin = () => {
    if (!dockKeyboardActive) return;
    if (!likelySoftKeyboardDevice()) return;
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  };

  pin();
  requestAnimationFrame(pin);
  window.setTimeout(pin, 50);
  window.setTimeout(pin, 150);
  window.setTimeout(pin, 320);
}

function likelySoftKeyboardDevice() {
  return window.matchMedia("(pointer: coarse), (max-width: 768px)").matches;
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

  const scrollAway = scrollHidden && !keyboardOpen;

  useEffect(() => {
    queueMicrotask(() => setCanPortal(true));
  }, []);

  useEffect(() => {
    const hidden = scrollHidden || keyboardOpen;
    document.documentElement.dataset.dockHidden = hidden ? "true" : "false";
    return () => {
      delete document.documentElement.dataset.dockHidden;
    };
  }, [scrollHidden, keyboardOpen]);

  useEffect(() => {
    keyboardOpenRef.current = keyboardOpen;
  }, [keyboardOpen]);

  // Leaving a screen should never keep a focus/keyboard dock offset around.
  useEffect(() => {
    setHtmlKeyboardOpen(false);
    keyboardOpenRef.current = false;
    setKeyboardOpen(false);
    setScrollHidden(false);
    syncDockViewportLift();
  }, [currentStep]);

  useEffect(() => {
    // Chromium: keep layout stable; keyboard overlays instead of resizing.
    const vk = (navigator as NavigatorWithVirtualKeyboard).virtualKeyboard;
    if (vk) vk.overlaysContent = true;

    function setKeyboard(next: boolean) {
      // Sync DOM before React paint so the dock never rides the keyboard up.
      setHtmlKeyboardOpen(next);
      keyboardOpenRef.current = next;
      setKeyboardOpen(next);
      if (next) setScrollHidden(true);
      syncDockViewportLift();
    }

    function settleDockAfterKeyboard() {
      syncDockViewportLift();

      const restoreLayout = () => {
        if (dockKeyboardActive) return;
        syncDockViewportLift();
        // Always bring the dock back — iOS scroll-into-view often leaves
        // scrollY >= 80 so the old gate kept the dock hidden.
        setScrollHidden(false);

        const vv = window.visualViewport;
        // Undo residual visual-viewport offset after the soft keyboard.
        if (vv && vv.offsetTop > 0) {
          window.scrollTo(0, Math.max(0, window.scrollY));
        }
        // Home / short screens: snap back if iOS only nudged the page for the input.
        if (window.scrollY > 0 && window.scrollY < 160) {
          window.scrollTo(0, 0);
        }
      };

      window.setTimeout(restoreLayout, 280);
      // PWA keyboards animate longer; clear any leftover lift after settle.
      if (isStandalonePwa()) {
        window.setTimeout(restoreLayout, 500);
        window.setTimeout(() => {
          if (!dockKeyboardActive) syncDockViewportLift();
        }, 700);
      }
    }

    function onFocusIn(event: FocusEvent) {
      if (!isTextEditable(event.target)) return;
      if (blurTimer.current != null) {
        window.clearTimeout(blurTimer.current);
        blurTimer.current = null;
      }
      // Desktop mouse/keyboard focus must not hide or shift the dock.
      if (!likelySoftKeyboardDevice()) {
        syncDockViewportLift();
        return;
      }
      const anchorY = window.scrollY;
      setKeyboard(true);
      pinScrollAgainstKeyboardNudge(anchorY);
    }

    function onFocusOut() {
      if (blurTimer.current != null) window.clearTimeout(blurTimer.current);
      // Allow focus to move between fields without flashing the dock.
      blurTimer.current = window.setTimeout(() => {
        blurTimer.current = null;
        if (isTextEditable(document.activeElement)) return;
        setKeyboard(false);
        setScrollHidden(false);
        settleDockAfterKeyboard();
      }, 160);
    }

    // Hide dock before the keyboard + visualViewport can lift chrome.
    function onPointerDownCapture(event: PointerEvent) {
      if (!likelySoftKeyboardDevice()) return;
      if (event.pointerType === "mouse") return;
      if (!isTextEditable(event.target)) return;

      const el = event.target;
      if (!(el instanceof HTMLElement)) return;

      const anchorY = window.scrollY;
      // Instant hide — do this on press, not after focus/keyboard animation.
      setKeyboard(true);
      syncDockViewportLift();

      // PWA only: intercept default focus-scroll when the field is already high
      // on screen (home search). Lower fields still need native scroll-into-view.
      if (
        isStandalonePwa() &&
        document.activeElement !== el &&
        shouldBlockFocusScrollNudge(el)
      ) {
        event.preventDefault();
        el.focus({ preventScroll: true });
        pinScrollAgainstKeyboardNudge(anchorY);
      }
    }

    function syncViewportKeyboard() {
      syncDockViewportLift();
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
      const likelyKeyboard = shrinkage > 120;
      if (likelyKeyboard) {
        setKeyboard(true);
        if (isStandalonePwa()) {
          pinScrollAgainstKeyboardNudge(window.scrollY < 160 ? 0 : window.scrollY);
        }
        return;
      }
      // Do not keep the dock hidden just because an input is focused on desktop,
      // or after the soft keyboard has fully closed with residual focus.
      if (!isTextEditable(document.activeElement) || !likelySoftKeyboardDevice()) {
        if (keyboardOpenRef.current) {
          setKeyboard(false);
          settleDockAfterKeyboard();
        } else {
          syncDockViewportLift();
        }
        setScrollHidden(false);
      }
    }

    baselineViewportHeight.current = Math.max(
      window.visualViewport?.height || 0,
      window.innerHeight
    );
    syncDockViewportLift();
    setHtmlKeyboardOpen(isTextEditable(document.activeElement));

    document.addEventListener("focusin", onFocusIn);
    document.addEventListener("focusout", onFocusOut);
    document.addEventListener("pointerdown", onPointerDownCapture, {
      capture: true,
      passive: false,
    });
    window.visualViewport?.addEventListener("resize", syncViewportKeyboard);
    window.visualViewport?.addEventListener("scroll", syncViewportKeyboard);
    window.addEventListener("resize", syncDockViewportLift);

    return () => {
      document.removeEventListener("focusin", onFocusIn);
      document.removeEventListener("focusout", onFocusOut);
      document.removeEventListener("pointerdown", onPointerDownCapture, true);
      window.visualViewport?.removeEventListener("resize", syncViewportKeyboard);
      window.visualViewport?.removeEventListener("scroll", syncViewportKeyboard);
      window.removeEventListener("resize", syncDockViewportLift);
      if (blurTimer.current != null) window.clearTimeout(blurTimer.current);
      setHtmlKeyboardOpen(false);
      document.documentElement.style.removeProperty("--dock-vv-lift");
      dockKeyboardActive = false;
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
          aria-hidden={keyboardOpen || undefined}
          className={`app-dock${keyboardOpen ? " app-dock--keyboard" : ""}${
            scrollAway ? " app-dock--scroll-hidden" : ""
          }`}
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
                  tabIndex={keyboardOpen ? -1 : undefined}
                  onClick={() => onStepChange(step.id)}
                  data-tour={
                    step.id === "calculators" ? "open-calculators" : undefined
                  }
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
