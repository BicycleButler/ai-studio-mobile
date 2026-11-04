import { spawn, SpawnOptionsWithoutStdio } from "node:child_process";
import fs from "node:fs";
import { EventEmitter } from "node:events";

export interface ProcessLogEvent {
  type: "start" | "stdout" | "stderr" | "error" | "exit";
  text: string;
  timestamp: number;
  code?: number;
}

export interface IProcessRunner {
  runCommand(
    executablePath: string,
    args: string[],
    options?: SpawnOptionsWithoutStdio,
    eventEmitter?: EventEmitter
  ): Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

export class ProcessRunner implements IProcessRunner {
  public async runCommand(
    executablePath: string,
    args: string[] = [],
    options?: SpawnOptionsWithoutStdio,
    eventEmitter?: EventEmitter
  ): Promise<{ exitCode: number; stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      fs.promises.access(executablePath).then(() => {
        if (eventEmitter) {
          eventEmitter.emit("log", {
            type: "start",
            text: `\x1b[36m$ node ${executablePath} ${args.join(" ")}\x1b[0m`,
            timestamp: Date.now(),
          });
        }

        const child = spawn("node", [executablePath, ...args], {
          ...options,
          env: { ...process.env, FORCE_COLOR: "1", ...(options?.env || {}) },
        });

        let stdout = "";
        let stderr = "";

        child.stdout.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stdout += text;
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "stdout",
              text,
              timestamp: Date.now(),
            });
          }
        });

        child.stderr.on("data", (chunk: Buffer) => {
          const text = chunk.toString();
          stderr += text;
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "stderr",
              text,
              timestamp: Date.now(),
            });
          }
        });

        child.on("close", (code) => {
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "exit",
              text: `[Process exited with code ${code}]`,
              code,
              timestamp: Date.now(),
            });
          }
          resolve({
            exitCode: code ?? 0,
            stdout,
            stderr,
          });
        });

        child.on("error", (err) => {
          if (eventEmitter) {
            eventEmitter.emit("log", {
              type: "error",
              text: `[Execution error: ${err.message}]`,
              timestamp: Date.now(),
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
            timestamp: Date.now(),
          });
        }
        reject(new Error(errorMsg));
      });
    });
  }
}

