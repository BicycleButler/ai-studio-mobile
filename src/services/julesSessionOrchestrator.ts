import { JulesSession, ChatMessage, MessageAttachment } from "../types";
import { IJulesClient, JulesTaskPayload } from "./julesService";
import { IJulesStorageService } from "../utils/storage/jules";
import { ITimeProvider } from "../utils/timeProvider";
import { IIdGenerator } from "../utils/idGenerator";
import { ILogger } from "../utils/logger";
import { getErrorMessage } from "../utils/errorHandling";
import { Observable, IObservable, IReadableStore } from "../utils/observable";

export interface OrchestratorState {
  isExecuting: boolean;
  isApprovingPlan: boolean;
}

export interface IJulesSessionOrchestrator {
  getStateStore(): IReadableStore<OrchestratorState>;
  dispatchTask(
    text: string,
    attachments?: MessageAttachment[],
    templateIds?: string[],
    rawUserText?: string
  ): Promise<boolean>;
  approvePlan(taskId: string): Promise<void>;
  rejectPlan(taskId: string): Promise<void>;
  stopPolling(): void;
  clearMessages(): void;
}

export interface JulesSessionOrchestratorConfig {
  julesClient: IJulesClient;
  julesStorageService: IJulesStorageService;
  timeProvider: ITimeProvider;
  idGenerator: IIdGenerator;
  logger: ILogger;
}

export class JulesSessionOrchestrator implements IJulesSessionOrchestrator {
  private julesClient: IJulesClient;
  private julesStorageService: IJulesStorageService;
  private timeProvider: ITimeProvider;
  private idGenerator: IIdGenerator;
  private logger: ILogger;

  private pollingRef: { stop: () => void } | null = null;
  private stateObservable: IObservable<OrchestratorState>;

  constructor(config: JulesSessionOrchestratorConfig) {
    this.julesClient = config.julesClient;
    this.julesStorageService = config.julesStorageService;
    this.timeProvider = config.timeProvider;
    this.idGenerator = config.idGenerator;
    this.logger = config.logger;
    this.stateObservable = new Observable<OrchestratorState>({
      isExecuting: false,
      isApprovingPlan: false,
    });
  }

  public getStateStore(): IReadableStore<OrchestratorState> {
    return this.stateObservable;
  }

  private setState(partial: Partial<OrchestratorState>) {
    const current = this.stateObservable.getSnapshot();
    this.stateObservable.notify({ ...current, ...partial });
  }

  public stopPolling(): void {
    if (this.pollingRef) {
      this.pollingRef.stop();
      this.pollingRef = null;
    }
    this.setState({ isExecuting: false });
  }

  public clearMessages(): void {
    this.stopPolling();
    const activeSession = this.julesStorageService.julesSessionsManager.getActiveItem();
    if (activeSession) {
      const updated = { ...activeSession, messages: [], updatedAt: this.timeProvider.now() };
      this.julesStorageService.julesSessionsManager.collection.upsert(updated);
    }
  }

