"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CalculationOutput, CalculatorValue } from "@/lib/agronomicCalculators";
import {
  getMemoryField,
  getMemorySlice,
  getMemoryTextField,
  labImportFingerprint,
  markLabImport,
  readCalculatorMemory,
  setMemoryField,
  setMemoryFields,
  setMemoryTextField,
  writeCalculatorMemory,
  type CalculatorMemoryStore,
  type CalculatorSampleScope,
} from "@/lib/calculatorMemory";
import { resolveCationInputs } from "@/lib/resolveCationInputs";

type MemoryWriteOptions = {
  recordHistory?: boolean;
  coalesceKey?: string;
};

type MemoryContextValue = {
  sampleType: CalculatorSampleScope;
  importTick: number;
  lastImportFingerprint?: string;
  /** Content fingerprint of the current lab map (stable across referential churn). */
  labFingerprint: string;
  valuesOutOfSync: boolean;
  getNumber: (section: string, key: string, fallback: number) => number;
  setNumber: (
    section: string,
    key: string,
    value: number,
    options?: MemoryWriteOptions
  ) => void;
  getText: (section: string, key: string, fallback: string) => string;
  setText: (
    section: string,
    key: string,
    value: string,
    options?: MemoryWriteOptions
  ) => void;
  importFromValues: (options?: {
    recordHistory?: boolean;
  }) => { importedCount: number; fingerprint: string };
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

const CalculatorMemoryContext = createContext<MemoryContextValue | null>(null);

let memoryCache: CalculatorMemoryStore | null = null;
const listeners = new Set<() => void>();
const historyListeners = new Set<() => void>();
const MAX_HISTORY = 60;
const COALESCE_MS = 700;
const HISTORY_MUTE_MS = 250;

let past: CalculatorMemoryStore[] = [];
let future: CalculatorMemoryStore[] = [];
let historyVersion = 0;
let historySnapshot = { canUndo: false, canRedo: false, version: 0 };
let historyMuteUntil = 0;
let lastCoalesceKey: string | null = null;
let lastCoalesceAt = 0;

function getStore(): CalculatorMemoryStore {
  if (!memoryCache) memoryCache = readCalculatorMemory();
  return memoryCache;
}

function cloneStore(store: CalculatorMemoryStore): CalculatorMemoryStore {
  return JSON.parse(JSON.stringify(store)) as CalculatorMemoryStore;
}

function storesEqual(a: CalculatorMemoryStore, b: CalculatorMemoryStore) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function subscribeHistory(listener: () => void) {
  historyListeners.add(listener);
  return () => historyListeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function emitHistory() {
  historyVersion += 1;
  historySnapshot = {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    version: historyVersion,
  };
  for (const listener of historyListeners) listener();
}

function getHistorySnapshot() {
  return historySnapshot;
}

function muteHistoryRecording(ms = HISTORY_MUTE_MS) {
  historyMuteUntil = Math.max(historyMuteUntil, Date.now() + ms);
}

function commit(
  next: CalculatorMemoryStore,
  options?: { recordHistory?: boolean; coalesceKey?: string }
) {
  if (storesEqual(getStore(), next)) return;

  const muted = Date.now() < historyMuteUntil;
  const recordHistory = options?.recordHistory !== false && !muted;

  if (recordHistory) {
    const coalesceKey = options?.coalesceKey ?? null;
    const now = Date.now();
    const coalesce =
      Boolean(coalesceKey) &&
      coalesceKey === lastCoalesceKey &&
      now - lastCoalesceAt < COALESCE_MS &&
      past.length > 0;

    if (!coalesce) {
      past.push(cloneStore(getStore()));
      if (past.length > MAX_HISTORY) past.shift();
    }
    lastCoalesceKey = coalesceKey;
    lastCoalesceAt = now;
    future = [];
  } else if (options?.recordHistory !== false) {
    // Muted system write — keep redo/undo stacks intact.
    lastCoalesceKey = null;
  } else {
    // Explicit non-history write (undo/redo apply, auto-import).
    lastCoalesceKey = null;
  }

  memoryCache = next;
  writeCalculatorMemory(next);
  emit();
  emitHistory();
}

function undoMemory() {
  if (past.length === 0) return;
  future.push(cloneStore(getStore()));
  const previous = past.pop();
  if (!previous) return;
  muteHistoryRecording();
  lastCoalesceKey = null;
  memoryCache = previous;
  writeCalculatorMemory(previous);
  emit();
  emitHistory();
}

function redoMemory() {
  if (future.length === 0) return;
  past.push(cloneStore(getStore()));
  const next = future.pop();
  if (!next) return;
  muteHistoryRecording();
  lastCoalesceKey = null;
  memoryCache = next;
  writeCalculatorMemory(next);
  emit();
  emitHistory();
}

function labPairsFromMap(lab: Map<string, CalculatorValue>): Array<[string, number | undefined]> {
  return [
    ["cec", lab.get("cec")?.value],
    ["calcium", lab.get("calcium")?.value],
    ["magnesium", lab.get("magnesium")?.value],
    ["potassium", lab.get("potassium")?.value],
    ["sodium", lab.get("sodium")?.value],
    ["ph", lab.get("ph")?.value],
    ["exchangeable_acidity", lab.get("exchangeable_acidity")?.value],
    ["base_saturation", lab.get("base_saturation")?.value],
    ["aluminum", lab.get("aluminum")?.value],
    ["bulk_density", lab.get("bulk_density")?.value],
    ["organic_matter", lab.get("organic_matter")?.value],
    ["nitrogen", lab.get("nitrogen")?.value],
    ["phosphorus", lab.get("phosphorus")?.value],
  ];
}

function mapLabIntoMemory(
  store: CalculatorMemoryStore,
  sampleType: CalculatorSampleScope,
  lab: Map<string, CalculatorValue>
): { store: CalculatorMemoryStore; importedCount: number; fingerprint: string } {
  const labPairs = labPairsFromMap(lab);
  const fingerprint = labImportFingerprint(labPairs);
  let next = store;
  let importedCount = 0;

  const cicPatch: Record<string, number | undefined> = {
    cec: lab.get("cec")?.value,
    ca: lab.get("calcium")?.value,
    mg: lab.get("magnesium")?.value,
    k: lab.get("potassium")?.value,
    na: lab.get("sodium")?.value,
  };
  const amendmentPatch: Record<string, number | undefined> = {
    cec: lab.get("cec")?.value,
    baseSaturationCurrent: lab.get("base_saturation")?.value,
    exchangeableAcidity: lab.get("exchangeable_acidity")?.value,
    currentPh: lab.get("ph")?.value,
    exchangeableAl: lab.get("aluminum")?.value,
    bulkDensity: lab.get("bulk_density")?.value,
  };
  const fertilizerPatch: Record<string, number | undefined> = {
    bulkDensity: lab.get("bulk_density")?.value,
    organicMatter:
      lab.get("organic_matter")?.value ??
      (Number.isFinite(lab.get("organic_carbon")?.value)
        ? Math.round((lab.get("organic_carbon")!.value * 1.724) * 100) / 100
        : undefined),
    p: lab.get("phosphorus")?.value,
    k: lab.get("potassium")?.value,
    mg: lab.get("magnesium")?.value,
  };

  for (const value of [
    ...Object.values(cicPatch),
    ...Object.values(amendmentPatch),
    ...Object.values(fertilizerPatch),
  ]) {
    if (Number.isFinite(value)) importedCount += 1;
  }

  next = setMemoryFields(next, sampleType, "cic", cicPatch);
  next = setMemoryFields(next, sampleType, "amendment", amendmentPatch);
  next = setMemoryFields(next, sampleType, "fertilizer", fertilizerPatch);
  next = setMemoryFields(next, sampleType, "lab", Object.fromEntries(labPairs));
  next = markLabImport(next, sampleType, fingerprint);

  return { store: next, importedCount, fingerprint };
}

export function CalculatorMemoryProvider({
  sampleType,
  lab,
  children,
}: {
  sampleType: CalculatorSampleScope;
  lab: Map<string, CalculatorValue>;
  children: ReactNode;
}) {
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const [importTick, setImportTick] = useState(0);

  const slice = getMemorySlice(store, sampleType);

  const currentFingerprint = useMemo(
    () => labImportFingerprint(labPairsFromMap(lab)),
    [lab]
  );

  const hasAnyLabValue = labPairsFromMap(lab).some(([, value]) => Number.isFinite(value));

  const outOfSync =
    hasAnyLabValue &&
    (!slice.lastImportFingerprint || slice.lastImportFingerprint !== currentFingerprint);

  const getNumber = useCallback(
    (section: string, key: string, fallback: number) => {
      const remembered = getMemoryField(slice, section, key);
      if (remembered !== undefined) return remembered;
      return Number.isFinite(fallback) ? fallback : 0;
    },
    [slice]
  );

  const setNumber = useCallback(
    (section: string, key: string, value: number, options?: MemoryWriteOptions) => {
      if (!Number.isFinite(value)) return;
      const current = getMemoryField(
        getMemorySlice(getStore(), sampleType),
        section,
        key
      );
      if (current !== undefined && current === value) return;
      commit(setMemoryField(getStore(), sampleType, section, key, value), {
        recordHistory: options?.recordHistory,
        coalesceKey:
          options?.coalesceKey ??
          (options?.recordHistory === false
            ? undefined
            : `${sampleType}:${section}:${key}:n`),
      });
    },
    [sampleType]
  );

  const getText = useCallback(
    (section: string, key: string, fallback: string) => {
      const remembered = getMemoryTextField(slice, section, key);
      if (remembered !== undefined) return remembered;
      return fallback;
    },
    [slice]
  );

  const setText = useCallback(
    (section: string, key: string, value: string, options?: MemoryWriteOptions) => {
      const current = getMemoryTextField(
        getMemorySlice(getStore(), sampleType),
        section,
        key
      );
      if (current !== undefined && current === value) return;
      commit(setMemoryTextField(getStore(), sampleType, section, key, value), {
        recordHistory: options?.recordHistory,
        coalesceKey:
          options?.coalesceKey ??
          (options?.recordHistory === false
            ? undefined
            : `${sampleType}:${section}:${key}:t`),
      });
    },
    [sampleType]
  );

  const importFromValues = useCallback(
    (options?: { recordHistory?: boolean }) => {
      const result = mapLabIntoMemory(getStore(), sampleType, lab);
      commit(result.store, { recordHistory: options?.recordHistory !== false });
      setImportTick((tick) => tick + 1);
      return { importedCount: result.importedCount, fingerprint: result.fingerprint };
    },
    [lab, sampleType]
  );

  const historyFlags = useSyncExternalStore(
    subscribeHistory,
    getHistorySnapshot,
    getHistorySnapshot
  );

  const undo = useCallback(() => {
    undoMemory();
    setImportTick((tick) => tick + 1);
  }, []);

  const redo = useCallback(() => {
    redoMemory();
    setImportTick((tick) => tick + 1);
  }, []);

  const value = useMemo<MemoryContextValue>(
    () => ({
      sampleType,
      importTick,
      lastImportFingerprint: slice.lastImportFingerprint,
      labFingerprint: currentFingerprint,
      valuesOutOfSync: outOfSync,
      getNumber,
      setNumber,
      getText,
      setText,
      importFromValues,
      canUndo: historyFlags.canUndo,
      canRedo: historyFlags.canRedo,
      undo,
      redo,
    }),
    [
      sampleType,
      importTick,
      slice.lastImportFingerprint,
      currentFingerprint,
      outOfSync,
      getNumber,
      setNumber,
      getText,
      setText,
      importFromValues,
      historyFlags.canUndo,
      historyFlags.canRedo,
      undo,
      redo,
    ]
  );

  return (
    <CalculatorMemoryContext.Provider value={value}>
      {children}
    </CalculatorMemoryContext.Provider>
  );
}

export function useCalculatorMemory() {
  const ctx = useContext(CalculatorMemoryContext);
  if (!ctx) {
    throw new Error("useCalculatorMemory must be used within CalculatorMemoryProvider");
  }
  return ctx;
}

/** Number field bound to calculator memory; survives navigation until edited or imported.
 * Shared parameters (CEC, K, bulk density, …) stay in sync across calculator pages.
 */
export function useMemoryNumber(
  section: string,
  key: string,
  labFallback: number
): [number, (value: number, options?: MemoryWriteOptions) => void] {
  const { setNumber, importTick, sampleType } = useCalculatorMemory();
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const remembered = getMemoryField(getMemorySlice(store, sampleType), section, key);
  // A stored 0 usually comes from clearing/blurring an empty field and should not
  // block auto-import or constructor defaults (e.g. bulk density → 1, lab OM → 3.2).
  const resolved =
    remembered !== undefined &&
    !(remembered === 0 && Number.isFinite(labFallback) && labFallback > 0)
      ? remembered
      : Number.isFinite(labFallback)
        ? labFallback
        : 0;

  const [value, setValue] = useState(resolved);

  useEffect(() => {
    setValue(resolved);
  }, [importTick, section, key, resolved]);

  const update = useCallback(
    (next: number, options?: MemoryWriteOptions) => {
      setValue(next);
      setNumber(section, key, next, options);
    },
    [section, key, setNumber]
  );

  return [value, update];
}

/** String field bound to calculator memory (crop keys, modes, units, …). */
export function useMemoryString(
  section: string,
  key: string,
  fallback = ""
): [string, (value: string, options?: MemoryWriteOptions) => void] {
  const { setText, importTick, sampleType } = useCalculatorMemory();
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const remembered = getMemoryTextField(getMemorySlice(store, sampleType), section, key);
  const resolved = remembered !== undefined ? remembered : fallback;

  const [value, setValue] = useState(resolved);

  useEffect(() => {
    setValue(resolved);
  }, [importTick, section, key, resolved]);

  const update = useCallback(
    (next: string, options?: MemoryWriteOptions) => {
      setValue(next);
      setText(section, key, next, options);
    },
    [section, key, setText]
  );

  return [value, update];
}

/** Lab + guided-memory cations, with CICe / V% estimated when not reported. */
export function useSharedCationInputs(lab: Map<string, CalculatorValue>) {
  const { sampleType } = useCalculatorMemory();
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const slice = getMemorySlice(store, sampleType);

  return useMemo(() => resolveCationInputs(lab, slice), [lab, slice]);
}

function calculationOutputsSignature(outputs: CalculationOutput[]): string {
  return JSON.stringify(
    outputs.map((item) => ({
      label: item.label,
      value: item.value,
      unit: item.unit,
      formula: item.formula,
      notes: (item.notes ?? []).join("||"),
      alternatives: (item.alternatives ?? []).map((alt) => `${alt.value}|${alt.unit}`).join(";"),
    }))
  );
}

export function calculationOutputsMapSignature(
  record: Record<string, CalculationOutput[]>
): string {
  return JSON.stringify(
    Object.entries(record).map(([id, outputs]) => [id, calculationOutputsSignature(outputs)])
  );
}

/** Report calculator outputs upstream only when their content changes. */
export function useEmitCalculatorOutputs(
  onOutputsChange: ((outputs: CalculationOutput[]) => void) | undefined,
  outputs: CalculationOutput[]
) {
  const callbackRef = useRef(onOutputsChange);
  callbackRef.current = onOutputsChange;

  const outputsRef = useRef(outputs);
  outputsRef.current = outputs;

  const signature = useMemo(() => calculationOutputsSignature(outputs), [outputs]);

  useEffect(() => {
    callbackRef.current?.(outputsRef.current);
  }, [signature]);
}
