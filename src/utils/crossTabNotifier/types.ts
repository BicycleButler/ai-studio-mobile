import { ILogger } from "../logger";
import { getSafeBroadcastChannel, getSafeLocalStorage, isBrowserEnvironment, safeAddEventListener } from "../platform";

export interface ICrossTabNotifier {
  notify(message: string): void;
  onMessage(handler: (message: string) => void): void;
  dispose(): void;
}

export interface CrossTabNotifierConfig {
  name: string;
  logger?: ILogger;
  getBroadcastChannel?: typeof getSafeBroadcastChannel;
  getLocalStorage?: typeof getSafeLocalStorage;
  isBrowserEnv?: typeof isBrowserEnvironment;
  addEventListener?: typeof safeAddEventListener;
}

export interface ICrossTabNotifierFactory {
  createCrossTabNotifier(config: CrossTabNotifierConfig): ICrossTabNotifier;
}
