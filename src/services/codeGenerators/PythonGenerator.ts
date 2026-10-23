import { PromptConfig, ChatMessage } from "../../types";
import { BaseCodeGenerator } from "./BaseCodeGenerator";
import { CodeLangId } from "./ICodeGeneratorPlugin";

export class PythonGenerator extends BaseCodeGenerator {
  readonly id: CodeLangId = "python";
  readonly name: string = "gemini_app.py";
  readonly language: string = "python";

  generate(config: PromptConfig, messages: ChatMessage[]): string {
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
}
