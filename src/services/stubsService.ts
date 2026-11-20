import { IPlatformService } from "./IPlatformService";
import { IApiClient } from "../utils/apiClient";
import {
  StubsGraphData,
  StubsImpactResult,
  StubsLintViolation,
  StubsPruneIssue,
  StubsPruneResult,
  StubsSidecarSpec,
  StubsQueryResult,
  StubsRunResult,
  StubsTieredContext,
  StubsDiagramGroupBy,
  StubsDiagramType,
  StubsCommandName,
  StubsInterfaceStub,
  StubsWorkspaceFileContent,
  WorkspaceFileTreeResponse,
  StubsAgenticTask,
  StubsTaskStatus,
  StubsTaskVerificationReport,
  StubsBatchPreFlightResult,
  StubsSessionHandoff,
} from "../types";
import { ILogger, DefaultLoggerFactory } from "../utils/logger";
import { BrowserPlatformService } from "../services/platformService";

export interface StubsDiagramResponse {
  mermaid: string;
  edgeCount: number;
  nodeCount: number;
}

export interface StubsLintResponse {
  violations: StubsLintViolation[];
  passed: boolean;
  totalChecks: number;
  errorCount?: number;
  warningCount?: number;
  durationMs?: number;
  pruneIssues?: StubsPruneIssue[];
  pruneSummary?: StubsPruneResult["summary"];
}

export interface StubsSpecsResponse {
  specs: StubsSidecarSpec[];
}

export interface StubsExecuteResponse {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export interface StubsTasksResponse {
  activeTask?: StubsAgenticTask | null;
  tasks: StubsAgenticTask[];
}

export interface StubsTaskUpdateInput {
  taskId: string;
  taskStatus?: StubsTaskStatus;
  status?: StubsTaskStatus;
  stepId?: string;
  stepStatus?: "pending" | "completed" | "failed";
  targetPath?: string;
  targetFilePath?: string;
  targetStatus?: "pending" | "edited" | "verified";
  setActive?: boolean;
  resetBaseline?: boolean;
  note?: string;
}

export interface StubsTaskVerifyResponse {
  task: StubsAgenticTask;
  report: StubsTaskVerificationReport;
  pipeline: StubsRunResult;
}

export interface IStubsClient {
  fetchGraphData(): Promise<StubsGraphData>;
  queryGraph(query: string, budget?: number): Promise<StubsQueryResult>;
  fetchDiagram(
    groupBy?: StubsDiagramGroupBy,
    type?: StubsDiagramType,
    target?: string
  ): Promise<StubsDiagramResponse>;
  fetchImpact(target: string, guard?: "low" | "medium" | "high" | "critical"): Promise<StubsImpactResult>;
  runBatchPreFlight(targets: string[], guard?: "low" | "medium" | "high" | "critical"): Promise<StubsBatchPreFlightResult>;
  fetchContextPackage(target: string): Promise<StubsTieredContext>;
  fetchInterfaceStub(target: string): Promise<StubsInterfaceStub>;
  syncContextMaps(): Promise<{ updatedFiles: string[]; totalModules: number }>;
  fetchLintResults(): Promise<StubsLintResponse>;
  fetchPruneResults(): Promise<StubsPruneResult>;
  runPipeline(): Promise<StubsRunResult>;
  fetchTasks(): Promise<StubsTasksResponse>;
  createTask(input: {
    title: string;
    goal?: string;
    targetFiles?: string[];
    targets?: string[];
    guardThreshold?: "low" | "medium" | "high" | "critical";
  }): Promise<{ task: StubsAgenticTask }>;
  updateTask(input: StubsTaskUpdateInput): Promise<{ task: StubsAgenticTask }>;
  verifyTask(taskId?: string): Promise<StubsTaskVerifyResponse>;
  fetchSessionHandoff(taskId?: string): Promise<StubsSessionHandoff>;
  fetchSidecarSpecs(): Promise<StubsSpecsResponse>;
  fetchSpecDetail(path: string): Promise<{ content: string; path: string }>;
  fetchWorkspaceFileTree(): Promise<WorkspaceFileTreeResponse>;
  fetchWorkspaceFile(path: string): Promise<StubsWorkspaceFileContent>;
  saveSpecContent(path: string, content: string): Promise<{ success: boolean; message: string }>;
  materializeSpec(path: string): Promise<{ success: boolean; message: string; result: { targetFile: string; bytesWritten: number } }>;
  sandSpec(path: string): Promise<{ success: boolean; message: string; result: { path: string; targetFile: string; astHash: string } }>;
  executeStubsCommand(command: StubsCommandName, args?: string[]): Promise<StubsExecuteResponse>;
  connectStubsStream(onLog: (data: { type: string; text: string; timestamp: number; code?: number }) => void, endpoint?: string): () => void;
}

export interface StubsClientConfig {
  apiClient: IApiClient;
  logger?: ILogger;
  createEventSource?: (endpoint: string) => EventSource | undefined;
  platformService?: IPlatformService;
}

export class StubsClient implements IStubsClient {
  private config: Required<Omit<StubsClientConfig, "platformService">> & { platformService: IPlatformService };
  constructor(config: StubsClientConfig) {
    const platformService = config.platformService || new BrowserPlatformService();
    this.config = {
      apiClient: config.apiClient,
      logger: config.logger || new DefaultLoggerFactory().createLogger(),
      platformService,
      createEventSource: config.createEventSource || ((endpoint: string) => platformService.createEventSource(endpoint) || undefined),
    };
  }

