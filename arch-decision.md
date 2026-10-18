## Architectural Decision: Storage Abstraction

**Context:**
`StorageSingleton` and `StorageCollection` both duplicate the core logic for loading, validating, transforming, caching (with `deepFreeze`), and saving data to `localStorage`. `StorageCollection` currently implements this by mapping over arrays manually within its overridden `load` method.

**Path 1: Consolidate in `StorageBase<T>` (Inheritance/Template Method)**
Promote the `load()`, `save()`, and caching pipeline up to `StorageBase<T>`. `StorageSingleton<T>` becomes a very thin subclass. `StorageCollection<T>` extends `StorageBase<T[]>` and translates its item-level `validate` and `transform` functions into array-level functions that it passes to `super()`.

**Path 2: Extract to `StorageEngine<T>` (Composition)**
Remove `StorageBase`. Create a standalone `StorageEngine<T>` class. `StorageSingleton` and `StorageCollection` compose this engine internally and expose their own APIs.

**Recommendation:**
**Path 1 (Hybrid Inheritance)** is the recommended path. It preserves the existing `Observable` inheritance chain and the `is-a` relationship that consumers might rely on, while eliminating all duplicated pipeline logic. It deeply improves abstraction and maintainability without breaking the public interface.
