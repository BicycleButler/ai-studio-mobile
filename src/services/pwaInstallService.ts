import { isBrowserEnvironment, getPlatformCapabilities, safeAddEventListener } from "../utils/platform";
import { Observable } from "../utils/observable";

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
    isBrowserEnv?: typeof isBrowserEnvironment;
    getPlatformCaps?: typeof getPlatformCapabilities;
    addEventListener?: typeof safeAddEventListener;
}

export class PwaInstallService {
  public stateObservable: Observable<PWAInstallState>;
  private isInitialized = false;
  private isBrowserEnv: typeof isBrowserEnvironment;
  private getPlatformCaps: typeof getPlatformCapabilities;
  private addEventListener: typeof safeAddEventListener;

  constructor(config?: PwaInstallServiceConfig) {
    this.isBrowserEnv = config?.isBrowserEnv || isBrowserEnvironment;
    this.getPlatformCaps = config?.getPlatformCaps || getPlatformCapabilities;
    this.addEventListener = config?.addEventListener || safeAddEventListener;

    const caps = this.getPlatformCaps();
    this.stateObservable = new Observable<PWAInstallState>({
      deferredPrompt: null,
      isInstalled: caps.isNative || caps.isPWA,
      isIOS: caps.isIOS,
      isNativeCapacitor: caps.isNative,
    });
  }

  public initListeners() {
    if (!this.isBrowserEnv() || this.isInitialized) return;
    this.isInitialized = true;

    const currentCaps = this.getPlatformCaps();
    const currentState = this.stateObservable.getSnapshot()!;

    this.stateObservable.notify({
      ...currentState,
      isNativeCapacitor: currentCaps.isNative,
      isInstalled: currentCaps.isNative || currentCaps.isPWA,
      isIOS: currentCaps.isIOS,
    });

    this.addEventListener("beforeinstallprompt" as keyof WindowEventMap, ((e: Event) => {
      e.preventDefault();
      const current = this.stateObservable.getSnapshot()!;
      this.stateObservable.notify({ ...current, deferredPrompt: e as BeforeInstallPromptEvent });
    }) as EventListener);

    this.addEventListener("appinstalled" as keyof WindowEventMap, (() => {
      const current = this.stateObservable.getSnapshot()!;
      this.stateObservable.notify({ ...current, isInstalled: true, deferredPrompt: null });
    }) as EventListener);
  }
}

export const defaultPwaInstallService = new PwaInstallService();
