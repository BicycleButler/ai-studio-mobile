import { isBrowserEnvironment, safeAddEventListener, getSafeWindow } from "../utils/platform";
import { Observable } from "../utils/observable";
import { useStore } from "./useStore";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

const initialIsOnline = (() => {
  const win = getSafeWindow();
  return win && typeof win.navigator.onLine === "boolean"
    ? win.navigator.onLine
    : true;
})();

export const networkStatusObservable = new Observable<NetworkStatus>({
  isOnline: initialIsOnline,
  wasOffline: false,
});

let isInitialized = false;

function initNetworkListeners() {
  if (!isBrowserEnvironment() || isInitialized) return;
  isInitialized = true;

  safeAddEventListener("online", () => {
    const current = networkStatusObservable.getSnapshot()!;
    networkStatusObservable.notify({ ...current, isOnline: true });
  });

  safeAddEventListener("offline", () => {
    const current = networkStatusObservable.getSnapshot()!;
    networkStatusObservable.notify({ ...current, isOnline: false, wasOffline: true });
  });
}

/**
 * Hook to track browser online/offline status with reconnection awareness
 */
export function useNetworkStatus(): NetworkStatus {
  return useStore(networkStatusObservable, initNetworkListeners);
}
