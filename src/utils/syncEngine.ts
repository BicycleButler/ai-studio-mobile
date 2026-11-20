import { IOfflineQueueStore } from "./offlineQueueStore";
import { ILogger, DefaultLoggerFactory } from "./logger";
import type { ConflictData, SyncHandler } from "./offlineService";
import { IQueueProcessingStrategy, StrictFifoQueueProcessingStrategy } from "./syncEngineStrategy";

export interface ISyncEngine {
  registerSyncHandler(type: string, handler: SyncHandler): void;
  processOfflineMutations(): Promise<{
    success: boolean;
    conflicts: ConflictData[];
    droppedIds?: string[];
    droppedMutations?: import("./offlineService").OfflineMutation[];
  }>;
}

export class SyncEngine implements ISyncEngine {
  private syncRegistry: Record<string, SyncHandler> = {};
  private queueStore: IOfflineQueueStore;
  private logger: ILogger;
  private processingStrategy: IQueueProcessingStrategy;

  constructor(
    queueStore: IOfflineQueueStore,
    logger: ILogger = new DefaultLoggerFactory().createLogger(),
    processingStrategy?: IQueueProcessingStrategy
  ) {
    this.queueStore = queueStore;
    this.logger = logger;
    this.processingStrategy = processingStrategy || new StrictFifoQueueProcessingStrategy();
  }

  public registerSyncHandler(type: string, handler: SyncHandler): void {
    this.syncRegistry[type] = handler;
  }

  public async processOfflineMutations(): Promise<{
    success: boolean;
    conflicts: ConflictData[];
    droppedIds?: string[];
    droppedMutations?: import("./offlineService").OfflineMutation[];
  }> {
    const queue = await this.queueStore.getQueue();

    if (queue.length === 0) {
      return { success: true, conflicts: [], droppedIds: [], droppedMutations: [] };
    }

    const result = await this.processingStrategy.process(queue, this.syncRegistry, this.logger);

    // Use the optimized batch remove to prevent performance and event spam regressions
    if (result.successfulIds && result.successfulIds.length > 0) {
      await this.queueStore.removeMany(result.successfulIds);
    }

    if (result.updatedMutations && result.updatedMutations.length > 0 && typeof this.queueStore.updateMany === "function") {
      await this.queueStore.updateMany(result.updatedMutations);
    }

    return {
      success: result.success,
      conflicts: result.conflicts,
      droppedIds: result.droppedIds || [],
      droppedMutations: result.droppedMutations || [],
    };
  }
}
