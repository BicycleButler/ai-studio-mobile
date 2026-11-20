import { ModelInfo, ModelProviderId, ProviderConnection } from "../types";

export interface ProviderDefinition {
  id: ModelProviderId;
  name: string;
  shortName: string;
  description: string;
  requiresApiKey: boolean;
  supportsBaseUrl: boolean;
  defaultBaseUrl?: string;
  keyPlaceholder?: string;
  isLocal: boolean;
  docsUrl?: string;
  defaultModels: ModelInfo[];
}

export const CLOUD_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "openai",
    name: "OpenAI",
    shortName: "OpenAI",
    description: "Connect your OpenAI API key for GPT-4.1, GPT-4o, and o-series reasoning models.",
    requiresApiKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.openai.com/v1",
    keyPlaceholder: "sk-proj-...",
    isLocal: false,
    docsUrl: "https://platform.openai.com/api-keys",
    defaultModels: [
      {
        id: "gpt-4.1",
        name: "GPT-4.1",
        category: "Complex Reasoning",
        description: "OpenAI flagship model for coding, instruction following, and long-context tasks.",
        contextWindow: "1M tokens",
        supportsVision: true,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openai",
        providerName: "OpenAI",
      },
      {
        id: "gpt-4.1-mini",
        name: "GPT-4.1 Mini",
        category: "High Speed",
        description: "Fast, cost-efficient OpenAI model with strong coding and vision performance.",
        contextWindow: "1M tokens",
        supportsVision: true,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openai",
        providerName: "OpenAI",
      },
      {
        id: "gpt-4o",
        name: "GPT-4o",
        category: "Recommended",
        description: "Versatile multimodal OpenAI model for text, code, and image analysis.",
        contextWindow: "128k tokens",
        supportsVision: true,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openai",
        providerName: "OpenAI",
      },
      {
        id: "o4-mini",
        name: "o4-mini",
        category: "Complex Reasoning",
        description: "Compact reasoning model optimized for math, science, and structured coding.",
        contextWindow: "200k tokens",
        supportsVision: true,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openai",
        providerName: "OpenAI",
      },
    ],
  },
  {
    id: "anthropic",
    name: "Anthropic Claude",
    shortName: "Anthropic",
    description: "Connect your Anthropic API key for Claude Sonnet 4, Opus 4, and Haiku models.",
    requiresApiKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.anthropic.com/v1",
    keyPlaceholder: "sk-ant-api03-...",
    isLocal: false,
    docsUrl: "https://console.anthropic.com/settings/keys",
    defaultModels: [
      {
        id: "claude-sonnet-4-20250514",
        name: "Claude Sonnet 4",
        category: "Recommended",
        description: "Balanced Anthropic model excelling at software engineering, writing, and analysis.",
        contextWindow: "200k tokens",
        supportsVision: true,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: false,
        providerId: "anthropic",
        providerName: "Anthropic",
      },
      {
        id: "claude-opus-4-20250514",
        name: "Claude Opus 4",
        category: "Complex Reasoning",
        description: "Anthropic's highest-capability model for deep architecture, research, and agentic coding.",
        contextWindow: "200k tokens",
        supportsVision: true,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: false,
        providerId: "anthropic",
        providerName: "Anthropic",
      },
      {
        id: "claude-3-5-haiku-latest",
        name: "Claude 3.5 Haiku",
        category: "High Speed",
        description: "Low-latency Anthropic model for rapid iteration, classification, and chat.",
        contextWindow: "200k tokens",
        supportsVision: true,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: false,
        providerId: "anthropic",
        providerName: "Anthropic",
      },
    ],
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    shortName: "OpenRouter",
    description: "Access DeepSeek, Llama, Mistral, Qwen, Claude, and GPT models via one OpenRouter key.",
    requiresApiKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    keyPlaceholder: "sk-or-v1-...",
    isLocal: false,
    docsUrl: "https://openrouter.ai/keys",
    defaultModels: [
      {
        id: "deepseek/deepseek-r1",
        name: "DeepSeek R1",
        category: "Complex Reasoning",
        description: "Open-weights reasoning model via OpenRouter.",
        contextWindow: "128k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openrouter",
        providerName: "OpenRouter",
      },
      {
        id: "meta-llama/llama-3.3-70b-instruct",
        name: "Llama 3.3 70B Instruct",
        category: "Recommended",
        description: "Meta's open-weights instruction model hosted on OpenRouter.",
        contextWindow: "128k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openrouter",
        providerName: "OpenRouter",
      },
      {
        id: "qwen/qwen-2.5-72b-instruct",
        name: "Qwen 2.5 72B Instruct",
        category: "Complex Reasoning",
        description: "Multilingual reasoning and coding model via OpenRouter.",
        contextWindow: "128k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openrouter",
        providerName: "OpenRouter",
      },
      {
        id: "mistralai/mistral-large-2411",
        name: "Mistral Large",
        category: "Stable Production",
        description: "Mistral's flagship general-purpose reasoning and coding model.",
        contextWindow: "128k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "openrouter",
        providerName: "OpenRouter",
      },
    ],
  },
  {
    id: "groq",
    name: "Groq",
    shortName: "Groq",
    description: "Ultra-low-latency inference for Llama, DeepSeek, and Qwen open models.",
    requiresApiKey: true,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.groq.com/openai/v1",
    keyPlaceholder: "gsk_...",
    isLocal: false,
    docsUrl: "https://console.groq.com/keys",
    defaultModels: [
      {
        id: "llama-3.3-70b-versatile",
        name: "Llama 3.3 70B (Groq)",
        category: "High Speed",
        description: "High-speed LPU inference for Meta Llama 3.3 70B.",
        contextWindow: "128k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "groq",
        providerName: "Groq",
      },
      {
        id: "llama-3.1-8b-instant",
        name: "Llama 3.1 8B Instant",
        category: "High Speed",
        description: "Sub-second responses for rapid prototyping and lightweight tasks.",
        contextWindow: "128k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "groq",
        providerName: "Groq",
      },
    ],
  },
  {
    id: "openai-compatible",
    name: "Custom OpenAI-Compatible",
    shortName: "Custom",
    description: "Connect any OpenAI-compatible API endpoint (Together, Fireworks, DeepSeek, xAI, vLLM, LiteLLM).",
    requiresApiKey: false,
    supportsBaseUrl: true,
    defaultBaseUrl: "https://api.deepseek.com/v1",
    keyPlaceholder: "Optional API key...",
    isLocal: false,
    defaultModels: [],
  },
];

