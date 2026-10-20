import { get, set } from "idb-keyval";

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

  constructor(adapters: AsyncStorage[]) {
    this.adapters = adapters;
  }

  async getItem<T>(key: string): Promise<T | undefined> {
    let lastError: unknown;
    for (let i = 0; i < this.adapters.length; i++) {
      try {
        const val = await this.adapters[i].getItem<T>(key);
        return val;
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
    for (let i = 0; i < this.adapters.length; i++) {
      try {
        await this.adapters[i].setItem<T>(key, value);
        return; // Success, stop trying other adapters
      } catch (e) {
        lastError = e;
        // Continue to the next adapter
      }
    }
    console.error("All storage adapters failed to setItem", lastError);
  }
}
