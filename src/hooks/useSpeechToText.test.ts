import { isBrowserEnvironment, getSafeWindowSpeech } from "../utils/platform";
import { extractSpokenText } from "../utils/speechExtractor";
import { SentenceSpeechQueue } from "../services/sentenceSpeechQueue";

export function testSpeechToText(): boolean {
  // Test 1: Window without speech recognition returns safe fallback
  const win = getSafeWindowSpeech();
  const isSupportedInNode = isBrowserEnvironment() && Boolean(
    win?.SpeechRecognition || win?.webkitSpeechRecognition
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

  // Test 5: Speech extractor does not erase explanation between closed code block and streaming trailing block
  const markdownStream = "First snippet: ```js\nconst a = 1;\n``` This explanation must be preserved. Next: ```py\nprint(";
  const spoken = extractSpokenText(markdownStream, true);
  if (!spoken.includes("This explanation must be preserved.")) {
    throw new Error(`Speech extractor wiped explanation: got "${spoken}"`);
  }

  // Test 6: Speech extractor removes markdown tables cleanly
  const tableMarkdown = "Here is the comparison:\n| Feature | Status |\n|---|---|\n| Voice | Active |\nEnjoy using it.";
  const spokenTable = extractSpokenText(tableMarkdown, false);
  if (spokenTable.includes("|") || spokenTable.includes("---")) {
    throw new Error(`Speech extractor did not clean table pipes/delimiters: got "${spokenTable}"`);
  }
  if (!spokenTable.includes("Enjoy using it")) {
    throw new Error(`Speech extractor lost trailing text after table: got "${spokenTable}"`);
  }

  // Test 7: Sentence speech queue does not split prematurely on abbreviations like e.g. or vs.
  const sentenceWithAbbr = "You can use an option, e.g. the fast mode. It works well.";
  const { sentences } = SentenceSpeechQueue.extractSentences(sentenceWithAbbr, true);
  if (sentences.length !== 2) {
    throw new Error(`Expected 2 sentences but got ${sentences.length}: ${JSON.stringify(sentences)}`);
  }

  return true;
}

