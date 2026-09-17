import { PromptConfig, PromptType, StructuredExample, SavedPrompt, ProjectInfo, ChatMessage, JulesSession, JulesSettings } from "../types";
import { DEFAULT_CONFIG } from "../data/templates";

const STORAGE_KEYS = {
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

const memoryFallback: Record<string, string> = {};

export function getStorageInstance(): {
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
  if (!stored) {
    return [];
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
    const clean = msgs.filter((m) => {
      if (!m || typeof m !== "object") return false;
      const mid = String(m.id || "").toLowerCase();
      const text = String(m.text || "").trim().toLowerCase();
      return !(
        mid === "m1" ||
        mid === "m2" ||
        mid === "msg_1" ||
        mid === "msg_2" ||
        mid === "msg_3" ||
        text === "alpha" ||
        text === "beta" ||
        text === "sample test prompt"
      );
    });
    return clean.length > 0 ? clean : undefined;
  };

  return {
    ...fallback,
    ...stored,
    messages: sanitizeMessages(stored.messages),
    promptType: sanitizeType(stored.promptType),
    config: {
      ...DEFAULT_CONFIG,
      ...(stored.config || {}),
    },
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
  const raw = safeGetStorage<Array<ProjectInfo>>(STORAGE_KEYS.PROJECTS, []);
  if (!Array.isArray(raw)) return [];
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
  const storage = getStorageInstance();
  return storage.getItem(STORAGE_KEYS.ACTIVE_PROJECT_ID) || null;
}

export function setActiveProjectId(id: string | null): void {
  const storage = getStorageInstance();
  if (id) {
    storage.setItem(STORAGE_KEYS.ACTIVE_PROJECT_ID, id);
  } else {
    storage.removeItem(STORAGE_KEYS.ACTIVE_PROJECT_ID);
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
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("flag_secure_changed", { detail: enabled }));
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
  if (!session) return true;
  const id = (session.id || "").toLowerCase();
  const title = (session.title || "").toLowerCase();
  const repo = (session.repository || "").toLowerCase();
  return (
    id.startsWith("test_") ||
    id.startsWith("mock_") ||
    id.startsWith("sample_") ||
    id.startsWith("dummy_") ||
    title.includes("mock") ||
    title.includes("test task") ||
    repo.includes("mock") ||
    repo === "test/repo" ||
    repo === "sample/repo"
  );
}

export function loadStoredJulesSessions(): JulesSession[] {
  const sessions = safeGetStorage<JulesSession[]>(STORAGE_KEYS.JULES_SESSIONS, []);
  if (!Array.isArray(sessions)) return [];
  const clean = sessions.filter((s) => !isMockJulesSession(s));
  if (clean.length !== sessions.length) {
    safeSetStorage(STORAGE_KEYS.JULES_SESSIONS, clean);
  }
  return clean;
}

export function saveStoredJulesSessions(sessions: JulesSession[]): void {
  const clean = Array.isArray(sessions) ? sessions.filter((s) => !isMockJulesSession(s)) : [];
  safeSetStorage(STORAGE_KEYS.JULES_SESSIONS, clean);
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


