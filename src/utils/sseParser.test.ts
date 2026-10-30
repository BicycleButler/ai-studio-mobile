import { describe, it, expect, vi } from 'vitest';
import { SSEStreamParser } from './sseParser';

describe('SSEStreamParser', () => {
  it('should parse complete event correctly', () => {
    const onEvent = vi.fn();
    const parser = new SSEStreamParser(onEvent);

    parser.processChunk("data: hello\n\n");

    expect(onEvent).toHaveBeenCalledWith("message", "hello");
  });

  it('should parse multiple complete events correctly', () => {
    const onEvent = vi.fn();
    const parser = new SSEStreamParser(onEvent);

    parser.processChunk("data: hello\n\ndata: world\n\n");

    expect(onEvent).toHaveBeenCalledTimes(2);
    expect(onEvent).toHaveBeenNthCalledWith(1, "message", "hello");
    expect(onEvent).toHaveBeenNthCalledWith(2, "message", "world");
  });

  it('should handle split chunks across lines', () => {
    const onEvent = vi.fn();
    const parser = new SSEStreamParser(onEvent);

    parser.processChunk("data: he");
    parser.processChunk("llo\n\n");

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith("message", "hello");
  });

  it('should parse event name', () => {
    const onEvent = vi.fn();
    const parser = new SSEStreamParser(onEvent);

    parser.processChunk("event: custom\ndata: hello\n\n");

    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith("custom", "hello");
  });

  it('should flush correctly', () => {
    const onEvent = vi.fn();
    const parser = new SSEStreamParser(onEvent);

    parser.processChunk("data: incomplete");
    expect(onEvent).not.toHaveBeenCalled();

    parser.flush();
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith("message", "incomplete");
  });

  it('should ignore comment lines', () => {
    const onEvent = vi.fn();
    const parser = new SSEStreamParser(onEvent);

    parser.processChunk(": comment\ndata: hello\n\n");
    expect(onEvent).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledWith("message", "hello");
  });
});
