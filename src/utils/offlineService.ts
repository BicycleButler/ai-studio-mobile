import { generateUniqueId } from "./idGenerator";
import { IObservable } from "./observable";
import { AsyncStorage, IndexedDbAsyncStorage, MemoryAsyncStorage, FallbackAsyncStorage } from "./asyncStorage";
import { ILogger, defaultLogger } from "./logger";
import { OfflineQueueStore, IOfflineQueueStore } from "./offlineQueueStore";
import { ISyncEngine, SyncEngine } from "./syncEngine";

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
  getObservable(): IObservable<OfflineMutation[]>;
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
  syncEngine?: ISyncEngine;
  logger?: ILogger;
}

export class OfflineService implements IOfflineService {
  private queueStore: IOfflineQueueStore;
  private syncEngine: ISyncEngine;
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

    if (config.syncEngine) {
      this.syncEngine = config.syncEngine;
    } else {
      this.syncEngine = new SyncEngine(this.queueStore, this.logger);
    }
  }

  public getObservable(): IObservable<OfflineMutation[]> {
    return this.queueStore.getObservable();
  }

  public registerSyncHandler(type: string, handler: SyncHandler): void {
    this.syncEngine.registerSyncHandler(type, handler);
  }

  public getSnapshot(): OfflineMutation[] {
    return this.queueStore.getSnapshot();
  }

  public subscribe(listener: () => void): () => void {
    return this.queueStore.getObservable().subscribe(listener);
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
    return this.syncEngine.processOfflineMutations();
  }

  public async getOfflineQueue(): Promise<OfflineMutation[]> {
    return this.queueStore.getQueue();
  }

  public dispose(): void {
    this.queueStore.dispose();
  }
}

export const defaultOfflineService = new OfflineService({ storageAdapter: new FallbackAsyncStorage([new IndexedDbAsyncStorage(), new MemoryAsyncStorage()]) });
