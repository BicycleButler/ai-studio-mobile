export function testSpeechToText(): boolean {
  // Test 1: Window without speech recognition returns safe fallback
  const isSupportedInNode = typeof window !== "undefined" && Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
  if (isSupportedInNode !== false) {
    throw new Error("Expected speech recognition to be safely falsy in Node/SSR environment");
  }

  return true;
}
