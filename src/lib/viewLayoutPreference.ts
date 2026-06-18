/**
 * View layout preference (list vs grid) persisted in localStorage.
 *
 * Usage:
 * - `useViewLayoutPreference('calculator-fields')` in CalculatorHub
 * - Future: `useViewLayoutPreference('values-entry')` on the Values page
 *   with `<ViewLayoutToggle value={layout} onChange={setLayout} />`
 *
 * Storage key: `alakay-view-layout-<scope>`
 */

export type ViewLayoutMode = "list" | "grid";

const STORAGE_PREFIX = "alakay-view-layout-";

export function viewLayoutStorageKey(scope: string) {
  return `${STORAGE_PREFIX}${scope}`;
}

export function readViewLayoutPreference(
  scope: string,
  fallback: ViewLayoutMode = "grid"
): ViewLayoutMode {
  if (typeof window === "undefined") return fallback;

  const stored = window.localStorage.getItem(viewLayoutStorageKey(scope));
  if (stored === "list" || stored === "grid") return stored;
  return fallback;
}

export function persistViewLayoutPreference(scope: string, mode: ViewLayoutMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(viewLayoutStorageKey(scope), mode);
}
