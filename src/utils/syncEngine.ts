import { IOfflineQueueStore } from "./offlineQueueStore";
import { ILogger, defaultLogger } from "./logger";
import { OfflineMutation, ConflictData, SyncHandler } from "./offlineService";

export interface ISyncEngine {
  registerSyncHandler(type: string, handler: SyncHandler): void;
  processOfflineMutations(): Promise<{ success: boolean; conflicts: ConflictData[] }>;
}

export class SyncEngine implements ISyncEngine {
  private syncRegistry: Record<string, SyncHandler> = {};
  private queueStore: IOfflineQueueStore;
  private logger: ILogger;

  constructor(queueStore: IOfflineQueueStore, logger: ILogger = defaultLogger) {
    this.queueStore = queueStore;
    this.logger = logger;
  }

  public registerSyncHandler(type: string, handler: SyncHandler): void {
    this.syncRegistry[type] = handler;
  }

  public async processOfflineMutations(): Promise<{
    success: boolean;
    conflicts: ConflictData[];
  }> {
    const queue = await this.queueStore.getQueue();

    if (queue.length === 0) {
      return { success: true, conflicts: [] };
    }

    const remainingQueue: OfflineMutation[] = [];
    const conflicts: ConflictData[] = [];
    let processSuccess = true;

    for (let i = 0; i < queue.length; i++) {
      const mutation = queue[i];
      let success = false;
      let retryable = true; // Default to true to be safe
      try {
        const handler = this.syncRegistry[mutation.type];
        if (handler) {
          const result = await handler(mutation);
          success = result.success;
          if (result.retryable !== undefined) {
            retryable = result.retryable;
          }
          if (result.conflict) {
            conflicts.push(result.conflict);
          }
        } else {
          success = true; // No handler means we can just drop it
        }
      } catch (e) {
        this.logger.error(`Failed to sync offline mutation ${mutation.type}`, e);
      }

      if (!success) {
        if (!retryable) {
          this.logger.warn(`Dropping non-retryable offline mutation ${mutation.type}`);
          continue; // Drop from queue without halting the rest
        }

        // Strict FIFO Halting: Break out of the processing loop entirely on the first retryable failure.
        // This ensures causal consistency (e.g. don't try to sync an "update" if the "create" failed).
        processSuccess = false;

        // Push the failed mutation and ALL subsequent mutations to the remaining queue
        remainingQueue.push(...queue.slice(i));
        break;
      }
    }

    const successfulIds = queue
      .filter(m => !remainingQueue.some(rm => rm.id === m.id))
      .map(m => m.id);

    // Use the optimized batch remove to prevent performance and event spam regressions
    await this.queueStore.removeMany(successfulIds);

    return { success: processSuccess, conflicts };
  }
}
