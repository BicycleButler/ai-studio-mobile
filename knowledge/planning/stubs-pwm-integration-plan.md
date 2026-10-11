---
title: "Stubs Web Interface & PWM (Portal Web Module) Integration Plan"
type: initiative-plan
description: "Architectural blueprint, design tree mapping, and grilling decision matrix for incorporating the Stubs Web Interface / PWM into AI Studio Mobile to inspect GitHub repositories and run architecture-as-code tooling."
tags:
  - planning
  - roadmap
  - initiative
  - stubs
  - pwm
  - github
  - architecture
phase: grill
status: completed
version: 1
status_flag: clean
initiative: stubs-pwm-integration
---

# Stubs Web Interface & PWM (Portal Web Module) Integration Plan

## Executive Summary
This initiative integrates the `stubs` Architecture-as-Code Web Portal / PWM (Portal Web Module) into the AI Studio Mobile environment. It allows developers to browse their GitHub repositories, visualize interactive dependency graphs and living Mermaid architecture diagrams, inspect AST blast radiuses and layer invariants, and trigger Stubs tool primitives (`stubs scan`, `stubs diagram`, `stubs impact`, `stubs lint-arch`, `stubs sand`, `stubs grill`) directly within the unified mobile and desktop interface.

---

## Design Tree Mapping

```
Stubs PWM & GitHub Repository Integration
├── 1. Surface Integration & Workspace Mode
│   ├── 1.1 Dedicated Top-Level Workspace Mode (`promptType: 'stubs' | 'pwm'`)
│   ├── 1.2 Extension within Mobile IDE Workspace (Tab / Sub-View)
│   └── 1.3 Modal Sheet / Drawer Overlay (Parallel to JulesSessionDrawer)
├── 2. Port & Server Topology (Cloud Sandbox Ingress Constraints)
│   ├── 2.1 Native React Component with `/api/stubs/*` REST + SSE Endpoints (Recommended)
│   ├── 2.2 Express Sub-App / Static Middleware Proxy mounting Web Portal on `/portal`
│   └── 2.3 Isolated Iframe pointing to `/portal` embedded within an Android-styled viewport
├── 3. GitHub Repository Ingestion & Multi-Repo Workspaces
│   ├── 3.1 Shared Jules GitHub Connection (`/api/jules/repos` + GitHub API v3)
│   ├── 3.2 Ephemeral Server Repo Cache (`/tmp/repos/:owner/:repo`) with Git Sparse-Checkout
│   └── 3.3 GitHub Trees API Virtual Filetree (Zero-clone AST scanning via raw octokit blobs)
├── 4. Stubs Tool Execution & Background Processing
│   ├── 4.1 In-Process Execution via `cli.cjs` exported library functions
│   ├── 4.2 Background Child Process spawning (`node .agents/skills/stubs/dist/cli.cjs`) with SSE streaming logs
│   └── 4.3 Multi-Repo SQLite Database Isolation (`.stubs/graphs/:repoSlug.sqlite`)
└── 5. UI Capabilities & Interactive Artifacts
    ├── 5.1 Interactive Dependency Graph & Mermaid Flowcharts (Interactive zoom/pan, domain grouping)
    ├── 5.2 Architectural Health & Linting Dashboard (Layer hierarchy, cycle checks)
    ├── 5.3 File Blast Radius & Impact Inspector (Fan-in, Fan-out, Risk scoring)
    └── 5.4 Spec Sidecar Studio (`*.ts.md` inspection, materialization, and interactive grilling)
```

---

## Autonomous Fact Discovery (Agent Pre-Computation)

Before opening the decision frontier to the user, the following project facts were verified:

1. **Port Constraints**: Only Port 3000 is externally accessible via the reverse proxy. Standalone dev servers on other ports (e.g. 3001, 8080) cannot be reached. Any web interface must mount on the Express server (`server.ts`) or be bundled into the React client.
2. **Existing GitHub Ecosystem**:
   - `server.ts` already exposes `/api/jules/repos` and repository discovery.
   - `src/services/julesService.ts` and `JulesSessionDrawer.tsx` already handle repository selection (`owner/repo`), branch switching, and session tracking.
3. **Existing Stubs CLI Capabilities**:
   - `cli.cjs` exports `{ runScan, runDiagram, runLintArch, runImpact }` and can be invoked either directly via Node or by requiring the module.
   - The graph database stores nodes (AST hashes, line counts, fan-in, fan-out, domain, layer) and edges (source, target, relationship, weight) in SQLite.
4. **Current Workspace Modes**:
   - `PromptType` in `src/types.ts` currently supports `"chat" | "freeform" | "structured" | "code" | "jules"`.
   - Adding a mode seamlessly hooks into `TopAppBar`, bottom navigation, and mobile frame layouts.
