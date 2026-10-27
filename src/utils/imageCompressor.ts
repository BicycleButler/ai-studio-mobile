import { MessageAttachment } from "../types";
import { generateUniqueId } from "./idGenerator";
import { getSafeDocument } from "./platform";

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
}

export function calculateProportionalDimensions(width: number, height: number, maxDimension: number): { width: number; height: number } {
  if (width <= maxDimension && height <= maxDimension) {
    return { width, height };
  }

  if (width > height) {
    return {
      width: maxDimension,
      height: Math.round((height * maxDimension) / width),
    };
  }

  return {
    width: Math.round((width * maxDimension) / height),
    height: maxDimension,
  };
}

export interface IImageCompressionStrategy {
  compress(file: File, options: CompressionOptions): Promise<MessageAttachment>;
}

export interface CanvasImageCompressionStrategyConfig {
  getSafeDoc?: typeof getSafeDocument;
}

export class CanvasImageCompressionStrategy implements IImageCompressionStrategy {
  private getSafeDoc: typeof getSafeDocument;

  constructor(config?: CanvasImageCompressionStrategyConfig) {
    this.getSafeDoc = config?.getSafeDoc || getSafeDocument;
  }
  private isWebPSupported(): boolean {
    if (!this.getSafeDoc()) return false;
    const canvas = this.getSafeDoc()!.createElement("canvas");
    if (!canvas.toDataURL) return false;
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  }

  public async compress(file: File, options: CompressionOptions): Promise<MessageAttachment> {
    const { maxDimension = 1568, quality = 0.82 } = options;

    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          try {
            const { width, height } = calculateProportionalDimensions(img.width, img.height, maxDimension);

            const canvas = this.getSafeDoc()!.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
              throw new Error("Unable to create canvas context for image processing.");
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = "high";
            ctx.drawImage(img, 0, 0, width, height);

            let targetMime = "image/jpeg";
            if (file.type === "image/png") {
              targetMime = "image/png";
            } else if (this.isWebPSupported()) {
              targetMime = "image/webp";
            }
            const dataUrl = canvas.toDataURL(targetMime, quality);
            const base64Data = dataUrl.split(",")[1] || "";
            const sizeKb = Math.round((base64Data.length * 3) / 4 / 1024);

            const attachment: MessageAttachment = {
              id: generateUniqueId("att"),
              name: file.name,
              mimeType: targetMime,
              data: base64Data,
              previewUrl: dataUrl,
              sizeKb,
            };

            resolve(attachment);
          } catch (err: unknown) {
            reject(err);
          }
        };

        img.onerror = () => {
          reject(new Error(`Failed to load image file: ${file.name}`));
        };

        if (typeof e.target?.result === "string") {
          img.src = e.target.result;
        } else {
          reject(new Error("Failed to read file as data URL."));
        }
      };

      reader.onerror = () => {
        reject(new Error(`Error reading file: ${file.name}`));
      };

      reader.readAsDataURL(file);
    });
  }
}

export interface IImageCompressor {
  compressImageForGemini(file: File, options?: CompressionOptions): Promise<MessageAttachment>;
}

export class ImageCompressor implements IImageCompressor {
  constructor(private strategy: IImageCompressionStrategy) {}

  public async compressImageForGemini(file: File, options?: CompressionOptions): Promise<MessageAttachment> {
    return this.strategy.compress(file, options || {});
  }
}

export const defaultImageCompressor = new ImageCompressor(new CanvasImageCompressionStrategy());
