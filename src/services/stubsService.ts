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

export async function fetchGraphData(): Promise<StubsGraphData> {
  const res = await fetch("/api/stubs/graph");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to fetch Stubs graph data");
  }
  return res.json();
}

export async function fetchDiagram(
  groupBy: "domain" | "layer" = "domain"
): Promise<StubsDiagramResponse> {
  const res = await fetch(`/api/stubs/diagram?groupBy=${encodeURIComponent(groupBy)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to fetch Stubs diagram");
  }
  return res.json();
}

export async function fetchImpact(target: string): Promise<StubsImpactResult> {
  const res = await fetch(`/api/stubs/impact?target=${encodeURIComponent(target)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to fetch impact analysis");
  }
  return res.json();
}

export async function fetchLintResults(): Promise<StubsLintResponse> {
  const res = await fetch("/api/stubs/lint");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to fetch architecture lint results");
  }
  return res.json();
}

export async function fetchSidecarSpecs(): Promise<StubsSpecsResponse> {
  const res = await fetch("/api/stubs/specs");
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to list sidecar specs");
  }
  return res.json();
}

export async function fetchSpecDetail(path: string): Promise<{ content: string; path: string }> {
  const res = await fetch(`/api/stubs/spec-detail?path=${encodeURIComponent(path)}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to fetch spec content");
  }
  return res.json();
}

export async function saveSpecContent(path: string, content: string): Promise<{ success: boolean; message: string }> {
  const res = await fetch("/api/stubs/spec-save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to save spec");
  }
  return res.json();
}

export async function materializeSpec(path: string): Promise<{ success: boolean; message: string; result: { targetFile: string; bytesWritten: number } }> {
  const res = await fetch("/api/stubs/spec-materialize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "Failed to materialize spec");
  }
  return res.json();
}

export async function executeStubsCommand(
  command: "scan" | "lint-arch" | "diagram" | "impact" | "sand",
  args: string[] = []
): Promise<StubsExecuteResponse> {
  const res = await fetch("/api/stubs/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ command, args }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `Failed to execute stubs ${command}`);
  }
  return res.json();
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
      } catch (err) {
        console.warn("[stubs stream] Failed to parse SSE event:", err);
      }
    };

    eventSource.onerror = (err) => {
      console.warn("[stubs stream] SSE connection state:", eventSource.readyState, err);
    };

    return () => {
      eventSource.close();
    };
  } catch (err) {
    console.error("[stubs stream] Unable to create EventSource:", err);
    return () => {};
  }
}
