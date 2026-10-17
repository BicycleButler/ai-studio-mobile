# Agnostic Improvement Session — Engineering Principles

## Goal
Reliably improve repository code without degrading quality. Follow: abstraction, generality, robustness, reusability.

## Scope
Hardening + deeper abstraction + maintainability + bug fixes. Prioritize abstraction (deeper classes, better interfaces, reduced coupling).

## Execution Plan
1. **Refactor `src/utils/storage.ts` to `src/utils/storage/index.ts`**: The `src/utils/storage.ts` file is extremely large (600+ lines) and is responsible for too many disparate storage entities (Projects, Jules Sessions, Chat History, API Keys, etc.). We will split this up into smaller, modular files inside the `src/utils/storage/` directory and re-export them from `src/utils/storage/index.ts` to maintain the existing API surface. This improves abstraction, readability, and maintainability.
2. **Break down `storage.ts` into specialized managers/modules**:
    - `src/utils/storage/encryption.ts` (encryptSecret, decryptSecret)
    - `src/utils/storage/draftState.ts` (DraftState handling)
    - `src/utils/storage/projects.ts` (Projects handling)
    - `src/utils/storage/jules.ts` (Jules sessions, API key, settings handling)
    - `src/utils/storage/prompts.ts` (Saved prompts handling)
    - `src/utils/storage/general.ts` (API keys, theme, flag secure, etc.)
    - `src/utils/storage/index.ts` (Aggregation and re-exports)
3. **Resolve Circular Dependencies**: We'll make sure there are no circular dependencies. Currently, `src/utils/storage.ts` imports `clearAllChatSessions` from `src/services/chatHistoryService.ts`, which imports `src/utils/storage.ts` back. We'll fix this by putting `clearAllChatSessions` logic in the relevant place or handling project deletion hooks correctly.
4. **Clean up `StorageCollection.ts` and `StorageSingleton.ts`**: Verify they are correctly typed and handle errors robustly.
5. **Run tests to verify no regressions**.
6. **Pre-commit checks & Submit**.
