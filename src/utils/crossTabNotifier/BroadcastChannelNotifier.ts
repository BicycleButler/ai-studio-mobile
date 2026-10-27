import { ICrossTabNotifier } from "./types";
import { getSafeBroadcastChannel } from "../platform";
import { ILogger, defaultLogger } from "../logger";

export class BroadcastChannelNotifier implements ICrossTabNotifier {
  private channel: BroadcastChannel | null = null;
  private logger: ILogger;

  constructor(name: string, logger: ILogger = defaultLogger) {
    this.logger = logger;
    try {
      this.channel = getSafeBroadcastChannel(name);
    } catch (e) {
      this.logger.warn(`BroadcastChannelNotifier failed to initialize for ${name}`, e);
    }
  }

  public notify(message: string): void {
    if (this.channel) {
      try {
        this.channel.postMessage(message);
      } catch (e) {
        this.logger.error("Failed to post message via BroadcastChannel", e);
      }
    }
  }

  public onMessage(handler: (message: string) => void): void {
    if (this.channel) {
      this.channel.onmessage = (event) => {
        handler(event.data);
      };
    }
  }

  public dispose(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  public isSupported(): boolean {
    return this.channel !== null;
  }
}
