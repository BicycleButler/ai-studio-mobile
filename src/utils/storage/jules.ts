import { JulesSession, JulesSettings } from "../../types";
import { STORAGE_KEYS } from "./constants";
import { encryptSecret, decryptSecret } from "./encryption";
import { isMockSession } from "../mockDefinitions";
import { cleanMockData } from "./helpers";
import { apiFetch, defaultClient } from "../apiClient";
import { defaultOfflineService } from "../offlineService";
import { NetworkStorageSyncAdapter } from "./syncAdapter";
import { generateUniqueId } from "../idGenerator";
import { createActiveItemManager } from "./ActiveItemManagerFactory";
import { StorageSingleton } from "./StorageSingleton";
import { ILogger, defaultLogger } from "../logger";
import { IMutableSingleton } from "./types";
import { IActiveItemManager } from "./ActiveItemManager";
import { IStorageSyncAdapter } from "./syncAdapter";

export interface JulesStorageServiceConfig {
  julesApiKeySingleton?: IMutableSingleton<string>;
  julesSettingsSingleton?: IMutableSingleton<JulesSettings>;
  julesSessionsManager?: IActiveItemManager<JulesSession>;
  syncAdapter?: IStorageSyncAdapter<JulesSession[]>;
  logger?: ILogger;
}

const DEFAULT_JULES_SETTINGS: JulesSettings = {
  autoApprovePlans: false,
  defaultBranch: "main",
};

export class JulesStorageService {
  private julesApiKeySingleton: IMutableSingleton<string>;
  private julesSettingsSingleton: IMutableSingleton<JulesSettings>;
  public julesSessionsManager: IActiveItemManager<JulesSession>;
  private syncAdapter: IStorageSyncAdapter<JulesSession[]>;
  private logger: ILogger;

  constructor(config?: JulesStorageServiceConfig) {
    this.logger = config?.logger || defaultLogger;

    this.julesApiKeySingleton = config?.julesApiKeySingleton || new StorageSingleton<string>(
      STORAGE_KEYS.JULES_API_KEY,
      "",
      {
        transformIn: (key) => key.trim() ? encryptSecret(key.trim()) : "",
        transformOut: (key) => decryptSecret(key),
      }
    );

    this.julesSettingsSingleton = config?.julesSettingsSingleton || new StorageSingleton<JulesSettings>(
      STORAGE_KEYS.JULES_SETTINGS,
      DEFAULT_JULES_SETTINGS
    );

    this.syncAdapter = config?.syncAdapter || new NetworkStorageSyncAdapter<JulesSession[]>(defaultClient, defaultOfflineService);

    this.julesSessionsManager = config?.julesSessionsManager || createActiveItemManager<JulesSession>({
      collectionKey: STORAGE_KEYS.JULES_SESSIONS,
      collectionOptions: {
        validate: (s) => !this.isMockJulesSession(s as Partial<JulesSession>),
        onSave: (clean) => {
          this.syncAdapter.syncItem(clean, "/api/jules/sessions", "jules_sessions");
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
      const data = await apiFetch<unknown>("/api/jules/sessions");
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
    const id = generateUniqueId("jules_sess");
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
    this.saveJulesSession(newSession);
    return newSession;
  }
}

export const defaultJulesStorageService = new JulesStorageService();

export const julesSessionsManager = defaultJulesStorageService.julesSessionsManager;

export function loadStoredJulesApiKey(): string {
  return defaultJulesStorageService.loadStoredJulesApiKey();
}

export function saveStoredJulesApiKey(key: string): void {
  defaultJulesStorageService.saveStoredJulesApiKey(key);
}

export function isMockJulesSession(session: Partial<JulesSession>): boolean {
  return defaultJulesStorageService.isMockJulesSession(session);
}

export async function fetchJulesSessionsFromServer(logger?: ILogger): Promise<JulesSession[]> {
  return defaultJulesStorageService.fetchJulesSessionsFromServer(logger);
}

export function loadStoredJulesSettings(): JulesSettings {
  return defaultJulesStorageService.loadStoredJulesSettings();
}

export function saveStoredJulesSettings(settings: JulesSettings): void {
  defaultJulesStorageService.saveStoredJulesSettings(settings);
}
