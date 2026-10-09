/**
 * Platform & Runtime Detection Utility
 *
 * Provides runtime detection across:
 * 1. Web Browser (Desktop / Mobile responsive web)
 * 2. Progressive Web App (PWA standalone installed app)
 * 3. Capacitor Native Shell (Future Android / iOS native wrapper)
 */

export type AppRuntime = "capacitor" | "pwa" | "browser";

/**
 * Safely checks if the current environment is a browser context.
 */
export function isBrowserEnvironment(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}


export type WindowWithMatchMedia = typeof window & { matchMedia?: (query: string) => MediaQueryList };
export type WindowWithSpeech = typeof window & { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };

export function getSafeWindowMatchMedia(): WindowWithMatchMedia | null {
  return isBrowserEnvironment() ? (window as WindowWithMatchMedia) : null;
}

export function getSafeWindowSpeech(): WindowWithSpeech | null {
  return isBrowserEnvironment() ? (window as WindowWithSpeech) : null;
}

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
  if (!isBrowserEnvironment()) return false;
  const win = window as typeof window & {
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
  if (!isBrowserEnvironment()) return false;
  const win = getSafeWindowMatchMedia();
  const isStandaloneMatch = win && win.matchMedia ? win.matchMedia("(display-mode: standalone)").matches : false;
  const nav = window.navigator as typeof navigator & { standalone?: boolean };
  const isNavigatorStandalone = nav.standalone === true;
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
    isBrowserEnvironment() ? navigator.userAgent.toLowerCase() : "";
  const isIOS = /iphone|ipad|ipod/.test(userAgent) && !("MSStream" in window);
  const isAndroid = /android/.test(userAgent);
  const hasTouch =
    isBrowserEnvironment() &&
    ("ontouchstart" in window || (navigator && navigator.maxTouchPoints > 0));
  const supportsServiceWorker =
    isBrowserEnvironment() && "serviceWorker" in navigator;
  const supportsInstallPrompt =
    isBrowserEnvironment() && "BeforeInstallPromptEvent" in window;

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

/**
 * Safely adds an event listener to the window object, guaranteeing it only
 * executes if the browser environment is available.
 * Returns a teardown function for easy cleanup in React hooks.
 */
export function safeAddEventListener<K extends keyof WindowEventMap>(
  type: K,
  listener: (this: Window, ev: WindowEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  if (!isBrowserEnvironment()) {
    return () => {};
  }

  window.addEventListener(type, listener, options);

  return () => {
    window.removeEventListener(type, listener, options);
  };
}

/**
 * Safely adds an event listener to the document object.
 * Returns a teardown function.
 */
export function safeAddDocumentListener<K extends keyof DocumentEventMap>(
  type: K,
  listener: (this: Document, ev: DocumentEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  if (!isBrowserEnvironment()) {
    return () => {};
  }

  document.addEventListener(type, listener, options);

  return () => {
    document.removeEventListener(type, listener, options);
  };
}
