import { isBrowserEnvironment, getSafeWindow } from "./platform";
import { PromptConfig, PromptType, StructuredExample, SavedPrompt, ProjectInfo, ChatMessage, JulesSession, JulesSettings } from "../types";
import { DEFAULT_CONFIG } from "../data/templates";
import { isMockSession } from "./mockDefinitions";
import { enqueueOfflineMutation } from "./offlineService";
import { generateUniqueId } from "./idGenerator";

/**
 * Generic Utility: Filter out Mock or Synthetic data from entity collections.
 * Leverages mapping functions for different entity shapes to check via `isMockSession`.
 */
import {
  getStorageInstance,
  MemoryStorage,
  safeGetStorage,
  safeGetStorageArray,
  safeGetStorageKeys,
  safeSetStorage,
  safeGetStorageString,
  safeSetStorageString,
  safeRemoveStorage,
  safeRemoveStorageKeysWithPrefix
} from "./storage/core";

export {
  getStorageInstance,
  MemoryStorage,
  safeGetStorage,
  safeGetStorageArray,
  safeGetStorageKeys,
  safeSetStorage,
  safeGetStorageString,
  safeSetStorageString,
  safeRemoveStorage,
  safeRemoveStorageKeysWithPrefix
};

export interface EntityMapper {
  id?: string;
  title?: string;
  repository?: string;
  messages?: unknown[];
}

export function cleanMockData<T>(
  items: T[],
  type: "chat" | "jules" = "chat",
  mapFn?: (item: T) => EntityMapper
): T[] {
  if (!Array.isArray(items)) return [];
  return items.filter((item) => {
    if (!item || typeof item !== "object") return false;

    // Default mapping logic tries to pluck common fields
    const rec = item as Record<string, unknown>;
    const defaultMapped: EntityMapper = mapFn ? mapFn(item) : {
      id: String(rec.id || ""),
      title: String(rec.title || rec.text || ""),
      repository: typeof rec.repository === "string" ? rec.repository : undefined,
      messages: Array.isArray(rec.messages) ? rec.messages : undefined,
    };

    return !isMockSession(defaultMapped, type);
  });
}

export const STORAGE_KEYS = {
  API_KEY: "ai_studio_api_key",
  SAVED_PROMPTS: "ai_studio_saved_prompts_v2",
  DRAFT_STATE: "ai_studio_draft_state_v1",
  PROJECTS: "ai_studio_projects_v2",
  ACTIVE_PROJECT_ID: "ai_studio_active_project_id_v2",
  FLAG_SECURE_ENABLED: "ais_flag_secure_enabled_v1",
  JULES_API_KEY: "jules_api_key_vault_v1",
  JULES_SESSIONS: "jules_sessions_v1",
  JULES_SETTINGS: "jules_settings_v1",
  ACTIVE_JULES_SESSION_ID: "jules_active_session_id_v1",
  GOOGLE_USER: "ai_studio_google_user_v1",
  CUSTOM_PROMPT_TEMPLATES: "ai_studio_custom_prompt_templates",
  SPEECH_SETTINGS: "gemini_studio_speech_settings_v1",
  THEME_MODE: "aistudio_theme_mode",
  CHAT_SESSIONS_PREFIX: "ai_studio_chat_sessions_v1",
} as const;

// Device-scoped salt for local credential encryption
const DEVICE_VAULT_SALT = "ais_mobile_vault_v2_77391";

/**
 * Encrypts a sensitive string into an encoded vault envelope
 */
export function encryptSecret(plainText: string): string {
  if (!plainText) return "";
  try {
    let encrypted = "";
    for (let i = 0; i < plainText.length; i++) {
      const charCode = plainText.charCodeAt(i) ^ DEVICE_VAULT_SALT.charCodeAt(i % DEVICE_VAULT_SALT.length);
      encrypted += String.fromCharCode(charCode);
    }
    return `enc:${btoa(encrypted)}`;
  } catch {
    return plainText;
  }
}

