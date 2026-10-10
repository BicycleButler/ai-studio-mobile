export const COMMON_MOCK_PREFIXES = ["test_", "mock_", "sample_", "dummy_"];

// Chat History Mock Definitions
export const MOCK_SESSION_EXACT_IDS = ["session_1", "session_2", "session_a", "session_b"];
export const MOCK_SESSION_TITLES = [
  "earlier chat",
  "later chat",
  "untitled chat",
  "mock chat",
  "mock conversation",
  "test session",
  "sample prompt",
  "sample test prompt",
];
export const MOCK_MESSAGE_IDS = ["m1", "m2", "msg_1", "msg_2", "msg_3"];
export const MOCK_MESSAGE_TEXTS = ["alpha", "beta", "sample test prompt"];

// Jules Session Mock Definitions
export const MOCK_JULES_TITLE_PATTERNS = ["mock", "test task"];
export const MOCK_JULES_REPO_PATTERNS = ["mock", "test/repo", "sample/repo"];

/**
 * Universal Mock Data Detection Utility
 * Safely identifies test/mock objects across Chat and Jules sessions to prevent
 * storage pollution or UI rendering of synthetic data.
 */
export function isMockSession(
  session: Partial<{ id: string; title: string; projectId: string; repository: string; messages: unknown[] }> | null | undefined,
  type: "chat" | "jules"
): boolean {
  if (!session) return true;

  const id = (session.id || "").trim().toLowerCase();
  const title = (session.title || "").trim().toLowerCase();

  // 1. Shared Synthetic/Test ID pattern checks
  if (type === "chat" && MOCK_SESSION_EXACT_IDS.includes(id)) {
    return true;
  }

  if (COMMON_MOCK_PREFIXES.some((prefix) => id.startsWith(prefix))) {
    return true;
  }

  if (type === "chat") {
    const projectId = (session.projectId || "").trim().toLowerCase();

    // 2. Project ID marked as test/mock
    if (
      projectId.startsWith("test_") ||
      projectId.startsWith("mock_") ||
      projectId.includes("sample")
    ) {
      return true;
    }

    // 3. Known test/mock conversation titles
    if (MOCK_SESSION_TITLES.includes(title)) {
      return true;
    }

    // 4. Test/mock messages payload signatures
    if (Array.isArray(session.messages)) {
      const hasMockMessage = session.messages.some((m: unknown) => {
        if (!m || typeof m !== "object") return false;
        const msg = m as { id?: string; text?: string };
        const mid = (msg.id || "").trim().toLowerCase();
        const text = (msg.text || "").trim().toLowerCase();
        return MOCK_MESSAGE_IDS.includes(mid) || MOCK_MESSAGE_TEXTS.includes(text);
      });
      if (hasMockMessage) return true;
    }
  }

  if (type === "jules") {
    const repo = (session.repository || "").toLowerCase();

    if (MOCK_JULES_TITLE_PATTERNS.some((pattern) => title.includes(pattern))) {
      return true;
    }

    if (MOCK_JULES_REPO_PATTERNS.some((pattern) => repo.includes(pattern))) {
      return true;
    }
  }

  return false;
}
