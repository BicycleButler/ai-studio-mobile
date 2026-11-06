import { get, set } from "idb-keyval";
import { ILogger, DefaultLoggerFactory } from "./logger";

export interface AsyncStorage {
  getItem<T>(key: string): Promise<T | undefined>;
  setItem<T>(key: string, value: T): Promise<void>;
}

export class IndexedDbAsyncStorage implements AsyncStorage {
  async getItem<T>(key: string): Promise<T | undefined> {
    try {
      return await get<T>(key);
    } catch (e) {
      if (e instanceof ReferenceError && e.message.includes('indexedDB')) {
        return undefined;
      }
      throw e;
    }
  }
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      await set(key, value);
    } catch (e) {
      if (e instanceof ReferenceError && e.message.includes('indexedDB')) {
        return;
      }
      throw e;
    }
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
  private logger: ILogger;

  constructor(adapters: AsyncStorage[], logger: ILogger = new DefaultLoggerFactory().createLogger()) {
    this.adapters = adapters;
    this.logger = logger;
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    let _lastError: unknown;
    for (let i = 0; i < this.adapters.length; i++) {
      try {
        const val = await this.adapters[i].getItem<T>(key);
        if (val !== undefined) {
          return val;
        }
      } catch (e) {
        _lastError = e;
        this.logger.warn(`Storage adapter failed to get key ${key}:`, e);
      }
    }
    if (this.adapters.length > 0 && _lastError) {
      this.logger.warn(`All storage adapters failed to get key ${key}. Assuming cache miss.`, _lastError);
    }
    return undefined;
  }

  async setItem<T>(key: string, value: T): Promise<void> {
    let _lastError: unknown;
    for (let i = 0; i < this.adapters.length; i++) {
      try {
        await this.adapters[i].setItem<T>(key, value);
        return; // Success, stop trying other adapters
      } catch (e) {
        _lastError = e;
        this.logger.warn(`Storage adapter failed to set key ${key}:`, e);
      }
    }
    this.logger.error(`All storage adapters failed to set key ${key}.`, _lastError);
    throw _lastError || new Error(`Failed to set item in any storage adapter`);
  }
}
