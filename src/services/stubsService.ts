import {
  StubsGraphData,
  StubsImpactResult,
  StubsLintViolation,
  StubsSidecarSpec,
} from "../types";

export interface StubsDiagramResponse {
  mermaid: string;
  edgeCount: number;
  nodeCount: number;
}

export interface StubsLintResponse {
  violations: StubsLintViolation[];
  passed: boolean;
  totalChecks: number;
}

export interface StubsSpecsResponse {
  specs: StubsSidecarSpec[];
}

export interface StubsExecuteResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
  defaultErrorMessage: string = "API request failed"
): Promise<T> {
  const res = await fetch(endpoint, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || defaultErrorMessage);
  }
  return res.json();
}

export async function fetchGraphData(): Promise<StubsGraphData> {
  return apiFetch<StubsGraphData>("/api/stubs/graph", undefined, "Failed to fetch Stubs graph data");
}

export async function fetchDiagram(
  groupBy: "domain" | "layer" = "domain"
): Promise<StubsDiagramResponse> {
  return apiFetch<StubsDiagramResponse>(
    `/api/stubs/diagram?groupBy=${encodeURIComponent(groupBy)}`,
    undefined,
    "Failed to fetch Stubs diagram"
  );
}

export async function fetchImpact(target: string): Promise<StubsImpactResult> {
  return apiFetch<StubsImpactResult>(
    `/api/stubs/impact?target=${encodeURIComponent(target)}`,
    undefined,
    "Failed to fetch impact analysis"
  );
}

export async function fetchLintResults(): Promise<StubsLintResponse> {
  return apiFetch<StubsLintResponse>("/api/stubs/lint", undefined, "Failed to fetch architecture lint results");
}

export async function fetchSidecarSpecs(): Promise<StubsSpecsResponse> {
  return apiFetch<StubsSpecsResponse>("/api/stubs/specs", undefined, "Failed to list sidecar specs");
}

export async function fetchSpecDetail(path: string): Promise<{ content: string; path: string }> {
  return apiFetch<{ content: string; path: string }>(
    `/api/stubs/spec-detail?path=${encodeURIComponent(path)}`,
    undefined,
    "Failed to fetch spec content"
  );
}

export async function saveSpecContent(path: string, content: string): Promise<{ success: boolean; message: string }> {
  return apiFetch<{ success: boolean; message: string }>("/api/stubs/spec-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  }, "Failed to save spec");
}

export async function materializeSpec(path: string): Promise<{ success: boolean; message: string; result: { targetFile: string; bytesWritten: number } }> {
  return apiFetch<{ success: boolean; message: string; result: { targetFile: string; bytesWritten: number } }>("/api/stubs/spec-materialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  }, "Failed to materialize spec");
}

export async function executeStubsCommand(
  command: "scan" | "lint-arch" | "diagram" | "impact" | "sand",
  args: string[] = []
): Promise<StubsExecuteResponse> {
  return apiFetch<StubsExecuteResponse>("/api/stubs/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, args }),
  }, `Failed to execute stubs ${command}`);
}

export function connectStubsStream(
  onLog: (data: { type: string; text: string; timestamp: number; code?: number }) => void
): () => void {
  try {
    const eventSource = new EventSource("/api/stubs/stream");

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        onLog(payload);
      } catch (err: unknown) {
        console.warn("[stubs stream] Failed to parse SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("[stubs stream] SSE connection state:", eventSource.readyState, err);
    };

    return () => {
      eventSource.close();
    };
  } catch (err: unknown) {
    console.error("[stubs stream] Unable to create EventSource:", err);
    return () => {};
  }
}
