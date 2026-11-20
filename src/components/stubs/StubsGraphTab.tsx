import React, { useMemo, useState } from "react";
import {
  Search,
  Folder,
  FileCode2,
  Layers,
  Sparkles,
  ArrowRight,
  Crosshair,
  GitFork,
  X,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Package,
} from "lucide-react";
import {
  StubsGraphData,
  StubsNode,
  StubsQueryResult,
  StubsRunResult,
} from "../../types/stubs";

export interface StubsGraphTabProps {
  graphData: StubsGraphData | null;
  searchQuery: string;
  onSetSearchQuery: (query: string) => void;
  isLoading: boolean;
  queryResult: StubsQueryResult | null;
  isQuerying: boolean;
  onRunQuery: (query: string) => void;
  onClearQuery: () => void;
  pipelineResult: StubsRunResult | null;
  onInspectImpact: (target: string) => void;
  onViewSliceDiagram: (target: string) => void;
  onCopyText?: (text: string) => void;
}

const QUERY_PRESETS = [
  { label: "map:", value: "map:" },
  { label: "stub:", value: "stub: src/services/stubsService.ts" },
  { label: "explain:", value: "explain: StubsWorkspace.tsx" },
  { label: "path:", value: "path: App.tsx to stubs.ts" },
  { label: "blast:", value: "blast: src/types.ts" },
  { label: "pkg:", value: "pkg:react" },
];