/**
 * Decrypts an encoded vault envelope back to plain string
 */
export function decryptSecret(cipherText: string): string {
  if (!cipherText) return "";
  if (!cipherText.startsWith("enc:")) return cipherText;
  try {
    const raw = atob(cipherText.slice(4));
    let decrypted = "";
    for (let i = 0; i < raw.length; i++) {
      const charCode = raw.charCodeAt(i) ^ DEVICE_VAULT_SALT.charCodeAt(i % DEVICE_VAULT_SALT.length);
      decrypted += String.fromCharCode(charCode);
    }
    return decrypted;
  } catch {
    return cipherText;
  }
}

export interface DraftState {
  promptType: PromptType;
  config: PromptConfig;
  chatInputText: string;
  freeformText: string;
  structuredExamples: StructuredExample[];
  messages?: ChatMessage[];
  updatedAt: number;
}







/**
 * Extracts a deeply nested value safely without throwing, returning a fallback if missing or type mismatches.
 */
export function getNestedValue<T>(obj: unknown, path: string[], fallback: T): T {
  let current = obj;
  for (const key of path) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return fallback;
    }
    if (!(key in current)) {
      return fallback;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current !== undefined ? (current as T) : fallback;
}







import { StorageCollection } from "./StorageCollection";
import { StorageSingleton } from "./StorageSingleton";

export { StorageCollection, StorageSingleton };



// API Key management


const apiKeySingleton = new StorageSingleton<string>(
  STORAGE_KEYS.API_KEY,
  "",
  {
    transformIn: (key) => key.trim(),
    getter: safeGetStorageString as (key: string, fallback: string) => string,
    setter: safeSetStorageString as (key: string, value: string) => void,
  }
);

export function loadStoredApiKey(): string {
  return apiKeySingleton.load();
}

export function saveStoredApiKey(key: string): void {
  if (key.trim()) {
    apiKeySingleton.save(key);
  } else {
    apiKeySingleton.clear();
  }
}

// Saved Prompts Library
const savedPromptsCollection = new StorageCollection<SavedPrompt>(STORAGE_KEYS.SAVED_PROMPTS, {
  transformIn: (p) => ({
    ...p,
    messages: p.messages.map((m) => ({
      ...m,
      images: m.images?.map((img) => ({
        ...img,
        data: "", // don't persist heavy base64 strings in storage
      })),
    })),
  }),
});

export function loadSavedPrompts(): SavedPrompt[] {
  return savedPromptsCollection.load();
}

export function persistSavedPrompts(prompts: SavedPrompt[]): void {
  savedPromptsCollection.save(prompts);
}

