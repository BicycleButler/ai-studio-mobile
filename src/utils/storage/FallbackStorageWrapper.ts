import { IPlatformService } from "../../services/IPlatformService";
import { MemoryStorage } from "./core";
import { BrowserPlatformService } from "../../services/platformService"

import { EventEmitter } from "../eventEmitter";
import { ILogger, DefaultLoggerFactory } from "../logger";

export class FallbackStorageWrapper implements Storage {
  private activeStorage: Storage;
  private memoryFallback: MemoryStorage | null = null;
  public quotaExceededEvent = new EventEmitter<void>();

  private logger: ILogger;
  private platformService: IPlatformService;

  constructor(primaryStorage: Storage, logger: ILogger = new DefaultLoggerFactory().createLogger(), platformService: IPlatformService = new BrowserPlatformService()) {
    this.platformService = platformService;
    this.logger = logger;
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
      this.logger.warn("Could not copy existing storage items to memory fallback during promotion", e);
    }

    this.activeStorage = this.memoryFallback;
    this.logger.warn("Promoted storage to memory fallback due to failure.");
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
      if (e && typeof e === "object" && "name" in e && (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED")) {
        this.logger.warn(`Storage quota exceeded when writing ${key}. Attempting emergency purge...`);
        try {
           this.quotaExceededEvent.emit(); // Synchronous event dispatch for listeners to clear space
           // Retry write after synchronous event dispatch which can have cleared space
           this.activeStorage.setItem(key, value);
           this.logger.info(`Successfully recovered storage quota for write to ${key}`);
           return;
        } catch (retryError) {
           this.logger.warn(`Retry failed after emergency purge for ${key}:`, retryError);
        }
      } else {
        this.logger.warn(`Failed to stringify/write ${key} to storage:`, e);
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
