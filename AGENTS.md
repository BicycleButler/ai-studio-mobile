# react-example — Agent Instructions

<!-- stubs-instructions-start -->
## Architecture Context Maps — Read First

Agent entry point: knowledge/architecture/context-map.md
Repo ADRs: knowledge/architecture/ADR/
Module specs: co-located `*.ts.md` sidecars in `src/`.

## Architecture Graph & GraphRAG Intelligence

AST dependency graph in `.stubs/graph.sqlite` and durable task ledger in `.stubs/harness-ledger.json`. Query through `npx stubs query "<query>"`:
- `map:`: Level 0 Macro Map (subsystem communities, hubs, domains)
- `stub: <target>`: Level 1 Interface Skeleton Stubs (stripped signatures, types, line links)
- `explain: <target>`: Level 2 Symbol Profile (callers, callees, PageRank)
- `path: <A> to <B>`: Shortest dependency path chain
- `blast: <target>`: Downstream impact radius and dependents
- `drift:`: AST hash deltas & drifted sidecar specs since baseline harness checkpoint
- `hubs:`: Top high-centrality architectural hubs across the 7-layer hierarchy
- `task:`: Active durable agentic coding task & topological edit plan status
- `tests: <target>`: AST-discovered direct and upstream caller unit test suites & recommended test command
- `pkg:<package> <query>`: Monorepo package-scoped query
- **Automatic Graph Maintenance:** Auto-checks file mtime (<30ms). Refresh and synchronize through `npx stubs run`.

## Core CLI Commands

- **Unified 5-Stage Repository Pipeline:** `npx stubs run` (runs AST scan, context map & sidecar sand sync, `lint-arch`, `prune`, and design compliance gate; records checkpoint and AST snapshots to `.stubs/harness-ledger.json`)
- **Durable Agentic Task Ledger & Automated Gate:** `npx stubs task list` | `npx stubs task start "<title>" --targets <f1,f2> --goal "<goal>"` | `npx stubs task verify [taskId]` | `npx stubs task step <stepId> [completed|in_progress|pending]` | `npx stubs task target <file> [edited|verified|pending]` | `npx stubs task resume <taskId>` | `npx stubs task note "<note>"` | `npx stubs task reset-baseline [taskId]` | `npx stubs task complete`
- **Deterministic Session Handoff Packet:** `npx stubs handoff [taskId] [--json]` (synthesizes a self-contained context resumption briefing with topological edit progress, AST deltas, symbol contract alerts, discovered unit tests, architectural invariant status, and L1 Interface Skeletons)
- **GraphRAG Surgical Query:** `npx stubs query "map:"` | `npx stubs query "drift:"` | `npx stubs query "hubs:"` | `npx stubs query "task:"` | `npx stubs query "tests: <target>"` | `npx stubs query "stub: <target>"` | `npx stubs query "explain: <target>"` | `npx stubs query "path: <A> to <B>"` | `npx stubs query "blast: <target>"` | `npx stubs query "pkg:<package>"`
- **Multi-Target Pre-Flight & Topological Edit Sequence:** `npx stubs pre-flight <t1> [t2...] [--guard <level>] [--order] [--context] [--json]` | `npx stubs context <target>`
- **Architecture Mapping:** `npx stubs map --generate` (refreshes `knowledge/architecture/domains/*-domain-map.md`, `knowledge/architecture/context-map.md`, and `knowledge/architecture/visual-map.md` from live AST graph)
- **Sidecar Reverse Sanding:** `npx stubs sand [file.ts.md]` (synchronizes `ast_hash`, `depends_on`, and `status_flag: clean`)
- **Design System Compliance Audit:** `npx tsx scripts/audit-design-system-compliance.ts`
<!-- stubs-instructions-end -->

## Toolchain & Conventions

- Package manager: npm (`npx` for binaries)
- Testing framework: Vitest (`npm test` / `npx vitest run`) & Node native test runner (`npx --yes tsx --test`)
- Typecheck & Linter: TypeScript + ESLint (`npm run lint`)
- Design system rules: adhere to `RULES.md` and `.agents/rules/design-rules.md` (zero resting alert colors, total badge/pill ban, single primary CTA, 24px font cap)
- Design principles: adhere to `DESIGN_PHILOSOPHY.md` (deep modules, pull complexity downward, strict 7-layer hierarchy, code cohesion)
