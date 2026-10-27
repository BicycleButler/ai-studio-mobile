import { PromptTemplate, ComposePromptPayload, PromptTemplateCategory } from "../types";
import { STORAGE_KEYS, StorageCollection } from "../utils/storage";
import { IMutableCollection } from "../utils/storage/types";
import { generateUniqueId } from "../utils/idGenerator";

export interface IPromptTemplateService {
  getBuiltinTemplates(): PromptTemplate[];
  getCustomTemplates(): PromptTemplate[];
  getAllTemplates(): PromptTemplate[];
  getTemplateById(id: string): PromptTemplate | undefined;
  saveCustomTemplate(data: { id?: string; title: string; description?: string; content: string; category: PromptTemplateCategory }): PromptTemplate;
  deleteCustomTemplate(id: string): boolean;
  bulkDeleteCustomTemplates(ids: string[]): boolean;
  clearCustomTemplates(): void;
  composePrompt(selectedTemplateIds: string[], userText: string): ComposePromptPayload;
}

export const BUILTIN_PROMPT_TEMPLATES: PromptTemplate[] = [
  {
    id: "concise-direct",
    title: "Concise & Direct",
    category: "tone",
    description: "Brief, high-signal responses without conversational filler or pleasantries",
    content: "Respond concisely and directly without conversational filler or pleasantries. Focus on high-signal, actionable answers.",
    isBuiltin: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "staff-engineer",
    title: "Staff Code Engineer",
    category: "coding",
    description: "Production-grade, robust, fully-typed TypeScript and modern Kotlin",
    content: "You are an expert Google staff software engineer. Write clean, production-grade, fully-typed TypeScript and modern Kotlin. Prioritize correctness, edge cases, and performance.",
    isBuiltin: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "step-by-step",
    title: "Step-by-Step Reasoner",
    category: "reasoning",
    description: "Methodical breakdown and reasoning prior to conclusions",
    content: "Think through this problem methodically step-by-step. Break down your reasoning before presenting the final conclusion.",
    isBuiltin: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "valid-json",
    title: "Valid JSON Output",
    category: "formatting",
    description: "Strict raw JSON syntax without markdown ticks or preamble",
    content: "Format your response strictly as valid, raw JSON conforming to standard syntax. Do not include markdown code ticks, preamble, or trailing commentary.",
    isBuiltin: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "security-auditor",
    title: "Security & Edge-Case Auditor",
    category: "analysis",
    description: "Audit code and plans for vulnerabilities, edge cases, and hazards",
    content: "Critically analyze the provided solution for security vulnerabilities, edge-case failures, concurrency hazards, and input sanitization gaps.",
    isBuiltin: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
  {
    id: "simple-intuitive",
    title: "Simple & Intuitive (ELI5)",
    category: "tone",
    description: "Accessible concepts explained using intuitive real-world analogies",
    content: "Explain the concept in simple, accessible language using intuitive real-world analogies. Avoid unnecessary technical jargon.",
    isBuiltin: true,
    createdAt: 1700000000000,
    updatedAt: 1700000000000,
  },
];

export interface PromptTemplateServiceConfig {
  builtinTemplates?: PromptTemplate[];
  customTemplatesCollection?: IMutableCollection<PromptTemplate>;
}

export class PromptTemplateService implements IPromptTemplateService {
  private customTemplatesCollection: IMutableCollection<PromptTemplate>;
  private builtinTemplates: PromptTemplate[];

  constructor(config: PromptTemplateServiceConfig) {
    this.builtinTemplates = config?.builtinTemplates || BUILTIN_PROMPT_TEMPLATES;
    this.customTemplatesCollection = config?.customTemplatesCollection || new StorageCollection<PromptTemplate>(STORAGE_KEYS.CUSTOM_PROMPT_TEMPLATES);
  }

  public getBuiltinTemplates(): PromptTemplate[] {
    return [...this.builtinTemplates];
  }

  public getCustomTemplates(): PromptTemplate[] {
    return this.customTemplatesCollection.load();
  }

  public getAllTemplates(): PromptTemplate[] {
    const builtin = this.getBuiltinTemplates();
    const custom = this.getCustomTemplates();
    return [...builtin, ...custom];
  }

  public getTemplateById(id: string): PromptTemplate | undefined {
    return this.getAllTemplates().find((t) => t.id === id);
  }

  public saveCustomTemplate(data: {
    id?: string;
    title: string;
    description?: string;
    content: string;
    category: PromptTemplateCategory;
  }): PromptTemplate {
    const title = data.title.trim();
    const content = data.content.trim();
    const description = data.description?.trim();

    if (!title) {
      throw new Error("Template title is required");
    }
    if (!content) {
      throw new Error("Template content is required");
    }

    const now = Date.now();
    const id = data.id || generateUniqueId("custom_tpl");

    // Find if it exists to preserve createdAt
    const existing = this.customTemplatesCollection.load().find((t) => t.id === id);

    const savedTemplate: PromptTemplate = {
      id,
      title,
      description,
      content,
      category: data.category || "custom",
      isBuiltin: false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.customTemplatesCollection.upsert(savedTemplate, false);

    return savedTemplate;
  }

  public deleteCustomTemplate(id: string): boolean {
    // Built-in templates cannot be deleted
    if (this.builtinTemplates.some((t) => t.id === id)) {
      return false;
    }

    const itemsBefore = this.customTemplatesCollection.load().length;
    this.customTemplatesCollection.delete(id);
    const itemsAfter = this.customTemplatesCollection.load().length;

    return itemsAfter !== itemsBefore;
  }

  public bulkDeleteCustomTemplates(ids: string[]): boolean {
    if (!ids || ids.length === 0) return false;

    const itemsBefore = this.customTemplatesCollection.load().length;
    // Built-ins shouldn't be in this collection anyway
    const filtered = this.customTemplatesCollection.bulkDelete(ids);

    return filtered.length !== itemsBefore;
  }

  public clearCustomTemplates(): void {
    this.customTemplatesCollection.clear();
  }

  /**
   * Question 3 Decision: Clean Double-Newline Separation
   * All selected templates precede the user's manual text in exact selection order:
   * [Template 1 Content]
   *
   * [Template 2 Content]
   *
   * [User's handwritten text]
   *
   * No artificial markdown block delimiters (such as --- dividers) are introduced
   * unless explicitly included in template content.
   */
  public composePrompt(
    selectedTemplateIds: string[],
    userText: string
  ): ComposePromptPayload {
    const allTemplates = this.getAllTemplates();
    const templateMap = new Map<string, PromptTemplate>();
    for (const t of allTemplates) {
      templateMap.set(t.id, t);
    }

    const validTemplateIds: string[] = [];
    const parts: string[] = [];

    for (const id of selectedTemplateIds) {
      const tpl = templateMap.get(id);
      if (tpl && tpl.content.trim()) {
        validTemplateIds.push(id);
        parts.push(tpl.content.trim());
      }
    }

    const trimmedUserText = userText.trim();
    if (trimmedUserText) {
      parts.push(trimmedUserText);
    }

    const combinedText = parts.join("\n\n");

    return {
      combinedText,
      templateIds: validTemplateIds,
      userText: trimmedUserText,
    };
  }
}

export const defaultPromptTemplateService = new PromptTemplateService({});