  public async dispatchTask(
    text: string,
    _attachments: MessageAttachment[] = [],
    templateIds: string[] = [],
    rawUserText?: string
  ): Promise<boolean> {
    let currentSession = this.julesStorageService.julesSessionsManager.getActiveItem();
    if (!currentSession) return false;

    const julesApiKey = this.julesStorageService.loadStoredJulesApiKey();

    if (!julesApiKey.trim()) {
      const errorMsg: ChatMessage = {
        id: this.idGenerator.generate("msg", "err"),
        role: "model",
        text: "Jules API Key is required to authorize autonomous workspace access. Please configure it in settings.",
        timestamp: this.timeProvider.now(),
        error: "Missing API Key",
      };
      const sessionWithMessages: JulesSession = {
        ...currentSession,
        messages: [...(currentSession.messages || []), errorMsg],
        updatedAt: this.timeProvider.now(),
      };
      this.julesStorageService.julesSessionsManager.collection.upsert(sessionWithMessages);
      return true;
    }

    const userMsg: ChatMessage = {
      id: this.idGenerator.generate("msg"),
      role: "user",
      text,
      rawUserText,
      templateIds,
      timestamp: this.timeProvider.now(),
      julesActivity: {
        type: "plan",
        status: "queued",
        title: `Dispatching task to Jules for ${currentSession.repository}...`,
      },
    };

    const aiMsg: ChatMessage = {
      id: this.idGenerator.generate("msg"),
      role: "model",
      text: "",
      timestamp: this.timeProvider.now() + 1,
      isStreaming: true,
      julesActivity: {
        type: "plan",
        status: "analyzing",
        planDescription: `Jules is inspecting ${currentSession.repository} (branch: ${currentSession.branch}) and planning autonomous changes.`,
      },
    };

    const updatedMessages = [...(currentSession.messages || []), userMsg, aiMsg];

    const sessionWithMessages: JulesSession = {
      ...currentSession,
      status: "analyzing",
      messages: updatedMessages,
      updatedAt: this.timeProvider.now(),
    };

    this.julesStorageService.julesSessionsManager.collection.upsert(sessionWithMessages);

    this.setState({ isExecuting: true });

    try {
      const dispatchedTask = await this.julesClient.dispatchTask({
        repository: currentSession.repository,
        branch: currentSession.branch,
        prompt: text,
        autoApprove: currentSession.autoApprovePlan,
      });

      const activeAiMsgId = aiMsg.id;

      // Re-fetch current session to avoid stale closure
      currentSession = this.julesStorageService.julesSessionsManager.getActiveItem()!;
      if (currentSession) {
        const planningMessages = (currentSession.messages || []).map(m =>
          m.id === activeAiMsgId
            ? {
                ...m,
                julesActivity: {
                  ...m.julesActivity!,
                  taskId: dispatchedTask.id,
                  status: "planning" as const,
                  title: `Jules task created: #${dispatchedTask.id.slice(0, 8)}`,
                },
              }
            : m
        );

        this.julesStorageService.julesSessionsManager.collection.upsert({
          ...currentSession,
          messages: planningMessages,
          updatedAt: this.timeProvider.now()
        });
      }

      this.pollingRef = this.julesClient.subscribeToTask(
        dispatchedTask.id,
        (taskUpdate: JulesTaskPayload) => {
          const latestSession = this.julesStorageService.julesSessionsManager.getActiveItem();
          if (latestSession && latestSession.id === currentSession?.id) {
             const polledMessages = (latestSession.messages || []).map(m => {
                if (m.id === activeAiMsgId && m.julesActivity) {
                  const isCompleted =
                    taskUpdate.status === "completed" || taskUpdate.status === "failed";
                  return {
                    ...m,
                    isStreaming: !isCompleted,
                    text:
                      taskUpdate.status === "failed"
                        ? `Jules encountered an error while executing task.`
                        : m.text,
                    error: taskUpdate.error || taskUpdate.errorMessage,
                    julesActivity: {
                      ...m.julesActivity,
                      status: taskUpdate.status,
                      planDescription: taskUpdate.planDescription || m.julesActivity.planDescription,
                      steps: taskUpdate.steps || m.julesActivity.steps,
                      pullRequestUrl: taskUpdate.pullRequestUrl,
                      pullRequestNumber: taskUpdate.pullRequestNumber,
                      requiresApproval: taskUpdate.requiresApproval ?? (taskUpdate.status === "awaiting_approval"),
                      diffStats: taskUpdate.diffStats || m.julesActivity.diffStats,
                    },
                  };
                }
                return m;
             });

             this.julesStorageService.julesSessionsManager.collection.upsert({
               ...latestSession,
               status: taskUpdate.status,
               messages: polledMessages,
               updatedAt: this.timeProvider.now(),
             });
          }

          if (taskUpdate.status === "completed" || taskUpdate.status === "failed") {
            this.setState({ isExecuting: false });
          }
        },
        (error) => {
          this.logger.error("Jules polling error:", error);
          this.setState({ isExecuting: false });
        }
      );
    } catch (err: unknown) {
      this.setState({ isExecuting: false });
      const errMsg = getErrorMessage(err) || "Failed to dispatch Jules task";
      const errorSession = this.julesStorageService.julesSessionsManager.getActiveItem();
      if (errorSession) {
        const errorMessages = (errorSession.messages || []).map(m =>
           m.id === aiMsg.id
            ? {
                ...m,
                isStreaming: false,
                error: errMsg,
                julesActivity: { ...m.julesActivity!, status: "failed" as const },
              }
            : m
        );
        this.julesStorageService.julesSessionsManager.collection.upsert({
           ...errorSession,
           messages: errorMessages,
           updatedAt: this.timeProvider.now()
        });
      }
    }
    return true;
  }

  public async approvePlan(taskId: string): Promise<void> {
    this.setState({ isApprovingPlan: true });
    try {
      await this.julesClient.approvePlan(taskId, true);
      const latestSession = this.julesStorageService.julesSessionsManager.getActiveItem();
      if (latestSession) {
         const approvedMessages = (latestSession.messages || []).map(m =>
           m.julesActivity?.taskId === taskId
              ? {
                  ...m,
                  julesActivity: {
                    ...m.julesActivity,
                    status: "executing" as const,
                    title: "Plan approved. Jules is executing changes and committing...",
                    requiresApproval: false,
                  },
                }
              : m
         );
         this.julesStorageService.julesSessionsManager.collection.upsert({
           ...latestSession,
           messages: approvedMessages,
           updatedAt: this.timeProvider.now()
         });
      }
    } catch (err: unknown) {
      const errMsg = getErrorMessage(err) || "Failed to approve plan";
      const latestSession = this.julesStorageService.julesSessionsManager.getActiveItem();
      if (latestSession) {
         const errorMessages = (latestSession.messages || []).map(m =>
           m.julesActivity?.taskId === taskId
              ? { ...m, error: errMsg }
              : m
         );
         this.julesStorageService.julesSessionsManager.collection.upsert({
           ...latestSession,
           messages: errorMessages,
           updatedAt: this.timeProvider.now()
         });
      }
    } finally {
      this.setState({ isApprovingPlan: false });
    }
  }

  public async rejectPlan(taskId: string): Promise<void> {
    try {
      await this.julesClient.approvePlan(taskId, false);
      const latestSession = this.julesStorageService.julesSessionsManager.getActiveItem();
      if (latestSession) {
         const rejectedMessages = (latestSession.messages || []).map(m =>
           m.julesActivity?.taskId === taskId
              ? {
                  ...m,
                  isStreaming: false,
                  julesActivity: {
                    ...m.julesActivity,
                    status: "failed" as const,
                    title: "Plan rejected. Task aborted.",
                    requiresApproval: false,
                  },
                }
              : m
         );
         this.julesStorageService.julesSessionsManager.collection.upsert({
           ...latestSession,
           messages: rejectedMessages,
           updatedAt: this.timeProvider.now()
         });
      }
    } catch (err: unknown) {
      this.logger.error("Failed to reject plan:", err);
    }
  }
}
