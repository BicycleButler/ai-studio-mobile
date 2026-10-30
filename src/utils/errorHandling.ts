export function extractMessageFromUnknown(error: unknown): string | null {
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null) {
    if (Array.isArray(error) && error.length > 0) {
       return extractMessageFromUnknown(error[0]);
    }
    const obj = error as Record<string, unknown>;
    if (obj.error) {
      if (typeof obj.error === "string") return obj.error;
      if (typeof obj.error === "object" && obj.error !== null) {
        const inner = obj.error as Record<string, unknown>;
        if (typeof inner.message === "string") return inner.message;
      }
    }
    if (typeof obj.message === "string") return obj.message;
  }
  return null;
}

function tryParseJsonMessage(msg: string): string | null {
  const trimmed = msg.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed);
      const parsedMsg = extractMessageFromUnknown(parsed);
      if (parsedMsg) return parsedMsg;
    } catch {
      // Fall back to returning null
    }
  }
  return null;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const jsonMsg = tryParseJsonMessage(error.message);
    if (jsonMsg) return jsonMsg;
    return error.message;
  }
  if (typeof error === "string") {
    const jsonMsg = tryParseJsonMessage(error);
    if (jsonMsg) return jsonMsg;
    return error;
  }
  const extracted = extractMessageFromUnknown(error);
  if (extracted) return extracted;
  return "An unexpected error occurred.";
}
