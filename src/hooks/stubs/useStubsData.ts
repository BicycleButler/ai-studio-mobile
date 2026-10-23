import { getErrorMessage } from "../../utils/errorHandling";
import { useState, useCallback, useEffect } from "react";
import {
  StubsGraphData,
  StubsLintViolation,
  StubsImpactResult,
} from "../../types";
import mermaid from "mermaid";
import { useServices } from "../../services/ServiceContext";


export function useStubsData(showToast: (msg: string) => void) {
  const { stubsClient } = useServices();

  // Graph state
  const [graphData, setGraphData] = useState<StubsGraphData | null>(null);
  const [isLoadingGraph, setIsLoadingGraph] = useState(false);

  // Diagram state
  const [diagramGroupBy, setDiagramGroupBy] = useState<"domain" | "layer">("domain");
  const [diagramMermaid, setDiagramMermaid] = useState<string>("");
  const [renderedSvg, setRenderedSvg] = useState<string>("");
  const [diagramViewMode, setDiagramViewMode] = useState<"svg" | "code">("svg");
  const [isLoadingDiagram, setIsLoadingDiagram] = useState(false);

  // Lint state
  const [lintViolations, setLintViolations] = useState<StubsLintViolation[]>([]);
  const [lintPassed, setLintPassed] = useState<boolean>(true);
  const [totalLintChecks, setTotalLintChecks] = useState<number>(0);
  const [isLoadingLint, setIsLoadingLint] = useState(false);

  // Impact state
  const [impactResult, setImpactResult] = useState<StubsImpactResult | null>(null);
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

  const loadDiagram = useCallback(async () => {
    setIsLoadingDiagram(true);
    try {
      const res = await stubsClient.fetchDiagram(diagramGroupBy);
      setDiagramMermaid(res.mermaid);
      try {
        const id = "mermaid-svg-" + Date.now();
        const { svg } = await mermaid.render(id, res.mermaid);
        setRenderedSvg(svg);
      } catch (renderErr: unknown) {
        console.warn("Client-side Mermaid SVG render failed, displaying code view:", renderErr);
        setRenderedSvg("");
        setDiagramViewMode("code");
      }
    } catch (err: unknown) {
      showToast(`Failed to load diagram: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingDiagram(false);
    }
  }, [diagramGroupBy, showToast, stubsClient]);

  const loadLint = useCallback(async () => {
    setIsLoadingLint(true);
    try {
      const res = await stubsClient.fetchLintResults();
      setLintViolations(res.violations);
      setLintPassed(res.passed);
      setTotalLintChecks(res.totalChecks);
    } catch (err: unknown) {
      showToast(`Failed to run lint: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingLint(false);
    }
  }, [showToast, stubsClient]);

  const loadImpact = useCallback(async (target: string) => {
    setIsLoadingImpact(true);
    try {
      const res = await stubsClient.fetchImpact(target);
      setImpactResult(res);
    } catch (err: unknown) {
      showToast(`Failed to calculate blast radius: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingImpact(false);
    }
  }, [showToast, stubsClient]);

  // Establish SSE connection to listen for graph invalidation
  useEffect(() => {
    const cleanup = stubsClient.connectStubsStream((log) => {
      // Whenever `stubs scan` completes, or a "graph_updated" signal is detected, reload graph
      if (log.type === "exit" && log.text.includes("code 0") && log.code === 0) {
        // If a command like 'stubs scan' successfully exited, proactive refresh the graph data.
        // We will just fetch it directly. We could be more granular but this guarantees sync.
        loadGraph();
      }
    });
    return cleanup;
  }, [loadGraph, stubsClient]);

  return {
    // Graph
    graphData,
    isLoadingGraph,
    loadGraph,

    // Diagram
    diagramGroupBy,
    setDiagramGroupBy,
    diagramMermaid,
    renderedSvg,
    diagramViewMode,
    setDiagramViewMode,
    isLoadingDiagram,
    loadDiagram,

    // Lint
    lintViolations,
    lintPassed,
    totalLintChecks,
    isLoadingLint,
    loadLint,

    // Impact
    impactResult,
    isLoadingImpact,
    loadImpact,
  };
}
