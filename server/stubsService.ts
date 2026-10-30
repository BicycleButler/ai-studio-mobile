import { defaultLogger } from "../src/utils/logger";
import path from "node:path";
import fs from "node:fs";
import { EventEmitter } from "node:events";
import { defaultProcessRunner } from "./utils/processRunner";
import { DatabaseSync } from "node:sqlite";
import {
  StubsNode,
  StubsEdge,
  StubsGraphData,
  StubsLintViolation,
  StubsImpactResult,
  StubsSidecarSpec,
} from "../src/types";

export const stubsEvents = new EventEmitter();
stubsEvents.setMaxListeners(50);

const CWD = process.cwd();
const CLI_PATH = path.resolve(CWD, ".agents/skills/stubs/dist/cli.cjs");
const DB_PATH = path.resolve(CWD, ".stubs/graph.sqlite");

// Helper to safely get an open DatabaseSync connection
function getDatabase(): DatabaseSync | null {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return null;
    }
    return new DatabaseSync(DB_PATH);
  } catch (err) {
    defaultLogger.error("[stubsService] Error opening SQLite database:", err);
    return null;
  }
}

/**
 * Returns parsed dependency graph data from .stubs/graph.sqlite
 */
export async function getGraphData(): Promise<StubsGraphData> {
  let db = getDatabase();

  // If DB does not exist, run a scan first
  if (!db) {
    try {
      await runCliCommand("scan");
      db = getDatabase();
    } catch (e) {
      defaultLogger.warn("[stubsService] Initial scan failed:", e);
    }
  }

  const nodes: StubsNode[] = [];
  const edges: StubsEdge[] = [];
  const domains: Record<string, number> = {};
  const layers: Record<number, number> = {};
  let totalSymbols = 0;

  interface NodeRow {
    id: string;
    file_path: string;
    entity_type?: string;
    name: string;
    domain?: string;
    layer?: number;
    fan_in?: number;
    fan_out?: number;
    degree?: number;
    ast_hash?: string;
    line_count?: number;
    exports_json?: string;
  }

  interface EdgeRow {
    id?: number | string;
    source: string;
    target: string;
    relationship?: string;
    weight?: number;
  }

  if (db) {
    try {
      const nodeRows = db.prepare("SELECT * FROM nodes ORDER BY degree DESC").all() as unknown as NodeRow[];
      for (const row of nodeRows) {
        let parsedExports = [];
        try {
          if (row.exports_json) parsedExports = JSON.parse(row.exports_json);
        } catch {
          // Ignore parse errors
        }
        totalSymbols += Array.isArray(parsedExports) ? parsedExports.length : 0;

        const node: StubsNode = {
          id: row.id,
          filePath: row.file_path,
          entityType: row.entity_type || "file",
          name: row.name,
          domain: row.domain || "core",
          layer: typeof row.layer === "number" ? row.layer : 0,
          fanIn: row.fan_in || 0,
          fanOut: row.fan_out || 0,
          degree: row.degree || 0,
          astHash: row.ast_hash,
          lineCount: row.line_count || 0,
          exportsJson: row.exports_json,
        };
        nodes.push(node);

        domains[node.domain] = (domains[node.domain] || 0) + 1;
        layers[node.layer] = (layers[node.layer] || 0) + 1;
      }

      const edgeRows = db.prepare("SELECT * FROM edges").all() as unknown as EdgeRow[];
      for (const row of edgeRows) {
        edges.push({
          id: typeof row.id === "number" ? row.id : (row.id ? parseInt(String(row.id), 10) : undefined),
          source: row.source,
          target: row.target,
          relationship: row.relationship || "imports",
          weight: row.weight || 1,
        });
      }
    } catch (err) {
      defaultLogger.error("[stubsService] Query error:", err);
    }
  }

  return {
    projectName: "ai-studio-mobile",
    version: "1.0.0",
    nodes,
    edges,
    summary: {
      totalFiles: nodes.length,
      totalEdges: edges.length,
      totalSymbols,
      cyclesCount: 0,
      domains,
      layers,
    },
  };
}

/**
 * Returns Mermaid diagram string (either generated from CLI or constructed from graph data)
 */
