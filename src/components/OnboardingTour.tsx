"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import type { AppStep } from "@/lib/appSteps";
import {
  ONBOARDING_TOUR_STEPS,
  getTourTarget,
  type OnboardingTourStep,
} from "@/lib/onboardingTour";

export type OnboardingTourLabels = {
  skip: string;
  previous: string;
  next: string;
  finish: string;
  stepOf: (current: number, total: number) => string;
  titles: Record<OnboardingTourStep["titleKey"], string>;
  bodies: Record<OnboardingTourStep["bodyKey"], string>;
};

type Props = {
  open: boolean;
  labels: OnboardingTourLabels;
  onNavigate: (step: AppStep) => void;
  onComplete: () => void;
};

type SpotlightRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type TooltipPlacement = "below" | "above" | "center";

const PAD = 10;
const TARGET_WAIT_MS = 3200;
const TARGET_POLL_MS = 40;
const NAV_SETTLE_MS = 180;
const SCROLL_SETTLE_MS = 320;
const CARD_FADE_MS = 180;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) {
      resolve();
      return;
    }
    const timer = window.setTimeout(() => resolve(), ms);
    signal.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        resolve();
      },
      { once: true }
    );
  });
}

async function waitForTarget(
  selector: string,
  signal: AbortSignal
): Promise<HTMLElement | null> {
  const started = performance.now();
  while (!signal.aborted && performance.now() - started < TARGET_WAIT_MS) {
    const el = getTourTarget(selector);
    if (el) {
      const style = window.getComputedStyle(el);
      if (style.display !== "none" && style.visibility !== "hidden") {
        const rect = el.getBoundingClientRect();
        if (rect.width >= 2 && rect.height >= 2) return el;
      }
    }
    await sleep(TARGET_POLL_MS, signal);
  }
  return signal.aborted ? null : getTourTarget(selector);
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

export default function OnboardingTour({
  open,
  labels,
  onNavigate,
  onComplete,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null);
  const [placement, setPlacement] = useState<TooltipPlacement>("below");
  const [ready, setReady] = useState(false);
  const [moving, setMoving] = useState(false);
  const [cardStyle, setCardStyle] = useState<CSSProperties>({});
  const cardRef = useRef<HTMLDivElement | null>(null);
  const highlightedRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const onNavigateRef = useRef(onNavigate);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onNavigateRef.current = onNavigate;
    onCompleteRef.current = onComplete;
  }, [onNavigate, onComplete]);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  const clearHighlight = useCallback(() => {
    const prev = highlightedRef.current;
    if (prev) {
      prev.classList.remove("onboarding-tour-target");
      highlightedRef.current = null;
    }
  }, []);

  const finish = useCallback(() => {
    abortRef.current?.abort();
    clearHighlight();
    setReady(false);
    setMoving(false);
    setSpotlight(null);
    onCompleteRef.current();
  }, [clearHighlight]);

  const measure = useCallback((el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const next: SpotlightRect = {
      top: rect.top - PAD,
      left: rect.left - PAD,
      width: Math.max(rect.width + PAD * 2, 44),
      height: Math.max(rect.height + PAD * 2, 44),
    };
    setSpotlight(next);

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      setPlacement("above");
    } else if (rect.height > window.innerHeight * 0.55) {
      setPlacement("center");
    } else {
      setPlacement("below");
    }
  }, []);

  const activateStep = useCallback(
    async (index: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setMoving(true);
      setReady(false);
      // Keep previous spotlight mounted so CSS can morph to the next target.
      clearHighlight();

      const ordered = ONBOARDING_TOUR_STEPS;
      let cursor = index;

      while (cursor < ordered.length) {
        if (controller.signal.aborted) return;
        const step = ordered[cursor];
        onNavigateRef.current(step.appStep);

        await sleep(NAV_SETTLE_MS, controller.signal);
        if (controller.signal.aborted) return;
        await nextFrame();

        const el = await waitForTarget(step.target, controller.signal);
        if (controller.signal.aborted) return;

        if (!el) {
          cursor += 1;
          continue;
        }

        el.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });

        await sleep(SCROLL_SETTLE_MS, controller.signal);
        if (controller.signal.aborted) return;
        await nextFrame();

        const settled = getTourTarget(step.target) || el;
        clearHighlight();
        settled.classList.add("onboarding-tour-target");
        highlightedRef.current = settled;
        measure(settled);
        setStepIndex(cursor);

        // Let spotlight geometry transition, then fade the card in.
        await sleep(CARD_FADE_MS, controller.signal);
        if (controller.signal.aborted) return;
        setMoving(false);
        setReady(true);
        return;
      }

      finish();
    },
    [clearHighlight, finish, measure]
  );

  useEffect(() => {
    if (!open) {
      delete document.documentElement.dataset.onboardingTour;
      abortRef.current?.abort();
      clearHighlight();
      setReady(false);
      setMoving(false);
      setSpotlight(null);
      setStepIndex(0);
      return;
    }
    document.documentElement.dataset.onboardingTour = "true";
    void activateStep(0);
    return () => {
      delete document.documentElement.dataset.onboardingTour;
      abortRef.current?.abort();
      clearHighlight();
    };
  }, [open, activateStep, clearHighlight]);

  useEffect(() => {
    if (!open || !ready) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      }
    }

    function onReposition() {
      const el = highlightedRef.current;
      if (el) measure(el);
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, ready, finish, measure]);

  useLayoutEffect(() => {
    if (!open || !ready || !spotlight || !cardRef.current) return;

    const card = cardRef.current.getBoundingClientRect();
    const margin = 12;
    const maxLeft = window.innerWidth - card.width - margin;
    const preferredLeft = spotlight.left + spotlight.width / 2 - card.width / 2;
    const left = clamp(preferredLeft, margin, Math.max(margin, maxLeft));

    let top: number;
    if (placement === "above") {
      top = spotlight.top - card.height - 14;
    } else if (placement === "center") {
      top = clamp(
        window.innerHeight / 2 - card.height / 2,
        margin,
        window.innerHeight - card.height - margin
      );
    } else {
      top = spotlight.top + spotlight.height + 14;
    }

    top = clamp(top, margin, window.innerHeight - card.height - margin);
    setCardStyle({ top, left });
  }, [open, ready, spotlight, placement, stepIndex, labels]);

  if (!mounted || !open) return null;

  const step = ONBOARDING_TOUR_STEPS[stepIndex];
  const total = ONBOARDING_TOUR_STEPS.length;
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= total - 1;
  const title = step ? labels.titles[step.titleKey] : "";
  const body = step ? labels.bodies[step.bodyKey] : "";

  return createPortal(
    <div
      className={`onboarding-tour${ready ? " onboarding-tour--ready" : ""}${
        moving ? " onboarding-tour--moving" : ""
      }`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-tour-title"
      aria-describedby="onboarding-tour-body"
    >
      <div className="onboarding-tour__blocker" aria-hidden />

      {spotlight ? (
        <div
          className="onboarding-tour__spotlight"
          style={{
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
          }}
          aria-hidden
        />
      ) : null}

      <div
        ref={cardRef}
        className={`onboarding-tour__card onboarding-tour__card--${placement}`}
        style={cardStyle}
      >
        <div className="onboarding-tour__meta">
          <span className="onboarding-tour__progress">
            {labels.stepOf(stepIndex + 1, total)}
          </span>
          <button
            type="button"
            className="onboarding-tour__skip"
            onClick={finish}
          >
            {labels.skip}
          </button>
        </div>

        <h2 id="onboarding-tour-title" className="onboarding-tour__title">
          {title}
        </h2>
        <p id="onboarding-tour-body" className="onboarding-tour__body">
          {body}
        </p>

        <div className="onboarding-tour__actions">
          {!isFirst ? (
            <button
              type="button"
              className="onboarding-tour__btn onboarding-tour__btn--ghost"
              onClick={() => void activateStep(Math.max(0, stepIndex - 1))}
            >
              {labels.previous}
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            className="onboarding-tour__btn onboarding-tour__btn--primary"
            onClick={() => {
              if (isLast) {
                finish();
                return;
              }
              void activateStep(stepIndex + 1);
            }}
          >
            {isLast ? labels.finish : labels.next}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
