/**
 * Persisted favorite calculator keys for the Calculator Hub.
 * Storage key: `cultosol-calculator-favorites`
 */

const STORAGE_KEY = "cultosol-calculator-favorites";

export type FavoriteCalculatorKey =
  | "cic"
  | "amendment"
  | "fertilizer"
  | "fertilizerCost"
  | "fertilizerFormulation"
  | "dop"
  | "uptake"
  | "salinity"
  | "graphs";

const ALLOWED = new Set<string>([
  "cic",
  "amendment",
  "fertilizer",
  "fertilizerCost",
  "fertilizerFormulation",
  "dop",
  "uptake",
  "salinity",
  "graphs",
]);

function sanitize(keys: unknown): FavoriteCalculatorKey[] {
  if (!Array.isArray(keys)) return [];
  const seen = new Set<string>();
  const out: FavoriteCalculatorKey[] = [];
  for (const key of keys) {
    if (typeof key !== "string" || !ALLOWED.has(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key as FavoriteCalculatorKey);
  }
  return out;
}

export function readCalculatorFavorites(): FavoriteCalculatorKey[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function persistCalculatorFavorites(keys: FavoriteCalculatorKey[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitize(keys)));
}

export function toggleCalculatorFavorite(
  key: FavoriteCalculatorKey,
  current: FavoriteCalculatorKey[] = readCalculatorFavorites()
): FavoriteCalculatorKey[] {
  const next = current.includes(key)
    ? current.filter((item) => item !== key)
    : [...current, key];
  persistCalculatorFavorites(next);
  return next;
}

export function isFavoriteCalculatorKey(key: string): key is FavoriteCalculatorKey {
  return ALLOWED.has(key);
}
