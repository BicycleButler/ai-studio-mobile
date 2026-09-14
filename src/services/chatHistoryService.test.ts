import {
  getChatSessions,
  saveChatSession,
  getChatSessionById,
  deleteChatSession,
  clearAllChatSessions,
  generateSessionTitle,
  formatRelativeTime,
  getChatSessionsStorageKey,
} from "./chatHistoryService";
import { ChatSession, ChatMessage } from "../types";

export function testChatHistoryService(): boolean {
  const testProjectId = "test_proj_hist_1";

  // Clean initial state
  clearAllChatSessions(testProjectId);
  let sessions = getChatSessions(testProjectId);
  if (sessions.length !== 0) {
    throw new Error("Expected initial chat sessions to be empty");
  }

  // Test title generation
  const mockMessages: ChatMessage[] = [
    {
      id: "msg_1",
      role: "user",
      text: "How do I build an Android Jetpack Compose animation?",
      timestamp: Date.now() - 5000,
    },
    {
      id: "msg_2",
      role: "model",
      text: "Use animateFloatAsState and rememberInfiniteTransition.",
      timestamp: Date.now(),
    },
  ];

  const generatedTitle = generateSessionTitle(mockMessages);
  if (!generatedTitle.startsWith("How do I build an Android")) {
    throw new Error(`Unexpected generated title: ${generatedTitle}`);
  }

  // Test saving session
  const session1: ChatSession = {
    id: "session_1",
    title: generatedTitle,
    messages: mockMessages,
    createdAt: Date.now() - 10000,
    updatedAt: Date.now() - 10000,
    projectId: testProjectId,
    model: "gemini-3.8-flash",
  };

  saveChatSession(session1, testProjectId);
  sessions = getChatSessions(testProjectId);
  if (sessions.length !== 1) {
    throw new Error(`Expected 1 saved session, got ${sessions.length}`);
  }

  const fetched = getChatSessionById("session_1", testProjectId);
  if (!fetched || fetched.id !== "session_1") {
    throw new Error("Failed to fetch session by ID");
  }

  // Test updating session
  const updatedMessages: ChatMessage[] = [
    ...mockMessages,
    {
      id: "msg_3",
      role: "user",
      text: "Can you provide a snippet?",
      timestamp: Date.now(),
    },
  ];

  saveChatSession(
    {
      ...session1,
      messages: updatedMessages,
    },
    testProjectId
  );

  const updated = getChatSessionById("session_1", testProjectId);
  if (!updated || updated.messages.length !== 3) {
    throw new Error(`Expected updated session to have 3 messages, got ${updated?.messages.length}`);
  }

  // Test relative time format
  const justNow = formatRelativeTime(Date.now() - 10000);
  if (justNow !== "Just now") {
    throw new Error(`Expected 'Just now', got ${justNow}`);
  }

  const fiveMinAgo = formatRelativeTime(Date.now() - 5 * 60 * 1000);
  if (fiveMinAgo !== "5m ago") {
    throw new Error(`Expected '5m ago', got ${fiveMinAgo}`);
  }

  // Test storage key generation
  if (getChatSessionsStorageKey("proj_123") !== "ai_studio_chat_sessions_v1_proj_123") {
    throw new Error("Invalid project storage key");
  }

  // Test deleting session
  const deleted = deleteChatSession("session_1", testProjectId);
  if (!deleted) {
    throw new Error("Failed to delete session_1");
  }
  if (getChatSessions(testProjectId).length !== 0) {
    throw new Error("Expected 0 sessions after deletion");
  }

  // Cleanup
  clearAllChatSessions(testProjectId);
  return true;
}
