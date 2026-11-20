import { ProjectInfo } from "../../types";
import { IIdGenerator, DefaultIdGenerator } from "../idGenerator";
import { STORAGE_KEYS } from "./constants";
import { safeGetStorageString, safeRemoveStorage, safeSetStorageString } from "./core";
import { encryptSecret, decryptSecret } from "./encryption";
import { IActiveItemManagerFactory, DefaultActiveItemManagerFactory } from "./ActiveItemManagerFactory";
import { IGeneralSettingsService } from "./general";
import { IActiveItemManager } from "./ActiveItemManager";
import { ITimeProvider, DefaultTimeProvider } from "../timeProvider";

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

import { IStorageFactory, DefaultStorageFactory } from "./StorageFactory";
import { IStorageSyncAdapter } from "./syncAdapter";

export interface ProjectServiceConfig {
  timeProvider?: ITimeProvider;
  generalSettingsService?: IGeneralSettingsService;
  projectsManager?: IActiveItemManager<ProjectInfo>;
  idGenerator?: IIdGenerator;
  storageFactory?: IStorageFactory;
  activeItemManagerFactory?: IActiveItemManagerFactory;
  syncAdapter?: IStorageSyncAdapter<ProjectInfo[]>;
}

export class ProjectService implements IProjectService {
  public projectsManager: IActiveItemManager<ProjectInfo>;
  private timeProvider: ITimeProvider;
  private idGenerator: IIdGenerator;

  constructor(config: ProjectServiceConfig) {
    this.timeProvider = config?.timeProvider || new DefaultTimeProvider();
    this.idGenerator = config?.idGenerator || new DefaultIdGenerator();
    const factory = config?.storageFactory || new DefaultStorageFactory();
    this.projectsManager = config?.projectsManager || (config?.activeItemManagerFactory || new DefaultActiveItemManagerFactory()).create<ProjectInfo>({
      storageFactory: factory,
      collectionKey: STORAGE_KEYS.PROJECTS,
      collectionOptions: {
        transformIn: (p) => ({ ...p, apiKey: encryptSecret(p.apiKey) }),
        transformOut: (p) => ({ ...p, apiKey: decryptSecret(p.apiKey) }),
        onSave: config?.syncAdapter
          ? (clean) => {
              config.syncAdapter!.syncItem(clean, "projects");
            }
          : undefined,
      },
      activeIdKey: STORAGE_KEYS.ACTIVE_PROJECT_ID,
      activeIdOptions: {
        adapter: {
          get: (key: string, fallback: string | null) => {
            const val = safeGetStorageString(key, "", factory.getStorageInstance());
            return val ? val : fallback;
          },
          set: (key: string, value: string | null) => {
            if (value) {
              safeSetStorageString(key, value, factory.getStorageInstance());
            } else {
              safeRemoveStorage(key, factory.getStorageInstance());
            }
          },
          remove: (key: string) => safeRemoveStorage(key, factory.getStorageInstance()),
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
      name: projectData.name.trim() || `Helm Project ${this.projectsManager.getItems().length + 1}`,
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




