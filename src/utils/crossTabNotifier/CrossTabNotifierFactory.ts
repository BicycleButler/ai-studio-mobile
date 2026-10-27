import { ICrossTabNotifier } from "./types";
import { BroadcastChannelNotifier } from "./BroadcastChannelNotifier";
import { StorageEventNotifier } from "./StorageEventNotifier";
import { ILogger, defaultLogger } from "../logger";

export function createCrossTabNotifier(name: string, logger: ILogger = defaultLogger): ICrossTabNotifier {
  const broadcastNotifier = new BroadcastChannelNotifier(name, logger);

  if (broadcastNotifier.isSupported()) {
    logger.debug(`Using BroadcastChannelNotifier for ${name}`);
    return broadcastNotifier;
  }

  logger.debug(`Falling back to StorageEventNotifier for ${name}`);
  broadcastNotifier.dispose(); // clean up just in case
  return new StorageEventNotifier(name, logger);
}
