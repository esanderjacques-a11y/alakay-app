export const IMPORT_CACHE_STORAGE_KEY = "cultosol_import_cache_v1";
export const IMPORT_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const IMPORT_CACHE_MAX_ENTRIES = 12;

export type CachedImportMetadata = {
  labName?: string;
  clientName?: string;
  farmName?: string;
  lotName?: string;
  cropName?: string;
  reportDate?: string;
  sampleId?: string;
  analysisType?: string;
};

export type CachedImportRow = {
  id: string;
  rowNumber: number;
  rawParameter: string;
  matchedParameterKey: string | null;
  value: string;
  unit: string | null;
  sampleName: string | null;
  source: string | null;
  selectedUnitId: number | null;
  selectedUnitDisplayKey: string | null;
  status: "matched" | "unmatched" | "invalid";
  message: string;
  selected: boolean;
  reportReferenceRange?: string | null;
  reportRating?: string | null;
};

export type CachedImportEntry = {
  id: string;
  sourceLabel: string;
  sourceKind: "file" | "scan" | "text";
  createdAt: string;
  revisedAt: string;
  expiresAt: string;
  validatedAt: string | null;
  metadata?: CachedImportMetadata;
  rows: CachedImportRow[];
  matchedCount: number;
  reviewCount: number;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function readStore(): CachedImportEntry[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(IMPORT_CACHE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CachedImportEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStore(entries: CachedImportEntry[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(IMPORT_CACHE_STORAGE_KEY, JSON.stringify(entries));
}

function computeExpiry(fromIso: string) {
  return new Date(new Date(fromIso).getTime() + IMPORT_CACHE_TTL_MS).toISOString();
}

function isExpired(entry: CachedImportEntry, now = Date.now()) {
  if (entry.validatedAt) return true;
  return new Date(entry.expiresAt).getTime() <= now;
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `import-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function purgeExpiredImportCache(now = Date.now()): CachedImportEntry[] {
  const kept = readStore().filter((entry) => !isExpired(entry, now));
  writeStore(kept);
  return kept;
}

export function listImportCache(): CachedImportEntry[] {
  return purgeExpiredImportCache().sort(
    (a, b) => new Date(b.revisedAt).getTime() - new Date(a.revisedAt).getTime()
  );
}

export function getImportCache(id: string): CachedImportEntry | null {
  return listImportCache().find((entry) => entry.id === id) ?? null;
}

export function getLatestImportCache(): CachedImportEntry | null {
  return listImportCache()[0] ?? null;
}

export type UpsertImportCacheInput = {
  id?: string;
  sourceLabel: string;
  sourceKind: "file" | "scan" | "text";
  metadata?: CachedImportMetadata;
  rows: CachedImportRow[];
};

export function upsertImportCacheDraft(input: UpsertImportCacheInput): string {
  const nowIso = new Date().toISOString();
  const entries = purgeExpiredImportCache();
  const existingIndex = input.id
    ? entries.findIndex((entry) => entry.id === input.id)
    : -1;
  const existing = existingIndex >= 0 ? entries[existingIndex] : null;
  const id = input.id || existing?.id || createId();
  const revisedAt = nowIso;
  const matchedCount = input.rows.filter((row) => row.status === "matched").length;
  const reviewCount = input.rows.length - matchedCount;

  const next: CachedImportEntry = {
    id,
    sourceLabel: input.sourceLabel,
    sourceKind: input.sourceKind,
    createdAt: existing?.createdAt ?? nowIso,
    revisedAt,
    expiresAt: computeExpiry(revisedAt),
    validatedAt: null,
    metadata: input.metadata,
    rows: input.rows,
    matchedCount,
    reviewCount,
  };

  const without = entries.filter((entry) => entry.id !== id);
  const merged = [next, ...without].slice(0, IMPORT_CACHE_MAX_ENTRIES);
  writeStore(merged);
  return id;
}

export function touchImportCache(id: string) {
  const entries = purgeExpiredImportCache();
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return;
  const revisedAt = new Date().toISOString();
  entries[index] = {
    ...entries[index],
    revisedAt,
    expiresAt: computeExpiry(revisedAt),
  };
  writeStore(entries);
}

export function markImportCacheValidated(id: string) {
  const entries = purgeExpiredImportCache().filter((entry) => entry.id !== id);
  writeStore(entries);
}

export function removeImportCache(id: string) {
  writeStore(purgeExpiredImportCache().filter((entry) => entry.id !== id));
}

export function formatImportCacheExpiry(expiresAt: string, now = Date.now()) {
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return "Expired";
  const hours = Math.floor(ms / (60 * 60 * 1000));
  const minutes = Math.ceil((ms % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

export function migrateLegacyImportMemory() {
  if (!isBrowser()) return;
  try {
    const legacyRaw = window.localStorage.getItem("cultosol_import_memory");
    if (!legacyRaw) return;
    const parsed = JSON.parse(legacyRaw) as {
      text?: string;
      rows?: Array<{
        parameter: string;
        value: string;
        unit?: string;
        sample?: string;
        source?: string;
      }>;
      metadata?: CachedImportMetadata;
      savedAt?: string;
    };
    if (!parsed.rows?.length) {
      window.localStorage.removeItem("cultosol_import_memory");
      return;
    }
    const rows: CachedImportRow[] = parsed.rows.map((row, index) => ({
      id: `legacy-${index}`,
      rowNumber: index + 2,
      rawParameter: row.parameter,
      matchedParameterKey: null,
      value: String(row.value ?? ""),
      unit: row.unit || null,
      sampleName: row.sample || null,
      source: row.source || null,
      selectedUnitId: null,
      selectedUnitDisplayKey: null,
      status: "unmatched",
      message: "Review match.",
      selected: false,
    }));
    upsertImportCacheDraft({
      sourceLabel: "Saved import",
      sourceKind: "text",
      metadata: parsed.metadata,
      rows,
    });
    window.localStorage.removeItem("cultosol_import_memory");
  } catch {
    /* ignore corrupt legacy payload */
  }
}
