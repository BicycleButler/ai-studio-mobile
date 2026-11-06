import { Observable, IObservable } from "../utils/observable";
import { IPlatformService, BrowserPlatformService } from "./platformService";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export interface PWAInstallState {
  deferredPrompt: BeforeInstallPromptEvent | null;
  isInstalled: boolean;
  isIOS: boolean;
  isNativeCapacitor: boolean;
}

export interface PwaInstallServiceConfig {
    platformService?: IPlatformService;
}

export interface IPwaInstallService {
  stateObservable: IObservable<PWAInstallState>;
  initListeners(): void;
}

export class PwaInstallService implements IPwaInstallService {
  public stateObservable: IObservable<PWAInstallState>;
  private isInitialized = false;
  private platformService: IPlatformService;

  constructor(config?: PwaInstallServiceConfig) {
    this.platformService = config?.platformService || new BrowserPlatformService();

    const caps = this.platformService.getPlatformCaps();
    this.stateObservable = new Observable<PWAInstallState>({
      deferredPrompt: null,
      isInstalled: caps.isNative || caps.isPWA,
      isIOS: caps.isIOS,
      isNativeCapacitor: caps.isNative,
    });
  }

  public initListeners() {
    if (!this.platformService.isBrowserEnv() || this.isInitialized) return;
    this.isInitialized = true;

    const currentCaps = this.platformService.getPlatformCaps();
    const currentState = this.stateObservable.getSnapshot()!;

    this.stateObservable.notify({
      ...currentState,
      isNativeCapacitor: currentCaps.isNative,
      isInstalled: currentCaps.isNative || currentCaps.isPWA,
      isIOS: currentCaps.isIOS,
    });

    this.platformService.addEventListener("beforeinstallprompt" as keyof WindowEventMap, ((e: Event) => {
      e.preventDefault();
      const current = this.stateObservable.getSnapshot()!;
      this.stateObservable.notify({ ...current, deferredPrompt: e as BeforeInstallPromptEvent });
    }) as EventListener);

    this.platformService.addEventListener("appinstalled" as keyof WindowEventMap, (() => {
      const current = this.stateObservable.getSnapshot()!;
      this.stateObservable.notify({ ...current, isInstalled: true, deferredPrompt: null });
    }) as EventListener);
  }
}

