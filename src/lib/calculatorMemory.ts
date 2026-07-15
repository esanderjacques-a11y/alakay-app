/**
 * Persists calculator field edits in localStorage so they survive navigation
 * until the user changes them or taps “Import from Values”.
 *
 * Shared parameters (CEC, bases, bulk density, etc.) are mirrored across
 * calculator sections so a value entered in one calculator is available in others.
 */

export const CALCULATOR_MEMORY_KEY = "cultosol-calculator-memory-v1";
export const SHARED_MEMORY_SECTION = "shared";

export type CalculatorSampleScope = "soil" | "foliar";

export type CalculatorMemorySlice = {
  /** Nested: section id → field key → numeric value */
  fields: Record<string, Record<string, number>>;
  /** Nested: section id → field key → string value (crop keys, modes, …) */
  textFields?: Record<string, Record<string, string>>;
  /** Last lab fingerprint applied via Import (or auto-seed). */
  lastImportFingerprint?: string;
  lastImportAt?: string;
};

export type CalculatorMemoryStore = {
  version: 1;
  bySample: Partial<Record<CalculatorSampleScope, CalculatorMemorySlice>>;
};

type FieldRef = { section: string; key: string };

/** Cross-calculator parameter aliases → canonical shared key. */
const SHARED_FIELD_GROUPS: Array<{ sharedKey: string; fields: FieldRef[] }> = [
  {
    sharedKey: "cec",
    fields: [
      { section: "cic", key: "cec" },
      { section: "amendment", key: "cec" },
      { section: "lab", key: "cec" },
    ],
  },
  {
    sharedKey: "calcium",
    fields: [
      { section: "cic", key: "ca" },
      { section: "lab", key: "calcium" },
    ],
  },
  {
    sharedKey: "magnesium",
    fields: [
      { section: "cic", key: "mg" },
      { section: "fertilizer", key: "mg" },
      { section: "lab", key: "magnesium" },
    ],
  },
  {
    sharedKey: "potassium",
    fields: [
      { section: "cic", key: "k" },
      { section: "fertilizer", key: "k" },
      { section: "lab", key: "potassium" },
    ],
  },
  {
    sharedKey: "sodium",
    fields: [
      { section: "cic", key: "na" },
      { section: "lab", key: "sodium" },
    ],
  },
  {
    sharedKey: "ph",
    fields: [
      { section: "amendment", key: "currentPh" },
      { section: "lab", key: "ph" },
    ],
  },
  {
    sharedKey: "exchangeable_acidity",
    fields: [
      { section: "cic", key: "hAl" },
      { section: "amendment", key: "exchangeableAcidity" },
      { section: "lab", key: "exchangeable_acidity" },
    ],
  },
  {
    sharedKey: "aluminum",
    fields: [
      { section: "cic", key: "al" },
      { section: "amendment", key: "exchangeableAl" },
      { section: "lab", key: "aluminum" },
    ],
  },
  {
    sharedKey: "base_saturation",
    fields: [
      { section: "amendment", key: "baseSaturationCurrent" },
      { section: "lab", key: "base_saturation" },
    ],
  },
  {
    sharedKey: "bulk_density",
    fields: [
      { section: "amendment", key: "bulkDensity" },
      { section: "fertilizer", key: "bulkDensity" },
      { section: "lab", key: "bulk_density" },
    ],
  },
  {
    sharedKey: "depth_cm",
    fields: [
      { section: "amendment", key: "depthCm" },
      { section: "fertilizer", key: "depthCm" },
    ],
  },
  {
    sharedKey: "organic_matter",
    fields: [
      { section: "fertilizer", key: "organicMatter" },
      { section: "lab", key: "organic_matter" },
    ],
  },
  {
    sharedKey: "phosphorus",
    fields: [
      { section: "fertilizer", key: "p" },
      { section: "lab", key: "phosphorus" },
    ],
  },
  {
    sharedKey: "nitrogen",
    fields: [{ section: "lab", key: "nitrogen" }],
  },
];

const FIELD_TO_SHARED = new Map<string, string>();
const SHARED_TO_FIELDS = new Map<string, FieldRef[]>();

for (const group of SHARED_FIELD_GROUPS) {
  SHARED_TO_FIELDS.set(group.sharedKey, group.fields);
  for (const field of group.fields) {
    FIELD_TO_SHARED.set(`${field.section}.${field.key}`, group.sharedKey);
  }
}

function emptySlice(): CalculatorMemorySlice {
  return { fields: {} };
}

export function readCalculatorMemory(): CalculatorMemoryStore {
  if (typeof window === "undefined") {
    return { version: 1, bySample: {} };
  }
  try {
    const raw = window.localStorage.getItem(CALCULATOR_MEMORY_KEY);
    if (!raw) return { version: 1, bySample: {} };
    const parsed = JSON.parse(raw) as CalculatorMemoryStore;
    if (!parsed || parsed.version !== 1 || typeof parsed.bySample !== "object") {
      return { version: 1, bySample: {} };
    }
    return parsed;
  } catch {
    return { version: 1, bySample: {} };
  }
}

