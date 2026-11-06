import { ILogger, DefaultLoggerFactory } from "../utils/logger";
import { IPlatformService } from "./platformService";

export interface IClipboardService {
  writeText(text: string): Promise<boolean>;
  readText(): Promise<string>;
}

export class BrowserClipboardService implements IClipboardService {
  constructor(private logger: ILogger, private platformService: IPlatformService, private getClipboard = () => platformService.getNavigator()?.clipboard || null) {}

  public async readText(): Promise<string> {
    try {
      const clipboard = this.getClipboard();
      if (clipboard && clipboard.readText) {
        return await clipboard.readText();
      }
    } catch (err) {
      this.logger.debug("Failed to read from clipboard:", err);
    }
    return "";
  }

  public async writeText(text: string): Promise<boolean> {
    try {
      const clipboard = this.getClipboard();
      if (clipboard && clipboard.writeText) {
        await clipboard.writeText(text);
        return true;
      }
    } catch (err) {
      this.logger.debug("Failed to write to clipboard:", err);
    }
    return false;
  }
}
