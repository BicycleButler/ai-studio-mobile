#!/usr/bin/env tsx
import {
  runCliCommand,
  closeStubsDatabase,
} from "../server/stubsService";
import { StubsCommandName } from "../src/types/stubs";

const SUPPORTED_COMMANDS = new Set<StubsCommandName>([
  "run",
  "scan",
  "lint-arch",
  "diagram",
  "impact",
  "sand",
  "query",
  "pre-flight",
  "prune",
  "phase",
  "context",
  "map",
  "harness",
]);

function printUsage(): void {
  console.log(`Stubs — Durable Agentic Coding & AST GraphRAG Harness

Usage:
  npx stubs <command> [args...]

Core Commands:
  run                           Execute 5-stage pipeline (scan -> maps & sand -> lint-arch -> prune -> design-audit)
  harness                       Alias for 'run' with durable checkpoint verification
  scan                          Perform TypeScript AST scan and synchronize .stubs/graph.sqlite
  query "<query>"               Execute GraphRAG & surgical graph query:
                                  - "map:"               Level 0 Macro Map
                                  - "stub: <target>"     Level 1 Interface Skeleton Stubs (stripped bodies + line links)
                                  - "explain: <target>"  Level 2 Symbol Profile (callers, callees, exports)
                                  - "path: <A> to <B>"   Shortest directed dependency chain
                                  - "blast: <target>"    Downstream impact radius & topological edit order
                                  - "pkg:<package>"      Package-scoped consumer audit
  map [--generate]              Synchronize prerequisite domain maps + root context-map.md from live AST graph
  lint-arch                     Verify 7-layer dependency hierarchy, cycle freedom, and sidecar manifest parity
  prune                         Audit phantom sidecars, zombie exports, and stale DB nodes
  pre-flight <target>           Evaluate blast radius safety gate and topological edit order before editing
  impact <target>               Compute direct/transitive callers and domain boundary crossings
  context <target>              Generate L0/L1/L2 tiered agent context briefing with L1 interface stub
  sand [file.ts.md]             Reverse-sand sidecar frontmatter (ast_hash, depends_on, status_flag) from AST
  diagram [--group-by domain]   Generate Mermaid system topology diagram
  phase [status]                Inspect 5-phase lifecycle status across tracked sidecars and plans
`);
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  if (rawArgs.length === 0 || rawArgs[0] === "--help" || rawArgs[0] === "-h" || rawArgs[0] === "help") {
    printUsage();
    process.exit(0);
  }

  const cmd = rawArgs[0] as StubsCommandName;
  const cmdArgs = rawArgs.slice(1);

  if (!SUPPORTED_COMMANDS.has(cmd)) {
    console.error(`Unknown stubs command '${cmd}'. Run 'npx stubs --help' for usage.`);
    process.exit(1);
  }

  try {
    const res = await runCliCommand(cmd, cmdArgs);
    if (res.stdout) {
      console.log(res.stdout);
    }
    if (res.stderr) {
      console.error(res.stderr);
    }
    closeStubsDatabase();
    process.exit(res.exitCode);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    closeStubsDatabase();
    process.exit(1);
  }
}

void main();
