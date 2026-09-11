// Test suite for code generators
import { PromptConfig, ChatMessage } from "../types";
import {
  generateAndroidKotlinCode,
  generatePythonCode,
  generateTypeScriptCode,
  generateCurlCode,
} from "./codeGenerators";

// Verification that explicit 'any' is permitted in test files
const mockConfig: PromptConfig = {
  model: "gemini-3.8-flash",
  systemInstruction: "You are an expert mobile Android engineer.",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxOutputTokens: 2048,
  responseMimeType: "text/plain",
  responseSchemaText: "",
};

const mockMessages: ChatMessage[] = [
  {
    id: "msg-1",
    role: "user",
    text: "How do I optimize Jetpack Compose on Android?",
    timestamp: Date.now(),
  },
];

// In test files, loose assertion / mock objects with 'any' are permitted and often required:
const testMockPayload: any = {
  dynamicProperty: "test-property-allowed-in-test-files",
};

export function testGenerators(): boolean {
  if (!testMockPayload) return false;

  const kotlin = generateAndroidKotlinCode(mockConfig, mockMessages);
  if (!kotlin.includes("com.google.ai.client.generativeai")) {
    throw new Error("Kotlin code missing generativeai import");
  }

  const python = generatePythonCode(mockConfig, mockMessages);
  if (!python.includes("from google import genai")) {
    throw new Error("Python code missing google.genai import");
  }

  const ts = generateTypeScriptCode(mockConfig, mockMessages);
  if (!ts.includes("@google/genai")) {
    throw new Error("TypeScript code missing @google/genai import");
  }

  const curl = generateCurlCode(mockConfig, mockMessages);
  if (!curl.includes("generativelanguage.googleapis.com")) {
    throw new Error("cURL command missing endpoint URL");
  }

  return true;
}
