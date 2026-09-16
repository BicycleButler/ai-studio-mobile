/**
 * Platform & Runtime Detection Utility
 *
 * Provides runtime detection across:
 * 1. Web Browser (Desktop / Mobile responsive web)
 * 2. Progressive Web App (PWA standalone installed app)
 * 3. Capacitor Native Shell (Future Android / iOS native wrapper)
 */

export type AppRuntime = "capacitor" | "pwa" | "browser";

export interface PlatformCapabilities {
  runtime: AppRuntime;
  isNative: boolean;
  isPWA: boolean;
  isBrowser: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  hasTouch: boolean;
  supportsServiceWorker: boolean;
  supportsInstallPrompt: boolean;
}

/**
 * Checks if the application is running inside a Capacitor native app wrapper.
 */
export function isCapacitor(): boolean {
  if (typeof window === "undefined") return false;
  const win = window as unknown as {
    Capacitor?: {
      isNativePlatform?: () => boolean;
      getPlatform?: () => string;
    };
  };
  return Boolean(
    win.Capacitor &&
      typeof win.Capacitor.isNativePlatform === "function" &&
      win.Capacitor.isNativePlatform()
  );
}

/**
 * Checks if the application is running in installed PWA standalone mode.
 */
export function isPWA(): boolean {
  if (typeof window === "undefined") return false;
  const isStandaloneMatch = window.matchMedia("(display-mode: standalone)").matches;
  const isNavigatorStandalone =
    (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return isStandaloneMatch || isNavigatorStandalone;
}

/**
 * Determines current application runtime.
 */
export function detectAppRuntime(): AppRuntime {
  if (isCapacitor()) return "capacitor";
  if (isPWA()) return "pwa";
  return "browser";
}

/**
 * Retrieves full platform capability profile.
 */
export function getPlatformCapabilities(): PlatformCapabilities {
  const runtime = detectAppRuntime();
  const userAgent =
    typeof navigator !== "undefined" ? navigator.userAgent.toLowerCase() : "";
  const isIOS = /iphone|ipad|ipod/.test(userAgent);
  const isAndroid = /android/.test(userAgent);
  const hasTouch =
    typeof window !== "undefined" &&
    ("ontouchstart" in window || (navigator && navigator.maxTouchPoints > 0));
  const supportsServiceWorker =
    typeof navigator !== "undefined" && "serviceWorker" in navigator;
  const supportsInstallPrompt =
    typeof window !== "undefined" && "BeforeInstallPromptEvent" in window;

  return {
    runtime,
    isNative: runtime === "capacitor",
    isPWA: runtime === "pwa",
    isBrowser: runtime === "browser",
    isIOS,
    isAndroid,
    hasTouch,
    supportsServiceWorker,
    supportsInstallPrompt,
  };
}
