export interface PwaUpdateState {
  needRefresh: boolean;
  offlineReady: boolean;
  registrationError: string | null;
}

type UpdateSwFn = (reloadPage?: boolean) => Promise<void>;
type Listener = () => void;

class PwaUpdateManager {
  private state: PwaUpdateState = {
    needRefresh: false,
    offlineReady: false,
    registrationError: null,
  };
  private updateFn: UpdateSwFn | null = null;
  private listeners = new Set<Listener>();

  public subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  public getSnapshot = (): PwaUpdateState => {
    return this.state;
  };

  private notify(): void {
    for (const listener of this.listeners) {
      listener();
    }
  }

  public setUpdateFn(fn: UpdateSwFn): void {
    this.updateFn = fn;
  }

  public markNeedRefresh(): void {
    this.state = {
      ...this.state,
      needRefresh: true,
    };
    this.notify();
  }

  public markOfflineReady(): void {
    this.state = {
      ...this.state,
      offlineReady: true,
    };
    this.notify();
  }

  public markRegisterError(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.state = {
      ...this.state,
      registrationError: message,
    };
    this.notify();
  }

  public dismissRefresh(): void {
    if (!this.state.needRefresh) return;
    this.state = {
      ...this.state,
      needRefresh: false,
    };
    this.notify();
  }

  public async applyUpdate(): Promise<void> {
    if (this.updateFn) {
      await this.updateFn(true);
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  }
}

export const pwaUpdateManager = new PwaUpdateManager();
