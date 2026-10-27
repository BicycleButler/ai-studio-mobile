import { getSafeWindowSpeechSynthesis } from "../utils/platform";
/**
 * Sentence-Pipelined Speech Queue
 * Delivers ultra-low-latency voice playback for AI streaming responses:
 * - Chunks streaming tokens at natural sentence boundaries (. ! ? \n)
 * - Feeds complete sentences sequentially into browser SpeechSynthesis
 * - Starts speech playback within ~250-400ms instead of waiting for entire generation
 * - Fixes Chrome 15s SpeechSynthesis stall bug via an anti-freeze heartbeat
 * - Fully 100% free and client-side (no external API calls or network fees)
 */

import { extractSpokenText } from "../utils/speechExtractor";
import { SpeechSettings, ISpeechVoicesService } from "./speechVoices";
import { defaultSpeechVoicesService } from "./speechVoices"; // Default fallback if not injected

export interface SentenceQueueOptions {
  speechSettings: SpeechSettings;
  speechVoicesService?: ISpeechVoicesService;
  getWindowSpeechSynthesis?: typeof getSafeWindowSpeechSynthesis;
  onSentenceStart?: (sentence: string, index: number) => void;
  onSentenceEnd?: (sentence: string, index: number) => void;
  onAllSentencesCompleted?: () => void;
  onInterrupted?: () => void;
  onError?: (err: unknown) => void;
}

export class SentenceSpeechQueue {
  private buffer = "";
  private processedIndex = 0;
  private sentenceCount = 0;
  private pendingUtterances: SpeechSynthesisUtterance[] = [];
  private isSpeaking = false;
  private isFinalized = false;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private options: SentenceQueueOptions;
  private getWindowSpeechSynthesis: typeof getSafeWindowSpeechSynthesis;

  constructor(options: SentenceQueueOptions) {
    this.options = options;
    this.getWindowSpeechSynthesis = options.getWindowSpeechSynthesis || getSafeWindowSpeechSynthesis;
  }

  public updateSettings(settings: SpeechSettings): void {
    this.options.speechSettings = settings;
  }

  /**
   * Feed streaming markdown/text tokens.
   * Splits at sentence boundaries and immediately dispatches completed sentences to speech synthesis.
   */
  public feed(fullStreamedText: string, isStreaming = true): void {
    const synth = this.getWindowSpeechSynthesis();
    if (!synth) {
      return;
    }

    this.buffer = fullStreamedText;

    // Look for new complete sentences beyond what we've already dispatched
    const remaining = this.buffer.slice(this.processedIndex);

    // Sentence splitting regex: matches sentence endings (. ! ? or \n\n) followed by whitespace
    // Avoids splitting on common abbreviations like e.g., i.e., vs.
    const sentenceSplitRegex = /(?<=[.!?])\s+|\n\n+/g;
    let match: RegExpExecArray | null;
    let lastMatchEnd = 0;

    while ((match = sentenceSplitRegex.exec(remaining)) !== null) {
      const rawCandidate = remaining.slice(lastMatchEnd, match.index).trim();
      // Avoid premature splitting on common abbreviations
      if (/(?:e\.g|i\.e|vs|mr|mrs|ms|dr|prof|etc)\.$/i.test(rawCandidate)) {
        continue;
      }
      const sentenceEnd = match.index + match[0].length;
      lastMatchEnd = sentenceEnd;

      if (rawCandidate.length > 0) {
        this.enqueueSentence(rawCandidate);
      }
    }

    if (lastMatchEnd > 0) {
      this.processedIndex += lastMatchEnd;
    }

    if (!isStreaming) {
      this.finalize();
    }
  }

  /**
   * Called when stream generation finishes. Dispatches any trailing sentence leftover in the buffer.
   */
  public finalize(): void {
    if (this.isFinalized) return;
    this.isFinalized = true;

    const remaining = this.buffer.slice(this.processedIndex).trim();
    if (remaining.length > 0) {
      this.enqueueSentence(remaining);
      this.processedIndex = this.buffer.length;
    }

    // If no utterances are in flight or queued, finish immediately
    if (this.pendingUtterances.length === 0) {
      this.isSpeaking = false;
      this.stopHeartbeat();
      this.options.onAllSentencesCompleted?.();
    }
  }

