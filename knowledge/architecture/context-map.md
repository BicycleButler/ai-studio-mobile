---
title: Project Architecture Context Map
type: context-map
description: High-level architectural map of core domains, subsystem responsibilities, and dependency flows.
tags:
  - architecture
  - context-map
  - agent-optimized
---

# Architecture Context Map

## Routing & Entrypoints
Entry (Layer 0): src/types.ts -> domain: core
Entry (Layer 0): src/types/speechRecognition.ts -> domain: core
Entry (Layer 0): src/types/stubs.ts -> domain: core

## Subsystem Matrix
Utils Domain (L1): src/utils/platform.ts -> deps: none | caps: AppRuntime, isBrowserEnvironment, WindowWithMatchMedia, WindowWithSpeech
Components Domain (L2): src/components/ui/index.ts -> deps: none | caps: AccountSettingsProps, ProjectSettingsProps, SpeechSettingsProps, LibrarySettingsProps
Services Domain (L3): src/services/platformService.ts -> deps: none | caps: BrowserPlatformService, getStorageEventObservable, getStorageQuotaObservable, isInputFocused
Hooks Domain (L4): src/hooks/useSpeechToText.ts -> deps: none | caps: ISpeechRecognitionFactory, UseSpeechToTextOptions, UseSpeechToTextReturn, useSpeechToText
Core Entrypoints & Runtime (L5): src/types.ts -> deps: none | caps: PromptType, SettingsTab, ModelInfo, MessageAttachment

## Domain Maps & Specs
- utils: knowledge/architecture/domains/utils-domain-map.md (hub: src/utils/platform.ts)
- components: knowledge/architecture/domains/components-domain-map.md (hub: src/components/ui/index.ts)
- services: knowledge/architecture/domains/services-domain-map.md (hub: src/services/platformService.ts)
- hooks: knowledge/architecture/domains/hooks-domain-map.md (hub: src/hooks/useSpeechToText.ts)
- core: knowledge/architecture/domains/core-domain-map.md (hub: src/types.ts)

## Boundary Invariants
- Downward dependencies only: consumers depend on lower layers, never higher layers.
- Cross-domain calls must target the domain canonical hub module, never internal private helpers.
- Repo-level architectural decisions recorded in knowledge/architecture/ADR/. Module nuances recorded in domain maps and sidecars.

## Visual Architecture Map
Human visual Mermaid diagrams: knowledge/architecture/visual-map.md (agents: do not read unless requested)
