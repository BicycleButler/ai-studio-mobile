import { getErrorMessage } from "../utils/errorHandling";
import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Cpu,
  Layers,
  ShieldCheck,
  AlertOctagon,
  FileCode2,
  Terminal,
  RefreshCw,
  Play,
  Sparkles,
} from "lucide-react";

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
import { StubsCommandName } from "../types/stubs";

export interface StubsWorkspaceProps {}

type StubsSubTab = "graph" | "diagram" | "lint" | "impact" | "specs" | "terminal";

export const StubsWorkspace: React.FC<StubsWorkspaceProps> = () => {
  const { onOpenBottomNav: _onOpenBottomNav, onOpenParameters: _onOpenParameters, onOpenFileInIDE } = useWorkspace();
  const { clipboardService, platformService } = useServices();

  const [activeTab, setActiveTab] = useState<StubsSubTab>("graph");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof platformService.setTimeout> | null>(null);
  const copyTimerRef = useRef<ReturnType<typeof platformService.setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        platformService.clearTimeout(toastTimerRef.current);
      }
      if (copyTimerRef.current !== null) {
        platformService.clearTimeout(copyTimerRef.current);
      }
    };
  }, [platformService]);

  const showToast = React.useCallback(
    (msg: string) => {
      setToastMessage(msg);
      if (toastTimerRef.current !== null) {
        platformService.clearTimeout(toastTimerRef.current);
      }
      toastTimerRef.current = platformService.setTimeout(() => {
        toastTimerRef.current = null;
        setToastMessage(null);
      }, 3500);
    },
    [platformService]
  );

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImpactTarget, setSelectedImpactTarget] = useState<string>("src/types.ts");

  const {
    terminalLogs,
    isExecutingCommand,
    clearLogs,
    scrollToBottom,
    runCommand,
    executeRawInput,
  } = useStubsTerminal();

  const {
    graphData,
    isLoadingGraph,
    loadGraph,
    queryResult,
    isQuerying,
    runQuery,
    clearQuery,
    pipelineResult,
    isRunningPipeline,
    runPipeline,
    activeTask,
    tasks,
    isMutatingTask,
    createTask,
    updateTask,
    verifyTask,
    sessionHandoff,
    isLoadingHandoff,
    loadSessionHandoff,
    clearSessionHandoff,
    diagramGroupBy,
    setDiagramGroupBy,
    diagramType,
    setDiagramType,
    diagramTarget,
    setDiagramTarget,
    diagramMermaid,
    renderedSvg,
    diagramViewMode,
    setDiagramViewMode,
    diagramError,
    isLoadingDiagram,
    loadDiagram,
    lintViolations,
    lintPassed,
    totalLintChecks,
    lintErrorCount,
    lintWarningCount,
    lintDurationMs,
    pruneIssues,
    pruneSummary,
    isLoadingLint,
    loadLint,
    impactResult,
    impactGuard,
    setImpactGuard,
    isLoadingImpact,
    loadImpact,
    batchPreFlightResult,
    isLoadingBatchPreFlight,
    runBatchPreFlight,
  } = useStubsData(showToast);

  const {
    specs,
    activeSpecPath: selectedSpecId,
    specContent,
    setSpecContent,
    isLoadingSpecDetail,
    isSavingSpec,
    isMaterializingSpec,
    isSandingSpec,
    loadSpecs,
    selectSpec,
    saveSpec,
    materializeActiveSpec,
    sandActiveSpec,
  } = useStubsSpecs(showToast, loadGraph);

  const [copiedSpecId, setCopiedSpecId] = useState<string | null>(null);
  const handleCopyText = useCallback(
    async (id: string, content: string) => {
      try {
        await clipboardService.writeText(content);
        setCopiedSpecId(id);
        showToast("Copied to clipboard.");
        if (copyTimerRef.current !== null) {
          platformService.clearTimeout(copyTimerRef.current);
        }
        copyTimerRef.current = platformService.setTimeout(() => {
          copyTimerRef.current = null;
          setCopiedSpecId(null);
        }, 2000);
      } catch {
        // Ignored
      }
    },
    [clipboardService, platformService, showToast]
  );

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
  }, [activeTab, diagramGroupBy, diagramType, diagramTarget, loadDiagram, impactResult, loadImpact, selectedImpactTarget]);

  const handleRunCommand = async (command: StubsCommandName, args: string[] = []) => {
    runCommand(command, args, {
      onStart: () => showToast(`Running 'stubs ${command}'...`),
      onSuccess: () => {
        showToast(`'stubs ${command}' completed.`);
        loadGraph();
        if (command === "lint-arch" || command === "prune" || command === "run" || command === "harness") loadLint();
        if (command === "diagram") loadDiagram();
        if (command === "sand" || command === "phase" || command === "map" || command === "run" || command === "harness") loadSpecs();
      },
      onError: (err) => showToast(`Execution error: ${getErrorMessage(err)}`),
    });
  };

  const handleInspectImpact = useCallback(
    (target: string) => {
      setSelectedImpactTarget(target);
      setActiveTab("impact");
      loadImpact(target);
    },
    [loadImpact]
  );

  const handleViewSliceDiagram = useCallback(
    (target: string) => {
      setDiagramTarget(target);
      setDiagramType("slice");
      setActiveTab("diagram");
    },
    [setDiagramTarget, setDiagramType]
  );

  const handleStartDurableTaskFromTargets = useCallback(
    (targets: string[]) => {
      void createTask({
        title: `Multi-Target Refactoring (${targets.length} modules)`,
        goal: `Execute topological edit plan across ${targets.join(", ")}`,
        targets,
      }).then((created) => {
        if (created) {
          setActiveTab("graph");
        }
      });
    },
    [createTask]
  );

  const availableNodes = useMemo(
    () => graphData?.nodes.map((n) => n.id) || [],
    [graphData]
  );

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

      {/* 52px Unified Section Toolbar */}
      <div className="h-[52px] min-h-[52px] bg-card border-b border-border px-2 flex items-center justify-between gap-1.5 z-10 shrink-0">
        {/* Left: Segmented Sub-Tab Bar */}
        <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none py-1 min-w-0 flex-1">
          <button
            type="button"
            id="stubs-tab-graph"
            onClick={() => setActiveTab("graph")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "graph"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <Cpu className="w-3 h-3 shrink-0" />
            <span>Graph</span>
          </button>

          <button
            type="button"
            id="stubs-tab-diagram"
            onClick={() => setActiveTab("diagram")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "diagram"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <Layers className="w-3 h-3 shrink-0" />
            <span>Diagrams</span>
          </button>

          <button
            type="button"
            id="stubs-tab-lint"
            onClick={() => setActiveTab("lint")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "lint"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <ShieldCheck className="w-3 h-3 shrink-0" />
            <span>Lint</span>
          </button>

          <button
            type="button"
            id="stubs-tab-impact"
            onClick={() => setActiveTab("impact")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "impact"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <AlertOctagon className="w-3 h-3 shrink-0" />
            <span>Pre-Flight</span>
          </button>

          <button
            type="button"
            id="stubs-tab-specs"
            onClick={() => setActiveTab("specs")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "specs"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <FileCode2 className="w-3 h-3 shrink-0" />
            <span>Specs</span>
          </button>

          <button
            type="button"
            id="stubs-tab-terminal"
            onClick={() => setActiveTab("terminal")}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-[11px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap ${
              activeTab === "terminal"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
            }`}
          >
            <Terminal className="w-3 h-3 shrink-0" />
            <span>CLI</span>
          </button>
        </div>

        {/* Right Zone: Workspace Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            id="stubs-header-scan-btn"
            onClick={() => handleRunCommand("scan")}
            disabled={isExecutingCommand || isLoadingGraph}
            className="flex items-center justify-center p-1.5 rounded-lg bg-background hover:bg-muted text-foreground border border-border text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            title="Scan AST & refresh SQLite graph database"
            aria-label="Scan AST"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingGraph || isExecutingCommand ? "animate-spin" : ""}`} />
          </button>

          <button
            type="button"
            id="stubs-header-run-btn"
            onClick={runPipeline}
            disabled={isRunningPipeline || isExecutingCommand}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50 whitespace-nowrap shrink-0"
            title="Run unified stubs pipeline (scan, lint-arch, prune, sidecars)"
          >
            <Play className="w-3 h-3 shrink-0" />
            <span>
              {isRunningPipeline ? "..." : "Verify"}
            </span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 min-h-0 overflow-y-auto p-3.5 pb-[calc(4rem+env(safe-area-inset-bottom,0px))] bg-background">
        {activeTab === "graph" && (
          <StubsGraphTab
            graphData={graphData}
            searchQuery={searchQuery}
            onSetSearchQuery={setSearchQuery}
            isLoading={isLoadingGraph}
            queryResult={queryResult}
            isQuerying={isQuerying}
            onRunQuery={runQuery}
            onClearQuery={clearQuery}
            pipelineResult={pipelineResult}
            activeTask={activeTask}
            tasks={tasks}
            isMutatingTask={isMutatingTask}
            onCreateTask={createTask}
            onUpdateTask={updateTask}
            onVerifyTask={verifyTask}
            sessionHandoff={sessionHandoff}
            isLoadingHandoff={isLoadingHandoff}
            onLoadSessionHandoff={loadSessionHandoff}
            onClearSessionHandoff={clearSessionHandoff}
            onInspectImpact={handleInspectImpact}
            onViewSliceDiagram={handleViewSliceDiagram}
            onCopyText={(text) => void handleCopyText("level1-stub", text)}
          />
        )}

        {activeTab === "diagram" && (
          <StubsDiagramTab
            diagramHtml={renderedSvg}
            diagramMermaid={diagramMermaid}
            diagramGroupBy={diagramGroupBy}
            onSetDiagramGroupBy={setDiagramGroupBy}
            diagramType={diagramType}
            onSetDiagramType={setDiagramType}
            diagramTarget={diagramTarget}
            onSetDiagramTarget={setDiagramTarget}
            diagramViewMode={diagramViewMode}
            onSetDiagramViewMode={setDiagramViewMode}
            availableNodes={availableNodes}
            isLoading={isLoadingDiagram}
            error={diagramError}
            onCopyMermaid={(code) => handleCopyText("mermaid-diagram", code)}
            onOpenFileInIDE={onOpenFileInIDE}
          />
        )}

        {activeTab === "lint" && (
          <StubsLintTab
            lintPassed={lintPassed}
            lintViolations={lintViolations}
            totalChecks={totalLintChecks}
            errorCount={lintErrorCount}
            warningCount={lintWarningCount}
            durationMs={lintDurationMs}
            pruneIssues={pruneIssues}
            pruneSummary={pruneSummary}
            onRefreshLint={loadLint}
            onInspectTarget={handleInspectImpact}
            isLoading={isLoadingLint}
          />
        )}

        {activeTab === "impact" && (
          <StubsImpactTab
            impactResult={impactResult}
            selectedImpactTarget={selectedImpactTarget}
            onSetImpactTarget={setSelectedImpactTarget}
            impactGuard={impactGuard}
            onSetImpactGuard={setImpactGuard}
            onRefreshImpact={loadImpact}
            batchPreFlightResult={batchPreFlightResult}
            isLoadingBatchPreFlight={isLoadingBatchPreFlight}
            onRunBatchPreFlight={runBatchPreFlight}
            onStartDurableTaskFromTargets={handleStartDurableTaskFromTargets}
            availableNodes={availableNodes}
            isLoading={isLoadingImpact}
            onCopyBriefing={(md) => handleCopyText("tiered-context", md)}
          />
        )}

        {activeTab === "specs" && (
          <StubsSpecsTab
            specs={specs}
            selectedSpecId={selectedSpecId}
            specContent={specContent}
            isLoadingSpecDetail={isLoadingSpecDetail}
            isSavingSpec={isSavingSpec}
            isMaterializingSpec={isMaterializingSpec}
            isSandingSpec={isSandingSpec}
            onSelectSpec={selectSpec}
            onChangeSpecContent={setSpecContent}
            onSaveSpec={() => void saveSpec()}
            onMaterializeSpec={() => void materializeActiveSpec()}
            onSandSpec={() => void sandActiveSpec()}
            copiedSpecId={copiedSpecId}
            onCopySpec={handleCopyText}
          />
        )}

        {activeTab === "terminal" && (
          <StubsTerminalTab
            terminalLogs={terminalLogs}
            isExecuting={isExecutingCommand}
            onExecuteCommand={(cmd, args) => void handleRunCommand(cmd, args)}
            onExecuteRawInput={(raw) => void executeRawInput(raw)}
            onClearTerminal={clearLogs}
          />
        )}
      </div>
    </div>
  );
};