  public async fetchGraphData(): Promise<StubsGraphData> {
    return this.config.apiClient.fetch<StubsGraphData>("/api/stubs/graph", undefined, "Failed to fetch Stubs graph data");
  }

  public async queryGraph(query: string, budget = 1500): Promise<StubsQueryResult> {
    return this.config.apiClient.fetch<StubsQueryResult>(
      `/api/stubs/query?q=${encodeURIComponent(query)}&budget=${encodeURIComponent(String(budget))}`,
      undefined,
      "Failed to execute GraphRAG query"
    );
  }

  public async fetchDiagram(
    groupBy: StubsDiagramGroupBy = "domain",
    type?: StubsDiagramType,
    target?: string
  ): Promise<StubsDiagramResponse> {
    let url = `/api/stubs/diagram?groupBy=${encodeURIComponent(groupBy)}`;
    if (type && type !== "architecture") {
      url += `&type=${encodeURIComponent(type)}`;
    }
    if (target) {
      url += `&target=${encodeURIComponent(target)}`;
    }
    return this.config.apiClient.fetch<StubsDiagramResponse>(
      url,
      undefined,
      "Failed to fetch Stubs diagram"
    );
  }

  public async fetchImpact(
    target: string,
    guard?: "low" | "medium" | "high" | "critical"
  ): Promise<StubsImpactResult> {
    let url = `/api/stubs/impact?target=${encodeURIComponent(target)}`;
    if (guard) {
      url += `&guard=${encodeURIComponent(guard)}`;
    }
    return this.config.apiClient.fetch<StubsImpactResult>(
      url,
      undefined,
      "Failed to fetch impact analysis"
    );
  }

