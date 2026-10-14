import { MessageAttachment } from "../types";

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
}

/**
 * Calculates proportionally scaled dimensions ensuring neither width nor height exceeds maxDimension.
 */
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

/**
 * Resizes and compresses images client-side before sending to Gemini.
 * Prevents mobile memory exhaustion (OOM) and accelerates upload on cellular connections.
 * 1568px aligns with Gemini's high-resolution vision processing tile sizes.
 */
/**
 * Detects if the browser supports WEBP image generation via canvas.
 */
function isWebPSupported(): boolean {
  if (typeof document === "undefined") return false;
  const canvas = document.createElement("canvas");
  if (!canvas.toDataURL) return false;
  return canvas.toDataURL("image/webp").indexOf("data:image/webp") === 0;
}

export async function compressImageForGemini(
  file: File,
  options: CompressionOptions = {}
): Promise<MessageAttachment> {
  const { maxDimension = 1568, quality = 0.82 } = options;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        try {
          const { width, height } = calculateProportionalDimensions(img.width, img.height, maxDimension);

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            throw new Error("Unable to create canvas context for image processing.");
          }

          // Use high quality image smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to WEBP if supported for better compression, otherwise JPEG, unless PNG is requested
          let targetMime = "image/jpeg";
          if (file.type === "image/png") {
            targetMime = "image/png";
          } else if (isWebPSupported()) {
            targetMime = "image/webp";
          }
          const dataUrl = canvas.toDataURL(targetMime, quality);
          const base64Data = dataUrl.split(",")[1] || "";
          const sizeKb = Math.round((base64Data.length * 3) / 4 / 1024);

          const attachment: MessageAttachment = {
            id: `att-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
