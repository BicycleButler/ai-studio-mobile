/**
 * A generic parser for Server-Sent Events (SSE) streams.
 * Handles buffering partial chunks across TCP packet boundaries to prevent broken payloads.
 */

export type SSEEventCallback = (eventName: string, data: string) => void;

export class SSEStreamParser {
  private buffer: string = "";
  private onEvent: SSEEventCallback;

  /**
   * @param onEvent Callback triggered when a complete SSE event (data payload) is parsed.
   */
  constructor(onEvent: SSEEventCallback) {
    this.onEvent = onEvent;
  }

  /**
   * Processes a new chunk of string data from the stream.
   * Extracts complete 'data: ...' lines and buffers partial lines.
   */
  public processChunk(chunk: string): void {
    this.buffer += chunk;
    const lines = this.buffer.split("\n");
    // Keep the last segment in the buffer as it might be incomplete
    this.buffer = lines.pop() ?? "";

    this.processLines(lines);
  }

  /**
   * Flushes any remaining data in the buffer.
   * Useful when the stream is closed to ensure final lines are processed.
   */
  public flush(): void {
    if (this.buffer) {
      this.processLines([this.buffer]);
      this.buffer = "";
    }
  }

  private processLines(lines: string[]): void {
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || !line.startsWith("data: ")) continue;

      const dataStr = line.slice(6).trim();
      if (!dataStr) continue;

      // Currently hardcoded to emit 'message' events for standard data lines.
      // Can be extended to support event type lines (e.g., 'event: ...').
      this.onEvent("message", dataStr);
    }
  }
}
