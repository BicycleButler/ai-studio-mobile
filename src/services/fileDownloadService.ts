import { ILogger, DefaultLoggerFactory } from "../utils/logger";
import { IPlatformService, BrowserPlatformService } from "./platformService";

export interface IFileDownloadService {
  downloadText(filename: string, content: string): Promise<boolean>;
}

export class BrowserFileDownloadService implements IFileDownloadService {
  constructor(
    private logger: ILogger,
    private platformService: IPlatformService = new BrowserPlatformService()
  ) {}

  public async downloadText(filename: string, content: string): Promise<boolean> {
    try {
      const doc = this.platformService.getDocument();
      if (!doc) return false;
      const blob = this.platformService.createBlob([content], { type: "text/plain;charset=utf-8" });
      if (!blob) return false;
      const url = this.platformService.createObjectURL(blob);
      if (!url) return false;
      const a = this.platformService.createElement("a");
      if (!a) return false;
      a.href = url;
      a.download = filename;
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      this.platformService.revokeObjectURL(url);
      return true;
    } catch (err) {
      this.logger.debug("Failed to download file:", err);
      return false;
    }
  }
}
