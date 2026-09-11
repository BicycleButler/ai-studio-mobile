import { MessageAttachment } from "../types";

export interface CompressionOptions {
  maxDimension?: number;
  quality?: number;
}

/**
 * Resizes and compresses images client-side before sending to Gemini.
 * Prevents mobile memory exhaustion (OOM) and accelerates upload on cellular connections.
 * 1568px aligns with Gemini's high-resolution vision processing tile sizes.
 */
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
          let { width, height } = img;

          // Scale down proportionally if larger than maxDimension
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

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

          // Always compress to image/jpeg unless png with transparency is required
          const targetMime = file.type === "image/png" ? "image/png" : "image/jpeg";
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
