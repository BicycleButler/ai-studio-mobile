1. **Understand the Architecture & Subsystem**: The system uses a centralized dependency injection approach via `ServiceContext`. This allows for testability and better decoupling, ensuring components/hooks are not tightly coupled to top-level singletons (satisfying the Abstraction and Dependency Inversion principles).
2. **Current Shortcomings**:
    - Several core application hooks (`useUIState`, `useAppAuth`, `useJules`) bypass `ServiceContext` and still import standalone proxy functions directly (e.g. `loadSpeechSettings()`, `loadStoredApiKey()`, `julesSessionsManager`).
    - `julesService.ts` defines a `JulesClient` but doesn't export its default singleton instance (`defaultJulesClient`), keeping it internal, and instead exports many wrapper functions (`dispatchJulesTask`, `verifyJulesApiKey`).
3. **Plan of Action**:
    1. **`useUIState.ts` Refactor**:
        - Import `useServices` and extract `speechVoicesService`.
        - Use `speechVoicesService.loadSpeechSettings()` instead of the standalone `loadSpeechSettings()`.
    2. **`useAppAuth.ts` Refactor**:
        - Import `useServices` and extract `googleAuthService` and `generalSettingsService`.
        - Replace direct proxy imports (`getStoredGoogleUser`, `fetchServerCurrentUser`, `initiateGoogleLogin`, `logoutGoogleUser`, `initAuth`) with `googleAuthService` methods.
        - Replace `loadStoredApiKey` and `saveStoredApiKey` with `generalSettingsService` methods.
    3. **`useJules.ts` Refactor**:
        - Import `useServices` and extract `julesStorageService`.
        - Wait, `JulesClient` isn't in `ServiceContext`. I will export `defaultJulesClient` from `julesService.ts` and add it to `ServiceContext.tsx` as `julesClient`.
        - Use `julesStorageService` for `loadStoredJulesApiKey`, `saveStoredJulesApiKey`, `fetchJulesSessionsFromServer`, and access `julesSessionsManager` via `julesStorageService.julesSessionsManager`.
        - Use `julesClient` (from context) instead of the proxy functions (`dispatchJulesTask`, etc.).
    4. **Ensure pre-commit checks and tests pass**.
