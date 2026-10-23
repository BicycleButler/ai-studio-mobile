import { PromptConfig, ChatMessage } from "../types";
import { ICodeGeneratorPlugin, CodeLangId, PythonGenerator, TypeScriptGenerator, KotlinGenerator, CurlGenerator } from "./codeGenerators";

export type { CodeLangId, ICodeGeneratorPlugin as CodeGenerator };

export interface ICodeGeneratorService {
  escapeStringForCode(str: string): string;
  extractPromptContext(config: PromptConfig, messages: ChatMessage[]): { promptText: string; sysInst: string };
  generatePythonCode(config: PromptConfig, messages: ChatMessage[]): string;
  generateTypeScriptCode(config: PromptConfig, messages: ChatMessage[]): string;
  generateAndroidKotlinCode(config: PromptConfig, messages: ChatMessage[]): string;
  generateCurlCode(config: PromptConfig, messages: ChatMessage[]): string;
  getGenerator(id: CodeLangId): ICodeGeneratorPlugin | undefined;
  getAllGenerators(): ICodeGeneratorPlugin[];
  registerGenerator(generator: ICodeGeneratorPlugin): void;
}

export interface CodeGeneratorServiceConfig {
    generators?: ICodeGeneratorPlugin[];
}

export class CodeGeneratorService implements ICodeGeneratorService {
  private generators: Map<CodeLangId, ICodeGeneratorPlugin>;

  constructor(config?: CodeGeneratorServiceConfig) {
    this.generators = new Map();
    const defaultGenerators = config?.generators || [
        new KotlinGenerator(),
        new TypeScriptGenerator(),
        new PythonGenerator(),
        new CurlGenerator()
    ];
    for (const gen of defaultGenerators) {
        this.registerGenerator(gen);
    }
  }

  public registerGenerator(generator: ICodeGeneratorPlugin): void {
      this.generators.set(generator.id, generator);
  }

  // Keeping these methods for backwards compatibility but delegating.
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
    return this.getGenerator("python")!.generate(config, messages);
  }

  public generateTypeScriptCode(config: PromptConfig, messages: ChatMessage[]): string {
    return this.getGenerator("typescript")!.generate(config, messages);
  }

  public generateAndroidKotlinCode(config: PromptConfig, messages: ChatMessage[]): string {
    return this.getGenerator("kotlin")!.generate(config, messages);
  }

  public generateCurlCode(config: PromptConfig, messages: ChatMessage[]): string {
    return this.getGenerator("curl")!.generate(config, messages);
  }

  public getGenerator(id: CodeLangId): ICodeGeneratorPlugin | undefined {
    return this.generators.get(id);
  }

  public getAllGenerators(): ICodeGeneratorPlugin[] {
    return Array.from(this.generators.values());
  }
}

export const defaultCodeGeneratorService = new CodeGeneratorService();
