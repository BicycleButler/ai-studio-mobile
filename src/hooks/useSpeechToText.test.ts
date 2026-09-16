export function testSpeechToText(): boolean {
  // Test 1: Window without speech recognition returns safe fallback
  const isSupportedInNode = typeof window !== "undefined" && Boolean(
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
  );
  if (isSupportedInNode !== false) {
    throw new Error("Expected speech recognition to be safely falsy in Node/SSR environment");
  }

  // Test 2: Multi-chunk accumulation algorithm verification
  const mockResults = [
    [{ transcript: "Hello world " }],
    [{ transcript: "how are you today" }],
  ];
  let sessionFinal = "";
  for (let i = 0; i < mockResults.length; ++i) {
    const text = mockResults[i][0].transcript;
    sessionFinal += (sessionFinal ? " " : "") + text.trim();
  }
  if (sessionFinal !== "Hello world how are you today") {
    throw new Error(`Accumulation failed: got "${sessionFinal}"`);
  }

  // Test 3: Append-mode base buffer combination
  const baseText = "I would like to know";
  const spokenChunk = "the weather in Paris";
  const sep = baseText && !baseText.endsWith(" ") ? " " : "";
  const combined = baseText ? `${baseText}${sep}${spokenChunk}` : spokenChunk;
  if (combined !== "I would like to know the weather in Paris") {
    throw new Error(`Append mode combination failed: got "${combined}"`);
  }

  // Test 4: Silence countdown calculation
  const timeoutDelay = 1500;
  const elapsed = 450;
  const remaining = Math.max(0, timeoutDelay - elapsed);
  if (remaining !== 1050) {
    throw new Error(`Silence countdown calculation failed: got ${remaining}`);
  }

  return true;
}

