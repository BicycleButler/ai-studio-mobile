---
title: "Google Jules Workflow & Agent Integration Plan"
type: initiative-plan
description: "Architectural blueprint and execution plan for incorporating Google Jules (jules.google.com) coding agent workflows, credential ingestion, session management, and polymorphic chat into the AI Studio Mobile workspace."
tags:
  - planning
  - roadmap
  - initiative
  - jules
  - agent
phase: grill
status: in_progress
version: 1
status_flag: clean
initiative: jules-integration
---

# Google Jules Workflow & Agent Integration Plan

## Executive Summary
This initiative integrates Google Jules (`jules.google.com`) into the existing AI Studio playground workspace. It enables users to switch to a dedicated "Jules Agent" workspace mode, ingest and sniff Jules API keys via familiar in-app tab/clipboard workflows, manage GitHub-connected Jules task sessions in a dedicated drawer, and execute multi-turn agentic coding tasks via an enriched polymorphic chat interface backed by a secure full-stack backend proxy.

## Settled Architectural Decisions (Rounds 1, 2 & 3)
- **ADR-J1 (Workspace Mode):** Dedicated workspace mode `promptType: 'jules'` added to `TopAppBar` mode selector.
- **ADR-J2 (Session Management):** Dedicated Jules session area / drawer decoupled from standard AI Studio prompt history, tracking GitHub repositories, tasks, stages, and PRs.
- **ADR-J3 (Chat Polymorphism):** Polymorphic message stream in `ChatWorkspace` supporting structured Jules activity cards (steps, diffs, approvals, PR links).
- **ADR-J4 (Key Ingestion):** Unified credential modal (`ApiKeyModal`) and in-app tab browser (`CustomTabBrowserModal`) with service selector (`Google AI Studio` vs `Google Jules`) targeting `jules.google.com/settings` with clipboard sniffing.
- **ADR-J5 (Backend Proxy):** Dedicated server gateway `/api/jules/*` in `server.ts` providing secure proxying, real verification, and no simulated mock layers.
- **ADR-J6 (Session & Task Model):** Comprehensive GitHub-centric session model (`JulesSession`) tracking `repository`, `branch`, `status`, `plan`, `steps`, `pullRequest`, and multi-turn messages.
- **ADR-J7 (TopAppBar Toolbar):** Adaptive contextual toolbar when `promptType === 'jules'` showing repository/branch selector, active task status, and Jules session drawer trigger.
- **ADR-J8 (Human-in-the-Loop Gating):** Configurable auto-approve toggle ("Auto-approve plans") in Jules settings, supporting both interactive review/revision and automated execution.
- **ADR-J9 (Credential Scope):** Single user-account-level Jules API key (`jules_api_key`) granting access to all authorized repositories across all projects without duplicate project-level keys.
- **ADR-J10 (No Mock/Simulated Layer):** Real live integration only. The backend proxy forwards to the real Jules API with `x-goog-api-key` and propagates real error/status responses cleanly to the client.
- **ADR-J11 (Repository Discovery):** Dynamic repository discovery via `GET /api/jules/repos` with direct in-app link to grant new repos on `jules.google.com` and manual input fallback.
- **ADR-J12 (Adaptive Polling Engine):** 2.5-second adaptive polling over `/api/jules/tasks/:id` for resilient task execution monitoring across container and mobile viewports.
- **ADR-J13 (Session Management Drawer):** Right-side slide-over drawer (`JulesSessionDrawer`) with status filters, PR links, and instant chat resumption.
- **ADR-J14 (In-Chat Onboarding Card):** Non-intrusive in-chat Jules hero card with one-tap credential modal launcher and clear instructions.

## Planned Architecture & File Tree Blueprint
```filetree
src/
  types.ts                           # [MODIFY] Add Jules types, promptType 'jules', session models
  services/
    julesService.ts                  # [NEW] Jules API client & session manager
    julesService.ts.md               # [MODIFY] Spec sidecar for Jules service
    keyVerification.ts               # [MODIFY] Add Jules key pattern detection & validation
    auth.ts                          # [MODIFY] Add Jules auth headers & storage keys
  components/
    ApiKeyModal.tsx                  # [MODIFY] Service tabs for AI Studio vs Jules
    CustomTabBrowserModal.tsx        # [MODIFY] Support Jules settings URL & clipboard sniffing
    TopAppBar.tsx                    # [MODIFY] Add 'Jules Agent' mode & repo/task toolbar
    ChatWorkspace.tsx                # [MODIFY] Render Jules task cards, steps & action buttons
    JulesSessionDrawer.tsx           # [NEW] Dedicated Jules session & repo management drawer
  utils/
    storage.ts                       # [MODIFY] Jules key, session & settings persistence
server.ts                            # [MODIFY] Add /api/jules/* proxy routes
```

## Phase-by-Phase Execution & Task Tracker

### Phase 1: Conceptualize & Specification Scaffolding
- [x] Define domain boundaries and problem framing.
- [x] Round 1 Architectural Decision Frontier settled.

### Phase 2: Grill & Stress-Testing
- [x] Round 1: Core Architecture, Mode Switching & Boundary Definition.
- [x] Round 2: Data Schemas, Jules API Contracts & UI Interaction Details.
- [x] Round 3: Execution Lifecycle, Error Handling & Fallback Strategy.

### Phase 3: Spec & Sidecar Definition
- [x] Finalize `src/services/julesService.ts.md`.
- [x] Finalize updated schemas in `src/types.ts`.

### Phase 4: Materialization & Core Implementation
- [ ] Implement backend proxy routes in `server.ts`.
- [x] Implement `src/services/julesService.ts`.
- [ ] Update `ApiKeyModal.tsx` and `CustomTabBrowserModal.tsx`.
- [ ] Implement `JulesSessionDrawer.tsx`.
- [ ] Update `ChatWorkspace.tsx` and `TopAppBar.tsx`.

### Phase 5: Sanding, Testing & Verification
- [ ] Unit tests for Jules key verification and service methods.
- [ ] Validate compilation and linting.
