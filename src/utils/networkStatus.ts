import { isBrowserEnvironment, getSafeNavigator, safeAddEventListener } from "./platform";
import { Observable } from "./observable";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

export interface INetworkStatusProvider {
  isOnline(): boolean;
  getObservable(): Observable<NetworkStatus>;
}

export class BrowserNetworkStatusProvider implements INetworkStatusProvider {
  private statusObservable: Observable<NetworkStatus>;
  private isInitialized = false;

  constructor() {
    const initialIsOnline = (() => {
      if (isBrowserEnvironment()) {
        const nav = getSafeNavigator();
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

  public getObservable(): Observable<NetworkStatus> {
    this.initListeners();
    return this.statusObservable;
  }

  private initListeners() {
    if (!isBrowserEnvironment() || this.isInitialized) return;
    this.isInitialized = true;

    safeAddEventListener("online", () => {
      const current = this.statusObservable.getSnapshot()!;
      this.statusObservable.notify({ ...current, isOnline: true });
    });

    safeAddEventListener("offline", () => {
      const current = this.statusObservable.getSnapshot()!;
      this.statusObservable.notify({ ...current, isOnline: false, wasOffline: true });
    });
  }

  isOnline(): boolean {
    if (isBrowserEnvironment()) {
      const nav = getSafeNavigator();
      if (nav && typeof nav.onLine === "boolean") {
        return nav.onLine;
      }
    }
    return true; // Default to true if not in browser or missing navigator
  }
}

export const defaultNetworkStatusProvider = new BrowserNetworkStatusProvider();
