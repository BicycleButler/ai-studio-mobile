import { EventEmitter } from "./eventEmitter";
import { ConflictData } from "./offlineService";

class SyncConflictBus {
  private emitter = new EventEmitter<ConflictData>();

  public emit(conflict: ConflictData): void {
    this.emitter.emit(conflict);
  }

  public subscribe(listener: (conflict: ConflictData) => void): () => void {
    return this.emitter.subscribe(listener);
  }
}

export const syncConflictBus = new SyncConflictBus();
