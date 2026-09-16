---
title: "Workspace Navigation & Prompt Modes Consolidation Plan"
type: initiative-plan
description: "Architectural blueprint and grilling decision matrix for resolving footer drawer crowding, evaluating Freeform & Structured modalities, and establishing a cohesive mobile navigation hierarchy."
tags:
  - planning
  - navigation
  - ux
  - minimalism
  - adr-0045
phase: complete
status: completed
version: 3
status_flag: clean
initiative: workspace-navigation
---

# Workspace Navigation & Prompt Modes Consolidation Plan

## Executive Summary
The bottom navigation drawer previously rendered 6 horizontal destinations (`Chat`, `Freeform`, `Structured`, `Mobile IDE`, `Jules`, `Stubs`). On mobile viewports (360–420px), this caused horizontal cramping, violated ADR 0045 / Material 3 navigation ergonomics (which mandate 3–5 destinations maximum), and blurred the mental model by placing three Gemini prompting variants as peers to standalone developer tools (IDE, GitHub agent, Architecture portal).

Following Grilling Round 1, the user determined:
1. **Primary Navigation**: 4-slot spacious bar (`Chat`, `Mobile IDE`, `Jules`, `Stubs`).
2. **Freeform & Structured**: Absorbed into Chat as "Prompt Tools" within `PromptTemplateDrawer` (Few-Shot Builder & Variable Prompt tools) rather than occupying top-level drawer slots.
3. **State Recovery**: Invalid / legacy `promptType` values (`freeform`, `structured`) hard reset to `"chat"`.

## Design Tree Mapping

```
Workspace Navigation & Prompt Modalities
├── 1. Primary Bottom Navigation Taxonomy [SETTLED: 4-Slot Bar]
│   ├── 1.1 Chat (Conversational multimodal AI)
│   ├── 1.2 Mobile IDE (Code execution & client generation)
│   ├── 1.3 Jules (Autonomous GitHub coding agent)
│   └── 1.4 Stubs (Architecture-as-Code PWM Portal)
├── 2. Prompt Tools inside Chat [SETTLED: Absorbed into PromptTemplateDrawer]
│   ├── 2.1 Directive Templates (Existing library of modular prompts)
│   ├── 2.2 Few-Shot Builder (Structured Input/Output pair generator & injector)
│   └── 2.3 Variable Prompt Tool (Mustache {{var}} interpolator & injector)
└── 3. State & Draft Recovery Fallback [SETTLED: Hard reset to 'chat']
    ├── 3.1 storage.ts: loadDraftState maps unknown/legacy modes to 'chat'
    ├── 3.2 types.ts: PromptType union pruned to "chat" | "code" | "jules" | "stubs"
    └── 3.3 App.tsx: Top-level routing cleaned of standalone Freeform/Structured screens
```

## Round 1 Decisions (Grill Log)

- **Q1 (Navigation Taxonomy)**: Approved **Option A** — Streamlined to 4 primary destinations: `Chat`, `Mobile IDE`, `Jules`, `Stubs`.
- **Q2 (Fate of Freeform & Structured)**: Approved **Option B** — Absorbed into Chat as Prompt Tools inside `PromptTemplateDrawer` (Few-Shot Builder & Variables Interpolator), removing standalone top-level views while retaining practical few-shot and variable composition power.
- **Q3 (Draft & Migration Fallback)**: Approved **Option B** — Hard reset invalid `promptType` values to `"chat"` during startup recovery.

## Phase-by-Phase Execution & Task Tracker

### Phase 1: Specifications & Types
- [x] Settle Grilling Round 1 decisions.
- [x] Update `PromptType` union in `src/types.ts` to `"chat" | "code" | "jules" | "stubs"`.
- [x] Update `loadDraftState` and storage handlers to sanitize `promptType` to `"chat"`.

### Phase 2: Bottom Navigation Bar Refactor
- [x] Update `src/components/BottomNavBar.tsx` to render the 4 clean workspaces.
- [x] Verify balanced spacing, hit areas (≥48px), and clean visual rhythm.

### Phase 3: Absorb Few-Shot & Variable Tools into PromptTemplateDrawer
- [x] Add sub-tool switcher in `src/components/PromptTemplateDrawer.tsx`:
  - **Directives** (Standard categories & custom templates)
  - **Few-Shot Builder** (Add input/output rows, preview, and "Insert into Chat")
  - **Variables** (Define `{{var}}` template, fill form values, preview, and "Insert into Chat")
- [x] Connect `onInsertText` in `ChatWorkspace.tsx` to inject composed prompt tools directly into the active chat composer.

### Phase 4: App Cleanup & Verification
- [x] Remove top-level rendering of `FreeformWorkspace` and `StructuredWorkspace` in `src/App.tsx`.
- [x] Update `src/components/MobileIDE.test.ts` to assert the 4 distinct prompt modes.
- [x] Run `lint_applet` and `compile_applet` to ensure clean build.
