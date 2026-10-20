import { isBrowserEnvironment, safeAddEventListener, getSafeWindow } from "../utils/platform";
import { useSyncExternalStore } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

let currentIsOnline = (() => {
  const win = getSafeWindow();
  return win && typeof win.navigator.onLine === "boolean"
    ? win.navigator.onLine
    : true;
})();

let currentWasOffline = false;

let listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

let isInitialized = false;

function initNetworkListeners() {
  if (!isBrowserEnvironment() || isInitialized) return;
  isInitialized = true;

  safeAddEventListener("online", () => {
    currentIsOnline = true;
    notify();
  });

  safeAddEventListener("offline", () => {
    currentIsOnline = false;
    currentWasOffline = true;
    notify();
  });
}

function subscribe(listener: () => void) {
  initNetworkListeners();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let cachedSnapshot: NetworkStatus = { isOnline: currentIsOnline, wasOffline: currentWasOffline };

function getSnapshot(): NetworkStatus {
  if (cachedSnapshot.isOnline !== currentIsOnline || cachedSnapshot.wasOffline !== currentWasOffline) {
    cachedSnapshot = { isOnline: currentIsOnline, wasOffline: currentWasOffline };
  }
  return cachedSnapshot;
}

/**
 * Hook to track browser online/offline status with reconnection awareness
 */
export function useNetworkStatus(): NetworkStatus {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
