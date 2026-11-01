import { defaultTimeProvider } from "../timeProvider";
import { ICrossTabNotifier, CrossTabNotifierConfig } from "./types";
import { ILogger, defaultLogger } from "../logger";
import { IPlatformService } from "../../services/platformService";

export class StorageEventNotifier implements ICrossTabNotifier {
  private key: string;
  private logger: ILogger;
  private handler: ((message: string) => void) | null = null;
  private boundListener: (e: StorageEvent) => void;
  private removeListenerFn: (() => void) | null = null;
  private isListening = false;

  private platformService: IPlatformService;

  constructor(config: CrossTabNotifierConfig) {
    this.key = `_sync_notify_${config.name}`;
    this.logger = config.logger || defaultLogger;
    if (!config.platformService) throw new Error("platformService is required");
    this.platformService = config.platformService;
    this.boundListener = this.handleStorageEvent.bind(this);
  }

  private handleStorageEvent(e: StorageEvent): void {
    if (e.key === this.key && e.newValue) {
      try {
        const payload = JSON.parse(e.newValue);
        if (payload && payload.message && this.handler) {
          this.handler(payload.message);
        }
      } catch (err) {
        this.logger.warn(`StorageEventNotifier failed to parse message for ${this.key}`, err);
      }
    }
  }

  public notify(message: string): void {
    const localStorage = this.platformService.getLocalStorage();
    if (this.platformService.isBrowserEnv() && localStorage) {
      try {
        const payload = JSON.stringify({ message, timestamp: defaultTimeProvider.now() });
        localStorage.setItem(this.key, payload);
        // We do NOT clear it immediately because that might fire a second storage event
        // with a null newValue that could confuse listeners if they aren't careful,
        // although we handle e.newValue above. It's safe to just overwrite it next time.
      } catch (e) {
        this.logger.error("Failed to post message via StorageEvent", e);
      }
    }
  }

  public onMessage(handler: (message: string) => void): void {
    this.handler = handler;
    if (this.platformService.isBrowserEnv() && !this.isListening) {
      this.removeListenerFn = this.platformService.addEventListener("storage", this.boundListener as EventListener);
      this.isListening = true;
    }
  }

  public dispose(): void {
    if (this.isListening && this.removeListenerFn) {
      this.removeListenerFn();
    }
    this.isListening = false;
    this.removeListenerFn = null;
    this.handler = null;
  }
}
