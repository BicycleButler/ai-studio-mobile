import { IMutex, Mutex } from "./mutex";
import { Observable, IObservable } from "./observable";
import { ILogger, DefaultLoggerFactory } from "./logger";
import { OfflineMutation } from "./offlineService";
import { ICrossTabNotifier, ICrossTabNotifierFactory } from "./crossTabNotifier";

import { IPlatformService } from "../services/platformService";
import { IObjectUtils, DefaultObjectUtils } from "./objectUtils";
import { AsyncStorage } from "./asyncStorage";


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
  objectUtils?: IObjectUtils;
  storageKey: string;
  storageAdapter: AsyncStorage;
  logger?: ILogger;
  crossTabNotifierFactory: ICrossTabNotifierFactory;
  mutex?: IMutex;
  platformService: IPlatformService;
}

export class OfflineQueueStore implements IOfflineQueueStore {
  private objectUtils: IObjectUtils;
  private queueMutex: IMutex;
  private _queueObservable: IObservable<OfflineMutation[]> = new Observable<OfflineMutation[]>([]);

  public getObservable(): IObservable<OfflineMutation[]> {
    return this._queueObservable;
  }
  private cachedQueue: OfflineMutation[] = [];
  private notifier?: ICrossTabNotifier;
  private storageKey: string;
  private storageAdapter: AsyncStorage;
  private logger: ILogger;

  constructor(config: OfflineQueueStoreConfig) {
    this.storageKey = config.storageKey;
    this.storageAdapter = config.storageAdapter;
    this.logger = config.logger || new DefaultLoggerFactory().createLogger();
    this.objectUtils = config.objectUtils || new DefaultObjectUtils();
    const notifierFactory = config.crossTabNotifierFactory;
    this.queueMutex = config.mutex || new Mutex(this.logger, config.platformService);
    try {
        this.notifier = notifierFactory.createCrossTabNotifier({ name: `${this.storageKey}_channel`, logger: this.logger, platformService: config.platformService });
        this.notifier.onMessage((message) => {
          if (message === 'SYNC') {
            this.syncCacheFromStorage().catch((err) => this.logger.error("Failed to sync cache from storage", err));
          }
        });
    } catch {
      // Ignore cross tab init errors
    }
    this.syncCacheFromStorage().catch(() => {});
  }

  private notifyQueue(queue: OfflineMutation[]) {
    this._queueObservable.notify(this.objectUtils.deepFreeze(queue));
  }

  private async syncCacheFromStorage(): Promise<void> {
    this.cachedQueue = this.objectUtils.deepFreeze(await this.safeGetQueue());
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
    this.cachedQueue = this.objectUtils.deepFreeze(newQueue);
    this.notifyQueue(newQueue);
    this.notifier?.notify('SYNC');
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
    if (this.notifier) {
      this.notifier.dispose();
    }
  }
}
