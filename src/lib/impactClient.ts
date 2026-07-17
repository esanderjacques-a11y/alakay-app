const IMPACT_CACHE_KEY = "cultosol_impact_cache_v1";
const IMPACT_CACHE_TTL_MS = 2 * 60 * 1000;

type ImpactCacheEntry = {
  at: number;
  payload: unknown;
};

export function readImpactCache<T>(): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(IMPACT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ImpactCacheEntry;
    if (!parsed?.at || Date.now() - parsed.at > IMPACT_CACHE_TTL_MS) {
      sessionStorage.removeItem(IMPACT_CACHE_KEY);
      return null;
    }
    return parsed.payload as T;
  } catch {
    return null;
  }
}

export function writeImpactCache(payload: unknown) {
  if (typeof window === "undefined") return;
  try {
    const entry: ImpactCacheEntry = { at: Date.now(), payload };
    sessionStorage.setItem(IMPACT_CACHE_KEY, JSON.stringify(entry));
  } catch {
    // Ignore quota / private mode errors.
  }
}

export async function fetchImpactPayload(signal?: AbortSignal) {
  const response = await fetch("/api/impact", { signal });
  const payload = (await response.json()) as unknown;
  if (!response.ok) {
    throw new Error("impact_fetch_failed");
  }
  writeImpactCache(payload);
  return payload;
}

export function prefetchImpactPayload() {
  if (typeof window === "undefined") return;
  if (readImpactCache()) return;
  void fetchImpactPayload().catch(() => undefined);
}
