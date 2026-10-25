import { Mutex } from "./mutex";
import { Observable, IObservable } from "./observable";
import { AsyncStorage } from "./asyncStorage";
import { ILogger, defaultLogger } from "./logger";
import { OfflineMutation } from "./offlineService";

export interface IOfflineQueueStore {
  getObservable(): IObservable<OfflineMutation[]>;
  enqueue(mutation: OfflineMutation): Promise<void>;
  remove(id: string): Promise<void>;
  removeMany(ids: string[]): Promise<void>;
  clear(): Promise<void>;
  replace(queue: OfflineMutation[]): Promise<void>;
  getQueue(): Promise<OfflineMutation[]>;
  getSnapshot(): OfflineMutation[];
  dispose(): void;
}

export interface OfflineQueueStoreConfig {
  storageKey: string;
  storageAdapter: AsyncStorage;
  logger?: ILogger;
}

export class OfflineQueueStore implements IOfflineQueueStore {
  private queueMutex: Mutex;
  private _queueObservable: IObservable<OfflineMutation[]> = new Observable<OfflineMutation[]>();

  public getObservable(): IObservable<OfflineMutation[]> {
    return this._queueObservable;
  }
  private cachedQueue: OfflineMutation[] = [];
  private channel?: BroadcastChannel;
  private storageKey: string;
  private storageAdapter: AsyncStorage;
  private logger: ILogger;

  constructor(config: OfflineQueueStoreConfig) {
    this.storageKey = config.storageKey;
    this.storageAdapter = config.storageAdapter;
    this.logger = config.logger || defaultLogger;
    this.queueMutex = new Mutex(this.logger);
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(`${this.storageKey}_channel`);
        this.channel.onmessage = (event) => {
          if (event.data === 'SYNC') {
            this.syncCacheFromStorage().catch((err) => this.logger.error("Failed to sync cache from storage", err));
          }
        };
      }
    } catch {
      // Ignore broadcast channel init errors
    }
    this.syncCacheFromStorage().catch(() => {});
  }

  private notifyQueue(queue: OfflineMutation[]) {
    this._queueObservable.notify(queue);
  }

  private async syncCacheFromStorage(): Promise<void> {
    this.cachedQueue = await this.safeGetQueue();
    this.notifyQueue(this.cachedQueue);
  }

  public getSnapshot(): OfflineMutation[] {
    return this.cachedQueue;
  }

  private async safeGetQueue(): Promise<OfflineMutation[]> {
    try {
      const data = await this.storageAdapter.getItem<OfflineMutation[]>(this.storageKey);
      return Array.isArray(data) ? data : [];
    } catch (err) {
      this.logger.error(`[OfflineQueueStore] Critical failure reading from storage (${this.storageKey})`, err);
      return [];
    }
  }

  private async safeSetQueue(queue: OfflineMutation[]): Promise<void> {
    try {
      if (!Array.isArray(queue)) {
        throw new Error("Invalid queue format: Expected an array.");
      }
      await this.storageAdapter.setItem(this.storageKey, queue);
    } catch (err) {
      this.logger.error(`[OfflineQueueStore] Critical failure writing to storage (${this.storageKey})`, err);
    }
  }

  private applyQueueUpdate(newQueue: OfflineMutation[]) {
    this.safeSetQueue(newQueue).then(() => {
      this.cachedQueue = newQueue;
      this.notifyQueue(newQueue);
      this.channel?.postMessage('SYNC');
    }).catch(err => {
        this.logger.error("Failed to apply queue update", err);
    });
  }

  private async withQueueLock<T>(action: (queue: OfflineMutation[]) => Promise<T | void>): Promise<T | void> {
    return this.queueMutex.run(async () => {
      const queue = await this.safeGetQueue();
      const result = await action(queue);
      return result;
    });
  }

  public async enqueue(mutation: OfflineMutation): Promise<void> {
    await this.withQueueLock(async (queue) => {
      queue.push(mutation);
      this.applyQueueUpdate(queue);
    });
  }

  public async remove(id: string): Promise<void> {
    await this.withQueueLock(async (queue) => {
      const newQueue = queue.filter((m) => m.id !== id);
      this.applyQueueUpdate(newQueue);
    });
  }

  public async removeMany(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const idsSet = new Set(ids);
    await this.withQueueLock(async (queue) => {
      const newQueue = queue.filter((m) => !idsSet.has(m.id));
      this.applyQueueUpdate(newQueue);
    });
  }

  public async clear(): Promise<void> {
    await this.withQueueLock(async () => {
      this.applyQueueUpdate([]);
    });
  }

  public async replace(queue: OfflineMutation[]): Promise<void> {
    await this.withQueueLock(async () => {
      this.applyQueueUpdate(queue);
    });
  }

  public async getQueue(): Promise<OfflineMutation[]> {
    return this.cachedQueue;
  }

  public dispose(): void {
    if (this.channel) {
      this.channel.close();
    }
  }
}
