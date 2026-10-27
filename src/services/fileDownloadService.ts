import { getSafeDocument } from "../utils/platform";
import { ILogger } from "../utils/logger";

export interface IFileDownloadService {
  downloadText(filename: string, content: string): Promise<boolean>;
}

export class BrowserFileDownloadService implements IFileDownloadService {
  constructor(private logger: ILogger, private getDoc = getSafeDocument) {}

  public async downloadText(filename: string, content: string): Promise<boolean> {
    try {
      const doc = this.getDoc();
      if (!doc) return false;
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = doc.createElement("a");
      a.href = url;
      a.download = filename;
      doc.body.appendChild(a);
      a.click();
      doc.body.removeChild(a);
      URL.revokeObjectURL(url);
      return true;
    } catch (err) {
      this.logger.debug("Failed to download file:", err);
      return false;
    }
  }
}
