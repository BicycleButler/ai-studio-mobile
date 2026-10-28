import { ICrossTabNotifier, ICrossTabNotifierFactory, CrossTabNotifierConfig } from "./types";
import { BroadcastChannelNotifier } from "./BroadcastChannelNotifier";
import { StorageEventNotifier } from "./StorageEventNotifier";
import { defaultLogger } from "../logger";

export class DefaultCrossTabNotifierFactory implements ICrossTabNotifierFactory {
  public createCrossTabNotifier(config: CrossTabNotifierConfig): ICrossTabNotifier {
    const logger = config.logger || defaultLogger;
    const broadcastNotifier = new BroadcastChannelNotifier(config);

    if (broadcastNotifier.isSupported()) {
      logger.debug(`Using BroadcastChannelNotifier for ${config.name}`);
      return broadcastNotifier;
    }

    logger.debug(`Falling back to StorageEventNotifier for ${config.name}`);
    broadcastNotifier.dispose(); // clean up just in case
    return new StorageEventNotifier(config);
  }
}

export const defaultCrossTabNotifierFactory = new DefaultCrossTabNotifierFactory();

export function createCrossTabNotifier(config: CrossTabNotifierConfig | string, logger = defaultLogger): ICrossTabNotifier {
  if (typeof config === "string") {
    return defaultCrossTabNotifierFactory.createCrossTabNotifier({ name: config, logger });
  }
  return defaultCrossTabNotifierFactory.createCrossTabNotifier(config);
}