export async function getDiagram(groupBy: "domain" | "layer" = "domain"): Promise<{ mermaid: string; edgeCount: number; nodeCount: number }> {
  const graph = await getGraphData();

  if (graph.nodes.length === 0) {
    return {
      mermaid: "graph TD\n  empty[No nodes scanned yet - Click 'Scan AST']",
      edgeCount: 0,
      nodeCount: 0,
    };
  }

  // Build clean Mermaid flowchart syntax
  const lines: string[] = ["graph TD"];

  const sanitizeId = (id: string) => id.replace(/[^a-zA-Z0-9_]/g, "_");

  if (groupBy === "domain") {
    // Group into subgraphs by domain
    const domainGroups = new Map<string, StubsNode[]>();
    for (const node of graph.nodes) {
      const group = domainGroups.get(node.domain) || [];
      group.push(node);
      domainGroups.set(node.domain, group);
    }

    for (const [domain, groupNodes] of domainGroups.entries()) {
      lines.push(`  subgraph ${sanitizeId(domain)}["Domain: ${domain}"]`);
      lines.push(`    style ${sanitizeId(domain)} fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc`);
      for (const n of groupNodes.slice(0, 15)) {
        lines.push(`    ${sanitizeId(n.id)}["${n.name}"]`);
      }
      if (groupNodes.length > 15) {
        lines.push(`    ${sanitizeId(domain)}_more["...and ${groupNodes.length - 15} more"]`);
      }
      lines.push("  end");
    }
  } else {
    // Group into subgraphs by layer (0 through 6)
    const layerNames: Record<number, string> = {
      0: "Layer 0: Core Types & Schemas",
      1: "Layer 1: Low-Level Storage & Utilities",
      2: "Layer 2: Domain Services & Clients",
      3: "Layer 3: UI Sub-Components & Drawers",
      4: "Layer 4: Top-Level Workspaces",
      5: "Layer 5: Main App Scaffold",
      6: "Layer 6: Server & Infrastructure",
    };

    const layerGroups = new Map<number, StubsNode[]>();
    for (const node of graph.nodes) {
      const group = layerGroups.get(node.layer) || [];
      group.push(node);
      layerGroups.set(node.layer, group);
    }

    for (const [layer, groupNodes] of layerGroups.entries()) {
      const lTitle = layerNames[layer] || `Layer ${layer}`;
      lines.push(`  subgraph layer_${layer}["${lTitle}"]`);
      lines.push(`    style layer_${layer} fill:#0f172a,stroke:#818cf8,stroke-width:1px,color:#f8fafc`);
      for (const n of groupNodes.slice(0, 15)) {
        lines.push(`    ${sanitizeId(n.id)}["${n.name}"]`);
      }
      if (groupNodes.length > 15) {
        lines.push(`    layer_${layer}_more["...and ${groupNodes.length - 15} more"]`);
      }
      lines.push("  end");
    }
  }

  // Filter internal project edges (exclude external packages like pkg:*)
  const internalEdges = graph.edges
    .filter((e) => !e.target.startsWith("pkg:"))
    .slice(0, 120); // Cap for diagram readability

  for (const edge of internalEdges) {
    lines.push(`  ${sanitizeId(edge.source)} --> ${sanitizeId(edge.target)}`);
  }

  return {
    mermaid: lines.join("\n"),
    edgeCount: internalEdges.length,
    nodeCount: graph.nodes.length,
  };
}

/**
 * Calculates file blast radius & architectural impact
 */
export async function getImpact(targetFile: string): Promise<StubsImpactResult> {
  const graph = await getGraphData();
  const node = graph.nodes.find(
    (n) => n.id === targetFile || n.filePath === targetFile || n.name === targetFile
  );

  const directCallers = graph.edges
    .filter((e) => e.target === (node?.id || targetFile))
    .map((e) => e.source);

  const dependencies = graph.edges
    .filter((e) => e.source === (node?.id || targetFile))
    .map((e) => e.target);

  // Transitive callers (BFS up to depth 2)
  const transitiveSet = new Set<string>();
  const queue = [...directCallers];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    for (const e of graph.edges) {
      if (e.target === curr && !directCallers.includes(e.source) && !transitiveSet.has(e.source)) {
        transitiveSet.add(e.source);
        if (transitiveSet.size < 25) {
          queue.push(e.source);
        }
      }
    }
  }

  const fanIn = directCallers.length;
  const fanOut = dependencies.length;

  let riskScore: "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "LOW";
  let numericRisk = 15;

  if (fanIn >= 20 || (node && node.layer === 0 && fanIn >= 10)) {
    riskScore = "CRITICAL";
    numericRisk = 95;
  } else if (fanIn >= 10) {
    riskScore = "HIGH";
    numericRisk = 75;
  } else if (fanIn >= 3 || fanOut >= 8) {
    riskScore = "MODERATE";
    numericRisk = 50;
  }

  return {
    target: targetFile,
    domain: node?.domain || "core",
    layer: node?.layer ?? 1,
    fanIn,
    fanOut,
    riskScore,
    numericRisk,
    directCallers,
    transitiveCallers: Array.from(transitiveSet),
    dependencies,
  };
}

