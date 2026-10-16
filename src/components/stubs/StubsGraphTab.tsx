import React from "react";
import { Search, Folder, FileCode2, Layers } from "lucide-react";
import { StubsGraphData } from "../../types/stubs";

export interface StubsGraphTabProps {
  graphData: StubsGraphData | null;
  searchQuery: string;
  onSetSearchQuery: (query: string) => void;
  isLoading: boolean;
}

export const StubsGraphTab: React.FC<StubsGraphTabProps> = ({
  graphData,
  searchQuery,
  onSetSearchQuery,
  isLoading,
}) => {
  if (isLoading || !graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Layers className="w-8 h-8 mb-4 opacity-20 animate-pulse" />
        <p className="text-sm">Loading Workspace Graph...</p>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Metric Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Total Files
          </span>
          <span className="text-2xl font-light text-foreground mt-1">
            {graphData.summary.totalFiles}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Edges
          </span>
          <span className="text-2xl font-light text-foreground mt-1">
            {graphData.summary.totalEdges}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Symbols
          </span>
          <span className="text-2xl font-light text-foreground mt-1">
            {graphData.summary.totalSymbols}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
            Cycles
          </span>
          <span className="text-2xl font-light text-foreground mt-1">
            {graphData.summary.cyclesCount}
          </span>
        </div>
      </div>

      {/* Explorer Interface */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col min-h-[400px]">
        {/* Toolbar */}
        <div className="p-3 border-b border-border bg-muted/30 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search components, files, or exports..."
              value={searchQuery}
              onChange={(e) => onSetSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>
        </div>

        {/* Tree View */}
        <div className="flex-1 p-3 overflow-y-auto max-h-[500px]">
          {graphData.nodes.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 text-sm">
              No files matched your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {graphData.nodes.map((node) => (
                <div
                  key={node.id}
                  className="p-3 rounded-lg border border-border hover:border-primary/40 bg-background transition-colors group cursor-default"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5">
                      {node.entityType === "component" ? (
                        <Layers className="w-4 h-4 text-purple-400" />
                      ) : node.entityType === "service" ? (
                        <FileCode2 className="w-4 h-4 text-foreground" />
                      ) : node.entityType === "hook" ? (
                        <Folder className="w-4 h-4 text-amber-400" />
                      ) : (
                        <FileCode2 className="w-4 h-4 text-blue-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate" title={node.name}>
                        {node.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-mono truncate mt-0.5" title={node.filePath}>
                        {node.filePath}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
