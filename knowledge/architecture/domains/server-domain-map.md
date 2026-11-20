---
title: "Server Domain Map"
type: domain-context-map
status: active
domain: server
layer: 6
---

# Server Domain Map

> Node.js Express backend routes, SQLite AST GraphRAG engine, provider proxies, and child process orchestration.

## Domain Metrics & Canonical Hubs
- **Layer Tier**: Layer 6 (Express & Stubs AST Engine Runtime)
- **Production Modules**: 8
- **Canonical Hubs**: `server/stateStore.ts` (fan-in: 4, fan-out: 0), `server.ts` (fan-in: 3, fan-out: 11), `server/stubsService.ts` (fan-in: 3, fan-out: 2), `server/serverContext.ts` (fan-in: 2, fan-out: 7)

## Module Inventory & Dependency Contracts
- `server/stateStore.ts` (L6, 409L, fan-in:4) — `[deps: none]` · `[caps: GoogleSessionUser, SetItemsResult, DEFAULT_SESSION_MAX_AGE_MS, MAX_SCOPED_ITEMS_JSON_BYTES, ServerStateStore]`
- `server.ts` (L6, 3126L, fan-in:3) — `[deps: serverContext.ts, stateStore.ts, validation.ts, modelCatalog.ts, stubsService.ts, genai.ts]` · `[caps: GoogleCredentialVerificationResult, GoogleCredentialVerifier, RateLimitConfig, CreateAppOptions, createApp, startServer]`
- `server/stubsService.ts` (L6, 4814L, fan-in:3) — `[deps: serverContext.ts, types.ts]` · `[caps: stubsEvents, closeStubsDatabase, scanWorkspace, getGraphData, discoverAffectedTests, extractInterfaceStub]`
- `server/serverContext.ts` (L6, 39L, fan-in:2) — `[deps: urlUtils.ts, apiResponseParser.ts, apiClientInterceptors.ts, apiClient.ts, logger.ts, processRunner.ts]` · `[caps: IServerServices, IServerContext, ServerContext, defaultServerContext]`
- `server/utils/genai.ts` (L6, 56L, fan-in:2) — `[deps: none]` · `[caps: clearGenAIClientCache, getGenAIClient]`
- `server/utils/integrations.ts` (L6, 1856L, fan-in:2) — `[deps: integrations.ts, errorHandling.ts]` · `[caps: IntegrationHttpError, resolveGoogleAuthContext, decodeFirestoreValue, decodeFirestoreFields, encodeFirestoreValue, encodeFirestoreFields]`
- `server/utils/processRunner.ts` (L6, 181L, fan-in:2) — `[deps: timeProvider.ts]` · `[caps: ProcessLogEvent, ProcessRunnerOptions, IProcessRunner, ProcessRunner]`
- `server/utils/providers.ts` (L6, 1285L, fan-in:1) — `[deps: types.ts, providerCatalog.ts, errorHandling.ts]` · `[caps: ProviderRequestContext, ProviderGeneratePayload, validateProviderBaseUrl, isValidOpenAIChatModelId, discoverProviderModels, streamExternalProviderChat]`
