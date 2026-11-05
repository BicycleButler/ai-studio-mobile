import { describe, test } from 'vitest';
import { SentenceSpeechQueue } from "./sentenceSpeechQueue";
import { DEFAULT_SPEECH_SETTINGS, SpeechVoicesService } from "./speechVoices";
import { ApiClient } from "../utils/apiClient";
import { AuthService } from "./auth";

describe('testSentenceSpeechQueue', () => {
  test('main', () => {


  // 1. Static sentence extraction verification during streaming
  {
    const text = "Hello there! This is sentence two. Here is sentence three? And a final one.";
    const result = SentenceSpeechQueue.extractSentences(text, true);
    if (result.sentences.length < 4) {
      throw new Error(`Expected 4 extracted sentences, got ${result.sentences.length}`);
    }
    if (!result.sentences[0].includes("Hello there")) {
      throw new Error(`First sentence mismatch: ${result.sentences[0]}`);
    }
  }

  // 2. Cancellation and buffer reset
  {
    const client = new ApiClient();
    const authService = new AuthService({ apiClient: client, loadStoredApiKeyFn: () => "" });
    const speechVoicesService = new SpeechVoicesService({ apiClient: client, authService: authService });

    const queue = new SentenceSpeechQueue({
      speechSettings: DEFAULT_SPEECH_SETTINGS,
      speechVoicesService: speechVoicesService,
    });
    queue.feed("First sentence here. Second sentence starts.", true);
    queue.cancel();
    if (queue.getQueueLength() !== 0) {
      throw new Error("Queue length should be 0 after cancel()");
    }
  }

  // 3. Multiline paragraph boundaries and finalize remainder
  {
    const markdown = "First paragraph content.\n\nSecond paragraph content follows.";
    const result = SentenceSpeechQueue.extractSentences(markdown, true);
    if (result.sentences.length !== 2) {
      throw new Error(`Expected 2 sentences split by double newline paragraph, got ${result.sentences.length}`);
    }
    if (!result.remainder.includes("follows")) {
      throw new Error(`Expected remainder to be the second paragraph, got ${result.remainder}`);
    }
  }



  });
});
