import { isBrowserEnvironment, getSafeWindow, WindowWithLocalStorage } from "./platform";
import { PromptConfig, PromptType, StructuredExample, SavedPrompt, ProjectInfo, ChatMessage, JulesSession, JulesSettings } from "../types";
import { DEFAULT_CONFIG } from "../data/templates";
import { MOCK_MESSAGE_IDS, MOCK_MESSAGE_TEXTS, isMockSession } from "./mockDefinitions";
import { enqueueOfflineMutation } from "./offlineService";

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

export class MemoryStorage implements Storage {
  private store: Map<string, string>;
  private keysCache: string[] | null = null;

  constructor() {
    this.store = new Map();
  }

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
    this.keysCache = null; // Invalidate cache
  }

  removeItem(key: string): void {
    if (this.store.delete(key)) {
      this.keysCache = null; // Invalidate cache
    }
  }

  clear(): void {
    this.store.clear();
    this.keysCache = null;
  }

  get length(): number {
    return this.store.size;
  }

  key(index: number): string | null {
    if (this.keysCache === null) {
      this.keysCache = Array.from(this.store.keys());
    }
    return this.keysCache[index] ?? null;
  }
}

const memoryFallbackInstance = new MemoryStorage();

let _storageInstance: Storage | null = null;

export function getStorageInstance(): Storage {
  if (_storageInstance) return _storageInstance;

  try {
    if (isBrowserEnvironment()) {
      const win = getSafeWindow() as WindowWithLocalStorage | null;
      if (win && win.localStorage) {
        // Test if storage is actually accessible (not disabled by incognito / iframe policy)
        const testKey = "__storage_test__";
        win.localStorage.setItem(testKey, "1");
        win.localStorage.removeItem(testKey);
        _storageInstance = win.localStorage;
        return _storageInstance;
      }
    }
  } catch {
    // Fall back to in-memory store
  }

  _storageInstance = memoryFallbackInstance;
  return _storageInstance;
}

/**
 * Safe wrapper for storage access with quota protection
 */
export function safeGetStorage<T>(key: string, fallback: T): T {
  try {
    const storage = getStorageInstance();
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch (parseErr) {
      console.warn(`Storage key ${key} contained invalid JSON. Corrupted data removed.`, parseErr);
      storage.removeItem(key);
      return fallback;
    }
  } catch (err: unknown) {
    console.warn(`Failed to read ${key} from storage:`, err);
    return fallback;
  }
}

/**
 * Safely reads an array from local storage, guaranteeing an array return type.
 */
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

export function safeGetStorageArray<T>(key: string, fallback: T[] = []): T[] {
  try {
    const storage = getStorageInstance();
    const raw = storage.getItem(key);
    if (!raw) return fallback;
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      console.warn(`Storage key ${key} contained invalid JSON array. Corrupted data removed.`, parseErr);
      storage.removeItem(key);
      return fallback;
    }

    if (Array.isArray(parsed)) return parsed as T[];
    console.warn(`Storage key ${key} contained non-array JSON. Corrupted data removed.`);
    storage.removeItem(key);
    return fallback;
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

/**
 * Safely removes all storage keys that match the given prefix.
 */
export function safeRemoveStorageKeysWithPrefix(prefix: string): void {
  try {
    const keysToRemove = safeGetStorageKeys(prefix);
    const storage = getStorageInstance();
    for (const key of keysToRemove) {
      storage.removeItem(key);
    }
  } catch (err: unknown) {
    console.warn(`Failed to remove keys with prefix ${prefix}:`, err);
  }
}


/**
 * Safely retrieves all storage keys matching a specific prefix.
 * Complies with performance rule by loading getStorageInstance() once outside loop.
 */
export function safeGetStorageKeys(prefix: string): string[] {
  const keys: string[] = [];
  try {
    const storage = getStorageInstance();
    const len = storage.length;
    for (let i = 0; i < len; i++) {
      const key = storage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key);
      }
    }
  } catch (err: unknown) {
    console.warn("Failed to enumerate storage keys:", err);
  }
  return keys;
}

export function safeRemoveStorage(key: string): boolean {
  try {
    const storage = getStorageInstance();
    storage.removeItem(key);
    return true;
  } catch (err: unknown) {
    console.warn(`Failed to remove ${key} from storage:`, err);
    return false;
  }
}

// API Key management
export function safeGetStorageString(key: string, fallback: string = ""): string {
  try {
    const storage = getStorageInstance();
    return storage.getItem(key) || fallback;
  } catch {
    return fallback;
  }
}

