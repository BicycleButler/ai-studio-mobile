export * from "./types/stubs";
export type PromptType = "chat" | "code" | "jules" | "stubs";







export type JulesTaskStatus =
  | "idle"
  | "queued"
  | "analyzing"
  | "planning"
  | "awaiting_approval"
  | "executing"
  | "review_ready"
  | "completed"
  | "failed";

export interface JulesExecutionStep {
  id: string;
  title?: string;
  description?: string;
  detail?: string;
  status: "pending" | "running" | "in_progress" | "completed" | "failed";
  timestamp?: number;
  filesChanged?: string[];
  diffSummary?: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
}

export interface JulesPullRequest {
  number: number;
  title: string;
  url: string;
  branch: string;
  state: "open" | "merged" | "closed";
}

export interface JulesRepository {
  id: string;
  fullName: string;
  owner: string;
  name: string;
  defaultBranch: string;
  isPrivate: boolean;
  description?: string;
}

export interface JulesActivity {
  type: "plan" | "step" | "diff" | "pull_request" | "error";
  status: JulesTaskStatus;
  taskId?: string;
  title?: string;
  planDescription?: string;
  plan?: string[];
  currentStep?: JulesExecutionStep;
  steps?: JulesExecutionStep[];
  pullRequest?: JulesPullRequest;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  diff?: string;
  diffContent?: string;
  diffStats?: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  requiresApproval?: boolean;
  error?: string;
  errorMessage?: string;
}

export interface JulesSession {
  id: string;
  title: string;
  repository: string;
  branch: string;
  targetBranch?: string;
  status: JulesTaskStatus;
  plan?: string[];
  steps: JulesExecutionStep[];
  pullRequest?: JulesPullRequest;
  messages: ChatMessage[];
  autoApprovePlan?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface JulesSettings {
  autoApprovePlans: boolean;
  defaultBranch: string;
}

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
  julesActivity?: JulesActivity;
  templateIds?: string[];
  rawUserText?: string;
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
