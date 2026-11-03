import { IStorageAdapter } from "./types";
import { defaultPlatformService } from "../../services/platformService";
import { FallbackStorageWrapper } from "./FallbackStorageWrapper";

import { ILogger, defaultLogger } from "../logger";
import { EventEmitter } from "../eventEmitter";
import { ISerializer, JsonSerializer } from "./serializer";
const defaultSerializer = new JsonSerializer();

export function createDefaultStorageInstance(): Storage {
  try {
    if (defaultPlatformService.isBrowserEnv()) {
      const localStorage = defaultPlatformService.getLocalStorage();
      if (localStorage) {
        const testKey = "__storage_test__";
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        const wrapper = new FallbackStorageWrapper(localStorage);
        wrapper.quotaExceededEvent.subscribe(() => {
            defaultPlatformService.getStorageQuotaObservable().emit();
        });
        return wrapper;
      }
    }
  } catch {
  }
  return new MemoryStorage();
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
  logger: ILogger = defaultLogger,
  serializer: ISerializer = defaultSerializer
): T {
  try {
    const parsed = serializer.deserialize(raw);
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

export function safeGetStorage<T>(key: string, fallback: T, storageInstance: Storage, logger: ILogger = defaultLogger, serializer: ISerializer = defaultSerializer): T {
  try {
    const storage = storageInstance;
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    const isArray = Array.isArray(fallback);
    return safeParseStorageItem(key, raw, fallback, storage, isArray, logger, serializer);
  } catch (err: unknown) {
    logger.warn(`Failed to read ${key} from storage:`, err);
    return fallback;
  }
}

export function safeGetStorageKeys(prefix: string, storageInstance: Storage, logger: ILogger = defaultLogger): string[] {
  const keys: string[] = [];
  try {
    const storage = storageInstance;
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

export function safeSetStorage<T>(key: string, value: T, storageInstance: Storage, logger: ILogger = defaultLogger, serializer: ISerializer = defaultSerializer): boolean {
  try {
    const serialized = serializer.serialize(value);
    return safeSetStorageString(key, serialized, storageInstance, logger);
  } catch (err: unknown) {
    logger.warn(`Failed to stringify ${key} for storage:`, err);
    return false;
  }
}

export function safeGetStorageString(key: string, fallback: string = "", storageInstance: Storage): string {
  try {
    const storage = storageInstance;
    return storage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function safeSetStorageString(key: string, value: string, storageInstance: Storage, logger: ILogger = defaultLogger): boolean {
  try {
    const storage = storageInstance;
    storage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    logger.warn(`Failed to write string ${key} to storage:`, err);
    return false;
  }
}

export function safeRemoveStorageKeysWithPrefix(prefix: string, storageInstance: Storage, logger: ILogger = defaultLogger): void {
  try {
    const storage = storageInstance;
    const keysToRemove = safeGetStorageKeys(prefix, storage, logger);
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch (err: unknown) {
    logger.warn(`Failed to remove keys with prefix ${prefix}:`, err);
  }
}

export function safeRemoveStorage(key: string, storageInstance: Storage, logger: ILogger = defaultLogger): boolean {
  try {
    const storage = storageInstance;
    storage.removeItem(key);
    return true;
  } catch (err: unknown) {
    logger.warn(`Failed to remove ${key} from storage:`, err);
    return false;
  }
}

export class DefaultStorageAdapter<T> implements IStorageAdapter<T> {
  constructor(private storageInstance: Storage, private logger: ILogger = defaultLogger, private serializer: ISerializer = defaultSerializer) {}

  get(key: string, fallback: T): T {
    return safeGetStorage(key, fallback, this.storageInstance, this.logger, this.serializer);
  }

  set(key: string, value: T): void {
    safeSetStorage(key, value, this.storageInstance, this.logger, this.serializer);
  }

  remove(key: string): void {
    safeRemoveStorage(key, this.storageInstance, this.logger);
  }
}
