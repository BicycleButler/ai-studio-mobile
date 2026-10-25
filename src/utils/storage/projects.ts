import { ProjectInfo } from "../../types";
import { generateUniqueId } from "../idGenerator";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeRemoveStorage, safeSetStorageString } from "./core";
import { encryptSecret, decryptSecret } from "./encryption";
import { createActiveItemManager } from "./ActiveItemManagerFactory";
import { GeneralSettingsService } from "./general";
import { IActiveItemManager } from "./ActiveItemManager";

export interface ProjectServiceConfig {
  generalSettingsService?: GeneralSettingsService;
  projectsManager?: IActiveItemManager<ProjectInfo>;
}

export class ProjectService {
  public projectsManager: IActiveItemManager<ProjectInfo>;

  constructor(config: ProjectServiceConfig) {
    this.projectsManager = config?.projectsManager || createActiveItemManager<ProjectInfo>({
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
        if (!config.generalSettingsService) { throw new Error("generalSettingsService is required for ProjectService"); }
        const genSettings = config.generalSettingsService;
        genSettings.saveStoredApiKey(activeProject ? activeProject.apiKey : "");
      }
    });
  }

  public loadStoredProjects(): ProjectInfo[] {
    return this.projectsManager.getItems();
  }

  public saveStoredProjects(projects: ProjectInfo[]): void {
    this.projectsManager.collection.save(projects);
  }

  public getActiveProjectId(): string | null {
    return this.projectsManager.getActiveId();
  }

  public setActiveProjectId(id: string | null): void {
    this.projectsManager.setActiveId(id);
  }

  public saveAndActivateProject(
    projectData: Omit<ProjectInfo, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): ProjectInfo {
    const now = Date.now();
    const id = projectData.id || generateUniqueId("proj");

    const savedProject = {
      ...projectData,
      id,
      name: projectData.name.trim() || `AI Studio Project ${this.projectsManager.getItems().length + 1}`,
      apiKey: projectData.apiKey.trim(),
      defaultModel: projectData.defaultModel || "gemini-2.5-flash",
      createdAt: now,
      updatedAt: now,
      lastVerifiedAt: projectData.lastVerifiedAt || now,
      isValid: projectData.isValid ?? true,
    } as ProjectInfo;

    this.projectsManager.collection.upsert(savedProject, false);
    this.projectsManager.setActiveId(savedProject.id);

    return savedProject;
  }
}

export const defaultProjectService = new ProjectService({});

export const projectsManager = defaultProjectService.projectsManager;


