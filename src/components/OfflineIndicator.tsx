import React, { useState, useEffect } from "react";
import { WifiOff, Wifi } from "lucide-react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

export const OfflineIndicator: React.FC = () => {
  const { isOnline, wasOffline } = useNetworkStatus();
  const [showReconnectedToast, setShowReconnectedToast] = useState(false);

  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnectedToast(true);
      const timer = setTimeout(() => {
        setShowReconnectedToast(false);
      }, 3500);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [isOnline, wasOffline]);

  if (!isOnline) {
    return (
      <div
        id="pwa-offline-indicator"
        role="status"
        aria-live="polite"
        className="fixed bottom-16 sm:bottom-4 left-3 sm:left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-600/95 text-white shadow-lg border border-amber-400/40 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 toast-element"
      >
        <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
        <span>Offline Mode — Cached data and local prompts are available.</span>
      </div>
    );
  }

  if (showReconnectedToast) {
    return (
      <div
        id="pwa-reconnected-indicator"
        role="status"
        aria-live="polite"
        className="fixed bottom-16 sm:bottom-4 left-3 sm:left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600/95 text-white shadow-lg border border-emerald-400/40 text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200 toast-element"
      >
        <Wifi className="w-4 h-4 shrink-0" />
        <span>Back Online — Live Gemini streaming restored.</span>
      </div>
    );
  }

  return null;
};
