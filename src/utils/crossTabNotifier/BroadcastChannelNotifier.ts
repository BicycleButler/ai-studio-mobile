import { ICrossTabNotifier } from "./types";
import { getSafeBroadcastChannel } from "../platform";
import { ILogger, defaultLogger } from "../logger";

export interface BroadcastChannelNotifierConfig {
  name: string;
  logger?: ILogger;
  getBroadcastChannel?: typeof getSafeBroadcastChannel;
}

export class BroadcastChannelNotifier implements ICrossTabNotifier {
  private channel: BroadcastChannel | null = null;
  private logger: ILogger;

  constructor(config: BroadcastChannelNotifierConfig) {
    this.logger = config.logger || defaultLogger;
    const getBroadcastChannel = config.getBroadcastChannel || getSafeBroadcastChannel;

    try {
      this.channel = getBroadcastChannel(config.name);
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
