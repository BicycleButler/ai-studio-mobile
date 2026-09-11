// Unit tests for storage utilities
import {
  safeGetStorage,
  safeSetStorage,
  loadDraftState,
  saveDraftState,
} from "./storage";

export function testStorage(): boolean {
  // Test safe fallback
  const fallbackVal = { test: 123 };
  const res = safeGetStorage("non_existent_key_xyz", fallbackVal);
  if (res.test !== 123) {
    throw new Error("safeGetStorage did not return fallback value");
  }

  // Test set and get
  safeSetStorage("test_key_abc", { valid: true });
  const fetched = safeGetStorage<{ valid: boolean }>("test_key_abc", { valid: false });
  if (!fetched.valid) {
    throw new Error("safeSetStorage or safeGetStorage failed round-trip");
  }

  // Test draft state initialization
  const draft = loadDraftState();
  if (!draft.config || !draft.promptType) {
    throw new Error("loadDraftState returned invalid draft structure");
  }

  // Test partial draft save
  saveDraftState({ chatInputText: "Sample test prompt" });
  const updatedDraft = loadDraftState();
  if (updatedDraft.chatInputText !== "Sample test prompt") {
    throw new Error("saveDraftState did not update partial draft field");
  }

  return true;
}
