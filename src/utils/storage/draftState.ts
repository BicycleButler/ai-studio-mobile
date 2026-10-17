import { PromptConfig, PromptType, StructuredExample, ChatMessage } from "../../types";
import { DEFAULT_CONFIG } from "../../data/templates";
import { StorageSingleton } from "./StorageSingleton";
import { STORAGE_KEYS } from "./constants";
import { cleanMockData, getNestedValue } from "./helpers";

export interface DraftState {
  promptType: PromptType;
  config: PromptConfig;
  chatInputText: string;
  freeformText: string;
  structuredExamples: StructuredExample[];
  messages?: ChatMessage[];
  updatedAt: number;
}

export function getProjectDraftKey(projectId?: string | null): string {
  if (projectId && projectId.trim()) {
    return `${STORAGE_KEYS.DRAFT_STATE}_${projectId.trim()}`;
  }
  return STORAGE_KEYS.DRAFT_STATE;
}

const draftSingletonCache = new Map<string, StorageSingleton<DraftState | null>>();

function getDraftSingleton(key: string): StorageSingleton<DraftState | null> {
  if (!draftSingletonCache.has(key)) {
    draftSingletonCache.set(key, new StorageSingleton<DraftState | null>(key, null));
  }
  return draftSingletonCache.get(key)!;
}

export function loadDraftState(projectId?: string | null): DraftState {
  const fallback: DraftState = {
    promptType: "chat",
    config: DEFAULT_CONFIG,
    chatInputText: "",
    freeformText: "",
    structuredExamples: [],
    messages: undefined,
    updatedAt: Date.now(),
  };

  const validPromptTypes: PromptType[] = ["chat", "code", "jules", "stubs"];

  const sanitizeType = (typeVal: unknown): PromptType => {
    if (typeof typeVal === "string" && validPromptTypes.includes(typeVal as PromptType)) {
      return typeVal as PromptType;
    }
    return "chat";
  };

  const key = getProjectDraftKey(projectId);
  const draftSingleton = getDraftSingleton(key);
  const stored = draftSingleton.load();

  if (!stored) {
    // If project-specific key not yet initialized, fallback to default or global draft
    if (projectId) {
      const globalDraftSingleton = getDraftSingleton(STORAGE_KEYS.DRAFT_STATE);
      const globalStored = globalDraftSingleton.load();
      if (globalStored) {
        return {
          ...fallback,
          ...globalStored,
          promptType: sanitizeType(globalStored.promptType),
          config: {
            ...DEFAULT_CONFIG,
            ...(globalStored.config || {}),
          },
        };
      }
    }
    return fallback;
  }

  const sanitizeMessages = (msgs: unknown): ChatMessage[] | undefined => {
    if (!Array.isArray(msgs)) return undefined;
    const clean = cleanMockData(msgs as ChatMessage[], "chat");
    return clean.length > 0 ? clean : undefined;
  };

  return {
    ...fallback,
    ...stored,
    messages: sanitizeMessages(getNestedValue(stored, ['messages'], undefined)),
    promptType: sanitizeType(getNestedValue(stored, ['promptType'], 'chat')),
    config: {
      ...DEFAULT_CONFIG,
      ...(getNestedValue(stored, ['config'], {})),
    },
    chatInputText: getNestedValue(stored, ['chatInputText'], ''),
    freeformText: getNestedValue(stored, ['freeformText'], ''),
    structuredExamples: getNestedValue(stored, ['structuredExamples'], []),
    updatedAt: getNestedValue(stored, ['updatedAt'], fallback.updatedAt),
  };
}

export function saveDraftState(draft: Partial<DraftState>, projectId?: string | null): void {
  try {
    const current = loadDraftState(projectId);
    const updated: DraftState = {
      ...current,
      ...draft,
      updatedAt: Date.now(),
    };
    const key = getProjectDraftKey(projectId);
    const draftSingleton = getDraftSingleton(key);
    draftSingleton.save(updated);
  } catch (err: unknown) {
    console.warn("Failed to auto-save draft:", err);
  }
}
