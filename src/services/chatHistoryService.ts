import { isBrowserEnvironment } from "../utils/platform";
import { ChatMessage, ChatSession } from "../types";
import { safeGetStorageKeys, STORAGE_KEYS, StorageCollection } from "../utils/storage";
import { isMockSession } from "../utils/mockDefinitions";

export interface IChatHistoryService {
  getChatSessionsStorageKey(projectId?: string): string;
  isMockChatSession(session: Partial<ChatSession>): boolean;
  purgeMockSessionsFromStorage(): void;
  sanitizeMessagesForHistory(messages: ChatMessage[]): ChatMessage[];
  generateSessionTitle(messages: ChatMessage[], maxLength?: number): string;
  getChatSessions(projectId?: string): ChatSession[];
  saveChatSession(session: ChatSession, projectId?: string): void;
  getChatSessionById(sessionId: string, projectId?: string): ChatSession | null;
  deleteChatSession(sessionId: string, projectId?: string): boolean;
  clearAllChatSessions(projectId?: string): void;
  bulkDeleteChatSessions(sessionIds: string[], projectId?: string): boolean;
}

export class ChatHistoryService implements IChatHistoryService {
  private collectionRegistry = new Map<string, StorageCollection<ChatSession>>();

  private getChatCollectionByKey(key: string): StorageCollection<ChatSession> {
    if (this.collectionRegistry.has(key)) {
      return this.collectionRegistry.get(key)!;
    }
    const collection = new StorageCollection<ChatSession>(key, {
      keyExtractor: (item) => String(item.id || ""),
      validate: (s) => !this.isMockChatSession(s as Partial<ChatSession>),
      maxItems: 100,
    });
    this.collectionRegistry.set(key, collection);
    return collection;
  }

  private getChatCollection(projectId?: string): StorageCollection<ChatSession> {
    const key = this.getChatSessionsStorageKey(projectId);
    return this.getChatCollectionByKey(key);
  }

  public getChatSessionsStorageKey(projectId?: string): string {
    if (projectId && projectId.trim()) {
      return `${STORAGE_KEYS.CHAT_SESSIONS_PREFIX}_${projectId.trim()}`;
    }
    return `${STORAGE_KEYS.CHAT_SESSIONS_PREFIX}_default`;
  }

  public isMockChatSession(session: Partial<ChatSession>): boolean {
    return isMockSession(session, "chat");
  }

  public purgeMockSessionsFromStorage(): void {
    try {
      if (isBrowserEnvironment()) {
        const keysToClean = safeGetStorageKeys(STORAGE_KEYS.CHAT_SESSIONS_PREFIX);

        keysToClean.forEach((key) => {
          const collection = this.getChatCollectionByKey(key);
          const rawCollection = new StorageCollection<ChatSession>(key, {});
          const rawSessions = rawCollection.load();

          const cleanSessions = collection.load();
          if (cleanSessions.length !== rawSessions.length) {
            collection.save(cleanSessions);
          }
          rawCollection.dispose();
        });
      }
    } catch {
      // Fail gracefully if storage access is restricted
    }
  }

  public sanitizeMessagesForHistory(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((m) => ({
      ...m,
      images: m.images?.map((img) => ({
        ...img,
        data: "", // Stripped to conserve storage quota
      })),
    }));
  }

