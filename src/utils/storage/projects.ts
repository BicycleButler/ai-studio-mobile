import { ProjectInfo } from "../../types";
import { generateUniqueId } from "../idGenerator";
import { StorageCollection } from "../StorageCollection";
import { StorageSingleton } from "../StorageSingleton";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeRemoveStorage, safeSetStorageString } from "./core";
import { encryptSecret, decryptSecret } from "./encryption";
import { saveStoredApiKey } from "./general";

const projectsCollection = new StorageCollection<ProjectInfo>(STORAGE_KEYS.PROJECTS, {
  transformIn: (p) => ({ ...p, apiKey: encryptSecret(p.apiKey) }),
  transformOut: (p) => ({ ...p, apiKey: decryptSecret(p.apiKey) }),
});

export function loadStoredProjects(): ProjectInfo[] {
  return projectsCollection.load();
}

export function saveStoredProjects(projects: ProjectInfo[]): void {
  projectsCollection.save(projects);
}

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

export function getActiveProjectId(): string | null {
  const val = activeProjectIdSingleton.load();
  return val ? val : null;
}

export function setActiveProjectId(id: string | null): void {
  if (id) {
    activeProjectIdSingleton.save(id);
  } else {
    activeProjectIdSingleton.clear();
  }
}

export function getActiveProject(): ProjectInfo | null {
  const projects = loadStoredProjects();
  if (projects.length === 0) return null;
  const activeId = getActiveProjectId();
  if (activeId) {
    const match = projects.find((p) => p.id === activeId);
    if (match) return match;
  }
  return projects[0];
}

export function saveAndActivateProject(
  projectData: Omit<ProjectInfo, "id" | "createdAt" | "updatedAt"> & { id?: string }
): ProjectInfo {
  const now = Date.now();
  const id = projectData.id || generateUniqueId("proj");

  const savedProject = {
    ...projectData,
    id,
    name: projectData.name.trim() || `AI Studio Project ${projectsCollection.load().length + 1}`,
    apiKey: projectData.apiKey.trim(),
    defaultModel: projectData.defaultModel || "gemini-2.5-flash",
    createdAt: now,
    updatedAt: now,
    lastVerifiedAt: projectData.lastVerifiedAt || now,
    isValid: projectData.isValid ?? true,
  } as ProjectInfo;

  projectsCollection.upsert(savedProject, false);
  setActiveProjectId(savedProject.id);
  saveStoredApiKey(savedProject.apiKey);

  return savedProject;
}

export function deleteStoredProject(id: string): void {
  const filtered = projectsCollection.delete(id);

  const activeId = getActiveProjectId();
  if (activeId === id) {
    if (filtered.length > 0) {
      setActiveProjectId(filtered[0].id);
      saveStoredApiKey(filtered[0].apiKey);
    } else {
      setActiveProjectId(null);
      saveStoredApiKey("");
    }
  }
}

export function bulkDeleteStoredProjects(ids: string[]): void {
  if (!ids || ids.length === 0) return;
  const filtered = projectsCollection.bulkDelete(ids);

  const activeId = getActiveProjectId();
  if (activeId && ids.includes(activeId)) {
    if (filtered.length > 0) {
      setActiveProjectId(filtered[0].id);
      saveStoredApiKey(filtered[0].apiKey);
    } else {
      setActiveProjectId(null);
      saveStoredApiKey("");
    }
  }
}

export function updateStoredProject(
  id: string,
  updates: Partial<Omit<ProjectInfo, "id" | "createdAt">>
): ProjectInfo | null {
  const updated = projectsCollection.update(id, updates);
  if (!updated) return null;

  const activeId = getActiveProjectId();
  if (activeId === id && updates.apiKey) {
    saveStoredApiKey(updates.apiKey);
  }
  return updated;
}
