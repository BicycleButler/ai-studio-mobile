import { describe, test } from 'vitest';
import {
  GenerateRequestSchema,
  CountTokensRequestSchema,
  formatZodError,
} from "./validation";

describe('testValidationSchemas', () => {
  test('main', () => {
  // 1. Valid generate request
  const validPayload = {
    model: "gemini-3.8-flash",
    messages: [{ role: "user", text: "Hello Gemini" }],
    temperature: 0.7,
    topP: 0.9,
    topK: 40,
  };

  const parsedValid = GenerateRequestSchema.safeParse(validPayload);
  if (!parsedValid.success) {
    throw new Error(`Valid payload failed schema parsing: ${formatZodError(parsedValid.error)}`);
  }

  // 2. Reject empty messages array
  const emptyMessagesPayload = {
    model: "gemini-3.8-flash",
    messages: [],
  };
  const parsedEmpty = GenerateRequestSchema.safeParse(emptyMessagesPayload);
  if (parsedEmpty.success) {
    throw new Error("Schema should reject empty messages array");
  }

  // 3. Reject out-of-range temperature
  const invalidTempPayload = {
    model: "gemini-3.8-flash",
    messages: [{ role: "user", text: "Test" }],
    temperature: 3.5, // Max is 2.0
  };
  const parsedTemp = GenerateRequestSchema.safeParse(invalidTempPayload);
  if (parsedTemp.success) {
    throw new Error("Schema should reject temperature > 2.0");
  }

  // 4. Count tokens schema
  const validCountPayload = {
    model: "gemini-3.8-flash",
    contents: "Sample string to count",
  };
  const parsedCount = CountTokensRequestSchema.safeParse(validCountPayload);
  if (!parsedCount.success) {
    throw new Error("Valid count tokens payload failed schema");
  }


  });
});
