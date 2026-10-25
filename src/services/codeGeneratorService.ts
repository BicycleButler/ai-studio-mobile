import { PromptConfig, ChatMessage } from "../types";
import { ICodeGeneratorPlugin, CodeLangId, PythonGenerator, TypeScriptGenerator, KotlinGenerator, CurlGenerator } from "./codeGenerators";

export type { CodeLangId, ICodeGeneratorPlugin as CodeGenerator };

export interface ICodeGeneratorService {
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

  public getGenerator(id: CodeLangId): ICodeGeneratorPlugin | undefined {
    return this.generators.get(id);
  }

  public getAllGenerators(): ICodeGeneratorPlugin[] {
    return Array.from(this.generators.values());
  }
}

export const defaultCodeGeneratorService = new CodeGeneratorService();
