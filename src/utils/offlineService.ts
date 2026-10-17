import { get, set } from "idb-keyval";
import { generateUniqueId } from "./idGenerator";
import { Mutex } from "./mutex";
import { Observable } from "./observable";

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

const queueMutex = new Mutex();

export const queueObservable = new Observable<OfflineMutation[]>();

function notifyQueue(queue: OfflineMutation[]) {
  queueObservable.notify(queue);
}

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
  }
}

async function withQueueLock<T>(action: (queue: OfflineMutation[]) => Promise<T | void>): Promise<T | void> {
  return queueMutex.run(async () => {
    const queue = await safeGetQueue();
    const result = await action(queue);
    return result;
  });
}

export async function enqueueOfflineMutation(type: string, payload: unknown, version?: number): Promise<void> {
  await withQueueLock(async (queue) => {
    queue.push({
      type,
      payload,
      timestamp: Date.now(),
      id: generateUniqueId("mutation"),
      version,
    });
    await safeSetQueue(queue);
    notifyQueue(queue);
  });
}

export async function removeOfflineMutation(id: string): Promise<void> {
  await withQueueLock(async (queue) => {
    const newQueue = queue.filter((m) => m.id !== id);
    await safeSetQueue(newQueue);
    notifyQueue(newQueue);
  });
}

export async function getOfflineQueueLength(): Promise<number> {
  return (await withQueueLock(async (queue) => queue.length)) as number || 0;
}

export async function clearOfflineMutations(): Promise<void> {
  await withQueueLock(async () => {
    await safeSetQueue([]);
    notifyQueue([]);
  });
}

export async function processOfflineMutations(): Promise<{
  success: boolean;
  conflicts: ConflictData[];
}> {
  let queue: OfflineMutation[] = [];
  await withQueueLock(async (q) => { queue = q; });

  if (queue.length === 0) {
    return { success: true, conflicts: [] };
  }

  const remainingQueue: OfflineMutation[] = [];
  const conflicts: ConflictData[] = [];
  let processSuccess = true;

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

  await withQueueLock(async (currentQueue) => {
    const successfulIds = new Set(
      queue
        .filter(m => !remainingQueue.some(rm => rm.id === m.id))
        .map(m => m.id)
    );

    const finalQueue = currentQueue.filter(m => !successfulIds.has(m.id));
    await safeSetQueue(finalQueue);
    notifyQueue(finalQueue);
  });

  return { success: processSuccess, conflicts };
}

export async function getOfflineQueue(): Promise<OfflineMutation[]> {
  return (await withQueueLock(async (queue) => queue)) as OfflineMutation[] || [];
}
