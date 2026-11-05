## Architectural Decision: Storage Serialization Abstraction

**Context:**
`StorageBase` and `StorageAdapter` previously relied on hardcoded `JSON.stringify` and `JSON.parse` logic within `core.ts` for all storage operations. This tight coupling violated the Open/Closed Principle and the Dependency Inversion Principle, making it impossible to support alternative data encodings (e.g., compressed formats, custom binary formats, or secure encrypted wrappers) without modifying the core storage utility functions.

**Path 1: Extract an `ISerializer` Interface (Composition)**
Define an `ISerializer` interface with `serialize` and `deserialize` methods. Implement a `JsonSerializer`. Inject this interface into `StorageBaseOptions`, which delegates it down to the `DefaultStorageAdapter` and the safe helper functions in `core.ts`.

**Path 2: Callback Overrides**
Add `serialize` and `deserialize` function properties directly to `StorageBaseOptions` instead of a formal interface.

**Recommendation:**
**Path 1 (Extract an `ISerializer` Interface)** was implemented. It strictly enforces the Dependency Inversion Principle, aligns with existing interface abstractions (like `ILogger` and `IStorageAdapter`), and deeply improves the Generality and Reusability of the storage engine by allowing any encoding mechanism to be swapped in seamlessly.

## Architectural Decision: Delay Strategy Configuration Abstraction

**Context:**
`ExponentialBackoffRetryStrategy` previously checked if its injected strategy was an `ExponentialBackoffDelayStrategy` in order to dynamically inject the `baseDelayMs` parameter from `RetryConfig`. This violated the Open/Closed Principle and the Dependency Inversion Principle, as the generic retry orchestrator became tightly coupled to a specific delay implementation, and consumers' custom strategies would be ignored or clobbered.

**Path 1: Strict Injection (Remove from Config)**
Remove `baseDelayMs` from `RetryConfig`. The orchestrator only accepts an `IRetryStrategy` (which itself encapsulates an `IDelayStrategy`). Consumers are responsible for configuring their delay strategy when instantiating it, preserving perfect abstraction.

**Path 2: Configuration Mutator Pattern**
Add a `withBaseDelay(delay: number): IDelayStrategy` method to the `IDelayStrategy` interface. The retry orchestrator uses this to clone the strategy with the new configuration.

**Recommendation:**
**Path 1 (Strict Injection)** is the recommended path. It removes conflicting sources of truth (`RetryConfig` vs `IDelayStrategy` constructor) and ensures the orchestrator purely delegates to the injected strategy without needing to understand its configuration semantics.

## Architectural Decision: TunerBottomSheet Component Abstraction

**Context:**
`TunerBottomSheet` was rendering identical, complex configuration panels inline within an `if (isModal)` block for the Drawer view, and a separate block for the embedded view (inside `UnifiedSettingsModal`). This violated the DRY principle, made the component overly long (>600 lines), and tangled the Drawer container logic with the deeply nested configuration form.

**Decision:**
Extracted the entire `bodyFields` logic and form state into a dedicated `TunerConfigPanel` component. `TunerBottomSheet` now acts purely as the Drawer container (for the standalone workspace view), while `TunerConfigPanel` is composed inside both `TunerBottomSheet` and `UnifiedSettingsModal`. This adheres to the Single Responsibility Principle, greatly improves Reusability, and significantly cleans up the main modal files.

## Architectural Decision: Storage Abstraction

**Context:**
`StorageSingleton` and `StorageCollection` both duplicate the core logic for loading, validating, transforming, caching (with `deepFreeze`), and saving data to `localStorage`. `StorageCollection` currently implements this by mapping over arrays manually within its overridden `load` method.

**Path 1: Consolidate in `StorageBase<T>` (Inheritance/Template Method)**
Promote the `load()`, `save()`, and caching pipeline up to `StorageBase<T>`. `StorageSingleton<T>` becomes a very thin subclass. `StorageCollection<T>` extends `StorageBase<T[]>` and translates its item-level `validate` and `transform` functions into array-level functions that it passes to `super()`.

**Path 2: Extract to `StorageEngine<T>` (Composition)**
Remove `StorageBase`. Create a standalone `StorageEngine<T>` class. `StorageSingleton` and `StorageCollection` compose this engine internally and expose their own APIs.

**Recommendation:**
**Path 1 (Hybrid Inheritance)** is the recommended path. It preserves the existing `Observable` inheritance chain and the `is-a` relationship that consumers might rely on, while eliminating all duplicated pipeline logic. It deeply improves abstraction and maintainability without breaking the public interface.

## Architectural Decision: Storage Caching Strategy

**Context:**
`StorageBase<T>` previously handled saves by serializing the item, writing to `localStorage`, and immediately invalidating its cache to call `this.load()`. `this.load()` performs a synchronous I/O round-trip (reading the string, parsing JSON, validating, and freezing). For large collections, this synchronous loop caused UI thread blocking and degraded performance.

**Decision:**
Implemented an **In-Memory Write-Through Pipeline**. Instead of re-fetching from storage, `StorageBase<T>` updates its `cachedSnapshot` directly by running the saved payload through the memory pipeline (`processRawValue`). This eliminates `getItem` and `JSON.parse` overhead while maintaining immutability via `deepFreeze`, deeply improving performance and robustness without altering the public interface.

## Architectural Decision: ActiveItemManager Side-Effect Propagation

**Context:**
`ActiveItemManager` originally coupled state derivation with side effects by subscribing to itself to trigger `onActiveItemChange`. This was an anti-pattern creating implicit reactivity loops and violating strict unidirectional data flow.

**Decision:**
Implemented **Event-Driven Dispatch** by overriding the `notify()` pipeline to fire change events securely and synchronously when the state is actively mutated, effectively removing the self-subscription anti-pattern and enforcing top-down side-effect execution.

## Architectural Decision: ActiveItemManager Dangling Reference Resolution

**Context:**
`ActiveItemManager` used an anti-pattern: it manually subscribed to its own dependency (`collection`) to trigger a state-mutating side-effect (`activeIdSingleton.save()`) whenever the underlying collection deleted the currently active item. This created an implicit, cascading reactivity loop that triggered double-computations and violated unidirectional data flow.

**Path 1: Command-Driven Resolution**
Wrap `collection`'s deletion methods inside `ActiveItemManager` so that it explicitly updates both the collection and the singleton in a single transactional step. (Drawback: Adds boilerplate to proxy all collection mutations, violating separation of concerns).

**Path 2: Pure Derivation (Read-Time Resolution)**
Remove the side-effect entirely. Let the `activeIdSingleton` hold a potentially dangling reference if the item is deleted from the collection. Update `ActiveItemManager`'s getter methods to derive the *true* active ID dynamically from the resolved `activeItem` (which already implements implicit fallback logic). The dangling reference is harmless and is cleanly overwritten on the next explicit user selection.

**Recommendation:**
**Path 2 (Pure Derivation)** is the implemented path. It eliminates the reactivity loop and side-effect, makes the computed store purely derived, and simplifies the codebase while correctly preserving UI fallback behavior.

## Architectural Decision: ComputedStore Batching

**Context:**
`ComputedStore` currently triggers a synchronous `recompute()` every time one of its dependency stores fires a change event. If multiple dependencies are updated sequentially in the same tick (e.g., a batch operation), the derived store evaluates its computation and notifies its listeners multiple times. This redundant computation harms performance and can broadcast intermediate (or inconsistent) derived states to UI subscribers.

**Path 1: Explicit Transactions**
Provide a `batch(() => void)` function that pauses all notifications across all observables and flushes them when the transaction completes. (Drawback: requires widespread consumer changes).

**Path 2: Dirty-Marking with Deferred Evaluation (Microtask)**
When a dependency changes, set a `isDirty` flag and schedule a notification flush via `queueMicrotask`. When `getSnapshot()` is called, if `isDirty` is true, recompute synchronously. This preserves synchronous reads while batching notifications, providing optimal performance and consistency without consumer changes.

**Recommendation:**
**Path 2 (Dirty-Marking with Deferred Evaluation)** is the recommended path. It completely encapsulates the optimization within `ComputedStore`, drastically reducing unnecessary computations and renders, while maintaining accurate state derivation for immediate readers.

## Architectural Decision: Offline Queue Strict FIFO

**Context:**
The `processOfflineMutations` pipeline was designed to handle temporary network partitions. Initially, if a single mutation failed to sync with the server, the pipeline logged the error and continued attempting to process subsequent mutations in the queue.

**Decision:**
Implemented **Strict FIFO Halting**. We updated `processOfflineMutations` to immediately halt execution and abort the sync loop upon the *first* failure. This preserves strict causal consistency (e.g., preventing a "delete" from being synced before its preceding "create"). The queue is frozen in its current state, ensuring data integrity is maintained until connectivity is restored and the sync can resume from the exact point of failure.

## Architectural Decision: Storage Quota Recovery

**Context:**
`FallbackStorageWrapper` handles `QuotaExceededError` by immediately downgrading the entire storage engine to an ephemeral `MemoryStorage`. While this prevents unhandled exception crashes, it silently drops all subsequent user data for the session because persistent storage is abandoned without attempting to free space.

**Path 1: LRU Key Eviction inside Wrapper**
Make `FallbackStorageWrapper` track LRU access and automatically delete the oldest keys until the new write succeeds. (Drawback: The wrapper lacks domain context and might delete a critical piece of state (like an API key) instead of bulky cache).

**Path 2: Event-Driven Domain Eviction**
When `QuotaExceededError` occurs, `FallbackStorageWrapper` dispatches a synchronous `storage_quota_exceeded` event on the window. Domain services (like `ChatHistoryService`) listen to this event and synchronously purge their own non-critical bulky data (e.g., trimming history to top 10). The wrapper then retries the write. If it still fails, it falls back to memory.

**Recommendation:**
**Path 2 (Event-Driven Domain Eviction)** is the recommended path. It preserves the abstraction boundary of `FallbackStorageWrapper` (it knows nothing about chat history) while allowing the application to intelligently prioritize data retention (Robustness & Generality).

## Architectural Decision: Polling Orchestration & Strategy Abstraction

**Context:**
The generic `startPolling` utility in `src/utils/polling.ts` historically relied on a hardcoded, fixed `intervalMs` parameter. As the application integrates with variable-duration backend tasks (e.g., `julesService.ts`), fixed interval polling introduces inefficiencies: it either polls too aggressively during long operations or recovers poorly from temporary network errors without a backoff mechanism.

**Path 1: Built-in Polling Backoff**
Extend the `PollingOptions` interface to include backoff limits and retry multipliers, embedding the backoff logic directly inside the `runPoll` orchestrator. (Drawback: Bloats the orchestrator function and violates the Open/Closed Principle if new adaptive polling heuristics are needed later).

**Path 2: Injectable Polling Strategy (Composition)**
Extract the delay logic into an `IPollingStrategy` interface that computes the next delay dynamically based on the attempt count and any caught errors. Provide generic implementations like `FixedIntervalPollingStrategy` and `ExponentialBackoffPollingStrategy`. Update `startPolling` to accept a strategy, defaulting to fixed-interval for backwards compatibility.

**Recommendation:**
**Path 2 (Injectable Polling Strategy)** is the recommended path. It strictly decouples the orchestration of the poll (abort signals, error routing, completion checks) from the timing heuristics. This enhances Generality (strategies can be swapped per domain) and Robustness (exponential backoff handles degraded network states gracefully) without forcing consumers to rewrite the polling loop.

## Architectural Decision: Collection Engine Abstraction

**Context:**
`StorageCollection` currently had a hardcoded, internal dependency on `ArrayCollection`. This violated the Dependency Inversion Principle, tightly coupling the storage lifecycle (saving/loading) to a single array-based memory implementation.

**Path 1: Extract `ICollectionEngine<T>` Interface (Composition)**
Define an `ICollectionEngine<T>` interface and make `ArrayCollection` implement it. Update `StorageCollectionOptions` to accept an optional `engine: ICollectionEngine<T>`, defaulting to `ArrayCollection` if none is provided.

**Path 2: Template Method / Abstract Class (Inheritance)**
Make `StorageCollection` an abstract class with abstract methods for `update`, `upsert`, etc., and create an `ArrayStorageCollection` subclass.

**Recommendation:**
**Path 1 (Extract Interface & Composition)** was implemented. It enhances abstraction and reusability without breaking the existing `StorageCollection` public API or requiring widespread refactoring of consumers.

## Architectural Decision: Backoff Delay Strategy Abstraction

**Context:**
Currently, `apiClientRetry.ts` and `polling.ts` both implemented their own math for calculating exponential backoff and jitter. This duplicated the core logic of calculating delay intervals, leading to inconsistent backoff behaviors across the app (Generality & Reusability).

**Path 1: Consolidate into a standalone `IDelayStrategy` (Composition)**
Extract the `IPollingStrategy` math from `polling.ts` into a generalized `IDelayStrategy` in a new file (`delayStrategy.ts`). Both the polling orchestrator and the API retry orchestrator will compose this delay strategy to compute wait times.

**Path 2: Unify `IRetryStrategy` and `IPollingStrategy` entirely**
Attempt to merge the orchestrators. (Drawback: Polling involves checking for completion states and continuing until success/abort, while retries involve repeating the same request until success/max-retries. They are fundamentally different control flows).

**Recommendation:**
**Path 1 (Consolidate Delay Strategy)** was implemented. It abstracts the mathematical delay calculations (Fixed, Exponential, Jitter) into reusable strategies without tangling the distinct control flows of Polling vs. Retrying.

## Architectural Decision: Jules Service Singleton Encapsulation

**Context:**
The `src/services/julesService.ts` module exported numerous standalone functions (`verifyJulesApiKey`, `createJulesTask`, etc.) that implicitly bound to a module-level variable `defaultJulesClient`. `JulesClient` itself was an anemic object that simply stored configuration, while the core API fetch logic existed globally inside the standalone function closures. This violated the Abstraction and Decoupling principles, making it difficult to instantiate multiple disparate `JulesClient` instances or inject them into components for robust testing without mocking globals.

