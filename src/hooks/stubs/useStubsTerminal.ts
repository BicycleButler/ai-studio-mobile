import { useState, useCallback, useEffect, useRef } from "react";
import { useServices } from "../../services/ServiceContext";
import { StubsCommandName } from "../../types";

export interface LogEntry {
  type: string;
  text: string;
  timestamp: number;
  code?: number;
}

const VALID_COMMANDS = new Set<StubsCommandName>([
  "run",
  "scan",
  "lint-arch",
  "diagram",
  "impact",
  "sand",
  "query",
  "pre-flight",
  "prune",
  "phase",
  "context",
  "map",
]);

function tokenizeArgs(input: string): string[] {
  const tokens: string[] = [];
  const regex = /"([^"]*)"|'([^']*)'|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(input)) !== null) {
    tokens.push(match[1] ?? match[2] ?? match[3]);
  }
  return tokens;
}

export function useStubsTerminal() {
  const { stubsClient, timeProvider } = useServices();
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = stubsClient.connectStubsStream((log) => {
      setTerminalLogs((prev) => [...prev.slice(-200), log]);
    });
    return cleanup;
  }, [stubsClient]);

  const clearLogs = useCallback(() => {
    setTerminalLogs([]);
  }, []);

  const scrollToBottom = useCallback(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const runCommand = useCallback(
    async (
      command: StubsCommandName,
      args: string[] = [],
      callbacks?: { onSuccess?: () => void; onError?: (err: unknown) => void; onStart?: () => void }
    ) => {
      setIsExecutingCommand(true);
      callbacks?.onStart?.();
      try {
        await stubsClient.executeStubsCommand(command, args);
        callbacks?.onSuccess?.();
      } catch (err: unknown) {
        callbacks?.onError?.(err);
      } finally {
        setIsExecutingCommand(false);
      }
    },
    [stubsClient]
  );

  const executeRawInput = useCallback(
    async (rawInput: string) => {
      const tokens = tokenizeArgs(rawInput.trim());
      if (tokens.length === 0) return;

      // Strip leading `npx` / `stubs` prefix if provided
      if (tokens[0] === "npx") tokens.shift();
      if (tokens[0] === "stubs") tokens.shift();
      if (tokens.length === 0) return;

      const cmd = tokens[0] as StubsCommandName;
      const args = tokens.slice(1);

      if (!VALID_COMMANDS.has(cmd)) {
        setTerminalLogs((prev) => [
          ...prev.slice(-200),
          {
            type: "error",
            text: `Unsupported command '${cmd}'. Supported stubs commands: ${Array.from(VALID_COMMANDS).join(", ")}`,
            timestamp: timeProvider.now(),
          },
        ]);
        return;
      }

      await runCommand(cmd, args);
    },
    [runCommand, timeProvider]
  );

  return {
    terminalLogs,
    isExecutingCommand,
    terminalEndRef,
    clearLogs,
    scrollToBottom,
    runCommand,
    executeRawInput,
  };
}