export const LOCAL_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  {
    id: "local-webllm",
    name: "On-Device WebGPU (WebLLM)",
    shortName: "WebGPU",
    description: "Run quantized open models directly on your device GPU inside the browser. Offline-capable after download.",
    requiresApiKey: false,
    supportsBaseUrl: false,
    isLocal: true,
    defaultModels: [
      {
        id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        name: "Llama 3.2 1B (On-Device)",
        category: "Local On-Device",
        description: "Fast, compact 1B parameter Meta Llama model running locally via WebGPU.",
        contextWindow: "8k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "local-webllm",
        providerName: "WebGPU On-Device",
        isLocal: true,
        sizeLabel: "~880 MB",
      },
      {
        id: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
        name: "Qwen 2.5 1.5B (On-Device)",
        category: "Local On-Device",
        description: "Capable 1.5B coding and reasoning model running locally via WebGPU.",
        contextWindow: "32k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "local-webllm",
        providerName: "WebGPU On-Device",
        isLocal: true,
        sizeLabel: "~1.1 GB",
      },
      {
        id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
        name: "Phi-3.5 Mini 3.8B (On-Device)",
        category: "Local On-Device",
        description: "Microsoft's 3.8B reasoning model running directly on device GPU.",
        contextWindow: "16k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: true,
        providerId: "local-webllm",
        providerName: "WebGPU On-Device",
        isLocal: true,
        sizeLabel: "~2.2 GB",
      },
      {
        id: "gemma-2-2b-it-q4f16_1-MLC",
        name: "Gemma 2 2B (On-Device)",
        category: "Local On-Device",
        description: "Google's open-weights Gemma 2 2B model running 100% locally via WebGPU.",
        contextWindow: "8k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: false,
        providerId: "local-webllm",
        providerName: "WebGPU On-Device",
        isLocal: true,
        sizeLabel: "~1.6 GB",
      },
    ],
  },
  {
    id: "local-browser",
    name: "Browser Built-in AI",
    shortName: "Browser AI",
    description: "Use your browser's native on-device LanguageModel API (Chrome Gemini Nano) with zero downloads.",
    requiresApiKey: false,
    supportsBaseUrl: false,
    isLocal: true,
    defaultModels: [
      {
        id: "chrome-gemini-nano",
        name: "Gemini Nano (Browser Built-in)",
        category: "Local On-Device",
        description: "Native on-device browser LanguageModel API for zero-latency local prompts.",
        contextWindow: "4k tokens",
        supportsVision: false,
        supportsAudio: false,
        supportsSystemInstruction: true,
        supportsJson: false,
        providerId: "local-browser",
        providerName: "Browser Built-in",
        isLocal: true,
        sizeLabel: "Built-in",
      },
    ],
  },
  {
    id: "local-ollama",
    name: "Local Server (Ollama / LM Studio)",
    shortName: "Local Server",
    description: "Connect to a local model server on your device or LAN (Ollama, LM Studio, llama.cpp).",
    requiresApiKey: false,
    supportsBaseUrl: true,
    defaultBaseUrl: "http://localhost:11434",
    isLocal: true,
    defaultModels: [],
  },
];

