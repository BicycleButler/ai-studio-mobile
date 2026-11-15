import { ICrossTabNotifier } from "./types";
import { ILogger, DefaultLoggerFactory } from "../logger";

export class FallbackCrossTabNotifier implements ICrossTabNotifier {
  private activeNotifier: ICrossTabNotifier | null = null;
  private logger: ILogger;

  constructor(
    notifiers: ICrossTabNotifier[],
    logger: ILogger = new DefaultLoggerFactory().createLogger()
  ) {
    this.logger = logger;

    for (const notifier of notifiers) {
      if (notifier.isSupported && notifier.isSupported()) {
        this.activeNotifier = notifier;
        break;
      } else if (!notifier.isSupported) {
        // If the notifier does not explicitly expose isSupported, we assume it is a valid fallback
        this.activeNotifier = notifier;
        break;
      }
    }

    // Clean up any remaining unused notifiers
    for (const notifier of notifiers) {
        if (notifier !== this.activeNotifier) {
            notifier.dispose();
        }
    }

    if (!this.activeNotifier) {
      this.logger.warn("No supported cross-tab notifier found. Fallback chain exhausted.");
    }
  }

  public isSupported(): boolean {
    return this.activeNotifier !== null;
  }

  public notify(message: string): void {
    if (this.activeNotifier) {
      this.activeNotifier.notify(message);
    }
  }

  public onMessage(handler: (message: string) => void): void {
    if (this.activeNotifier) {
      this.activeNotifier.onMessage(handler);
    }
  }

  public dispose(): void {
    if (this.activeNotifier) {
      this.activeNotifier.dispose();
      this.activeNotifier = null;
    }
  }
}
