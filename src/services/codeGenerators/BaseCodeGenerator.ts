import { PromptConfig, ChatMessage } from "../../types";
import { ICodeGeneratorPlugin, CodeLangId } from "./ICodeGeneratorPlugin";

export abstract class BaseCodeGenerator implements ICodeGeneratorPlugin {
  abstract readonly id: CodeLangId;
  abstract readonly name: string;
  abstract readonly language: string;

  protected escapeStringForCode(str: string): string {
    if (!str) return "";
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
  }

  protected extractPromptContext(config: PromptConfig, messages: ChatMessage[]): { promptText: string; sysInst: string } {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    const promptText = this.escapeStringForCode(lastUserMsg?.text || "Hello Gemini!");
    const sysInst = config.systemInstruction ? this.escapeStringForCode(config.systemInstruction) : "";
    return { promptText, sysInst };
  }

  abstract generate(config: PromptConfig, messages: ChatMessage[]): string;
}
