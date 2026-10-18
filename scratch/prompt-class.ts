export class PromptTemplateService implements IPromptTemplateService {
  private customTemplatesCollection = new StorageCollection<PromptTemplate>(STORAGE_KEYS.CUSTOM_PROMPT_TEMPLATES);

  public getBuiltinTemplates(): PromptTemplate[] {
    return [...BUILTIN_PROMPT_TEMPLATES];
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
    if (BUILTIN_PROMPT_TEMPLATES.some((t) => t.id === id)) {
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

export const defaultPromptTemplateService = new PromptTemplateService();

export function getBuiltinTemplates(): PromptTemplate[] { return defaultPromptTemplateService.getBuiltinTemplates(); }
export function getCustomTemplates(): PromptTemplate[] { return defaultPromptTemplateService.getCustomTemplates(); }
export function getAllTemplates(): PromptTemplate[] { return defaultPromptTemplateService.getAllTemplates(); }
export function getTemplateById(id: string): PromptTemplate | undefined { return defaultPromptTemplateService.getTemplateById(id); }
export function saveCustomTemplate(data: { id?: string; title: string; description?: string; content: string; category: PromptTemplateCategory }): PromptTemplate { return defaultPromptTemplateService.saveCustomTemplate(data); }
export function deleteCustomTemplate(id: string): boolean { return defaultPromptTemplateService.deleteCustomTemplate(id); }
export function bulkDeleteCustomTemplates(ids: string[]): boolean { return defaultPromptTemplateService.bulkDeleteCustomTemplates(ids); }
export function clearCustomTemplates(): void { return defaultPromptTemplateService.clearCustomTemplates(); }
export function composePrompt(selectedTemplateIds: string[], userText: string): ComposePromptPayload { return defaultPromptTemplateService.composePrompt(selectedTemplateIds, userText); }
