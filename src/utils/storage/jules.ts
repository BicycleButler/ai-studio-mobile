import { JulesSession, JulesSettings } from "../../types";
import { STORAGE_KEYS } from "./constants";
import { encryptSecret, decryptSecret } from "./encryption";
import { isMockSession } from "../mockDefinitions";
import { cleanMockData } from "./helpers";
import { IApiClient } from "../apiClient";
import { createActiveItemManager } from "./ActiveItemManagerFactory";
import { DefaultStorageFactory, IStorageFactory } from "./StorageFactory";
import { ILogger, DefaultLoggerFactory } from "../logger";
import { IMutableSingleton } from "./types";
import { IActiveItemManager } from "./ActiveItemManager";
import { IStorageSyncAdapter } from "./syncAdapter";
import { IIdGenerator, DefaultIdGenerator } from "../idGenerator";
import { ITimeProvider, DefaultTimeProvider } from "../timeProvider";

export interface IJulesStorageService {
  julesSessionsManager: IActiveItemManager<JulesSession>;
  loadStoredJulesApiKey(): string;
  saveStoredJulesApiKey(key: string): void;
  isMockJulesSession(session: Partial<JulesSession>): boolean;
  fetchJulesSessionsFromServer(logger?: ILogger): Promise<JulesSession[]>;
  loadStoredJulesSettings(): JulesSettings;
  saveStoredJulesSettings(settings: JulesSettings): void;
  getStoredJulesSessions(): JulesSession[];
  saveJulesSession(session: JulesSession): void;
  deleteJulesSession(sessionId: string): void;
  bulkDeleteJulesSessions(sessionIds: string[]): void;
  createNewJulesSession(
    repository: string,
    branch?: string,
    initialTitle?: string
  ): JulesSession;
}

export interface JulesStorageServiceConfig {
  timeProvider?: ITimeProvider;
  apiClient: IApiClient;
  julesApiKeySingleton?: IMutableSingleton<string>;
  julesSettingsSingleton?: IMutableSingleton<JulesSettings>;
  julesSessionsManager?: IActiveItemManager<JulesSession>;
  syncAdapter?: IStorageSyncAdapter<JulesSession[]>;
  logger: ILogger;
  idGenerator?: IIdGenerator;
  storageFactory?: IStorageFactory;
}

const DEFAULT_JULES_SETTINGS: JulesSettings = {
  autoApprovePlans: false,
  defaultBranch: "main",
};

export class JulesStorageService implements IJulesStorageService {
  private julesApiKeySingleton: IMutableSingleton<string>;
  private julesSettingsSingleton: IMutableSingleton<JulesSettings>;
  public julesSessionsManager: IActiveItemManager<JulesSession>;
  private syncAdapter: IStorageSyncAdapter<JulesSession[]>;
  private logger: ILogger;
  private apiClient: IApiClient;
  private idGenerator: IIdGenerator;
  private timeProvider: ITimeProvider;

  constructor(config: JulesStorageServiceConfig) {
    this.logger = config.logger;
    this.apiClient = config.apiClient;
    this.idGenerator = config.idGenerator || new DefaultIdGenerator();
    this.timeProvider = config.timeProvider || new DefaultTimeProvider();

    const factory = config.storageFactory || new DefaultStorageFactory();
    this.julesApiKeySingleton = config?.julesApiKeySingleton || factory.createSingleton<string>(
      STORAGE_KEYS.JULES_API_KEY,
      "",
      {
        transformIn: (key) => key.trim() ? encryptSecret(key.trim()) : "",
        transformOut: (key) => decryptSecret(key),
      }
    );

    this.julesSettingsSingleton = config?.julesSettingsSingleton || factory.createSingleton<JulesSettings>(
      STORAGE_KEYS.JULES_SETTINGS,
      DEFAULT_JULES_SETTINGS
    );

    if (!config?.syncAdapter) { throw new Error("syncAdapter is required for JulesStorageService"); }
    this.syncAdapter = config.syncAdapter;

    this.julesSessionsManager = config?.julesSessionsManager || createActiveItemManager<JulesSession>({
      storageFactory: config?.storageFactory,
      collectionKey: STORAGE_KEYS.JULES_SESSIONS,
      collectionOptions: {
        validate: (s) => !this.isMockJulesSession(s as Partial<JulesSession>),
        onSave: (clean) => {
          this.syncAdapter.syncItem(clean, "jules_sessions");
        }
      },
      activeIdKey: STORAGE_KEYS.ACTIVE_JULES_SESSION_ID,
      getId: (s) => s.id,
      allowImplicitSelection: false,
    });
  }

  public loadStoredJulesApiKey(): string {
    return this.julesApiKeySingleton.load();
  }

  public saveStoredJulesApiKey(key: string): void {
    this.julesApiKeySingleton.save(key);
  }

  public isMockJulesSession(session: Partial<JulesSession>): boolean {
    return isMockSession(session, "jules");
  }

  public async fetchJulesSessionsFromServer(logger: ILogger = this.logger): Promise<JulesSession[]> {
    try {
      const data = await this.apiClient.fetch<unknown>("/api/jules/sessions");
      const cleanServerSessions = Array.isArray(data) ? cleanMockData(data, "jules") as JulesSession[] : [];

      const localSessions = this.julesSessionsManager.getItems();
      const localSessionMap = new Map(localSessions.map(s => [s.id, s]));

      // Merge server sessions with local ones, preferring local modifications if they are newer
      const mergedSessions = cleanServerSessions.map(serverSession => {
        const localSession = localSessionMap.get(serverSession.id);
        if (localSession && (localSession.updatedAt || 0) > (serverSession.updatedAt || 0)) {
          return localSession;
        }
        return serverSession;
      });

      // Add any local sessions that aren't on the server yet
      for (const localSession of localSessions) {
        if (!mergedSessions.some(s => s.id === localSession.id)) {
          mergedSessions.push(localSession);
        }
      }

      this.julesSessionsManager.collection.save(mergedSessions);
      return mergedSessions;
    } catch (e) {
      logger.error("Failed to fetch Jules sessions from server", e);
    }
    return this.julesSessionsManager.getItems();
  }

  public loadStoredJulesSettings(): JulesSettings {
    return this.julesSettingsSingleton.load();
  }

  public saveStoredJulesSettings(settings: JulesSettings): void {
    this.julesSettingsSingleton.save(settings);
  }

  public getStoredJulesSessions(): JulesSession[] {
    return this.julesSessionsManager.getItems();
  }

  public saveJulesSession(session: JulesSession): void {
    this.julesSessionsManager.collection.upsert(session);
  }

  public deleteJulesSession(sessionId: string): void {
    this.julesSessionsManager.collection.delete(sessionId);
  }

  public bulkDeleteJulesSessions(sessionIds: string[]): void {
    if (!sessionIds || sessionIds.length === 0) return;
    this.julesSessionsManager.collection.bulkDelete(sessionIds);
  }

  public createNewJulesSession(
    repository: string,
    branch: string = "main",
    initialTitle?: string
  ): JulesSession {
    const id = this.idGenerator.generate("jules_sess");
    const newSession: JulesSession = {
      id,
      title: initialTitle || `Task on ${repository}`,
      repository,
      branch,
      status: "idle",
      steps: [],
      messages: [],
      createdAt: this.timeProvider.now(),
      updatedAt: this.timeProvider.now(),
    };
    this.saveJulesSession(newSession);
    return newSession;
  }
}

