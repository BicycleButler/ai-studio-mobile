import { ChatMessage, ChatSession } from "../types";
import { safeGetStorage, safeSetStorage } from "../utils/storage";

const CHAT_SESSIONS_PREFIX = "ai_studio_chat_sessions_v1";

/**
 * Returns the storage key scoped by project
 */
export function getChatSessionsStorageKey(projectId?: string): string {
  if (projectId && projectId.trim()) {
    return `${CHAT_SESSIONS_PREFIX}_${projectId.trim()}`;
  }
  return `${CHAT_SESSIONS_PREFIX}_default`;
}

/**
 * Identifies if a chat session is synthetic, test, or mock data.
 * Mock data is strictly forbidden from appearing in user chat history,
 * even in the development environment.
 */
export function isMockChatSession(session: Partial<ChatSession>): boolean {
  if (!session) return true;
  const id = (session.id || "").trim().toLowerCase();
  const title = (session.title || "").trim().toLowerCase();
  const projectId = (session.projectId || "").trim().toLowerCase();

  // 1. Synthetic/test/mock ID patterns
  if (
    id === "session_1" ||
    id === "session_2" ||
    id === "session_a" ||
    id === "session_b" ||
    id.startsWith("mock_") ||
    id.startsWith("dummy_") ||
    id.startsWith("sample_") ||
    id.startsWith("test_")
  ) {
    return true;
  }

  // 2. Project ID marked as test/mock
  if (
    projectId.startsWith("test_") ||
    projectId.startsWith("mock_") ||
    projectId.includes("sample")
  ) {
    return true;
  }

  // 3. Known test/mock conversation titles
  if (
    title === "earlier chat" ||
    title === "later chat" ||
    title === "untitled chat" ||
    title === "mock chat" ||
    title === "mock conversation" ||
    title === "test session" ||
    title === "sample prompt" ||
    title === "sample test prompt"
  ) {
    return true;
  }

  // 4. Test/mock messages payload signatures
  if (Array.isArray(session.messages)) {
    const hasMockMessage = session.messages.some((m) => {
      const mid = (m.id || "").trim().toLowerCase();
      const text = (m.text || "").trim().toLowerCase();
      return (
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
    if (hasMockMessage) return true;
  }

  return false;
}

/**
 * Purges all mock/test sessions and stale synthetic keys from persistent storage.
 * Automatically runs on module initialization and session queries to ensure
 * zero mock data remains in localStorage.
 */
export function purgeMockSessionsFromStorage(): void {
  try {
    // getStorageInstance doesn't support length or key(i) iterations directly right now,
    // so we still check window.localStorage if available, but wrap gracefully.
    if (typeof window !== "undefined" && window.localStorage) {
      const keysToClean: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key && key.startsWith(CHAT_SESSIONS_PREFIX)) {
          keysToClean.push(key);
        }
      }

      keysToClean.forEach((key) => {
        const sessions = safeGetStorage<ChatSession[]>(key, []);
        if (Array.isArray(sessions)) {
          const cleanSessions = sessions.filter((s) => !isMockChatSession(s));
          if (cleanSessions.length !== sessions.length) {
            safeSetStorage(key, cleanSessions);
          }
        }
      });
    }
  } catch {
    // Fail gracefully if storage access is restricted
  }
}

// Initial sweep when module loads in browser
if (typeof window !== "undefined") {
  purgeMockSessionsFromStorage();
}

/**
 * Sanitizes messages by removing heavy base64 image data before persisting
 */
export function sanitizeMessagesForHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((m) => ({
    ...m,
    images: m.images?.map((img) => ({
      ...img,
      data: "", // Stripped to conserve storage quota
    })),
  }));
}

/**
 * Generates a clean human-readable title from conversation messages
 */
export function generateSessionTitle(messages: ChatMessage[]): string {
  const firstUserMsg = messages.find((m) => m.role === "user" && m.text.trim().length > 0);
  if (firstUserMsg && firstUserMsg.text.trim()) {
    const raw = firstUserMsg.text.trim().replace(/\s+/g, " ");
    return raw.length > 42 ? `${raw.slice(0, 42)}...` : raw;
  }
  const firstAnyMsg = messages.find((m) => m.text.trim().length > 0);
  if (firstAnyMsg && firstAnyMsg.text.trim()) {
    const raw = firstAnyMsg.text.trim().replace(/\s+/g, " ");
    return raw.length > 42 ? `${raw.slice(0, 42)}...` : raw;
  }
  return "New Conversation";
}

/**
 * Retrieves all saved chat sessions for a project sorted by most recent.
 * Enforces strict filtering to guarantee zero mock data is returned.
 */
export function getChatSessions(projectId?: string): ChatSession[] {
  const key = getChatSessionsStorageKey(projectId);
  const sessions = safeGetStorage<ChatSession[]>(key, []);
  if (!Array.isArray(sessions)) return [];

  // Exclude any mock or synthetic sessions
  const cleanSessions = sessions.filter((s) => !isMockChatSession(s));

  // If mock data was detected and stripped, update storage to keep it permanently clean
  if (cleanSessions.length !== sessions.length) {
    safeSetStorage(key, cleanSessions);
  }

  return cleanSessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Saves or updates a chat session in persistent storage.
 * Strictly blocks saving any mock or synthetic data.
 */
export function saveChatSession(session: ChatSession, projectId?: string): void {
  if (!session || !session.id) return;

  // Never persist mock sessions, even in development
  if (isMockChatSession(session)) {
    return;
  }

  const key = getChatSessionsStorageKey(projectId);
  const existing = getChatSessions(projectId);
  const sanitizedMessages = sanitizeMessagesForHistory(session.messages || []);

  const title =
    session.title && session.title !== "New Conversation" && session.title !== "Untitled Chat"
      ? session.title
      : generateSessionTitle(sanitizedMessages);

  const updatedSession: ChatSession = {
    ...session,
    title,
    messages: sanitizedMessages,
    projectId: projectId || session.projectId,
    updatedAt: Date.now(),
    createdAt: session.createdAt || Date.now(),
  };

  const existingIndex = existing.findIndex((s) => s.id === session.id);
  let updatedList: ChatSession[];

  if (existingIndex >= 0) {
    updatedList = [...existing];
    updatedList[existingIndex] = updatedSession;
  } else {
    updatedList = [updatedSession, ...existing];
  }

  // Keep a reasonable cap (e.g. up to 100 historical sessions)
  if (updatedList.length > 100) {
    updatedList = updatedList.slice(0, 100);
  }

  safeSetStorage(key, updatedList);
}

/**
 * Gets a specific chat session by ID
 */
export function getChatSessionById(sessionId: string, projectId?: string): ChatSession | null {
  const sessions = getChatSessions(projectId);
  return sessions.find((s) => s.id === sessionId) || null;
}

/**
 * Deletes an individual chat session by ID
 */
export function deleteChatSession(sessionId: string, projectId?: string): boolean {
  const key = getChatSessionsStorageKey(projectId);
  const sessions = getChatSessions(projectId);
  const filtered = sessions.filter((s) => s.id !== sessionId);
  if (filtered.length === sessions.length) return false;
  safeSetStorage(key, filtered);
  return true;
}

/**
 * Clears all chat sessions for a project
 */
export function clearAllChatSessions(projectId?: string): void {
  const key = getChatSessionsStorageKey(projectId);
  safeSetStorage(key, []);
}

/**
 * Formats a relative timestamp (e.g. "Just now", "5m ago", "2h ago", "Yesterday")
 */
export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "";
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;

  const d = new Date(timestamp);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
