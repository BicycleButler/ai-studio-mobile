import { PromptConfig, PromptType, StructuredExample, ChatMessage } from "../../types";
import { DEFAULT_CONFIG } from "../../data/templates";
import { DefaultStorageFactory, IStorageFactory } from "./StorageFactory";
import { IStorageRegistry } from "./StorageRegistry";
import { IMutableSingleton } from "./types";
import { STORAGE_KEYS } from "./constants";
import { cleanMockData, getNestedValue } from "./helpers";
import { ILogger, DefaultLoggerFactory } from "../logger";
import { ITimeProvider, DefaultTimeProvider } from "../timeProvider";

export interface DraftState {
  promptType: PromptType;
  config: PromptConfig;
  chatInputText: string;
  freeformText: string;
  structuredExamples: StructuredExample[];
  messages?: ChatMessage[];
  selectedTemplateIds?: string[];
  updatedAt: number;
}

export interface IDraftStateService {
  getProjectDraftKey(projectId?: string | null): string;
  loadDraftState(projectId?: string | null): DraftState;
  saveDraftState(draft: Partial<DraftState>, projectId?: string | null): void;
}

export interface DraftStateServiceConfig {
  timeProvider?: ITimeProvider;
  logger: ILogger;
  draftRegistry?: IStorageRegistry<IMutableSingleton<DraftState | null>>;
  storageFactory?: IStorageFactory;
}

export class DraftStateService implements IDraftStateService {
  private draftRegistry: IStorageRegistry<IMutableSingleton<DraftState | null>>;
  private logger: ILogger;
  private timeProvider: ITimeProvider;

  constructor(config: DraftStateServiceConfig) {
    this.logger = config?.logger || new DefaultLoggerFactory().createLogger();
    this.timeProvider = config?.timeProvider || new DefaultTimeProvider();

    if (config?.draftRegistry) {
        this.draftRegistry = config.draftRegistry;
    } else {
        const factory = config?.storageFactory || new DefaultStorageFactory();
        this.draftRegistry = factory.createRegistry<IMutableSingleton<DraftState | null>>((key) => {
          return factory.createSingleton<DraftState | null>(key, null);
        });
    }
  }

  public getProjectDraftKey(projectId?: string | null): string {
    if (projectId && projectId.trim()) {
      return `${STORAGE_KEYS.DRAFT_STATE}_${projectId.trim()}`;
    }
    return STORAGE_KEYS.DRAFT_STATE;
  }

  private getDraftSingleton(key: string): IMutableSingleton<DraftState | null> {
    return this.draftRegistry.get(key);
  }

  public loadDraftState(projectId?: string | null): DraftState {
    const fallback: DraftState = {
      promptType: "chat",
      config: DEFAULT_CONFIG,
      chatInputText: "",
      freeformText: "",
      structuredExamples: [],
      messages: undefined,
      selectedTemplateIds: [],
      updatedAt: this.timeProvider.now(),
    };

    const validPromptTypes: PromptType[] = ["chat", "code", "stubs"];

    const sanitizeType = (typeVal: unknown): PromptType => {
      if (typeof typeVal === "string" && validPromptTypes.includes(typeVal as PromptType)) {
        return typeVal as PromptType;
      }
      return "chat";
    };

    const key = this.getProjectDraftKey(projectId);
    const draftSingleton = this.getDraftSingleton(key);
    const stored = draftSingleton.load();

    if (!stored) {
      // If project-specific key not yet initialized, fallback to default or global draft
      if (projectId) {
        const globalDraftSingleton = this.getDraftSingleton(STORAGE_KEYS.DRAFT_STATE);
        const globalStored = globalDraftSingleton.load();
        if (globalStored) {
          return {
            ...fallback,
            ...globalStored,
            promptType: sanitizeType(globalStored.promptType),
            config: {
              ...DEFAULT_CONFIG,
              ...(globalStored.config || {}),
            },
          };
        }
      }
      return fallback;
    }

    const sanitizeMessages = (msgs: unknown): ChatMessage[] | undefined => {
      if (!Array.isArray(msgs)) return undefined;
      const clean = cleanMockData(msgs as ChatMessage[], "chat");
      if (clean.length === 0) return undefined;
      return clean.map((m) => ({
        ...m,
        isStreaming: false,
        images: m.images?.map((img) => ({
          ...img,
          data: "",
          previewUrl:
            img.previewUrl && img.previewUrl.startsWith("data:")
              ? ""
              : img.previewUrl,
        })),
      }));
    };

    return {
      ...fallback,
      ...stored,
      messages: sanitizeMessages(getNestedValue(stored, ['messages'], undefined)),
      promptType: sanitizeType(getNestedValue(stored, ['promptType'], 'chat')),
      config: {
        ...DEFAULT_CONFIG,
        ...(getNestedValue(stored, ['config'], {})),
      },
      chatInputText: getNestedValue(stored, ['chatInputText'], ''),
      freeformText: getNestedValue(stored, ['freeformText'], ''),
      structuredExamples: getNestedValue(stored, ['structuredExamples'], []),
      selectedTemplateIds: getNestedValue(stored, ['selectedTemplateIds'], []),
      updatedAt: getNestedValue(stored, ['updatedAt'], fallback.updatedAt),
    };
  }

  private sanitizeDraftForStorage(draft: DraftState): DraftState {
    if (!Array.isArray(draft.messages)) {
      return draft;
    }
    return {
      ...draft,
      messages: draft.messages.map((m) => ({
        ...m,
        isStreaming: false,
        images: m.images?.map((img) => ({
          ...img,
          data: "", // Strip heavy base64 image payloads to protect localStorage quota
          previewUrl:
            img.previewUrl && img.previewUrl.startsWith("data:")
              ? ""
              : img.previewUrl,
        })),
      })),
    };
  }

  public saveDraftState(draft: Partial<DraftState>, projectId?: string | null): void {
    try {
      const current = this.loadDraftState(projectId);
      const updated: DraftState = this.sanitizeDraftForStorage({
        ...current,
        ...draft,
        updatedAt: this.timeProvider.now(),
      });
      const key = this.getProjectDraftKey(projectId);
      const draftSingleton = this.getDraftSingleton(key);
      draftSingleton.save(updated);
    } catch (err: unknown) {
      this.logger.warn("Failed to auto-save draft:", err);
    }
  }
}


