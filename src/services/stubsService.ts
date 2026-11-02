import { IApiClient } from "../utils/apiClient";
import {
  StubsGraphData,
  StubsImpactResult,
  StubsLintViolation,
  StubsSidecarSpec,
} from "../types";
import { ILogger, defaultLogger } from "../utils/logger";
import { defaultPlatformService, IPlatformService } from "./platformService";

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

export interface IStubsClient {
  fetchGraphData(): Promise<StubsGraphData>;
  fetchDiagram(groupBy?: "domain" | "layer"): Promise<StubsDiagramResponse>;
  fetchImpact(target: string): Promise<StubsImpactResult>;
  fetchLintResults(): Promise<StubsLintResponse>;
  fetchSidecarSpecs(): Promise<StubsSpecsResponse>;
  fetchSpecDetail(path: string): Promise<{ content: string; path: string }>;
  saveSpecContent(path: string, content: string): Promise<{ success: boolean; message: string }>;
  materializeSpec(path: string): Promise<{ success: boolean; message: string; result: { targetFile: string; bytesWritten: number } }>;
  executeStubsCommand(command: "scan" | "lint-arch" | "diagram" | "impact" | "sand", args?: string[]): Promise<StubsExecuteResponse>;
  connectStubsStream(onLog: (data: { type: string; text: string; timestamp: number; code?: number }) => void, endpoint?: string): () => void;
}

export interface StubsClientConfig {
  apiClient: IApiClient;
  logger?: ILogger;
  createEventSource?: (endpoint: string) => EventSource | undefined;
  platformService?: IPlatformService;
}

export class StubsClient implements IStubsClient {
  private config: Required<Omit<StubsClientConfig, 'platformService'>> & { platformService: IPlatformService };
  constructor(config: StubsClientConfig) {
    const platformService = config.platformService || defaultPlatformService;
    this.config = {
      apiClient: config.apiClient,
      logger: config.logger || defaultLogger,
      platformService,
      createEventSource: config.createEventSource || ((endpoint: string) => platformService.createEventSource(endpoint) || undefined)
    };
  }

  public async fetchGraphData(): Promise<StubsGraphData> {
    return this.config.apiClient.fetch<StubsGraphData>("/api/stubs/graph", undefined, "Failed to fetch Stubs graph data");
  }

  public async fetchDiagram(groupBy: "domain" | "layer" = "domain"): Promise<StubsDiagramResponse> {
    return this.config.apiClient.fetch<StubsDiagramResponse>(
      `/api/stubs/diagram?groupBy=${encodeURIComponent(groupBy)}`,
      undefined,
      "Failed to fetch Stubs diagram"
    );
  }

  public async fetchImpact(target: string): Promise<StubsImpactResult> {
    return this.config.apiClient.fetch<StubsImpactResult>(
      `/api/stubs/impact?target=${encodeURIComponent(target)}`,
      undefined,
      "Failed to fetch impact analysis"
    );
  }

  public async fetchLintResults(): Promise<StubsLintResponse> {
    return this.config.apiClient.fetch<StubsLintResponse>("/api/stubs/lint", undefined, "Failed to fetch architecture lint results");
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

  public async executeStubsCommand(
    command: "scan" | "lint-arch" | "diagram" | "impact" | "sand",
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

