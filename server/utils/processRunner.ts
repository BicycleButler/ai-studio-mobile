import { spawn, SpawnOptionsWithoutStdio } from "node:child_process";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import { ITimeProvider, DefaultTimeProvider } from "../../src/utils/timeProvider";

export interface ProcessLogEvent {
  type: "start" | "stdout" | "stderr" | "error" | "exit";
  text: string;
  timestamp: number;
  code?: number;
}

export interface ProcessRunnerOptions extends SpawnOptionsWithoutStdio {
  timeoutMs?: number;
  maxOutputBytes?: number;
}

export interface IProcessRunner {
  runCommand(
    executablePath: string,
    args: string[],
    options?: ProcessRunnerOptions,
    eventEmitter?: EventEmitter
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

const DEFAULT_TIMEOUT_MS = 60_000;
const DEFAULT_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export class ProcessRunner implements IProcessRunner {
  constructor(private timeProvider: ITimeProvider = new DefaultTimeProvider()) {}

  public async runCommand(
    executablePath: string,
    args: string[] = [],
    options?: ProcessRunnerOptions,
    eventEmitter?: EventEmitter
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    const maxOutputBytes = options?.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;

    return new Promise((resolve, reject) => {
      fs.promises.access(executablePath).then(() => {
        if (eventEmitter) {
          eventEmitter.emit("log", {
            type: "start",
            text: `\x1b[36m$ node ${executablePath} ${args.join(" ")}\x1b[0m`,
            timestamp: this.timeProvider.now(),
          });
        }

        const { timeoutMs: _t, maxOutputBytes: _m, ...spawnOpts } = options || {};
        const child = spawn("node", [executablePath, ...args], {
          ...spawnOpts,
          env: { ...process.env, FORCE_COLOR: "1", ...(spawnOpts.env || {}) },
        });

        let stdout = "";
        let stderr = "";
        let stdoutTruncated = false;
        let stderrTruncated = false;
        let settled = false;
        let killTimer: ReturnType<typeof setTimeout> | undefined;

        const timeoutTimer =
          timeoutMs > 0
            ? setTimeout(() => {
                if (settled) return;
                settled = true;
                const timeoutMsg = `Process timed out after ${timeoutMs}ms`;
                try {
                  child.kill("SIGTERM");
                  killTimer = setTimeout(() => {
                    try {
                      child.kill("SIGKILL");
                    } catch {
                      // ignore
                    }
                  }, 2000);
                } catch {
                  // ignore
                }
                if (eventEmitter) {
                  eventEmitter.emit("log", {
                    type: "error",
                    text: `[Execution timeout: ${timeoutMsg}]`,
                    timestamp: this.timeProvider.now(),
                  });
                }
                reject(new Error(timeoutMsg));
              }, timeoutMs)
            : undefined;

        const cleanupTimers = () => {
          if (timeoutTimer) clearTimeout(timeoutTimer);
          if (killTimer) clearTimeout(killTimer);
        };

        child.stdout.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          if (Buffer.byteLength(stdout, "utf8") + Buffer.byteLength(text, "utf8") <= maxOutputBytes) {
            stdout += text;
          } else if (!stdoutTruncated) {
            stdoutTruncated = true;
            stdout += "\n...[stdout truncated: output exceeded buffer limit]";
          }
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "stdout",
              text,
              timestamp: this.timeProvider.now(),
            });
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          if (Buffer.byteLength(stderr, "utf8") + Buffer.byteLength(text, "utf8") <= maxOutputBytes) {
            stderr += text;
          } else if (!stderrTruncated) {
            stderrTruncated = true;
            stderr += "\n...[stderr truncated: output exceeded buffer limit]";
          }
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "stderr",
              text,
              timestamp: this.timeProvider.now(),
            });
          }
        });

        child.on("close", (code) => {
          cleanupTimers();
          if (settled) return;
          settled = true;
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "exit",
              text: `[Process exited with code ${code}]`,
              code,
              timestamp: this.timeProvider.now(),
            });
          }
          resolve({
            exitCode: code ?? 0,
            stdout,
            stderr,
          });
        });

        child.on("error", (err) => {
          cleanupTimers();
          if (settled) return;
          settled = true;
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "error",
              text: `[Execution error: ${err.message}]`,
              timestamp: this.timeProvider.now(),
            });
          }
          reject(err);
        });
      }).catch(() => {
        const errorMsg = `Executable not found at ${executablePath}. Please build the required scripts or dependencies.`;
        if (eventEmitter) {
          eventEmitter.emit("log", {
            type: "error",
            text: `[Execution error: ${errorMsg}]`,
            timestamp: this.timeProvider.now(),
          });
        }
        reject(new Error(errorMsg));
      });
    });
  }
}


