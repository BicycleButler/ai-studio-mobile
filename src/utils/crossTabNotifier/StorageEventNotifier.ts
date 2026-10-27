import { ICrossTabNotifier } from "./types";
import { isBrowserEnvironment } from "../platform";
import { ILogger, defaultLogger } from "../logger";

export class StorageEventNotifier implements ICrossTabNotifier {
  private key: string;
  private logger: ILogger;
  private handler: ((message: string) => void) | null = null;
  private boundListener: (e: StorageEvent) => void;
  private isListening = false;

  constructor(name: string, logger: ILogger = defaultLogger) {
    this.key = `_sync_notify_${name}`;
    this.logger = logger;
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
    if (isBrowserEnvironment() && window.localStorage) {
      try {
        const payload = JSON.stringify({ message, timestamp: Date.now() });
        window.localStorage.setItem(this.key, payload);
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
    if (isBrowserEnvironment() && !this.isListening) {
      window.addEventListener("storage", this.boundListener);
      this.isListening = true;
    }
  }

  public dispose(): void {
    if (isBrowserEnvironment() && this.isListening) {
      window.removeEventListener("storage", this.boundListener);
      this.isListening = false;
    }
    this.handler = null;
  }
}
