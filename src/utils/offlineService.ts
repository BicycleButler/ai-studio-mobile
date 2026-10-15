import { generateUniqueId } from "./idGenerator";
import { OfflineQueueProcessor } from "./offlineQueueProcessor";
import { type OfflineMutation, type ConflictData, type SyncHandler, OFFLINE_QUEUE_KEY } from "./offlineTypes";

export type { OfflineMutation, ConflictData, SyncHandler };
export { OFFLINE_QUEUE_KEY };

const syncRegistry: Record<string, SyncHandler> = {};
const processor = new OfflineQueueProcessor(syncRegistry);

export function registerSyncHandler(type: string, handler: SyncHandler) {
  syncRegistry[type] = handler;
}

export async function enqueueOfflineMutation(type: string, payload: unknown, version?: number): Promise<void> {
  const mutation: OfflineMutation = {
    type,
    payload,
    timestamp: Date.now(),
    id: generateUniqueId("mutation"),
    version,
  };
  return processor.enqueue(mutation);
}

export async function removeOfflineMutation(id: string): Promise<void> {
  return processor.remove(id);
}

export async function getOfflineQueueLength(): Promise<number> {
  return processor.getLength();
}

export async function clearOfflineMutations(): Promise<void> {
  return processor.clear();
}

export async function processOfflineMutations(): Promise<{
  success: boolean;
  conflicts: ConflictData[];
}> {
  return processor.process();
}