/**
 * Performs architectural lint checks:
 * 1. Layer hierarchy violations (e.g. lower layer importing higher layer)
 * 2. Circular dependency cycles
 */
export async function lintArchitecture(): Promise<{
  violations: StubsLintViolation[];
  passed: boolean;
  totalChecks: number;
}> {
  const graph = await getGraphData();
  const violations: StubsLintViolation[] = [];

  // Map nodeId -> node
  const nodeMap = new Map<string, StubsNode>();
  for (const n of graph.nodes) {
    nodeMap.set(n.id, n);
  }

  // 1. Check layer hierarchy inversions
  // Rule: Modules in layer L should only import modules in layer <= L (with allowed same-layer or downward)
  // Specifically: Layer 0 (types/contracts) must NEVER import Layer 1, 2, 3, 4, 5, 6
  for (const edge of graph.edges) {
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;

    // Layer 0 importing higher layers
    if (src.layer === 0 && tgt.layer > 0) {
      violations.push({
        rule: "layer-0-inversion",
        severity: "error",
        message: `Layer 0 core module '${src.name}' imports higher Layer ${tgt.layer} module '${tgt.name}'`,
        source: src.id,
        target: tgt.id,
      });
    }

    // Layer 1 (utilities) importing UI / Workspaces (Layer 3/4)
    if (src.layer <= 1 && tgt.layer >= 3) {
      violations.push({
        rule: "layer-hierarchy-inversion",
        severity: "warning",
        message: `Lower Layer ${src.layer} module '${src.name}' directly imports UI Layer ${tgt.layer} module '${tgt.name}'`,
        source: src.id,
        target: tgt.id,
      });
    }
  }

  // 2. Check circular dependencies (cycles) using DFS
  const adj = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.target.startsWith("pkg:")) continue;
    const list = adj.get(edge.source) || [];
    list.push(edge.target);
    adj.set(edge.source, list);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cyclesFound: string[][] = [];

  function dfs(curr: string, path: string[]) {
    visited.add(curr);
    inStack.add(curr);
    path.push(curr);

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        dfs(next, [...path]);
      } else if (inStack.has(next)) {
        const cycleStart = path.indexOf(next);
        if (cycleStart !== -1) {
          cyclesFound.push([...path.slice(cycleStart), next]);
        }
      }
    }

    inStack.delete(curr);
  }

  for (const node of graph.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  for (const cycle of cyclesFound.slice(0, 5)) {
    violations.push({
      rule: "circular-dependency",
      severity: "error",
      message: `Circular import cycle detected: ${cycle.map(f => path.basename(f)).join(" -> ")}`,
      cycle,
    });
  }

  return {
    violations,
    passed: violations.filter((v) => v.severity === "error").length === 0,
    totalChecks: graph.edges.length + graph.nodes.length,
  };
}

/**
 * Lists all sidecar specs (*.ts.md) and architecture planning docs (*.md)
 */