export function safeSetStorageString(key: string, value: string): boolean {
  try {
    const storage = getStorageInstance();
    storage.setItem(key, value);
    return true;
  } catch (err: unknown) {
    console.warn(`Failed to write ${key} to storage:`, err);
    return false;
  }
}

export function loadStoredApiKey(): string {
  return safeGetStorageString(STORAGE_KEYS.API_KEY, "");
}

export function saveStoredApiKey(key: string): void {
  if (key.trim()) {
    safeSetStorageString(STORAGE_KEYS.API_KEY, key.trim());
  } else {
    safeRemoveStorage(STORAGE_KEYS.API_KEY);
  }
}

// Saved Prompts Library
export function loadSavedPrompts(): SavedPrompt[] {
  return safeGetStorageArray<SavedPrompt>(STORAGE_KEYS.SAVED_PROMPTS, []);
}

export function persistSavedPrompts(prompts: SavedPrompt[]): void {
  // Strip large image payloads from saved prompt history to prevent QuotaExceededError
  const sanitized = prompts.map((p) => ({
    ...p,
    messages: p.messages.map((m) => ({
      ...m,
      images: m.images?.map((img) => ({
        ...img,
        data: "", // don't persist heavy base64 strings in storage
      })),
    })),
  }));
  safeSetStorage(STORAGE_KEYS.SAVED_PROMPTS, sanitized);
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
  const stored = safeGetStorage<DraftState | null>(key, null);
  if (!stored) {
    // If project-specific key not yet initialized, fallback to default or global draft
    if (projectId) {
      const globalStored = safeGetStorage<DraftState | null>(STORAGE_KEYS.DRAFT_STATE, null);
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
    const clean = msgs.filter((m: unknown) => {
      if (!m || typeof m !== "object") return false;
      const mObj = m as Record<string, unknown>;
      const mid = String(mObj.id || "").toLowerCase();
      const text = String(mObj.text || "").trim().toLowerCase();
      return !(MOCK_MESSAGE_IDS.includes(mid) || MOCK_MESSAGE_TEXTS.includes(text));
    });
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
    safeSetStorage(key, updated);
  } catch (err: unknown) {
    console.warn("Failed to auto-save draft:", err);
  }
}

// Phase 2: Encrypted Project Storage & Ingestion Management
export function loadStoredProjects(): ProjectInfo[] {
  const raw = safeGetStorageArray<ProjectInfo>(STORAGE_KEYS.PROJECTS, []);
  return raw.map((p) => ({
    ...p,
    apiKey: decryptSecret(p.apiKey),
  }));
}

export function saveStoredProjects(projects: ProjectInfo[]): void {
  const encrypted = projects.map((p) => ({
    ...p,
    apiKey: encryptSecret(p.apiKey),
  }));
  safeSetStorage(STORAGE_KEYS.PROJECTS, encrypted);
}

export function getActiveProjectId(): string | null {
  const val = safeGetStorageString(STORAGE_KEYS.ACTIVE_PROJECT_ID, "");
  return val ? val : null;
}

export function setActiveProjectId(id: string | null): void {
  if (id) {
    safeSetStorageString(STORAGE_KEYS.ACTIVE_PROJECT_ID, id);
  } else {
    safeRemoveStorage(STORAGE_KEYS.ACTIVE_PROJECT_ID);
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
  const projects = loadStoredProjects();
  const now = Date.now();
  const existingIdx = projectData.id ? projects.findIndex((p) => p.id === projectData.id) : -1;

  let savedProject: ProjectInfo;
  if (existingIdx >= 0) {
    savedProject = {
      ...projects[existingIdx],
      ...projectData,
      updatedAt: now,
    };
    projects[existingIdx] = savedProject;
  } else {
    savedProject = {
      id: projectData.id || `proj_${now}_${Math.random().toString(36).slice(2, 7)}`,
      name: projectData.name.trim() || `AI Studio Project ${projects.length + 1}`,
      apiKey: projectData.apiKey.trim(),
      defaultModel: projectData.defaultModel || "gemini-2.5-flash",
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: projectData.lastVerifiedAt || now,
      isValid: projectData.isValid ?? true,
    };
    projects.push(savedProject);
  }

  saveStoredProjects(projects);
  setActiveProjectId(savedProject.id);
  // Also synchronize with raw custom key storage so all runtime endpoints use this active key
  saveStoredApiKey(savedProject.apiKey);

  return savedProject;
}

export function deleteStoredProject(id: string): void {
  const projects = loadStoredProjects();
  const filtered = projects.filter((p) => p.id !== id);
  saveStoredProjects(filtered);
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
  const projects = loadStoredProjects();
  const index = projects.findIndex((p) => p.id === id);
  if (index === -1) return null;

  const updated: ProjectInfo = {
    ...projects[index],
    ...updates,
    updatedAt: Date.now(),
  };
  projects[index] = updated;
  saveStoredProjects(projects);

  const activeId = getActiveProjectId();
  if (activeId === id) {
    if (updates.apiKey) {
      saveStoredApiKey(updates.apiKey);
    }
  }

  return updated;
}

export function isFlagSecureEnabled(): boolean {
  return safeGetStorage<boolean>(STORAGE_KEYS.FLAG_SECURE_ENABLED, true);
}

export function setFlagSecureEnabled(enabled: boolean): void {
  safeSetStorage(STORAGE_KEYS.FLAG_SECURE_ENABLED, enabled);
  if (isBrowserEnvironment()) {
    getSafeWindow()?.dispatchEvent(new CustomEvent("flag_secure_changed", { detail: enabled }));
  }
}

// ---------------------------------------------------------------------------
// Google Jules Agent Storage Helpers (Account-level Key & Dedicated Sessions)
// ---------------------------------------------------------------------------

export function loadStoredJulesApiKey(): string {
  const encrypted = safeGetStorage<string>(STORAGE_KEYS.JULES_API_KEY, "");
  return decryptSecret(encrypted);
}

export function saveStoredJulesApiKey(key: string): void {
  const trimmed = (key || "").trim();
  const encrypted = trimmed ? encryptSecret(trimmed) : "";
  safeSetStorage(STORAGE_KEYS.JULES_API_KEY, encrypted);
}

export function isMockJulesSession(session: Partial<JulesSession>): boolean {
  return isMockSession(session, "jules");
}

let _cachedJulesSessions: JulesSession[] = [];

export function loadStoredJulesSessions(): JulesSession[] {
  // Try to load from local storage first to prevent blocking react rendering
  const sessions = safeGetStorageArray<JulesSession>(STORAGE_KEYS.JULES_SESSIONS, _cachedJulesSessions);
  const clean = sessions.filter((s) => !isMockJulesSession(s));
  return clean;
}

export async function fetchJulesSessionsFromServer(): Promise<JulesSession[]> {
  try {
    const res = await fetch("/api/jules/sessions");
    if (res.ok) {
      const data = await res.json();
      const clean = Array.isArray(data) ? data.filter((s) => !isMockJulesSession(s)) : [];
      _cachedJulesSessions = clean;
      safeSetStorage(STORAGE_KEYS.JULES_SESSIONS, clean); // Update local cache
      return clean;
    }
  } catch (e) {
    console.error("Failed to fetch Jules sessions from server", e);
  }
  return loadStoredJulesSessions();
}

export function saveStoredJulesSessions(sessions: JulesSession[]): void {
  const clean = Array.isArray(sessions) ? sessions.filter((s) => !isMockJulesSession(s)) : [];
  _cachedJulesSessions = clean;
  safeSetStorage(STORAGE_KEYS.JULES_SESSIONS, clean); // Update local cache

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

const DEFAULT_JULES_SETTINGS: JulesSettings = {
  autoApprovePlans: false,
  defaultBranch: "main",
};

export function loadStoredJulesSettings(): JulesSettings {
  return safeGetStorage<JulesSettings>(STORAGE_KEYS.JULES_SETTINGS, DEFAULT_JULES_SETTINGS);
}

export function saveStoredJulesSettings(settings: JulesSettings): void {
  safeSetStorage(STORAGE_KEYS.JULES_SETTINGS, settings);
}

export function getActiveJulesSessionId(): string | null {
  return safeGetStorage<string | null>(STORAGE_KEYS.ACTIVE_JULES_SESSION_ID, null);
}

export function setActiveJulesSessionId(id: string | null): void {
  safeSetStorage(STORAGE_KEYS.ACTIVE_JULES_SESSION_ID, id);
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
  const sessions = loadStoredJulesSessions();
  const index = sessions.findIndex((s) => s.id === session.id);
  const updated: JulesSession = {
    ...session,
    updatedAt: Date.now(),
  };

  if (index >= 0) {
    sessions[index] = updated;
  } else {
    sessions.unshift(updated);
  }

  saveStoredJulesSessions(sessions);
  return updated;
}


