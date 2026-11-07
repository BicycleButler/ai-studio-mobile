import React from "react";
import { Hammer } from "lucide-react";

export interface StubsDiagramTabProps {
  diagramHtml: string;
  diagramGroupBy: "folder" | "type" | "none" | "domain" | "layer";
  onSetDiagramGroupBy: (mode: "folder" | "type" | "none" | "domain" | "layer") => void;
  isLoading: boolean;
  error: string | null;
}

export const StubsDiagramTab: React.FC<StubsDiagramTabProps> = ({
  diagramHtml,
  diagramGroupBy,
  onSetDiagramGroupBy,
  isLoading,
  error,
}) => {
  return (
    <div className="space-y-3 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Control Bar */}
      <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground">Clustering Mode:</span>
          <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border">
            {(["domain", "layer"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => onSetDiagramGroupBy(mode as "folder" | "type" | "none" | "domain" | "layer")}
                className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md transition ${
                  diagramGroupBy === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Diagram Canvas */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 min-h-[500px] flex items-center justify-center overflow-x-auto relative">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center text-primary animate-pulse">
            <Hammer className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-xs font-semibold">Generating Mermaid Diagram...</p>
          </div>
        ) : error ? (
          <div className="text-center p-6 max-w-md bg-muted/10 border border-border/30 rounded-xl">
            <p className="text-foreground font-semibold text-sm mb-2">Diagram Generation Failed</p>
            <p className="text-xs text-foreground/80 font-mono break-words">{error}</p>
          </div>
        ) : diagramHtml ? (
          <div
            className="w-full h-full flex items-center justify-center mermaid-container"
            dangerouslySetInnerHTML={{ __html: diagramHtml }}
          />
        ) : (
          <p className="text-muted-foreground text-sm italic">
            No architecture data available to diagram.
          </p>
        )}
      </div>
    </div>
  );
};
