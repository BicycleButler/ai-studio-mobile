export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const trimmed = error.message.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.error?.message) {
          return String(parsed.error.message);
        }
      } catch {
        // Fall back to raw message
      }
    }
    return error.message;
  }
  if (typeof error === "string") {
    const trimmed = error.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.error?.message) {
          return String(parsed.error.message);
        }
      } catch {
        // Fall back to raw string
      }
    }
    return error;
  }
  if (typeof error === "object" && error !== null) {
    const obj = error as Record<string, unknown>;
    if (obj.error && typeof obj.error === "object" && obj.error !== null) {
      const inner = obj.error as Record<string, unknown>;
      if (typeof inner.message === "string") return inner.message;
    }
    if (typeof obj.message === "string") return obj.message;
  }
  return "An unexpected error occurred.";
}
