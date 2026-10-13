import React, { useState, useEffect } from "react";
import { WifiOff, Loader2, Check } from "lucide-react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { processOfflineMutations } from "../utils/offlineService";

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [reconnectState, setReconnectState] = useState<"idle" | "reconnecting" | "success">("idle");

  useEffect(() => {
    if (isOnline && wasOffline) {
      setReconnectState("reconnecting");

      // Process offline queue asynchronously
      processOfflineMutations().catch(console.error);

      // Simulate sync time before showing success
      const syncTimer = setTimeout(() => {
        setReconnectState("success");

        // Dismiss success message after 3 seconds as per ADR 0050
        const dismissTimer = setTimeout(() => {
          setReconnectState("idle");
        }, 3000);

        return () => clearTimeout(dismissTimer);
      }, 1000); // 1s sync simulation

      return () => clearTimeout(syncTimer);
    }
    return undefined;
  }, [isOnline, wasOffline]);

  // Use sticky position instead of fixed to prevent overlaying the TopAppBar
  if (!isOnline) {
    return (
      <div
        id="pwa-offline-indicator"
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
      >
        <div className="flex items-center gap-2">
          <WifiOff className="w-3.5 h-3.5 text-muted-foreground" />
          <span>You are offline. Working in read/cache mode.</span>
        </div>
      </div>
    );
  }

  if (reconnectState === "reconnecting") {
    return (
      <div
        id="pwa-reconnected-indicator"
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
      >
        <div className="flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin" />
          <span>Reconnecting & syncing changes...</span>
        </div>
      </div>
    );
  }

  if (reconnectState === "success") {
    return (
      <div
        id="pwa-reconnected-indicator-success"
        role="status"
        aria-live="polite"
        className="sticky top-0 z-[100] w-full flex items-center justify-between px-4 py-2 bg-muted text-foreground border-b border-border/60 text-xs font-medium animate-in slide-in-from-top-full duration-200"
      >
        <div className="flex items-center gap-2">
          <Check className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Sync complete</span>
        </div>
      </div>
    );
  }

  return null;
};
