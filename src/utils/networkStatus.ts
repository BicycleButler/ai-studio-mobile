import { IPlatformService } from "../services/IPlatformService";
import { Observable, IObservable } from "./observable";
import { BrowserPlatformService } from "../services/platformService";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

export interface INetworkStatusProvider {
  isOnline(): boolean;
  getObservable(): IObservable<NetworkStatus>;
}

export interface BrowserNetworkStatusConfig {
  enableActiveHealthCheck?: boolean;
  healthEndpoint?: string;
  probeIntervalMs?: number;
  probeTimeoutMs?: number;
}

export class BrowserNetworkStatusProvider implements INetworkStatusProvider {
  private statusObservable: IObservable<NetworkStatus>;
  private isInitialized = false;
  private platformService: IPlatformService;
  private config: Required<BrowserNetworkStatusConfig>;
  private cleanupFns: Array<() => void> = [];
  private intervalId: unknown = null;
  private isProbing = false;

  constructor(platformService?: IPlatformService, config: BrowserNetworkStatusConfig = {}) {
    this.platformService = platformService || new BrowserPlatformService();
    this.config = {
      enableActiveHealthCheck: config.enableActiveHealthCheck ?? false,
      healthEndpoint: config.healthEndpoint ?? "/api/health",
      probeIntervalMs: config.probeIntervalMs ?? 30_000,
      probeTimeoutMs: config.probeTimeoutMs ?? 4_000,
    };

    const initialIsOnline = (() => {
      if (this.platformService.isBrowserEnv()) {
        const nav = this.platformService.getNavigator();
        if (nav && typeof nav.onLine === "boolean") {
          return nav.onLine;
        }
      }
      return true;
    })();

    this.statusObservable = new Observable<NetworkStatus>({
      isOnline: initialIsOnline,
      wasOffline: false,
    });
  }

  public getObservable(): IObservable<NetworkStatus> {
    this.initListeners();
    return this.statusObservable;
  }

  private setOnlineState(nextOnline: boolean): void {
    const current = this.statusObservable.getSnapshot()!;
    if (current.isOnline === nextOnline) return;
    this.statusObservable.notify({
      isOnline: nextOnline,
      wasOffline: current.wasOffline || !nextOnline,
    });
  }

  public async probeReachability(): Promise<boolean> {
    if (!this.platformService.isBrowserEnv() || typeof fetch !== "function") {
      return this.isOnline();
    }
    const nav = this.platformService.getNavigator();
    if (nav && typeof nav.onLine === "boolean" && !nav.onLine) {
      this.setOnlineState(false);
      return false;
    }
    if (this.isProbing) {
      return this.statusObservable.getSnapshot()!.isOnline;
    }

    this.isProbing = true;
    const controller = this.platformService.createAbortController();
    const timeoutId = controller
      ? this.platformService.setTimeout(() => controller.abort(), this.config.probeTimeoutMs)
      : null;

    try {
      const response = await fetch(this.config.healthEndpoint, {
        method: "GET",
        cache: "no-store",
        signal: controller?.signal,
      });
      const reachable = response.ok || response.status < 500;
      this.setOnlineState(reachable);
      return reachable;
    } catch {
      this.setOnlineState(false);
      return false;
    } finally {
      if (timeoutId !== null) {
        this.platformService.clearTimeout(timeoutId);
      }
      this.isProbing = false;
    }
  }

  private initListeners() {
    if (!this.platformService.isBrowserEnv() || this.isInitialized) return;
    this.isInitialized = true;

    this.cleanupFns.push(
      this.platformService.addEventListener("online", () => {
        if (this.config.enableActiveHealthCheck) {
          void this.probeReachability();
        } else {
          this.setOnlineState(true);
        }
      })
    );

    this.cleanupFns.push(
      this.platformService.addEventListener("offline", () => {
        this.setOnlineState(false);
      })
    );

    if (this.config.enableActiveHealthCheck) {
      this.cleanupFns.push(
        this.platformService.addDocumentListener("visibilitychange", () => {
          const doc = this.platformService.getDocument();
          if (doc && doc.visibilityState === "visible") {
            void this.probeReachability();
          }
        })
      );

      this.intervalId = this.platformService.setInterval(() => {
        const doc = this.platformService.getDocument();
        if (!doc || doc.visibilityState === "visible") {
          void this.probeReachability();
        }
      }, this.config.probeIntervalMs);
    }
  }

  isOnline(): boolean {
    const snap = this.statusObservable.getSnapshot();
    if (this.config.enableActiveHealthCheck && snap) {
      return snap.isOnline;
    }
    if (this.platformService.isBrowserEnv()) {
      const nav = this.platformService.getNavigator();
      if (nav && typeof nav.onLine === "boolean") {
        return nav.onLine;
      }
    }
    return true;
  }

  public dispose(): void {
    for (const cleanup of this.cleanupFns) {
      cleanup();
    }
    this.cleanupFns = [];
    if (this.intervalId !== null) {
      this.platformService.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isInitialized = false;
  }
}
