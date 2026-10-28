import {
  getSafeDocument,
  getSafeWindow,
  getSafeNavigator,
  getSafeWindowSpeechSynthesis,
  getSafeWindowMatchMedia,
  getSafeWindowVisualViewport,
  getSafeLocalStorage,
  isBrowserEnvironment
} from "../utils/platform";
import { ILogger, defaultLogger } from "../utils/logger";

export interface IPlatformService {
  isInputFocused(): boolean;
  blurActiveElement(): void;
  openUrl(url: string, target?: string): void;
  reloadWindow(): void;
  isKeyboardVisible(): boolean;
  hideKeyboard(): void;
  isOnline(): boolean;
  getSpeechSynthesis(): SpeechSynthesis | null;
  getMatchMedia(): typeof window.matchMedia | null;
  getVisualViewport(): VisualViewport | null;
  getDocument(): Document | null;
  getWindow(): Window | null;
  getNavigator(): Navigator | null;
  getLocalStorage(): Storage | null;
  setTimeout(handler: TimerHandler, timeout?: number, ...args: any[]): number;
  clearTimeout(id: number | undefined): void;
  setInterval(handler: TimerHandler, timeout?: number, ...args: any[]): number;
  clearInterval(id: number | undefined): void;
}

export class BrowserPlatformService implements IPlatformService {
  constructor(private logger: ILogger = defaultLogger) {}

  public isInputFocused(): boolean {
    const doc = getSafeDocument();
    if (!doc) return false;
    const tagName = doc.activeElement?.tagName;
    return tagName === "INPUT" || tagName === "TEXTAREA";
  }

  public blurActiveElement(): void {
    const doc = getSafeDocument();
    if (!doc) return;
    if (doc.activeElement instanceof HTMLElement) {
      doc.activeElement.blur();
    }
  }

  public openUrl(url: string, target: string = "_blank"): void {
    const win = getSafeWindow();
    if (win) {
      win.open(url, target, "noopener,noreferrer");
    } else {
      this.logger.warn(`Could not open URL: ${url}. Window object is undefined.`);
    }
  }

  public reloadWindow(): void {
    const win = getSafeWindow();
    if (win) {
      win.location.reload();
    } else {
      this.logger.warn("Could not reload window. Window object is undefined.");
    }
  }

  public isKeyboardVisible(): boolean {
    if (!isBrowserEnvironment()) return false;
    const nav = getSafeNavigator();
    return Boolean(nav && "virtualKeyboard" in nav);
  }

  public hideKeyboard(): void {
    if (!isBrowserEnvironment()) return;
    const nav = getSafeNavigator() as Navigator & { virtualKeyboard?: { hide: () => void } } | null;
    if (nav && nav.virtualKeyboard && typeof nav.virtualKeyboard.hide === "function") {
      nav.virtualKeyboard.hide();
    }
  }

  public isOnline(): boolean {
    if (!isBrowserEnvironment()) return true;
    const nav = getSafeNavigator();
    return Boolean(nav && typeof nav.onLine === 'boolean' ? nav.onLine : true);
  }

  public getSpeechSynthesis(): SpeechSynthesis | null {
    return getSafeWindowSpeechSynthesis();
  }

  public getMatchMedia(): typeof window.matchMedia | null {
     const win = getSafeWindowMatchMedia();
     return win ? win.matchMedia : null;
  }

  public getVisualViewport(): VisualViewport | null {
     return getSafeWindowVisualViewport();
  }

  public getDocument(): Document | null {
     return getSafeDocument();
  }

  public getWindow(): Window | null {
     return getSafeWindow() as Window | null;
  }

  public getNavigator(): Navigator | null {
     return getSafeNavigator();
  }

  public getLocalStorage(): Storage | null {
      return getSafeLocalStorage();
  }

  public setTimeout(handler: TimerHandler, timeout?: number, ...args: any[]): number {
      return globalThis.setTimeout(handler, timeout, ...args);
  }

  public clearTimeout(id: number | undefined): void {
      globalThis.clearTimeout(id);
  }

  public setInterval(handler: TimerHandler, timeout?: number, ...args: any[]): number {
      return globalThis.setInterval(handler, timeout, ...args);
  }

  public clearInterval(id: number | undefined): void {
      globalThis.clearInterval(id);
  }
}

export const defaultPlatformService = new BrowserPlatformService();
