import type { AppStep } from "@/lib/appSteps";

export const ONBOARDING_TOUR_STORAGE_KEY = "cultosol_onboarding_tour_v1";

export type OnboardingTourStepId =
  | "input-data"
  | "setup-farm-crop"
  | "values-entry"
  | "save-analysis"
  | "open-calculators"
  | "generate-report";

export type OnboardingTourTitleKey =
  | "tourStepInputTitle"
  | "tourStepFarmCropTitle"
  | "tourStepValuesTitle"
  | "tourStepSaveTitle"
  | "tourStepCalculatorsTitle"
  | "tourStepReportTitle";

export type OnboardingTourBodyKey =
  | "tourStepInputBody"
  | "tourStepFarmCropBody"
  | "tourStepValuesBody"
  | "tourStepSaveBody"
  | "tourStepCalculatorsBody"
  | "tourStepReportBody";

export type OnboardingTourStep = {
  id: OnboardingTourStepId;
  /** Matches `[data-tour="..."]` on the target element. */
  target: string;
  /** Navigate here before measuring the target. */
  appStep: AppStep;
  titleKey: OnboardingTourTitleKey;
  bodyKey: OnboardingTourBodyKey;
};

/** Essential path: manual input → farm/crop → values → save → calculators → report. */
export const ONBOARDING_TOUR_STEPS: OnboardingTourStep[] = [
  {
    id: "input-data",
    target: "input-data",
    appStep: "home",
    titleKey: "tourStepInputTitle",
    bodyKey: "tourStepInputBody",
  },
  {
    id: "setup-farm-crop",
    target: "setup-farm-crop",
    appStep: "setup",
    titleKey: "tourStepFarmCropTitle",
    bodyKey: "tourStepFarmCropBody",
  },
  {
    id: "values-entry",
    target: "values-entry",
    appStep: "values",
    titleKey: "tourStepValuesTitle",
    bodyKey: "tourStepValuesBody",
  },
  {
    id: "save-analysis",
    target: "save-analysis",
    appStep: "values",
    titleKey: "tourStepSaveTitle",
    bodyKey: "tourStepSaveBody",
  },
  {
    id: "open-calculators",
    target: "open-calculators",
    appStep: "home",
    titleKey: "tourStepCalculatorsTitle",
    bodyKey: "tourStepCalculatorsBody",
  },
  {
    id: "generate-report",
    target: "generate-report",
    appStep: "calculators",
    titleKey: "tourStepReportTitle",
    bodyKey: "tourStepReportBody",
  },
];

function userScopedKey(userId: string) {
  return `${ONBOARDING_TOUR_STORAGE_KEY}:${userId}`;
}

export function hasCompletedOnboardingTour(userId?: string | null): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (window.localStorage.getItem(ONBOARDING_TOUR_STORAGE_KEY) === "1") {
      return true;
    }
    if (userId && window.localStorage.getItem(userScopedKey(userId)) === "1") {
      return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function markOnboardingTourComplete(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_TOUR_STORAGE_KEY, "1");
    if (userId) {
      window.localStorage.setItem(userScopedKey(userId), "1");
      markWelcomeSeen(userId);
    }
  } catch {
    /* private mode / quota */
  }
}

export function resetOnboardingTour(userId?: string | null) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDING_TOUR_STORAGE_KEY);
    if (userId) {
      window.localStorage.removeItem(userScopedKey(userId));
      window.localStorage.removeItem(welcomeSeenKey(userId));
    }
  } catch {
    /* ignore */
  }
}

function welcomeSeenKey(userId: string) {
  return `cultosol-welcome-seen-${userId}`;
}

/** True after the user has completed first-run welcome / tour. */
export function hasSeenWelcome(userId?: string | null): boolean {
  if (typeof window === "undefined" || !userId) return true;
  try {
    return window.localStorage.getItem(welcomeSeenKey(userId)) === "1";
  } catch {
    return true;
  }
}

export function markWelcomeSeen(userId?: string | null) {
  if (typeof window === "undefined" || !userId) return;
  try {
    window.localStorage.setItem(welcomeSeenKey(userId), "1");
  } catch {
    /* ignore */
  }
}

export function getTourTarget(selector: string): HTMLElement | null {
  if (typeof document === "undefined") return null;
  const matches = Array.from(
    document.querySelectorAll<HTMLElement>(`[data-tour="${selector}"]`)
  );
  let best: HTMLElement | null = null;
  let bestArea = 0;

  for (const el of matches) {
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    if (Number(style.opacity) === 0) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    // Prefer on-screen targets.
    if (
      rect.bottom < 0 ||
      rect.right < 0 ||
      rect.top > window.innerHeight ||
      rect.left > window.innerWidth
    ) {
      continue;
    }
    const area = rect.width * rect.height;
    if (area > bestArea) {
      best = el;
      bestArea = area;
    }
  }

  return best ?? matches[0] ?? null;
}
