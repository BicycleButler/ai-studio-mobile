import React from "react";
import { ShieldCheck, CheckCircle2, AlertTriangle, Eye } from "lucide-react";
import { StubsLintViolation } from "../../types/stubs";

export interface StubsLintTabProps {
  lintPassed: boolean;
  lintViolations: StubsLintViolation[];
  totalChecks: number;
  onRefreshLint: () => void;
  isLoading: boolean;
}

export const StubsLintTab: React.FC<StubsLintTabProps> = ({
  lintPassed,
  lintViolations,
  totalChecks,
  onRefreshLint,
  isLoading,
}) => {
  if (totalChecks === 0 && lintViolations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground animate-in fade-in duration-300">
        <ShieldCheck className="w-12 h-12 mb-4 opacity-20" />
        <p className="text-sm">No linting data available.</p>
        <button
          onClick={onRefreshLint}
          className="mt-4 px-4 py-2 rounded-lg bg-primary/10 text-primary text-xs font-semibold hover:bg-primary/20 transition"
        >
          Run Linter
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3.5 max-w-4xl mx-auto animate-in fade-in duration-150">
      {/* Header banner */}
      <div
        className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
          lintPassed
            ? "bg-muted/20 border-border/30"
            : "bg-muted/10 border-border/30"
        }`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`p-2 rounded-lg ${
              lintPassed
                ? "bg-muted/20 text-foreground"
                : "bg-muted/20 text-foreground"
            }`}
          >
            {lintPassed ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>
          <div>
            <h4
              className={`text-sm font-semibold ${
                lintPassed ? "text-foreground" : "text-foreground"
              }`}
            >
              {lintPassed ? "Structural Validation Passed" : "Structural Validation Failed"}
            </h4>
            <p className="text-xs mt-1 opacity-80 text-foreground">
              Analyzed {totalChecks} files. Found {lintViolations.length} errors and{" "}
              {0} warnings.
            </p>
          </div>
        </div>
        <button
          onClick={onRefreshLint}
          disabled={isLoading}
          className="px-3 py-1.5 rounded-lg bg-background/50 border border-border hover:bg-background text-xs font-medium text-foreground transition disabled:opacity-50"
        >
          {isLoading ? "Running..." : "Re-Run"}
        </button>
      </div>

      {/* Rules Checked Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
            Rules
          </div>
          <div className="text-xl font-light text-foreground">
            {totalChecks}
          </div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
            Errors
          </div>
          <div
            className={`text-xl font-light ${
              lintViolations.length > 0 ? "text-foreground font-semibold" : "text-foreground"
            }`}
          >
            {lintViolations.length}
          </div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
            Warnings
          </div>
          <div
            className={`text-xl font-light ${
              0 > 0 ? "text-foreground font-semibold" : "text-foreground"
            }`}
          >
            {0}
          </div>
        </div>
        <div className="p-3 bg-card border border-border rounded-xl">
          <div className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider mb-1">
            Time
          </div>
          <div className="text-xl font-light text-foreground">
            {0}ms
          </div>
        </div>
      </div>

      {/* Violations List */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-muted/40">
          <span className="text-xs font-bold text-foreground">Detailed Report</span>
        </div>
        {lintViolations.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No structural violations found. Your stubs mapping matches the file system perfectly.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
            {lintViolations.map((v, i) => (
              <div
                key={i}
                className="p-3 hover:bg-muted/30 transition flex items-start gap-3"
              >
                <div className="mt-0.5">
                  {v.severity === "error" ? (
                    <AlertTriangle className="w-4 h-4 text-foreground" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-foreground truncate">
                      {v.source || v.target || "global"}
                    </span>
                    {false && (
                      <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1 rounded">
                        Ln {0}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {v.message}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground/70 tracking-tight">
                    Rule: {v.rule}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-1.5 text-muted-foreground hover:text-primary bg-background hover:bg-primary/10 border border-border hover:border-primary/30 rounded cursor-pointer transition"
                  title="View Source"
                >
                  <Eye className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
