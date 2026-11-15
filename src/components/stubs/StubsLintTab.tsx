import React, { useMemo, useState } from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, Crosshair, Trash2 } from "lucide-react";
import { StubsLintViolation, StubsPruneIssue, StubsPruneResult } from "../../types/stubs";

export interface StubsLintTabProps {
  lintPassed: boolean;
  lintViolations: StubsLintViolation[];
  totalChecks: number;
  errorCount: number;
  warningCount: number;
  durationMs: number;
  pruneIssues: StubsPruneIssue[];
  pruneSummary: StubsPruneResult["summary"];
  onRefreshLint: () => void;
  onInspectTarget: (target: string) => void;
  isLoading: boolean;
}

const RULE_FILTERS = [
  "ALL",
  "LAYER_VIOLATION",
  "CIRCULAR_DEPENDENCY",
  "UNMANIFESTED_DEPENDENCY",
  "DOMAIN_LEAK",
] as const;

export const StubsLintTab: React.FC<StubsLintTabProps> = ({
  lintPassed,
  lintViolations,
  totalChecks,
  errorCount,
  warningCount,
  durationMs,
  pruneIssues,
  pruneSummary,
  onRefreshLint,
  onInspectTarget,
  isLoading,
}) => {
  const [ruleFilter, setRuleFilter] = useState<string>("ALL");

  const filteredViolations = useMemo(() => {
    if (ruleFilter === "ALL") return lintViolations;
    return lintViolations.filter((v) => v.rule === ruleFilter);
  }, [lintViolations, ruleFilter]);

  if (totalChecks === 0 && lintViolations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground animate-in fade-in duration-150">
        <ShieldCheck className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-sm">No linting data available.</p>
        <button
          type="button"
          onClick={onRefreshLint}
          className="mt-4 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors cursor-pointer"
        >
          Run Architectural Linter
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Header Banner */}
      <div className="p-4 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-muted text-foreground shrink-0">
            {lintPassed ? (
              <CheckCircle2 className="w-5 h-5 text-primary" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-foreground" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-foreground">
              {lintPassed ? "Architectural Guardrails Passed" : "Architectural Violations Detected"}
            </h4>
            <p className="text-xs mt-0.5 text-muted-foreground font-mono tabular-nums">
              {totalChecks} checks · {errorCount} errors · {warningCount} warnings · {durationMs}ms
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRefreshLint}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
        >
          {isLoading ? "Checking..." : "Re-Run Lint"}
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[11px] text-muted-foreground font-medium">Checks</div>
          <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {totalChecks}
          </div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[11px] text-muted-foreground font-medium">Errors</div>
          <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {errorCount}
          </div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[11px] text-muted-foreground font-medium">Warnings</div>
          <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {warningCount}
          </div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[11px] text-muted-foreground font-medium">Duration</div>
          <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {durationMs}ms
          </div>
        </div>
      </div>

      {/* Violations Report */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            Invariant Violations ({filteredViolations.length})
          </span>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {RULE_FILTERS.map((rule) => (
              <button
                key={rule}
                type="button"
                onClick={() => setRuleFilter(rule)}
                className={`px-2 py-1 rounded text-[11px] font-mono whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  ruleFilter === rule
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {rule}
              </button>
            ))}
          </div>
        </div>
        {filteredViolations.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No violations matching the selected rule filter.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[360px] overflow-y-auto">
            {filteredViolations.map((v, i) => (
              <div
                key={`${v.rule}-${v.source || i}-${i}`}
                className="p-3 hover:bg-muted/20 transition-colors flex items-start justify-between gap-3"
              >
                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                  <AlertTriangle
                    className={`w-4 h-4 mt-0.5 shrink-0 ${
                      v.severity === "error" ? "text-destructive" : "text-warning"
                    }`}
                  />
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                      <span className="font-semibold text-foreground truncate">
                        {v.source || v.target || "workspace"}
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        · {v.severity.toUpperCase()} · {v.rule}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{v.message}</p>
                  </div>
                </div>
                {v.source && (
                  <button
                    type="button"
                    onClick={() => onInspectTarget(v.source!)}
                    className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-foreground bg-background hover:bg-muted border border-border rounded-md shrink-0 cursor-pointer transition-colors"
                    title="Inspect Impact & Pre-Flight"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Inspect</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Workspace Hygiene (`stubs prune`) */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Trash2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">
              Hygiene & Prune Audit (stubs prune)
            </span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {pruneSummary.phantomSidecars} phantom · {pruneSummary.zombieExports} zero-in-degree ·{" "}
            {pruneSummary.staleDbNodes} stale DB · {pruneSummary.untrackedCode} opt-in untracked
          </span>
        </div>
        {pruneIssues.length === 0 ? (
          <div className="p-6 text-center text-xs text-muted-foreground">
            Workspace is clean. Zero phantom sidecars, zombie exports, or stale graph nodes found.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[280px] overflow-y-auto">
            {pruneIssues.map((issue, idx) => (
              <div
                key={`${issue.type}-${issue.path}-${idx}`}
                className="p-3 flex items-center justify-between gap-3 text-xs"
              >
                <div className="min-w-0">
                  <div className="font-mono font-medium text-foreground truncate">
                    {issue.type} · {issue.path}
                  </div>
                  <div className="text-muted-foreground mt-0.5">{issue.message}</div>
                </div>
                {issue.type !== "PHANTOM_SIDECAR" && issue.type !== "STALE_DB_NODE" && (
                  <button
                    type="button"
                    onClick={() => onInspectTarget(issue.path)}
                    className="px-2.5 py-1 rounded bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground shrink-0 cursor-pointer"
                  >
                    Inspect
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
