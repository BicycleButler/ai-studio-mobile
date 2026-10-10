import { useState, useCallback, useEffect, useRef } from "react";
import { connectStubsStream, executeStubsCommand } from "../../services/stubsService";

export interface LogEntry {
  type: string;
  text: string;
  timestamp: number;
  code?: number;
}

export function useStubsTerminal() {
  const [terminalLogs, setTerminalLogs] = useState<LogEntry[]>([]);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cleanup = connectStubsStream((log) => {
      setTerminalLogs((prev) => [...prev.slice(-200), log]);
    });
    return cleanup;
  }, []);

  const clearLogs = useCallback(() => {
    setTerminalLogs([]);
  }, []);

  const scrollToBottom = useCallback(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const runCommand = useCallback(
    async (
      command: "scan" | "lint-arch" | "diagram" | "impact" | "sand",
      args: string[] = [],
      callbacks?: { onSuccess?: () => void; onError?: (err: unknown) => void; onStart?: () => void }
    ) => {
      setIsExecutingCommand(true);
      callbacks?.onStart?.();
      try {
        await executeStubsCommand(command, args);
        callbacks?.onSuccess?.();
      } catch (err: unknown) {
        callbacks?.onError?.(err);
      } finally {
        setIsExecutingCommand(false);
      }
    },
    []
  );

  return {
    terminalLogs,
    isExecutingCommand,
    terminalEndRef,
    clearLogs,
    scrollToBottom,
    runCommand,
  };
}
