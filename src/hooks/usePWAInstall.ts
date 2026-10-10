import { useEffect, useState, useCallback } from "react";
import { isBrowserEnvironment, getPlatformCapabilities, safeAddEventListener } from "../utils/platform";

export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    const caps = getPlatformCapabilities();
    return caps.isNative || caps.isPWA;
  });

  const [isIOS, setIsIOS] = useState<boolean>(() => getPlatformCapabilities().isIOS);
  const [isNativeCapacitor, setIsNativeCapacitor] = useState<boolean>(() => getPlatformCapabilities().isNative);

  useEffect(() => {
    if (!isBrowserEnvironment()) return;

    const caps = getPlatformCapabilities();
    setIsNativeCapacitor(caps.isNative);
    setIsInstalled(caps.isNative || caps.isPWA);
    setIsIOS(caps.isIOS);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    const removePrompt = safeAddEventListener("beforeinstallprompt" as keyof WindowEventMap, handleBeforeInstallPrompt as EventListener);
    const removeInstalled = safeAddEventListener("appinstalled" as keyof WindowEventMap, handleAppInstalled as EventListener);

    return () => {
      removePrompt();
      removeInstalled();
    };
  }, []);

  const install = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    try {
      await deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }, [deferredPrompt]);

  return {
    isInstallable: Boolean(deferredPrompt),
    isInstalled,
    isIOS,
    isCapacitor: isNativeCapacitor,
    install,
  };
}