// Draft state auto-save and restoration with project scoping
export function getProjectDraftKey(projectId?: string | null): string {
  if (projectId && projectId.trim()) {
    return `${STORAGE_KEYS.DRAFT_STATE}_${projectId.trim()}`;
  }
  return STORAGE_KEYS.DRAFT_STATE;
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
  const draftSingleton = new StorageSingleton<DraftState | null>(key, null);
  const stored = draftSingleton.load();

  if (!stored) {
    // If project-specific key not yet initialized, fallback to default or global draft
    if (projectId) {
      const globalDraftSingleton = new StorageSingleton<DraftState | null>(STORAGE_KEYS.DRAFT_STATE, null);
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
    const draftSingleton = new StorageSingleton<DraftState | null>(key, null);
    draftSingleton.save(updated);
  } catch (err: unknown) {
    console.warn("Failed to auto-save draft:", err);
  }
}




// Phase 2: Encrypted Project Storage & Ingestion Management

const projectsCollection = new StorageCollection<ProjectInfo>(STORAGE_KEYS.PROJECTS, {
  transformIn: (p) => ({ ...p, apiKey: encryptSecret(p.apiKey) }),
  transformOut: (p) => ({ ...p, apiKey: decryptSecret(p.apiKey) }),
});

export function loadStoredProjects(): ProjectInfo[] {
  return projectsCollection.load();
}

export function saveStoredProjects(projects: ProjectInfo[]): void {
  projectsCollection.save(projects);
}

const activeProjectIdSingleton = new StorageSingleton<string | null>(
  STORAGE_KEYS.ACTIVE_PROJECT_ID,
  null,
  {
    getter: (key, fallback) => {
      const val = safeGetStorageString(key, "");
      return val ? val : fallback;
    },
    setter: (key, value) => {
      if (value) {
        safeSetStorageString(key, value);
      } else {
        safeRemoveStorage(key);
      }
    }
  }
);

export function getActiveProjectId(): string | null {
  const val = activeProjectIdSingleton.load();
  return val ? val : null;
}

export function setActiveProjectId(id: string | null): void {
  if (id) {
    activeProjectIdSingleton.save(id);
  } else {
    activeProjectIdSingleton.clear();
  }
}

export function getActiveProject(): ProjectInfo | null {
  const projects = loadStoredProjects();
  if (projects.length === 0) return null;
  const activeId = getActiveProjectId();
  if (activeId) {
    const match = projects.find((p) => p.id === activeId);
    if (match) return match;
  }
  return projects[0];
}

export function saveAndActivateProject(
  projectData: Omit<ProjectInfo, "id" | "createdAt" | "updatedAt"> & { id?: string }
): ProjectInfo {
  const now = Date.now();
  const id = projectData.id || generateUniqueId("proj");

  const savedProject = {
    ...projectData,
    id,
    name: projectData.name.trim() || `AI Studio Project ${projectsCollection.load().length + 1}`,
    apiKey: projectData.apiKey.trim(),
    defaultModel: projectData.defaultModel || "gemini-2.5-flash",
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: projectData.lastVerifiedAt || now,
    isValid: projectData.isValid ?? true,
  } as ProjectInfo;

  projectsCollection.upsert(savedProject, false);
  setActiveProjectId(savedProject.id);
  saveStoredApiKey(savedProject.apiKey);

  return savedProject;
}


export function deleteStoredProject(id: string): void {
  const filtered = projectsCollection.delete(id);
  const activeId = getActiveProjectId();
  if (activeId === id) {
    if (filtered.length > 0) {
      setActiveProjectId(filtered[0].id);
      saveStoredApiKey(filtered[0].apiKey);
    } else {
      setActiveProjectId(null);
      saveStoredApiKey("");
    }
  }
}

export function updateStoredProject(
  id: string,
  updates: Partial<Omit<ProjectInfo, "id" | "createdAt">>
): ProjectInfo | null {
  const updated = projectsCollection.update(id, updates);
  if (!updated) return null;

  const activeId = getActiveProjectId();
  if (activeId === id && updates.apiKey) {
    saveStoredApiKey(updates.apiKey);
  }
  return updated;
}

const flagSecureSingleton = new StorageSingleton<boolean>(
  STORAGE_KEYS.FLAG_SECURE_ENABLED,
  true
);

export function isFlagSecureEnabled(): boolean {
  return flagSecureSingleton.load();
}

export function setFlagSecureEnabled(enabled: boolean): void {
  flagSecureSingleton.save(enabled);
  if (isBrowserEnvironment()) {
    getSafeWindow()?.dispatchEvent(new CustomEvent("flag_secure_changed", { detail: enabled }));
  }
}

// ---------------------------------------------------------------------------
// Google Jules Agent Storage Helpers (Account-level Key & Dedicated Sessions)
// ---------------------------------------------------------------------------

const julesApiKeySingleton = new StorageSingleton<string>(
  STORAGE_KEYS.JULES_API_KEY,
  "",
  {
    transformIn: (key) => key.trim() ? encryptSecret(key.trim()) : "",
    transformOut: (key) => decryptSecret(key),
  }
);

export function loadStoredJulesApiKey(): string {
  return julesApiKeySingleton.load();
}

export function saveStoredJulesApiKey(key: string): void {
  julesApiKeySingleton.save(key);
}

export function isMockJulesSession(session: Partial<JulesSession>): boolean {
  return isMockSession(session, "jules");
}



const julesSessionsCollection = new StorageCollection<JulesSession>(STORAGE_KEYS.JULES_SESSIONS, {
  validate: (s) => !isMockJulesSession(s as Partial<JulesSession>),
  onSave: (clean) => {
    // Async sync to server
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      const isOnline = win && typeof win.navigator.onLine === "boolean" ? win.navigator.onLine : true;

      if (isOnline) {
        fetch("/api/jules/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(clean),
        }).catch((e) => console.error("Failed to save Jules sessions to server", e));
      } else {
        enqueueOfflineMutation("jules_sessions", clean).catch(console.error);
      }
    }
  }
});

