---
title: "Hooks Domain Map"
type: domain-context-map
status: active
domain: hooks
layer: 3
---

# Hooks Domain Map

> Modular React state hooks for chat streaming, voice input, settings, integrations, and Stubs architecture intelligence.

## Domain Metrics & Canonical Hubs
- **Layer Tier**: Layer 3 (React Hooks & State Orchestration)
- **Production Modules**: 30
- **Canonical Hubs**: `src/hooks/useStore.ts` (fan-in: 8, fan-out: 1), `src/hooks/useBackNavigation.ts` (fan-in: 4, fan-out: 1), `src/hooks/useBatchSelection.ts` (fan-in: 4, fan-out: 3), `src/hooks/useIntegrations.ts` (fan-in: 4, fan-out: 5)

## Module Inventory & Dependency Contracts
- `src/hooks/useStore.ts` (L3, 24L, fan-in:8) — `[deps: observable.ts]` · `[caps: useStore]`
- `src/hooks/useBackNavigation.ts` (L3, 104L, fan-in:4) — `[deps: ServiceContext.tsx]` · `[caps: useBackNavigation]`
- `src/hooks/useBatchSelection.ts` (L3, 112L, fan-in:4) — `[deps: batchSelectionManager.ts, useStore.ts, ServiceContext.tsx]` · `[caps: UseBatchSelectionProps, useBatchSelection, SelectionState]`
- `src/hooks/useIntegrations.ts` (L3, 326L, fan-in:4) — `[deps: integrations.ts, ServiceContext.tsx, integrationService.ts, integrationCatalog.ts, errorHandling.ts]` · `[caps: ConnectIntegrationInput, useIntegrations]`
- `src/hooks/useProviderConnections.ts` (L3, 271L, fan-in:4) — `[deps: types.ts, ServiceContext.tsx, localModelService.ts, providerCatalog.ts, errorHandling.ts]` · `[caps: ConnectProviderInput, useProviderConnections]`
- `src/hooks/useGlobalKeydown.ts` (L3, 44L, fan-in:3) — `[deps: ServiceContext.tsx]` · `[caps: useGlobalKeydown]`
- `src/hooks/useOfflineQueue.ts` (L3, 11L, fan-in:3) — `[deps: offlineService.ts, ServiceContext.tsx, useStore.ts]` · `[caps: useOfflineQueue]`
- `src/hooks/useAppState.ts` (L3, 348L, fan-in:2) — `[deps: ServiceContext.tsx, useAppAuth.ts, usePromptTemplates.ts, useChatSession.ts, useProjectManager.ts, useUIState.ts]` · `[caps: useAppState]`
- `src/hooks/useControllableState.ts` (L3, 42L, fan-in:2) — `[deps: none]` · `[caps: UseControllableStateParams, useControllableState]`
- `src/hooks/useGeminiStream.ts` (L3, 178L, fan-in:2) — `[deps: types.ts, geminiStreamService.ts, ServiceContext.tsx, streamCoalescer.ts]` · `[caps: UseGeminiStreamOptions, UseGeminiStreamReturn, useGeminiStream]`
- `src/hooks/useGoogleAuth.ts` (L3, 67L, fan-in:2) — `[deps: types.ts, ServiceContext.tsx]` · `[caps: useGoogleAuth]`
- `src/hooks/useKeyboardNavigation.ts` (L3, 44L, fan-in:2) — `[deps: none]` · `[caps: UseKeyboardNavigationOptions, useKeyboardNavigation]`
- `src/hooks/useNetworkStatus.ts` (L3, 17L, fan-in:2) — `[deps: useStore.ts, networkStatus.ts, ServiceContext.tsx]` · `[caps: useNetworkStatus]`
- `src/hooks/useOfflineSync.ts` (L3, 271L, fan-in:2) — `[deps: useNetworkStatus.ts, offlineService.ts, ServiceContext.tsx, useOfflineQueue.ts, syncConflictBus.ts, syncVersionTracker.ts]` · `[caps: ReconnectState, useOfflineSync]`
- `src/hooks/useTheme.ts` (L3, 29L, fan-in:2) — `[deps: themeService.ts, ServiceContext.tsx]` · `[caps: useTheme]`
- `src/hooks/settings/useSettingsProjectsState.ts` (L3, 41L, fan-in:1) — `[deps: useBatchSelection.ts, types.ts]` · `[caps: useSettingsProjectsState]`
- `src/hooks/stubs/useStubsData.ts` (L3, 421L, fan-in:1) — `[deps: ServiceContext.tsx, errorHandling.ts, types.ts, stubsService.ts]` · `[caps: useStubsData]`
- `src/hooks/stubs/useStubsSpecs.ts` (L3, 127L, fan-in:1) — `[deps: errorHandling.ts, types.ts, ServiceContext.tsx]` · `[caps: useStubsSpecs]`
- `src/hooks/stubs/useStubsTerminal.ts` (L3, 121L, fan-in:1) — `[deps: ServiceContext.tsx, types.ts]` · `[caps: LogEntry, useStubsTerminal]`
- `src/hooks/useAppAuth.ts` (L3, 80L, fan-in:1) — `[deps: types.ts, ServiceContext.tsx]` · `[caps: useAppAuth]`
- `src/hooks/useBulkActionConfirm.ts` (L3, 37L, fan-in:1) — `[deps: none]` · `[caps: UseBulkActionConfirmProps, useBulkActionConfirm]`
- `src/hooks/useChatSession.ts` (L3, 86L, fan-in:1) — `[deps: ServiceContext.tsx, types.ts, promptTemplateService.ts, useStore.ts]` · `[caps: useChatSession]`
- `src/hooks/useClipboardKeySniffer.ts` (L3, 111L, fan-in:1) — `[deps: ServiceContext.tsx]` · `[caps: useClipboardKeySniffer]`
- `src/hooks/useModelConfig.ts` (L3, 67L, fan-in:1) — `[deps: types.ts, ServiceContext.tsx, modelCatalog.ts]` · `[caps: useModelConfig]`
- `src/hooks/useProjectManager.ts` (L3, 152L, fan-in:1) — `[deps: ServiceContext.tsx, useStore.ts, types.ts]` · `[caps: useProjectManager]`
- `src/hooks/usePromptTemplates.ts` (L3, 33L, fan-in:1) — `[deps: none]` · `[caps: usePromptTemplates]`
- `src/hooks/usePWAInstall.ts` (L3, 39L, fan-in:1) — `[deps: ServiceContext.tsx, useStore.ts]` · `[caps: usePWAInstall]`
- `src/hooks/useSpeechToText.ts` (L3, 356L, fan-in:1) — `[deps: ServiceContext.tsx, speechRecognition.ts]` · `[caps: ISpeechRecognitionFactory, UseSpeechToTextOptions, UseSpeechToTextReturn, useSpeechToText]`
- `src/hooks/useUIState.ts` (L3, 57L, fan-in:1) — `[deps: types.ts, speechVoices.ts, ServiceContext.tsx]` · `[caps: useUIState]`
- `src/hooks/useWindowSecurity.ts` (L3, 39L, fan-in:1) — `[deps: ServiceContext.tsx, useStore.ts]` · `[caps: useWindowSecurity]`
