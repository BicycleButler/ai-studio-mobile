---
title: "System Architecture Context Map"
type: context-map
status: active
domain: core
---

# System Architecture Context Map

> **Agent Entry Point (Tier 1 Progressive Disclosure)**: Read this macro map first, then drill into the relevant domain map or query `npx stubs query "stub: <module>"` for Level 1 Interface Skeleton signatures.

## 1. Strict 7-Layer Dependency Hierarchy
- **Layer 0 (`core`)**: Foundational TypeScript interfaces & Zod schemas (`src/types.ts`, `src/types/stubs.ts`, `src/schemas/validation.ts`). Imports nothing from higher layers.
- **Layer 1 (`utils`)**: Pure utilities, platform detection, API client, and AES-GCM storage (`src/utils/**`, `src/data/**`).
- **Layer 2 (`services`)**: Stateful domain services and API clients (`src/services/**`).
- **Layer 3 (`hooks` / `core`)**: React hooks and workspace contexts (`src/hooks/**`, `src/contexts/**`).
- **Layer 4 (`components`)**: UI components and workspace views (`src/components/**`).
- **Layer 5 (`core`)**: Application entrypoints (`src/App.tsx`, `src/main.tsx`).
- **Layer 6 (`server`)**: Express server runtime and SQLite AST GraphRAG engine (`server.ts`, `server/**`).

## 2. Prerequisite Domain Maps
- **[CORE Domain Map](domains/core-domain-map.md)** (8 modules) — Hubs: `src/types.ts` (fan-in 72), `src/types/integrations.ts` (fan-in 18), `src/types/stubs.ts` (fan-in 14)
- **[UTILS Domain Map](domains/utils-domain-map.md)** (81 modules) — Hubs: `src/utils/logger.ts` (fan-in 51), `src/utils/apiClient.ts` (fan-in 23), `src/utils/observable.ts` (fan-in 20)
- **[SERVICES Domain Map](domains/services-domain-map.md)** (32 modules) — Hubs: `src/services/ServiceContext.tsx` (fan-in 50), `src/services/IPlatformService.ts` (fan-in 31), `src/services/platformService.ts` (fan-in 25)
- **[HOOKS Domain Map](domains/hooks-domain-map.md)** (30 modules) — Hubs: `src/hooks/useStore.ts` (fan-in 8), `src/hooks/useBackNavigation.ts` (fan-in 4), `src/hooks/useBatchSelection.ts` (fan-in 4)
- **[COMPONENTS Domain Map](domains/components-domain-map.md)** (77 modules) — Hubs: `src/components/settings/SettingsSectionCard.tsx` (fan-in 5), `src/components/BatchDeleteOverlay.tsx` (fan-in 4), `src/components/BatchSelectionHeader.tsx` (fan-in 4)
- **[SERVER Domain Map](domains/server-domain-map.md)** (8 modules) — Hubs: `server/stateStore.ts` (fan-in 4), `server.ts` (fan-in 3), `server/stubsService.ts` (fan-in 3)

## 3. Global High-Centrality Hubs (Top 10 by Fan-In)
1. `src/types.ts` — Domain: `core` · Layer 0 · Fan-In: **72** · Fan-Out: 2 · Exports: PromptType, SettingsTab, ModelProviderId, ModelInfo, ProviderConnection
2. `src/utils/logger.ts` — Domain: `utils` · Layer 1 · Fan-In: **51** · Fan-Out: 0 · Exports: ILogger, ConsoleLogger, NoOpLogger, ILoggerFactory, DefaultLoggerFactory
3. `src/services/ServiceContext.tsx` — Domain: `services` · Layer 2 · Fan-In: **50** · Fan-Out: 52 · Exports: IServices, ServiceProvider, useServices, createServices
4. `src/services/IPlatformService.ts` — Domain: `services` · Layer 2 · Fan-In: **31** · Fan-Out: 3 · Exports: IPlatformService
5. `src/services/platformService.ts` — Domain: `services` · Layer 2 · Fan-In: **25** · Fan-Out: 5 · Exports: BrowserPlatformService
6. `src/utils/apiClient.ts` — Domain: `utils` · Layer 1 · Fan-In: **23** · Fan-Out: 5 · Exports: ApiClientConfig, IApiClient, ApiClient
7. `src/utils/observable.ts` — Domain: `utils` · Layer 1 · Fan-In: **20** · Fan-Out: 1 · Exports: Listener, IReadableStore, IObservable, Observable
8. `src/utils/storage/types.ts` — Domain: `utils` · Layer 1 · Fan-In: **19** · Fan-Out: 1 · Exports: StorageSaveOptions, IStorageBase, IDisposable, CollectionOperationResult, ICollectionEngine
9. `src/utils/errorHandling.ts` — Domain: `utils` · Layer 1 · Fan-In: **19** · Fan-Out: 0 · Exports: extractMessageFromUnknown, getErrorMessage
10. `src/types/integrations.ts` — Domain: `core` · Layer 0 · Fan-In: **18** · Fan-Out: 0 · Exports: IntegrationProviderId, IntegrationAuthMethod, IntegrationConnection, IntegrationCredentialsPayload, RemoteFileSource

## 4. Surgical GraphRAG Query Protocol & Durable Harness Commands
- `npx stubs query "map:"` — Level 0 Macro Map summary
- `npx stubs query "stub: <target>"` — Level 1 Interface Skeleton Stubs (stripped bodies + line links)
- `npx stubs query "explain: <target>"` — Level 2 Symbol Profile (callers, callees, exports)
- `npx stubs query "path: <A> to <B>"` — Shortest directed dependency chain
- `npx stubs query "blast: <target>"` — Downstream impact radius & topological edit order
- `npx stubs query "drift:"` — AST hash deltas & sidecar drift since last harness checkpoint
- `npx stubs query "hubs:"` — High-centrality architectural hubs across the 7-layer hierarchy
- `npx stubs query "task:"` — Active durable task status & topological edit plan progress
- `npx stubs query "tests: <target>"` — AST-discovered direct and upstream caller unit test suites
- `npx stubs query "pkg:<package>"` — Package-scoped consumer audit
- `npx stubs pre-flight <t1> [t2...] [--guard <level>] [--order <files...>] [--context]` — Multi-target pre-flight blast radius & unified topological edit order
- `npx stubs task [list|start|step|target|verify|resume|note|reset-baseline|complete]` — Manage durable agentic coding tasks in `.stubs/harness-ledger.json`
- `npx stubs handoff [taskId]` — Synthesize a deterministic session handoff & context resumption Markdown packet
