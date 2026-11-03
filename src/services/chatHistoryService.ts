import { createDefaultStorageInstance } from "../utils/storage/core";
import { safeGetStorageKeys, STORAGE_KEYS, IStorageRegistry, defaultStorageFactory, IStorageFactory } from "../utils/storage";
import { ChatMessage, ChatSession } from "../types";
import { IMutableCollection } from "../utils/storage/types";
import { ILogger, defaultLogger } from "../utils/logger";
import { defaultPlatformService } from "./platformService";
import { isMockSession } from "../utils/mockDefinitions";
import { ITimeProvider, defaultTimeProvider } from "../utils/timeProvider";

export interface IChatHistoryService {
  getChatSessionsStorageKey(projectId?: string): string;
  isMockChatSession(session: Partial<ChatSession>): boolean;
  purgeMockSessionsFromStorage(): void;
  sanitizeMessagesForHistory(messages: ChatMessage[]): ChatMessage[];
  generateSessionTitle(messages: ChatMessage[], maxLength?: number): string;
  getChatCollection(projectId?: string): IMutableCollection<ChatSession>;
  getChatSessions(projectId?: string): ChatSession[];
  saveChatSession(session: ChatSession, projectId?: string): void;
  getChatSessionById(sessionId: string, projectId?: string): ChatSession | null;
  deleteChatSession(sessionId: string, projectId?: string): boolean;
  clearAllChatSessions(projectId?: string): void;
  bulkDeleteChatSessions(sessionIds: string[], projectId?: string): boolean;
}

export interface ChatHistoryServiceConfig {
  timeProvider?: ITimeProvider;
  quotaObservable?: import("../utils/eventEmitter").EventEmitter<void>;
  storageKeys?: typeof STORAGE_KEYS;
  logger: ILogger;
  collectionRegistry?: IStorageRegistry<IMutableCollection<ChatSession>>;
  isBrowserEnv?: () => boolean;
  storageFactory?: IStorageFactory;
}

export class ChatHistoryService implements IChatHistoryService {
  private unsubscribeQuota: () => void;
  private config: Required<Omit<ChatHistoryServiceConfig, 'timeProvider' | 'storageFactory'>> & { timeProvider: ITimeProvider };
  private collectionRegistry: IStorageRegistry<IMutableCollection<ChatSession>>;
  private timeProvider: ITimeProvider;

  constructor(config: ChatHistoryServiceConfig) {
    this.timeProvider = config?.timeProvider || defaultTimeProvider;
    const factory = config?.storageFactory || defaultStorageFactory;

    this.config = {
      quotaObservable: config?.quotaObservable || defaultPlatformService.getStorageQuotaObservable(),
      storageKeys: config?.storageKeys || STORAGE_KEYS,
      logger: config?.logger || defaultLogger,
      timeProvider: this.timeProvider,
      isBrowserEnv: config?.isBrowserEnv || (() => defaultPlatformService.isBrowserEnv()),
      collectionRegistry: config?.collectionRegistry || factory.createRegistry<IMutableCollection<ChatSession>>((key) => {
        return factory.createCollection<ChatSession>(key, {
          keyExtractor: (item) => String(item.id || ""),
          validate: (s) => !this.isMockChatSession(s as Partial<ChatSession>),
          maxItems: 100,
        });
      }),
    };
    this.collectionRegistry = this.config.collectionRegistry;
    this.unsubscribeQuota = this.config.quotaObservable.subscribe(() => {
      this.handleQuotaExceeded();
    });
  }

