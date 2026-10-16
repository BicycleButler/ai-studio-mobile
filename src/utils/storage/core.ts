import { isBrowserEnvironment, getSafeWindow, WindowWithLocalStorage } from "../platform";

let _storageInstance: Storage | null = null;

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
        _storageInstance = win.localStorage;
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

function enforceStorageLimits(storage: Storage, key: string, value: string): boolean {
  try {
    storage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "name" in err && err.name === "QuotaExceededError") {
      console.warn(`Storage quota exceeded when writing ${key}. Attempting emergency purge...`);
      return false;
    }
    console.warn(`Failed to stringify/write ${key} to storage:`, err);
    return false;
  }
}

export function safeParseStorageItem<T>(
  key: string,
  raw: string,
  fallback: T,
  storage: Storage,
  isArray: boolean
): T {
  try {
    const parsed = JSON.parse(raw);
    if (isArray && !Array.isArray(parsed)) {
      console.warn(`Type mismatch in storage for ${key}. Expected array, got ${typeof parsed}. Purging.`);
      storage.removeItem(key);
      return fallback;
    }
    return parsed as T;
  } catch (err: unknown) {
    console.error(`Corrupted storage item detected: ${key}. Purging.`, err);
    storage.removeItem(key);
    return fallback;
  }
}

export function safeGetStorage<T>(key: string, fallback: T, storageInstance?: Storage): T {
  try {
    const storage = storageInstance || getStorageInstance();
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return safeParseStorageItem(key, raw, fallback, storage, false);
  } catch (err: unknown) {
    console.warn(`Failed to read ${key} from storage:`, err);
    return fallback;
  }
}

export function safeGetStorageArray<T>(key: string, fallback: T[] = [], storageInstance?: Storage): T[] {
  try {
    const storage = storageInstance || getStorageInstance();
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return safeParseStorageItem(key, raw, fallback, storage, true) as T[];
  } catch (err: unknown) {
    console.warn(`Failed to read ${key} from storage:`, err);
    return fallback;
  }
}

export function safeGetStorageKeys(prefix: string, storageInstance?: Storage): string[] {
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
    console.warn(`Failed to retrieve storage keys for prefix ${prefix}:`, err);
  }
  return keys;
}

export function safeSetStorage<T>(key: string, value: T, storageInstance?: Storage): boolean {
  try {
    const storage = storageInstance || getStorageInstance();
    const serialized = JSON.stringify(value);
    return enforceStorageLimits(storage, key, serialized);
  } catch (err: unknown) {
    console.warn(`Failed to stringify ${key} for storage:`, err);
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

export function safeSetStorageString(key: string, value: string, storageInstance?: Storage): boolean {
  try {
    const storage = storageInstance || getStorageInstance();
    return enforceStorageLimits(storage, key, value);
  } catch (err: unknown) {
    console.warn(`Failed to write string ${key} to storage:`, err);
    return false;
  }
}

export function safeRemoveStorageKeysWithPrefix(prefix: string, storageInstance?: Storage): void {
  try {
    const storage = storageInstance || getStorageInstance();
    const keysToRemove = safeGetStorageKeys(prefix, storage);
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch (err: unknown) {
    console.warn(`Failed to remove keys with prefix ${prefix}:`, err);
  }
}

export function safeRemoveStorage(key: string, storageInstance?: Storage): boolean {
  try {
    const storage = storageInstance || getStorageInstance();
    storage.removeItem(key);
    return true;
  } catch (err: unknown) {
    console.warn(`Failed to remove ${key} from storage:`, err);
    return false;
  }
}
