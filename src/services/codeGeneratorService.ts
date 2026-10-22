import { PromptConfig, ChatMessage } from "../types";

export type CodeLangId = "kotlin" | "python" | "typescript" | "curl";

export interface CodeGenerator {
  id: CodeLangId;
  name: string;
  language: string; // Used for syntax highlighting (e.g., 'bash', 'python')
  generate: (config: PromptConfig, messages: ChatMessage[]) => string;
}

export interface ICodeGeneratorService {
  escapeStringForCode(str: string): string;
  extractPromptContext(config: PromptConfig, messages: ChatMessage[]): { promptText: string; sysInst: string };
  generatePythonCode(config: PromptConfig, messages: ChatMessage[]): string;
  generateTypeScriptCode(config: PromptConfig, messages: ChatMessage[]): string;
  generateAndroidKotlinCode(config: PromptConfig, messages: ChatMessage[]): string;
  generateCurlCode(config: PromptConfig, messages: ChatMessage[]): string;
  getGenerator(id: CodeLangId): CodeGenerator | undefined;
  getAllGenerators(): CodeGenerator[];
}

export class CodeGeneratorService implements ICodeGeneratorService {

  public escapeStringForCode(str: string): string {
    if (!str) return "";
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  public extractPromptContext(config: PromptConfig, messages: ChatMessage[]): { promptText: string; sysInst: string } {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const promptText = this.escapeStringForCode(lastUserMsg?.text || "Hello Gemini!");
    const sysInst = config.systemInstruction ? this.escapeStringForCode(config.systemInstruction) : "";
    return { promptText, sysInst };
  }

  public generatePythonCode(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText, sysInst } = this.extractPromptContext(config, messages);

    return `import os
from google import genai
from google.genai import types

# Initialize client (uses GEMINI_API_KEY from environment)
client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))

response = client.models.generate_content(
    model="${config.model}",
    contents="${promptText}",
    config=types.GenerateContentConfig(
        ${sysInst ? `system_instruction="${sysInst}",\n        ` : ""}temperature=${config.temperature},
        top_p=${config.topP},
        top_k=${config.topK},
        max_output_tokens=${config.maxOutputTokens},
        ${config.responseMimeType === "application/json" ? `response_mime_type="application/json",\n        ` : ""}
    ),
)

print(response.text)
`;
  }

  public generateTypeScriptCode(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText, sysInst } = this.extractPromptContext(config, messages);

    return `import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

async function main() {
  const response = await ai.models.generateContent({
    model: "${config.model}",
    contents: "${promptText}",
    config: {
      ${sysInst ? `systemInstruction: "${sysInst}",\n      ` : ""}temperature: ${config.temperature},
      topP: ${config.topP},
      topK: ${config.topK},
      maxOutputTokens: ${config.maxOutputTokens},
      ${config.responseMimeType === "application/json" ? `responseMimeType: "application/json",\n      ` : ""}
    },
  });

  console.log(response.text);
}

main();
`;
  }

  public generateAndroidKotlinCode(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText, sysInst } = this.extractPromptContext(config, messages);

    return `// In your Android app build.gradle.kts:
// implementation("com.google.ai.client.generativeai:generativeai:0.9.0")

package com.example.aistudio

import com.google.ai.client.generativeai.GenerativeModel
import com.google.ai.client.generativeai.type.generationConfig
import kotlinx.coroutines.runBlocking

fun main() {
    val config = generationConfig {
        temperature = ${config.temperature}f
        topP = ${config.topP}f
        topK = ${config.topK}
        maxOutputTokens = ${config.maxOutputTokens}
    }

    val generativeModel = GenerativeModel(
        modelName = "${config.model}",
        apiKey = BuildConfig.GEMINI_API_KEY,
        generationConfig = config,
        ${sysInst ? `systemInstruction = content { text("${sysInst}") }\n    ` : ""}
    )

    runBlocking {
        val response = generativeModel.generateContent("${promptText}")
        println(response.text)
    }
}
`;
  }

  public generateCurlCode(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText } = this.extractPromptContext(config, messages);

    return `curl "https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=\${GEMINI_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    "contents": [{
      "parts": [{"text": "${promptText}"}]
    }],
    "generationConfig": {
      "temperature": ${config.temperature},
      "topP": ${config.topP},
      "topK": ${config.topK},
      "maxOutputTokens": ${config.maxOutputTokens}
    }
  }'
`;
  }

  private generators: Record<CodeLangId, CodeGenerator> = {
    kotlin: {
      id: "kotlin",
      name: "MainActivity.kt",
      language: "kotlin",
      generate: (config, messages) => this.generateAndroidKotlinCode(config, messages),
    },
    typescript: {
      id: "typescript",
      name: "gemini_service.ts",
      language: "typescript",
      generate: (config, messages) => this.generateTypeScriptCode(config, messages),
    },
    python: {
      id: "python",
      name: "gemini_app.py",
      language: "python",
      generate: (config, messages) => this.generatePythonCode(config, messages),
    },
    curl: {
      id: "curl",
      name: "curl_request.sh",
      language: "bash",
      generate: (config, messages) => this.generateCurlCode(config, messages),
    },
  };

  public getGenerator(id: CodeLangId): CodeGenerator | undefined {
    return this.generators[id];
  }

  public getAllGenerators(): CodeGenerator[] {
    return Object.values(this.generators);
  }
}

export const defaultCodeGeneratorService = new CodeGeneratorService();

// Proxy functions for backward compatibility
export function escapeStringForCode(str: string): string {
  return defaultCodeGeneratorService.escapeStringForCode(str);
}

export function extractPromptContext(config: PromptConfig, messages: ChatMessage[]): { promptText: string; sysInst: string } {
  return defaultCodeGeneratorService.extractPromptContext(config, messages);
}

export function generatePythonCode(config: PromptConfig, messages: ChatMessage[]): string {
  return defaultCodeGeneratorService.generatePythonCode(config, messages);
}

export function generateTypeScriptCode(config: PromptConfig, messages: ChatMessage[]): string {
  return defaultCodeGeneratorService.generateTypeScriptCode(config, messages);
}

export function generateAndroidKotlinCode(config: PromptConfig, messages: ChatMessage[]): string {
  return defaultCodeGeneratorService.generateAndroidKotlinCode(config, messages);
}

export function generateCurlCode(config: PromptConfig, messages: ChatMessage[]): string {
  return defaultCodeGeneratorService.generateCurlCode(config, messages);
}

export const CODE_GENERATORS = new Proxy({} as Record<CodeLangId, CodeGenerator>, {
  get: (target, prop) => defaultCodeGeneratorService.getGenerator(prop as CodeLangId),
  ownKeys: () => Object.keys(defaultCodeGeneratorService.getAllGenerators().reduce((acc, curr) => ({...acc, [curr.id]: curr}), {})),
  getOwnPropertyDescriptor: (target, prop) => ({
    enumerable: true,
    configurable: true,
    value: defaultCodeGeneratorService.getGenerator(prop as CodeLangId)
  })
});
