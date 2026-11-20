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
  ClipboardList,
  Plus,
  FileText,
} from "lucide-react";
import {
  StubsGraphData,
  StubsNode,
  StubsQueryResult,
  StubsRunResult,
  StubsAgenticTask,
  StubsSessionHandoff,
} from "../../types/stubs";
import { StubsTaskUpdateInput } from "../../services/stubsService";

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
  activeTask: StubsAgenticTask | null;
  tasks: StubsAgenticTask[];
  isMutatingTask: boolean;
  onCreateTask: (input: {
    title: string;
    goal?: string;
    targetFiles?: string[];
    targets?: string[];
  }) => Promise<StubsAgenticTask | null>;
  onUpdateTask: (input: StubsTaskUpdateInput) => Promise<StubsAgenticTask | null>;
  onVerifyTask?: (taskId?: string) => Promise<unknown>;
  sessionHandoff: StubsSessionHandoff | null;
  isLoadingHandoff: boolean;
  onLoadSessionHandoff: (taskId?: string) => Promise<StubsSessionHandoff | null>;
  onClearSessionHandoff: () => void;
  onInspectImpact: (target: string) => void;
  onViewSliceDiagram: (target: string) => void;
  onCopyText?: (text: string) => void;
}

const QUERY_PRESETS = [
  { label: "map:", value: "map:" },
  { label: "drift:", value: "drift:" },
  { label: "hubs:", value: "hubs:" },
  { label: "task:", value: "task:" },
  { label: "tests:", value: "tests: server/stubsService.ts" },
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
  activeTask,
  tasks,
  isMutatingTask,
  onCreateTask,
  onUpdateTask,
  onVerifyTask,
  sessionHandoff,
  isLoadingHandoff,
  onLoadSessionHandoff,
  onClearSessionHandoff,
  onInspectImpact,
  onViewSliceDiagram,
  onCopyText,
}) => {
  const [domainFilter, setDomainFilter] = useState<string>("all");
  const [graphRagInput, setGraphRagInput] = useState<string>("");
  const [showNewTaskForm, setShowNewTaskForm] = useState<boolean>(false);
  const [showTaskHistory, setShowTaskHistory] = useState<boolean>(false);
  const [taskNoteInput, setTaskNoteInput] = useState<string>("");
  const [newTaskTitle, setNewTaskTitle] = useState<string>("");
  const [newTaskGoal, setNewTaskGoal] = useState<string>("");
  const [newTaskTargets, setNewTaskTargets] = useState<string>("src/types/stubs.ts, src/services/stubsService.ts");

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

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    const targets = newTaskTargets
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const created = await onCreateTask({
      title: newTaskTitle.trim(),
      goal: newTaskGoal.trim() || newTaskTitle.trim(),
      targetFiles: targets.length > 0 ? targets : ["src/types/stubs.ts"],
    });
    if (created) {
      setNewTaskTitle("");
      setNewTaskGoal("");
      setShowNewTaskForm(false);
    }
  };

  const nextStepStatus = (current: "pending" | "completed" | "failed"): "pending" | "completed" | "failed" => {
    return current === "completed" ? "pending" : "completed";
  };

  const nextTargetStatus = (current: "pending" | "edited" | "verified"): "pending" | "edited" | "verified" => {
    if (current === "pending") return "edited";
    if (current === "edited") return "verified";
    return "pending";
  };

  const allTasks = tasks.length > 0 ? tasks : graphData.tasks ?? [];
  const currentTask = activeTask ?? graphData.activeTask ?? allTasks[allTasks.length - 1] ?? null;

  return (
    <div className="@container space-y-4 max-w-6xl mx-auto animate-in fade-in duration-150">
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
              {pipelineResult.checkpointId ? ` · ${pipelineResult.checkpointId}` : ""}
              {typeof pipelineResult.changedModulesCount === "number"
                ? ` · ${pipelineResult.changedModulesCount} AST delta${pipelineResult.changedModulesCount === 1 ? "" : "s"}`
                : ""}{" "}
              · {pipelineResult.durationMs}ms
            </span>
          </div>
          <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-5 gap-2">
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

      {/* Durable Agentic Task & Checkpoint Ledger */}
      <div className="p-3.5 rounded-xl bg-card border border-border space-y-3" id="durable-task-ledger-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary shrink-0" />
            <div>
              <h3 className="text-xs font-semibold text-foreground">
                Durable Agentic Task & Checkpoint Ledger
              </h3>
              <p className="text-[11px] font-mono text-muted-foreground">
                {graphData.lastCheckpoint
                  ? `Latest checkpoint ${graphData.lastCheckpoint.id} · ${graphData.lastCheckpoint.passed ? "Verified" : "Action Needed"} · ${graphData.lastCheckpoint.lintErrors} arch errors · ${graphData.lastCheckpoint.designViolations} design violations`
                  : "Persisted in .stubs/harness-ledger.json across sessions"}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {allTasks.length > 0 && (
              <button
                type="button"
                id="stubs-toggle-task-history-btn"
                onClick={() => setShowTaskHistory((prev) => !prev)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
              >
                <span>{showTaskHistory ? "Hide Ledger" : `Task History (${allTasks.length})`}</span>
              </button>
            )}

            <button
              type="button"
              id="stubs-generate-handoff-btn"
              onClick={() => void onLoadSessionHandoff(currentTask?.id)}
              disabled={isLoadingHandoff}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer disabled:opacity-50"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{isLoadingHandoff ? "Synthesizing..." : "Session Handoff Packet"}</span>
            </button>

            <button
              type="button"
              id="stubs-toggle-new-task-btn"
              onClick={() => setShowNewTaskForm((prev) => !prev)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{showNewTaskForm ? "Cancel" : "New Durable Task"}</span>
            </button>
          </div>
        </div>

        {/* Durable Task History & Resumption Switcher */}
        {showTaskHistory && allTasks.length > 0 && (
          <div className="p-3 rounded-lg bg-background border border-border space-y-2" id="stubs-task-history-panel">
            <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
              <span>Durable Task Ledger History ({allTasks.length} tracked sessions)</span>
              <span className="font-mono">Resume any task to restore its baseline AST & topological plan</span>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {[...allTasks].reverse().map((t) => {
                const isActive = currentTask?.id === t.id;
                const doneSteps = t.steps.filter((s) => s.status === "completed").length;
                return (
                  <div
                    key={t.id}
                    className="p-2 rounded-md bg-card border border-border flex flex-wrap items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-foreground truncate">
                        {t.title} {isActive ? "(ACTIVE)" : ""}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground truncate">
                        {t.id} · {t.status.toUpperCase()} · {doneSteps}/{t.steps.length} steps · {t.editPlan.length} modules
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        disabled={isMutatingTask}
                        onClick={() => void onLoadSessionHandoff(t.id)}
                        className="px-2 py-1 rounded bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground cursor-pointer"
                      >
                        Handoff
                      </button>
                      {!isActive && (
                        <button
                          type="button"
                          disabled={isMutatingTask}
                          onClick={() =>
                            void onUpdateTask({
                              taskId: t.id,
                              setActive: true,
                            })
                          }
                          className="px-2 py-1 rounded bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground cursor-pointer"
                        >
                          Resume Task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Inline New Durable Task Creator */}
        {showNewTaskForm && (
          <form
            onSubmit={handleCreateTaskSubmit}
            className="p-3 rounded-lg bg-background border border-border space-y-2.5"
            id="stubs-new-task-form"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1" htmlFor="new-task-title-input">
                  Task Title
                </label>
                <input
                  id="new-task-title-input"
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="e.g., Upgrade GraphRAG Session Handoff Pipeline"
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-muted-foreground mb-1" htmlFor="new-task-targets-input">
                  Target Modules (comma-separated)
                </label>
                <input
                  id="new-task-targets-input"
                  type="text"
                  value={newTaskTargets}
                  onChange={(e) => setNewTaskTargets(e.target.value)}
                  placeholder="src/types/stubs.ts, src/services/stubsService.ts"
                  className="w-full bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <input
                id="new-task-goal-input"
                type="text"
                value={newTaskGoal}
                onChange={(e) => setNewTaskGoal(e.target.value)}
                placeholder="Optional goal / acceptance invariant description..."
                className="flex-1 min-w-[220px] bg-card border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="submit"
                id="stubs-submit-new-task-btn"
                disabled={isMutatingTask || !newTaskTitle.trim()}
                className="px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-semibold text-foreground transition-colors cursor-pointer disabled:opacity-50"
              >
                {isMutatingTask ? "Starting..." : "Initialize Topological Task"}
              </button>
            </div>
          </form>
        )}

        {/* Active Durable Task Body */}
        {currentTask ? (
          <div className="p-3 rounded-lg bg-background border border-border space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-semibold text-foreground">
                  {currentTask.title}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {currentTask.id} · guard: {currentTask.guardThreshold.toUpperCase()} · status: {currentTask.status.toUpperCase()} ·{" "}
                  {currentTask.steps.filter((s) => s.status === "completed").length}/{currentTask.steps.length} steps verified
                </div>
                {currentTask.goal && currentTask.goal !== currentTask.title && (
                  <p className="text-xs text-muted-foreground mt-1">{currentTask.goal}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {onVerifyTask && (
                  <button
                    type="button"
                    id="stubs-verify-task-gates-btn"
                    disabled={isMutatingTask}
                    onClick={() => void onVerifyTask(currentTask.id)}
                    className="px-2.5 py-1 rounded-md bg-card border border-border hover:bg-muted text-[11px] font-semibold text-foreground transition-colors cursor-pointer disabled:opacity-50"
                    title="Execute automated 5-phase durable task verification gate"
                  >
                    {isMutatingTask ? "Verifying..." : "Verify Task Gates"}
                  </button>
                )}
                <button
                  type="button"
                  id="stubs-reset-baseline-btn"
                  disabled={isMutatingTask}
                  onClick={() =>
                    void onUpdateTask({
                      taskId: currentTask.id,
                      resetBaseline: true,
                    })
                  }
                  className="px-2.5 py-1 rounded-md bg-card border border-border hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer disabled:opacity-50"
                  title="Re-snapshot task baseline AST hashes and exported symbol contracts"
                >
                  Reset Baseline
                </button>
                <button
                  type="button"
                  id="stubs-complete-task-btn"
                  disabled={isMutatingTask}
                  onClick={() =>
                    void onUpdateTask({
                      taskId: currentTask.id,
                      taskStatus: "completed",
                    })
                  }
                  className="px-2.5 py-1 rounded-md bg-card border border-border hover:bg-muted text-[11px] font-medium text-foreground transition-colors cursor-pointer disabled:opacity-50"
                >
                  Complete Task
                </button>
              </div>
            </div>

            {/* Automated Gate Verification Summary Banner */}
            {currentTask.verificationReport && (
              <div
                id="stubs-task-verification-report"
                className="p-2.5 rounded-lg bg-card border border-border flex flex-wrap items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  {currentTask.verificationReport.passed ? (
                    <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-foreground shrink-0" />
                  )}
                  <span className="font-medium text-foreground truncate">
                    {currentTask.verificationReport.summary}
                  </span>
                </div>
                <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                  checkpoint: {currentTask.verificationReport.checkpointId || "—"} ·{" "}
                  {currentTask.verificationReport.breakingContractsCount} breaking contracts
                </span>
              </div>
            )}

            {/* 5-Phase Execution & Verification Steps */}
            <div className="grid grid-cols-1 @lg:grid-cols-2 @4xl:grid-cols-5 gap-2">
              {currentTask.steps.map((step) => (
                <button
                  key={step.id}
                  type="button"
                  disabled={isMutatingTask}
                  onClick={() =>
                    void onUpdateTask({
                      taskId: currentTask.id,
                      stepId: step.id,
                      stepStatus: nextStepStatus(step.status),
                    })
                  }
                  className="p-2 rounded-lg bg-card border border-border hover:border-primary/40 text-start transition-colors cursor-pointer flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <span className="text-[11px] font-semibold text-foreground truncate">
                      {step.label}
                    </span>
                    <span className="text-[11px] font-mono text-muted-foreground uppercase shrink-0">
                      {step.status === "completed" ? "DONE" : step.status === "failed" ? "FAIL" : "WAIT"}
                    </span>
                  </div>
                  <span className="text-[11px] font-mono text-muted-foreground truncate">
                    {step.detail || step.phase}
                  </span>
                </button>
              ))}
            </div>

            {/* Topological Edit Sequence & Symbol Contract Parity */}
            {currentTask.editPlan.length > 0 && (
              <div className="space-y-1.5 pt-1 border-t border-border/60">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <span className="font-medium">
                    Topological Edit Sequence & Symbol Contract Parity ({currentTask.editPlan.length} modules: Dependencies → Targets → Callers)
                  </span>
                  <span className="font-mono">Click status to cycle pending → edited → verified</span>
                </div>
                <div className="grid grid-cols-1 @xl:grid-cols-2 @4xl:grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                  {currentTask.editPlan.map((item, idx) => {
                    const drifted =
                      item.driftedSinceBaseline ||
                      (item.baselineAstHash &&
                        item.currentAstHash &&
                        item.baselineAstHash !== item.currentAstHash);
                    const contractLabel =
                      item.contractStatus === "breaking"
                        ? `contract: breaking (-${item.removedExports?.length || 1})`
                        : item.contractStatus === "expanded"
                        ? `contract: +${item.addedExports?.length || 1} export`
                        : "contract: intact";
                    return (
                      <div
                        key={item.path}
                        className="p-2 rounded-md bg-card border border-border flex items-center justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-medium text-foreground truncate" title={item.path}>
                            {idx + 1}. {item.path}
                          </div>
                          <div className="font-mono text-muted-foreground truncate">
                            L{item.layer} · {item.role} · hash:{item.currentAstHash || "—"}
                            {drifted ? " (delta)" : ""} · {contractLabel}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            disabled={isMutatingTask}
                            onClick={() =>
                              void onUpdateTask({
                                taskId: currentTask.id,
                                targetPath: item.path,
                                targetStatus: nextTargetStatus(item.status),
                              })
                            }
                            className="px-2 py-0.5 rounded bg-background border border-border hover:bg-muted font-mono text-[11px] text-foreground cursor-pointer"
                          >
                            {item.status}
                          </button>
                          <button
                            type="button"
                            onClick={() => onInspectImpact(item.path)}
                            title="Inspect Pre-Flight"
                            aria-label={`Pre-flight ${item.path}`}
                            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Crosshair className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* AST-Discovered Affected Unit Tests & Durable Execution Journal */}
            <div className="grid grid-cols-1 @3xl:grid-cols-2 gap-2.5 pt-2 border-t border-border/60">
              {/* Affected Unit Test Suite Strip */}
              <div className="p-2.5 rounded-lg bg-card border border-border space-y-1.5" id="stubs-task-affected-tests">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-foreground">
                    AST-Discovered Affected Unit Test Suites ({currentTask.affectedTests?.length ?? 0})
                  </span>
                  {onCopyText && currentTask.recommendedTestCommand && (
                    <button
                      type="button"
                      id="stubs-copy-test-cmd-btn"
                      onClick={() => onCopyText(currentTask.recommendedTestCommand!)}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-background border border-border hover:bg-muted text-[11px] font-mono text-foreground cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Test Command</span>
                    </button>
                  )}
                </div>
                <div className="text-[11px] font-mono text-foreground bg-background border border-border rounded px-2 py-1 truncate">
                  $ {currentTask.recommendedTestCommand || "npx vitest run"}
                </div>
                <div className="text-[11px] font-mono text-muted-foreground truncate">
                  {currentTask.affectedTests && currentTask.affectedTests.length > 0
                    ? currentTask.affectedTests.join(", ")
                    : "No direct or caller unit test files matched in AST graph"}
                </div>
              </div>

              {/* Durable Execution Journal & Notes */}
              <div className="p-2.5 rounded-lg bg-card border border-border space-y-1.5" id="stubs-task-execution-journal">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-foreground">
                    Durable Execution Journal ({currentTask.notes?.length ?? 0} entries)
                  </span>
                  <span className="text-[11px] font-mono text-muted-foreground">
                    Included in Session Handoff
                  </span>
                </div>
                {currentTask.notes && currentTask.notes.length > 0 && (
                  <div className="space-y-0.5 max-h-20 overflow-y-auto text-[11px] font-mono text-muted-foreground">
                    {currentTask.notes.slice(-4).map((note, nIdx) => (
                      <div key={nIdx} className="truncate" title={note}>
                        • {note}
                      </div>
                    ))}
                  </div>
                )}
                <form
                  id="stubs-task-note-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!taskNoteInput.trim()) return;
                    const noteText = taskNoteInput.trim();
                    setTaskNoteInput("");
                    void onUpdateTask({
                      taskId: currentTask.id,
                      note: noteText,
                    });
                  }}
                  className="flex items-center gap-1.5"
                >
                  <input
                    id="stubs-task-note-input"
                    type="text"
                    value={taskNoteInput}
                    onChange={(e) => setTaskNoteInput(e.target.value)}
                    placeholder="Append durable decision or checkpoint note..."
                    className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-1 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    id="stubs-add-task-note-btn"
                    disabled={isMutatingTask || !taskNoteInput.trim()}
                    className="px-2 py-1 rounded bg-background border border-border hover:bg-muted text-[11px] font-medium text-foreground cursor-pointer disabled:opacity-50 shrink-0"
                  >
                    Add Note
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-3 rounded-lg bg-background border border-border flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              No active durable coding task. Start one or resume a historical task to track multi-file topological edit progress and AST deltas across turns.
            </span>
            {allTasks.length > 0 && (
              <button
                type="button"
                onClick={() => setShowTaskHistory(true)}
                className="px-2.5 py-1 rounded bg-card border border-border hover:bg-muted font-mono text-[11px] text-foreground cursor-pointer"
              >
                View {allTasks.length} Task{allTasks.length === 1 ? "" : "s"} in Ledger
              </button>
            )}
          </div>
        )}

        {/* Session Handoff & Context Resumption Packet Viewer */}
        {sessionHandoff && (
          <div className="rounded-lg bg-background border border-border overflow-hidden" id="stubs-handoff-packet-panel">
            <div className="px-3 py-2 bg-muted/30 border-b border-border flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-foreground">
                  Session Handoff & Context Resumption Packet
                </span>
                <span className="text-[11px] font-mono text-muted-foreground ms-2">
                  {sessionHandoff.changedModules.length} AST deltas ·{" "}
                  {sessionHandoff.lastCheckpoint ? `${sessionHandoff.lastCheckpoint.lintErrors} lint errors` : "0 lint errors"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                {onCopyText && (
                  <button
                    type="button"
                    id="stubs-copy-handoff-btn"
                    onClick={() => onCopyText(sessionHandoff.handoffMarkdown)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-card border border-border hover:bg-muted text-[11px] font-medium text-foreground cursor-pointer"
                  >
                    <Copy className="w-3 h-3" />
                    <span>Copy Handoff Markdown</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClearSessionHandoff}
                  aria-label="Close session handoff packet"
                  className="p-1 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <pre className="p-3 text-[11px] font-mono text-foreground/90 whitespace-pre-wrap overflow-x-auto max-h-72 leading-relaxed">
              {sessionHandoff.handoffMarkdown}
            </pre>
          </div>
        )}
      </div>

      {/* Metric Summary Grid (Tabular Numerals, Single-Elevation) */}
      <div className="grid grid-cols-3 @2xl:grid-cols-6 gap-2.5">
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground truncate">Modules</span>
          <span className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.totalFiles}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground truncate">Edges</span>
          <span className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.totalEdges}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground truncate">Symbols</span>
          <span className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.totalSymbols}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground truncate">Cycles</span>
          <span className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.cyclesCount}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground truncate">Sidecars</span>
          <span className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
            {graphData.summary.sidecarsCount ?? 0}
          </span>
        </div>
        <div className="p-3 rounded-xl bg-card border border-border flex flex-col">
          <span className="text-[11px] font-medium text-muted-foreground truncate">Planning Docs</span>
          <span className="text-xl font-semibold text-foreground mt-1 font-mono tabular-nums">
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
              placeholder='Try: "drift:", "hubs:", "task:", "explain: StubsClient", "path: App.tsx to stubs.ts", or "map:"'
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
            className="px-4 py-2 rounded-lg bg-background border border-border hover:bg-muted text-foreground text-xs font-medium transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
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

            {queryResult.driftResult && (
              <div className="space-y-2">
                <div className="text-[11px] font-mono text-muted-foreground">
                  Baseline Checkpoint: {queryResult.driftResult.baselineCheckpointId || "—"} ·{" "}
                  {queryResult.driftResult.changedModules.length} AST module delta(s) ·{" "}
                  {queryResult.driftResult.driftedSidecars.length} drifted sidecar(s)
                </div>
                {queryResult.driftResult.changedModules.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-y-auto">
                    {queryResult.driftResult.changedModules.map((mod) => (
                      <div
                        key={mod.path}
                        className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-mono font-semibold text-foreground truncate">
                            {mod.path}
                          </div>
                          <div className="text-[11px] font-mono text-muted-foreground mt-0.5">
                            {mod.status.toUpperCase()} · {mod.domain} · L{mod.layer} · {mod.previousHash || "—"} → {mod.currentHash}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => onInspectImpact(mod.path)}
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

            {queryResult.hubsResult && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
                {queryResult.hubsResult.hubs.map((hub) => (
                  <div
                    key={hub.id}
                    className="p-2.5 rounded-lg bg-background border border-border flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-mono font-semibold text-foreground truncate">
                        {hub.id}
                      </div>
                      <div className="text-[11px] font-mono text-muted-foreground mt-0.5 truncate">
                        L{hub.layer} · {hub.domain} · fan-in:{hub.fanIn} · fan-out:{hub.fanOut} · degree:{hub.degree}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => onInspectImpact(hub.id)}
                      className="px-2 py-1 rounded bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground shrink-0 cursor-pointer"
                    >
                      Pre-Flight
                    </button>
                  </div>
                ))}
              </div>
            )}

            {queryResult.taskResult && (
              <div className="p-2.5 rounded-lg bg-background border border-border space-y-1.5 text-xs">
                {queryResult.taskResult.activeTask ? (
                  <>
                    <div className="font-semibold text-foreground">
                      Active Task: {queryResult.taskResult.activeTask.title} ({queryResult.taskResult.activeTask.id})
                    </div>
                    <div className="text-[11px] font-mono text-muted-foreground">
                      Status: {queryResult.taskResult.activeTask.status} · Targets: {queryResult.taskResult.activeTask.targetFiles.join(", ")}
                    </div>
                  </>
                ) : (
                  <div className="text-muted-foreground">
                    No active durable task. {queryResult.taskResult.totalTasks} historical task(s) stored in ledger.
                  </div>
                )}
              </div>
            )}

            {queryResult.testsResult && (
              <div className="p-3 rounded-lg bg-background border border-border space-y-2 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono font-semibold text-foreground">
                    $ {queryResult.testsResult.recommendedCommand}
                  </span>
                  {onCopyText && (
                    <button
                      type="button"
                      onClick={() => onCopyText(queryResult.testsResult!.recommendedCommand)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-card border border-border hover:bg-muted text-[11px] font-medium text-foreground cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copy Test Command</span>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 @xl:grid-cols-2 gap-3 text-[11px] font-mono">
                  <div className="min-w-0">
                    <div className="text-muted-foreground mb-1">
                      Direct Target Tests ({queryResult.testsResult.directTests.length})
                    </div>
                    <div className="text-foreground space-y-0.5">
                      {queryResult.testsResult.directTests.length > 0
                        ? queryResult.testsResult.directTests.map((t) => (
                            <div key={t} className="truncate" title={t}>
                              {t}
                            </div>
                          ))
                        : "—"}
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className="text-muted-foreground mb-1">
                      Upstream Caller Tests ({queryResult.testsResult.callerTests.length})
                    </div>
                    <div className="text-foreground space-y-0.5">
                      {queryResult.testsResult.callerTests.length > 0
                        ? queryResult.testsResult.callerTests.map((t) => (
                            <div key={t} className="truncate" title={t}>
                              {t}
                            </div>
                          ))
                        : "—"}
                    </div>
                  </div>
                </div>
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
                  className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground text-[11px] font-medium cursor-pointer"
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
                const inActivePlan = currentTask?.editPlan.some((e) => e.path === node.id);
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
                        <div className="flex items-center justify-between gap-1.5">
                          <h4 className="text-xs font-semibold text-foreground truncate" title={node.name}>
                            {node.name}
                          </h4>
                          {inActivePlan && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" aria-label="In active durable task plan" />
                          )}
                        </div>
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
