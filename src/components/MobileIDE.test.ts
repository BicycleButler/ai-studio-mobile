import { describe, test } from 'vitest';
import { PromptConfig, ChatMessage, PromptType } from "../types";
import { CodeGeneratorService } from "../services/codeGeneratorService";
import { KotlinGenerator, TypeScriptGenerator, PythonGenerator, CurlGenerator } from "../services/codeGenerators";
const testCodeGeneratorService = new CodeGeneratorService({ generators: [new KotlinGenerator(), new TypeScriptGenerator(), new PythonGenerator(), new CurlGenerator()] });

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

describe('testMobileIDEAndPromptModes', () => {
  test('main', () => {
  // Test 1: Validate PromptType union values
  const validModes: PromptType[] = ["chat", "code", "jules", "stubs"];
  assert(validModes.includes("code"), "PromptType must support 'code'");
  assert(validModes.length === 4, "PromptType must support 4 distinct prompt modes");

  // Test 2: Code generators properly populate from config & messages
  const sampleConfig: PromptConfig = {
    model: "gemini-2.5-flash",
    systemInstruction: "You are a professional Android and TypeScript engineer.",
    temperature: 0.7,
    topP: 0.9,
    topK: 30,
    maxOutputTokens: 1024,
    responseMimeType: "text/plain",
    responseSchemaText: "",
  };

  const sampleMessages: ChatMessage[] = [
    {
      id: "msg-1",
      role: "user",
      text: "Show me how to build a reactive stream in Kotlin",
      timestamp: 1620000000000,
    },
  ];

  const kotlinCode = testCodeGeneratorService.getGenerator("kotlin")!.generate(sampleConfig, sampleMessages);
  assert(kotlinCode.includes("gemini-2.5-flash"), "Kotlin code should contain the configured model");
  assert(kotlinCode.includes("GenerativeModel"), "Kotlin code should import GenerativeModel");
  assert(kotlinCode.includes("reactive stream"), "Kotlin code should contain the prompt contents");

  const tsCode = testCodeGeneratorService.getGenerator("typescript")!.generate(sampleConfig, sampleMessages);
  assert(tsCode.includes("@google/genai"), "TypeScript code should use @google/genai SDK");
  assert(tsCode.includes("generateContent"), "TypeScript code should call generateContent");
  assert(tsCode.includes("gemini-2.5-flash"), "TypeScript code should use specified model");

  const pyCode = testCodeGeneratorService.getGenerator("python")!.generate(sampleConfig, sampleMessages);
  assert(pyCode.includes("google.genai"), "Python code should use google.genai SDK");
  assert(pyCode.includes("client.models.generate_content"), "Python code should generate content");

  const curlCode = testCodeGeneratorService.getGenerator("curl")!.generate(sampleConfig, sampleMessages);
  assert(curlCode.includes("curl \"https://generativelanguage.googleapis.com"), "cURL should have correct endpoint");
  assert(curlCode.includes("gemini-2.5-flash:generateContent"), "cURL should target configured model");


  });
});
