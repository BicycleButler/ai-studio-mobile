---
title: Core Entrypoints & Runtime — Domain Context Map
type: domain-context-map
domain: core
parent_map: ../context-map.md
description: Deep-dive context map for the core domain, subsystem responsibilities, and internal modules.
tags:
  - domain-map
  - core
  - agent-optimized
---

# Core Entrypoints & Runtime — Domain Context Map

Parent Context Map: knowledge/architecture/context-map.md

## Domain Purpose & Responsibilities
The Core Entrypoints & Runtime coordinates domain logic, core types, and services for the core subsystem.

## Key Modules & Files
src/types.ts (Hub) -> deps: none | caps: PromptType, SettingsTab, ModelInfo, MessageAttachment, PromptTemplateCategory, PromptTemplate, ComposePromptPayload, ChatMessage
src/types/speechRecognition.ts -> deps: none | caps: SpeechRecognitionResultItem, SpeechRecognitionAlternative, SpeechRecognitionResultListLike, SpeechRecognitionEventLike, SpeechRecognitionErrorEventLike, ISpeechRecognitionInstance
src/types/stubs.ts -> deps: none | caps: StubsNode, StubsEdge, StubsGraphData, StubsLintViolation, StubsImpactResult, StubsSidecarSpec
src/schemas/validation.ts -> deps: none | caps: ValidatedGenerateRequest, ValidatedIncomingMessage, ValidatedCountTokensRequest, ValidatedTTSRequest, formatZodError
src/contexts/WorkspaceContext.tsx -> deps: none | caps: SharedWorkspaceProps, WorkspaceProvider, useWorkspace
src/App.tsx -> deps: none | caps: App
src/main.tsx -> deps: none | caps: internal
src/data/templates.ts -> deps: none | caps: internal

## Domain Invariants
- Downward dependencies only: cross-domain calls must target canonical domain hubs.
- External consumers must interface through types.ts, never private internal helpers.
- State changes must adhere to lifecycle and containment invariants.
