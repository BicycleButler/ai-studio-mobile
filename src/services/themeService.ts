import { getSafeDocument, isBrowserEnvironment, getSafeWindowMatchMedia, safeAddMatchMediaListener } from "../utils/platform";
/**
 * Theme Service for Google AI Studio Mobile
 * Adheres strictly to ADR 0020 (Color System Architecture) and ADR 0028 (Theming & Dark Mode)
 */

import { STORAGE_KEYS, defaultStorageFactory } from "../utils/storage";
import { IMutableSingleton } from "../utils/storage/types";
import { Observable, IObservable } from "../utils/observable";

export type ThemeMode = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export interface ThemeState {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
}

export type ThemeListener = (state: ThemeState) => void;

export interface IThemeService {
  getSystemResolvedTheme(): ResolvedTheme;
  loadStoredThemeMode(): ThemeMode;
  persistThemeMode(mode: ThemeMode): void;
  resolveTheme(mode: ThemeMode): ResolvedTheme;
  applyThemeToDOM(resolved: ResolvedTheme): void;
  getThemeState(): ThemeState;
  setThemeMode(newMode: ThemeMode): void;
  toggleTheme(): void;
  subscribeToTheme(listener: ThemeListener): () => void;
  initThemeService(): () => void;
}

export interface ThemeServiceConfig {
  themeModeSingleton?: IMutableSingleton<ThemeMode>;
  isBrowserEnv?: () => boolean;
  getWindowMatchMedia?: typeof getSafeWindowMatchMedia;
  addMatchMediaListener?: typeof safeAddMatchMediaListener;
  getSafeDoc?: typeof getSafeDocument;
}

export class ThemeService implements IThemeService {
  private themeObservable: IObservable<ThemeState>;
  private themeModeSingleton: IMutableSingleton<ThemeMode>;
  private currentMode: ThemeMode = "system";
  private currentResolved: ResolvedTheme = "dark";
  private initialized = false;
  private mediaQueryList: MediaQueryList | null = null;
  private isBrowserEnv: () => boolean;
  private getWindowMatchMedia: typeof getSafeWindowMatchMedia;
  private addMatchMediaListener: typeof safeAddMatchMediaListener;
  private getSafeDoc: typeof getSafeDocument;

  constructor(config?: ThemeServiceConfig) {
    this.isBrowserEnv = config?.isBrowserEnv || isBrowserEnvironment;
    this.getWindowMatchMedia = config?.getWindowMatchMedia || getSafeWindowMatchMedia;
    this.addMatchMediaListener = config?.addMatchMediaListener || safeAddMatchMediaListener;
    this.getSafeDoc = config?.getSafeDoc || getSafeDocument;
    this.themeObservable = new Observable<ThemeState>({ mode: "system", resolvedTheme: "dark" });
    this.themeModeSingleton = config?.themeModeSingleton || defaultStorageFactory.createSingleton<ThemeMode>(
      STORAGE_KEYS.THEME_MODE,
      "system",
      {
        validate: (val) => val === "light" || val === "dark" || val === "system",
      }
    );
  }

  public getSystemResolvedTheme(): ResolvedTheme {
    if (!this.isBrowserEnv()) {
      return "dark"; // Default fallback
    }
    const win = this.getWindowMatchMedia();
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
    if (!this.isBrowserEnv()) return;

    const root = this.getSafeDoc()?.documentElement;
    if (!root) return;
    root.setAttribute("data-theme", resolved);
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Update theme-color meta tag if available
    const metaThemeColor = this.getSafeDoc()?.querySelector('meta[name="theme-color"]');
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
    this.themeObservable.notify(state);
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
    const unsubscribe = this.themeObservable.subscribe(listener);
    listener({ mode: this.currentMode, resolvedTheme: this.currentResolved });
    return unsubscribe;
  }

  public initThemeService(): () => void {
    if (!this.isBrowserEnv()) {
      return () => {};
    }

    if (!this.initialized) {
      this.initialized = true;
      this.currentMode = this.loadStoredThemeMode();
      this.currentResolved = this.resolveTheme(this.currentMode);
      this.applyThemeToDOM(this.currentResolved);

      const win = this.getWindowMatchMedia();
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
      removeListener = this.addMatchMediaListener(this.mediaQueryList, handleChange);
    }

    return () => {
      removeListener();
    };
  }
}

export const defaultThemeService = new ThemeService();
