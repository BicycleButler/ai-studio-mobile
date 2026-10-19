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
