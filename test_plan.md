1. **Refactor Singletons to use `StorageSingleton`**:
   - Refactor `speechVoices.ts` to use `StorageSingleton`.
   - Refactor `themeService.ts` to use `StorageSingleton`.
   - Refactor `googleAuth.ts` to use `StorageSingleton` (if applicable, caching logic might complicate this).

2. **Refactor Collections to use `StorageCollection`**:
   - Ensure `chatHistoryService.ts` fully utilizes `StorageCollection`.
   - Check `useOfflineMutationQueue.ts` to see if `StorageCollection` can be applied.

3. **Verify Refactorings**:
   - Run type checks (`npx tsc`).
   - Run tests (`npx vitest run`).
   - Check UI rendering (manually via `start_live_preview_instructions` / `frontend_verification_instructions` if applicable, or by test execution).

4. **Complete Pre-Commit Steps**
   - Ensure proper testing, verification, review, and reflection are done by calling `pre_commit_instructions`.

5. **Submit changes**
