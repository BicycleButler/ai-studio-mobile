import { isBrowserEnvironment, safeAddEventListener } from "../utils/platform";
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
    return isBrowserEnvironment() && typeof navigator.onLine === "boolean"
      ? navigator.onLine
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
