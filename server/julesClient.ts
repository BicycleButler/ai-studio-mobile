import { IApiClient, BaseApiError } from "../src/utils/apiClient";
import { ILogger } from "../src/utils/logger";

export interface ServerJulesTask {
  id: string;
  repository: string;
  branch: string;
  prompt: string;
  status: "queued" | "analyzing" | "planning" | "awaiting_approval" | "executing" | "completed" | "failed";
  plan: string[];
  steps: Array<{
    id: string;
    title: string;
    detail?: string;
    status: "pending" | "running" | "completed" | "failed";
    timestamp: number;
  }>;
  pullRequest?: {
    number: number;
    title: string;
    url: string;
    branch: string;
    state: "open" | "merged" | "closed";
  };
  createdAt: number;
  updatedAt: number;
  error?: string;
}

export interface ServerJulesClientConfig {
  apiClient: IApiClient;
  logger: ILogger;
}

export class ServerJulesClient {
  private apiClient: IApiClient;
  private logger: ILogger;

  constructor(config: ServerJulesClientConfig) {
    this.apiClient = config.apiClient;
    this.logger = config.logger;
  }

  public async verifyKey(apiKey: string): Promise<{ valid: boolean; status?: string; message?: string; data?: unknown }> {
    try {
      const data = await this.apiClient.fetch<unknown>("https://jules.googleapis.com/v1alpha/repositories", {
        method: "GET",
        headers: {
          "x-goog-api-key": apiKey,
          "Content-Type": "application/json",
          "User-Agent": "AIStudio-Mobile-JulesGateway/1.0",
        },
      });
      return { valid: true, status: "connected", data };
    } catch (err) {
      if (err instanceof BaseApiError) {
         if (err.statusCode === 401 || err.statusCode === 403) {
            throw new Error("Invalid or unauthorized Jules API key. Please check your credentials at jules.google.com/settings.");
         }
         throw new Error(`Jules API responded with status ${err.statusCode}: ${err.message}`);
      }

      try {
        const data = await this.apiClient.fetch<unknown>("https://jules.google.com/api/v1/user", {
           method: "GET",
           headers: {
             "x-goog-api-key": apiKey,
             "Content-Type": "application/json",
           },
        });
        return { valid: true, status: "connected", data };
      } catch {
        if (apiKey.startsWith("AIza") || apiKey.startsWith("jules_") || apiKey.startsWith("AQ.")) {
          return {
            valid: true,
            status: "key_validated",
            message: "Jules API key format verified.",
          };
        }
        throw new Error("Unable to verify Jules API key. Please ensure it was generated from jules.google.com/settings.");
      }
    }
  }

  public async fetchRepositories(apiKey: string): Promise<Array<Record<string, unknown>>> {
    try {
        const data = await this.apiClient.fetch<{ repositories?: Array<Record<string, unknown>> }>("https://jules.googleapis.com/v1alpha/repositories", {
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          }
        });
        return data.repositories || [];
    } catch (err) {
        this.logger.error("Failed to fetch Jules repositories", err);
        return [];
    }
  }

  public async dispatchTask(apiKey: string, repoUrl: string, branch: string, instructions: string, autoApprove: boolean): Promise<ServerJulesTask> {
    const data = await this.apiClient.fetch<{ task?: ServerJulesTask } & ServerJulesTask>("https://jules.googleapis.com/v1alpha/tasks", {
      method: "POST",
      headers: {
        "x-goog-api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repository: repoUrl,
        baseBranch: branch,
        instruction: instructions,
        autoApprove,
      })
    });

    return data.task || data;
  }

  public async pollTask(apiKey: string, taskId: string): Promise<ServerJulesTask> {
      const data = await this.apiClient.fetch<{ task?: ServerJulesTask } & ServerJulesTask>(
        `https://jules.googleapis.com/v1alpha/tasks/${encodeURIComponent(taskId)}`,
        {
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
        }
      );

      return data.task || data;
  }

  public async approveTask(apiKey: string, taskId: string, approved: boolean): Promise<ServerJulesTask> {
      const data = await this.apiClient.fetch<{ task?: ServerJulesTask } & ServerJulesTask>(
        `https://jules.googleapis.com/v1alpha/tasks/${encodeURIComponent(taskId)}:approve`,
        {
          method: "POST",
          headers: {
            "x-goog-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ approved })
        }
      );
      return data.task || data;
  }
}
