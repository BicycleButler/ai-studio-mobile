import { ILogger, DefaultLoggerFactory } from "./logger";
import { OfflineMutation, ConflictData, SyncHandler } from "./offlineService";

export interface QueueProcessResult {
  success: boolean;
  conflicts: ConflictData[];
  successfulIds: string[];
  updatedMutations?: OfflineMutation[];
  droppedIds?: string[];
  droppedMutations?: OfflineMutation[];
}

export interface IQueueProcessingStrategy {
  process(
    queue: OfflineMutation[],
    syncRegistry: Record<string, SyncHandler>,
    logger?: ILogger
  ): Promise<QueueProcessResult>;
}

export interface StrictFifoStrategyOptions {
  maxRetries?: number;
  baseBackoffMs?: number;
  maxBackoffMs?: number;
  nowFn?: () => number;
}

export class StrictFifoQueueProcessingStrategy implements IQueueProcessingStrategy {
  private maxRetries: number;
  private baseBackoffMs: number;
  private maxBackoffMs: number;
  private nowFn: () => number;

  constructor(options: StrictFifoStrategyOptions = {}) {
    this.maxRetries = options.maxRetries ?? 5;
    this.baseBackoffMs = options.baseBackoffMs ?? 2000;
    this.maxBackoffMs = options.maxBackoffMs ?? 60_000;
    this.nowFn = options.nowFn ?? (() => Date.now());
  }

  async process(
    queue: OfflineMutation[],
    syncRegistry: Record<string, SyncHandler>,
    logger: ILogger = new DefaultLoggerFactory().createLogger()
  ): Promise<QueueProcessResult> {
    if (queue.length === 0) {
      return { success: true, conflicts: [], successfulIds: [], updatedMutations: [], droppedIds: [], droppedMutations: [] };
    }

    const remainingQueue: OfflineMutation[] = [];
    const conflicts: ConflictData[] = [];
    const updatedMutations: OfflineMutation[] = [];
    const droppedIds: string[] = [];
    const droppedMutations: OfflineMutation[] = [];
    let processSuccess = true;
    const now = this.nowFn();

    for (let i = 0; i < queue.length; i++) {
      const mutation = queue[i];

      // Respect backoff window on head-of-queue mutation before hammering backend
      if (mutation.nextRetryAt && mutation.nextRetryAt > now) {
        processSuccess = false;
        remainingQueue.push(...queue.slice(i));
        break;
      }

      let success = false;
      let retryable = true;
      let conflict: ConflictData | undefined;
      let lastErrorMsg: string | undefined;
      try {
        const handler = syncRegistry[mutation.type];
        if (handler) {
          const result = await handler(mutation);
          success = result.success;
          if (result.retryable !== undefined) {
            retryable = result.retryable;
          }
          if (result.conflict) {
            conflict = result.conflict;
            conflicts.push(result.conflict);
          }
        } else {
          success = true; // No handler means we can safely drop it
        }
      } catch (e: unknown) {
        lastErrorMsg = e instanceof Error ? e.message : String(e);
        logger.error(`Failed to sync offline mutation ${mutation.type}`, e);
      }

      if (!success) {
        if (conflict) {
          // Halt queue processing and keep conflicting mutation in store until resolved by the user
          processSuccess = false;
          remainingQueue.push(...queue.slice(i));
          break;
        }
        if (!retryable) {
          logger.warn(`Dropping non-retryable offline mutation ${mutation.type}`);
          droppedIds.push(mutation.id);
          continue; // Drop from queue without halting the rest
        }

        const nextAttempts = (mutation.attempts ?? 0) + 1;
        if (nextAttempts >= this.maxRetries) {
          logger.error(
            `Moving poison-pill offline mutation ${mutation.type} (${mutation.id}) to dead-letter queue after ${nextAttempts} failed attempts.`
          );
          droppedIds.push(mutation.id);
          droppedMutations.push({
            ...mutation,
            attempts: nextAttempts,
            lastError: lastErrorMsg || mutation.lastError,
          });
          continue; // Prevent permanent head-of-line blocking
        }

        const backoffMs = Math.min(
          this.maxBackoffMs,
          this.baseBackoffMs * Math.pow(2, nextAttempts - 1)
        );
        updatedMutations.push({
          ...mutation,
          attempts: nextAttempts,
          lastError: lastErrorMsg || mutation.lastError,
          nextRetryAt: this.nowFn() + backoffMs,
        });

        // Strict FIFO Halting: Break out of the processing loop on retryable failure below maxRetries.
        processSuccess = false;
        remainingQueue.push(...queue.slice(i));
        break;
      }
    }

    const successfulIds = queue
      .filter((m) => !remainingQueue.some((rm) => rm.id === m.id))
      .map((m) => m.id);

    return {
      success: processSuccess,
      conflicts,
      successfulIds,
      updatedMutations,
      droppedIds,
      droppedMutations,
    };
  }
}
