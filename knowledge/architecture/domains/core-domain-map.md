---
title: "Core Domain Map"
type: domain-context-map
status: active
domain: core
layer: 0
---

# Core Domain Map

> Foundational TypeScript contracts, validation schemas, workspace contexts, and application entrypoints.

## Domain Metrics & Canonical Hubs
- **Layer Tier**: Layer 0 (Types & Schemas) & Layer 5 (App Entrypoints)
- **Production Modules**: 8
- **Canonical Hubs**: `src/types.ts` (fan-in: 71, fan-out: 2), `src/types/integrations.ts` (fan-in: 18, fan-out: 0), `src/types/stubs.ts` (fan-in: 14, fan-out: 0), `src/contexts/WorkspaceContext.tsx` (fan-in: 4, fan-out: 2)

## Module Inventory & Dependency Contracts
- `src/types.ts` (L0, 231L, fan-in:71) — `[deps: stubs.ts, integrations.ts]` · `[caps: PromptType, SettingsTab, ModelProviderId, ModelInfo, ProviderConnection, LocalModelLoadProgress]`
- `src/types/integrations.ts` (L0, 170L, fan-in:18) — `[deps: none]` · `[caps: IntegrationProviderId, IntegrationAuthMethod, IntegrationConnection, IntegrationCredentialsPayload, RemoteFileSource, FirebaseDocumentSummary]`
- `src/types/stubs.ts` (L0, 307L, fan-in:14) — `[deps: none]` · `[caps: StubsNode, StubsEdge, StubsInterfaceSymbol, StubsInterfaceStub, StubsHarnessCheckpoint, StubsGraphData]`
- `src/contexts/WorkspaceContext.tsx` (L3, 51L, fan-in:4) — `[deps: types.ts, speechVoices.ts]` · `[caps: SharedWorkspaceProps, WorkspaceProvider, useWorkspace]`
- `src/schemas/validation.ts` (L0, 253L, fan-in:4) — `[deps: none]` · `[caps: MessageImageSchema, IncomingMessageSchema, ProviderIdSchema, GenerateRequestSchema, ProviderVerifyRequestSchema, CountTokensRequestSchema]`
- `src/types/speechRecognition.ts` (L0, 42L, fan-in:3) — `[deps: none]` · `[caps: SpeechRecognitionResultItem, SpeechRecognitionAlternative, SpeechRecognitionResultListLike, SpeechRecognitionEventLike, SpeechRecognitionErrorEventLike, ISpeechRecognitionInstance]`
- `src/App.tsx` (L5, 713L, fan-in:1) — `[deps: types.ts, integrations.ts, TopAppBar.tsx, WorkspaceRouter.tsx, TunerBottomSheet.tsx, UnifiedSettingsModal.tsx]` · `[caps: App]`
- `src/main.tsx` (L5, 76L, fan-in:0) — `[deps: platformService.ts, App.tsx, firebaseAuthProvider.ts, ServiceContext.tsx, ErrorBoundary.tsx, pwaUpdate.ts]` · `[caps: internal]`