export function loadStoredJulesSessions(): JulesSession[] {
  return julesSessionsCollection.load();
}

export function saveStoredJulesSessions(sessions: JulesSession[]): void {
  julesSessionsCollection.save(sessions);
}

export async function fetchJulesSessionsFromServer(): Promise<JulesSession[]> {
  try {
    const res = await fetch("/api/jules/sessions");
    if (res.ok) {
      const data = await res.json();
      const cleanServerSessions = Array.isArray(data) ? cleanMockData(data, "jules") as JulesSession[] : [];

      const localSessions = loadStoredJulesSessions();
      const localSessionMap = new Map(localSessions.map(s => [s.id, s]));

      // Merge server sessions with local ones, preferring local modifications if they are newer
      const mergedSessions = cleanServerSessions.map(serverSession => {
        const localSession = localSessionMap.get(serverSession.id);
        if (localSession && (localSession.updatedAt || 0) > (serverSession.updatedAt || 0)) {
          return localSession;
        }
        return serverSession;
      });

      // Add any local sessions that aren't on the server yet
      for (const localSession of localSessions) {
        if (!mergedSessions.some(s => s.id === localSession.id)) {
          mergedSessions.push(localSession);
        }
      }

      julesSessionsCollection.save(mergedSessions);
      return mergedSessions;
    }
  } catch (e) {
    console.error("Failed to fetch Jules sessions from server", e);
  }
  return loadStoredJulesSessions();
}

const DEFAULT_JULES_SETTINGS: JulesSettings = {
  autoApprovePlans: false,
  defaultBranch: "main",
};

const julesSettingsSingleton = new StorageSingleton<JulesSettings>(
  STORAGE_KEYS.JULES_SETTINGS,
  DEFAULT_JULES_SETTINGS
);

export function loadStoredJulesSettings(): JulesSettings {
  return julesSettingsSingleton.load();
}

export function saveStoredJulesSettings(settings: JulesSettings): void {
  julesSettingsSingleton.save(settings);
}

const activeJulesSessionIdSingleton = new StorageSingleton<string | null>(
  STORAGE_KEYS.ACTIVE_JULES_SESSION_ID,
  null
);

export function getActiveJulesSessionId(): string | null {
  return activeJulesSessionIdSingleton.load();
}

export function setActiveJulesSessionId(id: string | null): void {
  activeJulesSessionIdSingleton.save(id);
}

export function getActiveJulesSession(): JulesSession | null {
  const sessions = loadStoredJulesSessions();
  if (sessions.length === 0) return null;
  const activeId = getActiveJulesSessionId();
  if (activeId) {
    const found = sessions.find((s) => s.id === activeId);
    if (found) return found;
  }
  return sessions[0];
}

export function updateStoredJulesSession(session: JulesSession): JulesSession {
  return julesSessionsCollection.upsert(session, true);
}

export function deleteStoredJulesSession(id: string): void {
  julesSessionsCollection.delete(id);
}

export function bulkDeleteStoredJulesSessions(ids: string[]): void {
  julesSessionsCollection.bulkDelete(ids);
}

