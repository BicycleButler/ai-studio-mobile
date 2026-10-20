## Architectural Decision: Delay Strategy Configuration Abstraction

**Context:**
`ExponentialBackoffRetryStrategy` previously checked if its injected strategy was an `ExponentialBackoffDelayStrategy` in order to dynamically inject the `baseDelayMs` parameter from `RetryConfig`. This violated the Open/Closed Principle and the Dependency Inversion Principle, as the generic retry orchestrator became tightly coupled to a specific delay implementation, and consumers' custom strategies would be ignored or clobbered.

**Path 1: Strict Injection (Remove from Config)**
Remove `baseDelayMs` from `RetryConfig`. The orchestrator only accepts an `IRetryStrategy` (which itself encapsulates an `IDelayStrategy`). Consumers are responsible for configuring their delay strategy when instantiating it, preserving perfect abstraction.

**Path 2: Configuration Mutator Pattern**
Add a `withBaseDelay(delay: number): IDelayStrategy` method to the `IDelayStrategy` interface. The retry orchestrator uses this to clone the strategy with the new configuration.

**Recommendation:**
**Path 1 (Strict Injection)** is the recommended path. It removes conflicting sources of truth (`RetryConfig` vs `IDelayStrategy` constructor) and ensures the orchestrator purely delegates to the injected strategy without needing to understand its configuration semantics.
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
