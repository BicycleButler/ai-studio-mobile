import { z } from "zod";

// Schema for image attachments in messages
export const MessageImageSchema = z.object({
  mimeType: z.string().min(1, "MIME type is required"),
  data: z.string().min(1, "Image base64 data cannot be empty"),
});

// Schema for single message in prompt history
export const IncomingMessageSchema = z.object({
  role: z.enum(["user", "model", "assistant"]),
  text: z.string().optional().default(""),
  images: z.array(MessageImageSchema).optional(),
});

export const ProviderIdSchema = z.enum([
  "google",
  "openai",
  "anthropic",
  "openrouter",
  "groq",
  "openai-compatible",
  "local-ollama",
  "local-webllm",
  "local-browser",
]);

// Schema for /api/generate request payload
export const GenerateRequestSchema = z.object({
  model: z.string().min(1).default("gemini-2.5-flash"),
  providerId: ProviderIdSchema.optional().default("google"),
  connectionId: z.string().optional(),
  baseUrl: z.string().optional(),
  messages: z
    .array(IncomingMessageSchema)
    .min(1, "At least one message is required in the messages array"),
  systemInstruction: z.string().optional(),
  temperature: z
    .number()
    .min(0, "Temperature must be at least 0.0")
    .max(2.0, "Temperature cannot exceed 2.0")
    .optional()
    .default(1.0),
  topP: z
    .number()
    .min(0, "TopP must be at least 0.0")
    .max(1.0, "TopP cannot exceed 1.0")
    .optional()
    .default(0.95),
  topK: z
    .number()
    .int("TopK must be an integer")
    .min(1, "TopK must be at least 1")
    .max(100, "TopK cannot exceed 100")
    .optional()
    .default(40),
  maxOutputTokens: z
    .number()
    .int("Max tokens must be an integer")
    .min(1, "Max tokens must be at least 1")
    .max(65536, "Max tokens cannot exceed 65536")
    .optional(),
  responseMimeType: z.string().optional(),
  responseSchema: z.record(z.string(), z.unknown()).optional(),
  stream: z.boolean().optional().default(true),
});

export const ProviderVerifyRequestSchema = z.object({
  providerId: ProviderIdSchema,
  apiKey: z.string().optional(),
  baseUrl: z.string().optional(),
});

// Schema for /api/count-tokens
export const CountTokensRequestSchema = z.object({
  model: z.string().optional().default("gemini-2.5-flash"),
  contents: z.union([z.string(), z.record(z.string(), z.unknown()), z.array(z.unknown())]),
});

// Schema for /api/tts (Text-to-Speech)
export const TTSRequestSchema = z.object({
  text: z.string().min(1, "Text is required for speech synthesis").max(10000, "Text exceeds maximum spoken length of 10,000 characters"),
  voiceName: z.string().optional().default("Puck"),
});

export const IntegrationProviderIdSchema = z.enum(["firebase", "gcp", "github", "vercel"]);
export const IntegrationAuthMethodSchema = z.enum(["token", "service_account", "oauth"]);

export const IntegrationCredentialsSchema = z.object({
  providerId: IntegrationProviderIdSchema,
  authMethod: IntegrationAuthMethodSchema.optional(),
  token: z.string().optional(),
  serviceAccountJson: z.string().optional(),
  projectId: z.string().optional(),
  databaseId: z.string().optional(),
  teamId: z.string().optional(),
});

export const IntegrationVerifySchema = z.object({
  credentials: IntegrationCredentialsSchema,
});

export const FirebaseListDocsSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  collectionPath: z.string().optional(),
  pageSize: z.number().int().min(1).max(200).optional(),
});

export const FirebaseWriteDocSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  collectionPath: z.string().min(1, "Collection path is required"),
  docId: z.string().optional(),
  data: z.record(z.string(), z.unknown()),
  merge: z.boolean().optional().default(false),
});

