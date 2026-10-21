import { IStorageAdapter } from "./types";
import { isBrowserEnvironment, getSafeWindow, WindowWithLocalStorage } from "../platform";
import { FallbackStorageWrapper } from "./FallbackStorageWrapper";
import { Observable } from "../observable";
import { ILogger, defaultLogger } from "../logger";
export const globalStorageEventObservable = new Observable<StorageEvent>();

if (isBrowserEnvironment()) {
  const win = getSafeWindow();
  if (win) {
    win.addEventListener("storage", (e) => {
      globalStorageEventObservable.notify(e);
    });
  }
}


let _storageInstance: FallbackStorageWrapper | MemoryStorage | null = null;
export const globalStorageQuotaObservable = new Observable<void>();

export function getStorageInstance(): Storage {
  if (_storageInstance) return _storageInstance;

  try {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow() as unknown as WindowWithLocalStorage;
      if (win && win.localStorage) {
        // Validation check to ensure localStorage is fully accessible and not throwing QuotaExceeded on boot (e.g., Safari Private Mode)
        const testKey = "__storage_test__";
        win.localStorage.setItem(testKey, testKey);
        win.localStorage.removeItem(testKey);
        const wrapper = new FallbackStorageWrapper(win.localStorage);
        wrapper.quotaExceededEvent.subscribe(() => {
            globalStorageQuotaObservable.notifySync();
        });
        _storageInstance = wrapper;
        return _storageInstance;
      }
    }
  } catch {
    // Storage access might be denied
  }

  // Fallback to memory if localStorage is unavailable
  _storageInstance = new MemoryStorage();
  return _storageInstance;
}

export class MemoryStorage implements Storage {
  private store: Map<string, string>;
  private keysCache: string[] | null = null;

  constructor() {
    this.store = new Map();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
    this.keysCache = null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
    this.keysCache = null;
  }

  clear(): void {
    this.store.clear();
    this.keysCache = null;
  }

  key(index: number): string | null {
    if (!this.keysCache) {
      this.keysCache = Array.from(this.store.keys());
    }
    return this.keysCache[index] ?? null;
  }

  get length(): number {
    return this.store.size;
  }
}

export function safeParseStorageItem<T>(
  key: string,
  raw: string,
  fallback: T,
  storage: Storage,
  isArray: boolean,
  logger: ILogger = defaultLogger
): T {
  try {
    const parsed = JSON.parse(raw);
    if (isArray && !Array.isArray(parsed)) {
      logger.warn(`Type mismatch in storage for ${key}. Expected array, got ${typeof parsed}. Purging.`);
      storage.removeItem(key);
      return fallback;
    }
    return parsed as T;
  } catch (err: unknown) {
    logger.error(`Corrupted storage item detected: ${key}. Purging.`, err);
    storage.removeItem(key);
    return fallback;
  }
}

export function safeGetStorage<T>(key: string, fallback: T, storageInstance?: Storage, logger: ILogger = defaultLogger): T {
  try {
    const storage = storageInstance || getStorageInstance();
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const isArray = Array.isArray(fallback);
    return safeParseStorageItem(key, raw, fallback, storage, isArray, logger);
  } catch (err: unknown) {
    logger.warn(`Failed to read ${key} from storage:`, err);
    return fallback;
  }
}

export function safeGetStorageKeys(prefix: string, storageInstance?: Storage, logger: ILogger = defaultLogger): string[] {
  const keys: string[] = [];
  try {
    const storage = storageInstance || getStorageInstance();
    const len = storage.length;
    for (let i = 0; i < len; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
  } catch (err: unknown) {
    logger.warn(`Failed to retrieve storage keys for prefix ${prefix}:`, err);
  }
  return keys;
}

export function safeSetStorage<T>(key: string, value: T, storageInstance?: Storage, logger: ILogger = defaultLogger): boolean {
  try {
    const serialized = JSON.stringify(value);
    return safeSetStorageString(key, serialized, storageInstance, logger);
  } catch (err: unknown) {
    logger.warn(`Failed to stringify ${key} for storage:`, err);
    return false;
  }
}

export function safeGetStorageString(key: string, fallback: string = "", storageInstance?: Storage): string {
  try {
    const storage = storageInstance || getStorageInstance();
    return storage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function safeSetStorageString(key: string, value: string, storageInstance?: Storage, logger: ILogger = defaultLogger): boolean {
  try {
    const storage = storageInstance || getStorageInstance();
    storage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    logger.warn(`Failed to write string ${key} to storage:`, err);
    return false;
  }
}

export function safeRemoveStorageKeysWithPrefix(prefix: string, storageInstance?: Storage, logger: ILogger = defaultLogger): void {
  try {
    const storage = storageInstance || getStorageInstance();
    const keysToRemove = safeGetStorageKeys(prefix, storage, logger);
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch (err: unknown) {
    logger.warn(`Failed to remove keys with prefix ${prefix}:`, err);
  }
}

export function safeRemoveStorage(key: string, storageInstance?: Storage, logger: ILogger = defaultLogger): boolean {
  try {
    const storage = storageInstance || getStorageInstance();
    storage.removeItem(key);
    return true;
  } catch (err: unknown) {
    logger.warn(`Failed to remove ${key} from storage:`, err);
    return false;
  }
}

export class DefaultStorageAdapter<T> implements IStorageAdapter<T> {
  constructor(private storageInstance?: Storage, private logger: ILogger = defaultLogger) {}

  get(key: string, fallback: T): T {
    return safeGetStorage(key, fallback, this.storageInstance, this.logger);
  }

  set(key: string, value: T): void {
    safeSetStorage(key, value, this.storageInstance, this.logger);
  }

  remove(key: string): void {
    safeRemoveStorage(key, this.storageInstance, this.logger);
  }
}
