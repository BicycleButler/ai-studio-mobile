import { apiFetch, isAbortError } from "../utils/apiClient";
import {
  JulesSession,
  JulesRepository,
  JulesTaskStatus,
  JulesExecutionStep,
  JulesPullRequest,
} from "../types";
import {
  loadStoredJulesApiKey,
  loadStoredJulesSessions,
  saveStoredJulesSessions,
  loadStoredJulesSettings,
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

/**
 * Validates a Jules API key through the backend gateway
 */
export async function verifyJulesApiKey(apiKey: string): Promise<JulesVerificationResult> {
  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    return { valid: false, error: "Jules API key cannot be blank." };
  }

  try {
    const data = await apiFetch<{ valid?: boolean; error?: string; status?: string }>("/api/jules/auth/verify", {
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

/**
 * Discovers authorized repositories for the configured Jules API key
 */
export async function fetchJulesRepositories(apiKeyOverride?: string): Promise<JulesRepository[]> {
  const key = apiKeyOverride || loadStoredJulesApiKey();
  if (!key) return [];

  try {
    const data = await apiFetch<{ repositories?: JulesRepositoryItem[] }>("/api/jules/repos", {
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

/**
 * Dispatches a new task to Jules
 */
export async function createJulesTask(
  params: CreateJulesTaskParams
): Promise<{ task: JulesTaskPayload | null; error?: string }> {
  const key = params.apiKey || loadStoredJulesApiKey();
  if (!key) {
    return { task: null, error: "Jules API key is required. Please set it in Settings." };
  }

  try {
    const settings = loadStoredJulesSettings();
    const autoApprove = params.autoApprove ?? settings.autoApprovePlans;

    const data = await apiFetch<{ task: JulesTaskPayload }>("/api/jules/tasks", {
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

/**
 * Convenience helper to dispatch a task and unwrap the result or throw
 */
export async function dispatchJulesTask(
  apiKey: string,
  params: {
    repository: string;
    prompt: string;
    branch?: string;
    autoApprove?: boolean;
  }
): Promise<JulesTaskPayload> {
  const result = await createJulesTask({
    repository: params.repository,
    prompt: params.prompt,
    branch: params.branch || "main",
    autoApprove: params.autoApprove,
    apiKey,
  });
  if (result.error || !result.task) {
    throw new Error(result.error || "Failed to create Jules task");
  }
  return result.task;
}

/**
 * Polls the real-time execution progress of a Jules task.
 * Supports both polling subscription with interval or single-shot promise.
 */
export function pollJulesTask(
  apiKey: string,
  taskId: string,
  onUpdate: (task: JulesTaskPayload) => void,
  onError?: (error: unknown) => void,
  intervalMs?: number
): { stop: () => void };
export function pollJulesTask(
  taskId: string,
  apiKeyOverride?: string
): Promise<{ task: JulesTaskPayload | null; error?: string }>;
export function pollJulesTask(
  arg1: string,
  arg2?: string | ((task: JulesTaskPayload) => void),
  arg3?: (task: JulesTaskPayload) => void,
  arg4?: (error: unknown) => void,
  intervalMs = 2500
): { stop: () => void } | Promise<{ task: JulesTaskPayload | null; error?: string }> {
  // If called with (apiKey, taskId, onUpdate, onError, intervalMs)
  if (typeof arg2 === "string" && typeof arg3 === "function") {
    const apiKey = arg1;
    const taskId = arg2;
    const onUpdate = arg3;
    const onError = arg4;
    let stopped = false;
    let abortController = new AbortController();

    const runPoll = async () => {
      try {
        let data;
        try {
          data = await apiFetch<{ task: JulesTaskPayload }>(`/api/jules/tasks/${encodeURIComponent(taskId)}`, {
            headers: { "x-jules-api-key": apiKey || "" },
            signal: abortController.signal,
          }, "Failed to poll task");
        } catch (err: unknown) {
          if (isAbortError(err)) {
            return;
          }
          if (onError) onError(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        if (!stopped && data.task) {
          onUpdate(data.task);
          if (data.task.status === "completed" || data.task.status === "failed") {
            stopped = true;
            clearInterval(timer);
          }
        }
      } catch (err: unknown) {
        if (onError) onError(err);
      }
    };

    void runPoll();
    const timer = setInterval(() => {
      if (!stopped) {
        void runPoll();
      }
    }, intervalMs);

    return {
      stop: () => {
        stopped = true;
        clearInterval(timer);
        abortController.abort();
      },
    };
  }

  // Single-shot signature: pollJulesTask(taskId, apiKeyOverride)
  const taskId = arg1;
  const apiKey = typeof arg2 === "string" ? arg2 : loadStoredJulesApiKey();

  return (async () => {
    try {
      const data = await apiFetch<{ task: JulesTaskPayload }>(`/api/jules/tasks/${encodeURIComponent(taskId)}`, {
        headers: { "x-jules-api-key": apiKey || "" },
      }, "Failed to poll Jules task.");

      return { task: data.task };
    } catch (err: unknown) {
      return {
        task: null,
        error: err instanceof Error ? err.message : "Polling failed.",
      };
    }
  })();
}

/**
 * Approves or rejects an implementation plan generated by Jules
 */
export async function approveJulesPlan(
  apiKeyOrTaskId: string,
  taskIdOrApiKey?: string,
  approvedOrFlag: boolean = true
): Promise<{ task: JulesTaskPayload | null; error?: string }> {
  let key: string;
  let tId: string;
  let approved = true;

  if (
    typeof taskIdOrApiKey === "string" &&
    (taskIdOrApiKey.startsWith("jules_") ||
      taskIdOrApiKey.startsWith("task_") ||
      taskIdOrApiKey.includes("-") ||
      taskIdOrApiKey.length < 30)
  ) {
    // approveJulesPlan(apiKey, taskId, approved)
    key = apiKeyOrTaskId;
    tId = taskIdOrApiKey;
    approved = approvedOrFlag;
  } else if (typeof taskIdOrApiKey === "string") {
    // approveJulesPlan(taskId, apiKeyOverride)
    tId = apiKeyOrTaskId;
    key = taskIdOrApiKey;
    approved = true;
  } else {
    // approveJulesPlan(taskId)
    tId = apiKeyOrTaskId;
    key = loadStoredJulesApiKey();
    approved = true;
  }

  try {
    const data = await apiFetch<{ task: JulesTaskPayload }>(`/api/jules/tasks/${encodeURIComponent(tId)}/approve`, {
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

/**
 * Session storage management for Jules sessions
 */
export function getStoredJulesSessions(): JulesSession[] {
  return loadStoredJulesSessions();
}

export function saveJulesSession(session: JulesSession): void {
  const sessions = loadStoredJulesSessions();
  const existingIdx = sessions.findIndex((s) => s.id === session.id);
  let updated: JulesSession[];
  if (existingIdx >= 0) {
    updated = [...sessions];
    updated[existingIdx] = { ...session, updatedAt: Date.now() };
  } else {
    updated = [session, ...sessions];
  }
  saveStoredJulesSessions(updated);
}

export function deleteJulesSession(sessionId: string): void {
  const sessions = loadStoredJulesSessions();
  const updated = sessions.filter((s) => s.id !== sessionId);
  saveStoredJulesSessions(updated);
}

export function createNewJulesSession(
  repository: string,
  branch: string = "main",
  initialTitle?: string
): JulesSession {
  const id = `jules_sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const newSession: JulesSession = {
    id,
    title: initialTitle || `Task on ${repository}`,
    repository,
    branch,
    status: "idle",
    steps: [],
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  saveJulesSession(newSession);
  return newSession;
}
