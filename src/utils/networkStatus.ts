import { IPlatformService } from "../services/IPlatformService";
import { Observable, IObservable } from "./observable";
import { BrowserPlatformService } from "../services/platformService"


export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

export interface INetworkStatusProvider {
  isOnline(): boolean;
  getObservable(): IObservable<NetworkStatus>;
}

export class BrowserNetworkStatusProvider implements INetworkStatusProvider {
  private statusObservable: IObservable<NetworkStatus>;
  private isInitialized = false;
  private platformService: IPlatformService;

  constructor(platformService?: IPlatformService) {
    this.platformService = platformService || new BrowserPlatformService();

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

  private initListeners() {
    if (!this.platformService.isBrowserEnv() || this.isInitialized) return;
    this.isInitialized = true;

    this.platformService.addEventListener("online", () => {
      const current = this.statusObservable.getSnapshot()!;
      this.statusObservable.notify({ ...current, isOnline: true });
    });

    this.platformService.addEventListener("offline", () => {
      const current = this.statusObservable.getSnapshot()!;
      this.statusObservable.notify({ ...current, isOnline: false, wasOffline: true });
    });
  }

  isOnline(): boolean {
    if (this.platformService.isBrowserEnv()) {
      const nav = this.platformService.getNavigator();
      if (nav && typeof nav.onLine === "boolean") {
        return nav.onLine;
      }
    }
    return true; // Default to true if not in browser or missing navigator
  }
}

