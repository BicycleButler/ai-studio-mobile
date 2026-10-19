import { JulesSession, JulesSettings } from "../../types";
import { isBrowserEnvironment, getSafeWindow } from "../platform";
import { enqueueOfflineMutation } from "../offlineService";
import { StorageCollection } from "./StorageCollection";
import { StorageSingleton } from "./StorageSingleton";
import { ActiveItemManager } from "./ActiveItemManager";
import { STORAGE_KEYS } from "./constants";
import { encryptSecret, decryptSecret } from "./encryption";
import { isMockSession } from "../mockDefinitions";
import { cleanMockData } from "./helpers";

const julesApiKeySingleton = new StorageSingleton<string>(
  STORAGE_KEYS.JULES_API_KEY,
  "",
  {
    transformIn: (key) => key.trim() ? encryptSecret(key.trim()) : "",
    transformOut: (key) => decryptSecret(key),
  }
);

export function loadStoredJulesApiKey(): string {
  return julesApiKeySingleton.load();
}

export function saveStoredJulesApiKey(key: string): void {
  julesApiKeySingleton.save(key);
}

export function isMockJulesSession(session: Partial<JulesSession>): boolean {
  return isMockSession(session, "jules");
}

const julesSessionsCollection = new StorageCollection<JulesSession>(STORAGE_KEYS.JULES_SESSIONS, {
  validate: (s) => !isMockJulesSession(s as Partial<JulesSession>),
  onSave: (clean) => {
    // Async sync to server
    if (isBrowserEnvironment()) {
      const win = getSafeWindow();
      const isOnline = win && typeof win.navigator.onLine === "boolean" ? win.navigator.onLine : true;

      if (isOnline) {
        fetch("/api/jules/sessions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(clean),
        }).catch((e) => console.error("Failed to save Jules sessions to server", e));
      } else {
        enqueueOfflineMutation("jules_sessions", clean).catch(console.error);
      }
    }
  }
});

const activeJulesSessionIdSingleton = new StorageSingleton<string | null>(
  STORAGE_KEYS.ACTIVE_JULES_SESSION_ID,
  null
);

export const julesSessionsManager = new ActiveItemManager<JulesSession>({
  collection: julesSessionsCollection,
  activeIdSingleton: activeJulesSessionIdSingleton,
  getId: (s) => s.id,
  allowImplicitSelection: false,
});

export function loadStoredJulesSessions(): JulesSession[] {
  return julesSessionsManager.getItems();
}

export function saveStoredJulesSessions(sessions: JulesSession[]): void {
  julesSessionsManager.collection.save(sessions);
}

export async function fetchJulesSessionsFromServer(): Promise<JulesSession[]> {
  try {
    const res = await fetch("/api/jules/sessions");
    if (res.ok) {
      const data = await res.json();
      const cleanServerSessions = Array.isArray(data) ? cleanMockData(data, "jules") as JulesSession[] : [];

      const localSessions = loadStoredJulesSessions();
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

      julesSessionsManager.collection.save(mergedSessions);
      return mergedSessions;
    }
  } catch (e) {
    console.error("Failed to fetch Jules sessions from server", e);
  }
  return loadStoredJulesSessions();
}

const DEFAULT_JULES_SETTINGS: JulesSettings = {
  autoApprovePlans: false,
  defaultBranch: "main",
};

const julesSettingsSingleton = new StorageSingleton<JulesSettings>(
  STORAGE_KEYS.JULES_SETTINGS,
  DEFAULT_JULES_SETTINGS
);

export function loadStoredJulesSettings(): JulesSettings {
  return julesSettingsSingleton.load();
}

export function saveStoredJulesSettings(settings: JulesSettings): void {
  julesSettingsSingleton.save(settings);
}

export function getActiveJulesSessionId(): string | null {
  return julesSessionsManager.getActiveId();
}

export function setActiveJulesSessionId(id: string | null): void {
  julesSessionsManager.setActiveId(id);
}

export function getActiveJulesSession(): JulesSession | null {
  return julesSessionsManager.getActiveItem();
}

export function updateStoredJulesSession(session: JulesSession): JulesSession {
  const updatedSession = { ...session, updatedAt: Date.now() };
  return julesSessionsManager.collection.upsert(updatedSession, true);
}

export function deleteStoredJulesSession(id: string): void {
  julesSessionsManager.collection.delete(id);
}

export function bulkDeleteStoredJulesSessions(ids: string[]): void {
  julesSessionsManager.collection.bulkDelete(ids);
}
