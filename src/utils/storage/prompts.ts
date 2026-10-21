import { SavedPrompt } from "../../types";
import { createActiveItemManager } from "./ActiveItemManagerFactory";
import { STORAGE_KEYS } from "./constants";
import { defaultClient } from "../apiClient";
import { defaultOfflineService } from "../offlineService";
import { NetworkStorageSyncAdapter } from "./syncAdapter";

const savedPromptsSyncAdapter = new NetworkStorageSyncAdapter<SavedPrompt[]>(defaultClient, defaultOfflineService);

export const savedPromptsManager = createActiveItemManager<SavedPrompt>({
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
      savedPromptsSyncAdapter.syncItem(clean, "/api/prompts", "saved_prompts");
    }
  },
  activeIdKey: STORAGE_KEYS.SAVED_PROMPTS + "_activeId",
  getId: (s) => s.id,
  allowImplicitSelection: false,
});

export function loadSavedPrompts(): SavedPrompt[] {
  return savedPromptsManager.getItems();
}

export function persistSavedPrompts(prompts: SavedPrompt[]): void {
  savedPromptsManager.collection.save(prompts);
}
