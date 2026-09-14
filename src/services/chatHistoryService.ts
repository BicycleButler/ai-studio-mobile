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
 * Retrieves all saved chat sessions for a project sorted by most recent
 */
export function getChatSessions(projectId?: string): ChatSession[] {
  const key = getChatSessionsStorageKey(projectId);
  const sessions = safeGetStorage<ChatSession[]>(key, []);
  if (!Array.isArray(sessions)) return [];
  return sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

/**
 * Saves or updates a chat session in persistent storage
 */
export function saveChatSession(session: ChatSession, projectId?: string): void {
  if (!session || !session.id) return;

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
