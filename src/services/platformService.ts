import {
  getSafeDocument,
  getSafeWindow,
  getSafeNavigator,
  getSafeWindowSpeechSynthesis,
  getSafeWindowMatchMedia,
  getSafeWindowVisualViewport,
  getSafeLocalStorage,
  isBrowserEnvironment,
  getPlatformCapabilities,
  PlatformCapabilities,
  safeAddEventListener,
  safeAddDocumentListener,
  getSafeBroadcastChannel,
  safeAddMatchMediaListener
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
  setTimeout(handler: TimerHandler, timeout?: number, ...args: unknown[]): unknown;
  clearTimeout(id: unknown): void;
  setInterval(handler: TimerHandler, timeout?: number, ...args: unknown[]): unknown;
  clearInterval(id: unknown): void;
  isBrowserEnv(): boolean;
  getPlatformCaps(): PlatformCapabilities;
  addEventListener<K extends keyof WindowEventMap>(type: K, listener: (this: Window, ev: WindowEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
  addDocumentListener<K extends keyof DocumentEventMap>(type: K, listener: (this: Document, ev: DocumentEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
  getBroadcastChannel(name: string): BroadcastChannel | null;
  addMatchMediaListener(mql: MediaQueryList, listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void): () => void;
  createAudio(url?: string): HTMLAudioElement | null;
  createSpeechSynthesisUtterance(text?: string): SpeechSynthesisUtterance | null;
  createFileReader(): FileReader | null;
  createImage(): HTMLImageElement | null;
  createBlob(blobParts?: BlobPart[], options?: BlobPropertyBag): Blob | null;
  createObjectURL(obj: Blob | MediaSource): string | null;
  revokeObjectURL(url: string): void;
  createTextDecoder(label?: string, options?: TextDecoderOptions): TextDecoder | null;
  createEventSource(url: string | URL, eventSourceInitDict?: EventSourceInit): EventSource | null;
  createURLSearchParams(init?: string | URLSearchParams | string[][] | Record<string, string>): URLSearchParams | null;
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

  public setTimeout(handler: TimerHandler, timeout?: number, ...args: unknown[]): unknown {
      return globalThis.setTimeout(handler, timeout, ...args) as unknown;
  }

  public clearTimeout(id: unknown): void {
      globalThis.clearTimeout(id as number | undefined);
  }

  public setInterval(handler: TimerHandler, timeout?: number, ...args: unknown[]): unknown {
      return globalThis.setInterval(handler, timeout, ...args) as unknown;
  }

  public clearInterval(id: unknown): void {
      globalThis.clearInterval(id as number | undefined);
  }

  public isBrowserEnv(): boolean {
    return isBrowserEnvironment();
  }

  public getPlatformCaps(): PlatformCapabilities {
    return getPlatformCapabilities();
  }

  public addEventListener<K extends keyof WindowEventMap>(type: K, listener: (this: Window, ev: WindowEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void {
    return safeAddEventListener(type, listener, options);
  }

  public addDocumentListener<K extends keyof DocumentEventMap>(type: K, listener: (this: Document, ev: DocumentEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void {
    return safeAddDocumentListener(type, listener, options);
  }

  public addMatchMediaListener(mql: MediaQueryList, listener: (this: MediaQueryList, ev: MediaQueryListEvent) => void): () => void {
    return safeAddMatchMediaListener(mql, listener);
  }

  public getBroadcastChannel(name: string): BroadcastChannel | null {
    return getSafeBroadcastChannel(name);
  }

  public createAudio(url?: string): HTMLAudioElement | null {
    if (!this.isBrowserEnv()) return null;
    return typeof url === "string" ? new Audio(url) : new Audio();
  }

  public createSpeechSynthesisUtterance(text?: string): SpeechSynthesisUtterance | null {
    if (!this.isBrowserEnv()) return null;
    return typeof text === "string" ? new SpeechSynthesisUtterance(text) : new SpeechSynthesisUtterance();
  }

  public createFileReader(): FileReader | null {
    if (!this.isBrowserEnv() || typeof FileReader === "undefined") return null;
    return new FileReader();
  }

  public createImage(): HTMLImageElement | null {
    if (!this.isBrowserEnv() || typeof Image === "undefined") return null;
    return new Image();
  }

  public createBlob(blobParts?: BlobPart[], options?: BlobPropertyBag): Blob | null {
    if (typeof Blob === "undefined") return null;
    return new Blob(blobParts, options);
  }

  public createObjectURL(obj: Blob | MediaSource): string | null {
    if (typeof URL === "undefined" || typeof URL.createObjectURL !== "function") return null;
    return URL.createObjectURL(obj);
  }

  public revokeObjectURL(url: string): void {
    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      URL.revokeObjectURL(url);
    }
  }

  public createTextDecoder(label?: string, options?: TextDecoderOptions): TextDecoder | null {
    if (typeof TextDecoder === "undefined") return null;
    return new TextDecoder(label, options);
  }

  public createEventSource(url: string | URL, eventSourceInitDict?: EventSourceInit): EventSource | null {
    if (typeof EventSource === "undefined") return null;
    return new EventSource(url, eventSourceInitDict);
  }

  public createURLSearchParams(init?: string | URLSearchParams | string[][] | Record<string, string>): URLSearchParams | null {
    if (typeof URLSearchParams === "undefined") return null;
    return new URLSearchParams(init);
  }
}

export const defaultPlatformService = new BrowserPlatformService();
