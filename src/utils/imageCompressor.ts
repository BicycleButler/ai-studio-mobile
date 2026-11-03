import { MessageAttachment } from "../types";
import { IIdGenerator, defaultIdGenerator } from "./idGenerator";
import { IPlatformService, defaultPlatformService } from "../services/platformService";

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
  platformService?: IPlatformService;
  idGenerator?: IIdGenerator;
}

export class CanvasImageCompressionStrategy implements IImageCompressionStrategy {
  private platformService: IPlatformService;
  private idGenerator: IIdGenerator;

  constructor(config?: CanvasImageCompressionStrategyConfig) {
    this.platformService = config?.platformService || defaultPlatformService;
    this.idGenerator = config?.idGenerator || defaultIdGenerator;
  }
  private isWebPSupported(): boolean {
    if (!this.platformService.getDocument()) return false;
    const canvas = this.platformService.getDocument()!.createElement("canvas");
    if (!canvas.toDataURL) return false;
    return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
  }

  public async compress(file: File, options: CompressionOptions): Promise<MessageAttachment> {
    const { maxDimension = 1568, quality = 0.82 } = options;

    return new Promise((resolve, reject) => {
      const reader = this.platformService.createFileReader();
      if (!reader) {
        return reject(new Error("FileReader is not available in the current platform."));
      }

      reader.onload = (e) => {
        const img = this.platformService.createImage();
        if (!img) {
          return reject(new Error("Image API is not available in the current platform."));
        }

        img.onload = () => {
          try {
            const { width, height } = calculateProportionalDimensions(img.width, img.height, maxDimension);

            const canvas = this.platformService.getDocument()!.createElement("canvas");
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
              id: this.idGenerator.generate("att"),
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

export interface ImageCompressorConfig {
  strategy?: IImageCompressionStrategy;
}

export class ImageCompressor implements IImageCompressor {
  private strategy: IImageCompressionStrategy;

  constructor(config?: ImageCompressorConfig) {
    this.strategy = config?.strategy || new CanvasImageCompressionStrategy();
  }

  public async compressImageForGemini(file: File, options?: CompressionOptions): Promise<MessageAttachment> {
    return this.strategy.compress(file, options || {});
  }
}

