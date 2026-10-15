import { get, set } from "idb-keyval";
import { generateUniqueId } from "./idGenerator";

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
let queueLock: Promise<void> = Promise.resolve();

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
  const op = queueLock.then(async () => {
    const queue = await safeGetQueue();
    queue.push({
      type,
      payload,
      timestamp: Date.now(),
      id: generateUniqueId("mutation"),
      version,
    });
    await safeSetQueue(queue);
  }).catch(err => {
    console.error("Enqueue failed", err);
  });
  queueLock = op;
  return op;
}

export async function removeOfflineMutation(id: string): Promise<void> {
  const op = queueLock.then(async () => {
    const queue = await safeGetQueue();
    const newQueue = queue.filter((m) => m.id !== id);
    await safeSetQueue(newQueue);
  }).catch(err => {
    console.error("Remove failed", err);
  });
  queueLock = op;
  return op;
}

export async function getOfflineQueueLength(): Promise<number> {
  const queue = await safeGetQueue();
  return queue.length;
}

export async function clearOfflineMutations(): Promise<void> {
  const op = queueLock.then(async () => {
    await safeSetQueue([]);
  }).catch(err => {
    console.error("Clear failed", err);
  });
  queueLock = op;
  return op;
}

export async function processOfflineMutations(): Promise<{
  success: boolean;
  conflicts: ConflictData[];
}> {
  // Read queue safely within lock
  let queue: OfflineMutation[] = [];
  const readOp = queueLock.then(async () => {
    queue = await safeGetQueue();
  }).catch(err => {
    console.error("Queue read failed", err);
  });
  queueLock = readOp;
  await readOp;

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
  // We must re-read the queue and only filter out the ones we successfully processed.
  // Otherwise we will overwrite mutations that were added while we were syncing outside the lock!
  const writeOp = queueLock.then(async () => {
    const currentQueue = await safeGetQueue();
    // keep mutations that are in currentQueue but were NOT successfully processed.
    // Which means: keep mutations that are EITHER not in the original queue we tried to process,
    // OR they are in the original queue but they failed (are in remainingQueue).

    // An easier way: remove the mutations from currentQueue that we successfully processed.
    const successfulIds = new Set(
      queue
        .filter(m => !remainingQueue.some(rm => rm.id === m.id))
        .map(m => m.id)
    );

    const finalQueue = currentQueue.filter(m => !successfulIds.has(m.id));
    await safeSetQueue(finalQueue);
  }).catch(err => {
    console.error("Queue write failed", err);
  });
  queueLock = writeOp;
  await writeOp;

  return { success: processSuccess, conflicts };
}
