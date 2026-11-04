import { defaultTimeProvider } from "../utils/timeProvider";
import { SavedPrompt } from "../types";

export const DEFAULT_CONFIG = {
  model: "gemini-2.5-flash",
  systemInstruction: "You are an intelligent, precise AI assistant inside Google AI Studio. Provide concise, clear, and actionable responses with clean code blocks when relevant.",
  temperature: 1.0,
  topP: 0.95,
  topK: 40,
  maxOutputTokens: 2048,
  responseMimeType: "text/plain" as const,
  responseSchemaText: "",
};

export const getStarterTemplates = (timeProvider = defaultTimeProvider): SavedPrompt[] => [
  {
    id: "template-chat-code",
    title: "Full-Stack Code Assistant",
    type: "chat",
    config: {
      ...DEFAULT_CONFIG,
      temperature: 0.2,
      systemInstruction: "You are an expert Google staff software engineer. Write clean, idiomatic, fully-typed TypeScript and modern Android Kotlin. Always prioritize correctness, security, and edge-case handling.",
    },
    messages: [],
    updatedAt: timeProvider.now(),
    tags: ["Coding", "Android", "Kotlin"],
  },
  {
    id: "template-structured-json",
    title: "Receipt & Invoice JSON Extractor",
    type: "chat",
    config: {
      ...DEFAULT_CONFIG,
      temperature: 0.1,
      responseMimeType: "application/json",
      systemInstruction: "Extract vendor, date, line items, and totals from receipt text into structured JSON matching the provided schema.",
      responseSchemaText: JSON.stringify(
        {
          type: "object",
          properties: {
            vendor: { type: "string" },
            date: { type: "string" },
            currency: { type: "string" },
            totalAmount: { type: "number" },
            lineItems: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  item: { type: "string" },
                  price: { type: "number" },
                  quantity: { type: "integer" },
                },
                required: ["item", "price"],
              },
            },
          },
          required: ["vendor", "totalAmount", "lineItems"],
        },
        null,
        2
      ),
    },
    messages: [],
    updatedAt: timeProvider.now(),
    tags: ["JSON", "Schema", "Extraction"],
  },
  {
    id: "template-multimodal-vision",
    title: "Mobile Vision & UI Wireframe Analyzer",
    type: "chat",
    config: {
      ...DEFAULT_CONFIG,
      temperature: 0.4,
      systemInstruction: "You are a senior UI/UX designer and mobile developer. Analyze screenshots, wireframes, and UI mockups. Identify layout hierarchy, accessibility contrast flaws, touch target issues, and provide Tailwind CSS or Compose code.",
    },
    messages: [],
    updatedAt: timeProvider.now(),
    tags: ["UX", "Design", "Vision"],
  },
];
