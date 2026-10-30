import { IApiClient } from "../utils/apiClient";
import { startPolling, ExponentialBackoffPollingStrategy, PollingOptions } from "../utils/polling";
import {
  JulesRepository,
  JulesTaskStatus,
  JulesExecutionStep,
  JulesPullRequest,
} from "../types";
import {




} from "../utils/storage";

export interface JulesTaskPayload {
  id: string;
  status: JulesTaskStatus;
  repository?: string;
  branch?: string;
  title?: string;
  planDescription?: string;
  plan?: string[];
  steps?: JulesExecutionStep[];
  currentStep?: JulesExecutionStep;
  diff?: string;
  diffContent?: string;
  diffStats?: {
    filesChanged: number;
    additions: number;
    deletions: number;
  };
  pullRequest?: JulesPullRequest;
  pullRequestUrl?: string;
  pullRequestNumber?: number;
  requiresApproval?: boolean;
  error?: string;
  errorMessage?: string;
  [key: string]: unknown;
}

export interface JulesServiceConfig {
  getApiKey: () => string;
  getSettings: () => { autoApprovePlans: boolean; defaultBranch: string };
  apiClient: IApiClient;
  startPolling?: <T>(fetcher: (signal: AbortSignal) => Promise<T>, options: PollingOptions<T>) => { stop: () => void };
}

export interface IJulesClient {
  setConfig(config: JulesServiceConfig): void;
  resolveApiKey(override?: string): string;
  getSettings(): { autoApprovePlans: boolean; defaultBranch: string };
  verifyApiKey(apiKey: string): Promise<JulesVerificationResult>;
  fetchRepositories(apiKeyOverride?: string): Promise<JulesRepository[]>;
  createTask(params: CreateJulesTaskParams): Promise<{ task: JulesTaskPayload | null; error?: string }>;
  dispatchTask(
    params: {
      repository: string;
      prompt: string;
      branch?: string;
      autoApprove?: boolean;
      apiKey?: string;
    }
  ): Promise<JulesTaskPayload>;
  subscribeToTask(
    taskId: string,
    onUpdate: (task: JulesTaskPayload) => void,
    onError?: (error: unknown) => void,
    intervalMs?: number,
    apiKeyOverride?: string
  ): { stop: () => void };
  fetchTask(taskId: string, apiKeyOverride?: string): Promise<{ task: JulesTaskPayload | null; error?: string }>;
  approvePlan(taskId: string, approved?: boolean, apiKeyOverride?: string): Promise<{ task: JulesTaskPayload | null; error?: string }>;
}

export class JulesClient implements IJulesClient {
  private config: JulesServiceConfig;

  constructor(config: JulesServiceConfig) {
    this.config = config;
  }

  public setConfig(config: JulesServiceConfig) {
    this.config = config;
  }

  public resolveApiKey(override?: string): string {
    return override || this.config.getApiKey();
  }

  public getSettings(): { autoApprovePlans: boolean; defaultBranch: string } {
    return this.config.getSettings();
  }

  public async verifyApiKey(apiKey: string): Promise<JulesVerificationResult> {
    const cleanKey = apiKey.trim();
    if (!cleanKey) {
      return { valid: false, error: "Jules API key cannot be blank." };
    }

    try {
      const fetcher = this.config.apiClient.fetch.bind(this.config.apiClient);
      const data = await fetcher<{ valid?: boolean; error?: string; status?: string }>("/api/jules/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: cleanKey }),
      }, "Failed to verify Jules key");

      return {
        valid: !!data.valid,
        error: data.error,
        status: data.status,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Network error verifying Jules key.";
      return { valid: false, error: msg };
    }
  }

  public async fetchRepositories(apiKeyOverride?: string): Promise<JulesRepository[]> {
    const key = this.resolveApiKey(apiKeyOverride);
    if (!key) return [];

    try {
      const fetcher = this.config.apiClient.fetch.bind(this.config.apiClient);
      const data = await fetcher<{ repositories?: JulesRepositoryItem[] }>("/api/jules/repos", {
        headers: { "x-jules-api-key": key },
      });
      if (Array.isArray(data.repositories)) {
        return data.repositories.map((repo: JulesRepositoryItem, index: number) => ({
          id: repo.id || repo.fullName || `repo-${index}`,
          fullName: repo.fullName || repo.name || "workspace/repo",
          owner: repo.owner || (repo.fullName ? repo.fullName.split("/")[0] : "workspace"),
          name: repo.name || (repo.fullName ? repo.fullName.split("/")[1] : "repo"),
          defaultBranch: repo.defaultBranch || "main",
          isPrivate: !!repo.isPrivate,
          description: repo.description,
        }));
      }
      return [];
    } catch {
      return [];
    }
  }

