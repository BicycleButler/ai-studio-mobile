import { SavedPrompt } from "../../types";
import { createActiveItemManager } from "./ActiveItemManagerFactory";
import { STORAGE_KEYS } from "./constants";
import { defaultClient } from "../apiClient";
import { defaultOfflineService } from "../offlineService";
import { NetworkStorageSyncAdapter } from "./syncAdapter";
import { IActiveItemManager } from "./ActiveItemManager";
import { IStorageSyncAdapter } from "./syncAdapter";

export interface SavedPromptsServiceConfig {
  savedPromptsManager?: IActiveItemManager<SavedPrompt>;
  syncAdapter?: IStorageSyncAdapter<SavedPrompt[]>;
}

export class SavedPromptsService {
  public savedPromptsManager: IActiveItemManager<SavedPrompt>;
  private syncAdapter: IStorageSyncAdapter<SavedPrompt[]>;

  constructor(config?: SavedPromptsServiceConfig) {
    this.syncAdapter = config?.syncAdapter || new NetworkStorageSyncAdapter<SavedPrompt[]>({
        apiClient: defaultClient,
        offlineService: defaultOfflineService
    });

    this.savedPromptsManager = config?.savedPromptsManager || createActiveItemManager<SavedPrompt>({
      collectionKey: STORAGE_KEYS.SAVED_PROMPTS,
      collectionOptions: {
        transformIn: (p) => ({
          ...p,
          messages: p.messages.map((m) => ({
            ...m,
            images: m.images?.map((img) => ({
              ...img,
              data: "", // don't persist heavy base64 strings in storage
            })),
          })),
        }),
        onSave: (clean) => {
          this.syncAdapter.syncItem(clean, "/api/prompts", "saved_prompts");
        }
      },
      activeIdKey: STORAGE_KEYS.SAVED_PROMPTS + "_activeId",
      getId: (s) => s.id,
      allowImplicitSelection: false,
    });
  }

  public loadSavedPrompts(): SavedPrompt[] {
    return this.savedPromptsManager.getItems();
  }

  public persistSavedPrompts(prompts: SavedPrompt[]): void {
    this.savedPromptsManager.collection.save(prompts);
  }
}

export const defaultSavedPromptsService = new SavedPromptsService();

export const savedPromptsManager = defaultSavedPromptsService.savedPromptsManager;

export function loadSavedPrompts(): SavedPrompt[] {
  return defaultSavedPromptsService.loadSavedPrompts();
}

export function persistSavedPrompts(prompts: SavedPrompt[]): void {
  defaultSavedPromptsService.persistSavedPrompts(prompts);
}