export const StubsGraphTab: React.FC<StubsGraphTabProps> = ({
  graphData,
  searchQuery,
  onSetSearchQuery,
  isLoading,
  queryResult,
  isQuerying,
  onRunQuery,
  onClearQuery,
  pipelineResult,
  onInspectImpact,
  onViewSliceDiagram,
  onCopyText,
}) => {
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [graphRagInput, setGraphRagInput] = useState<string>("");

  const availableDomains = useMemo(() => {
    if (!graphData) return [];
    return Object.keys(graphData.summary.domains).sort();
  }, [graphData]);

  const filteredNodes = useMemo(() => {
    if (!graphData) return [];
    const q = searchQuery.trim().toLowerCase();
    return graphData.nodes.filter((node) => {
      if (domainFilter !== "all" && node.domain !== domainFilter) return false;
      if (!q) return true;
      return (
        node.name.toLowerCase().includes(q) ||
        node.filePath.toLowerCase().includes(q) ||
        node.domain.toLowerCase().includes(q) ||
        (node.exportsJson || "").toLowerCase().includes(q)
      );
    });
  }, [graphData, searchQuery, domainFilter]);

  if (isLoading || !graphData) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Layers className="w-8 h-8 mb-3 opacity-30 animate-pulse" />
        <p className="text-sm">Scanning AST & loading dependency graph...</p>
      </div>
    );
  }

  const handleQuerySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (graphRagInput.trim()) {
      onRunQuery(graphRagInput.trim());
    }
  };

  return (
    <div className="space-y-4 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Pipeline (`stubs run`) Summary Strip when recently executed */}
      {pipelineResult && (
        <div className="p-3.5 rounded-xl bg-card border border-border space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
              {pipelineResult.passed ? (
                <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-foreground shrink-0" />
              )}
              <span>Durable Agentic Harness Scorecard</span>
            </div>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {pipelineResult.passed ? "Verified" : "Attention required"}
              {pipelineResult.checkpointId ? ` · ${pipelineResult.checkpointId}` : ""} · {pipelineResult.durationMs}ms
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2">
            {pipelineResult.steps.map((step) => (
              <div
                key={step.name}
                className="p-2.5 rounded-lg bg-muted/40 border border-border/60 flex flex-col gap-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground truncate">{step.name}</span>
                  <span
                    className={`text-[11px] font-mono uppercase shrink-0 ${
                      step.status === "pass"
                        ? "text-primary font-semibold"
                        : step.status === "warn"
                        ? "text-foreground font-semibold"
                        : "text-foreground font-bold underline decoration-border"
                    }`}
                  >
                    {step.status}
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground font-mono tabular-nums truncate">
                  {step.detail}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!pipelineResult && graphData.lastCheckpoint && (
        <div className="px-3.5 py-2.5 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
            <span className="font-medium">Durable Harness Ledger</span>
            <span className="text-muted-foreground font-mono">
              {graphData.lastCheckpoint.id} · {graphData.lastCheckpoint.passed ? "Verified" : "Action Needed"}
            </span>
          </div>
          <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
            {graphData.lastCheckpoint.lintErrors} arch errors · {graphData.lastCheckpoint.designViolations} design violations · {graphData.lastCheckpoint.contextMapsSynced} context maps
          </span>
        </div>
      )}

      {/* Metric Summary Grid (Tabular Numerals, Single-Elevation) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground">Modules</span>
          <span className="text-2xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.totalFiles}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground">Edges</span>
          <span className="text-2xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.totalEdges}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground">Symbols</span>
          <span className="text-2xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.totalSymbols}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground">Cycles</span>
          <span className="text-2xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.cyclesCount}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground">Sidecars</span>
          <span className="text-2xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.sidecarsCount ?? 0}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground">Planning Docs</span>
          <span className="text-2xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.planningDocsCount ?? 0}
          </span>
        </div>
      </div>

      {/* GraphRAG & Surgical Query Bar (`stubs query`) */}
      <div className="bg-card border border-border rounded-xl p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary shrink-0" />
            <h3 className="text-xs font-semibold text-foreground">
              GraphRAG & Surgical Query
            </h3>
          </div>
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {QUERY_PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setGraphRagInput(preset.value);
                  onRunQuery(preset.value);
                }}
                className="px-2.5 py-1 rounded-md bg-muted/60 hover:bg-muted text-[11px] font-mono text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleQuerySubmit} className="flex items-center gap-2">
          <div className="relative flex-1 min-w-0">
            <Search className="w-3.5 h-3.5 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={graphRagInput}
              onChange={(e) => setGraphRagInput(e.target.value)}
              placeholder='Try: "explain: StubsClient", "path: App.tsx to stubs.ts", "map:", or "offline sync"'
              className="w-full bg-background border border-border rounded-lg ps-8 pe-8 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-mono"
            />
            {graphRagInput && (
              <button
                type="button"
                onClick={() => {
                  setGraphRagInput("");
                  onClearQuery();
                }}
                aria-label="Clear query"
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={isQuerying || !graphRagInput.trim()}
            className="px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            {isQuerying ? "Querying..." : "Run Query"}
          </button>
        </form>

        {/* Query Result Panel */}
        {queryResult && (
          <div className="pt-2 border-t border-border space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-medium text-foreground">{queryResult.summary}</span>
              <span className="text-muted-foreground font-mono text-[11px]">
                mode: {queryResult.mode}
                {queryResult.estimatedTokens ? ` · ~${queryResult.estimatedTokens} tokens` : ""}
              </span>
            </div>

            {queryResult.mapResult && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {queryResult.mapResult.domains.map((d) => (
                  <button
                    key={d.domain}
                    type="button"
                    onClick={() => setDomainFilter(d.domain)}
                    className="p-2.5 rounded-lg bg-background border border-border hover:border-primary/50 text-start transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{d.domain}</span>
                      <span className="text-[11px] font-mono tabular-nums text-muted-foreground">
                        {d.nodeCount} files · L{d.avgLayer}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground truncate mt-1">
                      Hub: {d.hubFile || "—"}
                    </p>
                  </button>
                ))}
              </div>
            )}

            {queryResult.pathResult && (
              <div className="space-y-1.5">
                {queryResult.pathResult.found ? (
                  queryResult.pathResult.paths.map((chain, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg bg-background border border-border flex flex-wrap items-center gap-1.5 text-[11px] font-mono"
                    >
                      {chain.map((step, sIdx) => (
                        <React.Fragment key={step}>
                          <button
                            type="button"
                            onClick={() => onInspectImpact(step)}
                            className="text-foreground hover:text-primary underline-offset-2 hover:underline cursor-pointer"
                          >
                            {step}
                          </button>
                          {sIdx < chain.length - 1 && (
                            <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No directed dependency chain found between endpoints.
                  </p>
                )}
              </div>
            )}

            {queryResult.explain && (
              <div className="p-3 rounded-lg bg-background border border-border space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-foreground">
                    {queryResult.explain.node.id}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onInspectImpact(queryResult.explain!.node.id)}
                      className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground cursor-pointer"
                    >
                      Inspect Impact
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewSliceDiagram(queryResult.explain!.node.id)}
                      className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground cursor-pointer"
                    >
                      View Slice
                    </button>
                  </div>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  Exports ({queryResult.explain.exports.length}):{" "}
                  {queryResult.explain.exports.length > 0
                    ? queryResult.explain.exports.slice(0, 12).join(", ")
                    : "—"}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground mb-1">
                      Incoming Callers ({queryResult.explain.callers.length})
                    </div>
                    <div className="space-y-0.5 max-h-28 overflow-y-auto font-mono text-[11px] text-foreground">
                      {queryResult.explain.callers.length > 0
                        ? queryResult.explain.callers.map((c) => <div key={c} className="truncate">{c}</div>)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-medium text-muted-foreground mb-1">
                      Outgoing Dependencies ({queryResult.explain.callees.length})
                    </div>
                    <div className="space-y-0.5 max-h-28 overflow-y-auto font-mono text-[11px] text-foreground">
                      {queryResult.explain.callees.length > 0
                        ? queryResult.explain.callees.map((c) => <div key={c} className="truncate">{c}</div>)
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {queryResult.blastResult && (
              <div className="p-3 rounded-lg bg-background border border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="font-mono">
                  <span className="font-semibold text-foreground">{queryResult.blastResult.target}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · Risk: {queryResult.blastResult.riskScore} · Fan-In:{" "}
                    {queryResult.blastResult.fanIn} · Fan-Out: {queryResult.blastResult.fanOut}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => onInspectImpact(queryResult.blastResult!.target)}
                  className="px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[11px] font-medium cursor-pointer"
                >
                  Open Pre-Flight
                </button>
              </div>
            )}

            {queryResult.stubResult && (
              <div className="rounded-lg bg-background border border-border overflow-hidden">
                <div className="px-3 py-2 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="font-semibold text-foreground">{queryResult.stubResult.path}</span>
                    <span className="text-muted-foreground text-[11px] tabular-nums">
                      L{queryResult.stubResult.layer} · {queryResult.stubResult.domain} · {queryResult.stubResult.tokenSavingsPct}% token savings (~{queryResult.stubResult.stubTokens} vs ~{queryResult.stubResult.fullTokens} tokens)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onCopyText && (
                      <button
                        type="button"
                        onClick={() => onCopyText(queryResult.stubResult!.skeletonCode)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>Copy Skeleton</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onInspectImpact(queryResult.stubResult!.path)}
                      className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground cursor-pointer"
                    >
                      Inspect Impact
                    </button>
                  </div>
                </div>
                <pre className="p-3 text-[11px] font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto max-h-64 leading-relaxed">
                  {queryResult.stubResult.skeletonCode}
                </pre>
              </div>
            )}

            {queryResult.pkgResult && (
              <div className="space-y-2">
                {queryResult.pkgResult.consumers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No workspace modules import package &apos;{queryResult.pkgResult.packageName}&apos;.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                    {queryResult.pkgResult.consumers.map((consumer) => (
                      <div
                        key={consumer.id}
                        className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-foreground truncate">
                            <Package className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="truncate">{consumer.id}</span>
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono tabular-nums mt-0.5">
                            {consumer.domain} · L{consumer.layer} · fan-in:{consumer.fanIn} · {consumer.exportsCount} exports
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onInspectImpact(consumer.id)}
                          className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground shrink-0 cursor-pointer"
                        >
                          Impact
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {queryResult.matches && queryResult.matches.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {queryResult.matches.map((m) => (
                  <div
                    key={m.node.id}
                    className="p-2.5 rounded-lg bg-background border border-border flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-medium text-foreground truncate">
                        {m.node.id}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {m.node.domain} · L{m.node.layer} · {m.reason}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectImpact(m.node.id)}
                      className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground shrink-0 cursor-pointer"
                    >
                      Impact
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Module Explorer */}
      <div className="bg-card border border-border rounded-xl overflow-hidden flex flex-col">
        <div className="p-3 border-b border-border bg-muted/30 flex flex-wrap items-center justify-between gap-2.5">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Filter modules, paths, or exported symbols..."
              value={searchQuery}
              onChange={(e) => onSetSearchQuery(e.target.value)}
              className="w-full bg-background border border-border rounded-lg ps-9 pe-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
            />
          </div>

          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setDomainFilter("all")}
              className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                domainFilter === "all"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              All ({graphData.nodes.length})
            </button>
            {availableDomains.map((dom) => (
              <button
                key={dom}
                type="button"
                onClick={() => setDomainFilter(dom)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  domainFilter === dom
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {dom} ({graphData.summary.domains[dom]})
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 overflow-y-auto max-h-[500px]">
          {filteredNodes.length === 0 ? (
            <div className="text-center text-muted-foreground p-8 text-sm">
              No modules matched your filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {filteredNodes.map((node: StubsNode) => {
                let exportsCount = 0;
                try {
                  if (node.exportsJson) exportsCount = JSON.parse(node.exportsJson).length || 0;
                } catch {
                  exportsCount = 0;
                }
                return (
                  <div
                    key={node.id}
                    className="p-3 rounded-lg border border-border hover:border-primary/40 bg-background transition-colors flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="mt-0.5 shrink-0">
                        {node.entityType === "component" ? (
                          <Layers className="w-4 h-4 text-primary" />
                        ) : node.entityType === "hook" ? (
                          <Folder className="w-4 h-4 text-foreground" />
                        ) : (
                          <FileCode2 className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-semibold text-foreground truncate" title={node.name}>
                          {node.name}
                        </h4>
                        <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5" title={node.filePath}>
                          {node.filePath}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-[11px] text-muted-foreground font-mono tabular-nums">
                      <span className="truncate">
                        {node.domain} · L{node.layer} · in:{node.fanIn} out:{node.fanOut} · {exportsCount} exp
                        {node.hasSidecar ? " · spec" : ""}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onInspectImpact(node.id)}
                          title="Inspect Blast Radius & Pre-Flight"
                          aria-label={`Inspect impact for ${node.name}`}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onViewSliceDiagram(node.id)}
                          title="View Neighborhood Slice Diagram"
                          aria-label={`View slice diagram for ${node.name}`}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                          <GitFork className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
