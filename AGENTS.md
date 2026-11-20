# react-example — Agent Instructions

<!-- stubs-instructions-start -->
## Architecture Context Maps — Read First

Agent entry point: knowledge/architecture/context-map.md
Repo ADRs: knowledge/architecture/ADR/
Module specs: co-located `*.ts.md` sidecars in `src/`.

## Architecture Graph & GraphRAG Intelligence

AST dependency graph in `.stubs/graph.sqlite`. Query through `npx stubs query "<query>"`:
- `map:`: Level 0 Macro Map (subsystem communities, hubs, domains)
- `stub: <target>`: Level 1 Interface Skeleton Stubs (stripped signatures, types, line links)
- `explain: <target>`: Level 2 Symbol Profile (callers, callees, PageRank)
- `path: <A> to <B>`: Shortest dependency path chain
- `blast: <target>`: Downstream impact radius and dependents
- `pkg:<package> <query>`: Monorepo package-scoped query
- **Automatic Graph Maintenance:** Auto-checks file mtime (<30ms). Refresh and synchronize through `npx stubs run`.

## Core CLI Commands

- **Unified 5-Stage Repository Pipeline:** `npx stubs run` (runs AST scan, context map & sidecar sand sync, `lint-arch`, `prune`, and design compliance gate; records checkpoint to `.stubs/harness-ledger.json`)
- **GraphRAG Surgical Query:** `npx stubs query "map:"` | `npx stubs query "stub: <target>"` | `npx stubs query "explain: <target>"` | `npx stubs query "path: <A> to <B>"` | `npx stubs query "blast: <target>"` | `npx stubs query "pkg:<package>"`
- **Pre-Flight Blast Radius & Topological Edit Sequence:** `npx stubs pre-flight <target>` | `npx stubs context <target>`
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
