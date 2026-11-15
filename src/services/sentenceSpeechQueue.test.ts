import { DefaultUrlBuilder } from "../utils/urlUtils";
import { DefaultResponseParser } from "../utils/apiResponseParser";
import { InterceptorManager } from "../utils/apiClientInterceptors";
import { describe, test, expect, vi } from 'vitest';
import { SentenceSpeechQueue } from "./sentenceSpeechQueue";
import { DEFAULT_SPEECH_SETTINGS, SpeechVoicesService } from "./speechVoices";
import { ApiClient } from "../utils/apiClient";
import { AuthService } from "./auth";
import { BrowserPlatformService } from "./platformService";
import { IPlatformService } from "./IPlatformService";

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
    const client = new ApiClient({ interceptorManager: new InterceptorManager(), responseParser: new DefaultResponseParser(), urlBuilder: new DefaultUrlBuilder() });
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

  test('ignores late onend and onerror callbacks emitted after cancel()', () => {
    const client = new ApiClient({ interceptorManager: new InterceptorManager(), responseParser: new DefaultResponseParser(), urlBuilder: new DefaultUrlBuilder() });
    const authService = new AuthService({ apiClient: client, loadStoredApiKeyFn: () => "" });
    const speechVoicesService = new SpeechVoicesService({ apiClient: client, authService });

    const utterances: Array<{
      rate: number;
      voice: SpeechSynthesisVoice | null;
      onstart: (() => void) | null;
      onend: (() => void) | null;
      onerror: ((e: { error: string }) => void) | null;
    }> = [];

    const mockSynth = {
      speaking: false,
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
    } as unknown as SpeechSynthesis;

    const mockPlatform = {
      ...new BrowserPlatformService(),
      getSpeechSynthesis: () => mockSynth,
      createSpeechSynthesisUtterance: () => {
        const u = { rate: 1, voice: null, onstart: null, onend: null, onerror: null };
        utterances.push(u);
        return u as unknown as SpeechSynthesisUtterance;
      },
    };

    const onSentenceEnd = vi.fn();
    const onAllSentencesCompleted = vi.fn();
    const onInterrupted = vi.fn();

    const queue = new SentenceSpeechQueue({
      speechSettings: DEFAULT_SPEECH_SETTINGS,
      speechVoicesService,
      platformService: mockPlatform as unknown as IPlatformService,
      onSentenceEnd,
      onAllSentencesCompleted,
      onInterrupted,
    });

    queue.feed("First sentence finished. Second sentence here.", true);
    expect(utterances.length).toBe(1);

    queue.cancel();
    expect(onInterrupted).toHaveBeenCalledTimes(1);

    // Simulate browser asynchronously firing onerror/onend after cancel()
    utterances[0].onerror?.({ error: "canceled" });
    utterances[0].onend?.();

    expect(onSentenceEnd).not.toHaveBeenCalled();
    expect(onAllSentencesCompleted).not.toHaveBeenCalled();
  });
});
