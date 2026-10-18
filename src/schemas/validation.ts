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

// Schema for /api/generate request payload
export const GenerateRequestSchema = z.object({
  model: z.string().min(1).default("gemini-2.5-flash"),
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

// Inferred TypeScript types for runtime contracts
export type ValidatedGenerateRequest = z.infer<typeof GenerateRequestSchema>;
export type ValidatedIncomingMessage = z.infer<typeof IncomingMessageSchema>;
export type ValidatedCountTokensRequest = z.infer<typeof CountTokensRequestSchema>;
export type ValidatedTTSRequest = z.infer<typeof TTSRequestSchema>;

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
