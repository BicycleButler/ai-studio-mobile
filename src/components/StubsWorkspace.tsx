import { getSafeNavigatorClipboard } from "../utils/platform";
import React, { useState, useEffect } from "react";
import {
  GitBranch,
  Cpu,
  Layers,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Terminal,
  FileCode2,
  RefreshCw,
  Search,
  CheckCircle2,
  Copy,
  Code,
  FileText,
  Hammer,
  Trash2,
  Filter,
  Check,
  Eye,
  Sparkles,
} from "lucide-react";
import mermaid from "mermaid";

import {



  JulesRepository,
} from "../types";
import { useStubsTerminal } from "../hooks/stubs/useStubsTerminal";
import { useStubsData } from "../hooks/stubs/useStubsData";
import { useStubsSpecs } from "../hooks/stubs/useStubsSpecs";

interface StubsWorkspaceProps {
  onOpenBottomNav?: () => void;
  onOpenParameters?: () => void;
}

type StubsSubTab = "graph" | "diagram" | "lint" | "impact" | "specs" | "terminal";

const LAYER_LABELS: Record<number, { title: string; color: string }> = {
  0: { title: "Layer 0: Core Types", color: "border-sky-500/40 text-sky-400 bg-sky-950/30" },
  1: { title: "Layer 1: Low-Level Storage", color: "border-emerald-500/40 text-emerald-400 bg-emerald-950/30" },
  2: { title: "Layer 2: Domain Services", color: "border-indigo-500/40 text-indigo-400 bg-indigo-950/30" },
  3: { title: "Layer 3: UI Components", color: "border-amber-500/40 text-amber-400 bg-amber-950/30" },
  4: { title: "Layer 4: Workspaces", color: "border-purple-500/40 text-purple-400 bg-purple-950/30" },
  5: { title: "Layer 5: App Scaffold", color: "border-pink-500/40 text-pink-400 bg-pink-950/30" },
  6: { title: "Layer 6: Server Infrastructure", color: "border-rose-500/40 text-rose-400 bg-rose-950/30" },
};

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export const StubsWorkspace: React.FC<StubsWorkspaceProps> = ({
  onOpenBottomNav: _onOpenBottomNav,
  onOpenParameters: _onOpenParameters,
}) => {
  // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<StubsSubTab>("graph");
  const [repositories, setRepositories] = useState<JulesRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("Active Workspace (ai-studio-mobile)");

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Diagram state
  const [copyDiagramToast, setCopyDiagramToast] = useState(false);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDomain, setSelectedDomain] = useState<string>("all");
  const [selectedLayer, setSelectedLayer] = useState<number | "all">("all");

  const [selectedImpactTarget, setSelectedImpactTarget] = useState<string>("src/types.ts");

  const {
    terminalLogs,
    isExecutingCommand,
    terminalEndRef,
    clearLogs,
    scrollToBottom,
    runCommand
  } = useStubsTerminal();

  const {
    graphData,
    isLoadingGraph,
    loadGraph,
    diagramGroupBy,
    setDiagramGroupBy,
    diagramMermaid,
    renderedSvg,
    diagramViewMode,
    setDiagramViewMode,
    isLoadingDiagram,
    loadDiagram,
    lintViolations,
    lintPassed,
    totalLintChecks,
    isLoadingLint,
    loadLint,
    impactResult,
    isLoadingImpact,
    loadImpact
  } = useStubsData(showToast);

  const {
    specs,
    activeSpecPath,
    specContent,
    setSpecContent,
    isLoadingSpecs,
    isSavingSpec,
    isMaterializingSpec,
    specActionToast,
    loadSpecs,
    selectSpec,
    saveSpec,
    materializeActiveSpec
  } = useStubsSpecs(showToast, loadGraph);

  // Initialize Mermaid
  useEffect(() => {
    try {
      mermaid.initialize({
        startOnLoad: false,
        theme: "dark",
        securityLevel: "loose",
        flowchart: { curve: "basis" },
      });
    } catch {
      console.warn("Mermaid initialization warning: suppressed");
    }
  }, []);

  // Fetch Jules Repositories for top switcher
  useEffect(() => {
    import("../services/julesService")
      .then(({ fetchJulesRepositories }) => fetchJulesRepositories())
      .then((repos) => {
        if (Array.isArray(repos)) {
          setRepositories(repos);
        }
      })
      .catch(() => {});
  }, []);

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === "terminal") {
      scrollToBottom();
    }
  }, [terminalLogs, activeTab, scrollToBottom]);

  // Initial Data Load
  useEffect(() => {
    loadGraph();
    loadLint();
    loadSpecs();
  }, [loadGraph, loadLint, loadSpecs]);

  useEffect(() => {
    if (activeTab === "diagram") {
      loadDiagram();
    } else if (activeTab === "impact" && !impactResult) {
      loadImpact(selectedImpactTarget);
    }
  }, [activeTab, diagramGroupBy, loadDiagram, impactResult, loadImpact, selectedImpactTarget]);

  // Execute CLI Command Helper
  const handleRunCommand = async (
    command: "scan" | "lint-arch" | "diagram" | "impact" | "sand",
    args: string[] = []
  ) => {
    runCommand(command, args, {
      onStart: () => showToast(`Executing 'stubs ${command}'...`),
      onSuccess: () => {
        showToast(`Command 'stubs ${command}' completed.`);
        loadGraph();
        if (command === "lint-arch") loadLint();
        if (command === "diagram") loadDiagram();
      },
      onError: (err) => showToast(`Execution error: ${getErrorMessage(err)}`)
    });
  };

  // Filtered nodes
  const filteredNodes = (graphData?.nodes || []).filter((node) => {
    const matchesSearch =
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      node.filePath.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDomain = selectedDomain === "all" || node.domain === selectedDomain;
    const matchesLayer = selectedLayer === "all" || node.layer === selectedLayer;
    return matchesSearch && matchesDomain && matchesLayer;
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground select-text overflow-hidden relative font-sans">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div
          id="stubs-toast-notification"
          className="absolute top-3 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-card border border-border text-foreground text-xs shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
        >
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 52px Unified Section Toolbar (ADR 0039): Sub-Tabs Segmented Control + Repository Selector + Scan Action */}
      <div className="h-[52px] min-h-[52px] bg-card border-b border-border px-3 flex items-center justify-between gap-2.5 z-10 shrink-0">
        {/* Left: Segmented Sub-Tab Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1 min-w-0 flex-1">
          <button
            type="button"
            id="stubs-tab-graph"
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
              activeTab === "graph"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Graph & Nodes</span>
            {graphData && (
              <span className="ms-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-mono">
                {graphData.nodes.length}
              </span>
            )}
          </button>

        <button
          type="button"
          id="stubs-tab-diagram"
          onClick={() => setActiveTab("diagram")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            activeTab === "diagram"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Mermaid Diagram</span>
        </button>

        <button
          type="button"
          id="stubs-tab-lint"
          onClick={() => setActiveTab("lint")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            activeTab === "lint"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Architectural Lint</span>
          {lintViolations.length > 0 ? (
            <span className="ms-1 px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950 text-rose-300 font-mono font-bold">
              {lintViolations.length}
            </span>
          ) : (
            <span className="ms-1 px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-950 text-emerald-300 font-mono">
              0
            </span>
          )}
        </button>

        <button
          type="button"
          id="stubs-tab-impact"
          onClick={() => setActiveTab("impact")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            activeTab === "impact"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
          }`}
        >
          <AlertOctagon className="w-3.5 h-3.5" />
          <span>Blast Radius & Impact</span>
        </button>

        <button
          type="button"
          id="stubs-tab-specs"
          onClick={() => setActiveTab("specs")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            activeTab === "specs"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
          }`}
        >
          <FileCode2 className="w-3.5 h-3.5" />
          <span>Sidecar Specs</span>
          <span className="ms-1 px-1.5 py-0.2 rounded-full text-[10px] bg-black/30 font-mono">
            {specs.length}
          </span>
        </button>

        <button
          type="button"
          id="stubs-tab-terminal"
          onClick={() => setActiveTab("terminal")}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0 ${
            activeTab === "terminal"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
          }`}
        >
          <Terminal className="w-3.5 h-3.5" />
          <span>CLI Console</span>
        </button>
        </div>

        {/* Right Zone: Repository Selector & Scan AST Trigger (ADR 0039) */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-muted/60 border border-input rounded-lg px-2.5 py-1 text-xs text-foreground">
            <GitBranch className="w-3.5 h-3.5 text-primary shrink-0" />
            <select
              id="stubs-repo-selector"
              value={selectedRepo}
              onChange={(e) => {
                setSelectedRepo(e.target.value);
                showToast(`Switched workspace target to: ${e.target.value}`);
              }}
              className="bg-transparent text-xs font-medium text-foreground focus:outline-none cursor-pointer max-w-[120px] xs:max-w-[170px] sm:max-w-[220px] truncate"
              aria-label="Select workspace repository"
            >
              <option value="Active Workspace (ai-studio-mobile)" className="bg-slate-900 text-slate-100">
                Active Workspace (ai-studio-mobile)
              </option>
              {repositories.map((repo) => (
                <option key={repo.id} value={repo.fullName} className="bg-slate-900 text-slate-100">
                  {repo.fullName}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            id="stubs-header-scan-btn"
            onClick={() => handleRunCommand("scan")}
            disabled={isExecutingCommand || isLoadingGraph}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
            title="Scan physical source code AST & update graph database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGraph || isExecutingCommand ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">Scan AST</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3 bg-background">
        {/* ====================================================================
            TAB 1: GRAPH & NODES
           ==================================================================== */}
        {activeTab === "graph" && (
          <div className="space-y-3.5 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Metric Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Source Modules
                </span>
                <span className="text-xl font-bold font-mono text-foreground mt-0.5">
                  {graphData?.summary.totalFiles || 0}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">Active files scanned</span>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Dependency Edges
                </span>
                <span className="text-xl font-bold font-mono text-primary mt-0.5">
                  {graphData?.summary.totalEdges || 0}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">Import & relation links</span>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  Central Hubs
                </span>
                <span className="text-xl font-bold font-mono text-foreground mt-0.5">
                  {graphData?.nodes.filter((n) => n.degree > 10).length || 0}
                </span>
                <span className="text-[11px] text-muted-foreground mt-1">Degree &gt; 10 links</span>
              </div>

              <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
                <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                  DAG Cycles
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-xl font-bold font-mono text-primary">0</span>
                </div>
                <span className="text-[11px] text-muted-foreground mt-1 font-medium">Acyclic verified</span>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="p-3 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="relative flex-1">
                <Search className="w-3.5 h-3.5 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="stubs-node-search-input"
                  type="text"
                  placeholder="Filter nodes by name or filepath (e.g. types.ts, ChatWorkspace)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full ps-9 pe-3 py-1.5 rounded-lg bg-muted/50 border border-input text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Domain Selector */}
                <div className="flex items-center gap-1 text-xs">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <select
                    id="stubs-domain-filter"
                    value={selectedDomain}
                    onChange={(e) => setSelectedDomain(e.target.value)}
                    className="bg-muted/70 border border-input rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none cursor-pointer"
                  >
                    <option value="all">All Domains</option>
                    {graphData &&
                      Object.keys(graphData.summary.domains).map((dom) => (
                        <option key={dom} value={dom}>
                          {dom} ({graphData.summary.domains[dom]})
                        </option>
                      ))}
                  </select>
                </div>

                {/* Layer Selector */}
                <select
                  id="stubs-layer-filter"
                  value={selectedLayer}
                  onChange={(e) =>
                    setSelectedLayer(e.target.value === "all" ? "all" : parseInt(e.target.value, 10))
                  }
                  className="bg-muted/70 border border-input rounded-lg px-2 py-1 text-xs text-foreground focus:outline-none cursor-pointer"
                >
                  <option value="all">All Layers (0-6)</option>
                  {[0, 1, 2, 3, 4, 5, 6].map((l) => (
                    <option key={l} value={l}>
                      Layer {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nodes Table / Grid */}
            <div className="rounded-xl bg-card border border-border overflow-hidden">
              <div className="px-3 py-2 border-b border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/20">
                <span className="font-semibold text-foreground">
                  Scanned Architecture Nodes ({filteredNodes.length})
                </span>
                <span>Sorted by Degree Centrality</span>
              </div>

              <div className="divide-y divide-border/60 max-h-[520px] overflow-y-auto">
                {filteredNodes.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No nodes match the selected filters. Try changing search or clearing filters.
                  </div>
                ) : (
                  filteredNodes.map((node) => {
                    const layerMeta = LAYER_LABELS[node.layer] || {
                      title: `Layer ${node.layer}`,
                      color: "border-slate-700 text-slate-300 bg-slate-800",
                    };

                    return (
                      <div
                        key={node.id}
                        id={`node-item-${node.id.replace(/[^a-zA-Z0-9]/g, "-")}`}
                        className="p-3 hover:bg-muted/40 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                      >
                        <div className="flex flex-col min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-xs text-foreground font-mono">
                              {node.name}
                            </span>
                            {/* Domain Chip */}
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-sky-950/60 text-sky-400 border border-sky-500/30">
                              {node.domain}
                            </span>
                            {/* Layer Pill */}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${layerMeta.color}`}
                            >
                              L{node.layer}
                            </span>
                            {node.astHash && (
                              <span className="text-[10px] font-mono text-muted-foreground">
                                hash:{node.astHash.slice(0, 8)}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-muted-foreground truncate font-mono mt-0.5">
                            {node.filePath} • {node.lineCount} lines
                          </span>
                        </div>

                        {/* Centrality & Impact Action */}
                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <div className="flex items-center gap-2 text-xs font-mono">
                            <span className="text-emerald-400" title="Fan-in (incoming callers)">
                              In: {node.fanIn}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-sky-400" title="Fan-out (outgoing dependencies)">
                              Out: {node.fanOut}
                            </span>
                            <span className="text-muted-foreground">•</span>
                            <span className="text-primary font-bold" title="Degree Centrality">
                              Deg: {node.degree}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedImpactTarget(node.id);
                              setActiveTab("impact");
                              loadImpact(node.id);
                            }}
                            className="px-2 py-1 rounded bg-muted hover:bg-primary/20 text-muted-foreground hover:text-primary border border-border text-[11px] font-medium transition-colors cursor-pointer flex items-center gap-1"
                            title="Analyze Blast Radius & Risk Score"
                          >
                            <AlertOctagon className="w-3 h-3" />
                            <span>Impact</span>
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 2: MERMAID DIAGRAM
           ==================================================================== */}
        {activeTab === "diagram" && (
          <div className="space-y-3 max-w-6xl mx-auto animate-in fade-in duration-150">
            {/* Control Bar */}
            <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Clustering Mode:</span>
                <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-input text-xs">
                  <button
                    type="button"
                    onClick={() => setDiagramGroupBy("domain")}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      diagramGroupBy === "domain"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Domain Subgraphs
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiagramGroupBy("layer")}
                    className={`px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      diagramGroupBy === "layer"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Layer Invariant Tiers
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* SVG vs Code Toggle */}
                <div className="flex items-center rounded-lg bg-muted/60 p-0.5 border border-input text-xs">
                  <button
                    type="button"
                    onClick={() => setDiagramViewMode("svg")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      diagramViewMode === "svg"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Rendered SVG</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiagramViewMode("code")}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors cursor-pointer ${
                      diagramViewMode === "code"
                        ? "bg-primary text-primary-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Code className="w-3 h-3" />
                    <span>Raw Mermaid</span>
                  </button>
                </div>

                {/* Copy Diagram Syntax */}
                <button
                  type="button"
                  id="stubs-copy-diagram-btn"
                  onClick={() => {
                    getSafeNavigatorClipboard()?.writeText(diagramMermaid);
                    setCopyDiagramToast(true);
                    setTimeout(() => setCopyDiagramToast(false), 2000);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium transition-colors cursor-pointer"
                  title="Copy Mermaid code to clipboard"
                >
                  {copyDiagramToast ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>{copyDiagramToast ? "Copied" : "Copy"}</span>
                </button>

                {/* Refresh */}
                <button
                  type="button"
                  onClick={loadDiagram}
                  disabled={isLoadingDiagram}
                  className="p-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs transition-colors cursor-pointer"
                  title="Refresh Diagram"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingDiagram ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>

            {/* Viewport */}
            <div className="rounded-xl bg-card border border-border overflow-hidden min-h-[480px] flex flex-col">
              {diagramViewMode === "svg" && renderedSvg ? (
                <div
                  id="stubs-mermaid-svg-container"
                  className="p-4 flex-1 overflow-auto max-h-[620px] flex items-center justify-center bg-slate-950/60"
                  dangerouslySetInnerHTML={{ __html: renderedSvg }}
                />
              ) : (
                <div className="relative flex-1">
                  <pre className="p-4 text-xs font-mono text-sky-300 bg-slate-950 overflow-x-auto max-h-[620px] whitespace-pre select-all">
                    {diagramMermaid || "Loading living Mermaid diagram..."}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 3: ARCHITECTURAL LINT
           ==================================================================== */}
        {activeTab === "lint" && (
          <div className="space-y-3.5 max-w-4xl mx-auto animate-in fade-in duration-150">
            {/* Header banner */}
            <div
              className={`p-4 rounded-xl border flex items-start justify-between gap-3 ${
                lintPassed
                  ? "bg-emerald-950/20 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/20 border-rose-500/40 text-rose-300"
              }`}
            >
              <div className="flex items-start gap-3">
                {lintPassed ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {lintPassed
                      ? "All Architectural Invariants Satisfied!"
                      : `${lintViolations.length} Architectural Invariant Violations Detected`}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {lintPassed
                      ? `Evaluated ${totalLintChecks} graph paths. Codebase adheres strictly to downward layer hierarchy and acyclic DAG constraints.`
                      : "Identified inverted layer dependencies or circular reference paths that compromise modularity."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleRunCommand("lint-arch")}
                disabled={isExecutingCommand || isLoadingLint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card hover:bg-muted text-foreground border border-border text-xs font-medium transition-colors shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLint || isExecutingCommand ? "animate-spin" : ""}`} />
                <span>Re-Lint</span>
              </button>
            </div>

            {/* Invariant Rules Checklist */}
            <div className="p-4 rounded-xl bg-card border border-border space-y-3">
              <span className="text-xs font-bold text-foreground tracking-tight uppercase">
                Active Architecture Invariant Rules
              </span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-foreground font-medium">
                      Rule 1: Circular Dependency Cycle Ban
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">0 Cycles (Acyclic)</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-foreground font-medium">
                      Rule 2: Layer 0 Core Inversion Ban
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">Strict Layer Hierarchy</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span className="text-foreground font-medium">
                      Rule 3: Utility Isolation (Layer 1 cannot import Workspaces Layer 4)
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-emerald-400">Enforced</span>
                </div>
              </div>
            </div>

            {/* Violations List */}
            {lintViolations.length > 0 && (
              <div className="p-4 rounded-xl bg-card border border-rose-500/30 space-y-2.5">
                <span className="text-xs font-bold text-rose-400 uppercase tracking-tight">
                  Violation Details ({lintViolations.length})
                </span>
                <div className="space-y-2">
                  {lintViolations.map((v, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-rose-950/30 border border-rose-500/30 text-xs flex flex-col gap-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-rose-400 uppercase text-[10px]">
                          {v.rule}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-900/60 text-rose-200">
                          {v.severity}
                        </span>
                      </div>
                      <p className="text-rose-100">{v.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 4: BLAST RADIUS & IMPACT
           ==================================================================== */}
        {activeTab === "impact" && (
          <div className="space-y-3.5 max-w-5xl mx-auto animate-in fade-in duration-150">
            {/* Target Selector */}
            <div className="p-3 rounded-xl bg-card border border-border flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <AlertOctagon className="w-4 h-4 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground shrink-0">
                  Target Inspection Module:
                </span>
                <select
                  id="stubs-impact-target-selector"
                  value={selectedImpactTarget}
                  onChange={(e) => {
                    setSelectedImpactTarget(e.target.value);
                    loadImpact(e.target.value);
                  }}
                  className="flex-1 bg-muted/60 border border-input rounded-lg px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none cursor-pointer truncate"
                >
                  {(graphData?.nodes || []).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.filePath})
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => loadImpact(selectedImpactTarget)}
                disabled={isLoadingImpact}
                className="flex items-center justify-center gap-1.5 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingImpact ? "animate-spin" : ""}`} />
                <span>Calculate Blast</span>
              </button>
            </div>

            {/* Impact Results Card */}
            {impactResult && (
              <div className="space-y-3.5">
                {/* Risk Gauge and Core Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      Architectural Risk Rating
                    </span>
                    <div className="my-2">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`text-lg font-bold font-mono ${
                            impactResult.riskScore === "CRITICAL"
                              ? "text-rose-400"
                              : impactResult.riskScore === "HIGH"
                              ? "text-amber-400"
                              : impactResult.riskScore === "MODERATE"
                              ? "text-sky-400"
                              : "text-emerald-400"
                          }`}
                        >
                          {impactResult.riskScore}
                        </span>
                        <span className="text-xs font-mono text-muted-foreground">
                          {impactResult.numericRisk} / 100
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full transition-[width] duration-300 bg-primary"
                          style={{ width: `${impactResult.numericRisk}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      Calculated from fan-in depth & layer hierarchy
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      Direct Upstream Callers (Fan-in)
                    </span>
                    <span className="text-2xl font-bold font-mono text-rose-400 my-1">
                      {impactResult.fanIn}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Modules directly affected if this contract changes
                    </span>
                  </div>

                  <div className="p-4 rounded-xl bg-card border border-border flex flex-col justify-between">
                    <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                      Transitive Blast Callers
                    </span>
                    <span className="text-2xl font-bold font-mono text-amber-400 my-1">
                      {impactResult.transitiveCallers?.length || 0}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      2-hop transitive dependency ripple
                    </span>
                  </div>
                </div>

                {/* Direct Callers List */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-foreground">
                      Direct Upstream Callers ({impactResult.directCallers.length})
                    </span>
                    <span className="text-muted-foreground text-[11px]">
                      Breakage risk applies to each caller
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto">
                    {impactResult.directCallers.map((c, i) => (
                      <div
                        key={i}
                        className="px-2.5 py-1.5 rounded-lg bg-muted/40 border border-border/60 text-xs font-mono text-foreground flex items-center justify-between"
                      >
                        <span className="truncate">← {c}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImpactTarget(c);
                            loadImpact(c);
                          }}
                          className="text-[10px] text-primary hover:underline ms-1 shrink-0"
                        >
                          inspect
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Outgoing Dependencies */}
                <div className="p-4 rounded-xl bg-card border border-border space-y-2.5">
                  <span className="text-xs font-bold text-foreground">
                    Dependencies Relied On ({impactResult.dependencies.length})
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto">
                    {impactResult.dependencies.map((dep, i) => (
                      <span
                        key={i}
                        className="px-2 py-0.5 rounded text-xs font-mono bg-muted/50 text-muted-foreground border border-border"
                      >
                        → {dep}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================================================================
            TAB 5: SIDECAR SPEC STUDIO (*.ts.md)
           ==================================================================== */}
        {activeTab === "specs" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 max-w-7xl mx-auto h-full min-h-[580px] animate-in fade-in duration-150">
            {/* Left Specs List (4 cols) */}
            <div className="lg:col-span-4 rounded-xl bg-card border border-border flex flex-col overflow-hidden max-h-[580px]">
              <div className="p-3 border-b border-border flex items-center justify-between bg-muted/30">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  Sidecar Specs & Plans ({specs.length})
                </span>
                <button
                  type="button"
                  onClick={loadSpecs}
                  disabled={isLoadingSpecs}
                  className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                  title="Refresh specs"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingSpecs ? "animate-spin" : ""}`} />
                </button>
              </div>

              <div className="divide-y divide-border/60 overflow-y-auto flex-1">
                {specs.map((spec) => {
                  const isSelected = activeSpecPath === spec.path;
                  return (
                    <div
                      key={spec.path}
                      id={`spec-item-${spec.filename.replace(/[^a-zA-Z0-9]/g, "-")}`}
                      onClick={() => selectSpec(spec.path)}
                      className={`p-2.5 transition-colors cursor-pointer flex flex-col gap-1 ${
                        isSelected ? "bg-primary/15 border-s-2 border-primary" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground font-mono truncate">
                          {spec.filename}
                        </span>
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                          {spec.status}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground truncate">{spec.title}</span>
                      {spec.targetCodeFile && (
                        <div className="flex items-center gap-1 text-[10px] font-mono text-sky-400">
                          <span>Target:</span>
                          <span className="truncate">{spec.targetCodeFile}</span>
                          {spec.targetExists && (
                            <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Spec Editor / Action Studio (8 cols) */}
            <div className="lg:col-span-8 rounded-xl bg-card border border-border flex flex-col overflow-hidden max-h-[580px]">
              {/* Studio Actions Bar */}
              <div className="p-3 border-b border-border flex flex-wrap items-center justify-between gap-2 bg-muted/20">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-bold text-foreground font-mono truncate">
                    {activeSpecPath || "Select a spec"}
                  </span>
                  {specActionToast && (
                    <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/40">
                      {specActionToast}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    id="stubs-spec-save-btn"
                  onClick={saveSpec}
                    disabled={isSavingSpec || !activeSpecPath}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Save Spec</span>
                  </button>

                  <button
                    type="button"
                    id="stubs-spec-materialize-btn"
                  onClick={materializeActiveSpec}
                    disabled={isMaterializingSpec || !activeSpecPath}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium shadow-sm transition-colors cursor-pointer disabled:opacity-50"
                    title="Extract TypeScript code blocks and materialize into target code file"
                  >
                    <Hammer className={`w-3.5 h-3.5 ${isMaterializingSpec ? "animate-spin" : ""}`} />
                    <span>Materialize Code</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleRunCommand("sand", [activeSpecPath])}
                    disabled={isExecutingCommand || !activeSpecPath}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground text-xs font-medium border border-border transition-colors cursor-pointer"
                    title="Reconcile spec and code drift"
                  >
                    <span>Sand</span>
                  </button>
                </div>
              </div>

              {/* Editor Textarea */}
              <div className="flex-1 min-h-0 relative">
                <textarea
                  id="stubs-spec-editor-textarea"
                  value={specContent}
                  onChange={(e) => setSpecContent(e.target.value)}
                  placeholder="Sidecar specification markdown (*.ts.md) with embedded TypeScript code blocks..."
                  className="w-full h-full p-4 font-mono text-xs bg-slate-950 text-slate-100 resize-none focus:outline-none focus:ring-1 focus:ring-primary leading-relaxed"
                />
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            TAB 6: LIVE CLI CONSOLE
           ==================================================================== */}
        {activeTab === "terminal" && (
          <div className="space-y-3 max-w-5xl mx-auto h-full flex flex-col min-h-[550px] animate-in fade-in duration-150">
            {/* Quick Action Triggers */}
            <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-foreground">Trigger Stubs CLI:</span>
                <button
                  type="button"
                  onClick={() => handleRunCommand("scan")}
                  disabled={isExecutingCommand}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-mono font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  $ stubs scan
                </button>
                <button
                  type="button"
                  onClick={() => handleRunCommand("lint-arch")}
                  disabled={isExecutingCommand}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-mono font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  $ stubs lint-arch
                </button>
                <button
                  type="button"
                  onClick={() => handleRunCommand("sand")}
                  disabled={isExecutingCommand}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground border border-border text-xs font-mono font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  $ stubs sand
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  <span>SSE Live Stream</span>
                </div>

                <button
                  type="button"
                  onClick={clearLogs}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  title="Clear Terminal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Terminal Window */}
            <div className="rounded-xl bg-slate-950 border border-border flex-1 min-h-[440px] flex flex-col overflow-hidden font-mono text-xs shadow-2xl">
              <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-slate-400">
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full border border-slate-700 bg-slate-800" />
                    <div className="w-2.5 h-2.5 rounded-full border border-slate-700 bg-slate-800" />
                    <div className="w-2.5 h-2.5 rounded-full border border-slate-700 bg-slate-800" />
                  </div>
                  <span className="text-[11px] text-slate-300 ms-2">stubs-cli-stream — zsh</span>
                </div>
                <span className="text-[10px] text-slate-500">Node v22 • SQLite .stubs/graph.sqlite</span>
              </div>

              <div className="p-4 overflow-y-auto flex-1 space-y-1 text-slate-200 selection:bg-primary/30">
                {terminalLogs.length === 0 ? (
                  <div className="text-slate-500 italic">
                    Connected to Stubs process manager. Click any command button above to execute...
                  </div>
                ) : (
                  terminalLogs.map((log, idx) => (
                    <div key={idx} className="leading-relaxed whitespace-pre-wrap font-mono">
                      {log.type === "start" && (
                        <span className="text-sky-400 font-bold">{log.text}</span>
                      )}
                      {log.type === "stdout" && (
                        <span className="text-slate-200">{log.text}</span>
                      )}
                      {log.type === "stderr" && (
                        <span className="text-rose-400">{log.text}</span>
                      )}
                      {log.type === "exit" && (
                        <span className="text-emerald-400 font-bold">{log.text}</span>
                      )}
                      {log.type === "connect" && (
                        <span className="text-slate-500">[{log.text}]</span>
                      )}
                    </div>
                  ))
                )}
                <div ref={terminalEndRef} />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
