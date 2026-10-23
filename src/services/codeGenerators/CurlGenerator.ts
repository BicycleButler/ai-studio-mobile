import { PromptConfig, ChatMessage } from "../../types";
import { BaseCodeGenerator } from "./BaseCodeGenerator";
import { CodeLangId } from "./ICodeGeneratorPlugin";

export class CurlGenerator extends BaseCodeGenerator {
  readonly id: CodeLangId = "curl";
  readonly name: string = "curl_request.sh";
  readonly language: string = "bash";

  generate(config: PromptConfig, messages: ChatMessage[]): string {
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
}
