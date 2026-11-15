import { EventEmitter } from "./eventEmitter";

export type ReliabilityEventCategory =
  | "render_error"
  | "stream_error"
  | "storage_degraded"
  | "sync_conflict"
  | "sync_dropped"
  | "unhandled_error";

export interface ReliabilityEvent {
  id: string;
  category: ReliabilityEventCategory;
  message: string;
  scope?: string;
  timestamp: number;
  metadata?: Record<string, string | number | boolean>;
}

const MAX_RELIABILITY_EVENTS = 50;
const RELIABILITY_STORAGE_KEY = "ai_studio_reliability_events_v1";

function redactSecrets(text: string): string {
  return text
    .replace(/AIza[0-9A-Za-z\-_]{35}/g, "[REDACTED_KEY]")
    .replace(/AQ\.[0-9A-Za-z\-_]{10,}/g, "[REDACTED_TOKEN]")
    .replace(/sk-(?:proj-|ant-|or-v1-)?[0-9A-Za-z\-_]{16,}/g, "[REDACTED_KEY]")
    .replace(/gsk_[0-9A-Za-z\-_]{16,}/g, "[REDACTED_KEY]");
}

class ErrorReporter {
  private events: ReliabilityEvent[] = [];
  private emitter = new EventEmitter<ReliabilityEvent>();
  private counter = 0;
  private hydrated = false;

  private hydrate(): void {
    if (this.hydrated) return;
    this.hydrated = true;
    try {
      if (typeof localStorage === "undefined") return;
      const raw = localStorage.getItem(RELIABILITY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        this.events = (parsed as ReliabilityEvent[]).slice(-MAX_RELIABILITY_EVENTS);
      }
    } catch {
      // Ignore storage access/parse errors
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage === "undefined") return;
      localStorage.setItem(RELIABILITY_STORAGE_KEY, JSON.stringify(this.events));
    } catch {
      // Ignore quota/access errors
    }
  }

  public report(
    category: ReliabilityEventCategory,
    message: string,
    options?: {
      scope?: string;
      metadata?: Record<string, string | number | boolean>;
    }
  ): ReliabilityEvent {
    this.hydrate();
    const event: ReliabilityEvent = {
      id: `rel_${Date.now()}_${++this.counter}`,
      category,
      message: redactSecrets(message || "Unknown error"),
      scope: options?.scope,
      timestamp: Date.now(),
      metadata: options?.metadata,
    };

    this.events.push(event);
    if (this.events.length > MAX_RELIABILITY_EVENTS) {
      this.events.shift();
    }
    this.persist();

    this.emitter.emit(event);
    return event;
  }

  public getEvents(): readonly ReliabilityEvent[] {
    this.hydrate();
    return [...this.events];
  }

  public clear(): void {
    this.hydrated = true;
    this.events = [];
    this.persist();
  }

  public exportDiagnosticsJson(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        eventCount: this.getEvents().length,
        events: this.getEvents(),
      },
      null,
      2
    );
  }

  public subscribe(listener: (event: ReliabilityEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }
}

export const errorReporter = new ErrorReporter();
