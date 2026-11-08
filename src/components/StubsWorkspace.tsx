import { getErrorMessage } from "../utils/errorHandling";
import React, { useState, useEffect, useCallback } from "react";
import {
  GitBranch,
  Cpu,
  Layers,
  ShieldCheck,
  AlertOctagon,
  Terminal,
  FileCode2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import mermaid from "mermaid";

import {



  JulesRepository,
} from "../types";


import { StubsTerminalTab } from "./stubs/StubsTerminalTab";
import { StubsLintTab } from "./stubs/StubsLintTab";
import { StubsGraphTab } from "./stubs/StubsGraphTab";
import { StubsDiagramTab } from "./stubs/StubsDiagramTab";
import { StubsImpactTab } from "./stubs/StubsImpactTab";
import { StubsSpecsTab } from "./stubs/StubsSpecsTab";

import { useStubsTerminal } from "../hooks/stubs/useStubsTerminal";
import { useStubsData } from "../hooks/stubs/useStubsData";
import { useStubsSpecs } from "../hooks/stubs/useStubsSpecs";
import { useServices } from "../services/ServiceContext";

import { useWorkspace } from "../contexts/WorkspaceContext";

export interface StubsWorkspaceProps {
}

type StubsSubTab = "graph" | "diagram" | "lint" | "impact" | "specs" | "terminal";


export const StubsWorkspace: React.FC<StubsWorkspaceProps> = () => {
  const { onOpenBottomNav: _onOpenBottomNav, onOpenParameters: _onOpenParameters } = useWorkspace();
  const { julesClient, logger, clipboardService, platformService } = useServices();
    // Navigation & Sub-views
  const [activeTab, setActiveTab] = useState<StubsSubTab>("graph");
  const [repositories, setRepositories] = useState<JulesRepository[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>("Active Workspace (ai-studio-mobile)");

  // Notification Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = React.useCallback((msg: string) => {
    setToastMessage(msg);
    platformService.setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedImpactTarget, setSelectedImpactTarget] = useState<string>("src/types.ts");

  const {
    terminalLogs,
    isExecutingCommand,
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
        renderedSvg,
            isLoadingDiagram,
    loadDiagram,
    lintViolations,
    lintPassed,
    totalLintChecks,
    isLoadingLint,
    loadLint,
    impactResult,
    loadImpact
  } = useStubsData(showToast);

  const { specs, activeSpecPath: selectedSpecId, loadSpecs, selectSpec, } = useStubsSpecs(showToast, loadGraph);
  const [copiedSpecId, setCopiedSpecId] = useState<string | null>(null);
  const handleCopySpec = useCallback(async (id: string, content: string) => {
    try {
      await clipboardService.writeText(content);
      setCopiedSpecId(id);
      platformService.setTimeout(() => setCopiedSpecId(null), 2000);
    } catch {
      // Ignored
    }
  }, [clipboardService, platformService]);








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
      logger.warn("Mermaid initialization warning: suppressed");
    }
  }, [logger]);

  // Fetch Jules Repositories for top switcher
  useEffect(() => {
    julesClient.fetchRepositories()
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

  return (
    <div className="flex flex-col h-full bg-background text-foreground select-text overflow-hidden relative font-sans">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div
          id="stubs-toast-notification"
          className="absolute top-3 start-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-xl bg-card border border-border text-foreground text-xs shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200"
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
            <span className="ms-1 px-1.5 py-0.2 rounded-full text-[10px] bg-muted/40 text-muted-foreground font-mono">
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
      <div className="flex-1 min-h-0 overflow-y-auto p-3 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] bg-background">
        {/* TAB 1: GRAPH & NODES */}
        {activeTab === "graph" && (
            <StubsGraphTab
              graphData={graphData}
              searchQuery={searchQuery}
              onSetSearchQuery={setSearchQuery}
              isLoading={isLoadingGraph}
            />
        )}

        {/* TAB 2: DIAGRAM / C4 MODEL */}
        {activeTab === "diagram" && (
            <StubsDiagramTab
              diagramHtml={renderedSvg}
              diagramGroupBy={diagramGroupBy}
              onSetDiagramGroupBy={setDiagramGroupBy as (mode: "type" | "domain" | "layer" | "none" | "folder") => void}
              isLoading={isLoadingDiagram}
              error={null}
            />
        )}

        {/* TAB 3: LINT & STRUCTURAL AUDIT */}
        {activeTab === "lint" && (
            <StubsLintTab
              lintPassed={lintPassed}
              lintViolations={lintViolations}
              totalChecks={totalLintChecks}
              onRefreshLint={loadLint}
              isLoading={isLoadingLint}
            />
        )}

        {/* TAB 4: IMPACT ANALYSIS */}
        {activeTab === "impact" && (
            <StubsImpactTab
              impactResult={impactResult}
              selectedImpactTarget={selectedImpactTarget}
              onSetImpactTarget={setSelectedImpactTarget}
              onRefreshImpact={loadImpact}
              availableNodes={graphData?.nodes.map(n => n.id) || []}
            />
        )}

        {/* TAB 5: SPECS / CONTRACTS */}
        {activeTab === "specs" && (
            <StubsSpecsTab
              specs={specs}
              selectedSpecId={selectedSpecId}
              onSelectSpec={selectSpec}
              copiedSpecId={copiedSpecId}
              onCopySpec={handleCopySpec}
            />
        )}

        {/* TAB 6: TERMINAL */}
        {activeTab === "terminal" && (
            <StubsTerminalTab
              terminalLogs={terminalLogs}
              onExecuteCommand={runCommand as (cmd: string) => void}
              onClearTerminal={clearLogs}
            />
        )}
      </div>
    </div>
  );
};
