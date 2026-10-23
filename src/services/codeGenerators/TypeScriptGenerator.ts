import { PromptConfig, ChatMessage } from "../../types";
import { BaseCodeGenerator } from "./BaseCodeGenerator";
import { CodeLangId } from "./ICodeGeneratorPlugin";

export class TypeScriptGenerator extends BaseCodeGenerator {
  readonly id: CodeLangId = "typescript";
  readonly name: string = "gemini_service.ts";
  readonly language: string = "typescript";

  generate(config: PromptConfig, messages: ChatMessage[]): string {
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
}
