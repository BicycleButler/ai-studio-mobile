import { IPlatformService } from "../services/IPlatformService";
import { IObservable } from "./observable";
import { AsyncStorage } from "./asyncStorage";
import { ILogger, DefaultLoggerFactory } from "./logger";
import { OfflineQueueStore, IOfflineQueueStore } from "./offlineQueueStore";
import { ISyncEngine, SyncEngine } from "./syncEngine";
import { IIdGenerator, DefaultIdGenerator } from "./idGenerator";
import { ITimeProvider, DefaultTimeProvider } from "./timeProvider";
import { ICrossTabNotifierFactory } from "./crossTabNotifier";


export interface OfflineMutation {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
  version?: number;
  attempts?: number;
  lastError?: string;
  nextRetryAt?: number;
}

export interface ConflictData {
  type: string;
  localData: unknown;
  remoteData: unknown;
  remoteVersion?: number;
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
  processOfflineMutations(): Promise<{ success: boolean; conflicts: ConflictData[]; droppedIds?: string[]; droppedMutations?: OfflineMutation[] }>;
  getOfflineQueue(): Promise<OfflineMutation[]>;
  subscribe(listener: () => void): () => void;
  getSnapshot(): OfflineMutation[];
  getDeadLetterQueue?(): Promise<OfflineMutation[]>;
  retryDeadLetterQueue?(): Promise<number>;
  clearDeadLetterQueue?(): Promise<void>;
}

export interface OfflineServiceConfig {
  timeProvider?: ITimeProvider;
  storageKey?: string;
  storageAdapter?: AsyncStorage;
  queueStore?: IOfflineQueueStore;
  syncEngine?: ISyncEngine;
  logger?: ILogger;
  idGenerator?: IIdGenerator;
  crossTabNotifierFactory?: ICrossTabNotifierFactory;
  platformService?: IPlatformService;
}

const DEAD_LETTER_STORAGE_KEY = "ai_studio_offline_dead_letter_v1";

export class OfflineService implements IOfflineService {
  private queueStore: IOfflineQueueStore;
  private syncEngine: ISyncEngine;
  private logger: ILogger;
  private idGenerator: IIdGenerator;
  private timeProvider: ITimeProvider;
  private deadLetterMemoryFallback: OfflineMutation[] = [];

  constructor(config: OfflineServiceConfig) {
    this.logger = config.logger || new DefaultLoggerFactory().createLogger();
    this.idGenerator = config.idGenerator || new DefaultIdGenerator();
    this.timeProvider = config.timeProvider || new DefaultTimeProvider();

    if (config.queueStore) {
      this.queueStore = config.queueStore;
    } else if (config.storageAdapter) {
      if (!config.crossTabNotifierFactory || !config.platformService) {
        throw new Error("OfflineService requires crossTabNotifierFactory and platformService when instantiating queueStore");
      }
      this.queueStore = new OfflineQueueStore({
        storageKey: config.storageKey || OFFLINE_QUEUE_KEY,
        storageAdapter: config.storageAdapter,
        logger: this.logger,
        crossTabNotifierFactory: config.crossTabNotifierFactory,
        platformService: config.platformService
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
      timestamp: this.timeProvider.now(),
      id: this.idGenerator.generate("mutation"),
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

  private readDeadLettersSync(): OfflineMutation[] {
    try {
      if (typeof localStorage !== "undefined") {
        const raw = localStorage.getItem(DEAD_LETTER_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) return parsed as OfflineMutation[];
        }
      }
    } catch {
      // Fallback to in-memory copy
    }
    return [...this.deadLetterMemoryFallback];
  }

  private writeDeadLettersSync(items: OfflineMutation[]): void {
    const capped = items.slice(-50);
    this.deadLetterMemoryFallback = capped;
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(DEAD_LETTER_STORAGE_KEY, JSON.stringify(capped));
      }
    } catch {
      // Ignore storage quota/access errors
    }
  }

  public async getDeadLetterQueue(): Promise<OfflineMutation[]> {
    return this.readDeadLettersSync();
  }

  public async clearDeadLetterQueue(): Promise<void> {
    this.writeDeadLettersSync([]);
  }

  public async retryDeadLetterQueue(): Promise<number> {
    const items = this.readDeadLettersSync();
    if (items.length === 0) return 0;
    this.writeDeadLettersSync([]);
    for (const item of items) {
      await this.queueStore.enqueue({
        ...item,
        attempts: 0,
        nextRetryAt: undefined,
      });
    }
    return items.length;
  }

  public async processOfflineMutations(): Promise<{
    success: boolean;
    conflicts: ConflictData[];
    droppedIds?: string[];
    droppedMutations?: OfflineMutation[];
  }> {
    const result = await this.syncEngine.processOfflineMutations();
    if (result.droppedMutations && result.droppedMutations.length > 0) {
      const existing = this.readDeadLettersSync();
      const existingIds = new Set(existing.map((m) => m.id));
      const merged = [
        ...existing,
        ...result.droppedMutations.filter((m) => !existingIds.has(m.id)),
      ];
      this.writeDeadLettersSync(merged);
    }
    return result;
  }

  public async getOfflineQueue(): Promise<OfflineMutation[]> {
    return this.queueStore.getQueue();
  }

  public dispose(): void {
    this.queueStore.dispose();
  }
}

