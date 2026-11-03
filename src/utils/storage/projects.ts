import { createDefaultStorageInstance } from "./core";
import { ProjectInfo } from "../../types";
import { IIdGenerator, defaultIdGenerator } from "../idGenerator";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeRemoveStorage, safeSetStorageString } from "./core";
import { encryptSecret, decryptSecret } from "./encryption";
import { createActiveItemManager } from "./ActiveItemManagerFactory";
import { IGeneralSettingsService } from "./general";
import { IActiveItemManager } from "./ActiveItemManager";
import { ITimeProvider, defaultTimeProvider } from "../timeProvider";

export interface IProjectService {
  projectsManager: IActiveItemManager<ProjectInfo>;
  loadStoredProjects(): ProjectInfo[];
  saveStoredProjects(projects: ProjectInfo[]): void;
  getActiveProjectId(): string | null;
  setActiveProjectId(id: string | null): void;
  saveAndActivateProject(
    projectData: Omit<ProjectInfo, "id" | "createdAt" | "updatedAt"> & { id?: string }
  ): ProjectInfo;
}

import { IStorageFactory } from "./StorageFactory";

export interface ProjectServiceConfig {
  timeProvider?: ITimeProvider;
  generalSettingsService?: IGeneralSettingsService;
  projectsManager?: IActiveItemManager<ProjectInfo>;
  idGenerator?: IIdGenerator;
  storageFactory?: IStorageFactory;
}

export class ProjectService implements IProjectService {
  public projectsManager: IActiveItemManager<ProjectInfo>;
  private timeProvider: ITimeProvider;
  private idGenerator: IIdGenerator;

  constructor(config: ProjectServiceConfig) {
    this.timeProvider = config?.timeProvider || defaultTimeProvider;
    this.idGenerator = config?.idGenerator || defaultIdGenerator;
    this.projectsManager = config?.projectsManager || createActiveItemManager<ProjectInfo>({
      storageFactory: config?.storageFactory,
      collectionKey: STORAGE_KEYS.PROJECTS,
      collectionOptions: {
        transformIn: (p) => ({ ...p, apiKey: encryptSecret(p.apiKey) }),
        transformOut: (p) => ({ ...p, apiKey: decryptSecret(p.apiKey) }),
      },
      activeIdKey: STORAGE_KEYS.ACTIVE_PROJECT_ID,
      activeIdOptions: {
        adapter: {
          get: (key: string, fallback: string | null) => {
            const val = safeGetStorageString(key, "", ((config?.storageFactory as unknown as { storageInstance?: Storage })?.storageInstance || createDefaultStorageInstance()));
            return val ? val : fallback;
          },
          set: (key: string, value: string | null) => {
            if (value) {
              safeSetStorageString(key, value, ((config?.storageFactory as unknown as { storageInstance?: Storage })?.storageInstance || createDefaultStorageInstance()));
            } else {
              safeRemoveStorage(key, ((config?.storageFactory as unknown as { storageInstance?: Storage })?.storageInstance || createDefaultStorageInstance()));
            }
          },
          remove: (key: string) => safeRemoveStorage(key, ((config?.storageFactory as unknown as { storageInstance?: Storage })?.storageInstance || createDefaultStorageInstance())),
        }
      },
      getId: (p) => p.id,
    });

    if (config.generalSettingsService) {
        let lastActiveItemId: string | null = this.projectsManager.getSnapshot().activeItem?.id ?? null;
        this.projectsManager.subscribe((state) => {
            const currentActiveId = state.activeItem ? state.activeItem.id : null;
            if (lastActiveItemId !== currentActiveId) {
                lastActiveItemId = currentActiveId;
                config.generalSettingsService!.saveStoredApiKey(state.activeItem ? state.activeItem.apiKey : "");
            }
        });
    }
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
    const now = this.timeProvider.now();
    const id = projectData.id || this.idGenerator.generate("proj");

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


