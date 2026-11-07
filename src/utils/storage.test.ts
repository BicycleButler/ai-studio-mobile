import { DefaultLoggerFactory } from "./logger";

import { describe, test, expect } from 'vitest';
import { safeGetStorage, safeSetStorage, createDefaultStorageInstance } from "./storage/core";
import { DraftStateService } from './storage/draftState';

describe('storage', () => {
  test('testStorage', () => {
    // Test safe fallback
    const fallbackVal = { test: 123 };
    const res = safeGetStorage("non_existent_key_xyz", fallbackVal, createDefaultStorageInstance());
    expect(res.test).toBe(123);

    // Test set and get
    const memoryStorage = createDefaultStorageInstance();
    safeSetStorage("test_key_abc", { valid: true }, memoryStorage);
    const fetched = safeGetStorage<{ valid: boolean }>("test_key_abc", { valid: false }, memoryStorage);
    expect(fetched.valid).toBe(true);

    // Test draft state initialization
    const draftStateService = new DraftStateService({ logger: new DefaultLoggerFactory().createLogger() });
    const draft = draftStateService.loadDraftState();
    expect(draft.config).toBeTruthy();
    expect(draft.promptType).toBeTruthy();

    // Test partial draft save
    draftStateService.saveDraftState({ chatInputText: "Sample test prompt" });
    const updatedDraft = draftStateService.loadDraftState();
    expect(updatedDraft.chatInputText).toBe("Sample test prompt");
  });
});
