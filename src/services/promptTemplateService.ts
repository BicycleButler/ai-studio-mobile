import { PromptTemplate, ComposePromptPayload, PromptTemplateCategory } from "../types";
import { safeRemoveStorage, STORAGE_KEYS, StorageCollection } from "../utils/storage";

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

export function getBuiltinTemplates(): PromptTemplate[] {
  return [...BUILTIN_PROMPT_TEMPLATES];
}

const customTemplatesCollection = new StorageCollection<PromptTemplate>(STORAGE_KEYS.CUSTOM_PROMPT_TEMPLATES);

export function getCustomTemplates(): PromptTemplate[] {
  return customTemplatesCollection.load();
}

export function getAllTemplates(): PromptTemplate[] {
  const builtin = getBuiltinTemplates();
  const custom = getCustomTemplates();
  return [...builtin, ...custom];
}

export function getTemplateById(id: string): PromptTemplate | undefined {
  return getAllTemplates().find((t) => t.id === id);
}

export function saveCustomTemplate(data: {
  id?: string;
  title: string;
  description?: string;
  content: string;
  category: PromptTemplateCategory;
}): PromptTemplate {
  if (!data.title.trim()) {
    throw new Error("Template title is required");
  }
  if (!data.content.trim()) {
    throw new Error("Template content is required");
  }

  const now = Date.now();
  const id = data.id || `custom_tpl_${now}_${Math.random().toString(36).substring(2, 7)}`;

  // Find if it exists to preserve createdAt
  const existing = customTemplatesCollection.load().find((t) => t.id === id);

  const savedTemplate: PromptTemplate = {
    id,
    title: data.title.trim(),
    description: data.description?.trim(),
    content: data.content.trim(),
    category: data.category || "custom",
    isBuiltin: false,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };

  customTemplatesCollection.upsert(savedTemplate, false);

  return savedTemplate;
}

export function deleteCustomTemplate(id: string): boolean {
  // Built-in templates cannot be deleted
  if (BUILTIN_PROMPT_TEMPLATES.some((t) => t.id === id)) {
    return false;
  }

  const itemsBefore = customTemplatesCollection.load().length;
  customTemplatesCollection.delete(id);
  const itemsAfter = customTemplatesCollection.load().length;

  return itemsAfter !== itemsBefore;
}

export function bulkDeleteCustomTemplates(ids: string[]): boolean {
  if (!ids || ids.length === 0) return false;

  const existingList = customTemplatesCollection.load();
  const idSet = new Set(ids);

  // Filter out the ids, but ensure built-ins aren't magically in here anyway
  const filtered = existingList.filter((t) => !idSet.has(t.id));

  if (filtered.length === existingList.length) {
    return false;
  }

  customTemplatesCollection.save(filtered);

  return true;
}

export function clearCustomTemplates(): void {
  safeRemoveStorage(STORAGE_KEYS.CUSTOM_PROMPT_TEMPLATES);
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
export function composePrompt(
  selectedTemplateIds: string[],
  userText: string
): ComposePromptPayload {
  const allTemplates = getAllTemplates();
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
