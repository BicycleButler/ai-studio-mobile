import { SavedPrompt } from "../../types";
import { IActiveItemManagerFactory, DefaultActiveItemManagerFactory } from "./ActiveItemManagerFactory";
import { STORAGE_KEYS } from "./constants";
import { IActiveItemManager } from "./ActiveItemManager";
import { IStorageSyncAdapter } from "./syncAdapter";
import { NoImplicitSelectionStrategy } from "./selectionStrategy";

export interface ISavedPromptsService {
  savedPromptsManager: IActiveItemManager<SavedPrompt>;
  loadSavedPrompts(): SavedPrompt[];
  persistSavedPrompts(prompts: SavedPrompt[]): void;
}

import { IStorageFactory } from "./StorageFactory";

export interface SavedPromptsServiceConfig {
  savedPromptsManager?: IActiveItemManager<SavedPrompt>;
  syncAdapter?: IStorageSyncAdapter<SavedPrompt[]>;
  storageFactory?: IStorageFactory;
  activeItemManagerFactory?: IActiveItemManagerFactory;
}

export class SavedPromptsService implements ISavedPromptsService {
  public savedPromptsManager: IActiveItemManager<SavedPrompt>;
  private syncAdapter: IStorageSyncAdapter<SavedPrompt[]>;

  constructor(config?: SavedPromptsServiceConfig) {
    if (!config?.syncAdapter) { throw new Error("syncAdapter is required for SavedPromptsService"); }
    this.syncAdapter = config.syncAdapter;

    this.savedPromptsManager = config?.savedPromptsManager || (config?.activeItemManagerFactory || new DefaultActiveItemManagerFactory()).create<SavedPrompt>({
      storageFactory: config?.storageFactory,
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
          this.syncAdapter.syncItem(clean, "saved_prompts");
        }
      },
      activeIdKey: STORAGE_KEYS.SAVED_PROMPTS + "_activeId",
      getId: (s) => s.id,
      implicitSelectionStrategy: new NoImplicitSelectionStrategy(),
    });
  }

  public loadSavedPrompts(): SavedPrompt[] {
    return this.savedPromptsManager.getItems();
  }

  public persistSavedPrompts(prompts: SavedPrompt[]): void {
    this.savedPromptsManager.collection.save(prompts);
  }
}

