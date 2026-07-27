/**
 * Persist Calculator Hub active page + mode across dock tab switches.
 * Storage key: `cultosol-calculator-hub-session`
 */

export type CalculatorHubMode = "guided" | "explorer";

export type CalculatorHubSession = {
  activeCalculator: string;
  hubMode: CalculatorHubMode;
  guidedIndex: number;
  /** When set, skip auto mode-from-values until values presence flips. */
  modeLockedByUser?: boolean;
};

type SessionStore = Record<string, CalculatorHubSession>;

const STORAGE_KEY = "cultosol-calculator-hub-session";

function storageScope(userId: string | null | undefined, sampleType: string) {
  return `${userId?.trim() || "guest"}::${sampleType}`;
}

function readStore(): SessionStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SessionStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStore(store: SessionStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // ignore quota
  }
}

export function readCalculatorHubSession(
  userId: string | null | undefined,
  sampleType: string
): CalculatorHubSession | null {
  const entry = readStore()[storageScope(userId, sampleType)];
  if (!entry || typeof entry.activeCalculator !== "string") return null;
  if (entry.hubMode !== "guided" && entry.hubMode !== "explorer") return null;
  return {
    activeCalculator: entry.activeCalculator,
    hubMode: entry.hubMode,
    guidedIndex:
      typeof entry.guidedIndex === "number" && entry.guidedIndex >= 0
        ? entry.guidedIndex
        : 0,
    modeLockedByUser: Boolean(entry.modeLockedByUser),
  };
}

export function writeCalculatorHubSession(
  userId: string | null | undefined,
  sampleType: string,
  session: CalculatorHubSession
) {
  const store = readStore();
  store[storageScope(userId, sampleType)] = session;
  writeStore(store);
}
