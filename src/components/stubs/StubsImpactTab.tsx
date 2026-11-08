import React from "react";
import { AlertOctagon, AlertTriangle, Layers, Filter } from "lucide-react";
import { StubsImpactResult } from "../../types/stubs";

export interface StubsImpactTabProps {
  impactResult: StubsImpactResult | null;
  selectedImpactTarget: string;
  onSetImpactTarget: (target: string) => void;
  onRefreshImpact: (target: string) => void;
  availableNodes: string[];
}

export const StubsImpactTab: React.FC<StubsImpactTabProps> = ({
  impactResult,
  selectedImpactTarget,
  onSetImpactTarget,
  onRefreshImpact,
  availableNodes,
}) => {
  return (
    <div className="space-y-3.5 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Target Selector */}
      <div className="p-3 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <AlertOctagon className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            Target Module:
          </span>
          <select
            value={selectedImpactTarget}
            onChange={(e) => onSetImpactTarget(e.target.value)}
            className="flex-1 min-w-[200px] text-xs bg-muted border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary"
          >
            {availableNodes.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => onRefreshImpact(selectedImpactTarget)}
          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors whitespace-nowrap shadow-sm"
        >
          Analyze Impact
        </button>
      </div>

      {impactResult ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Critical Dependents */}
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 bg-muted/10 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground">
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-bold">Critical Dependents</span>
              </div>
              <span className="text-xs font-bold text-foreground bg-muted/20 px-2 rounded-full">
                {impactResult.directCallers.length}
              </span>
            </div>
            <div className="p-2 overflow-y-auto max-h-[400px]">
              {impactResult.directCallers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center p-4">
                  No critical downstream dependencies found.
                </p>
              ) : (
                <ul className="space-y-1">
                  {impactResult.directCallers.map((dep: string) => (
                    <li
                      key={dep}
                      className="px-2.5 py-1.5 text-xs font-mono text-foreground hover:bg-muted/50 rounded-md transition-colors border border-transparent hover:border-border"
                    >
                      {dep}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Warning Dependents */}
          <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
            <div className="p-3 bg-muted/10 border-b border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-2 text-foreground">
                <Filter className="w-4 h-4" />
                <span className="text-xs font-bold">Indirect Warnings</span>
              </div>
              <span className="text-xs font-bold text-foreground bg-muted/20 px-2 rounded-full">
                {impactResult.dependencies.length}
              </span>
            </div>
            <div className="p-2 overflow-y-auto max-h-[400px]">
              {impactResult.dependencies.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center p-4">
                  No indirect warnings found.
                </p>
              ) : (
                <ul className="space-y-1">
                  {impactResult.dependencies.map((dep: string) => (
                    <li
                      key={dep}
                      className="px-2.5 py-1.5 text-xs font-mono text-foreground hover:bg-muted/50 rounded-md transition-colors border border-transparent hover:border-border"
                    >
                      {dep}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Select a module and analyze its impact radius.</p>
        </div>
      )}
    </div>
  );
};
