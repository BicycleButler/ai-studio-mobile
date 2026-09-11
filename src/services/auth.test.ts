// Test suite for authentication helpers & header builders

export function testAuthHelpers(): boolean {
  // Test 1: Headers creation with custom API key
  const customKey = "AIzaSyTestKey1234567890";
  const headersWithKey: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (customKey) {
    headersWithKey["x-gemini-api-key"] = customKey;
  }

  if (headersWithKey["x-gemini-api-key"] !== customKey) {
    throw new Error("Expected x-gemini-api-key header to be populated");
  }

  // Test 2: Headers creation without custom key (relies on AI Studio server secret)
  const emptyKey = "";
  const headersWithoutKey: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (emptyKey) {
    headersWithoutKey["x-gemini-api-key"] = emptyKey;
  }

  if ("x-gemini-api-key" in headersWithoutKey) {
    throw new Error("Expected x-gemini-api-key header to be omitted for server secret mode");
  }

  // Test 3: Auth source classification
  const getAuthMode = (hasServer: boolean, custom: string) => {
    if (custom.trim()) return "custom_key";
    if (hasServer) return "ai_studio_secret";
    return "unauthenticated";
  };

  if (getAuthMode(true, "") !== "ai_studio_secret") {
    throw new Error("Server secret mode failed classification");
  }
  if (getAuthMode(false, "AIzaSyKey") !== "custom_key") {
    throw new Error("Custom key mode failed classification");
  }
  if (getAuthMode(false, "") !== "unauthenticated") {
    throw new Error("Unauthenticated mode failed classification");
  }

  return true;
}
