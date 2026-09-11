import { PromptConfig, PromptType, StructuredExample, SavedPrompt } from "../types";
import { DEFAULT_CONFIG, STARTER_TEMPLATES } from "../data/templates";

const STORAGE_KEYS = {
  API_KEY: "ai_studio_api_key",
  SAVED_PROMPTS: "ai_studio_saved_prompts_v2",
  DRAFT_STATE: "ai_studio_draft_state_v1",
} as const;

export interface DraftState {
  promptType: PromptType;
  config: PromptConfig;
  chatInputText: string;
  freeformText: string;
  structuredExamples: StructuredExample[];
  updatedAt: number;
}

const memoryFallback: Record<string, string> = {};

function getStorageInstance(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
} {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      // Test if storage is actually accessible (not disabled by incognito / iframe policy)
      const testKey = "__storage_test__";
      window.localStorage.setItem(testKey, "1");
      window.localStorage.removeItem(testKey);
      return window.localStorage;
    }
  } catch {
    // Fall back to in-memory store
  }

  return {
    getItem: (key: string) => memoryFallback[key] ?? null,
    setItem: (key: string, value: string) => {
      memoryFallback[key] = value;
    },
    removeItem: (key: string) => {
      delete memoryFallback[key];
    },
  };
}

/**
 * Safe wrapper for localStorage access with quota protection
 */
export function safeGetStorage<T>(key: string, fallback: T): T {
  try {
    const storage = getStorageInstance();
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    console.warn(`Failed to read ${key} from storage:`, err);
    return fallback;
  }
}

export function safeSetStorage<T>(key: string, value: T): boolean {
  try {
    const storage = getStorageInstance();
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err: unknown) {
    console.warn(`Failed to write ${key} to storage (likely quota limit):`, err);
    return false;
  }
}

// API Key management
export function loadStoredApiKey(): string {
  try {
    const storage = getStorageInstance();
    return storage.getItem(STORAGE_KEYS.API_KEY) || "";
  } catch {
    return "";
  }
}

export function saveStoredApiKey(key: string): void {
  try {
    const storage = getStorageInstance();
    if (key.trim()) {
      storage.setItem(STORAGE_KEYS.API_KEY, key.trim());
    } else {
      storage.removeItem(STORAGE_KEYS.API_KEY);
    }
  } catch (err: unknown) {
    console.warn("Failed to persist API key:", err);
  }
}

// Saved Prompts Library
export function loadSavedPrompts(): SavedPrompt[] {
  const stored = safeGetStorage<SavedPrompt[]>(STORAGE_KEYS.SAVED_PROMPTS, []);
  if (!stored || stored.length === 0) {
    return STARTER_TEMPLATES;
  }
  return stored;
}

export function persistSavedPrompts(prompts: SavedPrompt[]): void {
  // Strip large image payloads from saved prompt history to prevent QuotaExceededError
  const sanitized = prompts.map((p) => ({
    ...p,
    messages: p.messages.map((m) => ({
      ...m,
      images: m.images?.map((img) => ({
        ...img,
        data: "", // don't persist heavy base64 strings in localStorage
      })),
    })),
  }));
  safeSetStorage(STORAGE_KEYS.SAVED_PROMPTS, sanitized);
}

// Draft state auto-save and restoration
export function loadDraftState(): DraftState {
  const fallback: DraftState = {
    promptType: "chat",
    config: DEFAULT_CONFIG,
    chatInputText: "",
    freeformText:
      "Translate the following product description into Spanish and generate 3 catchy social media bullet points:\n\nDescription:\n{{description}}\n\nTarget Audience:\n{{audience}}",
    structuredExamples: [
      {
        id: "ex-1",
        input: "The battery lasts only 2 hours and gets hot.",
        output: '{"sentiment": "negative", "topic": "battery", "urgency": "high"}',
      },
      {
        id: "ex-2",
        input: "Fast shipping and works as advertised!",
        output: '{"sentiment": "positive", "topic": "delivery", "urgency": "low"}',
      },
    ],
    updatedAt: Date.now(),
  };

  const stored = safeGetStorage<DraftState | null>(STORAGE_KEYS.DRAFT_STATE, null);
  if (!stored) return fallback;

  return {
    ...fallback,
    ...stored,
    config: {
      ...DEFAULT_CONFIG,
      ...(stored.config || {}),
    },
  };
}

export function saveDraftState(draft: Partial<DraftState>): void {
  try {
    const current = loadDraftState();
    const updated: DraftState = {
      ...current,
      ...draft,
      updatedAt: Date.now(),
    };
    safeSetStorage(STORAGE_KEYS.DRAFT_STATE, updated);
  } catch (err: unknown) {
    console.warn("Failed to auto-save draft:", err);
  }
}
