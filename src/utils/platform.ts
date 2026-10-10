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
export type WindowWithCapacitor = typeof window & { Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; } };
export type NavigatorWithStandalone = typeof navigator & { standalone?: boolean };
export type WindowWithLocalStorage = typeof window & { localStorage?: Storage };
export type WindowWithSpeechSynthesis = typeof window & { speechSynthesis?: SpeechSynthesis };
export type NavigatorWithClipboard = typeof navigator & { clipboard?: Clipboard };
export type WindowWithHistory = typeof window & { history?: History };
export type WindowWithVisualViewport = typeof window & { visualViewport?: VisualViewport };

export function getSafeWindow(): (typeof window) | null {
  return isBrowserEnvironment() ? window : null;
}

export function getSafeWindowVisualViewport(): VisualViewport | null {
  return isBrowserEnvironment() && window.visualViewport ? window.visualViewport : null;
}


export function getSafeWindowMatchMedia(): WindowWithMatchMedia | null {
  return isBrowserEnvironment() ? (window as WindowWithMatchMedia) : null;
}

export function getSafeWindowSpeech(): WindowWithSpeech | null {
  return isBrowserEnvironment() ? (window as WindowWithSpeech) : null;
}
export function getSafeWindowSpeechSynthesis(): SpeechSynthesis | null {
  return isBrowserEnvironment() && "speechSynthesis" in window ? (window as unknown as WindowWithSpeechSynthesis).speechSynthesis! : null;
}


/**
 * Safely retrieves the user's navigator language, providing a fallback if unavailable.
 */
export function getSafeNavigatorLanguage(fallback: string = "en-US"): string {
  if (isBrowserEnvironment() && navigator.language) {
    return navigator.language;
  }
  return fallback;
}

export function getSafeNavigatorClipboard(): Clipboard | null {
  return isBrowserEnvironment() && navigator.clipboard ? (navigator as unknown as NavigatorWithClipboard).clipboard! : null;
}


export interface PlatformCapabilities {
  runtime: AppRuntime;
  isNative: boolean;
  isPWA: boolean;
  isBrowser: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isApplePlatform: boolean;
  isWindowsPlatform: boolean;
  hasTouch: boolean;
  supportsServiceWorker: boolean;
  supportsInstallPrompt: boolean;
}

/**
 * Utility to check if the current platform is an Apple environment (macOS, iOS, iPadOS).
 */
export function isApplePlatform(): boolean {
  if (!isBrowserEnvironment()) return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return /macintosh|mac os x|iphone|ipad|ipod/.test(userAgent);
}

/**
 * Utility to check if the current platform is Windows.
 */
export function isWindowsPlatform(): boolean {
  if (!isBrowserEnvironment()) return false;
  const userAgent = navigator.userAgent.toLowerCase();
  return /windows/.test(userAgent);
}

/**
 * Checks if the application is running inside a Capacitor native app wrapper.
 */
export function isCapacitor(): boolean {
  if (!isBrowserEnvironment()) return false;
  const win = window as WindowWithCapacitor;
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
  const nav = window.navigator as NavigatorWithStandalone;
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
  const isApple = isApplePlatform();
  const isWindows = isWindowsPlatform();
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
    isApplePlatform: isApple,
    isWindowsPlatform: isWindows,
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

/**
 * Safely adds an event listener to the visualViewport object.
 * Returns a teardown function.
 */
export function safeAddVisualViewportListener<K extends keyof VisualViewportEventMap>(
  type: K,
  listener: (this: VisualViewport, ev: VisualViewportEventMap[K]) => void,
  options?: boolean | AddEventListenerOptions
): () => void {
  if (!isBrowserEnvironment() || !window.visualViewport) {
    return () => {};
  }

  const vv = window.visualViewport;
  vv.addEventListener(type, listener, options);

  return () => {
    vv.removeEventListener(type, listener, options);
  };
}

/**
 * Safely adds an event listener to a MediaQueryList object with legacy fallback support.
 * Returns a teardown function.
 */
export function safeAddMatchMediaListener(
  mql: MediaQueryList,
  listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void
): () => void {
  if (!isBrowserEnvironment()) {
    return () => {};
  }

  if (mql.addEventListener) {
    mql.addEventListener("change", listener);
    return () => mql.removeEventListener("change", listener);
  } else if ("addListener" in mql) {
    const legacyMql = mql as MediaQueryList & { addListener: (cb: (ev: MediaQueryListEvent) => void) => void, removeListener: (cb: (ev: MediaQueryListEvent) => void) => void };
    legacyMql.addListener(listener);
    return () => legacyMql.removeListener(listener);
  }

  return () => {};
}
