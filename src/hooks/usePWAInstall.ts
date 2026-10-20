import { useSyncExternalStore, useCallback } from "react";
import { isBrowserEnvironment, getPlatformCapabilities, safeAddEventListener } from "../utils/platform";

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

let currentState: PWAInstallState = {
  deferredPrompt: null,
  isInstalled: caps.isNative || caps.isPWA,
  isIOS: caps.isIOS,
  isNativeCapacitor: caps.isNative,
};

let listeners = new Set<() => void>();
let isInitialized = false;

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

function initPWAInstallListeners() {
  if (!isBrowserEnvironment() || isInitialized) return;
  isInitialized = true;

  const caps = getPlatformCapabilities();
  currentState = {
    ...currentState,
    isNativeCapacitor: caps.isNative,
    isInstalled: caps.isNative || caps.isPWA,
    isIOS: caps.isIOS,
  };
  notify();

  safeAddEventListener("beforeinstallprompt" as keyof WindowEventMap, ((e: Event) => {
    e.preventDefault();
    currentState = { ...currentState, deferredPrompt: e as BeforeInstallPromptEvent };
    notify();
  }) as EventListener);

  safeAddEventListener("appinstalled" as keyof WindowEventMap, (() => {
    currentState = { ...currentState, isInstalled: true, deferredPrompt: null };
    notify();
  }) as EventListener);
}

function subscribe(listener: () => void) {
  initPWAInstallListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return currentState;
}

export function usePWAInstall() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const install = useCallback(async (): Promise<boolean> => {
    if (!state.deferredPrompt) return false;
    try {
      await state.deferredPrompt.prompt();
      const choiceResult = await state.deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        currentState = { ...currentState, isInstalled: true, deferredPrompt: null };
        notify();
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
