import { isBrowserEnvironment } from "../utils/platform";
import { ChatMessage, ChatSession } from "../types";
import { safeGetStorage, safeSetStorage, safeGetStorageKeys, STORAGE_KEYS, StorageCollection } from "../utils/storage";

function getChatCollection(projectId?: string): StorageCollection<ChatSession> {
  const key = getChatSessionsStorageKey(projectId);
  return new StorageCollection<ChatSession>(key, {
    validate: (s) => !isMockChatSession(s as Partial<ChatSession>),
    maxItems: 100,
  });
}

import { isMockSession } from "../utils/mockDefinitions";

/**
 * Returns the storage key scoped by project
 */
export function getChatSessionsStorageKey(projectId?: string): string {
  if (projectId && projectId.trim()) {
    return `${STORAGE_KEYS.CHAT_SESSIONS_PREFIX}_${projectId.trim()}`;
  }
  return `${STORAGE_KEYS.CHAT_SESSIONS_PREFIX}_default`;
}

/**
 * Identifies if a chat session is synthetic, test, or mock data.
 * Mock data is strictly forbidden from appearing in user chat history,
 * even in the development environment.
 */
export function isMockChatSession(session: Partial<ChatSession>): boolean {
  return isMockSession(session, "chat");
}

/**
 * Purges all mock/test sessions and stale synthetic keys from persistent storage.
 * Automatically runs on module initialization and session queries to ensure
 * zero mock data remains in storage.
 */
export function purgeMockSessionsFromStorage(): void {
  try {
    if (isBrowserEnvironment()) {
      const keysToClean = safeGetStorageKeys(STORAGE_KEYS.CHAT_SESSIONS_PREFIX);

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
if (isBrowserEnvironment()) {
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
  return getChatCollection(projectId).load().sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Saves or updates a chat session in persistent storage.
 * Strictly blocks saving any mock or synthetic data.
 */
export function saveChatSession(session: ChatSession, projectId?: string): void {
  if (!session.id || !session.messages || isMockChatSession(session)) return;

  const collection = getChatCollection(projectId);
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

  collection.upsert(updatedSession, true);
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
  const collection = getChatCollection(projectId);
  const beforeLength = collection.load().length;
  const after = collection.delete(sessionId);
  return after.length !== beforeLength;
}

/**
 * Clears all chat sessions for a project
 */
export function clearAllChatSessions(projectId?: string): void {
  getChatCollection(projectId).clear();
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

/**
 * Deletes multiple chat sessions by ID (Batch Productivity ADR 0047)
 */
export function bulkDeleteChatSessions(sessionIds: string[], projectId?: string): boolean {
  if (!sessionIds || sessionIds.length === 0) return false;
  const collection = getChatCollection(projectId);
  const itemsBefore = collection.load().length;
  const filtered = collection.bulkDelete(sessionIds);
  return filtered.length !== itemsBefore;
}
