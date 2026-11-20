import { describe, it, expect } from "vitest";
import { createStreamCoalescer } from "./streamCoalescer";

describe("createStreamCoalescer", () => {
  it("emits the first chunk immediately for 0ms TTFT and coalesces rapid burst chunks", () => {
    const emitted: string[] = [];
    let currentTime = 1000;
    const timers: Array<{ id: number; cb: () => void; delay: number; cancelled: boolean }> = [];
    let nextId = 1;

    const coalescer = createStreamCoalescer<string>((val) => emitted.push(val), {
      intervalMs: 32,
      now: () => currentTime,
      schedule: (cb, delay) => {
        const entry = { id: nextId++, cb, delay, cancelled: false };
        timers.push(entry);
        return entry;
      },
      cancelSchedule: (handle) => {
        (handle as { cancelled: boolean }).cancelled = true;
      },
    });

    // First chunk emits immediately
    coalescer.push("H");
    expect(emitted).toEqual(["H"]);
    expect(timers).toHaveLength(0);

    // Rapid burst within 32ms window should coalesce to a single scheduled emit
    currentTime = 1005;
    coalescer.push("He");
    currentTime = 1010;
    coalescer.push("Hel");
    currentTime = 1015;
    coalescer.push("Hello");

    expect(emitted).toEqual(["H"]);
    expect(timers).toHaveLength(1);
    expect(timers[0].delay).toBe(27);

    // Timer fires -> delivers latest coalesced value
    currentTime = 1032;
    timers[0].cb();
    expect(emitted).toEqual(["H", "Hello"]);

    // Subsequent chunk after interval has elapsed emits immediately again
    currentTime = 1070;
    coalescer.push("Hello world");
    expect(emitted).toEqual(["H", "Hello", "Hello world"]);
  });

  it("delivers pending coalesced value synchronously on flush() and cancels pending timer", () => {
    const emitted: string[] = [];
    let currentTime = 1000;
    const timers: Array<{ cb: () => void; cancelled: boolean }> = [];

    const coalescer = createStreamCoalescer<string>((val) => emitted.push(val), {
      intervalMs: 32,
      now: () => currentTime,
      schedule: (cb) => {
        const entry = { cb, cancelled: false };
        timers.push(entry);
        return entry;
      },
      cancelSchedule: (handle) => {
        (handle as { cancelled: boolean }).cancelled = true;
      },
    });

    coalescer.push("chunk-1");
    currentTime = 1005;
    coalescer.push("chunk-2");
    currentTime = 1008;
    coalescer.push("chunk-3");
    expect(emitted).toEqual(["chunk-1"]);
    expect(timers).toHaveLength(1);

    coalescer.flush();
    expect(timers[0].cancelled).toBe(true);
    expect(emitted).toEqual(["chunk-1", "chunk-3"]);

    // Calling flush again without pending data is a no-op
    coalescer.flush();
    expect(emitted).toEqual(["chunk-1", "chunk-3"]);
  });

  it("drops pending chunks and ignores subsequent pushes after cancel()", () => {
    const emitted: string[] = [];
    let currentTime = 1000;
    const timers: Array<{ cb: () => void; cancelled: boolean }> = [];

    const coalescer = createStreamCoalescer<string>((val) => emitted.push(val), {
      intervalMs: 32,
      now: () => currentTime,
      schedule: (cb) => {
        const entry = { cb, cancelled: false };
        timers.push(entry);
        return entry;
      },
      cancelSchedule: (handle) => {
        (handle as { cancelled: boolean }).cancelled = true;
      },
    });

    coalescer.push("first");
    currentTime = 1004;
    coalescer.push("second");
    expect(emitted).toEqual(["first"]);

    coalescer.cancel();
    expect(timers[0].cancelled).toBe(true);

    // Even if timer callback fires late or push/flush are called, nothing emits
    timers[0].cb();
    coalescer.push("third");
    coalescer.flush();
    expect(emitted).toEqual(["first"]);
  });

  it("passes every chunk through immediately when intervalMs <= 0", () => {
    const emitted: number[] = [];
    const coalescer = createStreamCoalescer<number>((val) => emitted.push(val), {
      intervalMs: 0,
    });

    coalescer.push(1);
    coalescer.push(2);
    coalescer.push(3);
    expect(emitted).toEqual([1, 2, 3]);
  });
});
