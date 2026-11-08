/**
 * A generic parser for Server-Sent Events (SSE) streams.
 * Handles buffering partial chunks across TCP packet boundaries to prevent broken payloads.
 */

export type SSEEventCallback = (eventName: string, data: string) => void;

export interface ISSEStreamParser {
  processChunk(chunk: string): void;
  flush(): void;
}

export interface ISSEStreamParserFactory {
  create(onEvent: SSEEventCallback): ISSEStreamParser;
}

export class SSEStreamParser implements ISSEStreamParser {
  private buffer: string = "";
  private onEvent: SSEEventCallback;
  private currentEventName: string = "message";
  private currentData: string[] = [];

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
    this.dispatchCurrentEvent();
  }

  private dispatchCurrentEvent(): void {
    if (this.currentData.length > 0) {
      this.onEvent(this.currentEventName, this.currentData.join("\n"));
      this.currentData = [];
    }
    this.currentEventName = "message"; // Reset to default
  }

  private processLines(lines: string[]): void {
    for (const rawLine of lines) {
      // Lines ending in \r need to be stripped
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;

      if (line === "") {
        // Empty line signifies the end of an event
        this.dispatchCurrentEvent();
        continue;
      }

      if (line.startsWith("event:")) {
        this.currentEventName = line.slice(6).trim() || "message";
      } else if (line.startsWith("data:")) {
        this.currentData.push(line.slice(5).trim());
      } else if (line.startsWith(":")) {
        // Comment line, ignore
        continue;
      } else if (line.includes(":")) {
         // other field types could be handled here (id, retry)
      } else {
         // this line is just data if it has no colon according to SSE spec
         this.currentData.push(line);
      }
    }
  }
}
