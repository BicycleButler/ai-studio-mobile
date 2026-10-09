import { isBrowserEnvironment, getSafeWindowMatchMedia } from "../utils/platform";
/**
 * Theme Service for Google AI Studio Mobile
 * Adheres strictly to ADR 0020 (Color System Architecture) and ADR 0028 (Theming & Dark Mode)
 */

import { safeGetStorage, safeSetStorage } from "../utils/storage";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

export type ThemeListener = (state: ThemeState) => void;

const STORAGE_KEY = "aistudio_theme_mode";

let currentMode: ThemeMode = "system";
let currentResolved: ResolvedTheme = "dark";
const listeners = new Set<ThemeListener>();
let initialized = false;
let mediaQueryList: MediaQueryList | null = null;

export function getSystemResolvedTheme(): ResolvedTheme {
  if (!isBrowserEnvironment()) {
    return "dark"; // Default fallback
  }
  const win = getSafeWindowMatchMedia();
  if (!win || !win.matchMedia) return "dark";
  return win.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function loadStoredThemeMode(): ThemeMode {
  const stored = safeGetStorage<string>(STORAGE_KEY, "system");
  if (stored === "light" || stored === "dark" || stored === "system") {
    return stored as ThemeMode;
  }
  return "system";
}

export function persistThemeMode(mode: ThemeMode): void {
  safeSetStorage(STORAGE_KEY, mode);
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === "system") {
    return getSystemResolvedTheme();
  }
  return mode;
}

export function applyThemeToDOM(resolved: ResolvedTheme): void {
  if (!isBrowserEnvironment()) return;

  const root = document.documentElement;
  root.setAttribute("data-theme", resolved);
  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  // Update theme-color meta tag if available
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    const computedBg = getComputedStyle(root).getPropertyValue("--background").trim();
    if (computedBg) {
      metaThemeColor.setAttribute("content", computedBg);
    }
  }
}

function notifyListeners(): void {
  const state: ThemeState = {
    mode: currentMode,
    resolvedTheme: currentResolved,
  };
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch (err: unknown) {
      console.error("Error in theme listener:", err);
    }
  });
}

export function getThemeState(): ThemeState {
  return {
    mode: currentMode,
    resolvedTheme: currentResolved,
  };
}

export function setThemeMode(newMode: ThemeMode): void {
  currentMode = newMode;
  currentResolved = resolveTheme(newMode);
  persistThemeMode(newMode);
  applyThemeToDOM(currentResolved);
  notifyListeners();
}

export function toggleTheme(): void {
  // Toggle between light and dark explicitly
  const nextResolved: ResolvedTheme = currentResolved === "dark" ? "light" : "dark";
  setThemeMode(nextResolved);
}

export function subscribeToTheme(listener: ThemeListener): () => void {
  listeners.add(listener);
  // Emit initial state
  listener({ mode: currentMode, resolvedTheme: currentResolved });
  return () => {
    listeners.delete(listener);
  };
}

export function initThemeService(): () => void {
  if (!isBrowserEnvironment()) {
    return () => {};
  }

  if (!initialized) {
    initialized = true;
    currentMode = loadStoredThemeMode();
    currentResolved = resolveTheme(currentMode);
    applyThemeToDOM(currentResolved);

    const win = getSafeWindowMatchMedia();
    if (win && win.matchMedia) {
      mediaQueryList = win.matchMedia("(prefers-color-scheme: dark)");
      const handleChange = () => {
        if (currentMode === "system") {
          currentResolved = getSystemResolvedTheme();
          applyThemeToDOM(currentResolved);
          notifyListeners();
        }
      };

      if (mediaQueryList.addEventListener) {
        mediaQueryList.addEventListener("change", handleChange);
      } else if ("addListener" in mediaQueryList) {
        // Legacy browser fallback
        (mediaQueryList as MediaQueryList & { addListener: (cb: () => void) => void }).addListener(handleChange);
      }
    }
  }

  return () => {
    if (mediaQueryList) {
      // Cleanup if teardown needed
    }
  };
}
