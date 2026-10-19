import { get, set } from "idb-keyval";
import { generateUniqueId } from "./idGenerator";
import { Mutex } from "./mutex";
import { Observable, IObservable } from "./observable";

export interface AsyncStorage {
  getItem<T>(key: string): Promise<T | undefined>;
  setItem<T>(key: string, value: T): Promise<void>;
}

export class IndexedDbAsyncStorage implements AsyncStorage {
  async getItem<T>(key: string): Promise<T | undefined> {
    return get<T>(key);
  }
  async setItem<T>(key: string, value: T): Promise<void> {
    return set(key, value);
  }
}

export class MemoryAsyncStorage implements AsyncStorage {
  private store = new Map<string, unknown>();

  async getItem<T>(key: string): Promise<T | undefined> {
    return this.store.get(key) as T | undefined;
  }
  async setItem<T>(key: string, value: T): Promise<void> {
    this.store.set(key, value);
  }
}

export class FallbackAsyncStorage implements AsyncStorage {
  private adapters: AsyncStorage[];
  private activeAdapterIndex = 0;

  constructor(adapters: AsyncStorage[]) {
    this.adapters = adapters;
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    let lastError: unknown;
    for (let i = this.activeAdapterIndex; i < this.adapters.length; i++) {
      try {
        return await this.adapters[i].getItem<T>(key);
      } catch (e) {
        lastError = e;
        // Continue to the next adapter
      }
    }
    console.error("All storage adapters failed to getItem", lastError);
    return undefined;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    let lastError: unknown;
    for (let i = this.activeAdapterIndex; i < this.adapters.length; i++) {
      try {
        await this.adapters[i].setItem<T>(key, value);
        this.activeAdapterIndex = i; // Save the working adapter index
        return; // Success, stop trying other adapters
      } catch (e) {
        lastError = e;
        // Continue to the next adapter
      }
    }
    console.error("All storage adapters failed to setItem", lastError);
  }
}

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

export type SyncHandler = (mutation: OfflineMutation) => Promise<{ success: boolean; conflict?: ConflictData }>;

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
}

export class OfflineService implements IOfflineService {
  private syncRegistry: Record<string, SyncHandler> = {};
  private queueMutex = new Mutex();
  public queueObservable: IObservable<OfflineMutation[]> = new Observable<OfflineMutation[]>();
  private cachedQueue: OfflineMutation[] = [];
  private channel?: BroadcastChannel;

  constructor(
    private storageKey: string = OFFLINE_QUEUE_KEY,
    private storageAdapter: AsyncStorage = new FallbackAsyncStorage([
      new IndexedDbAsyncStorage(),
      new MemoryAsyncStorage()
    ])
  ) {
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        this.channel = new BroadcastChannel(`${this.storageKey}_channel`);
        this.channel.onmessage = (event) => {
          if (event.data === 'SYNC') {
            this.syncCacheFromStorage().catch(console.error);
          }
        };
      }
    } catch {
      // Ignore broadcast channel init errors
    }
    this.syncCacheFromStorage().catch(() => {});
  }

  public registerSyncHandler(type: string, handler: SyncHandler): void {
    this.syncRegistry[type] = handler;
  }

  private notifyQueue(queue: OfflineMutation[]) {
    this.queueObservable.notify(queue);
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
      console.error(`[OfflineService] Critical failure reading from storage (${this.storageKey})`, err);
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
      console.error(`[OfflineService] Critical failure writing to storage (${this.storageKey})`, err);
    }
  }

  private async withQueueLock<T>(action: (queue: OfflineMutation[]) => Promise<T | void>): Promise<T | void> {
    return this.queueMutex.run(async () => {
      const queue = await this.safeGetQueue();
      const result = await action(queue);
      return result;
    });
  }

  public async enqueueOfflineMutation(type: string, payload: unknown, version?: number): Promise<void> {
    await this.withQueueLock(async (queue) => {
      queue.push({
        type,
        payload,
        timestamp: Date.now(),
        id: generateUniqueId("mutation"),
        version,
      });
      await this.safeSetQueue(queue);
      this.cachedQueue = queue;
      this.notifyQueue(queue);
      this.channel?.postMessage('SYNC');
    });
  }

  public async removeOfflineMutation(id: string): Promise<void> {
    await this.withQueueLock(async (queue) => {
      const newQueue = queue.filter((m) => m.id !== id);
      await this.safeSetQueue(newQueue);
      this.cachedQueue = newQueue;
      this.notifyQueue(newQueue);
      this.channel?.postMessage('SYNC');
    });
  }

  public async getOfflineQueueLength(): Promise<number> {
    return this.cachedQueue.length;
  }

  public async clearOfflineMutations(): Promise<void> {
    await this.withQueueLock(async () => {
      await this.safeSetQueue([]);
      this.cachedQueue = [];
      this.notifyQueue([]);
      this.channel?.postMessage('SYNC');
    });
  }

  public async processOfflineMutations(): Promise<{
    success: boolean;
    conflicts: ConflictData[];
  }> {
    let queue: OfflineMutation[] = [];
    await this.withQueueLock(async (q) => { queue = q; });

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
          success = true; // No handler means we can just drop it? Actually the original code sets it to true
        }
      } catch (e) {
        console.error(`Failed to sync offline mutation ${mutation.type}`, e);
      }

      if (!success) {
        remainingQueue.push(mutation);
        processSuccess = false;
      }
    }

    await this.withQueueLock(async (currentQueue) => {
      const successfulIds = new Set(
        queue
          .filter(m => !remainingQueue.some(rm => rm.id === m.id))
          .map(m => m.id)
      );

      const finalQueue = currentQueue.filter(m => !successfulIds.has(m.id));
      await this.safeSetQueue(finalQueue);
      this.cachedQueue = finalQueue;
      this.notifyQueue(finalQueue);
      this.channel?.postMessage('SYNC');
    });

    return { success: processSuccess, conflicts };
  }

  public async getOfflineQueue(): Promise<OfflineMutation[]> {
    return this.cachedQueue;
  }
}

export const defaultOfflineService = new OfflineService();

// Export the observable for backwards compatibility if anyone imports it directly.
export const queueObservable = defaultOfflineService.queueObservable;

export function registerSyncHandler(type: string, handler: SyncHandler) {
  defaultOfflineService.registerSyncHandler(type, handler);
}

export async function enqueueOfflineMutation(type: string, payload: unknown, version?: number): Promise<void> {
  return defaultOfflineService.enqueueOfflineMutation(type, payload, version);
}

export async function removeOfflineMutation(id: string): Promise<void> {
  return defaultOfflineService.removeOfflineMutation(id);
}

export async function getOfflineQueueLength(): Promise<number> {
  return defaultOfflineService.getOfflineQueueLength();
}

export async function clearOfflineMutations(): Promise<void> {
  return defaultOfflineService.clearOfflineMutations();
}

export async function processOfflineMutations(): Promise<{
  success: boolean;
  conflicts: ConflictData[];
}> {
  return defaultOfflineService.processOfflineMutations();
}

export async function getOfflineQueue(): Promise<OfflineMutation[]> {
  return defaultOfflineService.getOfflineQueue();
}
