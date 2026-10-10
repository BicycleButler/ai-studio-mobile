import { useState, useCallback, useEffect } from "react";
import {
  StubsGraphData,
  StubsLintViolation,
  StubsImpactResult,
} from "../../types";
import {
  fetchGraphData,
  fetchDiagram,
  fetchImpact,
  fetchLintResults,
} from "../../services/stubsService";
import mermaid from "mermaid";

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export function useStubsData(showToast: (msg: string) => void) {
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
      const data = await fetchGraphData();
      setGraphData(data);
    } catch (err: unknown) {
      showToast(`Failed to load graph: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingGraph(false);
    }
  }, [showToast]);

  const loadDiagram = useCallback(async () => {
    setIsLoadingDiagram(true);
    try {
      const res = await fetchDiagram(diagramGroupBy);
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
  }, [diagramGroupBy, showToast]);

  const loadLint = useCallback(async () => {
    setIsLoadingLint(true);
    try {
      const res = await fetchLintResults();
      setLintViolations(res.violations);
      setLintPassed(res.passed);
      setTotalLintChecks(res.totalChecks);
    } catch (err: unknown) {
      showToast(`Failed to run lint: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingLint(false);
    }
  }, [showToast]);

  const loadImpact = useCallback(async (target: string) => {
    setIsLoadingImpact(true);
    try {
      const res = await fetchImpact(target);
      setImpactResult(res);
    } catch (err: unknown) {
      showToast(`Failed to calculate blast radius: ${getErrorMessage(err)}`);
    } finally {
      setIsLoadingImpact(false);
    }
  }, [showToast]);

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
