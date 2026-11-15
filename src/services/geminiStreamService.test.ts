import { describe, test, expect, vi, beforeEach } from 'vitest';
import { GeminiStreamService, GeminiApiError } from './geminiStreamService';
import { DefaultUrlBuilder } from '../utils/urlUtils';
import { DefaultResponseParser } from '../utils/apiResponseParser';
import { InterceptorManager } from '../utils/apiClientInterceptors';
import { DefaultLoggerFactory } from '../utils/logger';
import { ApiClient } from '../utils/apiClient';
import { errorReporter } from '../utils/errorReporter';

describe('testStreamService', () => {
  beforeEach(() => {
    errorReporter.clear();
  });

  test('headers, error classification, and abort formatting', () => {
    const testGeminiStreamService = new GeminiStreamService({
      apiClient: new ApiClient({
        interceptorManager: new InterceptorManager(),
        responseParser: new DefaultResponseParser(),
        urlBuilder: new DefaultUrlBuilder(),
      }),
      logger: new DefaultLoggerFactory().createLogger(),
    });

    const defaultHeaders = testGeminiStreamService.buildHeaders();
    expect(defaultHeaders['Content-Type']).toBe('application/json');
    expect(defaultHeaders['x-gemini-api-key']).toBeUndefined();

    const customHeaders = testGeminiStreamService.buildHeaders('test-custom-key-123');
    expect(customHeaders['x-gemini-api-key']).toBe('test-custom-key-123');

    const rateLimitErr = new GeminiApiError('Resource exhausted: quota exceeded', 429);
    expect(rateLimitErr.isQuotaError).toBe(true);

    const authErr = new GeminiApiError('Invalid API key provided', 403);
    expect(authErr.isAuthError).toBe(true);

    const unavailableErr = new GeminiApiError('The service is currently unavailable.', 503);
    expect(unavailableErr.isUnavailable).toBe(true);

    const gatewayErr = new GeminiApiError('Bad gateway', 502);
    expect(gatewayErr.isUnavailable).toBe(true);

    const abortErr = new Error('AbortError');
    abortErr.name = 'AbortError';
    const formattedAbort = testGeminiStreamService.formatStreamError(abortErr);
    expect(formattedAbort.message).toContain('stopped by user');
  });

  test('retries pre-stream transient 503 error once and succeeds on retry', async () => {
    let attempts = 0;
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(
          encoder.encode('data: {"text":"Hello "}\n\ndata: {"text":"world"}\n\ndata: {"done":true,"durationMs":5,"usageMetadata":{"totalTokenCount":2}}\n\n')
        );
        controller.close();
      },
    });

    const mockApiClient = {
      fetchStream: vi.fn(async () => {
        attempts++;
        if (attempts === 1) {
          throw new (await import('../utils/apiClient')).BaseApiError('Temporary 503', 503);
        }
        return new Response(sseStream, {
          status: 200,
          headers: { 'Content-Type': 'text/event-stream' },
        });
      }),
    } as unknown as ApiClient;

    const service = new GeminiStreamService({
      apiClient: mockApiClient,
      logger: new DefaultLoggerFactory().createLogger(),
      maxConnectRetries: 1,
      retryDelayMs: 5,
      connectTimeoutMs: 5000,
    });

    const chunks: string[] = [];
    const result = await service.streamGeminiContent(
      { model: 'gemini-2.5-flash', messages: [{ role: 'user', text: 'hi' }] },
      { onChunk: (acc: string) => chunks.push(acc) }
    );

    expect(attempts).toBe(2);
    expect(result.text).toBe('Hello world');
  });

  test('aborts stalled stream on chunk idle timeout and redacts leaked API keys in errorReporter', async () => {
    const leakedKey = 'AIzaSyDummyKey1234567890ABCDEFGHIJKLMNO';
    const neverEndingStream = new ReadableStream<Uint8Array>({
      start() {
        // Keep stream open without sending chunks to trigger idle timeout
      },
    });

    const mockApiClient = {
      fetchStream: vi.fn(async () => new Response(neverEndingStream, { status: 200 })),
    } as unknown as ApiClient;

    const service = new GeminiStreamService({
      apiClient: mockApiClient,
      logger: new DefaultLoggerFactory().createLogger(),
      chunkIdleTimeoutMs: 40,
      maxConnectRetries: 0,
    });

    await expect(
      service.streamGeminiContent(
        { model: 'gemini-2.5-flash', messages: [{ role: 'user', text: 'hi' }] },
        { onChunk: () => {} }
      )
    ).rejects.toThrow(/stalled|timed out/i);

    const reported = errorReporter.report('stream_error', `Failure using key ${leakedKey}`);
    expect(reported.message).not.toContain(leakedKey);
    expect(reported.message).toContain('[REDACTED_KEY]');
  });

  test('throws 502 GeminiApiError when SSE stream closes empty without any events', async () => {
    const emptyStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });

    const mockApiClient = {
      fetchStream: vi.fn(async () => new Response(emptyStream, { status: 200 })),
    } as unknown as ApiClient;

    const service = new GeminiStreamService({
      apiClient: mockApiClient,
      logger: new DefaultLoggerFactory().createLogger(),
      maxConnectRetries: 0,
    });

    await expect(
      service.streamGeminiContent(
        { model: 'gemini-2.5-flash', messages: [{ role: 'user', text: 'hi' }] },
        { onChunk: () => {} }
      )
    ).rejects.toMatchObject({
      statusCode: 502,
      message: expect.stringMatching(/without receiving a response/i),
    });
  });

  test('retries pre-stream connect timeout with a fresh AbortSignal and succeeds on attempt 2', async () => {
    const signals: Array<AbortSignal | undefined> = [];
    const encoder = new TextEncoder();
    const sseStream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"text":"Retried OK"}\n\ndata: {"done":true}\n\n'));
        controller.close();
      },
    });

    const mockApiClient = {
      fetchStream: vi.fn((_endpoint: string, opts?: RequestInit) => {
        signals.push(opts?.signal ?? undefined);
        if (signals.length === 1) {
          return new Promise<Response>((_resolve, reject) => {
            opts?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            }, { once: true });
          });
        }
        return Promise.resolve(new Response(sseStream, { status: 200 }));
      }),
    } as unknown as ApiClient;

    const service = new GeminiStreamService({
      apiClient: mockApiClient,
      logger: new DefaultLoggerFactory().createLogger(),
      connectTimeoutMs: 30,
      maxConnectRetries: 1,
      retryDelayMs: 5,
    });

    const result = await service.streamGeminiContent(
      { model: 'gemini-2.5-flash', messages: [{ role: 'user', text: 'hi' }] },
      { onChunk: () => {} }
    );

    expect(signals.length).toBe(2);
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(signals[0]).not.toBe(signals[1]);
    expect(result.text).toBe('Retried OK');
  });

  test('throws 504 GeminiApiError if all pre-stream connect attempts time out', async () => {
    let calls = 0;
    const mockApiClient = {
      fetchStream: vi.fn((_endpoint: string, opts?: RequestInit) => {
        calls++;
        return new Promise<Response>((_resolve, reject) => {
          opts?.signal?.addEventListener('abort', () => {
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        });
      }),
    } as unknown as ApiClient;

    const service = new GeminiStreamService({
      apiClient: mockApiClient,
      logger: new DefaultLoggerFactory().createLogger(),
      connectTimeoutMs: 25,
      maxConnectRetries: 1,
      retryDelayMs: 5,
    });

    await expect(
      service.streamGeminiContent(
        { model: 'gemini-2.5-flash', messages: [{ role: 'user', text: 'hi' }] },
        { onChunk: () => {} }
      )
    ).rejects.toMatchObject({
      statusCode: 504,
      message: expect.stringMatching(/Connection timed out/i),
    });

    expect(calls).toBe(2);
  });
});
