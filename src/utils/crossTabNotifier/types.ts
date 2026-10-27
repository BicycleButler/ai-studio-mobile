export interface ICrossTabNotifier {
  notify(message: string): void;
  onMessage(handler: (message: string) => void): void;
  dispose(): void;
}
