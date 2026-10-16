import React from "react";
import { Copy, Check, Eye } from "lucide-react";
import { StubsSidecarSpec } from "../../types/stubs";

export interface StubsSpecsTabProps {
  specs: StubsSidecarSpec[];
  selectedSpecId: string | null;
  onSelectSpec: (id: string) => void;
  copiedSpecId: string | null;
  onCopySpec: (id: string, text: string) => void;
}

export const StubsSpecsTab: React.FC<StubsSpecsTabProps> = ({
  specs,
  selectedSpecId,
  onSelectSpec,
  copiedSpecId,
  onCopySpec,
}) => {
  if (!specs || specs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground animate-in fade-in duration-300">
        <p className="text-sm">No functional specifications generated yet.</p>
      </div>
    );
  }

  const activeSpec = specs.find((s) => s.path === selectedSpecId) || specs[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 max-w-7xl mx-auto h-full min-h-[580px] animate-in fade-in duration-150">
      {/* Left Specs List (4 cols) */}
      <div className="lg:col-span-4 rounded-xl bg-card border border-border flex flex-col overflow-hidden max-h-[580px]">
        <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            Implementation Specs
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
            {specs.length}
          </span>
        </div>
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {specs.map((spec) => {
            const isActive = activeSpec?.path === spec.path;
            return (
              <button
                key={spec.path}
                onClick={() => onSelectSpec(spec.path)}
                className={`w-full text-left px-3 py-2.5 rounded-lg text-xs transition-colors border ${
                  isActive
                    ? "bg-primary/10 border-primary/30 text-primary font-medium shadow-sm"
                    : "bg-transparent border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold truncate pe-2">{spec.title}</span>
                  {isActive && <Eye className="w-3.5 h-3.5 shrink-0 opacity-70" />}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono opacity-70 truncate">{spec.targetCodeFile}</span>
                  <span
                    className={`text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      spec.status === "implemented"
                        ? "bg-muted/20 text-foreground"
                        : "bg-muted/20 text-foreground"
                    }`}
                  >
                    {spec.status}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Spec Detail Viewer (8 cols) */}
      <div className="lg:col-span-8 rounded-xl bg-[#0d1117] border border-border flex flex-col overflow-hidden shadow-inner min-h-[400px]">
        {activeSpec ? (
          <>
            <div className="p-3 border-b border-white/10 bg-[#0d1117]/80 backdrop-blur-sm flex items-center justify-between sticky top-0 z-10">
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-[#c9d1d9] truncate">
                  {activeSpec.title}
                </span>
                <span className="text-[10px] font-mono text-[#8b949e]">
                  Target: {activeSpec.targetCodeFile}
                </span>
              </div>
              <button
                onClick={() => onCopySpec(activeSpec.path, (activeSpec.content || ""))}
                className="ml-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-[#c9d1d9] transition-colors border border-white/10 flex items-center gap-1.5 shrink-0"
                title="Copy Specification"
              >
                {copiedSpecId === activeSpec.path ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#7ee787]" />
                    <span className="text-[10px] font-medium text-[#7ee787]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-medium">Copy Spec</span>
                  </>
                )}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#0d1117]">
              <pre className="text-[11px] sm:text-xs font-mono text-[#e6edf3] whitespace-pre-wrap leading-relaxed">
                {(activeSpec.content || "")}
              </pre>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-[#8b949e] text-sm">
            Select a specification to view details.
          </div>
        )}
      </div>
    </div>
  );
};
