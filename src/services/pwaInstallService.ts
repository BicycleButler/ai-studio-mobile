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

export class PwaInstallService {
  public stateObservable: Observable<PWAInstallState>;
  private isInitialized = false;

  constructor() {
    const caps = getPlatformCapabilities();
    this.stateObservable = new Observable<PWAInstallState>({
      deferredPrompt: null,
      isInstalled: caps.isNative || caps.isPWA,
      isIOS: caps.isIOS,
      isNativeCapacitor: caps.isNative,
    });
  }

  public initListeners() {
    if (!isBrowserEnvironment() || this.isInitialized) return;
    this.isInitialized = true;

    const currentCaps = getPlatformCapabilities();
    const currentState = this.stateObservable.getSnapshot()!;

    this.stateObservable.notify({
      ...currentState,
      isNativeCapacitor: currentCaps.isNative,
      isInstalled: currentCaps.isNative || currentCaps.isPWA,
      isIOS: currentCaps.isIOS,
    });

    safeAddEventListener("beforeinstallprompt" as keyof WindowEventMap, ((e: Event) => {
      e.preventDefault();
      const current = this.stateObservable.getSnapshot()!;
      this.stateObservable.notify({ ...current, deferredPrompt: e as BeforeInstallPromptEvent });
    }) as EventListener);

    safeAddEventListener("appinstalled" as keyof WindowEventMap, (() => {
      const current = this.stateObservable.getSnapshot()!;
      this.stateObservable.notify({ ...current, isInstalled: true, deferredPrompt: null });
    }) as EventListener);
  }
}

export const defaultPwaInstallService = new PwaInstallService();