  /**
   * Prepares and enqueues a clean sentence utterance
   */
  private enqueueSentence(rawSentence: string): void {
    const synth = this.getWindowSpeechSynthesis();
    if (!synth) return;

    const spokenText = extractSpokenText(rawSentence, false).trim();
    if (!spokenText || spokenText.length < 2) return;

    try {
      const utterance = new SpeechSynthesisUtterance(spokenText);
      const settings = this.options.speechSettings;

      utterance.rate = Math.max(0.5, Math.min(2.0, settings.playbackRate || 1.0));

      // Resolve best natural or preferred voice
      const service = this.options.speechVoicesService || defaultSpeechVoicesService;
      const bestVoice = service.getBestNaturalDeviceVoice(settings.deviceVoiceURI);
      if (bestVoice) {
        utterance.voice = bestVoice;
      }

      const idx = this.sentenceCount++;

      utterance.onstart = () => {
        this.isSpeaking = true;
        this.startHeartbeat();
        this.options.onSentenceStart?.(spokenText, idx);
      };

      utterance.onend = () => {
        // Remove from pending list
        this.pendingUtterances = this.pendingUtterances.filter((u) => u !== utterance);
        this.options.onSentenceEnd?.(spokenText, idx);

        if (this.pendingUtterances.length === 0) {
          if (this.isFinalized) {
            this.isSpeaking = false;
            this.stopHeartbeat();
            this.options.onAllSentencesCompleted?.();
          } else {
            this.isSpeaking = false;
          }
        }
      };

      utterance.onerror = (e) => {
        // "interrupted" or "canceled" are standard when stop/cancel is called
        if (e.error !== "interrupted" && e.error !== "canceled") {
          this.options.onError?.(e);
        }
        this.pendingUtterances = this.pendingUtterances.filter((u) => u !== utterance);
        if (this.pendingUtterances.length === 0) {
          if (this.isFinalized) {
            this.isSpeaking = false;
            this.stopHeartbeat();
            this.options.onAllSentencesCompleted?.();
          } else {
            this.isSpeaking = false;
          }
        }
      };

      this.pendingUtterances.push(utterance);
      synth.speak(utterance);
      this.startHeartbeat();
    } catch (err: unknown) {
      this.options.onError?.(err);
    }
  }

  /**
   * Chrome bug workaround: SpeechSynthesis pauses silently on longer utterances or across queues.
   * Periodically calling pause() and resume() keeps the audio thread alive.
   */
  private startHeartbeat(): void {
    if (this.heartbeatTimer) return;
    this.heartbeatTimer = setInterval(() => {
      const synth = this.getWindowSpeechSynthesis();
      if (synth && synth.speaking) {
        synth.pause();
        synth.resume();
      }
    }, 4500);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Immediately stops all pending and active speech
   */
  public cancel(): void {
    this.stopHeartbeat();
    this.pendingUtterances = [];
    this.isSpeaking = false;
    this.isFinalized = true;

    const synth = this.getWindowSpeechSynthesis();
    if (synth) {
      try {
        synth.cancel();
      } catch {
        // Safe ignore
      }
    }

    this.options.onInterrupted?.();
  }

  public getIsSpeaking(): boolean {
    return this.isSpeaking || Boolean(this.getWindowSpeechSynthesis()?.speaking);
  }

  public getQueueLength(): number {
    return this.pendingUtterances.length;
  }

  public getProcessedIndex(): number {
    return this.processedIndex;
  }

  /**
   * Pure sentence boundary extractor for unit tests and token streaming analysis
   */
  public static extractSentences(
    text: string,
    includeTrailingRemainder = false
  ): { sentences: string[]; lastIndex: number; remainder: string } {
    const sentenceSplitRegex = /(?<=[.!?])\s+|\n\n+/g;
    let match: RegExpExecArray | null;
    let lastMatchEnd = 0;
    const sentences: string[] = [];

    while ((match = sentenceSplitRegex.exec(text)) !== null) {
      const rawCandidate = text.slice(lastMatchEnd, match.index).trim();
      if (/(?:e\.g|i\.e|vs|mr|mrs|ms|dr|prof|etc)\.$/i.test(rawCandidate)) {
        continue;
      }
      const sentenceEnd = match.index + match[0].length;
      lastMatchEnd = sentenceEnd;

      if (rawCandidate.length > 0) {
        sentences.push(rawCandidate);
      }
    }

    const remainder = text.slice(lastMatchEnd).trim();
    if (includeTrailingRemainder && remainder.length > 0) {
      sentences.push(remainder);
    }

    return { sentences, lastIndex: lastMatchEnd, remainder };
  }
}
