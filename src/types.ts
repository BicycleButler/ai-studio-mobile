export * from "./types/stubs";
export * from "./types/integrations";
export type PromptType = "chat" | "code" | "stubs";

export type SettingsTab =
  | "account"
  | "auth"
  | "key"
  | "profile"
  | "providers"
  | "integrations"
  | "audio"
  | "display"
  | "theme"
  | "themes"
  | "security"
  | "settings"
  | "library"
  | "export"
  | "companion"
  | "tune"
  | "model"
  | "models";

export type ModelProviderId =
  | "google"
  | "openai"
  | "anthropic"
  | "openrouter"
  | "groq"
  | "openai-compatible"
  | "local-ollama"
  | "local-webllm"
  | "local-browser";

export interface ModelInfo {
  id: string;
  name: string;
  category: string;
  description: string;
  contextWindow: string;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsSystemInstruction: boolean;
  supportsJson: boolean;
  providerId?: ModelProviderId;
  providerName?: string;
  connectionId?: string;
  isLocal?: boolean;
  sizeLabel?: string;
}

export interface ProviderConnection {
  id: string;
  providerId: ModelProviderId;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  customModels?: string[];
  discoveredModels?: ModelInfo[];
  enabled: boolean;
  proxyViaServer?: boolean;
  lastVerifiedAt?: number;
  status?: "connected" | "error" | "unverified";
  statusMessage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LocalModelLoadProgress {
  modelId: string;
  progress: number; // 0 to 1
  text: string;
  status: "idle" | "loading" | "ready" | "error";
  error?: string;
}

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 without prefix or raw data
  previewUrl: string;
  sizeKb: number;
}

export type PromptTemplateCategory =
  | "coding"
  | "reasoning"
  | "tone"
  | "formatting"
  | "analysis"
  | "custom";

export interface PromptTemplate {
  id: string;
  title: string;
  description?: string;
  content: string;
  category: PromptTemplateCategory;
  isBuiltin?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface ComposePromptPayload {
  combinedText: string;
  templateIds: string[];
  userText: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "model";
  text: string;
  images?: MessageAttachment[];
  timestamp: number;
  tokenCount?: number;
  durationMs?: number;
  isStreaming?: boolean;
  error?: string;
  templateIds?: string[];
  rawUserText?: string;
  modelName?: string;
  providerId?: ModelProviderId;
}

export interface StructuredExample {
  id: string;
  input: string;
  output: string;
}

export interface GoogleUser {
  email: string;
  name: string;
  picture?: string;
  sub?: string;
  authSource: "google_oauth" | "google_identity" | "google_account";
  authenticatedAt: number;
  aiStudioSynced: boolean;
}

export interface PromptConfig {
  model: string;
  providerId?: ModelProviderId;
  connectionId?: string;
  systemInstruction: string;
  temperature: number;
  topP: number;
  topK: number;
  maxOutputTokens: number;
  responseMimeType: "text/plain" | "application/json";
  responseSchemaText: string;
}

export interface SavedPrompt {
  id: string;
  title: string;
  type: PromptType;
  config: PromptConfig;
  messages: ChatMessage[];
  freeformText?: string;
  structuredExamples?: StructuredExample[];
  updatedAt: number;
  tags?: string[];
  projectId?: string;
}

export interface IncomingMessageImage {
  mimeType: string;
  data: string;
}

export interface IncomingMessage {
  role: "user" | "model" | "assistant";
  text?: string;
  images?: IncomingMessageImage[];
}

export interface GenerateRequestBody {
  model?: string;
  providerId?: ModelProviderId;
  connectionId?: string;
  baseUrl?: string;
  messages: IncomingMessage[];
  systemInstruction?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxOutputTokens?: number;
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
  stream?: boolean;
}

export type ActiveTab = "chat" | "parameters" | "library" | "export" | "companion";

export type DeviceFrameMode = "responsive" | "pixel" | "tablet";

export interface ProjectInfo {
  id: string;
  name: string;
  apiKey: string;
  defaultModel: string;
  createdAt: number;
  updatedAt: number;
  lastVerifiedAt?: number;
  isValid?: boolean;
  status?: "active" | "invalid_key" | "attention_required" | "revoked";
  statusMessage?: string;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  model?: string;
  projectId?: string;
}

export interface KeyVerificationResult {
  valid: boolean;
  error?: string;
  model?: string;
  totalTokens?: number;
  verifiedAt?: number;
}
