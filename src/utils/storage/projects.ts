import { ProjectInfo } from "../../types";
import { generateUniqueId } from "../idGenerator";
import { StorageCollection } from "./StorageCollection";
import { StorageSingleton } from "./StorageSingleton";
import { ActiveItemManager } from "./ActiveItemManager";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeRemoveStorage, safeSetStorageString } from "./core";
import { encryptSecret, decryptSecret } from "./encryption";
import { saveStoredApiKey } from "./general";

const projectsCollection = new StorageCollection<ProjectInfo>(STORAGE_KEYS.PROJECTS, {
  transformIn: (p) => ({ ...p, apiKey: encryptSecret(p.apiKey) }),
  transformOut: (p) => ({ ...p, apiKey: decryptSecret(p.apiKey) }),
});

const activeProjectIdSingleton = new StorageSingleton<string | null>(
  STORAGE_KEYS.ACTIVE_PROJECT_ID,
  null,
  {
    getter: (key, fallback) => {
      const val = safeGetStorageString(key, "");
      return val ? val : fallback;
    },
    setter: (key, value) => {
      if (value) {
        safeSetStorageString(key, value);
      } else {
        safeRemoveStorage(key);
      }
    }
  }
);

export const projectsManager = new ActiveItemManager<ProjectInfo>({
  collection: projectsCollection,
  activeIdSingleton: activeProjectIdSingleton,
  getId: (p) => p.id,
  onActiveItemChange: (activeProject) => {
    saveStoredApiKey(activeProject ? activeProject.apiKey : "");
  }
});

export function loadStoredProjects(): ProjectInfo[] {
  return projectsManager.getItems();
}

export function saveStoredProjects(projects: ProjectInfo[]): void {
  projectsManager.saveItems(projects);
}

export function getActiveProjectId(): string | null {
  return projectsManager.getActiveId();
}

export function setActiveProjectId(id: string | null): void {
  projectsManager.setActiveId(id);
}

export function getActiveProject(): ProjectInfo | null {
  return projectsManager.getActiveItem();
}

export function saveAndActivateProject(
  projectData: Omit<ProjectInfo, "id" | "createdAt" | "updatedAt"> & { id?: string }
): ProjectInfo {
  const now = Date.now();
  const id = projectData.id || generateUniqueId("proj");

  const savedProject = {
    ...projectData,
    id,
    name: projectData.name.trim() || `AI Studio Project ${projectsManager.getItems().length + 1}`,
    apiKey: projectData.apiKey.trim(),
    defaultModel: projectData.defaultModel || "gemini-2.5-flash",
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: projectData.lastVerifiedAt || now,
    isValid: projectData.isValid ?? true,
  } as ProjectInfo;

  projectsManager.upsert(savedProject, false);
  projectsManager.setActiveId(savedProject.id);

  return savedProject;
}

export function deleteStoredProject(id: string): void {
  projectsManager.delete(id);
}

export function bulkDeleteStoredProjects(ids: string[]): void {
  if (!ids || ids.length === 0) return;
  projectsManager.bulkDelete(ids);
}

export function updateStoredProject(
  id: string,
  updates: Partial<Omit<ProjectInfo, "id" | "createdAt">>
): ProjectInfo | null {
  return projectsManager.update(id, { ...updates, updatedAt: Date.now() });
}