  private handleQuotaExceeded(): void {
    this.config.logger.warn("ChatHistoryService: Storage quota exceeded. Evicting old chat histories to recover space.");
    try {
      const keysToClean = safeGetStorageKeys(this.config.storageKeys.CHAT_SESSIONS_PREFIX, (this.config as unknown as { storageFactory?: { storageInstance?: Storage } }).storageFactory?.storageInstance || createDefaultStorageInstance?.());
      if (keysToClean.length === 0) {
        // Fallback for tests or environments where safeGetStorageKeys might not work as expected
        // Check the registry directly
        const keys = this.collectionRegistry.keys;
        for (const key of keys) {
             if (key.startsWith(this.config.storageKeys.CHAT_SESSIONS_PREFIX)) {
                 keysToClean.push(key);
             }
        }
      }
      keysToClean.forEach((key) => {
        const collection = this.getChatCollectionByKey(key);
        let sessions = collection.load();

        // Sort by updatedAt descending
        sessions = [...sessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

        // Keep only top 10
        if (sessions.length > 10) {
            const retained = sessions.slice(0, 10);
            // We use raw setter here to bypass the write-through pipeline temporarily or just use the collection
            // We must be careful not to trigger another quota error, but we are *shrinking* the data.
            collection.save(retained);
            this.config.logger.info(`ChatHistoryService: Evicted ${sessions.length - 10} sessions from ${key}`);
        }
      });
    } catch (e) {
      this.config.logger.error("ChatHistoryService: Failed to handle quota exceeded event", e);
    }
  }

  private getChatCollectionByKey(key: string): IMutableCollection<ChatSession> {
    return this.collectionRegistry.get(key);
  }

  public getChatCollection(projectId?: string): IMutableCollection<ChatSession> {
    const key = this.getChatSessionsStorageKey(projectId);
    return this.getChatCollectionByKey(key);
  }

  public getChatSessionsStorageKey(projectId?: string): string {
    if (projectId && projectId.trim()) {
      return `${this.config.storageKeys.CHAT_SESSIONS_PREFIX}_${projectId.trim()}`;
    }
    return `${this.config.storageKeys.CHAT_SESSIONS_PREFIX}_default`;
  }

  public isMockChatSession(session: Partial<ChatSession>): boolean {
    return isMockSession(session, "chat");
  }

  public purgeMockSessionsFromStorage(): void {
    try {
      if (this.config.isBrowserEnv()) {
        const keysToClean = safeGetStorageKeys(this.config.storageKeys.CHAT_SESSIONS_PREFIX, (this.config as unknown as { storageFactory?: { storageInstance?: Storage } }).storageFactory?.storageInstance || createDefaultStorageInstance?.());

        keysToClean.forEach((key) => {
          const collection = this.getChatCollectionByKey(key);
          const rawCollection = this.config.collectionRegistry.get(key);
          const rawSessions = rawCollection.load();

          const cleanSessions = collection.load();
          if (cleanSessions.length !== rawSessions.length) {
            collection.save(cleanSessions);
          }
          if (typeof ((rawCollection as unknown) as { dispose?: () => void }).dispose === "function") {
            ((rawCollection as unknown) as { dispose: () => void }).dispose();
          }
        });
      }
    } catch {
      // Fail gracefully if storage access is restricted
    }
  }

  public sanitizeMessagesForHistory(messages: ChatMessage[]): ChatMessage[] {
    return messages.map((m) => ({
      ...m,
      images: m.images?.map((img) => ({
        ...img,
        data: "", // Stripped to conserve storage quota
      })),
    }));
  }

  public generateSessionTitle(messages: ChatMessage[], maxLength: number = 42): string {
    const firstUserMsg = messages.find((m) => m.role === "user" && m.text.trim().length > 0);
    if (firstUserMsg && firstUserMsg.text.trim()) {
      const raw = firstUserMsg.text.trim().replace(/\s+/g, " ");
      return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
    }
    const firstAnyMsg = messages.find((m) => m.text.trim().length > 0);
    if (firstAnyMsg && firstAnyMsg.text.trim()) {
      const raw = firstAnyMsg.text.trim().replace(/\s+/g, " ");
      return raw.length > maxLength ? `${raw.slice(0, maxLength)}...` : raw;
    }
    return "New Conversation";
  }

  public getChatSessions(projectId?: string): ChatSession[] {
    return [...this.getChatCollection(projectId).load()].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  public saveChatSession(session: ChatSession, projectId?: string): void {
    if (!session.id || !session.messages || this.isMockChatSession(session)) return;

    const collection = this.getChatCollection(projectId);
    const sanitizedMessages = this.sanitizeMessagesForHistory(session.messages || []);

    const title =
      session.title && session.title !== "New Conversation" && session.title !== "Untitled Chat"
        ? session.title
        : this.generateSessionTitle(sanitizedMessages);

    const updatedSession: ChatSession = {
      ...session,
      title,
      messages: sanitizedMessages,
      projectId: projectId || session.projectId,
      updatedAt: this.timeProvider.now(),
      createdAt: session.createdAt || this.timeProvider.now(),
    };

    collection.upsert(updatedSession, true);
  }

  public getChatSessionById(sessionId: string, projectId?: string): ChatSession | null {
    const sessions = this.getChatSessions(projectId);
    return sessions.find((s) => s.id === sessionId) || null;
  }

  public deleteChatSession(sessionId: string, projectId?: string): boolean {
    const collection = this.getChatCollection(projectId);
    const beforeLength = collection.load().length;
    const after = collection.delete(sessionId);
    return after.length !== beforeLength;
  }

  public clearAllChatSessions(projectId?: string): void {
    this.getChatCollection(projectId).clear();
  }

  public bulkDeleteChatSessions(sessionIds: string[], projectId?: string): boolean {
    if (!sessionIds || sessionIds.length === 0) return false;
    const collection = this.getChatCollection(projectId);
    const itemsBefore = collection.load().length;
    const filtered = collection.bulkDelete(sessionIds);
    return filtered.length !== itemsBefore;
  }
}