export async function listSidecarSpecs(): Promise<StubsSidecarSpec[]> {
  const results: StubsSidecarSpec[] = [];

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== "node_modules" && ent.name !== "dist" && ent.name !== ".git") {
          walk(full);
        }
      } else if (ent.isFile() && (ent.name.endsWith(".ts.md") || (ent.name.endsWith(".md") && (dir.includes("knowledge") || dir.includes(".stubs"))))) {
        const rel = path.relative(CWD, full);
        try {
          const content = fs.readFileSync(full, "utf8");
          // Extract frontmatter
          const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
          let title = ent.name;
          let type = ent.name.endsWith(".ts.md") ? "code-sidecar" : "architecture-doc";
          let status = "clean";
          let targetCodeFile: string | undefined;

          if (frontmatterMatch) {
            const lines = frontmatterMatch[1].split("\n");
            for (const line of lines) {
              const [k, ...rest] = line.split(":");
              if (!k) continue;
              const v = rest.join(":").trim().replace(/^['"]|['"]$/g, "");
              if (k.trim() === "title") title = v;
              if (k.trim() === "type") type = v;
              if (k.trim() === "status" || k.trim() === "status_flag") status = v;
              if (k.trim() === "target_code_file") targetCodeFile = v;
            }
          }

          if (!targetCodeFile && ent.name.endsWith(".ts.md")) {
            targetCodeFile = full.replace(/\.md$/, "");
          }

          let targetExists = false;
          if (targetCodeFile) {
            const targetResolved = path.resolve(path.dirname(full), targetCodeFile);
            targetExists = fs.existsSync(targetResolved);
          }

          results.push({
            path: rel,
            filename: ent.name,
            title,
            type,
            status,
            targetCodeFile: targetCodeFile ? path.relative(CWD, path.resolve(path.dirname(full), targetCodeFile)) : undefined,
            targetExists,
          });
        } catch (e) {
          defaultLogger.warn("[stubsService] Error reading spec file:", full, e);
        }
      }
    }
  }

  walk(path.join(CWD, "src"));
  walk(path.join(CWD, "knowledge"));

  return results;
}

/**
 * Reads spec content
 */
export async function getSpecContent(relPath: string): Promise<{ content: string; path: string }> {
  const safePath = path.resolve(CWD, relPath);
  if (!safePath.startsWith(CWD)) {
    throw new Error("Invalid spec path outside workspace");
  }
  if (!fs.existsSync(safePath)) {
    throw new Error(`Spec file not found: ${relPath}`);
  }
  const content = fs.readFileSync(safePath, "utf8");
  return { content, path: relPath };
}

/**
 * Saves updated spec content
 */
export async function saveSpecContent(relPath: string, content: string): Promise<void> {
  const safePath = path.resolve(CWD, relPath);
  if (!safePath.startsWith(CWD)) {
    throw new Error("Invalid spec path outside workspace");
  }
  fs.writeFileSync(safePath, content, "utf8");
}

/**
 * Materializes code blocks from a sidecar spec (*.ts.md) into its target code file
 */
export async function materializeSpec(relPath: string): Promise<{ targetFile: string; bytesWritten: number }> {
  const spec = await getSpecContent(relPath);
  const fullSpecPath = path.resolve(CWD, relPath);

  // Extract target_code_file from frontmatter or infer from .ts.md
  let targetRel = relPath.replace(/\.md$/, "");
  const frontmatterMatch = spec.content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const lines = frontmatterMatch[1].split("\n");
    for (const line of lines) {
      const [k, ...rest] = line.split(":");
      if (k.trim() === "target_code_file") {
        const rawTarget = rest.join(":").trim().replace(/^['"]|['"]$/g, "");
        targetRel = path.relative(CWD, path.resolve(path.dirname(fullSpecPath), rawTarget));
      }
    }
  }

  // Extract TypeScript code block
  const codeBlockMatch = spec.content.match(/```(?:typescript|ts)\n([\s\S]*?)\n```/);
  if (!codeBlockMatch) {
    throw new Error("No TypeScript (```ts) code block found inside sidecar specification to materialize.");
  }

  const code = codeBlockMatch[1];
  const targetFullPath = path.resolve(CWD, targetRel);
  fs.writeFileSync(targetFullPath, code, "utf8");

  return {
    targetFile: targetRel,
    bytesWritten: Buffer.byteLength(code, "utf8"),
  };
}

/**
 * Runs a CLI command via child process, streaming lines to SSE subscribers
 */
export async function runCliCommand(
  command: "scan" | "lint-arch" | "diagram" | "impact" | "sand",
  args: string[] = []
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  try {
    await fs.promises.access(CLI_PATH, fs.constants.F_OK);
  } catch {
    throw new Error(`Stubs CLI not found at ${CLI_PATH}. Please build the agent skills first.`);
  }

  return defaultProcessRunner.runCommand(
    CLI_PATH,
    [command, ...args],
    { cwd: CWD },
    stubsEvents
  );
}
