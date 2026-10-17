1. **Refactor Singletons to use `StorageSingleton`**:
   - Refactor `speechVoices.ts` to use `StorageSingleton`. (Done)
   - Refactor `themeService.ts` to use `StorageSingleton`. (Done)
   - Refactor `googleAuth.ts` to use `StorageSingleton`. (Done)

2. **Refactor Collections to use `StorageCollection`**:
   - Ensure `chatHistoryService.ts` fully utilizes `StorageCollection`. (Done)
   - Check `useOfflineMutationQueue.ts` to see if `StorageCollection` can be applied. (Done)
   - Refactored `promptTemplateService.ts` clear custom templates logic. (Done)

3. **Verify Refactorings**:
   - Run type checks (`npx tsc`). (Done)
   - Run tests (`npx vitest run`). (Done)
   - Check UI rendering. (Done)

4. **Complete Pre-Commit Steps**
   - Ensure proper testing, verification, review, and reflection are done by calling `pre_commit_instructions`.

5. **Submit changes**
