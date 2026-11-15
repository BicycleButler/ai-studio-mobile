import { useServices } from "../../services/ServiceContext";
import { getErrorMessage } from "../../utils/errorHandling";
import { useState, useCallback, useEffect } from "react";
import {
  StubsGraphData,
  StubsLintViolation,
  StubsPruneIssue,
  StubsPruneResult,
  StubsImpactResult,
  StubsQueryResult,
  StubsRunResult,
  StubsDiagramGroupBy,
  StubsDiagramType,
} from "../../types";
import mermaid from "mermaid";

export function useStubsData(showToast: (msg: string) => void) {
  const { stubsClient, logger, timeProvider } = useServices();

  // Graph state
  const [graphData, setGraphData] = useState<StubsGraphData | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);

  // GraphRAG Query state
  const [queryResult, setQueryResult] = useState<StubsQueryResult | null>(null);
  const [isQuerying, setIsQuerying] = useState(false);

  // Pipeline (`stubs run`) state
  const [pipelineResult, setPipelineResult] = useState<StubsRunResult | null>(null);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  // Diagram state
  const [diagramGroupBy, setDiagramGroupBy] = useState<StubsDiagramGroupBy>("domain");
  const [diagramType, setDiagramType] = useState<StubsDiagramType>("architecture");
  const [diagramTarget, setDiagramTarget] = useState<string>("src/App.tsx");
  const [diagramMermaid, setDiagramMermaid] = useState<string>("");
  const [renderedSvg, setRenderedSvg] = useState<string>("");
  const [diagramViewMode, setDiagramViewMode] = useState<"svg" | "code">("svg");
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false);

  // Lint & Prune state
  const [lintViolations, setLintViolations] = useState<StubsLintViolation[]>([]);
  const [lintPassed, setLintPassed] = useState<boolean>(true);
  const [totalLintChecks, setTotalLintChecks] = useState<number>(0);
  const [lintErrorCount, setLintErrorCount] = useState<number>(0);
  const [lintWarningCount, setLintWarningCount] = useState<number>(0);
  const [lintDurationMs, setLintDurationMs] = useState<number>(0);
  const [pruneIssues, setPruneIssues] = useState<StubsPruneIssue[]>([]);
  const [pruneSummary, setPruneSummary] = useState<StubsPruneResult["summary"]>({
    phantomSidecars: 0,
    untrackedCode: 0,
    zombieExports: 0,
    staleDbNodes: 0,
  });
  const [isLoadingLint, setIsLoadingLint] = useState(false);

  // Impact & Pre-Flight state
  const [impactResult, setImpactResult] = useState<StubsImpactResult | null>(null);
  const [impactGuard, setImpactGuard] = useState<"low" | "medium" | "high" | "critical">("high");
  const [isLoadingImpact, setIsLoadingImpact] = useState(false);

  const loadGraph = useCallback(async () => {
    setIsLoadingGraph(true);
    try {
      const data = await stubsClient.fetchGraphData();
      setGraphData(data);
    } catch (err: unknown) {
      showToast(`Failed to load graph: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingGraph(false);
    }
  }, [showToast, stubsClient]);

  const runQuery = useCallback(
    async (query: string, budget = 1500) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setQueryResult(null);
        return;
      }
      setIsQuerying(true);
      try {
        const res = await stubsClient.queryGraph(trimmed, budget);
        setQueryResult(res);
      } catch (err: unknown) {
        showToast(`Query failed: ${getErrorMessage(err)}`);
      } finally {
        setIsQuerying(false);
      }
    },
    [showToast, stubsClient]
  );

  const loadDiagram = useCallback(async () => {
    setIsLoadingDiagram(true);
    setDiagramError(null);
    try {
      const res = await stubsClient.fetchDiagram(
        diagramGroupBy,
        diagramType,
        diagramType === "architecture" ? undefined : diagramTarget
      );
      setDiagramMermaid(res.mermaid);
      try {
        const id = `mermaid-svg-${timeProvider.now()}`;
        const { svg } = await mermaid.render(id, res.mermaid);
        setRenderedSvg(svg);
      } catch (renderErr: unknown) {
        logger.warn("Client-side Mermaid SVG render failed, displaying code view:", renderErr);
        setRenderedSvg("");
        setDiagramError(getErrorMessage(renderErr));
        setDiagramViewMode("code");
      }
    } catch (err: unknown) {
      const msg = getErrorMessage(err);
      setDiagramError(msg);
      showToast(`Failed to load diagram: ${msg}`);
    } finally {
      setIsLoadingDiagram(false);
    }
  }, [diagramGroupBy, diagramType, diagramTarget, showToast, stubsClient, logger, timeProvider]);

  const loadLint = useCallback(async () => {
    setIsLoadingLint(true);
    try {
      const res = await stubsClient.fetchLintResults();
      setLintViolations(res.violations);
      setLintPassed(res.passed);
      setTotalLintChecks(res.totalChecks);
      setLintErrorCount(
        typeof res.errorCount === "number"
          ? res.errorCount
          : res.violations.filter((v) => v.severity === "error").length
      );
      setLintWarningCount(
        typeof res.warningCount === "number"
          ? res.warningCount
          : res.violations.filter((v) => v.severity === "warning").length
      );
      setLintDurationMs(res.durationMs || 0);
      if (res.pruneIssues) setPruneIssues(res.pruneIssues);
      if (res.pruneSummary) setPruneSummary(res.pruneSummary);
    } catch (err: unknown) {
      showToast(`Failed to run lint: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingLint(false);
    }
  }, [showToast, stubsClient]);

  const loadImpact = useCallback(
    async (target: string, guardOverride?: "low" | "medium" | "high" | "critical") => {
      if (!target) return;
      setIsLoadingImpact(true);
      try {
        const res = await stubsClient.fetchImpact(target, guardOverride || impactGuard);
        setImpactResult(res);
      } catch (err: unknown) {
        showToast(`Failed to calculate blast radius: ${getErrorMessage(err)}`);
      } finally {
        setIsLoadingImpact(false);
      }
    },
    [showToast, stubsClient, impactGuard]
  );

  const runPipeline = useCallback(async () => {
    setIsRunningPipeline(true);
    showToast("Running stubs pipeline (scan, lint-arch, prune, specs)...");
    try {
      const res = await stubsClient.runPipeline();
      setPipelineResult(res);
      await Promise.all([loadGraph(), loadLint()]);
      showToast(
        res.passed
          ? `Pipeline passed in ${res.durationMs}ms (${res.scannedFiles} modules)`
          : `Pipeline completed with ${res.lintErrors} errors in ${res.durationMs}ms`
      );
    } catch (err: unknown) {
      showToast(`Pipeline failed: ${getErrorMessage(err)}`);
    } finally {
      setIsRunningPipeline(false);
    }
  }, [loadGraph, loadLint, showToast, stubsClient]);

  // Establish SSE connection to listen for graph invalidation
  useEffect(() => {
    const cleanup = stubsClient.connectStubsStream((log) => {
      if (log.type === "exit" && log.code === 0) {
        loadGraph();
      }
    });
    return cleanup;
  }, [loadGraph, stubsClient]);

  return {
    // Graph & Query
    graphData,
    isLoadingGraph,
    loadGraph,
    queryResult,
    isQuerying,
    runQuery,
    clearQuery: () => setQueryResult(null),

    // Unified pipeline
    pipelineResult,
    isRunningPipeline,
    runPipeline,

    // Diagram
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

    // Lint & Prune
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

    // Impact & Pre-Flight
    impactResult,
    impactGuard,
    setImpactGuard,
    isLoadingImpact,
    loadImpact,
  };
}