export function writeCalculatorMemory(store: CalculatorMemoryStore) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CALCULATOR_MEMORY_KEY, JSON.stringify(store));
  } catch {
    // Quota / private mode — ignore
  }
}

export function getMemorySlice(
  store: CalculatorMemoryStore,
  sampleType: CalculatorSampleScope
): CalculatorMemorySlice {
  return store.bySample[sampleType] || emptySlice();
}

function readDirectField(slice: CalculatorMemorySlice, section: string, key: string) {
  const value = slice.fields[section]?.[key];
  return Number.isFinite(value) ? Number(value) : undefined;
}

function writeDirectField(
  store: CalculatorMemoryStore,
  sampleType: CalculatorSampleScope,
  section: string,
  key: string,
  value: number
): CalculatorMemoryStore {
  const slice = getMemorySlice(store, sampleType);
  const sectionFields = { ...(slice.fields[section] || {}), [key]: value };
  const nextSlice: CalculatorMemorySlice = {
    ...slice,
    fields: { ...slice.fields, [section]: sectionFields },
  };
  return {
    ...store,
    bySample: { ...store.bySample, [sampleType]: nextSlice },
  };
}

export function sharedKeyForField(section: string, key: string): string | undefined {
  return FIELD_TO_SHARED.get(`${section}.${key}`);
}

/**
 * Resolve a remembered value: section field → shared mirror → sibling sections.
 */
export function getMemoryField(
  slice: CalculatorMemorySlice,
  section: string,
  key: string
): number | undefined {
  const direct = readDirectField(slice, section, key);
  if (direct !== undefined) return direct;

  const sharedKey = FIELD_TO_SHARED.get(`${section}.${key}`);
  if (!sharedKey) return undefined;

  const sharedValue = readDirectField(slice, SHARED_MEMORY_SECTION, sharedKey);
  if (sharedValue !== undefined) return sharedValue;

  const siblings = SHARED_TO_FIELDS.get(sharedKey) || [];
  for (const sibling of siblings) {
    if (sibling.section === section && sibling.key === key) continue;
    const value = readDirectField(slice, sibling.section, sibling.key);
    if (value !== undefined) return value;
  }
  return undefined;
}

/**
 * Persist a field and mirror it across shared aliases used by other calculators.
 */
export function setMemoryField(
  store: CalculatorMemoryStore,
  sampleType: CalculatorSampleScope,
  section: string,
  key: string,
  value: number
): CalculatorMemoryStore {
  let next = writeDirectField(store, sampleType, section, key, value);
  const sharedKey = FIELD_TO_SHARED.get(`${section}.${key}`);
  if (!sharedKey) return next;

  next = writeDirectField(next, sampleType, SHARED_MEMORY_SECTION, sharedKey, value);
  for (const sibling of SHARED_TO_FIELDS.get(sharedKey) || []) {
    if (sibling.section === section && sibling.key === key) continue;
    next = writeDirectField(next, sampleType, sibling.section, sibling.key, value);
  }
  return next;
}

export function setMemoryFields(
  store: CalculatorMemoryStore,
  sampleType: CalculatorSampleScope,
  section: string,
  fields: Record<string, number | undefined>
): CalculatorMemoryStore {
  let next = store;
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined || !Number.isFinite(value)) continue;
    next = setMemoryField(next, sampleType, section, key, value);
  }
  return next;
}

export function getMemoryTextField(
  slice: CalculatorMemorySlice,
  section: string,
  key: string
): string | undefined {
  const value = slice.textFields?.[section]?.[key];
  return typeof value === "string" ? value : undefined;
}

export function setMemoryTextField(
  store: CalculatorMemoryStore,
  sampleType: CalculatorSampleScope,
  section: string,
  key: string,
  value: string
): CalculatorMemoryStore {
  const slice = getMemorySlice(store, sampleType);
  const sectionFields = { ...(slice.textFields?.[section] || {}), [key]: value };
  const nextSlice: CalculatorMemorySlice = {
    ...slice,
    textFields: { ...(slice.textFields || {}), [section]: sectionFields },
  };
  return {
    ...store,
    bySample: { ...store.bySample, [sampleType]: nextSlice },
  };
}

export function markLabImport(
  store: CalculatorMemoryStore,
  sampleType: CalculatorSampleScope,
  fingerprint: string
): CalculatorMemoryStore {
  const slice = getMemorySlice(store, sampleType);
  return {
    ...store,
    bySample: {
      ...store.bySample,
      [sampleType]: {
        ...slice,
        lastImportFingerprint: fingerprint,
        lastImportAt: new Date().toISOString(),
      },
    },
  };
}

/** Stable fingerprint of mapped lab nutrients for change detection. */
export function labImportFingerprint(
  entries: Array<[string, number | undefined]>
): string {
  return entries
    .map(([key, value]) => `${key}:${Number.isFinite(value) ? value : ""}`)
    .join("|");
}
