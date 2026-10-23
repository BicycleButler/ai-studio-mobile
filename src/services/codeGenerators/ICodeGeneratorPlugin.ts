import { PromptConfig, ChatMessage } from "../../types";

export type CodeLangId = "kotlin" | "python" | "typescript" | "curl" | (string & {});

export interface ICodeGeneratorPlugin {
  readonly id: CodeLangId;
  readonly name: string;
  readonly language: string;
  generate(config: PromptConfig, messages: ChatMessage[]): string;
}
