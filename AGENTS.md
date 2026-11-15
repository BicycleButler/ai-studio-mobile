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

- **Unified Repository Pipeline:** `npx stubs run` (runs scan, map, sand, lint-arch & automated tale remediation)
- **GraphRAG Surgical Query:** `npx stubs query "explain: <target>"` | `path: <A> to <B>` | `blast: <target>`
- **Architecture Mapping:** `npx stubs map --generate` (refreshes prerequisite domain maps + root context-map.md)
- **Spec & Architecture Grilling:** `npx stubs grill <file.md>` | `npx stubs abstract-grill <file.md>`
- **Export Knowledge Graph:** `npx stubs export <obsidian|wiki> [--out <dir>]`
<!-- stubs-instructions-end -->

## Toolchain & Conventions

- Package manager: npm (npx for binaries)
- Testing framework: jest
- Linter: eslint
- Formatter: prettier
- Design principles: adhere to DESIGN_PHILOSOPHY.md (deep modules, pull complexity downward, code cohesion)
