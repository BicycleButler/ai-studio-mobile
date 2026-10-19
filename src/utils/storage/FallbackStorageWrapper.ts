import { MemoryStorage } from "./core";

export class FallbackStorageWrapper implements Storage {
  private activeStorage: Storage;
  private memoryFallback: MemoryStorage | null = null;

  constructor(primaryStorage: Storage) {
    this.activeStorage = primaryStorage;
  }

  private promoteToMemory(): void {
    if (this.memoryFallback) return; // Already promoted

    this.memoryFallback = new MemoryStorage();

    // Attempt to salvage data
    try {
      for (let i = 0; i < this.activeStorage.length; i++) {
        const key = this.activeStorage.key(i);
        if (key) {
          const value = this.activeStorage.getItem(key);
          if (value !== null) {
            this.memoryFallback.setItem(key, value);
          }
        }
      }
    } catch (e) {
      console.warn("Could not copy existing storage items to memory fallback during promotion", e);
    }

    this.activeStorage = this.memoryFallback;
    console.warn("Promoted storage to memory fallback due to failure.");
  }

  getItem(key: string): string | null {
    try {
      return this.activeStorage.getItem(key);
    } catch {
      this.promoteToMemory();
      return this.activeStorage.getItem(key);
    }
  }

  setItem(key: string, value: string): void {
    try {
      this.activeStorage.setItem(key, value);
    } catch (e) {
      if (e && typeof e === "object" && "name" in e && e.name === "QuotaExceededError") {
        console.warn(`Storage quota exceeded when writing ${key}. Attempting emergency purge...`);
      } else {
        console.warn(`Failed to stringify/write ${key} to storage:`, e);
      }
      this.promoteToMemory();
      // Try again on memory fallback
      this.activeStorage.setItem(key, value);
    }
  }

  removeItem(key: string): void {
    try {
      this.activeStorage.removeItem(key);
    } catch {
      this.promoteToMemory();
      this.activeStorage.removeItem(key);
    }
  }

  clear(): void {
    try {
      this.activeStorage.clear();
    } catch {
      this.promoteToMemory();
      this.activeStorage.clear();
    }
  }

  key(index: number): string | null {
    try {
      return this.activeStorage.key(index);
    } catch {
      this.promoteToMemory();
      return this.activeStorage.key(index);
    }
  }

  get length(): number {
    try {
      return this.activeStorage.length;
    } catch {
      this.promoteToMemory();
      return this.activeStorage.length;
    }
  }
}