  public async createTask(
    params: CreateJulesTaskParams
  ): Promise<{ task: JulesTaskPayload | null; error?: string }> {
    const key = this.resolveApiKey(params.apiKey);
    if (!key) {
      return { task: null, error: "Jules API key is required. Please set it in Settings." };
    }

    try {
      const settings = this.getSettings();
      const autoApprove = params.autoApprove ?? settings.autoApprovePlans;

      const fetcher = this.config.apiClient.fetch.bind(this.config.apiClient);
      const data = await fetcher<{ task: JulesTaskPayload }>("/api/jules/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-jules-api-key": key,
        },
        body: JSON.stringify({
          repository: params.repository,
          branch: params.branch || settings.defaultBranch || "main",
          prompt: params.prompt,
          autoApprove,
        }),
      }, "Failed to create Jules task.");

      return { task: data.task };
    } catch (err: unknown) {
      return {
        task: null,
        error: err instanceof Error ? err.message : "Network error creating task.",
      };
    }
  }

  public async dispatchTask(
    params: {
      repository: string;
      prompt: string;
      branch?: string;
      autoApprove?: boolean;
      apiKey?: string;
    }
  ): Promise<JulesTaskPayload> {
    const result = await this.createTask({
      repository: params.repository,
      prompt: params.prompt,
      branch: params.branch || "main",
      autoApprove: params.autoApprove,
      apiKey: params.apiKey,
    });
    if (result.error || !result.task) {
      throw new Error(result.error || "Failed to create Jules task");
    }
    return result.task;
  }

  public subscribeToTask(
    taskId: string,
    onUpdate: (task: JulesTaskPayload) => void,
    onError?: (error: unknown) => void,
    intervalMs: number = 2500,
    apiKeyOverride?: string
  ): { stop: () => void } {
    const key = this.resolveApiKey(apiKeyOverride);
    const fetcherFn = this.config.apiClient.fetch.bind(this.config.apiClient);
    const pollingFn = this.config.startPolling || startPolling;

    const poller = pollingFn<{ task: JulesTaskPayload }>(
      (signal) =>
        fetcherFn<{ task: JulesTaskPayload }>(
          `/api/jules/tasks/${encodeURIComponent(taskId)}`,
          {
            headers: { "x-jules-api-key": key || "" },
            signal,
          },
          "Failed to poll task"
        ),
      {
        strategy: new ExponentialBackoffPollingStrategy(intervalMs, 30000, 1.5),
        onUpdate: (data) => {
          if (data.task) onUpdate(data.task);
        },
        onError: (err) => {
          if (onError) onError(err instanceof Error ? err : new Error(String(err)));
        },
        isComplete: (data) =>
          !!data.task && (data.task.status === "completed" || data.task.status === "failed"),
      }
    );

    return { stop: poller.stop };
  }

  public async fetchTask(
    taskId: string,
    apiKeyOverride?: string
  ): Promise<{ task: JulesTaskPayload | null; error?: string }> {
    const apiKey = this.resolveApiKey(apiKeyOverride);

    try {
      const fetcher = this.config.apiClient.fetch.bind(this.config.apiClient);
      const data = await fetcher<{ task: JulesTaskPayload }>(`/api/jules/tasks/${encodeURIComponent(taskId)}`, {
        headers: { "x-jules-api-key": apiKey || "" },
      }, "Failed to fetch Jules task.");

      return { task: data.task };
    } catch (err: unknown) {
      return {
        task: null,
        error: err instanceof Error ? err.message : "Fetching task failed.",
      };
    }
  }

  public async approvePlan(
    taskId: string,
    approved: boolean = true,
    apiKeyOverride?: string
  ): Promise<{ task: JulesTaskPayload | null; error?: string }> {
    const key = this.resolveApiKey(apiKeyOverride);

    try {
      const fetcher = this.config.apiClient.fetch.bind(this.config.apiClient);
      const data = await fetcher<{ task: JulesTaskPayload }>(`/api/jules/tasks/${encodeURIComponent(taskId)}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-jules-api-key": key || "",
        },
        body: JSON.stringify({ approved }),
      }, "Failed to approve Jules plan.");

      return { task: data.task };
    } catch (err: unknown) {
      return {
        task: null,
        error: err instanceof Error ? err.message : "Approval request failed.",
      };
    }
  }
}

// Default singleton instance for backward compatibility

export interface JulesRepositoryItem {
  id?: string;
  fullName?: string;
  name?: string;
  owner?: string;
  defaultBranch?: string;
  isPrivate?: boolean;
  description?: string;
}

export interface JulesVerificationResult {
  valid: boolean;
  error?: string;
  status?: string;
}

export interface CreateJulesTaskParams {
  repository: string;
  branch: string;
  prompt: string;
  autoApprove?: boolean;
  apiKey?: string;
}
