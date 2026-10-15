import { OfflineMutation, ConflictData, SyncHandler, OFFLINE_QUEUE_KEY } from "./offlineTypes";
import { get, set } from "idb-keyval";
import { Mutex } from "./mutex";

export class OfflineQueueProcessor {
  private mutex = new Mutex();

  constructor(private syncRegistry: Record<string, SyncHandler>) {}

  private async safeGetQueue(): Promise<OfflineMutation[]> {
    try {
      const data = await get<OfflineMutation[]>(OFFLINE_QUEUE_KEY);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      console.error(`[OfflineQueueProcessor] Critical failure reading from IndexedDB (${OFFLINE_QUEUE_KEY})`, err);
      return [];
    }
  }

  private async safeSetQueue(queue: OfflineMutation[]): Promise<void> {
    try {
      if (!Array.isArray(queue)) {
        throw new Error("Invalid queue format: Expected an array.");
      }
      await set(OFFLINE_QUEUE_KEY, queue);
    } catch (err) {
      console.error(`[OfflineQueueProcessor] Critical failure writing to IndexedDB (${OFFLINE_QUEUE_KEY})`, err);
    }
  }

  async enqueue(mutation: OfflineMutation): Promise<void> {
    await this.mutex.runExclusive(async () => {
      try {
        const queue = await this.safeGetQueue();
        queue.push(mutation);
        await this.safeSetQueue(queue);
      } catch (err) {
        console.error("Enqueue failed", err);
      }
    });
  }

  async remove(id: string): Promise<void> {
    await this.mutex.runExclusive(async () => {
      try {
        const queue = await this.safeGetQueue();
        const newQueue = queue.filter((m) => m.id !== id);
        await this.safeSetQueue(newQueue);
      } catch (err) {
        console.error("Remove failed", err);
      }
    });
  }

  async getLength(): Promise<number> {
    const queue = await this.safeGetQueue();
    return queue.length;
  }

  async clear(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      try {
        await this.safeSetQueue([]);
      } catch (err) {
        console.error("Clear failed", err);
      }
    });
  }

  async process(): Promise<{ success: boolean; conflicts: ConflictData[] }> {
    let queue: OfflineMutation[] = [];

    await this.mutex.runExclusive(async () => {
      try {
        queue = await this.safeGetQueue();
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

    for (const mutation of queue) {
      let success = false;
      try {
        const handler = this.syncRegistry[mutation.type];
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

    await this.mutex.runExclusive(async () => {
      try {
        const currentQueue = await this.safeGetQueue();
        const successfulIds = new Set(
          queue
            .filter(m => !remainingQueue.some(rm => rm.id === m.id))
            .map(m => m.id)
        );

        const finalQueue = currentQueue.filter(m => !successfulIds.has(m.id));
        await this.safeSetQueue(finalQueue);
      } catch (err) {
        console.error("Queue write failed", err);
      }
    });

    return { success: processSuccess, conflicts };
  }
}
