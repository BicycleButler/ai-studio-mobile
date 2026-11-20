# Design Philosophy & Durable Agentic Architecture

This document defines the foundational software engineering and UI/UX principles governing this repository. All human and AI coding agents must adhere to these invariants when designing, refactoring, or verifying modules.

---

## 1. Deep Modules & Pulling Complexity Downward (Ousterhout's Principle)

- **Deep Modules over Shallow Pass-Throughs**: Prefer modules with simple, narrow, strongly typed public interfaces (`src/types.ts`, `src/types/stubs.ts`, `src/services/IPlatformService.ts`) that encapsulate rich internal capabilities (`server/stubsService.ts`, `src/services/stubsService.ts`, `src/utils/storage/encryption.ts`).
- **Pull Complexity Downward**: Infrastructure modules (Layer 0–2 and Layer 6) absorb edge cases—such as SQLite WAL concurrency, AST parsing, mtime staleness detection, AES-GCM key derivation, and SSE reconnection—so higher-level React hooks (Layer 3) and UI components (Layer 4) remain declarative and straightforward.
- **Information Hiding & Code Cohesion**: Keep state transformation, validation schemas (`src/schemas/validation.ts`), and persistence adapters cohesive within their domain boundary rather than leaking low-level implementation details across layers.

---

## 2. Strict 7-Layer Dependency Hierarchy

Every TypeScript module belongs to a deterministic architectural layer enforced by `npx stubs lint-arch`:

| Layer | Domain | Path Scope | Responsibility & Import Rule |
| :--- | :--- | :--- | :--- |
| **Layer 0** | `core` | `src/types.ts`, `src/types/**`, `src/schemas/**` | Pure data contracts, TypeScript interfaces, and Zod schemas. **Imports nothing from Layers 1–6.** |
| **Layer 1** | `utils` | `src/utils/**`, `src/data/**` | Pure utilities, platform detection, API client, and AES-GCM encrypted storage. Imports only Layer 0 (and `IPlatformService` type contract). |
| **Layer 2** | `services` | `src/services/**` | Domain services (`StubsClient`, `chatHistoryService`, `promptTemplateService`, `themeService`). Imports Layers 0–1. |
| **Layer 3** | `hooks` / `core` | `src/hooks/**`, `src/contexts/**` | React state orchestration hooks and workspace contexts. Imports Layers 0–2. |
| **Layer 4** | `components` | `src/components/**` | Declarative React UI components and workspaces. Imports Layers 0–3. |
| **Layer 5** | `core` | `src/App.tsx`, `src/main.tsx` | Application entrypoints and top-level composition. |
| **Layer 6** | `server` | `server.ts`, `server/**` | Node.js Express runtime, SQLite AST GraphRAG engine, and provider proxies. |

---

## 3. Progressive Disclosure & Surgical Context (Tiered GraphRAG)

To prevent context window pollution and stale assumptions during multi-turn agentic coding:

1. **Tier 0 / Level 0 Macro Orientation (`map:`)**: Start at `knowledge/architecture/context-map.md` or run `npx stubs query "map:"` to identify domain hubs and layer boundaries.
2. **Level 1 Interface Skeleton Stubs (`stub: <target>`)**: Query `npx stubs query "stub: <module>"` to inspect stripped TypeScript signatures, exported types, and 1-indexed line links (`// L12-L45`) at ~65–85% token savings before reading full implementation bodies.
3. **Level 2 Symbol Profile & Blast Radius (`explain:` / `blast:`)**: Before modifying shared contracts (Fan-In >= 3), run `npx stubs pre-flight <target>` or `npx stubs query "blast: <target>"` to compute the **Topological Edit Sequence** (Dependencies -> Target -> Callers).
4. **Post-Edit Harness Synchronization (`npx stubs run`)**: Execute the 5-stage verification pipeline to re-index the AST graph, auto-sand co-located `*.ts.md` sidecars, regenerate domain context maps, enforce architectural invariants, and verify zero Design System ADR violations.

---

## 4. High-Craft UI & Zero-Slop Discipline

All UI surfaces enforce the architectural design system codified in `RULES.md` and `.agents/skills/design/knowledge/design/`:

- **Zero Semantic Alert Colors at Rest (ADR 0020 & ADR 0036)**: Resting surfaces, banners, and action icons use neutral tokens (`bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`). Semantic alert colors (`destructive`, `warning`, `success`) appear only in transient toasts, open confirmation dialogs, active form validation errors, or `:hover` states.
- **Total Badge & Pill Ban (ADR 0035)**: Status metadata uses Concept C typographic sub-label stacking (`font-mono tabular-nums text-muted-foreground`) rather than decorative colored pills or status dots.
- **Single Primary CTA & 24px Typography Cap (ADR 0019 & ADR 0029)**: At most one primary CTA button per toolbar or surface; functional application typography is capped at `text-2xl` (24px) with `tabular-nums` on all quantitative metrics.
