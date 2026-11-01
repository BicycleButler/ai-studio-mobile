
import { defaultPlatformService, IPlatformService } from "./platformService";

/**
 * Theme Service for Google AI Studio Mobile
 * Adheres strictly to ADR 0020 (Color System Architecture) and ADR 0028 (Theming & Dark Mode)
 */

import { STORAGE_KEYS, defaultStorageFactory, IStorageFactory } from "../utils/storage";
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
  addMatchMediaListener?: (mql: MediaQueryList, listener: (ev: MediaQueryListEvent) => void) => () => void;

  platformService?: IPlatformService;
  storageFactory?: IStorageFactory;
}

export class ThemeService implements IThemeService {
  private platformService: IPlatformService;
  private themeObservable: IObservable<ThemeState>;
  private themeModeSingleton: IMutableSingleton<ThemeMode>;
  private currentMode: ThemeMode = "system";
  private currentResolved: ResolvedTheme = "dark";
  private initialized = false;
  private mediaQueryList: MediaQueryList | null = null;
  private isBrowserEnv: () => boolean;

  private addMatchMediaListener: (mql: MediaQueryList, listener: (ev: MediaQueryListEvent) => void) => () => void;


  constructor(config?: ThemeServiceConfig) {
    this.platformService = config?.platformService || defaultPlatformService;
    this.isBrowserEnv = config?.isBrowserEnv || (() => this.platformService.isBrowserEnv());

    this.addMatchMediaListener = config?.addMatchMediaListener || this.platformService.addMatchMediaListener.bind(this.platformService);
        this.themeObservable = new Observable<ThemeState>({ mode: "system", resolvedTheme: "dark" });

    if (config?.themeModeSingleton) {
        this.themeModeSingleton = config.themeModeSingleton;
    } else {
        const factory = config?.storageFactory || defaultStorageFactory;
        this.themeModeSingleton = factory.createSingleton<ThemeMode>(
          STORAGE_KEYS.THEME_MODE,
          "system",
          {
            validate: (val) => val === "light" || val === "dark" || val === "system",
          }
        );
    }
  }

  public getSystemResolvedTheme(): ResolvedTheme {
    if (!this.isBrowserEnv()) {
      return "dark"; // Default fallback
    }
        if (!matchMedia) return "dark";
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
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

    const root = this.platformService.getDocument()?.documentElement;
    if (!root) return;
    root.setAttribute("data-theme", resolved);
    if (resolved === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Update theme-color meta tag if available
    const metaThemeColor = this.platformService.getDocument()?.querySelector('meta[name="theme-color"]');
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

  private cachedThemeState: ThemeState = { mode: "system", resolvedTheme: "dark" };

  public getThemeState(): ThemeState {
    if (
      this.cachedThemeState.mode !== this.currentMode ||
      this.cachedThemeState.resolvedTheme !== this.currentResolved
    ) {
      this.cachedThemeState = {
        mode: this.currentMode,
        resolvedTheme: this.currentResolved,
      };
    }
    return this.cachedThemeState;
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


      if (matchMedia) {
        this.mediaQueryList = matchMedia("(prefers-color-scheme: dark)");
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

