import { generateUniqueId } from "./idGenerator";
import { IObservable } from "./observable";

import { AsyncStorage, IndexedDbAsyncStorage, MemoryAsyncStorage, FallbackAsyncStorage } from "./asyncStorage";
import { ILogger, defaultLogger } from "./logger";
import { OfflineQueueStore, IOfflineQueueStore } from "./offlineQueueStore";

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

export type SyncHandler = (mutation: OfflineMutation) => Promise<{ success: boolean; conflict?: ConflictData; retryable?: boolean }>;

export const OFFLINE_QUEUE_KEY = "ai_studio_offline_mutations";

export interface IOfflineService {
  queueObservable: IObservable<OfflineMutation[]>;
  registerSyncHandler(type: string, handler: SyncHandler): void;
  enqueueOfflineMutation(type: string, payload: unknown, version?: number): Promise<void>;
  removeOfflineMutation(id: string): Promise<void>;
  getOfflineQueueLength(): Promise<number>;
  clearOfflineMutations(): Promise<void>;
  processOfflineMutations(): Promise<{ success: boolean; conflicts: ConflictData[] }>;
  getOfflineQueue(): Promise<OfflineMutation[]>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): OfflineMutation[];
}

export interface OfflineServiceConfig {
  storageKey?: string;
  storageAdapter?: AsyncStorage;
  queueStore?: IOfflineQueueStore;
  logger?: ILogger;
}

export class OfflineService implements IOfflineService {
  private syncRegistry: Record<string, SyncHandler> = {};
  private queueStore: IOfflineQueueStore;
  private logger: ILogger;

  constructor(config: OfflineServiceConfig) {
    this.logger = config.logger || defaultLogger;

    if (config.queueStore) {
      this.queueStore = config.queueStore;
    } else if (config.storageAdapter) {
      this.queueStore = new OfflineQueueStore({
        storageKey: config.storageKey || OFFLINE_QUEUE_KEY,
        storageAdapter: config.storageAdapter,
        logger: this.logger,
      });
    } else {
      throw new Error("OfflineService requires either a queueStore or a storageAdapter");
    }
  }

  public get queueObservable(): IObservable<OfflineMutation[]> {
    return this.queueStore.queueObservable;
  }

  public registerSyncHandler(type: string, handler: SyncHandler): void {
    this.syncRegistry[type] = handler;
  }

  public getSnapshot(): OfflineMutation[] {
    return this.queueStore.getSnapshot();
  }

  public subscribe(listener: () => void): () => void {
    return this.queueStore.queueObservable.subscribe(listener);
  }

  public async enqueueOfflineMutation(type: string, payload: unknown, version?: number): Promise<void> {
    const mutation: OfflineMutation = {
      type,
      payload,
      timestamp: Date.now(),
      id: generateUniqueId("mutation"),
      version,
    };
    await this.queueStore.enqueue(mutation);
  }

  public async removeOfflineMutation(id: string): Promise<void> {
    await this.queueStore.remove(id);
  }

  public async getOfflineQueueLength(): Promise<number> {
    const queue = await this.queueStore.getQueue();
    return queue.length;
  }

  public async clearOfflineMutations(): Promise<void> {
    await this.queueStore.clear();
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

    // To ensure thread safety when modifying the queue after processing,
    // we calculate successful items and remove them.
    // We use a replace call or remove them one by one.
    // However, OfflineQueueStore doesn't expose `withQueueLock`.
    // We can replace the queue with remainingQueue + whatever new items were added.
    // A safer way is to remove successful items by their ID.
    const successfulIds = queue
      .filter(m => !remainingQueue.some(rm => rm.id === m.id))
      .map(m => m.id);

    // Use the optimized batch remove to prevent performance and event spam regressions
    await this.queueStore.removeMany(successfulIds);

    return { success: processSuccess, conflicts };
  }

  public async getOfflineQueue(): Promise<OfflineMutation[]> {
    return this.queueStore.getQueue();
  }

  public dispose(): void {
    this.queueStore.dispose();
  }
}

export const defaultOfflineService = new OfflineService({
  storageAdapter: new FallbackAsyncStorage([
    new IndexedDbAsyncStorage(),
    new MemoryAsyncStorage()
  ])
});
