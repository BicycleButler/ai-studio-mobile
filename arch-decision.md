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

## Architectural Decision: Observable Notification Batching

**Context:**
`Observable<T>` previously notified all subscribers synchronously upon state changes. If multiple state updates occurred rapidly in a single event loop tick (e.g. sequentially updating an item and its active state), subscribers (such as React components via `useSyncExternalStore`) would execute multiple times synchronously.

**Path 1: Sync Batching Utility**
Create a `batch(() => void)` function that defers notifications globally until the lambda finishes. (Drawback: Needs consumer opt-in).

**Path 2: Microtask Notification Batching inside Observable**
Modify the base `Observable`'s `notify` to schedule a single microtask that flushes the latest snapshot to listeners. This completely absorbs synchronous thrashing with zero changes to consumers.

**Recommendation:**
**Path 2 (Microtask Batching)** is the recommended path. It strictly reduces render thrashing and enhances robustness and abstraction, natively complementing `ComputedStore`'s deferred dependency evaluation.
