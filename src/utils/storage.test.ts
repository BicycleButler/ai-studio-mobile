// Unit tests for storage utilities
import {
  safeGetStorage,
  safeSetStorage,
  loadDraftState,
  saveDraftState,
} from "./storage";

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
    const draft = loadDraftState();
    expect(draft.config).toBeTruthy();
    expect(draft.promptType).toBeTruthy();

    // Test partial draft save
    saveDraftState({ chatInputText: "Sample test prompt" });
    const updatedDraft = loadDraftState();
    expect(updatedDraft.chatInputText).toBe("Sample test prompt");
  });
});
