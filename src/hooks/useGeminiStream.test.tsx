import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useGeminiStream } from './useGeminiStream';
import { ServiceProvider } from '../services/ServiceContext';
import { GeminiApiError, IGeminiStreamService } from '../services/geminiStreamService';

describe('useGeminiStream reliability', () => {
  it('exposes latest error synchronously via getLastError when startStream fails', async () => {
    const mockStreamService: IGeminiStreamService = {
      formatStreamError: (err) =>
        err instanceof GeminiApiError ? err : new GeminiApiError(err instanceof Error ? err.message : 'Unknown error'),
      fetchGenerateContent: vi.fn(),
      streamGeminiContent: vi.fn().mockRejectedValue(new GeminiApiError('Quota exceeded for quota metric', 429)),
    };

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ServiceProvider services={{ geminiStreamService: mockStreamService }}>
        {children}
      </ServiceProvider>
    );

    const { result } = renderHook(() => useGeminiStream(), { wrapper });

    let streamResult: unknown = 'unset';
    let syncErrorMessage: string | undefined;

    await act(async () => {
      streamResult = await result.current.startStream({
        model: 'gemini-2.5-flash',
        messages: [{ role: 'user', text: 'hi' }],
      });
      syncErrorMessage = result.current.getLastError()?.message;
    });

    expect(streamResult).toBeNull();
    expect(syncErrorMessage).toContain('Quota exceeded');
    expect(result.current.error).toContain('Quota exceeded');
    expect(result.current.isGenerating).toBe(false);
  });

  it('guards isGenerating and error state against superseded streams', async () => {
    let rejectFirst!: (err: Error) => void;
    let resolveSecond!: (val: { text: string; durationMs: number; totalTokens: number }) => void;

    const streamGeminiContent = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            rejectFirst = reject;
          })
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSecond = resolve;
          })
      );

    const mockStreamService: IGeminiStreamService = {
      formatStreamError: (err) =>
        err instanceof GeminiApiError ? err : new GeminiApiError(err instanceof Error ? err.message : 'Unknown error'),
      fetchGenerateContent: vi.fn(),
      streamGeminiContent,
    };

    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <ServiceProvider services={{ geminiStreamService: mockStreamService }}>
        {children}
      </ServiceProvider>
    );

    const { result } = renderHook(() => useGeminiStream(), { wrapper });

    let p1!: Promise<unknown>;
    let p2!: Promise<unknown>;

    act(() => {
      p1 = result.current.startStream({ model: 'gemini-2.5-flash', messages: [{ role: 'user', text: 'first' }] });
    });
    expect(result.current.isGenerating).toBe(true);

    act(() => {
      p2 = result.current.startStream({ model: 'gemini-2.5-flash', messages: [{ role: 'user', text: 'second' }] });
    });
    expect(result.current.isGenerating).toBe(true);

    // Late rejection from superseded first stream must NOT clear isGenerating or overwrite error
    await act(async () => {
      rejectFirst(new Error('Stale stream 1 failed'));
      await p1;
    });
    expect(result.current.isGenerating).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.getLastError()).toBeNull();

    // Now complete second stream
    await act(async () => {
      resolveSecond({ text: 'second ok', durationMs: 120, totalTokens: 5 });
      await p2;
    });
    expect(result.current.isGenerating).toBe(false);
    expect(result.current.error).toBeNull();
  });
});
