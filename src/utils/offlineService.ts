import { get, set } from "idb-keyval";
import { generateUniqueId } from "./idGenerator";
import { Mutex } from "./mutex";

export interface OfflineMutation {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
  version?: number;
}

export interface ConflictData {
  type: string;
  localData: unknown;
  remoteData: unknown;
  id: string;
}

export type SyncHandler = (mutation: OfflineMutation) => Promise<{ success: boolean; conflict?: ConflictData }>;

export const OFFLINE_QUEUE_KEY = "ai_studio_offline_mutations";

const syncRegistry: Record<string, SyncHandler> = {};

export function registerSyncHandler(type: string, handler: SyncHandler) {
  syncRegistry[type] = handler;
}

// Ensure serialized enqueues so we don't drop mutations due to race conditions.
const queueMutex = new Mutex();

async function safeGetQueue(): Promise<OfflineMutation[]> {
  try {
    const data = await get<OfflineMutation[]>(OFFLINE_QUEUE_KEY);
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[OfflineService] Critical failure reading from IndexedDB (${OFFLINE_QUEUE_KEY})`, err);
    return [];
  }
}

async function safeSetQueue(queue: OfflineMutation[]): Promise<void> {
  try {
    if (!Array.isArray(queue)) {
      throw new Error("Invalid queue format: Expected an array.");
    }
    await set(OFFLINE_QUEUE_KEY, queue);
  } catch (err) {
    console.error(`[OfflineService] Critical failure writing to IndexedDB (${OFFLINE_QUEUE_KEY})`, err);
    // Depending on strictness, we might want to alert monitoring here
  }
}

export async function enqueueOfflineMutation(type: string, payload: unknown, version?: number): Promise<void> {
  return queueMutex.run(async () => {
    try {
      const queue = await safeGetQueue();
      queue.push({
        type,
        payload,
        timestamp: Date.now(),
        id: generateUniqueId("mutation"),
        version,
      });
      await safeSetQueue(queue);
    } catch (err) {
      console.error("Enqueue failed", err);
    }
  });
}

export async function removeOfflineMutation(id: string): Promise<void> {
  return queueMutex.run(async () => {
    try {
      const queue = await safeGetQueue();
      const newQueue = queue.filter((m) => m.id !== id);
      await safeSetQueue(newQueue);
    } catch (err) {
      console.error("Remove failed", err);
    }
  });
}

export async function getOfflineQueueLength(): Promise<number> {
  return queueMutex.run(async () => {
    const queue = await safeGetQueue();
    return queue.length;
  });
}

export async function clearOfflineMutations(): Promise<void> {
  return queueMutex.run(async () => {
    try {
      await safeSetQueue([]);
    } catch (err) {
      console.error("Clear failed", err);
    }
  });
}

export async function processOfflineMutations(): Promise<{
  success: boolean;
  conflicts: ConflictData[];
}> {
  // Read queue safely within lock
  let queue: OfflineMutation[] = [];
  await queueMutex.run(async () => {
    try {
      queue = await safeGetQueue();
    } catch (err) {
      console.error("Queue read failed", err);
    }
  });

  if (queue.length === 0) {
    return { success: true, conflicts: [] };
  }

  const remainingQueue: OfflineMutation[] = [];
  const conflicts: ConflictData[] = [];
  let processSuccess = true;

  // Perform slow sync operations OUTSIDE the lock
  for (const mutation of queue) {
    let success = false;
    try {
      const handler = syncRegistry[mutation.type];
      if (handler) {
        const result = await handler(mutation);
        success = result.success;
        if (result.conflict) {
          conflicts.push(result.conflict);
        }
      } else {
        // Unknown type, discard it
        success = true;
      }
    } catch (e) {
      console.error(`Failed to sync offline mutation ${mutation.type}`, e);
    }

    if (!success) {
      remainingQueue.push(mutation);
      processSuccess = false;
    }
  }

  // Write updated queue safely within lock
  await queueMutex.run(async () => {
    try {
      const currentQueue = await safeGetQueue();
      const successfulIds = new Set(
        queue
          .filter(m => !remainingQueue.some(rm => rm.id === m.id))
          .map(m => m.id)
      );

      const finalQueue = currentQueue.filter(m => !successfulIds.has(m.id));
      await safeSetQueue(finalQueue);
    } catch (err) {
      console.error("Queue write failed", err);
    }
  });

  return { success: processSuccess, conflicts };
}
