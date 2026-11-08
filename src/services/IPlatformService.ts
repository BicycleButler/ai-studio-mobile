import { EventEmitter } from "../utils/eventEmitter";
import { PlatformCapabilities } from "../utils/platform";
import { ISpeechRecognitionInstance } from "../types/speechRecognition";

export interface IPlatformService {
  getStorageEventObservable(): EventEmitter<StorageEvent>;
  getStorageQuotaObservable(): EventEmitter<void>;

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
  getLanguage(fallback?: string): string;
  getLocalStorage(): Storage | null;
  setTimeout(handler: TimerHandler, timeout?: number, ...args: unknown[]): unknown;
  clearTimeout(id: unknown): void;
  setInterval(handler: TimerHandler, timeout?: number, ...args: unknown[]): unknown;
  clearInterval(id: unknown): void;
  isBrowserEnv(): boolean;
  getPlatformCaps(): PlatformCapabilities;
  addEventListener<K extends keyof WindowEventMap>(type: K, listener: (this: Window, ev: WindowEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
  addDocumentListener<K extends keyof DocumentEventMap>(type: K, listener: (this: Document, ev: DocumentEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
  addVisualViewportListener<K extends keyof VisualViewportEventMap>(type: K, listener: (this: VisualViewport, ev: VisualViewportEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
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
  createAbortController(): AbortController | null;
  createSpeechRecognition(): ISpeechRecognitionInstance | null;
  createElement<K extends keyof HTMLElementTagNameMap>(tagName: K): HTMLElementTagNameMap[K] | null;
}
