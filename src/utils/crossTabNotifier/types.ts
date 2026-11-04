import { ILogger } from "../logger";
import { IPlatformService } from "../../services/platformService";
import { ITimeProvider } from "../timeProvider";

export interface ICrossTabNotifier {
  notify(message: string): void;
  onMessage(handler: (message: string) => void): void;
  dispose(): void;
  isSupported?(): boolean;
}

export interface CrossTabNotifierConfig {
  name: string;
  logger?: ILogger;
  platformService?: IPlatformService;
  timeProvider?: ITimeProvider;
}

export interface ICrossTabNotifierFactory {
  createCrossTabNotifier(config: CrossTabNotifierConfig): ICrossTabNotifier;
}
