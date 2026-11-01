import { ILogger } from "../logger";
import { IPlatformService } from "../../services/platformService";

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
}

export interface ICrossTabNotifierFactory {
  createCrossTabNotifier(config: CrossTabNotifierConfig): ICrossTabNotifier;
}
