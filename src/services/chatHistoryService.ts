import { isBrowserEnvironment } from "../utils/platform";
import { ChatMessage, ChatSession } from "../types";
import { safeGetStorageKeys, STORAGE_KEYS, StorageCollection } from "../utils/storage";

function getChatCollection(projectId?: string): StorageCollection<ChatSession> {
  const key = getChatSessionsStorageKey(projectId);
  return new StorageCollection<ChatSession>(key, {
    validate: (s) => !isMockChatSession(s as Partial<ChatSession>),
    maxItems: 100,
  });
}

function getChatCollectionByKey(key: string): StorageCollection<ChatSession> {
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
        const collection = getChatCollectionByKey(key);
        // We temporarily create a new collection without validation to load the raw data,
        // then compare its length to the validated collection.
        const rawCollection = new StorageCollection<ChatSession>(key, {});
        const rawSessions = rawCollection.load();

        const cleanSessions = collection.load();
        if (cleanSessions.length !== rawSessions.length) {
          collection.save(cleanSessions);
        }
      });
    }
  } catch {
    // Fail gracefully if storage access is restricted
  }
}

export function initializeChatHistoryService(): void {
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
export function generateSessionTitle(messages: ChatMessage[], maxLength: number = 42): string {
  const firstUserMsg = messages.find((m) => m.role === "user" && m.text.trim().length > 0);
  if (firstUserMsg && firstUserMsg.text.trim()) {
    const raw = firstUserMsg.text.trim().replace(/\s+/g, " ");
    return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
  }
  const firstAnyMsg = messages.find((m) => m.text.trim().length > 0);
  if (firstAnyMsg && firstAnyMsg.text.trim()) {
    const raw = firstAnyMsg.text.trim().replace(/\s+/g, " ");
    return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
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
 * Deletes multiple chat sessions by ID (Batch Productivity ADR 0047)
 */
export function bulkDeleteChatSessions(sessionIds: string[], projectId?: string): boolean {
  if (!sessionIds || sessionIds.length === 0) return false;
  const collection = getChatCollection(projectId);
  const itemsBefore = collection.load().length;
  const filtered = collection.bulkDelete(sessionIds);
  return filtered.length !== itemsBefore;
}
