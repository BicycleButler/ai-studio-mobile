import { ICrossTabNotifier, ICrossTabNotifierFactory, CrossTabNotifierConfig } from "./types";
import { BroadcastChannelNotifier } from "./BroadcastChannelNotifier";
import { StorageEventNotifier } from "./StorageEventNotifier";
import { FallbackCrossTabNotifier } from "./FallbackCrossTabNotifier";
import { DefaultLoggerFactory } from "../logger";

export class DefaultCrossTabNotifierFactory implements ICrossTabNotifierFactory {
  public createCrossTabNotifier(config: CrossTabNotifierConfig): ICrossTabNotifier {
    const logger = config.logger || new DefaultLoggerFactory().createLogger();

    return new FallbackCrossTabNotifier(
      [
        new BroadcastChannelNotifier(config),
        new StorageEventNotifier(config)
      ],
      logger
    );
  }
}

