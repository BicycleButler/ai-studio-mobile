import { isBrowserEnvironment, getSafeWindowMatchMedia, safeAddMatchMediaListener } from "../utils/platform";
/**
 * Theme Service for Google AI Studio Mobile
 * Adheres strictly to ADR 0020 (Color System Architecture) and ADR 0028 (Theming & Dark Mode)
 */

import { STORAGE_KEYS, StorageSingleton } from "../utils/storage";
import { Observable, IObservable } from "../utils/observable";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

export type ThemeListener = (state: ThemeState) => void;

const themeObservable: IObservable<ThemeState> = new Observable<ThemeState>();
let currentMode: ThemeMode = "system";
let currentResolved: ResolvedTheme = "dark";
let initialized = false;
let mediaQueryList: MediaQueryList | null = null;

const themeModeSingleton = new StorageSingleton<ThemeMode>(
  STORAGE_KEYS.THEME_MODE,
  "system",
  {
    validate: (val) => val === "light" || val === "dark" || val === "system",
  }
);

export function getSystemResolvedTheme(): ResolvedTheme {
  if (!isBrowserEnvironment()) {
    return "dark"; // Default fallback
  }
  const win = getSafeWindowMatchMedia();
  if (!win || !win.matchMedia) return "dark";
  return win.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function loadStoredThemeMode(): ThemeMode {
  return themeModeSingleton.load();
}

export function persistThemeMode(mode: ThemeMode): void {
  themeModeSingleton.save(mode);
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
  themeObservable.notify(state);
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
  const nextResolved: ResolvedTheme = currentResolved === "dark" ? "light" : "dark";
  setThemeMode(nextResolved);
}

export function subscribeToTheme(listener: ThemeListener): () => void {
  const unsubscribe = themeObservable.subscribe(listener);
  listener({ mode: currentMode, resolvedTheme: currentResolved });
  return unsubscribe;
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
    }
  }

  let removeListener = () => {};
  if (mediaQueryList) {
    const handleChange = () => {
      if (currentMode === "system") {
        currentResolved = getSystemResolvedTheme();
        applyThemeToDOM(currentResolved);
        notifyListeners();
      }
    };
    removeListener = safeAddMatchMediaListener(mediaQueryList, handleChange);
  }

  return () => {
    removeListener();
  };
}
