import { ModelInfo } from "../types";


import { apiFetch } from "./apiClient";

export async function fetchModels(apiKey?: string, refresh: boolean = false): Promise<{ models?: ModelInfo[] }> {
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["x-gemini-api-key"] = apiKey;
  }
  const endpoint = refresh ? "/api/models?refresh=true" : "/api/models";
  return apiFetch<{ models?: ModelInfo[] }>(endpoint, { headers });
}

export const FALLBACK_MODEL_ID = "gemini-2.5-flash";

/**
 * Curated list of fully supported, production-ready, and usable models for
 * prompt design, chat, and code generation in Google AI Studio.
 */
export const CURATED_MODELS: ModelInfo[] = [
  {
    id: "gemini-2.5-flash",
    name: "Gemini 3.8 Flash",
    category: "Recommended",
    description: "Google's premier model for versatile text, code, multimodal reasoning, and rapid turnarounds.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-3.1-pro-preview",
    name: "Gemini 3.1 Pro (Preview)",
    category: "Complex Reasoning",
    description: "State-of-the-art model for complex multi-step reasoning, advanced coding, mathematics, and STEM.",
    contextWindow: "2M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    category: "High Speed",
    description: "Lightweight, cost-effective model optimized for high throughput, snappiness, and efficiency.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: false,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-flash-latest",
    name: "Gemini Flash (Latest)",
    category: "Stable Production",
    description: "Always points to the latest stable, production-ready Gemini Flash release.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-pro-latest",
    name: "Gemini Pro (Latest)",
    category: "Stable Production",
    description: "Always points to the latest stable, production-ready Gemini Pro release.",
    contextWindow: "2M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    category: "Stable Production",
    description: "Proven 2.5-generation multimodal workhorse supporting up to 1 million tokens.",
    contextWindow: "1M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    category: "Complex Reasoning",
    description: "Proven 2.5-generation reasoning model for in-depth analysis and coding.",
    contextWindow: "2M tokens",
    supportsVision: true,
    supportsAudio: true,
    supportsSystemInstruction: true,
    supportsJson: true,
  },
];

/**
 * Identifies deprecated, legacy, or non-chat/tuner models that should never be
 * shown in the AI Studio Model & Tuners menu.
 */
export function isDeprecatedOrUnusableModel(rawId: string): boolean {
  if (!rawId) return true;
  const id = rawId.toLowerCase().trim().replace(/^models\//, "");

  // 1. Strictly deprecated or legacy models prohibited by Google AI Studio
  if (
    id.startsWith("gemini-1.5") ||
    id.startsWith("gemini-1.0") ||
    id.startsWith("gemini-2.0") ||
    id === "gemini-pro" ||
    id === "gemini-pro-vision" ||
    id.startsWith("aqa") ||
    id.includes("deprecated")
  ) {
    return true;
  }

  // 2. Non-text/chat models unusable for standard prompt tuning
  if (
    id.includes("tts") ||
    id.includes("lyria") ||
    id.includes("veo") ||
    id.includes("image") ||
    id.includes("banana") ||
    id.includes("transcribe") ||
    id.includes("robotics") ||
    id.includes("computer-use") ||
    id.includes("antigravity") ||
    id.includes("deep-research") ||
    id.includes("gemma") ||
    id.includes("customtools") ||
    id.includes("omni") ||
    id.includes("embedding")
  ) {
    return true;
  }

  // 3. Interim preview duplicates superseded by stable or flagship releases
  if (
    id === "gemini-3-flash-preview" ||
    id === "gemini-3.1-flash-lite-preview" ||
    id.startsWith("gemini-3.5") ||
    id.startsWith("gemini-3.6")
  ) {
    return true;
  }

  return false;
}

/**
 * Returns a clean, sanitized model ID. If the model is deprecated or unusable,
 * falls back to FALLBACK_MODEL_ID.
 */
export function sanitizeModelId(modelId: string | undefined): string {
  if (!modelId || isDeprecatedOrUnusableModel(modelId)) {
    return FALLBACK_MODEL_ID;
  }
  return modelId;
}
