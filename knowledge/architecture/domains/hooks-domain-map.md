---
title: Hooks Domain — Domain Context Map
type: domain-context-map
domain: hooks
parent_map: ../context-map.md
description: Deep-dive context map for the hooks domain, subsystem responsibilities, and internal modules.
tags:
  - domain-map
  - hooks
  - agent-optimized
---

# Hooks Domain — Domain Context Map

Parent Context Map: knowledge/architecture/context-map.md

## Domain Purpose & Responsibilities
The Hooks Domain coordinates domain logic, core types, and services for the hooks subsystem.

## Key Modules & Files
src/hooks/useSpeechToText.ts (Hub) -> deps: none | caps: ISpeechRecognitionFactory, UseSpeechToTextOptions, UseSpeechToTextReturn, useSpeechToText
src/hooks/useGeminiStream.ts -> deps: none | caps: UseGeminiStreamOptions, UseGeminiStreamReturn, useGeminiStream
src/hooks/stubs/useStubsTerminal.ts -> deps: none | caps: LogEntry, useStubsTerminal
src/hooks/useBatchSelection.ts -> deps: none | caps: UseBatchSelectionProps, useBatchSelection
src/hooks/useBulkActionConfirm.ts -> deps: none | caps: UseBulkActionConfirmProps, useBulkActionConfirm
src/hooks/useClipboardKeySniffer.ts -> deps: none | caps: UseClipboardKeySnifferOptions, useClipboardKeySniffer
src/hooks/useControllableState.ts -> deps: none | caps: UseControllableStateParams, useControllableState
src/hooks/useKeyboardNavigation.ts -> deps: none | caps: UseKeyboardNavigationOptions, useKeyboardNavigation
src/hooks/useOfflineSync.ts -> deps: none | caps: ReconnectState, useOfflineSync
src/hooks/useWindowSecurity.ts -> deps: none | caps: UseWindowSecurityOptions, useWindowSecurity
src/hooks/settings/useSettingsProjectsState.ts -> deps: none | caps: useSettingsProjectsState
src/hooks/stubs/useStubsData.ts -> deps: none | caps: useStubsData
src/hooks/stubs/useStubsSpecs.ts -> deps: none | caps: useStubsSpecs
src/hooks/useAppAuth.ts -> deps: none | caps: useAppAuth
src/hooks/useBackNavigation.ts -> deps: none | caps: useBackNavigation
src/hooks/useChatSession.ts -> deps: none | caps: useChatSession
src/hooks/useGlobalKeydown.ts -> deps: none | caps: useGlobalKeydown
src/hooks/useGoogleAuth.ts -> deps: none | caps: useGoogleAuth
src/hooks/useJules.ts -> deps: none | caps: useJules
src/hooks/useModelConfig.ts -> deps: none | caps: useModelConfig
src/hooks/useNetworkStatus.ts -> deps: none | caps: useNetworkStatus
src/hooks/useOfflineQueue.ts -> deps: none | caps: useOfflineQueue
src/hooks/usePWAInstall.ts -> deps: none | caps: usePWAInstall
src/hooks/useProjectManager.ts -> deps: none | caps: useProjectManager
src/hooks/usePromptTemplates.ts -> deps: none | caps: usePromptTemplates
src/hooks/useStore.ts -> deps: none | caps: useStore
src/hooks/useTheme.ts -> deps: none | caps: useTheme
src/hooks/useAppState.ts -> deps: none | caps: useAppState
src/hooks/useUIState.ts -> deps: none | caps: useUIState

## Domain Invariants
- Downward dependencies only: cross-domain calls must target canonical domain hubs.
- External consumers must interface through useSpeechToText.ts, never private internal helpers.
- State changes must adhere to lifecycle and containment invariants.