  public async runBatchPreFlight(
    targets: string[],
    guard?: "low" | "medium" | "high" | "critical"
  ): Promise<StubsBatchPreFlightResult> {
    return this.config.apiClient.fetch<StubsBatchPreFlightResult>(
      "/api/stubs/pre-flight-batch",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targets, guard }),
      },
      "Failed to compute multi-target batch pre-flight"
    );
  }

  public async fetchContextPackage(target: string): Promise<StubsTieredContext> {
    return this.config.apiClient.fetch<StubsTieredContext>(
      `/api/stubs/context?target=${encodeURIComponent(target)}`,
      undefined,
      "Failed to fetch tiered agent context"
    );
  }

  public async fetchInterfaceStub(target: string): Promise<StubsInterfaceStub> {
    return this.config.apiClient.fetch<StubsInterfaceStub>(
      `/api/stubs/stub?target=${encodeURIComponent(target)}`,
      undefined,
      "Failed to extract Level 1 Interface Skeleton Stub"
    );
  }

  public async syncContextMaps(): Promise<{ updatedFiles: string[]; totalModules: number }> {
    return this.config.apiClient.fetch<{ updatedFiles: string[]; totalModules: number }>(
      "/api/stubs/map",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      },
      "Failed to synchronize architecture context maps"
    );
  }

  public async fetchLintResults(): Promise<StubsLintResponse> {
    return this.config.apiClient.fetch<StubsLintResponse>("/api/stubs/lint", undefined, "Failed to fetch architecture lint results");
  }

  public async fetchPruneResults(): Promise<StubsPruneResult> {
    return this.config.apiClient.fetch<StubsPruneResult>("/api/stubs/prune", undefined, "Failed to fetch workspace prune results");
  }

  public async runPipeline(): Promise<StubsRunResult> {
    return this.config.apiClient.fetch<StubsRunResult>("/api/stubs/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, "Failed to run Stubs pipeline");
  }

  public async fetchTasks(): Promise<StubsTasksResponse> {
    return this.config.apiClient.fetch<StubsTasksResponse>("/api/stubs/tasks", undefined, "Failed to fetch durable agentic tasks");
  }

  public async createTask(input: {
    title: string;
    goal?: string;
    targetFiles?: string[];
    targets?: string[];
    guardThreshold?: "low" | "medium" | "high" | "critical";
  }): Promise<{ task: StubsAgenticTask }> {
    return this.config.apiClient.fetch<{ task: StubsAgenticTask }>(
      "/api/stubs/tasks",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "Failed to create durable agentic task"
    );
  }

  public async updateTask(input: StubsTaskUpdateInput): Promise<{ task: StubsAgenticTask }> {
    return this.config.apiClient.fetch<{ task: StubsAgenticTask }>(
      "/api/stubs/tasks/update",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      },
      "Failed to update durable agentic task"
    );
  }

  public async verifyTask(taskId?: string): Promise<StubsTaskVerifyResponse> {
    return this.config.apiClient.fetch<StubsTaskVerifyResponse>(
      "/api/stubs/tasks/verify",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taskId ? { taskId } : {}),
      },
      "Failed to verify durable agentic task gates"
    );
  }

  public async fetchSessionHandoff(taskId?: string): Promise<StubsSessionHandoff> {
    const url = taskId ? `/api/stubs/handoff?taskId=${encodeURIComponent(taskId)}` : "/api/stubs/handoff";
    return this.config.apiClient.fetch<StubsSessionHandoff>(
      url,
      undefined,
      "Failed to generate session handoff packet"
    );
  }

  public async fetchSidecarSpecs(): Promise<StubsSpecsResponse> {
    return this.config.apiClient.fetch<StubsSpecsResponse>("/api/stubs/specs", undefined, "Failed to list sidecar specs");
  }

  public async fetchSpecDetail(path: string): Promise<{ content: string; path: string }> {
    return this.config.apiClient.fetch<{ content: string; path: string }>(
      `/api/stubs/spec-detail?path=${encodeURIComponent(path)}`,
      undefined,
      "Failed to fetch spec content"
    );
  }

  public async fetchWorkspaceFileTree(): Promise<WorkspaceFileTreeResponse> {
    return this.config.apiClient.fetch<WorkspaceFileTreeResponse>(
      "/api/stubs/tree",
      undefined,
      "Failed to load workspace file tree"
    );
  }

  public async fetchWorkspaceFile(path: string): Promise<StubsWorkspaceFileContent> {
    return this.config.apiClient.fetch<StubsWorkspaceFileContent>(
      `/api/stubs/file?path=${encodeURIComponent(path)}`,
      undefined,
      "Failed to open workspace file"
    );
  }

  public async saveSpecContent(path: string, content: string): Promise<{ success: boolean; message: string }> {
    return this.config.apiClient.fetch<{ success: boolean; message: string }>("/api/stubs/spec-save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path, content }),
    }, "Failed to save spec");
  }

  public async materializeSpec(path: string): Promise<{ success: boolean; message: string; result: { targetFile: string; bytesWritten: number } }> {
    return this.config.apiClient.fetch<{ success: boolean; message: string; result: { targetFile: string; bytesWritten: number } }>("/api/stubs/spec-materialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }, "Failed to materialize spec");
  }

  public async sandSpec(path: string): Promise<{ success: boolean; message: string; result: { path: string; targetFile: string; astHash: string } }> {
    return this.config.apiClient.fetch<{ success: boolean; message: string; result: { path: string; targetFile: string; astHash: string } }>("/api/stubs/spec-sand", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    }, "Failed to sand spec");
  }

  public async executeStubsCommand(
    command: StubsCommandName,
    args: string[] = []
  ): Promise<StubsExecuteResponse> {
    return this.config.apiClient.fetch<StubsExecuteResponse>("/api/stubs/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command, args }),
    }, `Failed to execute stubs ${command}`);
  }

  public connectStubsStream(
    onLog: (data: { type: string; text: string; timestamp: number; code?: number }) => void,
    endpoint: string = "/api/stubs/stream"
  ): () => void {
    try {
      const eventSource = this.config.createEventSource(endpoint);

      if (!eventSource) {
        this.config.logger.warn("[stubs stream] EventSource is not supported in this environment");
        return () => {};
      }

      eventSource.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          onLog(payload);
        } catch (err: unknown) {
          this.config.logger.warn("[stubs stream] Failed to parse SSE event:", err);
        }
      };

      eventSource.onerror = (err) => {
        this.config.logger.warn("[stubs stream] SSE connection state:", eventSource.readyState, err);
      };

      return () => {
        eventSource.close();
      };
    } catch (err: unknown) {
      this.config.logger.error("[stubs stream] Unable to create EventSource:", err);
      return () => {};
    }
  }
}
