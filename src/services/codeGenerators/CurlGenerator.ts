import { PromptConfig, ChatMessage } from "../../types";
import { BaseCodeGenerator } from "./BaseCodeGenerator";
import { CodeLangId } from "./ICodeGeneratorPlugin";

export class CurlGenerator extends BaseCodeGenerator {
  readonly id: CodeLangId = "curl";
  readonly name: string = "curl_request.sh";
  readonly language: string = "bash";

  generate(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText, sysInst } = this.extractPromptContext(config, messages);
    const providerId = config.providerId || "google";

    if (providerId === "anthropic") {
      return `curl "https://api.anthropic.com/v1/messages" \\
  -H "x-api-key: \${ANTHROPIC_API_KEY}" \\
  -H "anthropic-version: 2023-06-01" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    "model": "${config.model}",
    "max_tokens": ${config.maxOutputTokens},
    "temperature": ${config.temperature},
    ${sysInst ? `"system": "${sysInst}",\n    ` : ""}"messages": [{"role": "user", "content": "${promptText}"}]
  }'
`;
    }

    if (providerId !== "google" && providerId !== "local-webllm" && providerId !== "local-browser") {
      const endpoints: Record<string, string> = {
        openai: "https://api.openai.com/v1/chat/completions",
        openrouter: "https://openrouter.ai/api/v1/chat/completions",
        groq: "https://api.groq.com/openai/v1/chat/completions",
        "local-ollama": "http://localhost:11434/v1/chat/completions",
        "openai-compatible": "https://your-endpoint.example.com/v1/chat/completions",
      };
      const envKeys: Record<string, string> = {
        openai: "OPENAI_API_KEY",
        openrouter: "OPENROUTER_API_KEY",
        groq: "GROQ_API_KEY",
        "local-ollama": "OLLAMA_API_KEY",
        "openai-compatible": "PROVIDER_API_KEY",
      };
      const url = endpoints[providerId] || "https://api.openai.com/v1/chat/completions";
      const envKey = envKeys[providerId] || "PROVIDER_API_KEY";

      return `curl "${url}" \\
  -H "Authorization: Bearer \${${envKey}}" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    "model": "${config.model}",
    "messages": [
      ${sysInst ? `{"role": "system", "content": "${sysInst}"},\n      ` : ""}{"role": "user", "content": "${promptText}"}
    ],
    "temperature": ${config.temperature},
    "top_p": ${config.topP},
    "max_tokens": ${config.maxOutputTokens}
  }'
`;
    }

    return `curl "https://generativelanguage.googleapis.com/v1beta/models/${config.model}:generateContent?key=\${GEMINI_API_KEY}" \\
  -H "Content-Type: application/json" \\
  -X POST \\
  -d '{
    ${sysInst ? `"systemInstruction": { "parts": [{ "text": "${sysInst}" }] },\n    ` : ""}"contents": [{
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
}
