import { useCallback } from "react";
import { isBrowserEnvironment, getPlatformCapabilities, safeAddEventListener } from "../utils/platform";
import { Observable } from "../utils/observable";
import { useStore } from "./useStore";

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

const caps = getPlatformCapabilities();

export const pwaInstallObservable = new Observable<PWAInstallState>({
  deferredPrompt: null,
  isInstalled: caps.isNative || caps.isPWA,
  isIOS: caps.isIOS,
  isNativeCapacitor: caps.isNative,
});

let isInitialized = false;

function initPWAInstallListeners() {
  if (!isBrowserEnvironment() || isInitialized) return;
  isInitialized = true;

  const currentCaps = getPlatformCapabilities();
  const currentState = pwaInstallObservable.getSnapshot()!;

  pwaInstallObservable.notify({
    ...currentState,
    isNativeCapacitor: currentCaps.isNative,
    isInstalled: currentCaps.isNative || currentCaps.isPWA,
    isIOS: currentCaps.isIOS,
  });

  safeAddEventListener("beforeinstallprompt" as keyof WindowEventMap, ((e: Event) => {
    e.preventDefault();
    const current = pwaInstallObservable.getSnapshot()!;
    pwaInstallObservable.notify({ ...current, deferredPrompt: e as BeforeInstallPromptEvent });
  }) as EventListener);

  safeAddEventListener("appinstalled" as keyof WindowEventMap, (() => {
    const current = pwaInstallObservable.getSnapshot()!;
    pwaInstallObservable.notify({ ...current, isInstalled: true, deferredPrompt: null });
  }) as EventListener);
}

export function usePWAInstall() {
  const state = useStore(pwaInstallObservable, initPWAInstallListeners);

  const install = useCallback(async (): Promise<boolean> => {
    if (!state.deferredPrompt) return false;
    try {
      await state.deferredPrompt.prompt();
      const choiceResult = await state.deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        const current = pwaInstallObservable.getSnapshot()!;
        pwaInstallObservable.notify({ ...current, isInstalled: true, deferredPrompt: null });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [state.deferredPrompt]);

  return {
    isInstallable: Boolean(state.deferredPrompt),
    isInstalled: state.isInstalled,
    isIOS: state.isIOS,
    isCapacitor: state.isNativeCapacitor,
    install,
  };
}
