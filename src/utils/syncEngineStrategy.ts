import { ILogger, defaultLogger } from "./logger";
import { OfflineMutation, ConflictData, SyncHandler } from "./offlineService";

export interface IQueueProcessingStrategy {
  process(
    queue: OfflineMutation[],
    syncRegistry: Record<string, SyncHandler>,
    logger?: ILogger
  ): Promise<{ success: boolean; conflicts: ConflictData[]; successfulIds: string[] }>;
}

export class StrictFifoQueueProcessingStrategy implements IQueueProcessingStrategy {
  async process(
    queue: OfflineMutation[],
    syncRegistry: Record<string, SyncHandler>,
    logger: ILogger = defaultLogger
  ): Promise<{ success: boolean; conflicts: ConflictData[]; successfulIds: string[] }> {
    if (queue.length === 0) {
      return { success: true, conflicts: [], successfulIds: [] };
    }

    const remainingQueue: OfflineMutation[] = [];
    const conflicts: ConflictData[] = [];
    let processSuccess = true;

    for (let i = 0; i < queue.length; i++) {
      const mutation = queue[i];
      let success = false;
      let retryable = true; // Default to true to be safe
      try {
        const handler = syncRegistry[mutation.type];
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
        logger.error(`Failed to sync offline mutation ${mutation.type}`, e);
      }

      if (!success) {
        if (!retryable) {
          logger.warn(`Dropping non-retryable offline mutation ${mutation.type}`);
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

    return { success: processSuccess, conflicts, successfulIds };
  }
}
