import { get, set } from "idb-keyval";

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

export async function enqueueOfflineMutation(type: string, payload: unknown, version?: number) {
  const queue = (await get<OfflineMutation[]>(OFFLINE_QUEUE_KEY)) || [];
  queue.push({
    type,
    payload,
    timestamp: Date.now(),
    id: Math.random().toString(36).substring(2, 9),
    version,
  });
  await set(OFFLINE_QUEUE_KEY, queue);
}

export async function removeOfflineMutation(id: string) {
  const queue = (await get<OfflineMutation[]>(OFFLINE_QUEUE_KEY)) || [];
  const newQueue = queue.filter(m => m.id !== id);
  await set(OFFLINE_QUEUE_KEY, newQueue);
}

export async function processOfflineMutations(): Promise<{
  success: boolean;
  conflicts: ConflictData[];
}> {
  const queue = (await get<OfflineMutation[]>(OFFLINE_QUEUE_KEY)) || [];
  if (queue.length === 0) return { success: true, conflicts: [] };

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

  await set(OFFLINE_QUEUE_KEY, remainingQueue);
  return { success: processSuccess, conflicts };
}
