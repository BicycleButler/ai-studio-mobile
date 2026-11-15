import { PromptConfig, ChatMessage } from "../../types";
import { BaseCodeGenerator } from "./BaseCodeGenerator";
import { CodeLangId } from "./ICodeGeneratorPlugin";

export class PythonGenerator extends BaseCodeGenerator {
  readonly id: CodeLangId = "python";
  readonly name: string = "gemini_app.py";
  readonly language: string = "python";

  generate(config: PromptConfig, messages: ChatMessage[]): string {
    const { promptText, sysInst } = this.extractPromptContext(config, messages);
    const providerId = config.providerId || "google";

    if (providerId === "anthropic") {
      return `import os
import anthropic

client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

message = client.messages.create(
    model="${config.model}",
    max_tokens=${config.maxOutputTokens},
    temperature=${config.temperature},
    ${sysInst ? `system="${sysInst}",\n    ` : ""}messages=[{"role": "user", "content": "${promptText}"}],
)

print(message.content[0].text)
`;
    }

    if (providerId !== "google" && providerId !== "local-webllm" && providerId !== "local-browser") {
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

      return `import os
from openai import OpenAI

client = OpenAI(
    base_url="${baseUrl}",
    api_key=os.environ.get("${envKey}", "local"),
)

response = client.chat.completions.create(
    model="${config.model}",
    messages=[
        ${sysInst ? `{"role": "system", "content": "${sysInst}"},\n        ` : ""}{"role": "user", "content": "${promptText}"},
    ],
    temperature=${config.temperature},
    top_p=${config.topP},
    max_tokens=${config.maxOutputTokens},
)

print(response.choices[0].message.content)
`;
    }

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
}
