import React, { useState } from "react";
import {
  AlertOctagon,
  AlertTriangle,
  Layers,
  ShieldCheck,
  Copy,
  Check,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRight,
  Plus,
  X,
  ClipboardList,
} from "lucide-react";
import { StubsImpactResult, StubsBatchPreFlightResult } from "../../types/stubs";
import { Combobox } from "../Combobox";

export interface StubsImpactTabProps {
  impactResult: StubsImpactResult | null;
  selectedImpactTarget: string;
  onSetImpactTarget: (target: string) => void;
  impactGuard: "low" | "medium" | "high" | "critical";
  onSetImpactGuard: (guard: "low" | "medium" | "high" | "critical") => void;
  onRefreshImpact: (target: string, guard?: "low" | "medium" | "high" | "critical") => void;
  batchPreFlightResult: StubsBatchPreFlightResult | null;
  isLoadingBatchPreFlight: boolean;
  onRunBatchPreFlight: (
    targets: string[],
    guard?: "low" | "medium" | "high" | "critical"
  ) => Promise<StubsBatchPreFlightResult | null>;
  onStartDurableTaskFromTargets?: (targets: string[]) => void;
  availableNodes: string[];
  isLoading: boolean;
  onCopyBriefing: (markdown: string) => void;
}

export const StubsImpactTab: React.FC<StubsImpactTabProps> = ({
  impactResult,
  selectedImpactTarget,
  onSetImpactTarget,
  impactGuard,
  onSetImpactGuard,
  onRefreshImpact,
  batchPreFlightResult,
  isLoadingBatchPreFlight,
  onRunBatchPreFlight,
  onStartDurableTaskFromTargets,
  availableNodes,
  isLoading,
  onCopyBriefing,
}) => {
  const [copiedBriefing, setCopiedBriefing] = useState(false);
  const [contextViewMode, setContextViewMode] = useState<"briefing" | "stub">("briefing");
  const [batchQueue, setBatchQueue] = useState<string[]>([
    "src/types/stubs.ts",
    "src/services/stubsService.ts",
  ]);

  const nodeOptions = availableNodes.map((n) => ({ id: n, label: n }));

  const activeContextText =
    contextViewMode === "stub" && impactResult?.tieredContext?.interfaceStub
      ? impactResult.tieredContext.interfaceStub.skeletonCode
      : impactResult?.tieredContext?.briefingMarkdown || "";

  const handleCopyBriefing = () => {
    if (!activeContextText) return;
    onCopyBriefing(activeContextText);
    setCopiedBriefing(true);
    setTimeout(() => setCopiedBriefing(false), 1800);
  };

  const handlePivotTarget = (nextTarget: string) => {
    onSetImpactTarget(nextTarget);
    onRefreshImpact(nextTarget, impactGuard);
  };

  const handleAddToBatchQueue = (target: string) => {
    if (!target || batchQueue.includes(target)) return;
    const next = [...batchQueue, target];
    setBatchQueue(next);
  };

  const handleRemoveFromBatchQueue = (target: string) => {
    const next = batchQueue.filter((t) => t !== target);
    setBatchQueue(next);
  };

  return (
    <div className="@container space-y-4 max-w-5xl mx-auto animate-in fade-in duration-150">
      {/* Target & Pre-Flight Guard Selector */}
      <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-2 min-w-[220px] flex-1">
          <AlertOctagon className="w-4 h-4 text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <Combobox
              options={nodeOptions}
              value={selectedImpactTarget}
              onChange={(val) => {
                if (val) {
                  handlePivotTarget(val);
                }
              }}
              placeholder="Select target module for pre-flight & blast radius..."
            />
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            id="stubs-queue-batch-target-btn"
            onClick={() => handleAddToBatchQueue(selectedImpactTarget)}
            disabled={!selectedImpactTarget || batchQueue.includes(selectedImpactTarget)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
            title="Add selected module to Multi-Target Topological Planner"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Queue Target</span>
          </button>

          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap" htmlFor="impact-guard-select">
            Guard
          </label>
          <select
            id="impact-guard-select"
            value={impactGuard}
            onChange={(e) => {
              const g = e.target.value as "low" | "medium" | "high" | "critical";
              onSetImpactGuard(g);
              onRefreshImpact(selectedImpactTarget, g);
            }}
            className="text-xs bg-background border border-border rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:border-primary"
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
            <option value="critical">critical</option>
          </select>

          <button
            type="button"
            onClick={() => onRefreshImpact(selectedImpactTarget, impactGuard)}
            disabled={isLoading || !selectedImpactTarget}
            className="px-3.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-foreground text-xs font-medium transition-colors whitespace-nowrap disabled:opacity-50 cursor-pointer"
          >
            {isLoading ? "Analyzing..." : "Run Pre-Flight"}
          </button>
        </div>
      </div>

      {/* Multi-Target Batch Pre-Flight & Topological Edit Planner */}
      <div className="p-3.5 rounded-xl bg-card border border-border space-y-3" id="stubs-batch-preflight-panel">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-semibold text-foreground">
              Multi-Target Topological Edit Planner (stubs pre-flight --order)
            </h3>
            <p className="text-[11px] font-mono text-muted-foreground">
              Computes unified dependency-first topological edit order across {batchQueue.length} target module(s)
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              id="stubs-run-batch-preflight-btn"
              disabled={isLoadingBatchPreFlight || batchQueue.length === 0}
              onClick={() => void onRunBatchPreFlight(batchQueue, impactGuard)}
              className="px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              {isLoadingBatchPreFlight ? "Computing..." : "Compute Unified Sequence"}
            </button>
            {onStartDurableTaskFromTargets && batchQueue.length > 0 && (
              <button
                type="button"
                id="stubs-start-task-from-batch-btn"
                onClick={() => onStartDurableTaskFromTargets(batchQueue)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Start Durable Task</span>
              </button>
            )}
          </div>
        </div>

        {/* Queued Target Modules */}
        <div className="flex flex-wrap items-center gap-1.5">
          {batchQueue.map((targetPath) => (
            <div
              key={targetPath}
              className="px-2.5 py-1 rounded-md bg-background border border-border flex items-center gap-1.5 text-[11px] font-mono text-foreground"
            >
              <button
                type="button"
                onClick={() => handlePivotTarget(targetPath)}
                className="hover:underline cursor-pointer"
              >
                {targetPath}
              </button>
              <button
                type="button"
                onClick={() => handleRemoveFromBatchQueue(targetPath)}
                aria-label={`Remove ${targetPath} from batch queue`}
                className="text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Batch Pre-Flight Output */}
        {batchPreFlightResult && (
          <div className="p-3 rounded-lg bg-background border border-border space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {batchPreFlightResult.safe ? (
                  <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-foreground shrink-0" />
                )}
                <span className="font-semibold text-foreground">
                  Combined Risk: {batchPreFlightResult.overallRiskScore} ({batchPreFlightResult.maxNumericRisk}/100)
                </span>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {batchPreFlightResult.unifiedEditOrder.length} modules in sequence · ~{batchPreFlightResult.estimatedTotalTokens} tokens
              </span>
            </div>

            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">
                Unified Topological Edit Order (L0 → L6: Dependencies → Targets → Callers)
              </div>
              <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-1.5 max-h-40 overflow-y-auto pt-1">
                {batchPreFlightResult.unifiedEditOrder.map((filePath, idx) => {
                  const isQueuedTarget = batchPreFlightResult.targets.includes(filePath);
                  const isDep = batchPreFlightResult.dependenciesUnion.includes(filePath);
                  const role = isQueuedTarget ? "target" : isDep ? "dependency" : "caller";
                  return (
                    <button
                      key={filePath}
                      type="button"
                      onClick={() => handlePivotTarget(filePath)}
                      className="p-2 rounded bg-card border border-border hover:border-primary/40 text-start transition-colors cursor-pointer"
                    >
                      <div className="text-[11px] font-mono font-semibold text-foreground truncate">
                        {idx + 1}. {filePath}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        role: {role}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {batchPreFlightResult.recommendedTestCommand && (
              <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Discovered Affected Unit Tests ({batchPreFlightResult.affectedTests?.length ?? 0} suite{batchPreFlightResult.affectedTests?.length === 1 ? "" : "s"})
                  </div>
                  <div className="text-[11px] font-mono text-foreground truncate">
                    $ {batchPreFlightResult.recommendedTestCommand}
                  </div>
                </div>
                <button
                  type="button"
                  id="stubs-copy-batch-test-cmd-btn"
                  onClick={() => onCopyBriefing(batchPreFlightResult.recommendedTestCommand!)}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-card border border-border hover:bg-muted text-[11px] font-medium text-foreground cursor-pointer shrink-0"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Test Command</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {impactResult ? (
        <>
          {/* Pre-Flight Safety Gate Banner & Topological Edit Sequence */}
          {impactResult.preFlight && (
            <div className="p-3.5 rounded-xl bg-card border border-border space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-start gap-2.5 min-w-0">
                  {impactResult.preFlight.safe ? (
                    <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-foreground shrink-0 mt-0.5" />
                  )}
                  <div className="space-y-1 min-w-0">
                    <div className="text-xs font-semibold text-foreground">
                      {impactResult.preFlight.safe
                        ? `Pre-Flight Gate Passed (Guard: ${impactResult.preFlight.guardThreshold.toUpperCase()})`
                        : `Pre-Flight Gate Blocked (Guard: ${impactResult.preFlight.guardThreshold.toUpperCase()})`}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {impactResult.preFlight.blockedReason ||
                        `Safe to modify under '${impactResult.preFlight.autonomyLevel}' autonomy.`}
                    </p>
                    {impactResult.domainBoundariesCrossed && impactResult.domainBoundariesCrossed.length > 0 && (
                      <p className="text-[11px] font-mono text-muted-foreground">
                        External domains affected: {impactResult.domainBoundariesCrossed.join(", ")}
                      </p>
                    )}
                  </div>
                </div>
                <span className="text-xs font-mono tabular-nums text-muted-foreground shrink-0">
                  {impactResult.domain} · L{impactResult.layer}
                </span>
              </div>

              {impactResult.preFlight.editOrder.length > 0 && (
                <div className="pt-2.5 border-t border-border/60 space-y-1.5">
                  <div className="text-[11px] font-medium text-muted-foreground">
                    Topological Edit Sequence (Dependencies → Target → Callers)
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-mono">
                    {impactResult.preFlight.editOrder.map((step, idx) => {
                      const isTarget = step === impactResult.target;
                      return (
                        <React.Fragment key={step}>
                          <button
                            type="button"
                            onClick={() => handlePivotTarget(step)}
                            className={`px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                              isTarget
                                ? "bg-primary/15 border-primary/50 text-foreground font-semibold"
                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {idx + 1}. {step}
                          </button>
                          {idx < impactResult.preFlight!.editOrder.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Quantitative Blast Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="text-[11px] font-medium text-muted-foreground">Risk Rating</div>
              <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
                {impactResult.riskScore} ({impactResult.numericRisk})
              </div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="text-[11px] font-medium text-muted-foreground">Direct Callers</div>
              <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
                {impactResult.fanIn}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="text-[11px] font-medium text-muted-foreground">Transitive Callers</div>
              <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
                {impactResult.transitiveCallers?.length ?? 0}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-card border border-border">
              <div className="text-[11px] font-medium text-muted-foreground">Dependencies</div>
              <div className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
                {impactResult.fanOut}
              </div>
            </div>
          </div>

          {/* Callers & Dependencies Split */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <ArrowDownLeft className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Direct Callers (Upstream)</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {impactResult.directCallers.length}
                </span>
              </div>
              <div className="p-2 overflow-y-auto max-h-[280px]">
                {impactResult.directCallers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center p-4">
                    No direct callers reference this module.
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {impactResult.directCallers.map((dep) => (
                      <li key={dep}>
                        <button
                          type="button"
                          onClick={() => handlePivotTarget(dep)}
                          className="w-full text-start px-2.5 py-1.5 text-xs font-mono text-foreground hover:bg-muted/60 rounded-md transition-colors truncate cursor-pointer"
                        >
                          {dep}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
              <div className="p-3 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2 text-foreground">
                  <ArrowUpRight className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Dependencies (Downstream)</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-muted-foreground">
                  {impactResult.dependencies.length}
                </span>
              </div>
              <div className="p-2 overflow-y-auto max-h-[280px]">
                {impactResult.dependencies.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center p-4">
                    Zero internal module dependencies (leaf module).
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {impactResult.dependencies.map((dep) => (
                      <li key={dep}>
                        <button
                          type="button"
                          onClick={() => handlePivotTarget(dep)}
                          className="w-full text-start px-2.5 py-1.5 text-xs font-mono text-foreground hover:bg-muted/60 rounded-md transition-colors truncate cursor-pointer"
                        >
                          {dep}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>

          {/* Tiered Agent Context Package (`stubs context` & Level 1 Interface Stub) */}
          {impactResult.tieredContext && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="p-3 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">
                    Tiered Agent Context Briefing
                  </span>
                  <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                    ~{impactResult.tieredContext.estimatedTokens} tokens
                    {impactResult.tieredContext.interfaceStub
                      ? ` · ${impactResult.tieredContext.interfaceStub.tokenSavingsPct}% L1 stub compression`
                      : ""}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {impactResult.tieredContext.interfaceStub && (
                    <div className="flex items-center rounded-md bg-background border border-border p-0.5">
                      <button
                        type="button"
                        onClick={() => setContextViewMode("briefing")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                          contextViewMode === "briefing"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        L0/L1/L2 Briefing
                      </button>
                      <button
                        type="button"
                        onClick={() => setContextViewMode("stub")}
                        className={`px-2 py-0.5 rounded text-[11px] font-medium cursor-pointer ${
                          contextViewMode === "stub"
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        L1 Skeleton Stub
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleCopyBriefing}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border border-border hover:bg-muted text-xs font-medium text-foreground cursor-pointer"
                  >
                    {copiedBriefing ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-primary" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy {contextViewMode === "stub" ? "Stub" : "Briefing"}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
              <pre className="p-3.5 text-xs font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto max-h-64 leading-relaxed bg-background">
                {activeContextText}
              </pre>
            </div>
          )}
        </>
      ) : (
        <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-xl">
          <Layers className="w-9 h-9 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Select a module to run blast radius and pre-flight analysis.</p>
        </div>
      )}
    </div>
  );
};
