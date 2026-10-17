import { SavedPrompt } from "../../types";
import { StorageCollection } from "../StorageCollection";
import { STORAGE_KEYS } from "./constants";

const savedPromptsCollection = new StorageCollection<SavedPrompt>(STORAGE_KEYS.SAVED_PROMPTS, {
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
});

export function loadSavedPrompts(): SavedPrompt[] {
  return savedPromptsCollection.load();
}

export function persistSavedPrompts(prompts: SavedPrompt[]): void {
  savedPromptsCollection.save(prompts);
}
