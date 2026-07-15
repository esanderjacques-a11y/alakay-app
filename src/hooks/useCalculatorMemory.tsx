"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { CalculatorValue } from "@/lib/agronomicCalculators";
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

type MemoryContextValue = {
  sampleType: CalculatorSampleScope;
  importTick: number;
  lastImportFingerprint?: string;
  valuesOutOfSync: boolean;
  getNumber: (section: string, key: string, fallback: number) => number;
  setNumber: (section: string, key: string, value: number) => void;
  getText: (section: string, key: string, fallback: string) => string;
  setText: (section: string, key: string, value: string) => void;
  importFromValues: () => { importedCount: number; fingerprint: string };
};

const CalculatorMemoryContext = createContext<MemoryContextValue | null>(null);

let memoryCache: CalculatorMemoryStore | null = null;
const listeners = new Set<() => void>();

function getStore(): CalculatorMemoryStore {
  if (!memoryCache) memoryCache = readCalculatorMemory();
  return memoryCache;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit() {
  for (const listener of listeners) listener();
}

function commit(next: CalculatorMemoryStore) {
  memoryCache = next;
  writeCalculatorMemory(next);
  emit();
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
    organicMatter: lab.get("organic_matter")?.value,
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
    (section: string, key: string, value: number) => {
      if (!Number.isFinite(value)) return;
      commit(setMemoryField(getStore(), sampleType, section, key, value));
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
    (section: string, key: string, value: string) => {
      commit(setMemoryTextField(getStore(), sampleType, section, key, value));
    },
    [sampleType]
  );

  const importFromValues = useCallback(() => {
    const result = mapLabIntoMemory(getStore(), sampleType, lab);
    commit(result.store);
    setImportTick((tick) => tick + 1);
    return { importedCount: result.importedCount, fingerprint: result.fingerprint };
  }, [lab, sampleType]);

  const value = useMemo<MemoryContextValue>(
    () => ({
      sampleType,
      importTick,
      lastImportFingerprint: slice.lastImportFingerprint,
      valuesOutOfSync: outOfSync,
      getNumber,
      setNumber,
      getText,
      setText,
      importFromValues,
    }),
    [
      sampleType,
      importTick,
      slice.lastImportFingerprint,
      outOfSync,
      getNumber,
      setNumber,
      getText,
      setText,
      importFromValues,
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
): [number, (value: number) => void] {
  const { setNumber, importTick, sampleType } = useCalculatorMemory();
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const remembered = getMemoryField(getMemorySlice(store, sampleType), section, key);
  const resolved = remembered !== undefined ? remembered : Number.isFinite(labFallback) ? labFallback : 0;

  const [value, setValue] = useState(resolved);

  useEffect(() => {
    setValue(resolved);
  }, [importTick, section, key, resolved]);

  const update = useCallback(
    (next: number) => {
      setValue(next);
      setNumber(section, key, next);
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
): [string, (value: string) => void] {
  const { setText, importTick, sampleType } = useCalculatorMemory();
  const store = useSyncExternalStore(subscribe, getStore, getStore);
  const remembered = getMemoryTextField(getMemorySlice(store, sampleType), section, key);
  const resolved = remembered !== undefined ? remembered : fallback;

  const [value, setValue] = useState(resolved);

  useEffect(() => {
    setValue(resolved);
  }, [importTick, section, key, resolved]);

  const update = useCallback(
    (next: string) => {
      setValue(next);
      setText(section, key, next);
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