  public generateSessionTitle(messages: ChatMessage[], maxLength: number = 42): string {
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

  public getChatSessions(projectId?: string): ChatSession[] {
    return [...this.getChatCollection(projectId).load()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  public saveChatSession(session: ChatSession, projectId?: string): void {
    if (!session.id || !session.messages || this.isMockChatSession(session)) return;

    const collection = this.getChatCollection(projectId);
    const sanitizedMessages = this.sanitizeMessagesForHistory(session.messages || []);

    const title =
      session.title && session.title !== "New Conversation" && session.title !== "Untitled Chat"
        ? session.title
        : this.generateSessionTitle(sanitizedMessages);

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

  public getChatSessionById(sessionId: string, projectId?: string): ChatSession | null {
    const sessions = this.getChatSessions(projectId);
    return sessions.find((s) => s.id === sessionId) || null;
  }

  public deleteChatSession(sessionId: string, projectId?: string): boolean {
    const collection = this.getChatCollection(projectId);
    const beforeLength = collection.load().length;
    const after = collection.delete(sessionId);
    return after.length !== beforeLength;
  }

  public clearAllChatSessions(projectId?: string): void {
    this.getChatCollection(projectId).clear();
  }

  public bulkDeleteChatSessions(sessionIds: string[], projectId?: string): boolean {
    if (!sessionIds || sessionIds.length === 0) return false;
    const collection = this.getChatCollection(projectId);
    const itemsBefore = collection.load().length;
    const filtered = collection.bulkDelete(sessionIds);
    return filtered.length !== itemsBefore;
  }
}

export const defaultChatHistoryService = new ChatHistoryService();

/**
 * Returns the storage key scoped by project
 */
export function getChatSessionsStorageKey(projectId?: string): string {
  return defaultChatHistoryService.getChatSessionsStorageKey(projectId);
}

/**
 * Identifies if a chat session is synthetic, test, or mock data.
 * Mock data is strictly forbidden from appearing in user chat history,
 * even in the development environment.
 */
export function isMockChatSession(session: Partial<ChatSession>): boolean {
  return defaultChatHistoryService.isMockChatSession(session);
}

/**
 * Purges all mock/test sessions and stale synthetic keys from persistent storage.
 * Automatically runs on module initialization and session queries to ensure
 * zero mock data remains in storage.
 */
export function purgeMockSessionsFromStorage(): void {
  defaultChatHistoryService.purgeMockSessionsFromStorage();
}

export function initializeChatHistoryService(): void {
  purgeMockSessionsFromStorage();
}

/**
 * Sanitizes messages by removing heavy base64 image data before persisting
 */
export function sanitizeMessagesForHistory(messages: ChatMessage[]): ChatMessage[] {
  return defaultChatHistoryService.sanitizeMessagesForHistory(messages);
}

/**
 * Generates a clean human-readable title from conversation messages
 */
export function generateSessionTitle(messages: ChatMessage[], maxLength: number = 42): string {
  return defaultChatHistoryService.generateSessionTitle(messages, maxLength);
}

/**
 * Retrieves all saved chat sessions for a project sorted by most recent.
 * Enforces strict filtering to guarantee zero mock data is returned.
 */
export function getChatSessions(projectId?: string): ChatSession[] {
  return defaultChatHistoryService.getChatSessions(projectId);
}

/**
 * Saves or updates a chat session in persistent storage.
 * Strictly blocks saving any mock or synthetic data.
 */
export function saveChatSession(session: ChatSession, projectId?: string): void {
  return defaultChatHistoryService.saveChatSession(session, projectId);
}

/**
 * Gets a specific chat session by ID
 */
export function getChatSessionById(sessionId: string, projectId?: string): ChatSession | null {
  return defaultChatHistoryService.getChatSessionById(sessionId, projectId);
}

/**
 * Deletes an individual chat session by ID
 */
export function deleteChatSession(sessionId: string, projectId?: string): boolean {
  return defaultChatHistoryService.deleteChatSession(sessionId, projectId);
}

/**
 * Clears all chat sessions for a project
 */
export function clearAllChatSessions(projectId?: string): void {
  return defaultChatHistoryService.clearAllChatSessions(projectId);
}

/**
 * Deletes multiple chat sessions by ID (Batch Productivity ADR 0047)
 */
export function bulkDeleteChatSessions(sessionIds: string[], projectId?: string): boolean {
  return defaultChatHistoryService.bulkDeleteChatSessions(sessionIds, projectId);
}
