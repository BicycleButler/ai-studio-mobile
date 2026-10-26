import { Mutex } from "./mutex";
import { Observable, IObservable } from "./observable";
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

export interface IAsyncStorageAdapter {
    getItem<T>(key: string): Promise<T | undefined>;
    setItem<T>(key: string, value: T): Promise<void>;
}

export interface OfflineQueueStoreConfig {
  storageKey: string;
  storageAdapter: IAsyncStorageAdapter;
  logger?: ILogger;
  createBroadcastChannel?: (name: string) => BroadcastChannel | undefined;
}

export class OfflineQueueStore implements IOfflineQueueStore {
  private queueMutex: Mutex;
  private _queueObservable: IObservable<OfflineMutation[]> = new Observable<OfflineMutation[]>([]);

  public getObservable(): IObservable<OfflineMutation[]> {
    return this._queueObservable;
  }
  private cachedQueue: OfflineMutation[] = [];
  private channel?: BroadcastChannel;
  private storageKey: string;
  private storageAdapter: IAsyncStorageAdapter;
  private logger: ILogger;
  private createBroadcastChannel: (name: string) => BroadcastChannel | undefined;

  constructor(config: OfflineQueueStoreConfig) {
    this.storageKey = config.storageKey;
    this.storageAdapter = config.storageAdapter;
    this.logger = config.logger || defaultLogger;
    this.createBroadcastChannel = config.createBroadcastChannel || ((name: string) => {
        if (typeof BroadcastChannel !== 'undefined') {
            return new BroadcastChannel(name);
        }
        return undefined;
    });
    this.queueMutex = new Mutex(this.logger);
    try {
        const channel = this.createBroadcastChannel(`${this.storageKey}_channel`);
        if (channel) {
            this.channel = channel;
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
      throw err;
    }
  }

  private async applyQueueUpdate(newQueue: OfflineMutation[]): Promise<void> {
    await this.safeSetQueue(newQueue);
    this.cachedQueue = newQueue;
    this.notifyQueue(newQueue);
    try {
        this.channel?.postMessage('SYNC');
    } catch (err) {
      this.logger.error("Failed to notify broadcast channel", err);
    }
  }

  private async withQueueLock(action: (queue: OfflineMutation[]) => OfflineMutation[] | Promise<OfflineMutation[]>): Promise<void> {
    await this.queueMutex.run(async () => {
      const queue = await this.safeGetQueue();
      const newQueue = await action(queue);
      await this.applyQueueUpdate(newQueue);
    });
  }

  public async enqueue(mutation: OfflineMutation): Promise<void> {
    await this.withQueueLock((queue) => {
      queue.push(mutation);
      return queue;
    });
  }

  public async remove(id: string): Promise<void> {
    await this.withQueueLock((queue) => {
      return queue.filter((m) => m.id !== id);
    });
  }

  public async removeMany(ids: string[]): Promise<void> {
    if (!ids || ids.length === 0) return;
    const idsSet = new Set(ids);
    await this.withQueueLock((queue) => {
      return queue.filter((m) => !idsSet.has(m.id));
    });
  }

  public async clear(): Promise<void> {
    await this.withQueueLock(() => {
      return [];
    });
  }

  public async replace(queue: OfflineMutation[]): Promise<void> {
    await this.withQueueLock(() => {
      return queue;
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
