---
title: Project Architecture Context Map
type: context-map
description: High-level architectural map of core domains, subsystem responsibilities, and data flows.
tags:
  - architecture
  - context-map
---

# Project Architecture Context Map

## Purpose & Overview
**AI Studio Mobile** is a responsive, mobile-first Google AI Studio prompt engineering environment and playground built with React 19, TypeScript, Vite, Tailwind CSS, and the `@google/genai` SDK. It empowers developers and prompt designers to experiment with Gemini models (Gemini 2.5 Flash, Gemini Pro, Thinking models, Vision, and Audio) with real-time streaming, speech-to-text, prompt templates, structured output JSON schema validation, and multi-language code export.

## Domain Index & Architecture Map

| Domain | Subsystem / Responsibility | Context Map |
| :--- | :--- | :--- |
| **Auth & Identity** | Google OAuth 2.0, API key persistence, validation against GenAI API | [Auth Domain Map](domains/auth-domain-map.md) |
| **Workspaces & UI** | Chat, Freeform, Structured, and Mobile IDE prompt interfaces, navigation, settings | [Workspaces Domain Map](domains/workspaces-domain-map.md) |
| **Gemini Engine & Streaming** | `@google/genai` SDK streaming engine, speech-to-text, audio voices, image compression | [Gemini Engine Domain Map](domains/gemini-engine-domain-map.md) |
| **Storage, Schemas & Utilities** | LocalStorage state, Zod schemas, starter templates, multi-language code export | [Storage & Schemas Domain Map](domains/data-storage-domain-map.md) |

---

## High-Level Subsystem Communication Graph

```mermaid
flowchart TB
  subgraph UI_Layer ["Workspaces & UI Domain"]
    TopNav[TopAppBar / BottomNavBar]
    AppRoot[App.tsx Coordinator]
    Chat[ChatWorkspace]
    Freeform[FreeformWorkspace]
    Structured[StructuredWorkspace]
    MobileIDE[MobileIDEWorkspace]
    Modals[Settings, Modals & Sheets]
  end

  subgraph Auth_Domain ["Auth & Identity Domain"]
    GoogleAuth[services/googleAuth.ts]
    KeyVerify[services/keyVerification.ts]
    ApiKeyModal[components/ApiKeyModal.tsx]
  end

  subgraph Engine_Domain ["Gemini Engine & Streaming"]
    StreamService[services/geminiStreamService.ts]
    StreamHook[hooks/useGeminiStream.ts]
    SpeechVoice[services/speechVoices.ts]
    SpeechHook[hooks/useSpeechToText.ts]
    GenAISDK["@google/genai SDK"]
  end

  subgraph Storage_Domain ["Storage & Utilities Domain"]
    StorageUtil[utils/storage.ts]
    ValidationSchema[schemas/validation.ts]
    CodeGenerators[utils/codeGenerators.ts]
    TemplatesData[data/templates.ts]
  end

  %% Relationships
  AppRoot --> TopNav
  AppRoot --> Chat & Freeform & Structured & MobileIDE
  AppRoot --> Modals
  AppRoot --> GoogleAuth
  AppRoot --> StorageUtil

  Chat & Freeform & Structured --> StreamHook
  StreamHook --> StreamService
  StreamService --> GenAISDK

  Chat --> SpeechHook
  SpeechHook --> SpeechVoice

  ApiKeyModal --> KeyVerify
  KeyVerify --> GenAISDK
  KeyVerify --> StorageUtil

  MobileIDE --> CodeGenerators
  StorageUtil --> ValidationSchema
  Modals --> TemplatesData
```

---

## Architectural Hotspots & Hubs Analysis

Based on the `stubs` SQLite dependency graph analysis (184 nodes, 442 edges), the following nodes act as core hubs:

1. **`src/types.ts`** (Fan-In: 25, Fan-Out: 15, Degree: 40): Universal type registry defining `ChatMessage`, `PromptConfig`, `SavedPrompt`, and `ModelInfo`.
2. **`src/utils/storage.ts`** (Fan-In: 8, Fan-Out: 25, Degree: 33): Central persistence hub for local state and prompt synchronization.
3. **`src/App.tsx`** (Fan-In: 1, Fan-Out: 28, Degree: 29): Root presentation coordinator connecting all workspaces and modals.
4. **`src/components/UnifiedSettingsModal.tsx`** (Fan-In: 3, Fan-Out: 20, Degree: 23): Global settings manager handling credentials, prompt parameters, and preferences.
5. **`src/components/ChatWorkspace.tsx`** (Fan-In: 1, Fan-Out: 21, Degree: 22): Primary conversational interface driving multimodal streams and voice interactions.

> **Verification Status**:
> - Circular dependency cycles: **0** (PASSED)
> - Downward layer violations: **0** (PASSED)
> - Domain boundary leaks: **0** (PASSED)
