import React, { useRef, useEffect, useState } from "react";
import { Terminal, Trash2, Play } from "lucide-react";
import { StubsCommandName } from "../../types/stubs";

export interface StubsTerminalLog {
  type: string;
  text: string;
  timestamp: number;
  code?: number;
}

export interface StubsTerminalTabProps {
  terminalLogs: StubsTerminalLog[];
  isExecuting: boolean;
  onExecuteCommand: (command: StubsCommandName, args?: string[]) => void;
  onExecuteRawInput: (rawInput: string) => void;
  onClearTerminal: () => void;
}

const QUICK_COMMANDS: Array<{ label: string; command: StubsCommandName; args: string[] }> = [
  { label: "stubs run", command: "run", args: [] },
  { label: "stubs scan", command: "scan", args: [] },
  { label: 'stubs query "map:"', command: "query", args: ["map:"] },
  { label: "stubs lint-arch", command: "lint-arch", args: [] },
  { label: "stubs prune", command: "prune", args: [] },
  { label: "stubs phase status", command: "phase", args: ["status"] },
  { label: "stubs sand", command: "sand", args: [] },
];

function stripAnsi(input: string): string {
  return input.replace(/\x1b\[[0-9;]*m/g, "");
}

export const StubsTerminalTab: React.FC<StubsTerminalTabProps> = ({
  terminalLogs,
  isExecuting,
  onExecuteCommand,
  onExecuteRawInput,
  onClearTerminal,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);
  const [rawCommand, setRawCommand] = useState("");

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [terminalLogs]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rawCommand.trim() || isExecuting) return;
    onExecuteRawInput(rawCommand.trim());
    setRawCommand("");
  };

  return (
    <div className="space-y-3 max-w-5xl mx-auto h-full flex flex-col min-h-[550px] animate-in fade-in duration-150">
      {/* Quick Action Triggers */}
      <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <span className="text-xs font-semibold text-foreground whitespace-nowrap">
          Stubs CLI Quick Commands
        </span>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
          {QUICK_COMMANDS.map((item) => (
            <button
              key={item.label}
              type="button"
              disabled={isExecuting}
              onClick={() => onExecuteCommand(item.command, item.args)}
              className="px-2.5 py-1.5 rounded-lg border border-border bg-background hover:bg-muted text-[11px] font-mono text-foreground whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
            >
              $ {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interactive Command Input */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 shrink-0">
        <div className="flex-1 flex items-center bg-card border border-border rounded-lg px-3 py-1.5 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary">
          <span className="text-xs font-mono text-muted-foreground me-2 select-none">$ npx stubs</span>
          <input
            type="text"
            value={rawCommand}
            onChange={(e) => setRawCommand(e.target.value)}
            placeholder='query "explain: StubsClient" | pre-flight src/types.ts | lint-arch | prune'
            className="flex-1 bg-transparent text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none min-w-0"
          />
        </div>
        <button
          type="submit"
          disabled={isExecuting || !rawCommand.trim()}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
        >
          <Play className="w-3.5 h-3.5" />
          <span>{isExecuting ? "Running..." : "Execute"}</span>
        </button>
      </form>

      {/* Terminal Output Area */}
      <div className="flex-1 min-h-[380px] rounded-xl bg-[#0d1117] border border-border overflow-hidden flex flex-col relative">
        <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 bg-[#0d1117] z-10 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-white/60" />
            <span className="text-xs font-mono text-white/70 font-medium">
              Stubs CLI Output Stream
            </span>
          </div>
          <button
            type="button"
            onClick={onClearTerminal}
            aria-label="Clear terminal output"
            className="p-1.5 text-white/50 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
            title="Clear Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 font-mono text-xs leading-relaxed text-[#c9d1d9]">
          {terminalLogs.length === 0 ? (
            <div className="text-center text-white/40 mt-10">
              Select a quick command or enter a stubs subcommand above to inspect live output.
            </div>
          ) : (
            <div className="space-y-1">
              {terminalLogs.map((log, i) => {
                const cleanText = stripAnsi(log.text || "");
                const colorClass =
                  log.type === "start" || cleanText.startsWith("$")
                    ? "text-[#7ee787] font-semibold"
                    : log.type === "error" || log.type === "stderr" || cleanText.includes("[ERROR]")
                    ? "text-[#ff7b72]"
                    : log.type === "exit"
                    ? log.code === 0
                      ? "text-[#a5d6ff]"
                      : "text-[#ffa657]"
                    : log.type === "connect"
                    ? "text-[#8b949e]"
                    : "text-[#e6edf3]";

                return (
                  <div key={`${log.timestamp}-${i}`} className={`break-words whitespace-pre-wrap ${colorClass}`}>
                    {cleanText}
                  </div>
                );
              })}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
