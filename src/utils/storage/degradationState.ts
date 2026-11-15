import { errorReporter } from "../errorReporter";

export interface StorageDegradationState {
  isDegraded: boolean;
  reason: string | null;
  dismissed: boolean;
}

type Listener = () => void;

class StorageDegradationTracker {
  private state: StorageDegradationState = {
    isDegraded: false,
    reason: null,
    dismissed: false,
  };
  private listeners = new Set<Listener>();

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): StorageDegradationState => {
    return this.state;
  };

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public markDegraded(reason: string): void {
    if (this.state.isDegraded && this.state.reason === reason) return;
    this.state = {
      isDegraded: true,
      reason,
      dismissed: false,
    };
    errorReporter.report("storage_degraded", reason, { scope: "localStorage" });
    this.notify();
  }

  public dismiss(): void {
    if (this.state.dismissed) return;
    this.state = {
      ...this.state,
      dismissed: true,
    };
    this.notify();
  }

  public reset(): void {
    this.state = {
      isDegraded: false,
      reason: null,
      dismissed: false,
    };
    this.notify();
  }
}

export const storageDegradationTracker = new StorageDegradationTracker();
