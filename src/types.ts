export type PromptType = "chat" | "freeform" | "structured";

export interface ModelInfo {
  id: string;
  name: string;
  category: string;
  badge: string;
  description: string;
  contextWindow: string;
  supportsVision: boolean;
  supportsAudio: boolean;
  supportsSystemInstruction: boolean;
  supportsJson: boolean;
}

export interface MessageAttachment {
  id: string;
  name: string;
  mimeType: string;
  data: string; // base64 without prefix or raw data
  previewUrl: string;
  sizeKb: number;
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
}

export interface StructuredExample {
  id: string;
  input: string;
  output: string;
}

export interface PromptConfig {
  model: string;
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
