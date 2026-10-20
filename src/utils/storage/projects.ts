import { ProjectInfo } from "../../types";
import { generateUniqueId } from "../idGenerator";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeRemoveStorage, safeSetStorageString } from "./core";
import { encryptSecret, decryptSecret } from "./encryption";
import { saveStoredApiKey } from "./general";
import { createActiveItemManager } from "./ActiveItemManagerFactory";

export const projectsManager = createActiveItemManager<ProjectInfo>({
  collectionKey: STORAGE_KEYS.PROJECTS,
  collectionOptions: {
    transformIn: (p) => ({ ...p, apiKey: encryptSecret(p.apiKey) }),
    transformOut: (p) => ({ ...p, apiKey: decryptSecret(p.apiKey) }),
  },
  activeIdKey: STORAGE_KEYS.ACTIVE_PROJECT_ID,
  activeIdOptions: {
    adapter: {
      get: (key: string, fallback: string | null) => {
        const val = safeGetStorageString(key, "");
        return val ? val : fallback;
      },
      set: (key: string, value: string | null) => {
        if (value) {
          safeSetStorageString(key, value);
        } else {
          safeRemoveStorage(key);
        }
      },
      remove: (key: string) => safeRemoveStorage(key),
    }
  },
  getId: (p) => p.id,
  onActiveItemChange: (activeProject) => {
    saveStoredApiKey(activeProject ? activeProject.apiKey : "");
  }
});

export function loadStoredProjects(): ProjectInfo[] {
  return projectsManager.getItems();
}

export function saveStoredProjects(projects: ProjectInfo[]): void {
  projectsManager.collection.save(projects);
}

export function getActiveProjectId(): string | null {
  return projectsManager.getActiveId();
}

export function setActiveProjectId(id: string | null): void {
  projectsManager.setActiveId(id);
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

  projectsManager.collection.upsert(savedProject, false);
  projectsManager.setActiveId(savedProject.id);

  return savedProject;
}
