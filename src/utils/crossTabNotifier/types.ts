import { ILogger } from "../logger";

export interface ICrossTabNotifier {
  notify(message: string): void;
  onMessage(handler: (message: string) => void): void;
  dispose(): void;
}

export interface ICrossTabNotifierFactory {
  createCrossTabNotifier(name: string, logger?: ILogger): ICrossTabNotifier;
}
