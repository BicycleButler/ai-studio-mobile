import React, { useRef, useEffect } from "react";
import { Terminal, Trash2 } from "lucide-react";

export interface StubsTerminalTabProps {
  terminalLogs: unknown[];
  onExecuteCommand: (cmd: string) => void;
  onClearTerminal: () => void;
}

export const StubsTerminalTab: React.FC<StubsTerminalTabProps> = ({
  terminalLogs,
  onExecuteCommand,
  onClearTerminal,
}) => {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [terminalLogs]);

  return (
    <div className="space-y-3 max-w-5xl mx-auto h-full flex flex-col min-h-[550px] animate-in fade-in duration-150">
      {/* Quick Action Triggers */}
      <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-foreground">Trigger Stubs CLI:</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none w-full sm:w-auto">
          <button
            onClick={() => onExecuteCommand("npm run test")}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-mono text-foreground whitespace-nowrap transition"
          >
            $ npm run test
          </button>
          <button
            onClick={() => onExecuteCommand("npm run lint")}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-mono text-foreground whitespace-nowrap transition"
          >
            $ npm run lint
          </button>
          <button
            onClick={() => onExecuteCommand("stubs sync --dry-run")}
            className="px-2.5 py-1.5 rounded-lg border border-border bg-card hover:bg-muted text-[11px] font-mono text-foreground whitespace-nowrap transition"
          >
            $ stubs sync
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 min-h-[400px] rounded-xl bg-[#0d1117] border border-border overflow-hidden flex flex-col shadow-inner relative">
        <div className="flex items-center justify-between p-2 border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-sm z-10 sticky top-0">
          <div className="flex items-center gap-2 px-1">
            <Terminal className="w-4 h-4 text-white/60" />
            <span className="text-xs font-mono text-white/60 font-semibold tracking-wider uppercase">
              Embedded Terminal Emulator
            </span>
          </div>
          <button
            onClick={onClearTerminal}
            className="p-1.5 text-white/40 hover:text-white/80 hover:bg-white/10 rounded-md transition cursor-pointer"
            title="Clear Terminal Output"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 font-mono text-[11px] sm:text-xs leading-relaxed text-[#c9d1d9]">
          {terminalLogs.length === 0 ? (
            <div className="text-center text-white/30 italic mt-10">
              Terminal is waiting for commands...
            </div>
          ) : (
            <div className="space-y-1">
              {terminalLogs.map((log, i) => (
                <div key={i} className="break-words whitespace-pre-wrap">
                  {(log as {content?: string}).content?.startsWith("$") ? (
                    <span className="text-[#7ee787] font-bold">{(log as {content?: string}).content}</span>
                  ) : String((log as {content?: string}).content).includes("Error:") || String((log as {content?: string}).content).includes("ERR!") ? (
                    <span className="text-[#ff7b72]">{(log as {content?: string}).content}</span>
                  ) : String((log as {content?: string}).content).includes("Warning:") ? (
                    <span className="text-[#d2a8ff]">{(log as {content?: string}).content}</span>
                  ) : String((log as {content?: string}).content).includes("Success") || String((log as {content?: string}).content).includes("Success") || String((log as {content?: string}).content).includes("passed") ? (
                    <span className="text-[#a5d6ff]">{(log as {content?: string}).content}</span>
                  ) : (
                    <span className="text-[#c9d1d9]/80">{(log as {content?: string}).content}</span>
                  )}
                </div>
              ))}
              <div ref={terminalEndRef} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
