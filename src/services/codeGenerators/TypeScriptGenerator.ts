import { PromptConfig, ChatMessage } from "../../types";
import { BaseCodeGenerator } from "./BaseCodeGenerator";
import { CodeLangId } from "./ICodeGeneratorPlugin";

export class TypeScriptGenerator extends BaseCodeGenerator {
  readonly id: CodeLangId = "typescript";
  readonly name: string = "gemini_service.ts";
  readonly language: string = "typescript";

  generate(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText, sysInst } = this.extractPromptContext(config, messages);
    const providerId = config.providerId || "google";

    if (providerId === "anthropic") {
      return `import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

async function main() {
  const message = await client.messages.create({
    model: "${config.model}",
    max_tokens: ${config.maxOutputTokens},
    temperature: ${config.temperature},
    ${sysInst ? `system: "${sysInst}",\n    ` : ""}messages: [{ role: "user", content: "${promptText}" }],
  });

  console.log(message.content);
}

main();
`;
    }

    if (providerId === "local-webllm") {
      return `import { CreateMLCEngine } from "@mlc-ai/web-llm";

async function main() {
  const engine = await CreateMLCEngine("${config.model}");
  const reply = await engine.chat.completions.create({
    messages: [
      ${sysInst ? `{ role: "system", content: "${sysInst}" },\n      ` : ""}{ role: "user", content: "${promptText}" },
    ],
    temperature: ${config.temperature},
    top_p: ${config.topP},
    max_tokens: ${config.maxOutputTokens},
  });

  console.log(reply.choices[0]?.message?.content);
}

main();
`;
    }

    if (providerId === "local-browser") {
      return `// Chrome Built-in AI (Prompt API)
async function main() {
  const session = await window.LanguageModel.create({
    ${sysInst ? `systemPrompt: "${sysInst}",\n    ` : ""}temperature: ${config.temperature},
  });
  const result = await session.prompt("${promptText}");
  console.log(result);
}

main();
`;
    }

    if (providerId !== "google") {
      const baseUrls: Record<string, string> = {
        openai: "https://api.openai.com/v1",
        openrouter: "https://openrouter.ai/api/v1",
        groq: "https://api.groq.com/openai/v1",
        "local-ollama": "http://localhost:11434/v1",
        "openai-compatible": "https://your-endpoint.example.com/v1",
      };
      const envKeys: Record<string, string> = {
        openai: "OPENAI_API_KEY",
        openrouter: "OPENROUTER_API_KEY",
        groq: "GROQ_API_KEY",
        "local-ollama": "OLLAMA_API_KEY",
        "openai-compatible": "PROVIDER_API_KEY",
      };
      const baseUrl = baseUrls[providerId] || "https://api.openai.com/v1";
      const envKey = envKeys[providerId] || "PROVIDER_API_KEY";

      return `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${baseUrl}",
  apiKey: process.env.${envKey} || "local",
});

async function main() {
  const completion = await client.chat.completions.create({
    model: "${config.model}",
    messages: [
      ${sysInst ? `{ role: "system", content: "${sysInst}" },\n      ` : ""}{ role: "user", content: "${promptText}" },
    ],
    temperature: ${config.temperature},
    top_p: ${config.topP},
    max_tokens: ${config.maxOutputTokens},
    ${config.responseMimeType === "application/json" ? `response_format: { type: "json_object" },\n    ` : ""}
  });

  console.log(completion.choices[0]?.message?.content);
}

main();
`;
    }

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
}