export const ALL_PROVIDER_DEFINITIONS: ProviderDefinition[] = [
  ...CLOUD_PROVIDER_DEFINITIONS,
  ...LOCAL_PROVIDER_DEFINITIONS,
];

export function getProviderDefinition(providerId: ModelProviderId): ProviderDefinition | undefined {
  return ALL_PROVIDER_DEFINITIONS.find((p) => p.id === providerId);
}

export function getProviderDisplayName(providerId?: ModelProviderId): string {
  if (!providerId || providerId === "google") return "Google Gemini";
  return getProviderDefinition(providerId)?.shortName || providerId;
}

export function isLocalProvider(providerId?: ModelProviderId): boolean {
  return (
    providerId === "local-webllm" ||
    providerId === "local-browser" ||
    providerId === "local-ollama"
  );
}

/**
 * Builds the merged list of ModelInfo items for an enabled ProviderConnection.
 */
export function buildModelsForConnection(connection: ProviderConnection): ModelInfo[] {
  if (!connection.enabled) return [];

  const def = getProviderDefinition(connection.providerId);
  const modelsMap = new Map<string, ModelInfo>();

  const attachMeta = (m: ModelInfo): ModelInfo => ({
    ...m,
    providerId: connection.providerId,
    providerName: connection.name || def?.shortName || connection.providerId,
    connectionId: connection.id,
    isLocal: def?.isLocal ?? false,
  });

  if (connection.discoveredModels && connection.discoveredModels.length > 0) {
    for (const m of connection.discoveredModels) {
      modelsMap.set(m.id, attachMeta(m));
    }
  } else if (def?.defaultModels) {
    for (const m of def.defaultModels) {
      modelsMap.set(m.id, attachMeta(m));
    }
  }

  if (connection.customModels && connection.customModels.length > 0) {
    for (const rawId of connection.customModels) {
      const id = rawId.trim();
      if (!id || modelsMap.has(id)) continue;
      modelsMap.set(
        id,
        attachMeta({
          id,
          name: id,
          category: def?.isLocal ? "Local On-Device" : connection.name || "Custom Provider",
          description: `Configured model on ${connection.name || def?.name || connection.providerId}.`,
          contextWindow: def?.isLocal ? "Local context" : "128k tokens",
          supportsVision: connection.providerId === "openai" || connection.providerId === "anthropic",
          supportsAudio: false,
          supportsSystemInstruction: true,
          supportsJson: connection.providerId !== "anthropic",
        })
      );
    }
  }

  return Array.from(modelsMap.values());
}
