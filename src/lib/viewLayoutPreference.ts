/**
 * View layout preference (list vs grid) persisted in localStorage.
 *
 * Usage:
 * - Values entry (list / grid / pad) via `useViewLayoutPreference('values-entry')`
 * - Calculator hub is grid-only (no layout toggle)
 *
 * Storage key: `cultosol-view-layout-<scope>`
 */

export type ViewLayoutMode = "list" | "grid" | "pad";

const STORAGE_PREFIX = "cultosol-view-layout-";

export function viewLayoutStorageKey(scope: string) {
  return `${STORAGE_PREFIX}${scope}`;
}

export function readViewLayoutPreference(
  scope: string,
  fallback: ViewLayoutMode = "grid"
): ViewLayoutMode {
  if (typeof window === "undefined") return fallback;

  const stored = window.localStorage.getItem(viewLayoutStorageKey(scope));
  if (stored === "list" || stored === "grid" || stored === "pad") return stored;
  return fallback;
}

export function persistViewLayoutPreference(scope: string, mode: ViewLayoutMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(viewLayoutStorageKey(scope), mode);
}
