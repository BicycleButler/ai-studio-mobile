import { DraftStateService } from "./storage/draftState";
import { safeGetStorage, safeSetStorage } from "./storage";

import { describe, test, expect } from 'vitest';

describe('storage', () => {
  test('testStorage', () => {
    // Test safe fallback
    const fallbackVal = { test: 123 };
    const res = safeGetStorage("non_existent_key_xyz", fallbackVal);
    expect(res.test).toBe(123);

    // Test set and get
    safeSetStorage("test_key_abc", { valid: true });
    const fetched = safeGetStorage<{ valid: boolean }>("test_key_abc", { valid: false });
    expect(fetched.valid).toBe(true);

    // Test draft state initialization
    const draftStateService = new DraftStateService();
    const draft = draftStateService.loadDraftState();
    expect(draft.config).toBeTruthy();
    expect(draft.promptType).toBeTruthy();

    // Test partial draft save
    draftStateService.saveDraftState({ chatInputText: "Sample test prompt" });
    const updatedDraft = draftStateService.loadDraftState();
    expect(updatedDraft.chatInputText).toBe("Sample test prompt");
  });
});