export const FirebaseDeleteDocSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  documentPath: z.string().min(1, "Document path is required"),
});

export const FirebaseRtdbSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  dbUrl: z.string().optional(),
  path: z.string().optional().default(""),
  data: z.unknown().optional(),
});

export const GcpBucketObjectsSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  bucket: z.string().min(1, "Bucket name is required"),
  prefix: z.string().optional(),
});

export const GcpReadObjectSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  bucket: z.string().min(1, "Bucket name is required"),
  objectName: z.string().min(1, "Object name is required"),
});

export const GcpWriteObjectSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  bucket: z.string().min(1, "Bucket name is required"),
  objectName: z.string().min(1, "Object name is required"),
  content: z.string(),
  contentType: z.string().optional().default("text/plain; charset=utf-8"),
});

export const GcpSecretWriteSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  secretId: z.string().min(1, "Secret ID is required"),
  secretValue: z.string().min(1, "Secret value is required"),
});

export const GcpSecretAccessSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  secretId: z.string().min(1, "Secret ID is required"),
  version: z.string().optional().default("latest"),
});

export const GitHubRepoScopedSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  branch: z.string().optional(),
  path: z.string().optional(),
});

export const GitHubWriteFileSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  branch: z.string().optional(),
  path: z.string().min(1, "File path is required"),
  content: z.string(),
  message: z.string().min(1, "Commit message is required"),
  sha: z.string().optional(),
});

export const GitHubBatchPushSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  branch: z.string().min(1, "Branch is required"),
  message: z.string().min(1, "Commit message is required"),
  files: z.array(z.object({ path: z.string().min(1), content: z.string() })).min(1),
});

export const GitHubDeleteFileSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  owner: z.string().min(1, "Repository owner is required"),
  repo: z.string().min(1, "Repository name is required"),
  branch: z.string().optional(),
  path: z.string().min(1, "File path is required"),
  message: z.string().min(1, "Commit message is required"),
  sha: z.string().min(1, "File SHA is required"),
});

export const GitHubCreateBranchSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  owner: z.string().min(1),
  repo: z.string().min(1),
  newBranch: z.string().min(1),
  fromBranch: z.string().optional(),
});

export const VercelProjectScopedSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  projectId: z.string().min(1, "Vercel project ID is required"),
});

export const VercelUpsertEnvSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  projectId: z.string().min(1, "Vercel project ID is required"),
  key: z.string().min(1, "Environment variable key is required"),
  value: z.string(),
  target: z.array(z.enum(["production", "preview", "development"])).min(1),
  type: z.enum(["encrypted", "plain", "sensitive"]).optional().default("encrypted"),
});

export const VercelDeleteEnvSchema = z.object({
  credentials: IntegrationCredentialsSchema,
  projectId: z.string().min(1),
  envId: z.string().min(1),
});

export const VercelDeploySchema = z.object({
  credentials: IntegrationCredentialsSchema,
  projectId: z.string().optional(),
  name: z.string().min(1, "Deployment project name is required"),
  target: z.enum(["production", "preview"]).optional().default("preview"),
  files: z.array(z.object({ file: z.string().min(1), data: z.string() })).min(1),
});

// Inferred TypeScript types for runtime contracts
export type ValidatedGenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type ValidatedIncomingMessage = z.infer<typeof IncomingMessageSchema>;
export type ValidatedCountTokensRequest = z.infer<typeof CountTokensRequestSchema>;
export type ValidatedTTSRequest = z.infer<typeof TTSRequestSchema>;
export type ValidatedProviderVerifyRequest = z.infer<typeof ProviderVerifyRequestSchema>;

/**
 * Utility to format Zod validation errors into user-friendly diagnostic messages
 */
export function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const fieldPath = issue.path.length > 0 ? `[${issue.path.join(".")}] ` : "";
      return `${fieldPath}${issue.message}`;
    })
    .join("; ");
}
