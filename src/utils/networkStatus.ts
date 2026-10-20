import { isBrowserEnvironment, getSafeWindow } from "./platform";

export interface INetworkStatusProvider {
  isOnline(): boolean;
}

export class BrowserNetworkStatusProvider implements INetworkStatusProvider {
  isOnline(): boolean {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      if (win && typeof win.navigator.onLine === "boolean") {
        return win.navigator.onLine;
      }
    }
    return true; // Default to true if not in browser or missing navigator
  }
}
