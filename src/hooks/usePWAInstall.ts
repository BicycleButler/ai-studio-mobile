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

  // Use lazy init with capabilities directly
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

    // @ts-expect-error Typescript doesn't include PWA events in standard WindowEventMap by default
    const removePrompt = safeAddEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    // @ts-expect-error Typescript doesn't include PWA events in standard WindowEventMap by default
    const removeInstalled = safeAddEventListener("appinstalled", handleAppInstalled);

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
