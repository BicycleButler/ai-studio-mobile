import { ICrossTabNotifier } from "./types";
import { ILogger, defaultLogger } from "../logger";
import { IPlatformService, defaultPlatformService } from "../../services/platformService";

export interface BroadcastChannelNotifierConfig {
  name: string;
  logger?: ILogger;
  platformService?: IPlatformService;
}

export class BroadcastChannelNotifier implements ICrossTabNotifier {
  private channel: BroadcastChannel | null = null;
  private logger: ILogger;
  private platformService: IPlatformService;

  constructor(config: BroadcastChannelNotifierConfig) {
    this.logger = config.logger || defaultLogger;
    this.platformService = config.platformService || defaultPlatformService;

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
