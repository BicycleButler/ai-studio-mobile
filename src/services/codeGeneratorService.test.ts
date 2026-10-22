// Test suite for code generators
import { PromptConfig, ChatMessage } from "../types";
import { CODE_GENERATORS } from "./codeGeneratorService";

// Verification that explicit 'any' is permitted in test files
const mockConfig: PromptConfig = {
  model: "gemini-2.5-flash",
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

import { describe, test, expect } from 'vitest';

describe('codeGenerators', () => {
  test('testGenerators', () => {
    expect(testMockPayload).toBeTruthy();

    const kotlin = CODE_GENERATORS.kotlin.generate(mockConfig, mockMessages);
    expect(kotlin).toContain("com.google.ai.client.generativeai");

    const python = CODE_GENERATORS.python.generate(mockConfig, mockMessages);
    expect(python).toContain("from google import genai");

    const ts = CODE_GENERATORS.typescript.generate(mockConfig, mockMessages);
    expect(ts).toContain("@google/genai");

    const curl = CODE_GENERATORS.curl.generate(mockConfig, mockMessages);
    expect(curl).toContain("generativelanguage.googleapis.com");
  });
});
