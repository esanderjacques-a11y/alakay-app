import { RequestTimeoutError } from "@/lib/fetchWithTimeout";
import {
  saveAnalysisToSupabase,
  type SaveAnalysisInput,
} from "@/lib/saveAnalysisToSupabase";

const OFFLINE_QUEUE_STORAGE_KEY = "cultosol_offline_analysis_queue_v1";
const OFFLINE_QUEUE_EVENT = "cultosol-offline-queue-changed";

export type QueuedAnalysisSave = {
  clientId: string;
  userId: string;
  signature: string;
  queuedAt: string;
  payload: SaveAnalysisInput;
};

export type FlushOfflineQueueResult = {
  synced: number;
  syncedSignatures: string[];
  failed: number;
  remaining: number;
};

function readQueue(): QueuedAnalysisSave[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as QueuedAnalysisSave[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedAnalysisSave[]) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
  } catch {
    /* Storage may be unavailable. */
  }
}

export function subscribeOfflineQueue(listener: () => void) {
  if (typeof window === "undefined") return () => {};

  const handler = () => listener();
  window.addEventListener(OFFLINE_QUEUE_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(OFFLINE_QUEUE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function getOfflineQueueCount(userId?: string) {
  const queue = readQueue();
  if (!userId) return queue.length;
  return queue.filter((item) => item.userId === userId).length;
}

export function isSignatureQueued(userId: string, signature: string) {
  return readQueue().some(
    (item) => item.userId === userId && item.signature === signature
  );
}

export function enqueueAnalysisSave(input: {
  userId: string;
  signature: string;
  payload: SaveAnalysisInput;
}) {
  const queue = readQueue().filter(
    (item) =>
      !(
        item.userId === input.userId && item.signature === input.signature
      )
  );

  queue.push({
    clientId: crypto.randomUUID(),
    userId: input.userId,
    signature: input.signature,
    queuedAt: new Date().toISOString(),
    payload: input.payload,
  });

  writeQueue(queue);
}

export function shouldQueueAnalysisSave(error: unknown) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  if (error instanceof RequestTimeoutError) return true;
  if (error instanceof TypeError) return true;

  const message = error instanceof Error ? error.message : String(error);
  return /fetch|network|timeout|failed to fetch|connection|offline|abort/i.test(
    message
  );
}

export async function flushOfflineAnalysisQueue(
  userId: string
): Promise<FlushOfflineQueueResult> {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    return {
      synced: 0,
      syncedSignatures: [],
      failed: 0,
      remaining: getOfflineQueueCount(userId),
    };
  }

  const queue = readQueue();
  const userItems = queue.filter((item) => item.userId === userId);
  const otherItems = queue.filter((item) => item.userId !== userId);

  const syncedSignatures: string[] = [];
  let synced = 0;
  let failed = 0;
  const remainingItems: QueuedAnalysisSave[] = [];

  for (const item of userItems) {
    try {
      await saveAnalysisToSupabase(item.payload);
      synced += 1;
      syncedSignatures.push(item.signature);
    } catch (error) {
      failed += 1;

      if (shouldQueueAnalysisSave(error)) {
        const currentIndex = userItems.indexOf(item);
        remainingItems.push(...userItems.slice(currentIndex));
        break;
      }
    }
  }

  writeQueue([...otherItems, ...remainingItems]);

  return {
    synced,
    syncedSignatures,
    failed,
    remaining: remainingItems.length,
  };
}