**Path 1: Refactor to Full Instance Methods on \`JulesClient\`**
Move all execution logic (API calls, polling, validation) inside the `JulesClient` class itself. Exported proxy functions can remain for backward compatibility, but they simply invoke the methods on a default `JulesClient` instance.

**Path 2: Pure Functional Architecture**
Remove `JulesClient` entirely and change every standalone function to explicitly accept `JulesServiceConfig` (or the API Key and settings) as mandatory parameters, eliminating the singleton.

**Recommendation:**
**Path 1 (Instance Methods on JulesClient)** was implemented. This solidifies `JulesClient` as a robust, fully-encapsulated class handling Jules orchestration, preserving the existing component API (via wrapper proxies) while resolving the tight module-level variable coupling. It greatly enhances Reusability (a new client can be trivially minted) and Generality.

## Architectural Decision: Sync Engine Decoupling

**Context:**
The offline synchronization pipeline (`processOfflineMutations`) historically relied on sync handlers explicitly hardcoding `apiFetch` calls and networking logic. Furthermore, persistence components like `julesSessionsCollection` had networking logic intertwined with storage (`onSave` hooks triggering raw `fetch` and online/offline checks). This violated the Single Responsibility Principle and made unit testing persistence operations impossible without network mocking.

**Path 1: Extract Adapters & Orchestrator Classes (Composition)**
Extract the responsibility of checking connectivity and deciding between `apiFetch` and `enqueueOfflineMutation` into an `IStorageSyncAdapter<T>`. Decouple the registration of the mutations out of global closures into a `SyncOrchestrator` that is initialized with an injected offline queue and API client.

**Path 2: Event-Driven Pub/Sub**
Have the collections emit completely generic domain events (`jules_sessions_updated`), and rely on a decoupled background saga to listen to these and decide what goes to the network or the offline queue. (Drawback: Decouples control flow too far, making debugging causality harder when syncs fail).

**Recommendation:**
**Path 1 (Extract Adapters & Orchestrator Classes via Composition)** was implemented. It strictly separates the persistence logic (Storage Collection) from the synchronization logic (Sync Adapter), and isolates the mapping of offline syncs to API handlers into a testable orchestrator object.

## Architectural Decision: Auth Provider Decoupling

**Context:**
`src/services/googleAuth.ts` was tightly coupled to Firebase Authentication, importing `firebase/auth` and directly invoking `signInWithPopup` and `onAuthStateChanged`. This violated the Dependency Inversion Principle, making it difficult to swap Firebase for another auth provider (e.g., standard OAuth or Auth0) or to mock authentication in tests without mocking the entire `firebase/auth` module.

**Path 1: Extract an `IAuthProvider` Interface (Composition)**
Create an `IAuthProvider` interface with methods like `signIn()`, `signOut()`, and `onAuthStateChanged()`. Implement a `FirebaseAuthProvider` that implements this interface. Inject the provider into the auth service.

**Path 2: Event-Driven Auth Orchestration**
Decouple the auth UI from Firebase by firing generic window events (`AUTH_REQUESTED`, `AUTH_SIGNOUT`). An independent Firebase module listens to these events and performs the actions.

**Recommendation:**
**Path 1 (Extract `IAuthProvider` Interface)** was implemented. It explicitly defines the authentication contract required by the application, allows seamless substitution of the auth mechanism, and adheres to strict dependency inversion without relying on global event buses.

## Architectural Decision: Observable Notification Batching

**Context:**
`Observable<T>` previously notified all subscribers synchronously upon state changes. If multiple state updates occurred rapidly in a single event loop tick (e.g. sequentially updating an item and its active state), subscribers (such as React components via `useSyncExternalStore`) would execute multiple times synchronously.

**Path 1: Sync Batching Utility**
Create a `batch(() => void)` function that defers notifications globally until the lambda finishes. (Drawback: Needs consumer opt-in).

**Path 2: Microtask Notification Batching inside Observable**
Modify the base `Observable`'s `notify` to schedule a single microtask that flushes the latest snapshot to listeners. This completely absorbs synchronous thrashing with zero changes to consumers.

**Recommendation:**
**Path 2 (Microtask Batching)** is the recommended path. It strictly reduces render thrashing and enhances robustness and abstraction, natively complementing `ComputedStore`'s deferred dependency evaluation.

## Architectural Decision: StorageBase Event Observer Injection

**Context:**
`StorageBase` was tightly coupled to `globalStorageEventObservable` for listening to storage events across tabs. This tight coupling made testing and swapping event sources difficult, violating the Dependency Inversion Principle.

**Path 1: Injecting `storageEventObservable` via Options**
Modify `StorageBaseOptions` to accept an optional `storageEventObservable` of type `IObservable<StorageEvent>`. `StorageBase` utilizes the provided observable if it exists; otherwise, it defaults to the `globalStorageEventObservable`.

**Path 2: Event Listener Abstraction**
Abstract the storage event listener mechanism entirely using an interface like `IStorageEventListener` that the storage engine composes.

**Recommendation:**
**Path 1 (Injecting `storageEventObservable`)** is the recommended path. It aligns with existing generic dependency injections (e.g., adapters) and resolves the tight coupling issue simply and effectively, keeping the constructor flexible and easy to test.

## Architectural Decision: ApiClient Interceptor Manager Injection

**Context:**
`ApiClient` directly instantiated and managed `InterceptorManager`, tightly coupling itself to a specific implementation of interceptor handling. This violated the Dependency Inversion Principle and hindered extensibility or testing with mock interceptor managers.

**Path 1: Refactoring to use `IInterceptorManager` interface**
Define an `IInterceptorManager` interface. Allow `ApiClient` to accept an `interceptorManager` during construction through a configuration object (`ApiClientConfig`). Use the provided instance or default to a new `InterceptorManager`.

**Path 2: Passing Interceptors as Array in Config**
Allow injecting an array of interceptor functions directly into the `ApiClient` constructor and manage them internally.

**Recommendation:**
**Path 1 (Refactoring to use `IInterceptorManager`)** is the recommended path. It properly separates the responsibility of managing interceptors from `ApiClient` and relies on composition via interfaces, enabling developers to supply fully custom interceptor execution strategies.

## Architectural Decision: PromptTemplateService Collection Injection

**Context:**
`PromptTemplateService` internally instantiated a `StorageCollection` bound to a specific storage key for custom templates. This violated the Open/Closed Principle and Dependency Inversion, making it hard to substitute an in-memory collection for tests or a remote collection engine.

**Path 1: Inject `IMutableCollection<PromptTemplate>`**
Expose a configuration interface `PromptTemplateServiceConfig` with an optional `customTemplatesCollection` dependency. If omitted, default to the standard `StorageCollection`.

**Path 2: Make `PromptTemplateService` an Abstract Class**
Use the Template Method pattern, abstracting how custom templates are loaded and saved, implementing a `StoragePromptTemplateService`.

**Recommendation:**
**Path 1 (Inject `IMutableCollection`)** is the recommended path. It perfectly satisfies abstraction using composition without forcing deep hierarchy changes. It ensures `PromptTemplateService` relies only on the collection interface.

## Architectural Decision: Environment-Agnostic Sync Adapter Fallback

**Context:**
The `NetworkStorageSyncAdapter` previously hardcoded `isBrowserEnvironment` and `navigator.onLine` checks directly into the `syncItem` method. This violated the Dependency Inversion Principle, making it impossible to accurately test the adapter's behavior when simulating online/offline states without mocking globals, and meaning mutations would silently fail or drop in non-browser environments where `navigator` does not exist.

**Path 1: Network Status Provider Abstraction (Composition)**
Introduce an `INetworkStatusProvider` interface with an `isOnline()` method. Implement `BrowserNetworkStatusProvider` to encapsulate the global browser checks. Inject this provider into the `NetworkStorageSyncAdapter` via constructor injection, falling back to the browser implementation by default.

**Path 2: Assume Online if Not Browser**
Simply update the existing logic to assume `isOnline = true` if `isBrowserEnvironment` is false, and keep the hardcoded logic. (Drawback: Does not fix the testability issue with mocking globals).

**Recommendation:**
**Path 1 (Network Status Provider Abstraction)** was implemented. It strictly decouples the adapter from the DOM, makes unit testing trivial and deterministic without mocking globals, and improves robustness in varying runtime environments.

## Architectural Decision: Event-Driven Network Status Provider Abstraction

**Context:**
While the `INetworkStatusProvider` interface successfully abstracted the `isOnline()` check, the `useNetworkStatus` hook remained tightly coupled to the DOM via hardcoded `safeAddEventListener` calls and a hardcoded `networkStatusObservable`. This violated the Open/Closed Principle and the Dependency Inversion Principle, making it difficult to inject custom network status detection mechanisms (e.g., Cordova plugins, WebSocket pings, or test mocks) that require reactive updates.

**Path 1: Event-Driven Network Status Provider Abstraction (Composition)**
Extend the `INetworkStatusProvider` interface to include a `getObservable(): Observable<NetworkStatus>` method. Update `BrowserNetworkStatusProvider` to encapsulate both the synchronous DOM checks and the reactive DOM event listeners (`online`/`offline`). The `useNetworkStatus` hook then simply consumes the observable provided by an injected `INetworkStatusProvider`.

**Path 2: Callback Registration inside Provider**
Extend the `INetworkStatusProvider` with `onStatusChange(callback: (status: NetworkStatus) => void): () => void`. Update the hook to use `useSyncExternalStore` directly with this callback.

**Recommendation:**
**Path 1 (Event-Driven Network Status Provider Abstraction)** was implemented. It perfectly unifies the synchronous and reactive network status APIs into a single cohesive provider, adheres strictly to the existing `Observable` patterns used throughout the codebase, and fully decouples the React layer from DOM networking events.

## Architectural Decision: Offline Queue Enqueue Strategy

**Context:**
`NetworkStorageSyncAdapter` previously blindly caught all errors from `apiClient.fetch` and enqueued the mutation into the offline queue. If the API returned a 4xx client error (e.g., 400 Bad Request due to validation failure), the mutation was queued anyway. The offline sync loop would repeatedly attempt to sync the invalid mutation and constantly halt (Strict FIFO Halting), poisoning the queue indefinitely and blocking valid syncs.

**Path 1: Status Code Inspection (Robustness)**
Update `NetworkStorageSyncAdapter` to inspect the error. If it's a `BaseApiError`, check the status code. Only enqueue the mutation if the error is a network error (status 0) or a retryable server error (e.g., 5xx, 408, 429). If it's a non-retryable client error, drop the sync to prevent queue poisoning.

**Path 2: Generic Retry Strategy Interface (Composition)**
Instead of hardcoding status code checks in the adapter, define an `IOfflineRetryStrategy` with a `shouldEnqueue(error)` method. Inject this strategy into `NetworkStorageSyncAdapter`, allowing consumers to define exactly what constitutes a queueable failure for their domain.

**Recommendation:**
**Path 2 (Generic Retry Strategy Interface)** was implemented. We provide a `DefaultOfflineRetryStrategy` that evaluates `BaseApiError` status codes (retrying 0, 5xx, 429, 408), satisfying Path 1 while strictly preserving abstraction and dependency inversion. This greatly improves robustness by preventing bad data from halting the sync engine permanently.

## Architectural Decision: Stubs Service Singleton Encapsulation

**Context:**
The `src/services/stubsService.ts` module exported numerous standalone functions (`fetchGraphData`, `executeStubsCommand`, etc.) that implicitly bound to the global `apiFetch` and `defaultClient`. This violated the Dependency Inversion Principle, making it difficult to instantiate disparate `StubsClient` instances, inject customized API clients, or properly mock the service for robust testing without mocking globals.

**Path 1: Refactor to Full Instance Methods on \`StubsClient\`**
Move all execution logic (API calls) inside a `StubsClient` class that receives an `IApiClient` via constructor injection. Exported proxy functions can remain for backward compatibility, but they simply invoke the methods on a default `StubsClient` instance.

**Path 2: Pure Functional Architecture**
Remove `StubsClient` entirely and change every standalone function to explicitly accept an `IApiClient` instance as a mandatory parameter, eliminating the singleton context entirely.

**Recommendation:**
**Path 1 (Instance Methods on StubsClient)** was implemented. This solidifies `StubsClient` as a robust, fully-encapsulated class handling Stubs API orchestration, matching the established pattern for `JulesClient`. It completely preserves the existing React component API (via wrapper proxies) while resolving the tight module-level variable coupling. It greatly enhances Reusability and Generality, and makes writing unit tests trivial.

## Architectural Decision: TunerBottomSheet Component Abstraction

**Context:**
`TunerBottomSheet` was rendering identical, complex configuration panels inline within an `if (isModal)` block for the Drawer view, and a separate block for the embedded view (inside `UnifiedSettingsModal`). This violated the DRY principle, made the component overly long (>600 lines), and tangled the Drawer container logic with the deeply nested configuration form.

**Decision:**
Extracted the entire `bodyFields` logic and form state into a dedicated `TunerConfigPanel` component. `TunerBottomSheet` now acts purely as the Drawer container (for the standalone workspace view), while `TunerConfigPanel` is composed inside both `TunerBottomSheet` and `UnifiedSettingsModal`. This adheres to the Single Responsibility Principle, greatly improves Reusability, and significantly cleans up the main modal files.

## Architectural Decision: StubsWorkspaceProps Abstraction

**Context:**
`StubsWorkspace` did not inherit `SharedWorkspaceProps` like the other workspaces (`ChatWorkspace`, `MobileIDEWorkspace`, `JulesWorkspace`) in the `WorkspaceRouter`. This inconsistency forced the router to handle `StubsWorkspace` uniquely, passing empty or incomplete props instead of the full shared configuration, and limiting the Stubs feature's ability to access standard context like `hasApiKey` or `config`.

**Decision:**
Updated `StubsWorkspaceProps` to extend `Partial<SharedWorkspaceProps>` and modified `WorkspaceRouter` to inject `...sharedProps` into `StubsWorkspace` using the same `Omit<..., keyof SharedWorkspaceProps>` pattern as the other workspaces. This enhances Generality and Abstraction by strictly unifying the workspace component contracts.

## Architectural Decision: SettingsSidebar Active Tab Routing Abstraction

**Context:**
The `SettingsSidebar` previously rendered its tabs using repetitive, hardcoded JSX button elements for each settings tab (e.g., account, display, security, model). The `activeTab` checking, icons, and labels were all duplicated, making adding or removing settings tabs a manual process prone to error and violating the DRY and Open/Closed principles.

**Path 1: Extract Array Configuration and Map Components**
Define an array of configurations (`SETTINGS_TABS_CONFIG`) containing id, label, icon, and optional boolean flags. The `SettingsSidebar` iterates over this array to dynamically construct the tabs. Adding a tab only requires updating the data structure.

**Path 2: Injectable Tab Components via Provider**
Use a React Context provider or dependency injection system to allow different parts of the application to dynamically register settings tabs.

**Recommendation:**
**Path 1 (Extract Array Configuration)** was implemented. It perfectly solves the boilerplate problem by abstracting the routing logic into data without over-engineering an injection system. It adheres to the Open/Closed Principle and dramatically improves maintainability and reusability of the UI component logic.

## Architectural Decision: Logger Abstraction

**Context:**
Many low-level utility services (such as `NetworkStorageSyncAdapter` and `OfflineService`) rely on hardcoded `console.error` and `console.warn` calls to report critical failures. This tight coupling violated the Dependency Inversion Principle, caused test output spew, and made it impossible to easily redirect error reporting (e.g., to an external telemetry service or custom UI toast notification) without global monkey-patching.

**Path 1: Logger Interface Injection (Composition)**
Define an `ILogger` interface with standard log levels (`debug`, `info`, `warn`, `error`). Implement standard providers like `ConsoleLogger` and `NoOpLogger`. Pass the `ILogger` implementation as a dependency into the constructors of utility classes like `NetworkStorageSyncAdapter` and `OfflineService`.

**Path 2: Singleton Event Emitter**
Create a global `LogEmitter` singleton that emits log events, and have the utilities dispatch events to it.

**Recommendation:**
**Path 1 (Logger Interface Injection)** is implemented. This properly conforms to Dependency Inversion, allows targeted log overriding per component, and completely resolves console spew in unit tests by substituting the `NoOpLogger`. It provides a clean, extensible architectural foundation for telemetry.

## Architectural Decision: Speech Voices Service Singleton Encapsulation

**Context:**
The `src/services/speechVoices.ts` module exported numerous standalone functions (`fetchTTSAudioUrl`, `loadSpeechSettings`, etc.) that implicitly bound to a module-level variable `speechSettingsSingleton`. This violated the Abstraction and Decoupling principles, making it difficult to instantiate multiple disparate instances or inject them into components for robust testing without mocking globals.

**Path 1: Refactor to Full Instance Methods on \`SpeechVoicesService\`**
Move all execution logic (fetching TTS URL, loading/saving settings, querying system voices) inside the `SpeechVoicesService` class itself. Exported proxy functions can remain for backward compatibility, but they simply invoke the methods on a default `SpeechVoicesService` instance.

**Path 2: Pure Functional Architecture**
Remove the singleton completely and change every standalone function to explicitly accept `speechSettingsSingleton` or configuration as mandatory parameters.

**Recommendation:**
**Path 1 (Instance Methods on SpeechVoicesService)** was implemented. This solidifies `SpeechVoicesService` as a robust, fully-encapsulated class handling speech orchestration, preserving the existing component API (via wrapper proxies) while resolving the tight module-level variable coupling. It seamlessly matches the pattern established for `JulesClient` and `StubsClient`.

## Architectural Decision: Storage Helpers Type Safety (deepFreeze)

**Context:**
The `deepFreeze` function in `src/utils/storage/helpers.ts` heavily relied on `any` and `eslint-disable` rules to bypass type checking during object cloning and freezing. This reduced robustness and type safety, especially when dealing with complex nested state graphs that required absolute immutability guarantees.

**Path 1: Strong TypeScript Utility Types**
Refactor `deepFreeze` using `unknown`, `Record<string, unknown>`, and `never` assertions to satisfy the TypeScript compiler without relying on `any`. This maintains exact runtime behavior but rigorously enforces compile-time type boundaries.

**Path 2: External Library Usage**
Import a robust, heavily tested deep-freeze utility from a library like `immer` or `lodash`. (Drawback: Adds bundle weight and an external dependency for a single isolated utility).

**Recommendation:**
**Path 1 (Strong TypeScript Utility Types)** is the recommended path. It removes all `eslint-disable` pragmas and `any` types from the function, boosting code robustness without increasing bundle size or introducing new dependencies.

## Architectural Decision: Settings Modal State Decoupling

**Context:**
`UnifiedSettingsModal.tsx` historically hosted state for audio configuration (e.g. `deviceVoices`, `isPreviewLoading`) even though the corresponding preview feature was partially disabled or unused, leading to `eslint-disable @typescript-eslint/no-unused-vars` workarounds. This violated the Single Responsibility Principle and cluttered the settings routing container.

**Path 1: Remove Dead State & Disable Pragmas**
Scrub all unused audio preview state (`deviceVoices`, `isPreviewLoading`, `previewError`) and their associated `useEffect` logic directly from the component.

**Path 2: Extract to `useSpeechSettings` Hook**
Move all speech and audio related state and side effects into a custom hook, cleanly separating domain logic from UI presentation.

**Recommendation:**
**Path 1 (Remove Dead State)** was implemented. Given that the audio preview function was inactive, maintaining the dead state in any location created debt. Removing it resolves the linting bypasses and adheres strictly to the YAGNI principle.

## Architectural Decision: Draft State Service Singleton Encapsulation

**Context:**
The `src/utils/storage/draftState.ts` module exported numerous standalone functions (`loadDraftState`, `saveDraftState`, etc.) that implicitly bound to a module-level variable `draftRegistry`. This violated the Abstraction and Decoupling principles, making it difficult to instantiate multiple disparate instances or inject them into components for robust testing without mocking globals.

**Path 1: Refactor to Full Instance Methods on \`DraftStateService\`**
Move all execution logic inside the `DraftStateService` class itself. Exported proxy functions can remain for backward compatibility, but they simply invoke the methods on a default `DraftStateService` instance.

**Path 2: Pure Functional Architecture**
Remove the registry entirely and require `draftRegistry` to be passed to every function.

**Recommendation:**
**Path 1 (Instance Methods on DraftStateService)** is the recommended path. It solidifies Draft State management as a robust, fully-encapsulated class, matching the pattern established for `JulesClient`, `StubsClient`, and `ChatHistoryService`.

## Architectural Decision: Storage Subsystem Singleton Encapsulation

**Context:**
Modules within `src/utils/storage/` (such as `general.ts`, `projects.ts`, `prompts.ts`, and `jules.ts`) historically exported numerous standalone functions that implicitly bound to module-level singleton variables (like `apiKeySingleton`, `flagSecureSingleton`, `projectsManager`, `savedPromptsManager`, etc.). This violated the Abstraction and Dependency Inversion principles, making it impossible to instantiate multiple disparate instances, inject mocked dependencies for unit testing, or properly substitute underlying storage adapters without polluting the global module scope.

**Path 1: Refactor to Full Instance Methods on Dedicated Storage Services**
Move all execution logic into strictly encapsulated classes (e.g., `GeneralSettingsService`, `ProjectService`, `SavedPromptsService`, `JulesStorageService`). These classes manage their own local state and accept configuration/dependencies via their constructors. Exported proxy functions can remain for backward compatibility, but they simply invoke the methods on a default, lazy-initialized service instance.

**Path 2: Pure Functional Architecture with Parameter Drilling**
Remove the singletons entirely and require consumers to pass the required state registry/manager explicitly to every single utility function call.

**Recommendation:**
**Path 1 (Instance Methods on Dedicated Storage Services)** was implemented. This solidifies the storage subsystem into robust, fully-encapsulated classes, maintaining parity with the domain service patterns established by `JulesClient` and `StubsClient`. It preserves the existing React component APIs and functional exports via wrapper proxies while resolving the tight module-level variable coupling. This greatly enhances Reusability and Generality across the entire storage layer.

## Architectural Decision: Offline/Sync React Hooks Abstraction

**Context:**
The `useOfflineQueue` and `useOfflineSync` hooks directly imported and used the singleton `defaultOfflineService` and its standalone wrapper functions (`getOfflineQueueLength`, etc.) or its exposed `queueObservable`. This violated the Dependency Inversion Principle, tightly coupled the React UI layer to the concrete implementation of the offline service singleton, and hindered testing and reusability (Generality).

**Path 1: Service Provider Context (React Context)**
Wrap the app in an `OfflineServiceProvider` and use `useContext(OfflineServiceContext)` inside the hooks to resolve the service dynamically.

**Path 2: Dependency Injection via Hook Arguments (Composition)**
Modify `useOfflineQueue` and `useOfflineSync` to accept an `IOfflineService` instance as an optional parameter, defaulting to the `defaultOfflineService` if none is provided.

**Recommendation:**
**Path 2 (Dependency Injection via Hook Arguments)** was implemented. It perfectly matches the abstraction pattern established in `useNetworkStatus` (which accepts `INetworkStatusProvider`). It immediately improves testability and abstraction without requiring widespread React Context boilerplate or fundamentally altering consumer code.

## Architectural Decision: NetworkStorageSyncAdapter Payload Abstraction

**Context:**
`NetworkStorageSyncAdapter` tightly coupled the `syncItem` logic to generic `POST` and `PUT` requests using a strictly JSON stringified body and the `application/json` content-type header. This violated the Open/Closed Principle and Generality, meaning if a domain service needed to sync offline mutations using FormData (e.g. file uploads) or URL encoding, it couldn't reuse the standard network storage sync pipeline.

**Path 1: Request Builder Injection via Configuration Object (Composition)**
Refactor the adapter's constructor to accept a `NetworkStorageSyncAdapterConfig` object while maintaining backward compatibility with the legacy constructor signature. Allow consumers to provide an optional `requestBuilder: (item: T, method: string) => RequestInit` function. If omitted, default to the existing JSON stringification behavior.

**Path 2: Subclassing the Adapter per Content-Type (Inheritance)**
Make `NetworkStorageSyncAdapter` an abstract class with an abstract `buildRequest` method and implement subclasses like `JsonStorageSyncAdapter` and `FormDataStorageSyncAdapter`. (Drawback: Adds class bloat and doesn't accommodate custom headers easily).

**Recommendation:**
**Path 1 (Request Builder Injection)** was implemented. It strictly decouples the adapter from the DOM fetch API payload structure, preserves all backward compatibility for existing domain services, and improves the Generality of the sync engine, allowing any payload transformation. A new `FormDataSyncTransport` class was added to abstract out multi-part serialization, fulfilling the goal of isolating serialization logic entirely.

## Architectural Decision: Gemini Stream Service Singleton Encapsulation

**Context:**
The `src/services/geminiStreamService.ts` module exported standalone functions (`fetchGenerateContent`, `streamGeminiContent`) that were implicitly bound to the global `apiFetch` and `apiFetchStream` instances. This violated the Abstraction and Decoupling principles, making it impossible to instantiate multiple disparate instances or inject them into components for robust testing without mocking globals.

**Path 1: Refactor to Full Instance Methods on \`GeminiStreamService\`**
Move all execution logic inside the `GeminiStreamService` class itself, passing `fetchFn` and `fetchStreamFn` (defaulting to the global ones) via the constructor. Exported proxy functions remain for backward compatibility, but they simply invoke the methods on a default `GeminiStreamService` instance.

**Path 2: Pure Functional Architecture**
Remove the singleton completely and require `apiClient` to be passed explicitly to every standalone function call.

**Recommendation:**
**Path 1 (Instance Methods on GeminiStreamService)** was implemented. It solidifies Gemini Stream Service management as a robust, fully-encapsulated class, matching the pattern established for `JulesClient`, `StubsClient`, `ChatHistoryService`, and other modules.

## Architectural Decision: React Context Service Abstraction

**Context:**
Multiple subsystems and custom hooks (`useNetworkStatus`, `useOfflineQueue`, `useTheme`, `useAppState`, `useProjectManager`) directly imported and bound to module-level singleton instances (e.g., `defaultOfflineService`, `defaultThemeService`, `defaultProjectService`). While the singletons were correctly encapsulated inside classes, hardcoding imports directly into React components and hooks violates Dependency Inversion at the UI layer and severely limits testability, mocking, and multi-tenant environment setups where different roots might require different service instances.

**Decision:**
Implemented a unified **ServiceLocator Context** pattern (`ServiceContext.tsx`) via `<ServiceProvider>`. All major domain and utility services are instantiated with their default backward-compatible singletons inside this context's default value. React hooks now rely on `useServices()` to extract their required dependencies rather than directly importing the singletons. This perfectly aligns with existing Context patterns (e.g. replacing `PromptTemplateContext`) while vastly improving Generality, Reusability, and making unit testing UI components trivial without global mock manipulation.

## Architectural Decision: Jules UI Layer Decoupling

**Context:**
The `useJules` hook, `ChatWorkspace`, and `JulesSessionDrawer` components directly imported and used module-level singleton instances (`defaultJulesClient`, `julesSessionsManager`) and wrapper functions (`createNewJulesSession`, `bulkDeleteJulesSessions`). This violated the Dependency Inversion Principle established by the unified `ServiceContext`, tying the UI directly to a specific global implementation rather than an injectable service locator.

**Path 1: Refactor to consume `ServiceContext` via `useServices`**
Update all Jules-related hooks and components to extract `julesClient` and `julesStorageService` from the existing `ServiceContext`. Move standalone session management functions into methods on the `JulesStorageService` class to ensure all operations route through the instance.

**Path 2: Pure prop drilling**
Remove all context hooks and explicitly drill the required `JulesClient` and `JulesStorageService` down from the top-level application component tree.

**Recommendation:**
**Path 1 (Refactor to consume `ServiceContext` via `useServices`)** was implemented. It aligns the Jules domain with the established Context-based dependency injection pattern used by other application subsystems. It greatly improves the testability of components like `ChatWorkspace` and `JulesSessionDrawer` by allowing the injection of mock Jules services during tests without manipulating module scopes.

## Architectural Decision: Jules UI Layer Decoupling

**Context:**
The `useJules` hook, `ChatWorkspace`, and `JulesSessionDrawer` components directly imported and used module-level singleton instances (`defaultJulesClient`, `julesSessionsManager`) and wrapper functions (`createNewJulesSession`, `bulkDeleteJulesSessions`). This violated the Dependency Inversion Principle established by the unified `ServiceContext`, tying the UI directly to a specific global implementation rather than an injectable service locator.

**Path 1: Refactor to consume `ServiceContext` via `useServices`**
Update all Jules-related hooks and components to extract `julesClient` and `julesStorageService` from the existing `ServiceContext`. Move standalone session management functions into methods on the `JulesStorageService` class to ensure all operations route through the instance.

**Path 2: Pure prop drilling**
Remove all context hooks and explicitly drill the required `JulesClient` and `JulesStorageService` down from the top-level application component tree.

**Recommendation:**
**Path 1 (Refactor to consume `ServiceContext` via `useServices`)** was implemented. It aligns the Jules domain with the established Context-based dependency injection pattern used by other application subsystems. It greatly improves the testability of components like `ChatWorkspace` and `JulesSessionDrawer` by allowing the injection of mock Jules services during tests without manipulating module scopes.

## Architectural Decision: Theme Service Proxy Abstraction

**Context:**
`ThemeService` historically exported proxy functions (e.g. `setThemeMode`, `toggleTheme`) tightly binding consumers to a singleton (`defaultThemeService`). This bypassed the established `ServiceContext` dependency injection pattern.

**Decision:**
Proxy functions were successfully removed. Consumers (like tests) were updated to use the singleton explicitly, establishing a pattern for robust abstraction where `ServiceContext` rules dependency injection instead of global module properties.

## Architectural Decision: Storage Component Interface Injection

**Context:**
`ChatHistoryService`, `DraftStateService`, and `ActiveItemManagerFactory` directly instantiated concrete storage implementations (`StorageCollection`, `StorageSingleton`, `StorageRegistry`) internally via the `new` keyword. This hardcoded dependency violated the Dependency Inversion Principle, making it impossible to substitute mock collections or remote storage implementations for these domain services in testing or differing environments.

**Path 1: Direct Interface Injection (Composition)**
Update the configuration objects (e.g., `ChatHistoryServiceConfig`, `DraftStateServiceConfig`, `CreateActiveItemManagerOptions`) to accept generic storage interfaces (`IStorageRegistry`, `IMutableCollection`, `IMutableSingleton`). The services use these injected dependencies if provided, only falling back to instantiating concrete implementations if omitted for backward compatibility.

**Path 2: Injectable Factory Interface (Abstract Factory)**
Create an `IStorageFactory` interface responsible for instantiating registries, collections, and singletons. Inject this factory into the services, abstracting the `new` keyword behind the factory implementation.

**Recommendation:**
**Path 1 (Direct Interface Injection)** was implemented. It perfectly leverages the existing interface abstractions (`IMutableCollection`, `IMutableSingleton`, `IStorageRegistry`) without introducing a complex abstract factory layer. It satisfies Dependency Inversion, vastly improving Generality and testability by allowing direct injection of mock storage instances.


## Architectural Decision: Abstracting Batch Selection UI & Boilerplate

**Context:**
The application had duplicate UI boilerplate across `JulesSessionDrawer`, `LibraryModal`, `ChatHistoryPopover`, `PromptTemplateDrawer`, and `UnifiedSettingsModal` for managing batch selection headers (the "Select All" toggle, selection count text, and `DatasetScopeBanner`). Additionally, ADR 0047 Option A requires clearing the selection when filter queries or tabs change, leading to repetitive `useEffect` blocks in every list component.

**Path 1: Extracted Compound Components & Hook Encapsulation (Composition)**
Update `useBatchSelection` to accept a `clearOnDependencies` array to internalize the selection-clearing logic. Create a new `BatchSelectionHeader` component to encapsulate the "Select All" button, count display, and `DatasetScopeBanner`. Consumers compose this header into their lists.

**Path 2: Higher-Order List Component**
Create a monolithic `BatchSelectionList` component that accepts the raw data array, render functions for items, and configuration. It handles all state, header rendering, and mapping internally.

**Recommendation:**
**Path 1 (Extracted Compound Components & Hook Encapsulation)** is the recommended path. It preserves the flexibility of consumers to lay out their lists (which often have highly custom row designs or floating toolbars) while eliminating the boilerplate of the header and the `useEffect` selection-clearing hook. It aligns with React's compositional nature and improves both Maintainability and Reusability.

## Architectural Decision: Code Generator Service Abstraction

**Context:**
The `CodeGeneratorService` previously hardcoded the implementation of all code generators (Kotlin, TypeScript, Python, cURL) directly within its class methods. This violated the Open/Closed Principle and the Single Responsibility Principle. Adding a new language generator or modifying an existing one required altering the core service file, increasing its size and complexity.

**Path 1: Extracted Generator Classes and Registry (Strategy Pattern)**
Extract the `CodeGenerator` definition into an `ICodeGeneratorPlugin` interface. Create separate classes for each language (e.g., `KotlinGenerator`, `TypeScriptGenerator`) that implement this interface and encapsulate their specific string-building logic. Update `CodeGeneratorService` to act as a registry that accepts an array of these plugins during initialization.

**Path 2: Pure Functional Injection**
Define generators as pure functions mapping `(config, messages)` to strings, and inject a map of these functions into the service.

**Recommendation:**
**Path 1 (Extracted Generator Classes and Registry)** was implemented. It strictly enforces the Open/Closed Principle by allowing new generators to be added by simply passing new instances to the `CodeGeneratorService` constructor without modifying the service itself. It deeply improves abstraction and maintainability by isolating the noisy string-building templates into their own dedicated files.

## Architectural Decision: Google Auth Service DOM Decoupling

**Context:**
The `GoogleAuthService` relied on direct imports of `isBrowserEnvironment` and `getSafeWindow` to dispatch custom DOM events and open OAuth popups. This tight coupling made it difficult to unit test the service in a purely Node.js or simulated environment without relying on global DOM mocks, violating the Dependency Inversion Principle.

**Path 1: Constructor Injection of DOM Utilities**
Update the `GoogleAuthServiceConfig` to accept optional `isBrowserEnv` and `getWindow` functions. The service uses these injected dependencies if provided, only falling back to the globally imported utilities for backward compatibility if omitted.

**Path 2: Event Emitter Abstraction**
Abstract the DOM event dispatching and window management behind a generic `IPlatformEnvironment` interface.

**Recommendation:**
**Path 1 (Constructor Injection of DOM Utilities)** was implemented. It aligns perfectly with the existing injection patterns used for `apiClient` and `storageSingleton`. It immediately resolves the tight coupling to the global DOM objects, vastly improving testability, while remaining simple and fully backward-compatible.

## Architectural Decision: Storage Services Initialization

**Context:**
Modules like `SavedPromptsService`, `JulesStorageService`, and `SyncOrchestrator` implicitly relied on `defaultClient` and `defaultOfflineService` instances inside their constructors or top-level instantiations. Although they offered configuration overrides, their default state bypassed the `ServiceContext` structure and tied them to specific module singletons.

**Path 1: Injected Instantiation from ServiceContext**
Update the `defaultServices` map in `ServiceContext` to inject its own initialized dependencies into the services. This removes the implicit global fallbacks within the service modules, enforcing strict constructor injection.

**Path 2: Lazy Resolution via Context**
Require services to lazily resolve dependencies via `useServices` or a global Service Locator proxy upon invocation. (Drawback: complex, mixes React and non-React scopes).

**Recommendation:**
**Path 1 (Injected Instantiation)** was implemented. It strictly forces instances to declare their dependencies, allowing `ServiceContext` to orchestrate how `IApiClient` or `IOfflineService` propagate across all downstream services. The codebase was refactored to remove implicit fallback patterns.
## Architectural Decision: NetworkStorageSyncAdapter Constructor Signature Deprecation

**Context:**
`NetworkStorageSyncAdapter` historically supported overloaded constructors, including a legacy signature passing arguments positionally and a newer signature accepting a `NetworkStorageSyncAdapterConfig` object. Having multiple signatures with runtime parsing violated Maintainability and Generality, adding unnecessary cognitive load and complexity.

**Path 1: Configuration Object Enforced Injection (Composition)**
Remove the positional signature and the `apiClientOrConfig` runtime type-checking block entirely. Strictly enforce the `NetworkStorageSyncAdapterConfig` object for dependency injection in the constructor.

**Path 2: Retain Backwards Compatibility**
Keep the overloads indefinitely to ensure tests or legacy consumers don't break.

**Recommendation:**
**Path 1 (Configuration Object Enforced Injection)** was implemented. It removes technical debt and enforces a clean dependency injection pattern using the configuration object, matching the rest of the storage layer's established patterns. The few unit tests relying on the positional arguments were trivially updated.

## Architectural Decision: Storage Fallback Handling Fix

**Context:**
`FallbackAsyncStorage` had a bug where returning `undefined` from `getItem` was causing subsequent fallbacks to fail because `undefined` is falsy in the comparison `if (!val)`. It needed to specifically check for `val !== undefined`. This caused the `getItem` to iterate through all adapters and then log an error that all storage adapters failed to `getItem` instead of returning the properly retrieved `undefined` value which signifies a cache miss, not a fallback failure.

**Decision:**
Updated `FallbackAsyncStorage.getItem` to explicitly check `val !== undefined` instead of assuming any truthy value means success.

## Architectural Decision: Sync Orchestrator Configuration Abstraction

**Context:**
The `SyncOrchestrator` previously hardcoded the endpoint mappings and payload transformations for syncing offline mutations (e.g., `jules_sessions`, `saved_prompts`) directly inside its `registerHandlers` method. This violated the Open/Closed Principle and tightly coupled the generic sync engine to the application's specific domain logic, making it difficult to test or extend without modifying the core class.

**Decision:**
Implemented a Configuration Injection pattern by defining a `SyncHandlerConfig` interface. `SyncOrchestrator` now accepts an array of these configurations via its constructor, and `registerHandlers` dynamically registers them. This fully decouples the generic synchronization mechanism from the domain models.

## Architectural Decision: Fallback Storage Error Propagation

**Context:**
`FallbackAsyncStorage` had a flaw in its `setItem` implementation: if all underlying storage adapters failed to set an item, the function would simply complete silently. This masked critical persistence failures and caused data loss in upstream consumers (like `OfflineService`) that expected an exception to be thrown if writing to storage failed completely.

**Decision:**
Updated `FallbackAsyncStorage.setItem` to explicitly throw an error (or re-throw the last caught error) if the item fails to write to all configured storage adapters. This ensures that failures bubble up correctly to the caller.

## Architectural Decision: Theme Service and Speech Voices Service DOM Decoupling

**Context:**
The `ThemeService` and `SpeechVoicesService` relied on direct imports of `isBrowserEnvironment`, `getSafeWindowMatchMedia`, and `getSafeWindowSpeechSynthesis`. This tight coupling made it difficult to unit test the services in a purely Node.js or simulated environment without relying on global DOM mocks, violating the Dependency Inversion Principle.

**Path 1: Constructor Injection of DOM Utilities**
Update the configuration objects to accept optional functions for DOM utilities. The services use these injected dependencies if provided, only falling back to the globally imported utilities for backward compatibility if omitted.

**Path 2: Event Emitter Abstraction**
Abstract the DOM event dispatching and window management behind a generic `IPlatformEnvironment` interface.

**Recommendation:**
**Path 1 (Constructor Injection of DOM Utilities)** was implemented. It aligns perfectly with the existing injection patterns used for `GoogleAuthService`. It immediately resolves the tight coupling to the global DOM objects, vastly improving testability, while remaining simple and fully backward-compatible.

## Architectural Decision: Logger and Singleton Decoupling
**Context:**
The core domain singletons inside `src/utils` and `src/services` (`defaultLogger`, `defaultChatHistoryService`, etc.) were occasionally implicitly bound rather than relying on dependency injection.

**Decision:**
Removed hardcoded `require("../utils/logger")` usages inside hooks like `useSpeechToText` and converted them to `useServices()`. Commented `defaultLogger` to emphasize DI preference. Kept exported `default` instances solely for backward compatibility and `ServiceContext` initialization.

## Architectural Decision: Subsystem Default Instances and DI Container
**Context:**
The core domain singletons inside `src/utils` and `src/services` (`defaultThemeService`, `defaultChatHistoryService`, `defaultAuthService`, etc.) were occasionally implicitly bound rather than relying on dependency injection.

**Decision:**
These exported `default` instances are deliberately kept to act as the primary, fallback dependencies for the `ServiceContext.tsx` root container configuration (which is the actual DI container). The services themselves should use `ServiceContext` hooks to retrieve these, and unit tests construct fresh instances directly, effectively bypassing the global defaults and achieving Dependency Inversion.

## Architectural Decision: Storage Base Registry Extraction
**Context:**
The core domain singletons inside `src/utils/storage` used hard-coded `new StorageCollection` and `new StorageSingleton` which violated Dependency Inversion and made testing difficult since mock storage objects couldn't easily be swapped.

**Decision:**
Implemented a registry interface pattern, where `StorageRegistry` provides instances of the generic storage containers. The dependencies are injected using `ServiceContext` providing testability and removing rigid constructor instantiations.

## Architectural Decision: Image Compressor Strategy Abstraction

**Context:**
`compressImageForGemini` in `src/utils/imageCompressor.ts` currently hardcodes the compression logic (using canvas, drawing image, and returning base64). It tightly couples DOM manipulation (`document.createElement('canvas')`) within the utility, making it harder to test or swap with other compression strategies (like WebWorkers, OffscreenCanvas, or native APIs in Capacitor).

**Path 1: Extract `IImageCompressionStrategy` interface**
Define an `IImageCompressionStrategy` interface and implement `CanvasImageCompressionStrategy`. Expose an `ImageCompressor` that uses this strategy.

**Path 2: Callback/Functional Injection**
Keep the function and pass a callback `compressFn`.

**Recommendation:**
**Path 1 (Extract Interface)** is the recommended path. It abstracts DOM-dependent logic and allows providing a mock strategy or WebWorker strategy without changing the interface, adhering to the Strategy Pattern and improving Abstraction and Reusability.

## Architectural Decision: Uniform IApiClient Interface Injection

**Context:**
Several services (`SpeechVoicesService`, `KeyVerificationService`, `AuthService`, `GeminiStreamService`) either directly imported global functional fetchers (`apiFetch`, `apiFetchStream`) or injected them as `typeof apiFetch`. This violated the Dependency Inversion Principle, caused inconsistent mocking in unit tests, and circumvented the `IApiClient` interface used by other services like `JulesClient` and `StubsClient`.

**Path 1: Refactor to Full `IApiClient` Interface Injection**
Standardize all services to accept an `apiClient: IApiClient` dependency via constructor injection. Services will use `this.apiClient.fetch()` and `this.apiClient.fetchStream()` instead of standalone functions.

**Path 2: Pure Functional Injection**
Continue injecting functional `fetchFn` and `fetchStreamFn` across all services. (Drawback: Fractures the networking architecture between class-based interface injection and functional injection, making it harder to intercept or proxy client calls uniformly).

**Recommendation:**
**Path 1 (Full `IApiClient` Interface Injection)** was implemented. It strictly enforces the Dependency Inversion Principle by programming against the `IApiClient` interface. It unifies networking across the codebase, simplifies testing by standardizing on `IApiClient` mocks, and ensures all services can seamlessly adopt interceptors, retry strategies, and custom headers managed by the client instance.

## Architectural Decision: Environment-Agnostic Storage Fallback and Interface-Driven Factory Injection

**Context:**
The `OfflineQueueStore` previously defaulted strictly to `IndexedDbAsyncStorage` in `ServiceContext.tsx`, creating a single point of failure if the environment blocked IndexedDB. Furthermore, the store accepted a bare `createCrossTabNotifier` functional callback for its cross-tab notifications, which violated the Dependency Inversion Principle and deviated from the established pattern of injecting factory interfaces.

**Decision:**
Updated `ServiceContext.tsx` to instantiate `OfflineQueueStore` with the `FallbackAsyncStorage` wrapper, cascading from `IndexedDbAsyncStorage` to `MemoryAsyncStorage`. Refactored `OfflineQueueStoreConfig` to accept an `ICrossTabNotifierFactory` interface (`crossTabNotifierFactory`) instead of a functional callback. This vastly improves the queue's robustness across environments and strictly enforces dependency inversion.

## Architectural Decision: OfflineQueueStore Mutation Operations Abstraction

**Context:**
The `OfflineQueueStore` class managed the queue state with duplicated lock mechanisms. Every operation (`enqueue`, `remove`, `removeMany`, `clear`, `replace`) individually repeated the sequence of `safeSetQueue`, `cachedQueue` update, `notifyQueue`, and `channel?.postMessage('SYNC')`. This violates the DRY principle and increases the chance of bugs when updating caching mechanisms.

**Decision:**
Created a centralized `applyQueueUpdate(newQueue: OfflineMutation[])` private method inside `OfflineQueueStore`. All state-mutating queue methods inside `withQueueLock` now purely mutate/filter the array and pass the result to `applyQueueUpdate`. This drastically simplifies the methods, adheres strictly to DRY, and establishes a single choke point for modifying the offline queue state safely and accurately across listeners and tabs.


## Architectural Decision: TypeScript Type Safety Enforcement

**Context:**
Several test files and core utilities (`src/utils/storage/syncAdapter.test.ts`, `src/utils/offlineService.test.ts`, `src/utils/storage/ActiveItemManager.test.ts`, `src/services/authProvider.test.ts`) used loose `any` types for mocking complex dependencies (`IApiClient`, `IOfflineService`, `StorageCollection`) or event payloads. This bypassed the TypeScript compiler's structural checks, reducing robustness and making refactoring perilous as API contracts changed.

**Decision:**
Replaced loosely typed `any` mocks with strictly typed `Mocked<Interface>` or explicitly structured types (e.g. `unknown` where appropriate, or defining the mocked methods explicitly). This deepens abstraction by enforcing interface contracts strictly even at the testing boundary, dramatically improving maintainability and code quality without altering application behavior.

## Architectural Decision: Vitest Mocking Standards

**Context:**
A bug was introduced during refactoring because `vi.mocked()` cannot be used inline when wrapping methods of dependencies injected directly via TS interface mocks (e.g. `mockActiveItemManager.getItems` casted via `as unknown as IActiveItemManager`). Attempting to use `vi.mocked()` inline on these generated a runtime TypeError `vi.mocked is not a function` during test execution when using `esbuild` transformer in Vitest, causing multiple tests to fail in `draftState.test.ts`, `general.test.ts`, `projects.test.ts`, and `julesService.test.ts`.

**Path 1: Standardize casting with `as import("vitest").Mock`**
Replace all inline instances of `vi.mocked(fn)` with a direct Typescript cast `(fn as import("vitest").Mock)` for inline mocking/spy checks. This explicitly satisfies TS without invoking the `vi.mocked` wrapper function at runtime.

**Path 2: Restructure all Mocks to use `vi.mock()`**
Refactor the entire test suite to use module-level `vi.mock()` and import the actual modules.

**Recommendation:**
**Path 1** was chosen as it resolves the runtime TypeErrors immediately without requiring a heavy rewrite of the test files and preserves the existing behavior and design pattern of the unit tests.

## Architectural Decision: Mutex Logger Abstraction

**Context:**
The `Mutex` utility in `src/utils/mutex.ts` historically relied on a hardcoded `console.warn` call to report lock timeouts. This tight coupling violated the Dependency Inversion Principle, caused test output spew, and made it impossible to redirect lock timeout warnings (e.g., to an external telemetry service or custom UI toast notification) without global monkey-patching.

**Path 1: Logger Interface Injection (Composition)**
Update the `Mutex` constructor to accept an optional `ILogger` dependency. Use this injected logger for warnings, falling back to a default `NoOpLogger` or `ConsoleLogger` if none is provided. Consumers (like `OfflineQueueStore`) can pass their domain-specific loggers into the `Mutex`.

**Path 2: Event Emitter Abstraction**
Abstract the timeout warning behind a generic event emitter, and have consumers listen for timeout events instead of logging directly.

**Recommendation:**
**Path 1 (Logger Interface Injection)** is recommended and aligns with the existing Logger abstraction ADRs across the codebase. It properly conforms to Dependency Inversion, allows targeted log overriding per component, and completely resolves console spew in unit tests.

## Architectural Decision: Sync Adapter Transport Layer Abstraction

**Context:**
`NetworkStorageSyncAdapter` previously tightly coupled the `apiClient.fetch` invocation and the request building mechanism (`requestBuilder`) directly inside its main logic. This prevented using the sync adapter to orchestrate updates across different protocols (e.g., WebSockets, GraphQL, specialized client SDKs).

**Path 1: ISyncTransport Interface**
Extract the transport execution into a separate `ISyncTransport<T>` interface and define a standard implementation, `ApiClientSyncTransport<T>`. Update `NetworkStorageSyncAdapter` to compose this generic interface, maintaining backward compatibility by building the default implementation if only an `apiClient` is supplied.

**Path 2: Callback functions**
Pass generic `transmitFn` callbacks into `NetworkStorageSyncAdapter` instead of defining a specific structural interface.

**Recommendation:**
**Path 1 (ISyncTransport Interface)** was implemented. By applying the Dependency Inversion Principle, the sync adapter now purely orchestrates error handling, retry queues, and network status checks, while delegating the actual I/O to a composable and entirely mockable transport layer. This dramatically improves generality.

## Architectural Decision: Subsystem DOM Dependency Injection

**Context:**
Multiple core services (`WindowSecurityService`, `PwaInstallService`, `ChatHistoryService`, and `OfflineQueueStore`) were tightly coupled to global DOM apis, including checking `isBrowserEnvironment()`, `getSafeDocument()`, `safeAddEventListener`, and instantiating `new BroadcastChannel()`. This violated the Dependency Inversion Principle and hindered testability in non-browser environments like Node (e.g. Vitest runs).

**Path 1: Refactoring to utilize Configuration Object Injection**
Expand the configuration objects of these services to include function dependencies (e.g., `isBrowserEnv?: typeof isBrowserEnvironment`, `getSafeDoc?: typeof getSafeDocument`, `createBroadcastChannel?: (name: string) => BroadcastChannel`). If omitted, the constructor defaults to using the existing platform utilities.

**Path 2: Environmental Global Mocks**
Attempt to mock the `isBrowserEnvironment` and DOM globals within testing frameworks on an individual basis.

**Recommendation:**
**Path 1 (Configuration Object Injection)** was implemented. It strictly enforces dependency inversion at the constructor level and standardizes the services with the patterns used by `ThemeService`, `NetworkStorageSyncAdapter` and `GoogleAuthService`. By explicitly passing functional overrides, we significantly enhance robustness, simplify testing, and reduce the likelihood of side effects during testing.

## Architectural Decision: Map Collection Engine Implementation

**Context:**
`ArrayCollection` used the `abstractMapMutate` method and sequentially checked each item in the array to resolve mutations like `update` or `upsert`. This operation has an O(N) complexity for every single change. For very large collections in production, O(N) can severely impact rendering loop latency. We needed an engine optimized for constant-time complexity lookups to handle frequent large scale state updates efficiently without relying solely on full array iteration checks where unnecessary.

**Path 1: Continue extending `ArrayCollection` Optimization**
Retain `ArrayCollection` and just modify the algorithm. However, its array-focused design and abstractions make changing it to a Map based structure difficult without breaking its contract entirely or relying on heavy object translation mapping layers under the hood.

**Path 2: Implement `MapCollection<T>` as a New Implementation of `ICollectionEngine<T>`**
Leveraging the `ICollectionEngine<T>` abstraction (introduced in ADR Collection Engine Abstraction), implement a new `MapCollection<T>` that resolves `bulkUpdate` and `bulkUpsert` directly utilizing Map lookup structures O(1).

**Recommendation:**
**Path 2 (Implement `MapCollection<T>`)** is the recommended path. It strictly adheres to the Open/Closed principle by introducing a highly optimized collection engine without mutating the legacy `ArrayCollection`. The `MapCollection` handles duplicate tracking, updates, and deduplication purely via Map references for constant-time lookups (O(1) vs O(N)) when resolving updates. It achieves this while matching the `ICollectionEngine<T>` API and behavior perfectly, serving as a scalable drop-in replacement.

## Architectural Decision: OfflineQueueStore Storage Adapter Interface Abstraction

**Context:**
`OfflineQueueStore` previously strictly typed its `storageAdapter` dependency to `AsyncStorage` (from `src/utils/asyncStorage.ts`). This coupled the queue store specifically to the implementations defined in that file, hindering tests and violating the Interface Segregation and Dependency Inversion principles.

**Decision:**
Introduced an `IAsyncStorageAdapter` interface directly within `offlineQueueStore.ts` that defines only the `getItem` and `setItem` methods required by the queue store. By changing `OfflineQueueStoreConfig` to accept `IAsyncStorageAdapter` instead of `AsyncStorage`, the component is now entirely decoupled from the concrete implementation details. It allows for mock adapters in testing without casting and promotes complete independence of the storage layer.

## Architectural Decision: OfflineQueueStore Lock Error Propagation

**Context:**
Inside `OfflineQueueStore`, the `applyQueueUpdate` method mutated storage and subsequently updated the memory cache and observables. However, if the `safeSetQueue` function encountered an error, the queue's internal state mechanism could become out of sync because the state modification implicitly suppressed the write failure. Moreover, if multiple async operations queued up, failing to throw on a lock action could allow the mutex to resolve silently instead of throwing correctly.

**Decision:**
Modified `safeSetQueue` to re-throw unhandled write exceptions and removed the blanket `try/catch` wrapping the state notification step in `applyQueueUpdate`. Now, if a storage write fails, the entire transaction correctly aborts. The state does not mutate, the cache isn't erroneously updated, and the mutex propagation is strictly preserved, increasing the robustness and integrity of the offline mutation queue.
## Architectural Decision: ApiClient Constructor Signature Deprecation

**Context:**
`ApiClient` supported a legacy signature `ApiClientConfig | RetryConfig = {}` with runtime type checking (`'retryConfig' in config`) to support backwards compatibility. This violated the Principle of Least Astonishment and added unnecessary runtime complexity similar to what was removed from `NetworkStorageSyncAdapter`.

**Path 1: Enforce Strict ApiClientConfig Injection**
Remove the union type and runtime checks, accepting only `ApiClientConfig = {}`.

**Path 2: Retain Union Type**
Keep the backwards compatibility.

**Recommendation:**
**Path 1 (Enforce Strict ApiClientConfig Injection)** was implemented. It removes the legacy union type and the associated runtime checks. This improves type safety, reduces cognitive load, and aligns `ApiClient` with the codebase's dependency injection standards.

## Architectural Decision: Server Logger Abstraction

**Context:**
The Express server (`server.ts`) and its underlying Stub Service (`server/stubsService.ts`) historically relied on hardcoded `console.error`, `console.warn`, and `console.log` calls to report critical failures, errors, and informational events. This tight coupling to the global `console` object violated the Dependency Inversion Principle, caused test output spew (if backend logic was unit tested), and made it impossible to easily redirect error reporting (e.g., to an external telemetry service) without global monkey-patching. It also fractured the logging architecture between the frontend and the backend.

**Path 1: Direct File-Level Logger Initialization (Singleton)**
Import `defaultLogger` (which defaults to `ConsoleLogger`) from `src/utils/logger.ts` into `server.ts` and `server/stubsService.ts`. Replace all raw `console` calls with methods on the imported `defaultLogger` instance. This abstracts away the direct `console` calls, allowing us to swap the logger implementation globally for the backend later if needed.

**Path 2: Express Request/Response Context Injection (Middleware)**
Create an Express middleware that injects an `ILogger` into the Express `req` object, and update all route handlers to use `req.logger`. For `stubsService.ts`, update the utility functions to accept an optional `ILogger` dependency as a parameter.

**Recommendation:**
**Path 1 (Direct File-Level Logger Initialization)** was implemented. While Dependency Injection (Path 2) is ideal for complex domain classes, `server.ts` acts as the composition root for the backend, and `stubsService.ts` consists primarily of pure, static utility functions. A module-level logger instance achieves the primary goal—eliminating tight coupling to the global `console` object and unifying the logging mechanism across the frontend and backend—without introducing the massive boilerplate required to thread loggers through every function signature and Express request type.
## Architectural Decision: Observable Interface Segregation and EventEmitter

**Context:**
`Observable<T>` was being used dually as a stateful store (where `getSnapshot()` returns the current state) and as a pure event emitter for system events like `StorageEvent` or `QuotaExceeded` (where `getSnapshot()` is meaningless and would return `undefined`). This forced `getSnapshot()` to have an unsafe `T | undefined` signature, complicating React integrations like `useStore` and violating the Interface Segregation Principle.

**Decision:**
Implemented an explicit `EventEmitter<T>` class for publish/subscribe workflows that do not retain state. `globalStorageEventObservable`, `globalStorageQuotaObservable`, and `FallbackStorageWrapper.quotaExceededEvent` were migrated to this new primitive. `Observable<T>` is now strictly a stateful container requiring an initial state, allowing its `getSnapshot()` method to guarantee a `T` return type without `undefined`. This greatly improves Type Safety, Robustness, and Generality across the entire reactivity layer.

## Architectural Decision: ActiveItemManager Side-Effect Decoupling (Strict CQS)

**Context:**
`ActiveItemManager` previously accepted an `onActiveItemChange` callback and manually executed this side effect inside its `notify()` and `notifySync()` methods by inspecting the state difference (`resolveSideEffects`). This coupled state derivation with side-effect execution, violating Command-Query Separation (CQS) and the Single Responsibility Principle.

**Decision:**
Removed the `onActiveItemChange` configuration from `ActiveItemManager`. Services that require side effects based on active item changes (e.g., `ProjectService` updating the global API key when the active project switches) now simply `subscribe()` to the `projectsManager` and execute their own domain-specific side effects. This perfectly decouples the store logic from downstream side effects, improving Abstraction and Maintainability.

## Architectural Decision: OfflineService Sync Engine Extraction

**Context:**
The `OfflineService` class historically handled both queue management (delegating to `OfflineQueueStore`) and the orchestration of processing those mutations (`processOfflineMutations` and `syncRegistry`). This violated the Single Responsibility Principle and made it difficult to unit-test the orchestration logic independently of the storage mechanisms.

**Decision:**
Extracted the `syncRegistry` and `processOfflineMutations` logic from `OfflineService` into a new, dedicated `SyncEngine` class (implementing `ISyncEngine`). `OfflineService` now acts as a facade, instantiating or accepting a `SyncEngine` dependency via its constructor configuration. This strictly adheres to the Single Responsibility Principle, improves testability, and allows future flexibility (e.g., swapping in a parallel processor) without modifying the queue management layer.

## Architectural Decision: BatchSelectionManager Decoupling and Optimization

**Context:**
`BatchSelectionManager` was previously a generic class `BatchSelectionManager<T>` that required a `getItemId: (item: T) => string` function. This coupled the selection state management logic to the domain data structures. It also required a hacky `updateGetItemId` method to be called during render to avoid stale closures in React hooks. Additionally, operations like `clearSelection` and `toggleSelectAll` performed redundant `Set` allocations and emitted state change notifications even when the selection state did not actually change, leading to unnecessary re-renders.

**Decision:**
Refactored `BatchSelectionManager` to strictly manage sets of string IDs rather than generic items. The `T` generic parameter and `getItemId` function were removed from the class entirely. ID extraction is now completely delegated to the `useBatchSelection` hook using standard React memoization. Furthermore, the class methods were optimized to fail fast and return early if the requested operation (like clearing an already empty selection) results in no state change, vastly reducing unnecessary `notifySync` emissions and object allocations. This deepens abstraction, decoupling, and robustness.

## Architectural Decision: Mutex Interface Abstraction

**Context:**
The `Mutex` class in `src/utils/mutex.ts` was implemented as a concrete class and directly instantiated by consumers like `OfflineQueueStore`. While the logger dependency was properly injected, the `Mutex` itself lacked an interface. This tight coupling violates the Dependency Inversion Principle, making it difficult to inject custom lock strategies (e.g., distributed locks, mock locks for testing, or non-blocking try-locks) without modifying the consumer or monkey-patching the concrete class.

**Path 1: Extract an `IMutex` Interface (Composition)**
Define an `IMutex` interface with `acquire` and `run` methods. Update the existing `Mutex` class to implement this interface. Update consumers like `OfflineQueueStore` to optionally accept an `IMutex` via constructor injection (defaulting to the concrete `Mutex` if not provided to maintain backward compatibility).

**Path 2: Event-Driven Lock Coordination**
Instead of a lock object, rely on an event bus to coordinate state access between systems. (Drawback: Highly asynchronous, adds extreme complexity to the sequential offline mutation queue process).

**Recommendation:**
**Path 1 (Extract an `IMutex` Interface)** was implemented. It strictly enforces the Dependency Inversion Principle, aligning the locking mechanism with the rest of the generic service injection patterns in the codebase. It improves Testability and Generality by allowing seamless substitution of the lock engine.

## Architectural Decision: IBatchSelectionManager Interface Abstraction

**Context:**
`BatchSelectionManager` was previously implemented as a concrete class and directly instantiated without an interface. This coupled consumers to the concrete implementation and hindered testability by making it difficult to inject mocks.

**Decision:**
Extracted an `IBatchSelectionManager` interface and made `BatchSelectionManager` implement it. `useBatchSelection` now types its internal manager state as `IBatchSelectionManager`. This strictly enforces the Dependency Inversion Principle, matching other utility patterns (like `IMutex`) and improving testability and code structure.

## Architectural Decision: IBatchSelectionManager Interface Abstraction

**Context:**
`BatchSelectionManager` was previously implemented as a concrete class and directly instantiated without an interface. This coupled consumers to the concrete implementation and hindered testability by making it difficult to inject mocks.

**Decision:**
Extracted an `IBatchSelectionManager` interface and made `BatchSelectionManager` implement it. `useBatchSelection` now types its internal manager state as `IBatchSelectionManager`. This strictly enforces the Dependency Inversion Principle, matching other utility patterns (like `IMutex`) and improving testability and code structure.

## Architectural Decision: Core Service Interface Abstraction

**Context:**
Several core services (`JulesClient`, `GoogleAuthService`, `PwaInstallService`, and `WindowSecurityService`) were previously implemented as concrete classes and injected as such into the `ServiceContext`. This coupled consumers directly to the concrete implementations, hindered testability by making it difficult to inject pure mocks, and violated the Dependency Inversion Principle. It also diverged from the established pattern where other domain services (like `IThemeService`, `IChatHistoryService`) expose clear interfaces.

**Path 1: Extract Explicit Interfaces (Dependency Inversion)**
Extract interfaces (`IJulesClient`, `IGoogleAuthService`, `IPwaInstallService`, `IWindowSecurityService`) for these services and make the concrete classes implement them. Update the `IServices` registry in `ServiceContext` to strictly depend on these interfaces instead of the concrete implementations.

**Path 2: Keep Concrete Implementations (Status Quo)**
Continue relying on TypeScript's structural typing and class definitions as the defacto interfaces. While TypeScript can mock classes, this leaves the API contract implicit rather than explicit and ties the type definition directly to implementation details (like private fields, even if technically ignorable via `Omit`).

**Recommendation:**
**Path 1 (Extract Explicit Interfaces)** was implemented. It strictly enforces the Dependency Inversion Principle, aligning with the interface abstraction patterns established in previous ADRs (e.g., `IMutex`, `IBatchSelectionManager`). It improves Robustness, Generality, and Testability by creating clear API contracts, allowing seamless substitution of service implementations (e.g., mock implementations during unit testing or platform-specific overrides) without relying on structural typing workarounds.

## Architectural Decision: Batch Selection Abstraction Standardization
**Context:**
Certain UI components like `ChatHistoryPopover` manually calculated batch selection states (e.g. `selectedHistoryIds.size === 0 ? 'none' : ...`) despite the existence of a standard `getSelectionState` function returned by the `useBatchSelection` hook. This led to duplicated logic and violated the DRY principle, risking inconsistency if selection definitions evolved.

**Decision:**
We standardized all consumers to exclusively use `getSelectionState` injected from the `useBatchSelection` hook. This reinforces the encapsulation of the batch selection manager, promotes Generality by allowing the underlying state calculations to change without impacting the UI, and simplifies component prop drilling.

## Architectural Decision: Async Storage Adapter Interface Unification
**Context:**
The `AsyncStorage` interface was originally defined in `src/utils/asyncStorage.ts`, but `OfflineQueueStore` declared a nearly identical `IAsyncStorageAdapter` internally, leading to unnecessary type definitions and duplicate interface shapes.

**Decision:**
Removed the redundant `IAsyncStorageAdapter` definition in `offlineQueueStore.ts` and standardized its dependency on the `AsyncStorage` interface exported by `asyncStorage.ts`. This improves maintainability and centralizes the abstraction of the storage layer.

## Architectural Decision: SyncOrchestrator and ImageCompressor Interface Abstraction

**Context:**
`SyncOrchestrator` and `ImageCompressor` were provided as concrete classes and injected as such into the `ServiceContext`. This coupled consumers directly to the concrete implementations, hindered testability by making it difficult to inject pure mocks, and violated the Dependency Inversion Principle. It diverged from the established pattern where other domain services expose clear interfaces (like `IThemeService`, `IChatHistoryService`, etc.).

**Path 1: Extract Explicit Interfaces (Dependency Inversion)**
Extract interfaces (`ISyncOrchestrator`, `IImageCompressor`) for these services and make the concrete classes implement them. Update the `IServices` registry in `ServiceContext` to strictly depend on these interfaces instead of the concrete implementations.

**Path 2: Keep Concrete Implementations (Status Quo)**
Continue relying on TypeScript's structural typing and class definitions as the defacto interfaces. While TypeScript can mock classes, this leaves the API contract implicit rather than explicit and ties the type definition directly to implementation details.

**Recommendation:**
**Path 1 (Extract Explicit Interfaces)** is the recommended path. It strictly enforces the Dependency Inversion Principle, aligning with the interface abstraction patterns established in previous ADRs. It improves Robustness, Generality, and Testability by creating clear API contracts, allowing seamless substitution of service implementations without relying on structural typing workarounds.

## Architectural Decision: SentenceSpeechQueue and SSEStreamParser Interface Abstraction

**Context:**
`SentenceSpeechQueue` and `SSEStreamParser` were implemented as concrete classes without corresponding interfaces. This made it difficult to inject pure mocks for them in tests, coupling components like `ChatWorkspace` and `GeminiStreamService` to concrete implementations, and violating the Dependency Inversion Principle.

**Decision:**
Extracted explicit interfaces (`ISentenceSpeechQueue` and `ISSEStreamParser`) for these classes and updated them to implement those interfaces. This adheres to the strict interface abstraction pattern in the codebase, significantly enhancing testability and satisfying the Core Service Interface Abstraction requirement.

## Architectural Decision: Clipboard and Download System Interaction Abstraction

**Context:**
Currently, components and services like `CodeExportModal`, `MobileIDEWorkspace`, and `KeyVerificationService` directly import and invoke DOM-bound utility functions (e.g., `getSafeNavigatorClipboard()`) and manually orchestrate DOM element creation for downloads (e.g., `document.createElement('a')`). This violates the Dependency Inversion Principle, couples business and presentation logic to the browser environment, and hinders testability in Node.js/Vitest environments.

**Path 1: Extract `IClipboardService` and `IFileDownloadService` Interfaces (Composition)**
Define explicit interfaces (`IClipboardService` and `IFileDownloadService`) to encapsulate these system interactions. Implement browser-specific providers (`BrowserClipboardService`, `BrowserFileDownloadService`). Inject these services via the unified `ServiceContext` for React components and via constructor injection for domain classes (like `KeyVerificationService`).

**Path 2: Mock Platform Utilities Globally**
Continue relying on `getSafeNavigatorClipboard` and `getSafeDocument` but enhance the testing framework to globally mock these functions or the underlying `window.navigator.clipboard` API.

**Recommendation:**
**Path 1 (Extract Interfaces)** is the recommended path. It strictly enforces the Dependency Inversion Principle, aligning with the interface abstraction patterns established in the application. It abstracts away ugly DOM manipulation (like appending invisible anchor tags for downloads) into a reusable service, deeply improving Generality and Testability while eliminating direct `document` and `navigator` dependencies from UI components.

## Architectural Decision: Map Collection singleUpdatedItem Resolution Consistency

**Context:**
`MapCollection<T>` tracks mutations and returns a `singleUpdatedItem` in its `CollectionOperationResult`. Previously, if a bulk operation mutated or added multiple items, `singleUpdatedItem` would arbitrarily resolve to the last modified item or the first added item. If a mutation was requested but no change actually occurred (e.g. data is identical), it still returned an item. For deletions, it did not properly resolve the deleted item if exactly one was deleted. This inconsistency broke the contract of `ICollectionEngine<T>` which implies `item` is only returned for singular updates.

**Path 1: Remove `item` from `CollectionOperationResult`**
Force consumers to extract the updated item manually from the `items` array by inspecting state. (Drawback: highly disruptive, breaks consumers expecting the convenience property).

**Path 2: Strict Mutation Counting**
Implement an `updateCount` tracker inside `applyMutations` and `bulkDelete`. `item` is exclusively assigned if and only if exactly one item was mutated, added, or deleted across the entire operation.

**Recommendation:**
**Path 2 (Strict Mutation Counting)** was implemented. It fixes the semantic accuracy of the `singleUpdatedItem` resolution for batch operations while preserving the interface, ensuring downstream bugs are not triggered by false-positive singular resolves on multi-item operations.

## Architectural Decision: Global DOM Variable Abstraction in Utilities

**Context:**
Files like `src/utils/crossTabNotifier/StorageEventNotifier.ts` and `src/utils/networkStatus.ts` accessed global variables like `window.localStorage` and `window.navigator.onLine` directly, bypassing the platform utilities established in `src/utils/platform.ts` (`getSafeWindow`, `getSafeNavigator`, etc.). This violated the core abstraction principles, tying utility code tightly to the DOM environment and making it fragile under SSR or test environments without comprehensive mocking.

**Path 1: Standardize with Platform Utilities**
Extend `src/utils/platform.ts` to export explicit getters like `getSafeLocalStorage()` and update all remaining utilities to exclusively use these safe wrappers instead of touching `window` or `document` directly.

**Path 2: Inject as Dependencies**
Pass `localStorage` and `navigator` via constructor injection to these utilities to decouple them entirely from global state.

**Recommendation:**
**Path 1 (Standardize with Platform Utilities)** was implemented. It aligns perfectly with the established `getSafe*` pattern in `platform.ts`, preventing massive refactoring of utility constructors while successfully abstracting the DOM access away from the application logic layer, significantly improving robustness in non-browser environments.

## Architectural Decision: ComputedStore Lifecycle Management

**Context:**
`ComputedStore` previously subscribed to its dependency stores immediately upon instantiation and remained subscribed until `dispose()` was explicitly called. This active subscription model could cause memory leaks if computed stores were created dynamically and not properly disposed, as they would remain referenced by their dependencies' listener sets. Furthermore, it performed unnecessary computations when its dependencies changed even if no observers were actively listening.

**Decision:**
Implemented **Lazy Subscription (Reference Counting)**. `ComputedStore` now only subscribes to its dependencies when it has at least one subscriber itself. When its own subscriber count drops to zero, it unsubscribes from its dependencies. `getSnapshot()` evaluates the compute function lazily when not actively subscribed. This strictly controls the lifecycle and side-effects without relying on non-deterministic garbage collection timing, deeply improving robustness and reusability (no manual `.dispose()` needed for dynamic derivations).

## Architectural Decision: StorageBase Serialization Fallback

**Context:**
When saving items to `StorageBase`, the store attempts to cache the item. Previously, if `structuredClone` failed (e.g., when the object contained complex types or non-serializable nodes), it fell back to using the raw reference `toStore`. Since `processRawValue` runs this through `deepFreeze`, it would unintentionally freeze the user's original un-cloned input object, breaking application state mutability elsewhere.

**Decision:**
Implemented a robust **Serialization Fallback Pipeline**. If `structuredClone` fails, `StorageBase` now utilizes the injected `ISerializer` (or `JSON.stringify`/`JSON.parse` by default) to create a deeply decoupled clone. Only if both robust cloning mechanisms fail does it fallback to the raw reference. This prevents unexpected freezing of live application objects and preserves data integrity.

## Architectural Decision: IPlatformService Abstraction

**Context:**
Numerous components and hooks directly imported and used DOM-bound utilities (`getSafeWindow`, `getSafeDocument`, `getSafeNavigator`, `isBrowserEnvironment`) from `src/utils/platform.ts`. This tightly coupled UI components and domain hooks to concrete platform checks, violating Dependency Inversion, cluttering React lifecycle code with global references, and making it harder to mock these checks for unit tests.

**Decision:**
Introduced `IPlatformService` and its concrete implementation `BrowserPlatformService` within the DI layer (`ServiceContext`). Replaced direct utility imports in `LibraryModal`, `JulesSessionDrawer`, `UnifiedSettingsModal`, `useClipboardKeySniffer`, `useSpeechToText`, and `useUIState` with calls to methods like `platformService.isInputFocused()`, `platformService.getWindow()`, and `platformService.getNavigator()`. This provides a unified API for platform detection, enables easy mocking via `ServiceContext`, and significantly improves abstraction and testability.

## Architectural Decision: GoogleAuthCard Decoupling via Hook

**Context:**
`GoogleAuthCard` directly accepted authentication callbacks (`onLogin`, `onLogout`) and tightly coupled its state (`isLoading`, `error`) to UI events. Components like `SettingsAccountTab` and `UnifiedSettingsModal` were forced to drill these props down from `App.tsx` (prop drilling), which violated the Single Responsibility Principle and muddied the component tree.

**Decision:**
Created `useGoogleAuth` hook that extracts all authentication state and methods, directly utilizing `googleAuthService` from the `ServiceContext`. Refactored `GoogleAuthCard` to consume this hook directly. Removed prop drilling of `googleUser`, `onGoogleLogin`, and `onGoogleLogout` from `SettingsAccountTab`, `UnifiedSettingsModal`, and `App.tsx`, deepening abstraction and keeping the components focused purely on presentation.

## Architectural Decision: OfflineQueueStore Storage Adapter Interface Abstraction Enhancement

**Context:**
While previous ADRs abstracted `IAsyncStorageAdapter`, the `OfflineQueueStore` still hard-coupled itself to `AsyncStorage` type in its configuration interface and constructor typing in `src/utils/offlineQueueStore.ts`. This leaked implementation details and blocked purely memory-based mocking without casting.

**Decision:**
Updated `OfflineQueueStore` to rely on the unified `AsyncStorage` interface correctly from `asyncStorage.ts`, completing the interface abstraction for the offline mutation storage layer and improving robustness.

## Architectural Decision: FallbackStorageWrapper Quota Recovery Mechanics

**Context:**
`FallbackStorageWrapper` correctly emitted a quota exceeded event. However, consumers didn't have a reliable way to synchronously clear space before the wrapper attempted its retry, leading to premature promotion to memory storage even if space *could* be freed.

**Decision:**
Updated `FallbackStorageWrapper` to wait for synchronous listeners of `quotaExceededEvent` to finish executing before attempting a retry. Removed the redundant `CustomEvent` dispatch on `window`, routing all quota logic entirely through the `EventEmitter` to reduce DOM coupling. This ensures deterministic quota recovery.

## Architectural Decision: React Hooks Dependency Injection

**Context:**
Custom React hooks (`useBatchSelection`, `useSpeechToText`) previously directly instantiated concrete domain classes and Web APIs (e.g., `new BatchSelectionManager()`, `new SpeechRecognitionClass()`). This violated the Dependency Inversion Principle within the presentation layer, making it difficult to inject mocks for unit testing hooks or to swap out underlying implementations (like providing a custom batch selection state machine) without modifying the hook itself.

**Path 1: Injected Factory Functions / Interfaces**
Update the hooks' configuration options to accept factory functions or explicit interfaces (e.g., `managerFactory?: () => IBatchSelectionManager`, `speechRecognitionFactory?: ISpeechRecognitionFactory`). The hook invokes the factory if provided, otherwise falling back to the concrete default instantiation.

**Path 2: React Context Injection for everything**
Move all such instantiations into the `ServiceContext` and expose them via getters.

**Recommendation:**
**Path 1 (Injected Factory Functions / Interfaces)** was implemented. This allows for highly cohesive hooks that manage their own default state while remaining entirely open for extension and mock injection during testing, without unnecessarily polluting the global `ServiceContext` with ephemeral instance factories.

## Architectural Decision: Server Jules API Integration Abstraction

**Context:**
The Express server (`server.ts`) previously handled external Jules API calls (e.g., fetching repositories, dispatching tasks, polling, approving) by embedding raw `fetch` statements directly within its route handlers. It manually parsed JSON, checked status codes, and implemented ad-hoc timeouts via `AbortController`. This violated the Single Responsibility Principle, tightly coupled the Express routing layer to external network orchestration, and missed out on the standardized error handling (`BaseApiError`) and retry mechanisms built into the existing `ApiClient`.

**Path 1: Refactor Routes to consume an injected `IApiClient`**
Instantiate a server-scoped `ApiClient` in `server.ts`. Update the Express route handlers to replace raw `fetch` calls with `apiClient.fetch()`. This eliminates the ad-hoc `AbortController` timeouts and manual JSON parsing from the routes, leveraging the existing network layer abstractions for retries and error processing. However, the route handlers themselves still encode the domain-specific endpoint URLs and request body structures.

**Path 2: Extract a Dedicated `ServerJulesClient` (Service Layer)**
Extract all domain-specific interaction with `jules.googleapis.com` into a dedicated service class (`server/julesClient.ts`), similar to how `stubsService.ts` handles Stubs logic. This `ServerJulesClient` will be constructed with an injected `IApiClient` and `ILogger`. The route handlers in `server.ts` simply call domain methods like `serverJulesClient.dispatchTask(repo, instructions)` and return the result.

**Recommendation:**
**Path 2 (Extract a Dedicated `ServerJulesClient`)** was implemented. This perfectly mirrors the frontend architecture (which separates UI/Routing from Domain Services like `JulesClient`), enforces strict Dependency Inversion by isolating external API communication into a testable class, and immediately upgrades the server's network requests to use the robust `ApiClient` features (like exponential backoff). It significantly improves the abstraction, robustness, and reusability of the backend.

## Architectural Decision: Prompt Tool Action Dock Abstraction

**Context:**
`FewShotBuilderTool` and `VariablePromptTool` both duplicated the UI boilerplate for rendering the live preview, copy-to-clipboard button, and insert-into-chat button at the bottom of their respective views. This violated the DRY principle and risked inconsistent UI/UX behaviors between prompt tools.

**Decision:**
Extracted the duplicated UI elements into a shared `PromptToolActionDock` component. Both tools now compose this component, passing down their respective `resolvedPrompt`/`formatFewShotPrompt()` strings and event handlers. This improves Maintainability and Reusability, ensuring all prompt tools share a consistent preview and action surface.

## Architectural Decision: Console Logger Strict Usage and Cleanup

**Context:**
While the `ILogger` abstraction and DI mechanism effectively decouples business logic from standard `console` objects, various UI components (`MobileIDEWorkspace`) and generic output templates (`TypeScriptGenerator`) implicitly execute native `console.log()` calls as part of string formatting strings for mocked developer output inside an IDE UI, which was not the intention to replace by the logger.

**Decision:**
Preserve `console.log()` within hardcoded string templates intended to generate code for external IDE execution or visualization as a standard, since those evaluate as raw strings and not live application state, thus adhering strictly to the intention of the DI logger implementation.
## Architectural Decision: Stubs CLI Missing Graceful Handling

**Context:**
The Express server (`server/stubsService.ts`) attempts to spawn a child process for the Stubs CLI located at `.agents/skills/stubs/dist/cli.cjs`. However, this CLI bundle may not exist in all environments (e.g., fresh checkouts, CI without the sub-skill built). When `runCliCommand` is called, it would crash or fail ungracefully if the file does not exist, violating the Robustness principle. Furthermore, `package.json` contains a `stubs` script pointing to this missing file, causing `npm run stubs` to fail.

**Path 1: Dummy CLI Script Creation**
Create a dummy `.agents/skills/stubs/dist/cli.cjs` script in the repository that outputs a helpful message. This ensures the command always exists, but requires committing an artifact to a `dist/` folder which is typically ignored or generated.

**Path 2: Graceful Error Handling in `runCliCommand`**
Modify `runCliCommand` in `server/stubsService.ts` to asynchronously check if `CLI_PATH` exists using `fs.promises.access` before attempting to spawn the child process. If it doesn't exist, gracefully reject with a descriptive error message indicating the Stubs CLI is missing or not built. Also, modify the `stubs` script in `package.json` to handle the missing file gracefully or inform the user to build the agent skills first.

**Recommendation:**
**Path 2 (Graceful Error Handling)** is the recommended path. It enhances Robustness by preventing unhandled exceptions and process crashes when a dependency is missing. It adheres to best practices by verifying file existence before execution, rather than committing generated `dist/` artifacts to source control.

## Architectural Decision: Extracting SentenceSpeechQueue and SSEStreamParser Instantiations

**Context:**
Even though `ISentenceSpeechQueue` and `ISSEStreamParser` were previously extracted, `ChatWorkspace` and `GeminiStreamService` were still directly instantiating the concrete classes (`new SentenceSpeechQueue`, `new SSEStreamParser`). This tightly coupled these components to the concrete implementations, violating the Dependency Inversion Principle and preventing pure mock injection during testing.

**Decision:**
Abstracted their instantiations by introducing `createSentenceSpeechQueue` and `createSSEStreamParser` factory methods into the `ServiceContext` and component configuration interfaces respectively. Components and services now invoke these factories to obtain implementations, strictly enforcing abstraction boundaries and enabling full testability without global mock overrides.

## Architectural Decision: BatchSelectionManager Optimization and Strict Dependency Injection
**Context:**
The `BatchSelectionManager` iterated entirely through arrays in `getSelectionState` and `toggleSelectAll`, yielding O(N) complexity which degraded performance on large lists. Additionally, the ServiceContext graph instantiated `ApiClient` and `OfflineQueueStore` relying on implicit global defaults like `defaultPlatformService` internally for timeouts, which violated strict abstraction boundaries.

**Path 1: Purely optimize BatchSelectionManager and enforce Strict DI everywhere, removing all defaults**
This would improve O(N) constraints and perfectly align all services to explicit DI, but would break backwards compatibility across hundreds of legacy tests that relied on the implicit global fallbacks.

**Path 2: Optimization and Hybrid DI**
Optimize the `BatchSelectionManager` to short-circuit iteration using early returns (`O(1)` average case for mixed states). Explicitly pass injected instances of `PlatformService`, `Mutex`, and `RetryStrategy` inside `ServiceContext.tsx` to completely decouple the production graph from globals, while retaining the global fallbacks inside constructor defaults to avoid breaking legacy tests.

**Recommendation:**
**Path 2 (Optimization and Hybrid DI)** was implemented. This achieves the performance benefits for robustness and reusability, tightens the production DI abstraction tree for the API and Offline clients, but gracefully preserves test compatibility.

## Architectural Decision: Web API Factory for Audio and SpeechSynthesis

**Context:**
Various UI components and hooks (`ChatWorkspace`, `useAudioSettings`, `SentenceSpeechQueue`) were directly instantiating standard browser APIs like `new Audio()` and `new SpeechSynthesisUtterance()`. This directly coupled React components to the browser's global object, limiting abstraction and significantly complicating automated testing in headless environments (like Node.js) where these APIs do not natively exist.

**Path 1: Isolate Instantiations Inside a new `AudioService`**
Create an entirely new service dedicated strictly to managing audio playback and TTS state.

**Path 2: Extend `IPlatformService` as a General API Factory**
Since `IPlatformService` already abstracts global object properties (`window`, `document`, `navigator`), extend its interface with factory methods: `createAudio()` and `createSpeechSynthesisUtterance()`. Components simply invoke the platform service injected via context to obtain these primitives.

**Recommendation:**
**Path 2 (Extend `IPlatformService` as a General API Factory)** was implemented. It aligns perfectly with the current architecture where platform-dependent interactions are routed through `PlatformService`. This reduces coupling and makes testing environments substantially more resilient and predictable without requiring global mock injections.

## Architectural Decision: Id Generation Abstraction

**Context:**
The codebase relied on a globally imported function, `generateUniqueId`, for generating unique identifiers. This function was used across services (like `OfflineService` and `JulesStorageService`) and React components. While simple, it tightly coupled domain logic to a specific implementation of ID generation, making it difficult to inject mock IDs during testing or swap the generation strategy in the future.

**Path 1: Complete replacement of `generateUniqueId` with `IIdGenerator` across all files**
This would involve updating every React component and service to accept and use an `IIdGenerator`. While pure, it would cause significant churn in the UI layer and require extensive updates to component props.

**Path 2: Hybrid Dependency Injection (Targeted Abstraction)**
Define the `IIdGenerator` interface and `DefaultIdGenerator` class. Inject this abstraction into the core services (`OfflineService`, `JulesStorageService`) via their configurations. For React components and test files where strict DI is less critical and churn is undesirable, retain the backward-compatible `generateUniqueId` function (now internally acting as a wrapper around `DefaultIdGenerator`).

**Recommendation:**
**Path 2 (Hybrid Dependency Injection)** was implemented. It successfully isolates the domain logic in core services from concrete ID generation, significantly improving testability and abstraction for those services. By retaining the legacy wrapper function, we minimize unnecessary code churn in the UI layer and preserve backwards compatibility.

## Architectural Decision: Time Provider Abstraction

**Context:**
The utility function `formatRelativeTime` in `src/utils/timeUtils.ts` directly invoked `Date.now()`. This tightly coupled the formatting logic to the global system clock, which made testing brittle. `src/utils/timeUtils.test.ts` previously relied on overriding the global `Date.now` with a mock function (`global.Date.now = vi.fn(...)`). This global monkey-patching approach can lead to flaky tests, test pollution, and race conditions in concurrent testing environments.

**Path 1: Strict Dependency Injection**
Modify `formatRelativeTime` to make the `timeProvider` parameter mandatory. This enforces the highest level of abstraction but would require updating every single consumer in the application (like `ChatHistoryPopover`) to explicitly pass down the provider, causing a large amount of boilerplate.

**Path 2: Optional Dependency Injection (Default Parameter)**
Modify `formatRelativeTime` to accept an optional `timeProvider: ITimeProvider = defaultTimeProvider`. This allows production code to continue working without modification, while tests can explicitly inject a mock provider, avoiding the need for global `Date` manipulation.

**Recommendation:**
**Path 2 (Optional Dependency Injection)** was implemented. It effectively decouples the utility from the system clock and allows safe, parallelizable unit testing without the heavy boilerplate and disruption that strict DI would introduce for a simple utility function.

## Architectural Decision: Web API Factory for FileReader and Image

**Context:**
The `CanvasImageCompressionStrategy` in `src/utils/imageCompressor.ts` was directly instantiating standard browser APIs like `new FileReader()` and `new Image()`. Similar to the previous decision regarding `Audio` and `SpeechSynthesisUtterance`, this tightly coupled the utility class to the browser's global object, limiting abstraction and making it difficult to inject mock implementations during automated testing in headless environments.

**Path 1: Isolate Instantiations Inside a new \`ImageService\`**
Create an entirely new service dedicated strictly to managing image and file reader instances.

**Path 2: Extend \`IPlatformService\` as a General API Factory**
Since `IPlatformService` already acts as a factory for other browser primitives (`createAudio`, `createSpeechSynthesisUtterance`), extend its interface with `createFileReader()` and `createImage()`. The image compressor can then invoke the platform service injected via its configuration to obtain these primitives.

**Recommendation:**
**Path 2 (Extend \`IPlatformService\` as a General API Factory)** was implemented. It maintains architectural consistency by routing all platform-dependent instantiations through `PlatformService`. This reduces coupling and makes testing environments substantially more resilient and predictable without requiring global mock injections.

## Architectural Decision: TimeProvider and IdGenerator UI Layer Abstraction

**Context:**
The core domain services previously had their dependencies updated to receive `ITimeProvider` and `IIdGenerator` via constructor injection. However, React components (like `MobileIDEWorkspace`, `ImportProjectSheet`, and various hooks like `useJules`) still directly imported the singleton instances `defaultTimeProvider` and `defaultIdGenerator` from their respective files. This coupling circumvents the established `ServiceContext` DI layer, violating the Dependency Inversion Principle within the presentation layer. It limits the ability to universally mock time or ID generation for UI components during testing or preview scenarios without global monkey-patching.

**Path 1: Injected Instantiation from ServiceContext (Composition)**
Add `timeProvider: ITimeProvider` and `idGenerator: IIdGenerator` to the `IServices` interface in `ServiceContext.tsx`. Initialize them with the default instances. Update all React components and custom hooks to consume these dependencies via `useServices().timeProvider` and `useServices().idGenerator`, removing the direct module imports.

**Path 2: Retain Global Import for Static Utilities**
Treat time and random ID generation as pure static utilities and retain the global imports, since mocking `Date.now()` globally is often supported by testing frameworks (like Vitest's `vi.setSystemTime`).

**Recommendation:**
**Path 1 (Injected Instantiation from ServiceContext)** was implemented. It strictly enforces the Dependency Inversion Principle uniformly across both domain services and the UI layer. It enhances Generality and Testability, allowing isolated component tests to easily inject predictable time and ID generation via `<ServiceProvider>` without relying on potentially brittle or globally-leaking system-time mocks.

## Architectural Decision: App Auth Orchestration Decoupling

**Context:**
The React hook `useAppAuth` was responsible for orchestrating the interaction between `AuthService` (handling backend proxy authentication) and `GoogleAuthService` (handling Google OAuth). It manually managed the synchronization of user state, server keys, and custom API keys directly within the UI layer. This violated the Single Responsibility Principle, coupled the React components directly to authentication domain logic, and made it difficult to unit-test the orchestration rules without rendering the hook.

**Path 1: Extract an `IAppAuthManager` (Facade/Orchestrator)**
Create a dedicated `AppAuthManager` domain class to encapsulate the combination of Google OAuth identity and backend proxy access. This class exposes a unified API (`initiateGoogleLogin`, `hasServerKey`, `getCustomApiKey`) and provides a single `initializeAuth` method for the UI to subscribe to state changes. The `ServiceContext` injects this manager, and `useAppAuth` simply consumes it.

**Path 2: Maintain Logic in `useAppAuth` but abstract hooks**
Break `useAppAuth` down into smaller hooks like `useGoogleIdentity` and `useServerAuth`. (Drawback: still leaves domain orchestration in the React layer, and doesn't resolve the lack of a centralized unified auth state representation for non-React consumers).

**Recommendation:**
**Path 1 (Extract an `IAppAuthManager`)** was implemented. It strictly enforces the Dependency Inversion Principle, moving domain orchestration out of the React layer and into a testable, dedicated service class. This vastly improves Abstraction and Maintainability, aligning with the architectural patterns established by `OfflineQueueStore` and `SyncOrchestrator`.

## Architectural Decision: RandomProvider Abstraction

**Context:**
The codebase relied on a globally imported function, `Math.random()`, for generating random values in utilities such as `idGenerator.ts` and `delayStrategy.ts`. The direct use of `Math.random()` tightly coupled these utilities to the JavaScript global environment, preventing full test isolation and determinism in unit testing.

**Path 1: Complete replacement of `Math.random` with a injected provider**
Create a new `IRandomProvider` interface and a default implementation (`DefaultRandomProvider`). Pass it down to any domain utility that requires random number generation (e.g. `IIdGenerator` and `IDelayStrategy`). This perfectly adheres to the Dependency Inversion Principle, increasing testability by allowing for a deterministic mock random provider in the future.

**Path 2: Mock the global `Math.random()` within the testing framework**
Allow the application to use standard JS global calls like `Math.random()` and rely on Vitest/Jest mocking when testing (e.g. `vi.spyOn(Math, 'random').mockReturnValue(0.5)`). While easier to implement, it leads to test pollution and brittle test suites across concurrent testing environments.

**Recommendation:**
**Path 1 (Complete replacement of `Math.random` with a injected provider)** was implemented. It strictly enforces the Dependency Inversion Principle uniformly across domain utilities. It enhances testability, ensuring deterministic output can easily be verified via mock injection without global monkey-patching.

## Architectural Decision: Full Integration of `timeProvider` in React Components

**Context:**
Certain React components (`SettingsAccountTab`, `LibraryModal`, `JulesSessionDrawer`) were still directly instantiating `new Date(timestamp)` to format dates, bypassing the `timeProvider` injected via `ServiceContext`. While it didn't use `Date.now()`, the failure to route Date initialization through the provider meant that mocking system time could not reliably control these UI elements during test suites or snapshots.

**Path 1: Standardize `timeProvider.date(timestamp)` usage**
Extend `ITimeProvider` to optionally accept a timestamp and update all React components to use `useServices().timeProvider.date(timestamp)`. This ensures that all temporal instantiations are routed strictly through the domain abstraction.

**Path 2: Extract a purely static utility function for date formatting**
Create a helper like `formatDate(timestamp)` and just import it across components. But this doesn't fully abstract the raw Date initialization from the system.

**Recommendation:**
**Path 1 (Standardize `timeProvider.date(timestamp)` usage)** was implemented. This completes the separation of concern initiated in earlier timeProvider abstractions, guaranteeing uniform testability across both domain code and the presentation layer.

## Architectural Decision: Sync Engine Queue Processing Strategy Abstraction

**Context:**
`SyncEngine` implemented a hardcoded "Strict FIFO Halting" loop directly in its `processOfflineMutations` method. This coupled the orchestration of the queue to a specific execution strategy, violating the Open/Closed Principle and making it difficult to inject custom queue processing strategies (like parallel execution or optimistic continues) for different domain contexts.

**Decision:**
Extracted an `IQueueProcessingStrategy` interface and moved the existing loop into a `StrictFifoQueueProcessingStrategy` class. `SyncEngine` now accepts an `IQueueProcessingStrategy` via dependency injection (defaulting to the Strict FIFO implementation) and simply delegates processing to it. This cleanly separates concerns, enhancing robustness and generality.

## Architectural Decision: API Client Response Parsing Abstraction

**Context:**
The `ApiClient` class currently handles preparing requests, executing them with retries, and also *parsing* the response body (handling 204 No Content, JSON parsing with error wrapping, and plain text fallbacks). This violates the Single Responsibility Principle and hardcodes how responses are interpreted, preventing consumers from seamlessly handling binary data (like Blobs or ArrayBuffers) or custom content types without altering the core `ApiClient` class.

**Path 1: Extracted Response Parser Interface (Recommended)**
Extract the response parsing logic into an `IResponseParser` interface that takes a `Response` and returns a `Promise<T>`. Update `ApiClient` to accept a parser via its constructor configuration, defaulting to a `DefaultResponseParser` that perfectly mimics the existing JSON/text behavior.
- *Pros:* Decouples parsing from the client orchestrator. Enables custom parsing (e.g., `BlobResponseParser`) to be injected for specific api instances. Deepens abstraction and reusability.
- *Cons:* Adds a slight amount of configuration overhead when instantiating custom clients.

**Path 2: Response Type Option**
Add a `responseType: "json" | "text" | "blob" | "arraybuffer"` option to the `fetch` method signature of `ApiClient`.
- *Pros:* Simple to implement.
- *Cons:* Requires modifying the `IApiClient` interface to accept configuration it shouldn't care about. Still violates SRP within the `ApiClient` body, which would grow to handle all possible formats.

**Recommendation:**
**Path 1 (Extracted Response Parser Interface)** is recommended to adhere strictly to the Dependency Inversion and Single Responsibility principles, aligning with how retries and interceptors are already structured in the `ApiClient`.
**Architectural Decision: Jules Task Orchestration Decoupling**

**Context:**
The React hook `useJules` is currently responsible for orchestrating the interaction between `IJulesClient` (which handles API communication and polling) and `IJulesStorageService` (which manages the local sessions state). It manually manages polling lifecycle, updates the session messages with progress from task payloads, and maintains local React state for execution tracking. This violates the Single Responsibility Principle, couples the React components directly to task lifecycle domain logic, and makes it difficult to unit-test the polling orchestration without rendering the hook.

**Path 1: Extract an `IJulesSessionOrchestrator` (Facade/Orchestrator)**
Create a dedicated `JulesSessionOrchestrator` domain class to encapsulate the task dispatching, polling, and session mutation logic. This class exposes a unified API (`dispatchTask`, `approvePlan`, `rejectPlan`, `stopPolling`) and updates the underlying `JulesStorageService` automatically. The `ServiceContext` injects this orchestrator, and `useJules` simply delegates to it, relying entirely on the `julesStorageService` store for session state. Any transient UI state like `isExecuting` can be exposed as an observable by the orchestrator.

**Path 2: Maintain Logic in `useJules` but abstract the polling into a utility**
Extract only the polling loop logic into a custom hook or utility function (e.g., `useJulesPolling`), passing in callbacks to update the session. This reduces the size of `useJules` but still leaves the domain orchestration (mapping task payload to session messages) within the React layer.

**Recommendation:**
**Path 1 (Extract an `IJulesSessionOrchestrator`)** is the recommended path. It strictly enforces the Dependency Inversion Principle and aligns with the pattern established by `AppAuthManager` and `SyncOrchestrator`. Moving domain orchestration out of the React layer into a testable, dedicated service class significantly improves abstraction, reusability, and maintainability.

## Architectural Decision: Robust Requires Approval Evaluation

**Context:**
The application relied on `taskUpdate.requiresApproval` being explicitly present in the polling payload to properly show the plan approval actions in the UI. If the payload simply returned `status: "awaiting_approval"` without the boolean `requiresApproval: true`, the user would be unable to proceed.

**Path 1: Defaulting within Orchestrator**
Update the `JulesSessionOrchestrator` to evaluate `requiresApproval: taskUpdate.requiresApproval ?? (taskUpdate.status === "awaiting_approval")`. This adds robustness by interpreting the explicit await state as functionally requiring approval.

**Path 2: Strict UI Evaluation**
Update the UI component (`JulesActivityCard`) to check for the `awaiting_approval` status to determine if the plan requires approval, ignoring the `requiresApproval` flag. This might decouple the orchestrator from UI-specific logic, but leaves the underlying data model incomplete or potentially conflicting.

**Recommendation:**
**Path 1 (Defaulting within Orchestrator)** was implemented. It adds robustness by explicitly enforcing plan review when the backend state strictly sits in awaiting_approval, ensuring consistency in the domain model payload rather than pushing edge-case handling to the presentation layer.
## Architectural Decision: Server Context Abstraction

**Context:**
The backend entrypoint (`server.ts`) and services manually instantiated core utility services (like `ApiClient`, `ProcessRunner`, `Logger`, `ServerJulesClient`), circumventing the rigorous dependency injection pattern used by the frontend (`ServiceContext`).

**Decision:**
We extracted a dedicated `ServerContext` for the backend to instantiate and weave together its dependencies explicitly. `server.ts` and `stubsService.ts` now retrieve instances from this shared context instead of using global defaults or raw instantiation, ensuring uniform strict Dependency Inversion on both client and server.

## Architectural Decision: Subsystem Extraneous Default Exports Cleanup

**Context:**
Several module files (like `imageCompressor.ts`, `draftState.ts`, `projects.ts`) exported `defaultX` singletons which were completely unused by the application because the frontend `ServiceContext.tsx` had been refactored to explicitly instantiate those dependencies via `new X()` constructor logic directly.

**Decision:**
To eliminate dead code and strictly enforce the injection hierarchy established in `ServiceContext.tsx`, completely unused `export const defaultX` declarations were removed from their respective domain modules.

## Architectural Decision: UrlBuilder Strategy Abstraction

**Context:**
The `ApiClient` orchestrator previously imported a global utility function `buildUrlWithParams` directly inside its `prepareRequest` step to construct query string URLs. This hardcoded dependency violated the Dependency Inversion Principle, making it impossible to inject custom URL serialization strategies (e.g. for APIs requiring specific list encodings or specialized path formatting).

**Decision:**
Extracted the `buildUrlWithParams` logic into an `IUrlBuilder` interface and a `DefaultUrlBuilder` implementation. `ApiClientConfig` was updated to accept an `urlBuilder` dependency, defaulting to the `DefaultUrlBuilder`. This mirrors the pattern set by `IResponseParser` and `IInterceptorManager`, completely abstracting API configuration strategies.

## Architectural Decision: Eliminating Hardcoded Dependencies in Domain Methods

**Context:**
Several domain services (`KeyVerificationService`, `GoogleAuthService`, `PromptTemplateService`, `StorageEventNotifier`) currently had direct module imports of global singletons (like `defaultTimeProvider`) which they called directly inside their method bodies (e.g. `defaultTimeProvider.now()`). Even though previous ADRs permit using these defaults as constructor fallbacks, executing them directly inside methods violates the Dependency Inversion Principle. It makes mocking system time during unit testing impossible for those functions without global monkey-patching.

**Path 1: Parameter-level Injection (Functional approach)**
Modify the methods themselves to optionally accept the dependency (e.g. `verifyGoogleApiKey(apiKey, model, timeProvider = defaultTimeProvider)`).

**Path 2: Constructor-level Injection with Default Fallbacks**
Add the required dependencies (like `ITimeProvider`) to the configuration interfaces or constructors of these classes. Default them to the exported singletons if not explicitly provided, adhering to the existing DI pattern, and update the method bodies to use the instance properties (e.g. `this.timeProvider.now()`).

**Recommendation:**
**Path 2 (Constructor-level Injection with Default Fallbacks)** was implemented. It properly encapsulates dependencies within the class instance and ensures full testability by allowing mocked providers to be injected at instantiation, while maintaining backward compatibility for existing instantiations via the fallback mechanism.

## Architectural Decision: Full API Client DI Encapsulation

**Context:**
The `ApiClient` orchestrator previously initialized a default `InterceptorManager`, `DefaultResponseParser`, and `DefaultUrlBuilder` if its configuration arguments did not explicitly provide one. This instantiation of concrete utilities inside the domain constructor bypasses the Dependency Inversion Principle, which strictly mandates using abstractions that resolve instances through a top-down explicit configuration provider.

**Path 1: Standardize with Composition Root Container (Service Context)**
Refactor the `ApiClient` constructor to require `interceptorManager`, `responseParser`, and `urlBuilder` natively without fallback initializations. Move the instantiation logic upstream into the application’s core providers (`ServiceContext` and `ServerContext`).

**Path 2: Pure Optional Properties (Defacto Class Injection)**
Continue to permit the fallback logic locally inside the class constructor by maintaining its optional properties.

**Recommendation:**
**Path 1 (Standardize with Composition Root Container)** was implemented. Ensuring full inversion of control within `ApiClient` ensures all dependencies explicitly declare the exact underlying utilities responsible for payload and endpoint processing, allowing comprehensive mock tests across both server and UI boundaries, maximizing robustness and predictability.

## Architectural Decision: Full System Time Decoupling
**Context:**
Various tests and utilities such as `timeProvider.test.ts` invoked system time operations dynamically. While standard DOM code had been refactored in previous tasks, unit tests were continuing to reference node system time abstractions explicitly.

**Decision:**
Implemented comprehensive test refactoring to eliminate implicit fallback references to `Date.now()` within the test layer itself, standardizing usage strictly with the newly established `ITimeProvider` boundaries.

## Architectural Decision: Domain-Level Clone/Freeze Requirements

**Context:**
The core generic reactive container `Observable<T>` effectively published UI state snapshots to React elements correctly but neglected to clone or freeze these snapshots before yielding them in `getSnapshot()`. This omission permitted downstream UI features (e.g. nested lists reading arrays) to accidentally mutate domain state directly. Several stores (like `StorageBase`) attempted to mitigate this by implementing manual deep copies before notifying `Observable`, but stores utilizing native arrays or maps (like `BatchSelectionManager` and `OfflineQueueStore`) remained vulnerable.

**Path 1: Enforce deepFreeze in Observable**
Modify the base `Observable.notify` and `Observable.notifySync` methods (along with the constructor) to invoke a `deepFreeze` operation on incoming state payloads prior to assigning them to `currentState`.

**Path 2: Domain-Level Clone/Freeze Requirements**
Leave `Observable<T>` untouched but require domain models specifically interacting with complex JSON shapes to manually `deepFreeze` objects before broadcasting them.

**Recommendation:**
**Path 2 (Domain-Level Clone/Freeze Requirements)** was implemented. Enforcing `deepFreeze` at the core `Observable<T>` level introduces unacceptable risks of severe performance regressions and functional breakage for non-POJO (Plain Old JavaScript Object) states. Immutability guarantees are better maintained at the specific domain boundaries rather than enforced blindly on all primitives.

## Architectural Decision: Platform Service Decoupling in Core Storage Utilities & Services

**Context:**
Functions and services like `createDefaultStorageInstance` and `ChatHistoryService` directly imported and utilized the global singleton `defaultPlatformService` inside their bodies (e.g., `defaultPlatformService.isBrowserEnv()`). This implicit, hardcoded dependency violates the Dependency Inversion Principle, tying domain and core utility logic strictly to a concrete platform implementation, complicating testability and abstraction.

**Path 1: Enforce Strict Composition Root Injection**
Modify functions and service constructors to explicitly require `IPlatformService` (or specific observables/capabilities) without any default fallbacks. This would mandate every caller up the chain, including React components and test files, to provide the exact platform abstraction.

**Path 2: Constructor-level / Parameter-level Injection with Default Fallbacks**
Update the configurations or function parameters to optionally accept `platformService` (or specific platform capabilities), defaulting them to `defaultPlatformService` (or its specific methods) if omitted.

**Recommendation:**
**Path 2 (Constructor-level / Parameter-level Injection with Default Fallbacks)** was implemented. It brings the utilities and services into compliance with the established "Hybrid Dependency Injection" pattern. It enables strict overriding of platform behavior for isolated unit tests without requiring a massive refactoring of every downstream consumer that currently relies on the zero-argument initialization behavior.
