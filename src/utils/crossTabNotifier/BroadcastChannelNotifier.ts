import { ICrossTabNotifier, CrossTabNotifierConfig } from "./types";
import { ILogger, DefaultLoggerFactory } from "../logger";
import { IPlatformService } from "../../services/platformService";

export class BroadcastChannelNotifier implements ICrossTabNotifier {
  private channel: BroadcastChannel | null = null;
  private logger: ILogger;
  private platformService: IPlatformService;

  constructor(config: CrossTabNotifierConfig) {
    this.logger = config.logger || new DefaultLoggerFactory().createLogger();
    if (!config.platformService) throw new Error("platformService is required");
    this.platformService = config.platformService;

    try {
      this.channel = this.platformService.getBroadcastChannel(config.name);
    } catch (e) {
      this.logger.warn(`BroadcastChannelNotifier failed to initialize for ${config.name}`, e);
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
