import { isBrowserEnvironment, getSafeWindowMatchMedia, safeAddMatchMediaListener } from "../utils/platform";
/**
 * Theme Service for Google AI Studio Mobile
 * Adheres strictly to ADR 0020 (Color System Architecture) and ADR 0028 (Theming & Dark Mode)
 */

import { STORAGE_KEYS, StorageSingleton } from "../utils/storage";
import { Observable } from "../utils/observable";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

export type ThemeListener = (state: ThemeState) => void;

class ThemeManager extends Observable<ThemeState> {
  private currentMode: ThemeMode = "system";
  private currentResolved: ResolvedTheme = "dark";
  private initialized = false;
  private mediaQueryList: MediaQueryList | null = null;

  private themeModeSingleton = new StorageSingleton<ThemeMode>(
    STORAGE_KEYS.THEME_MODE,
    "system",
    {
      validate: (val) => val === "light" || val === "dark" || val === "system",
    }
  );

  public getSystemResolvedTheme(): ResolvedTheme {
    if (!isBrowserEnvironment()) {
      return "dark"; // Default fallback
    }
    const win = getSafeWindowMatchMedia();
    if (!win || !win.matchMedia) return "dark";
    return win.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  public loadStoredThemeMode(): ThemeMode {
    return this.themeModeSingleton.load();
  }

  public persistThemeMode(mode: ThemeMode): void {
    this.themeModeSingleton.save(mode);
  }

  public resolveTheme(mode: ThemeMode): ResolvedTheme {
    if (mode === "system") {
      return this.getSystemResolvedTheme();
    }
    return mode;
  }

  public applyThemeToDOM(resolved: ResolvedTheme): void {
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

  private notifyListeners(): void {
    const state: ThemeState = {
      mode: this.currentMode,
      resolvedTheme: this.currentResolved,
    };
    this.notify(state);
  }

  public getThemeState(): ThemeState {
    return {
      mode: this.currentMode,
      resolvedTheme: this.currentResolved,
    };
  }

  public setThemeMode(newMode: ThemeMode): void {
    this.currentMode = newMode;
    this.currentResolved = this.resolveTheme(newMode);
    this.persistThemeMode(newMode);
    this.applyThemeToDOM(this.currentResolved);
    this.notifyListeners();
  }

  public toggleTheme(): void {
    const nextResolved: ResolvedTheme = this.currentResolved === "dark" ? "light" : "dark";
    this.setThemeMode(nextResolved);
  }

  public subscribeToTheme(listener: ThemeListener): () => void {
    const unsubscribe = this.subscribe(listener);
    listener({ mode: this.currentMode, resolvedTheme: this.currentResolved });
    return unsubscribe;
  }

  public initThemeService(): () => void {
    if (!isBrowserEnvironment()) {
      return () => {};
    }

    if (!this.initialized) {
      this.initialized = true;
      this.currentMode = this.loadStoredThemeMode();
      this.currentResolved = this.resolveTheme(this.currentMode);
      this.applyThemeToDOM(this.currentResolved);

      const win = getSafeWindowMatchMedia();
      if (win && win.matchMedia) {
        this.mediaQueryList = win.matchMedia("(prefers-color-scheme: dark)");
      }
    }

    let removeListener = () => {};
    if (this.mediaQueryList) {
      const handleChange = () => {
        if (this.currentMode === "system") {
          this.currentResolved = this.getSystemResolvedTheme();
          this.applyThemeToDOM(this.currentResolved);
          this.notifyListeners();
        }
      };
      removeListener = safeAddMatchMediaListener(this.mediaQueryList, handleChange);
    }

    return () => {
      removeListener();
    };
  }
}

const themeManager = new ThemeManager();

export function getSystemResolvedTheme(): ResolvedTheme {
  return themeManager.getSystemResolvedTheme();
}
export function loadStoredThemeMode(): ThemeMode {
  return themeManager.loadStoredThemeMode();
}
export function persistThemeMode(mode: ThemeMode): void {
  return themeManager.persistThemeMode(mode);
}
export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  return themeManager.resolveTheme(mode);
}
export function applyThemeToDOM(resolved: ResolvedTheme): void {
  return themeManager.applyThemeToDOM(resolved);
}
export function getThemeState(): ThemeState {
  return themeManager.getThemeState();
}
export function setThemeMode(newMode: ThemeMode): void {
  return themeManager.setThemeMode(newMode);
}
export function toggleTheme(): void {
  return themeManager.toggleTheme();
}
export function subscribeToTheme(listener: ThemeListener): () => void {
  return themeManager.subscribeToTheme(listener);
}
export function initThemeService(): () => void {
  return themeManager.initThemeService();
}
