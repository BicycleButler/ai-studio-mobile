import { isBrowserEnvironment, safeAddEventListener, getSafeWindow } from "../utils/platform";
import { useState, useEffect } from "react";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

/**
 * Hook to track browser online/offline status with reconnection awareness
 */

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    const win = getSafeWindow();
    return win && typeof win.navigator.onLine === "boolean"
      ? win.navigator.onLine
      : true;
  });

  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    if (!isBrowserEnvironment()) return;

    const handleOnline = () => {
      setIsOnline(true);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
    };

    const removeOnline = safeAddEventListener("online", handleOnline);
    const removeOffline = safeAddEventListener("offline", handleOffline);

    return () => {
      removeOnline();
      removeOffline();
    };
  }, []);

  return { isOnline, wasOffline };
}
