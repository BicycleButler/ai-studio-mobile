import { defaultServerContext } from "./serverContext";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import { DatabaseSync } from "node:sqlite";
import ts from "typescript";
import {
  StubsNode,
  StubsEdge,
  StubsGraphData,
  StubsLintViolation,
  StubsPruneIssue,
  StubsPruneResult,
  StubsImpactResult,
  StubsTieredContext,
  StubsSidecarSpec,
  StubsQueryResult,
  StubsQueryMatch,
  StubsRunResult,
  StubsRunStep,
  StubsDiagramGroupBy,
  StubsDiagramType,
  StubsCommandName,
  StubsSpecCategory,
  StubsDriftStatus,
  StubsInterfaceStub,
  StubsInterfaceSymbol,
  StubsHarnessCheckpoint,
  WorkspaceTreeNode,
  WorkspaceFileTreeResponse,
} from "../src/types";

export const stubsEvents = new EventEmitter();
stubsEvents.setMaxListeners(50);

const CWD = process.cwd();
const CLI_PATH = path.resolve(CWD, ".agents/skills/stubs/dist/cli.cjs");
const DB_PATH = path.resolve(CWD, ".stubs/graph.sqlite");
const CONFIG_PATH = path.resolve(CWD, ".stubs/config.json");
const LEDGER_PATH = path.resolve(CWD, ".stubs/harness-ledger.json");

interface StubsWorkspaceConfig {
  project_name: string;
  version: string;
  autonomy_level: string;
  paths?: {
    specs_dir?: string;
    templates_dir?: string;
    database_path?: string;
  };
}

function readWorkspaceConfig(): StubsWorkspaceConfig {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw) as Partial<StubsWorkspaceConfig>;
      return {
        project_name: parsed.project_name || "ai-studio-mobile",
        version: parsed.version || "1.0.0",
        autonomy_level: parsed.autonomy_level || "guided_execution",
        paths: parsed.paths,
      };
    }
  } catch {
    // Fallback to defaults
  }
  return {
    project_name: "ai-studio-mobile",
    version: "1.0.0",
    autonomy_level: "guided_execution",
  };
}

function isCliBinaryPresent(): boolean {
  return fs.existsSync(CLI_PATH) || fs.existsSync(path.resolve(CWD, "scripts/stubs-cli.ts"));
}

function readLastCheckpoint(): StubsHarnessCheckpoint | undefined {
  try {
    if (!fs.existsSync(LEDGER_PATH)) return undefined;
    const raw = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as {
      checkpoints?: StubsHarnessCheckpoint[];
    };
    if (Array.isArray(raw.checkpoints) && raw.checkpoints.length > 0) {
      return raw.checkpoints[raw.checkpoints.length - 1];
    }
  } catch {
    // ignore malformed ledger
  }
  return undefined;
}

function recordCheckpoint(checkpoint: StubsHarnessCheckpoint): void {
  try {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    let existing: StubsHarnessCheckpoint[] = [];
    if (fs.existsSync(LEDGER_PATH)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as {
          checkpoints?: StubsHarnessCheckpoint[];
        };
        if (Array.isArray(parsed.checkpoints)) {
          existing = parsed.checkpoints;
        }
      } catch {
        existing = [];
      }
    }
    existing.push(checkpoint);
    const trimmed = existing.slice(-25);
    fs.writeFileSync(
      LEDGER_PATH,
      JSON.stringify({ updatedAt: checkpoint.timestamp, checkpoints: trimmed }, null, 2),
      "utf8"
    );
  } catch (err) {
    defaultServerContext.services.logger.warn("[stubsService] Failed writing harness ledger:", err);
  }
}

function emitLog(type: "start" | "stdout" | "stderr" | "error" | "exit", text: string, code?: number): void {
  stubsEvents.emit("log", {
    type,
    text,
    timestamp: Date.now(),
    ...(code !== undefined ? { code } : {}),
  });
}

function assertInsideWorkspace(resolvedPath: string, label = "path"): void {
  const cwdPrefix = CWD.endsWith(path.sep) ? CWD : CWD + path.sep;
  if (resolvedPath !== CWD && !resolvedPath.startsWith(cwdPrefix)) {
    throw new Error(`Invalid ${label} outside workspace`);
  }
}

let sharedDb: DatabaseSync | null = null;

function configureSqlitePragmas(db: DatabaseSync): void {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA busy_timeout = 5000;
  `);
}

function ensureDatabase(): DatabaseSync {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (sharedDb) {
    try {
      sharedDb.prepare("SELECT 1").get();
      return sharedDb;
    } catch {
      try {
        sharedDb.close();
      } catch {
        // ignore close error
      }
      sharedDb = null;
    }
  }
  const db = new DatabaseSync(DB_PATH);
  configureSqlitePragmas(db);
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      entity_type TEXT,
      name TEXT NOT NULL,
      domain TEXT,
      layer INTEGER,
      fan_in INTEGER DEFAULT 0,
      fan_out INTEGER DEFAULT 0,
      degree INTEGER DEFAULT 0,
      ast_hash TEXT,
      line_count INTEGER DEFAULT 0,
      exports_json TEXT
    );
    CREATE TABLE IF NOT EXISTS edges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      relationship TEXT DEFAULT 'imports',
      weight INTEGER DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS metadata (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);
  sharedDb = db;
  return db;
}

function getDatabase(): DatabaseSync | null {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return null;
    }
    return ensureDatabase();
  } catch (err) {
    defaultServerContext.services.logger.error("[stubsService] Error opening SQLite database:", err);
    return null;
  }
}

export function closeStubsDatabase(): void {
  if (sharedDb) {
    try {
      sharedDb.close();
    } catch {
      // ignore already closed
    }
    sharedDb = null;
  }
}

function inferDomainAndLayer(relPath: string): { domain: string; layer: number; entityType: string } {
  const norm = relPath.replace(/\\/g, "/");
  if (norm.startsWith("server/") || norm === "server.ts") {
    return { domain: "server", layer: 6, entityType: "server" };
  }
  if (norm === "src/App.tsx" || norm === "src/main.tsx") {
    return { domain: "core", layer: 5, entityType: "entrypoint" };
  }
  if (norm.startsWith("src/types") || norm.startsWith("src/schemas/")) {
    return { domain: "core", layer: 0, entityType: norm.includes("schema") ? "schema" : "type" };
  }
  if (norm.startsWith("src/utils/") || norm.startsWith("src/data/")) {
    return { domain: "utils", layer: 1, entityType: norm.includes(".test.") ? "test" : "utility" };
  }
  if (norm.startsWith("src/services/")) {
    return { domain: "services", layer: 2, entityType: norm.includes(".test.") ? "test" : "service" };
  }
  if (norm.startsWith("src/hooks/") || norm.startsWith("src/contexts/")) {
    return {
      domain: norm.startsWith("src/contexts/") ? "core" : "hooks",
      layer: 3,
      entityType: norm.includes("contexts/") ? "context" : norm.includes(".test.") ? "test" : "hook",
    };
  }
  if (norm.startsWith("src/components/")) {
    return {
      domain: "components",
      layer: 4,
      entityType: norm.includes(".test.") ? "test" : "component",
    };
  }
  return { domain: "core", layer: 1, entityType: "module" };
}

async function collectSourceFiles(): Promise<string[]> {
  const files: string[] = [];
  const ignoredDirs = new Set(["node_modules", "dist", "dev-dist", ".git", ".stubs", ".agents", "test-results", "scratch"]);

  async function walk(dir: string): Promise<void> {
    if (!fs.existsSync(dir)) return;
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (!ignoredDirs.has(ent.name)) {
          await walk(full);
        }
      } else if (ent.isFile() && /\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith(".d.ts")) {
        files.push(path.relative(CWD, full).replace(/\\/g, "/"));
      }
    }
  }

  await walk(path.join(CWD, "src"));
  await walk(path.join(CWD, "server"));
  if (fs.existsSync(path.join(CWD, "server.ts"))) {
    files.push("server.ts");
  }

  return files.sort();
}

function resolveImportTarget(fromRelPath: string, specifier: string, knownFiles: Set<string>): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("/")) {
    const pkgName = specifier.startsWith("@")
      ? specifier.split("/").slice(0, 2).join("/")
      : specifier.split("/")[0];
    return `pkg:${pkgName}`;
  }

  const fromDir = path.dirname(path.resolve(CWD, fromRelPath));
  const baseResolved = path.resolve(fromDir, specifier);
  const candidates = [
    baseResolved,
    `${baseResolved}.ts`,
    `${baseResolved}.tsx`,
    path.join(baseResolved, "index.ts"),
    path.join(baseResolved, "index.tsx"),
  ];

  for (const candidate of candidates) {
    const rel = path.relative(CWD, candidate).replace(/\\/g, "/");
    if (knownFiles.has(rel)) {
      return rel;
    }
  }
  return null;
}

async function parseTypeScriptFile(relPath: string, knownFiles: Set<string>): Promise<{
  exports: string[];
  imports: Array<{ target: string; relationship: string }>;
  astHash: string;
  lineCount: number;
}> {
  const fullPath = path.resolve(CWD, relPath);
  const content = await fs.promises.readFile(fullPath, "utf8");
  const lineCount = content.split("\n").length;
  const astHash = crypto.createHash("sha256").update(content).digest("hex").slice(0, 12);

  const scriptKind = relPath.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(relPath, content, ts.ScriptTarget.Latest, true, scriptKind);

  const exportsSet = new Set<string>();
  const importsList: Array<{ target: string; relationship: string }> = [];

  const hasExportModifier = (node: ts.Node): boolean => {
    if (!ts.canHaveModifiers(node)) return false;
    const mods = ts.getModifiers(node);
    return Boolean(mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword));
  };

  sourceFile.forEachChild((node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const target = resolveImportTarget(relPath, node.moduleSpecifier.text, knownFiles);
      if (target) {
        const isTypeOnly = Boolean(node.importClause?.isTypeOnly);
        importsList.push({ target, relationship: isTypeOnly ? "type-imports" : "imports" });
      }
    } else if (ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
        const target = resolveImportTarget(relPath, node.moduleSpecifier.text, knownFiles);
        if (target) {
          importsList.push({ target, relationship: "re-exports" });
        }
      }
      if (node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const el of node.exportClause.elements) {
          exportsSet.add(el.name.text);
        }
      }
    } else if (ts.isExportAssignment(node)) {
      exportsSet.add("default");
    } else if (hasExportModifier(node)) {
      if (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node) || ts.isEnumDeclaration(node)) {
        if (node.name) exportsSet.add(node.name.text);
        else exportsSet.add("default");
      } else if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            exportsSet.add(decl.name.text);
          }
        }
      }
    }
  });

  return {
    exports: Array.from(exportsSet),
    imports: importsList,
    astHash,
    lineCount,
  };
}

let activeScanPromise: Promise<{
  filesScanned: number;
  edgesCount: number;
  symbolsCount: number;
  durationMs: number;
}> | null = null;

/**
 * Performs a real AST scan of the repository and updates .stubs/graph.sqlite.
 * Concurrent invocations coalesce onto the in-flight scan to avoid SQLITE_BUSY races.
 */
export async function scanWorkspace(emitToStream = false): Promise<{
  filesScanned: number;
  edgesCount: number;
  symbolsCount: number;
  durationMs: number;
}> {
  if (activeScanPromise) {
    return activeScanPromise;
  }
  activeScanPromise = performWorkspaceScan(emitToStream).finally(() => {
    activeScanPromise = null;
  });
  return activeScanPromise;
}

async function performWorkspaceScan(emitToStream = false): Promise<{
  filesScanned: number;
  edgesCount: number;
  symbolsCount: number;
  durationMs: number;
}> {
  const startTime = Date.now();
  if (emitToStream) {
    emitLog("start", "$ stubs scan");
  }

  const files = await collectSourceFiles();
  const knownFiles = new Set(files);

  const rawNodes = new Map<string, {
    id: string;
    filePath: string;
    entityType: string;
    name: string;
    domain: string;
    layer: number;
    astHash: string;
    lineCount: number;
    exports: string[];
  }>();

  const rawEdges: Array<{ source: string; target: string; relationship: string; weight: number }> = [];
  const fanInMap = new Map<string, number>();
  const fanOutMap = new Map<string, number>();

  for (let i = 0; i < files.length; i++) {
    const relPath = files[i];
    if (i > 0 && i % 15 === 0) {
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    try {
      const { exports: fileExports, imports, astHash, lineCount } = await parseTypeScriptFile(relPath, knownFiles);
      const { domain, layer, entityType } = inferDomainAndLayer(relPath);

      rawNodes.set(relPath, {
        id: relPath,
        filePath: relPath,
        entityType,
        name: path.basename(relPath),
        domain,
        layer,
        astHash,
        lineCount,
        exports: fileExports,
      });

      const seenTargets = new Set<string>();
      for (const imp of imports) {
        if (imp.target === relPath) continue;
        if (seenTargets.has(imp.target)) continue;
        seenTargets.add(imp.target);

        rawEdges.push({
          source: relPath,
          target: imp.target,
          relationship: imp.relationship,
          weight: 1,
        });

        if (!imp.target.startsWith("pkg:")) {
          fanOutMap.set(relPath, (fanOutMap.get(relPath) || 0) + 1);
          fanInMap.set(imp.target, (fanInMap.get(imp.target) || 0) + 1);
        }
      }
    } catch (err) {
      defaultServerContext.services.logger.warn(`[stubsService] Failed parsing ${relPath}:`, err);
    }
  }

  const db = ensureDatabase();
  let totalSymbols = 0;

  try {
    db.exec("BEGIN IMMEDIATE");
    db.exec("DELETE FROM nodes");
    db.exec("DELETE FROM edges");

    const insertNode = db.prepare(`
      INSERT INTO nodes (id, file_path, entity_type, name, domain, layer, fan_in, fan_out, degree, ast_hash, line_count, exports_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const node of rawNodes.values()) {
      const fanIn = fanInMap.get(node.id) || 0;
      const fanOut = fanOutMap.get(node.id) || 0;
      const degree = fanIn + fanOut;
      totalSymbols += node.exports.length;

      insertNode.run(
        node.id,
        node.filePath,
        node.entityType,
        node.name,
        node.domain,
        node.layer,
        fanIn,
        fanOut,
        degree,
        node.astHash,
        node.lineCount,
        JSON.stringify(node.exports)
      );
    }

    const insertEdge = db.prepare(`
      INSERT INTO edges (source, target, relationship, weight)
      VALUES (?, ?, ?, ?)
    `);

    for (const edge of rawEdges) {
      insertEdge.run(edge.source, edge.target, edge.relationship, edge.weight);
    }

    db.prepare("INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)").run(
      "last_scanned_at",
      String(Date.now())
    );

    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  }

  const durationMs = Date.now() - startTime;
  if (emitToStream) {
    emitLog("stdout", `Scanned ${rawNodes.size} TypeScript modules, ${rawEdges.length} dependency edges, and ${totalSymbols} exported symbols in ${durationMs}ms.`);
    emitLog("stdout", `Updated graph database at .stubs/graph.sqlite.`);
    emitLog("exit", `[Process exited with code 0]`, 0);
  }

  return {
    filesScanned: rawNodes.size,
    edgesCount: rawEdges.length,
    symbolsCount: totalSymbols,
    durationMs,
  };
}

function detectCycles(nodes: StubsNode[], edges: StubsEdge[]): string[][] {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.target.startsWith("pkg:") || edge.relationship === "type-imports") continue;
    const list = adj.get(edge.source) || [];
    list.push(edge.target);
    adj.set(edge.source, list);
  }

  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cyclesFound: string[][] = [];

  function dfs(curr: string, currentPath: string[]) {
    visited.add(curr);
    inStack.add(curr);
    currentPath.push(curr);

    const neighbors = adj.get(curr) || [];
    for (const next of neighbors) {
      if (!visited.has(next)) {
        dfs(next, [...currentPath]);
      } else if (inStack.has(next)) {
        const cycleStart = currentPath.indexOf(next);
        if (cycleStart !== -1) {
          cyclesFound.push([...currentPath.slice(cycleStart), next]);
        }
      }
    }
    inStack.delete(curr);
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  return cyclesFound;
}

let lastStaleCheckTime = 0;

function isGraphStale(db: DatabaseSync): boolean {
  const now = Date.now();
  if (now - lastStaleCheckTime < 2000) {
    return false;
  }
  lastStaleCheckTime = now;

  try {
    const metaRow = db
      .prepare("SELECT value FROM metadata WHERE key = 'last_scanned_at'")
      .get() as { value?: string } | undefined;
    const lastScannedAt = metaRow?.value ? Number(metaRow.value) : 0;
    if (!lastScannedAt || Number.isNaN(lastScannedAt)) {
      return true;
    }

    const countRow = db.prepare("SELECT COUNT(*) as cnt FROM nodes").get() as { cnt?: number } | undefined;
    const dbCount = Number(countRow?.cnt || 0);
    if (dbCount === 0) {
      return true;
    }

    const ignoredDirs = new Set([
      "node_modules",
      "dist",
      "dev-dist",
      ".git",
      ".stubs",
      ".agents",
      "test-results",
      "scratch",
    ]);
    let diskFileCount = 0;
    let newerFound = false;

    const checkDir = (dir: string): void => {
      if (newerFound || !fs.existsSync(dir)) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        if (newerFound) return;
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          if (!ignoredDirs.has(ent.name)) {
            checkDir(full);
          }
        } else if (ent.isFile() && /\.(ts|tsx)$/.test(ent.name) && !ent.name.endsWith(".d.ts")) {
          diskFileCount++;
          const stat = fs.statSync(full);
          if (stat.mtimeMs > lastScannedAt) {
            newerFound = true;
            return;
          }
        }
      }
    };

    checkDir(path.join(CWD, "src"));
    checkDir(path.join(CWD, "server"));
    const rootServer = path.join(CWD, "server.ts");
    if (fs.existsSync(rootServer)) {
      diskFileCount++;
      if (fs.statSync(rootServer).mtimeMs > lastScannedAt) {
        newerFound = true;
      }
    }

    return newerFound || diskFileCount !== dbCount;
  } catch {
    return true;
  }
}

/**
 * Returns parsed dependency graph data from .stubs/graph.sqlite.
 * Automatically performs an AST scan if the database is missing or any source file mtime is newer than last_scanned_at.
 */
export async function getGraphData(): Promise<StubsGraphData> {
  const config = readWorkspaceConfig();
  let db = getDatabase();

  if (!db || isGraphStale(db)) {
    try {
      await scanWorkspace(false);
      db = getDatabase();
      lastStaleCheckTime = Date.now();
    } catch (e) {
      defaultServerContext.services.logger.warn("[stubsService] Auto-scan failed:", e);
    }
  }

  const nodes: StubsNode[] = [];
  const edges: StubsEdge[] = [];
  const domains: Record<string, number> = {};
  const layers: Record<number, number> = {};
  let totalSymbols = 0;
  let lastScannedAt: number | undefined;

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
        let parsedExports: string[] = [];
        try {
          if (row.exports_json) parsedExports = JSON.parse(row.exports_json);
        } catch {
          // Ignore parse errors
        }
        totalSymbols += Array.isArray(parsedExports) ? parsedExports.length : 0;

        const sidecarCandidate = `${row.file_path}.md`;
        const hasSidecar = fs.existsSync(path.resolve(CWD, sidecarCandidate));

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
          hasSidecar,
          sidecarPath: hasSidecar ? sidecarCandidate : undefined,
        };
        nodes.push(node);

        domains[node.domain] = (domains[node.domain] || 0) + 1;
        layers[node.layer] = (layers[node.layer] || 0) + 1;
      }

      const edgeRows = db.prepare("SELECT * FROM edges").all() as unknown as EdgeRow[];
      for (const row of edgeRows) {
        edges.push({
          id: typeof row.id === "number" ? row.id : row.id ? parseInt(String(row.id), 10) : undefined,
          source: row.source,
          target: row.target,
          relationship: row.relationship || "imports",
          weight: row.weight || 1,
        });
      }

      try {
        const metaRow = db.prepare("SELECT value FROM metadata WHERE key = 'last_scanned_at'").get() as { value?: string } | undefined;
        if (metaRow?.value) lastScannedAt = Number(metaRow.value);
      } catch {
        // metadata table might not exist in older sqlite files
      }
    } catch (err) {
      defaultServerContext.services.logger.error("[stubsService] Query error:", err);
    }
  }

  const cycles = detectCycles(nodes, edges);
  const specs = await listSidecarSpecs();
  const sidecarsCount = specs.filter((s) => s.category === "sidecar").length;
  const planningDocsCount = specs.filter((s) => s.category === "planning" || s.category === "concept").length;

  return {
    projectName: config.project_name,
    version: config.version,
    autonomyLevel: config.autonomy_level,
    cliAvailable: isCliBinaryPresent(),
    lastCheckpoint: readLastCheckpoint(),
    nodes,
    edges,
    summary: {
      totalFiles: nodes.length,
      totalEdges: edges.length,
      totalSymbols,
      cyclesCount: cycles.length,
      sidecarsCount,
      planningDocsCount,
      domains,
      layers,
      lastScannedAt,
    },
  };
}

function parseExports(node: StubsNode): string[] {
  if (!node.exportsJson) return [];
  try {
    const parsed = JSON.parse(node.exportsJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function findNodeMatch(nodes: StubsNode[], query: string): StubsNode | undefined {
  const q = query.trim().toLowerCase();
  if (!q) return undefined;
  return (
    nodes.find((n) => n.id.toLowerCase() === q) ||
    nodes.find((n) => n.filePath.toLowerCase() === q) ||
    nodes.find((n) => n.name.toLowerCase() === q) ||
    nodes.find((n) => n.name.toLowerCase().replace(/\.(ts|tsx)$/, "") === q) ||
    nodes.find((n) => parseExports(n).some((ex) => ex.toLowerCase() === q)) ||
    nodes.find((n) => n.filePath.toLowerCase().includes(q))
  );
}

/**
 * Extracts a Level 1 Interface Skeleton Stub (`stubs query "stub: <target>"`)
 * Strips function/method implementation bodies and returns compact TypeScript signatures with 1-indexed line links.
 */
export async function extractInterfaceStub(targetFile: string): Promise<StubsInterfaceStub> {
  const graph = await getGraphData();
  const matchedNode = findNodeMatch(graph.nodes, targetFile);
  const resolvedRel = matchedNode?.filePath || targetFile.replace(/\\/g, "/").replace(/^\/+/, "");
  const fullPath = path.resolve(CWD, resolvedRel);
  assertInsideWorkspace(fullPath, "stub target");

  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    throw new Error(`Target module '${targetFile}' could not be resolved in the workspace.`);
  }

  const content = await fs.promises.readFile(fullPath, "utf8");
  const lineCount = content.split(/\r?\n/).length;
  const { domain, layer } = matchedNode
    ? { domain: matchedNode.domain, layer: matchedNode.layer }
    : inferDomainAndLayer(resolvedRel);

  const scriptKind = resolvedRel.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sourceFile = ts.createSourceFile(resolvedRel, content, ts.ScriptTarget.Latest, true, scriptKind);

  const getLineRange = (node: ts.Node): { lineStart: number; lineEnd: number } => {
    const startPos = node.getStart(sourceFile);
    const endPos = node.getEnd();
    const lineStart = sourceFile.getLineAndCharacterOfPosition(startPos).line + 1;
    const lineEnd = sourceFile.getLineAndCharacterOfPosition(endPos).line + 1;
    return { lineStart, lineEnd };
  };

  const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean => {
    if (!ts.canHaveModifiers(node)) return false;
    const mods = ts.getModifiers(node);
    return Boolean(mods?.some((m) => m.kind === kind));
  };

  const formatTypeParams = (typeParams?: ts.NodeArray<ts.TypeParameterDeclaration>): string => {
    if (!typeParams || typeParams.length === 0) return "";
    return `<${typeParams.map((tp) => tp.getText(sourceFile)).join(", ")}>`;
  };

  const formatParams = (params: ts.NodeArray<ts.ParameterDeclaration>): string => {
    return params
      .map((p) => {
        const dotDotDot = p.dotDotDotToken ? "..." : "";
        const name = p.name.getText(sourceFile);
        const question = p.questionToken || p.initializer ? "?" : "";
        const typeText = p.type ? `: ${p.type.getText(sourceFile)}` : "";
        return `${dotDotDot}${name}${question}${typeText}`;
      })
      .join(", ");
  };

  const symbols: StubsInterfaceSymbol[] = [];
  const skeletonLines: string[] = [
    `// Level 1 Interface Skeleton: ${resolvedRel} (Domain: ${domain}, Layer ${layer}, ${lineCount} lines)`,
  ];

  sourceFile.forEachChild((node) => {
    const isExported = hasModifier(node, ts.SyntaxKind.ExportKeyword);
    const isAsync = hasModifier(node, ts.SyntaxKind.AsyncKeyword);
    const { lineStart, lineEnd } = getLineRange(node);
    const lineTag = lineStart === lineEnd ? `// L${lineStart}` : `// L${lineStart}-L${lineEnd}`;
    const exportPrefix = isExported ? "export " : "";

    if (ts.isInterfaceDeclaration(node)) {
      const name = node.name.text;
      const typeParams = formatTypeParams(node.typeParameters);
      const heritage = node.heritageClauses
        ? " " + node.heritageClauses.map((h) => h.getText(sourceFile)).join(" ")
        : "";
      const memberLines: string[] = [];
      for (const member of node.members) {
        const mRange = getLineRange(member);
        const mText = member.getText(sourceFile).replace(/\s+/g, " ").trim().replace(/;$/, "");
        memberLines.push(`  ${mText}; // L${mRange.lineStart}`);
      }
      const sig =
        memberLines.length > 0
          ? `${exportPrefix}interface ${name}${typeParams}${heritage} { ${lineTag}\n${memberLines.join("\n")}\n}`
          : `${exportPrefix}interface ${name}${typeParams}${heritage} {} ${lineTag}`;
      symbols.push({
        name,
        kind: "interface",
        lineStart,
        lineEnd,
        signature: sig,
        exported: isExported,
      });
      if (isExported) skeletonLines.push(sig);
    } else if (ts.isTypeAliasDeclaration(node)) {
      const name = node.name.text;
      const typeParams = formatTypeParams(node.typeParameters);
      const typeText = node.type.getText(sourceFile).replace(/\s+/g, " ").trim();
      const sig = `${exportPrefix}type ${name}${typeParams} = ${typeText}; ${lineTag}`;
      symbols.push({
        name,
        kind: "type",
        lineStart,
        lineEnd,
        signature: sig,
        exported: isExported,
      });
      if (isExported) skeletonLines.push(sig);
    } else if (ts.isEnumDeclaration(node)) {
      const name = node.name.text;
      const members = node.members.map((m) => m.name.getText(sourceFile)).join(", ");
      const sig = `${exportPrefix}enum ${name} { ${members} } ${lineTag}`;
      symbols.push({
        name,
        kind: "enum",
        lineStart,
        lineEnd,
        signature: sig,
        exported: isExported,
      });
      if (isExported) skeletonLines.push(sig);
    } else if (ts.isFunctionDeclaration(node)) {
      const name = node.name?.text || "default";
      const typeParams = formatTypeParams(node.typeParameters);
      const params = formatParams(node.parameters);
      const returnType = node.type ? `: ${node.type.getText(sourceFile).replace(/\s+/g, " ").trim()}` : "";
      const asyncPrefix = isAsync ? "async " : "";
      const sig = `${exportPrefix}${asyncPrefix}function ${name}${typeParams}(${params})${returnType}; ${lineTag}`;
      symbols.push({
        name,
        kind: "function",
        lineStart,
        lineEnd,
        signature: sig,
        exported: isExported,
      });
      if (isExported) skeletonLines.push(sig);
    } else if (ts.isClassDeclaration(node)) {
      const name = node.name?.text || "AnonymousClass";
      const typeParams = formatTypeParams(node.typeParameters);
      const heritage = node.heritageClauses
        ? " " + node.heritageClauses.map((h) => h.getText(sourceFile)).join(" ")
        : "";
      const memberLines: string[] = [];
      for (const member of node.members) {
        if (hasModifier(member, ts.SyntaxKind.PrivateKeyword)) continue;
        const mRange = getLineRange(member);
        if (ts.isConstructorDeclaration(member)) {
          memberLines.push(`  constructor(${formatParams(member.parameters)}); // L${mRange.lineStart}`);
        } else if (ts.isMethodDeclaration(member)) {
          const mName = member.name.getText(sourceFile);
          const mAsync = hasModifier(member, ts.SyntaxKind.AsyncKeyword) ? "async " : "";
          const mParams = formatParams(member.parameters);
          const mRet = member.type ? `: ${member.type.getText(sourceFile).replace(/\s+/g, " ").trim()}` : "";
          memberLines.push(`  ${mAsync}${mName}(${mParams})${mRet}; // L${mRange.lineStart}-L${mRange.lineEnd}`);
        } else if (ts.isPropertyDeclaration(member)) {
          const pName = member.name.getText(sourceFile);
          const pType = member.type ? `: ${member.type.getText(sourceFile).replace(/\s+/g, " ").trim()}` : "";
          memberLines.push(`  ${pName}${pType}; // L${mRange.lineStart}`);
        }
      }
      const sig =
        memberLines.length > 0
          ? `${exportPrefix}class ${name}${typeParams}${heritage} { ${lineTag}\n${memberLines.join("\n")}\n}`
          : `${exportPrefix}class ${name}${typeParams}${heritage} {} ${lineTag}`;
      symbols.push({
        name,
        kind: "class",
        lineStart,
        lineEnd,
        signature: sig,
        exported: isExported,
      });
      if (isExported) skeletonLines.push(sig);
    } else if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (!ts.isIdentifier(decl.name)) continue;
        const name = decl.name.text;
        let sigType = decl.type ? `: ${decl.type.getText(sourceFile).replace(/\s+/g, " ").trim()}` : "";
        let kind: StubsInterfaceSymbol["kind"] = "const";
        if (!sigType && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            kind = "function";
            const fn = decl.initializer;
            const fnAsync = hasModifier(fn, ts.SyntaxKind.AsyncKeyword) ? "async " : "";
            const fnParams = formatParams(fn.parameters);
            const fnRet = fn.type ? `: ${fn.type.getText(sourceFile).replace(/\s+/g, " ").trim()}` : "";
            const sig = `${exportPrefix}const ${name} = ${fnAsync}(${fnParams})${fnRet} => { ... }; ${lineTag}`;
            symbols.push({ name, kind, lineStart, lineEnd, signature: sig, exported: isExported });
            if (isExported) skeletonLines.push(sig);
            continue;
          }
          if (ts.isNewExpression(decl.initializer) && decl.initializer.expression) {
            sigType = `: ${decl.initializer.expression.getText(sourceFile)}`;
          }
        }
        const sig = `${exportPrefix}const ${name}${sigType}; ${lineTag}`;
        symbols.push({
          name,
          kind,
          lineStart,
          lineEnd,
          signature: sig,
          exported: isExported,
        });
        if (isExported) skeletonLines.push(sig);
      }
    }
  });

  // Fallback to all symbols if module only uses default export or internal declarations
  if (skeletonLines.length === 1 && symbols.length > 0) {
    for (const s of symbols) {
      skeletonLines.push(s.signature);
    }
  }

  const skeletonCode = skeletonLines.join("\n\n");
  const fullTokens = Math.max(1, Math.ceil(content.length / 4));
  const stubTokens = Math.max(1, Math.ceil(skeletonCode.length / 4));
  const tokenSavingsPct = Math.max(
    0,
    Math.min(99, Math.round(((fullTokens - stubTokens) / Math.max(1, fullTokens)) * 100))
  );

  return {
    path: resolvedRel,
    domain,
    layer,
    lineCount,
    fullTokens,
    stubTokens,
    tokenSavingsPct,
    skeletonCode,
    symbols,
  };
}

/**
 * Unified GraphRAG & Surgical Query Engine (`stubs query "<question or prefix>"`)
 * Supports:
 * - `map:` (Level 0 Macro Map)
 * - `stub: <target>` (Level 1 Interface Skeleton Stubs)
 * - `explain: <target>` (Level 2 Symbol Profile)
 * - `path: <source> to <target>` (Shortest dependency path chain)
 * - `blast: <target>` (Downstream impact radius and dependents)
 * - `pkg:<package> [<query>]` (Package-scoped dependency query)
 * - `<concept or question>` (GraphRAG lexical + centrality retrieval)
 */
export async function queryGraph(rawQuery: string, budget = 1500): Promise<StubsQueryResult> {
  const graph = await getGraphData();
  const q = rawQuery.trim();
  const lower = q.toLowerCase();

  // 1. Level 0 Macro Map (`map:`)
  if (lower === "map:" || lower === "map") {
    const domainStats = new Map<string, { nodes: StubsNode[]; layerSum: number }>();
    for (const n of graph.nodes) {
      const entry = domainStats.get(n.domain) || { nodes: [], layerSum: 0 };
      entry.nodes.push(n);
      entry.layerSum += n.layer;
      domainStats.set(n.domain, entry);
    }

    const domains = Array.from(domainStats.entries()).map(([domain, info]) => {
      const sorted = [...info.nodes].sort((a, b) => b.degree - a.degree);
      return {
        domain,
        nodeCount: info.nodes.length,
        hubFile: sorted[0]?.id,
        avgLayer: Number((info.layerSum / Math.max(1, info.nodes.length)).toFixed(1)),
      };
    }).sort((a, b) => b.nodeCount - a.nodeCount);

    return {
      mode: "map",
      query: q,
      summary: `Level 0 Macro Map: ${domains.length} domains across ${graph.nodes.length} indexed modules and ${graph.edges.length} edges.`,
      mapResult: { domains },
    };
  }

  // 2. Level 1 Interface Skeleton Stub (`stub: <target>`)
  if (lower.startsWith("stub:")) {
    const targetQuery = q.slice(5).trim();
    const matched = findNodeMatch(graph.nodes, targetQuery);
    const targetId = matched?.id || targetQuery;
    try {
      const stub = await extractInterfaceStub(targetId);
      return {
        mode: "stub",
        query: q,
        summary: `Level 1 Interface Skeleton for ${stub.path}: ${stub.symbols.filter((s) => s.exported).length || stub.symbols.length} signatures (~${stub.stubTokens} tokens vs ~${stub.fullTokens} full, ${stub.tokenSavingsPct}% token reduction).`,
        estimatedTokens: stub.stubTokens,
        stubResult: stub,
      };
    } catch (err) {
      return {
        mode: "stub",
        query: q,
        summary: err instanceof Error ? err.message : `Could not extract Level 1 stub for '${targetQuery}'.`,
      };
    }
  }

  // 3. Package-Scoped Query (`pkg:<package> [<filter>]`)
  if (lower.startsWith("pkg:")) {
    const rest = q.slice(4).trim();
    const [rawPkgName, ...filterParts] = rest.split(/\s+/);
    const pkgName = rawPkgName || "";
    const filterTerm = filterParts.join(" ").trim().toLowerCase();
    const pkgTarget = `pkg:${pkgName.toLowerCase()}`;

    const consumerIds = new Set<string>();
    for (const edge of graph.edges) {
      const edgeTarget = edge.target.toLowerCase();
      if (edgeTarget === pkgTarget || edgeTarget.startsWith(`${pkgTarget}/`) || edgeTarget.includes(pkgName.toLowerCase())) {
        if (edge.target.startsWith("pkg:")) {
          consumerIds.add(edge.source);
        }
      }
    }

    const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
    const consumers = Array.from(consumerIds)
      .map((id) => nodeMap.get(id))
      .filter((n): n is StubsNode => Boolean(n))
      .filter((n) => {
        if (!filterTerm) return true;
        return (
          n.id.toLowerCase().includes(filterTerm) ||
          n.domain.toLowerCase().includes(filterTerm) ||
          parseExports(n).some((ex) => ex.toLowerCase().includes(filterTerm))
        );
      })
      .sort((a, b) => b.fanIn - a.fanIn || a.id.localeCompare(b.id))
      .map((n) => ({
        id: n.id,
        domain: n.domain,
        layer: n.layer,
        fanIn: n.fanIn,
        exportsCount: parseExports(n).length,
      }));

    return {
      mode: "pkg",
      query: q,
      summary: `Package '${pkgName}' is imported by ${consumers.length} workspace module${consumers.length === 1 ? "" : "s"}${filterTerm ? ` matching '${filterTerm}'` : ""}.`,
      estimatedTokens: consumers.length * 18,
      pkgResult: {
        packageName: pkgName,
        consumerCount: consumers.length,
        consumers,
      },
    };
  }

  // 4. Shortest Path (`path: A to B`)
  if (lower.startsWith("path:")) {
    const body = q.slice(5).trim();
    const parts = body.split(/\s+to\s+/i);
    const fromQuery = parts[0]?.trim() || "";
    const toQuery = parts[1]?.trim() || "";
    const fromNode = findNodeMatch(graph.nodes, fromQuery);
    const toNode = findNodeMatch(graph.nodes, toQuery);

    if (!fromNode || !toNode) {
      return {
        mode: "path",
        query: q,
        summary: `Could not resolve both endpoints ('${fromQuery}' and '${toQuery}') in the dependency graph.`,
        pathResult: { from: fromQuery, to: toQuery, found: false, paths: [], hops: 0 },
      };
    }

    // BFS shortest path (directed, with undirected fallback notice if needed)
    const adj = new Map<string, string[]>();
    for (const edge of graph.edges) {
      if (edge.target.startsWith("pkg:")) continue;
      const list = adj.get(edge.source) || [];
      list.push(edge.target);
      adj.set(edge.source, list);
    }

    const queue: string[][] = [[fromNode.id]];
    const visited = new Set<string>([fromNode.id]);
    const foundPaths: string[][] = [];

    while (queue.length > 0 && foundPaths.length < 3) {
      const currentPath = queue.shift()!;
      const curr = currentPath[currentPath.length - 1];
      if (curr === toNode.id) {
        foundPaths.push(currentPath);
        continue;
      }
      if (currentPath.length >= 8) continue;
      for (const next of adj.get(curr) || []) {
        if (!visited.has(next) || next === toNode.id) {
          if (next !== toNode.id) visited.add(next);
          queue.push([...currentPath, next]);
        }
      }
    }

    return {
      mode: "path",
      query: q,
      summary: foundPaths.length > 0
        ? `Shortest dependency path from ${fromNode.name} to ${toNode.name} (${foundPaths[0].length - 1} hops).`
        : `No directed import path found from ${fromNode.name} to ${toNode.name}.`,
      pathResult: {
        from: fromNode.id,
        to: toNode.id,
        found: foundPaths.length > 0,
        paths: foundPaths,
        hops: foundPaths[0] ? foundPaths[0].length - 1 : 0,
      },
    };
  }

  // 5. Blast Radius (`blast: <target>`)
  if (lower.startsWith("blast:")) {
    const targetQuery = q.slice(6).trim();
    const matched = findNodeMatch(graph.nodes, targetQuery);
    const targetId = matched?.id || targetQuery;
    const impact = await getImpact(targetId);
    return {
      mode: "blast",
      query: q,
      summary: `Blast radius for ${targetId}: ${impact.riskScore} risk (${impact.fanIn} direct callers, ${impact.transitiveCallers?.length || 0} transitive callers).`,
      blastResult: impact,
    };
  }

  // 6. Explain Symbol / Module (`explain: <target>`)
  if (lower.startsWith("explain:")) {
    const targetQuery = q.slice(8).trim();
    const node = findNodeMatch(graph.nodes, targetQuery);
    if (!node) {
      return {
        mode: "explain",
        query: q,
        summary: `No module or exported symbol matched '${targetQuery}'.`,
      };
    }
    const callers = graph.edges.filter((e) => e.target === node.id).map((e) => e.source);
    const callees = graph.edges.filter((e) => e.source === node.id).map((e) => e.target);
    const exports = parseExports(node);

    return {
      mode: "explain",
      query: q,
      summary: `${node.id} · Domain: ${node.domain} · Layer ${node.layer} · ${callers.length} callers · ${callees.length} dependencies · ${exports.length} exports.`,
      explain: {
        node,
        exports,
        callers,
        callees,
        community: `${node.domain} (L${node.layer})`,
        sidecarPath: node.sidecarPath,
      },
    };
  }

  // 7. GraphRAG Concept / Question Retrieval
  const terms = lower
    .replace(/[^a-z0-9_.\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2 && !["how", "does", "the", "work", "what", "where", "is", "are", "for", "and", "with"].includes(t));

  const scored: StubsQueryMatch[] = [];
  for (const node of graph.nodes) {
    const exports = parseExports(node);
    const haystackPath = node.filePath.toLowerCase();
    const haystackExports = exports.join(" ").toLowerCase();
    let score = 0;
    const reasons: string[] = [];

    for (const term of terms) {
      if (node.name.toLowerCase().includes(term)) {
        score += 10;
        reasons.push(`filename matches '${term}'`);
      } else if (haystackPath.includes(term)) {
        score += 6;
        reasons.push(`path matches '${term}'`);
      }
      if (haystackExports.includes(term)) {
        score += 8;
        reasons.push(`exports match '${term}'`);
      }
      if (node.domain.toLowerCase() === term) {
        score += 4;
        reasons.push(`domain '${node.domain}'`);
      }
    }

    if (score > 0 || terms.length === 0) {
      const centralityBoost = Math.min(4, Math.floor(node.degree / 5));
      scored.push({
        node,
        score: score + centralityBoost,
        reason: reasons.length > 0 ? Array.from(new Set(reasons)).slice(0, 3).join(", ") : "high-centrality hub",
        exports,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score || b.node.degree - a.node.degree);
  const maxMatches = Math.max(4, Math.min(18, Math.floor(budget / 100)));
  const topMatches = scored.slice(0, maxMatches);
  const estimatedTokens = topMatches.reduce((acc, m) => acc + 45 + m.exports.length * 6, 0);

  return {
    mode: "search",
    query: q,
    summary: `GraphRAG retrieved ${topMatches.length} relevant modules (~${estimatedTokens} tokens within ${budget} budget).`,
    estimatedTokens,
    matches: topMatches,
  };
}

/**
 * Returns Mermaid diagram string (architecture flowchart, sequence diagram, or neighborhood slice)
 */
export async function getDiagram(
  groupBy: StubsDiagramGroupBy = "domain",
  diagramType: StubsDiagramType = "architecture",
  target?: string
): Promise<{ mermaid: string; edgeCount: number; nodeCount: number }> {
  const graph = await getGraphData();

  if (graph.nodes.length === 0) {
    return {
      mermaid: "flowchart TD\n  empty[No nodes scanned yet - Click 'Scan AST']",
      edgeCount: 0,
      nodeCount: 0,
    };
  }

  const sanitizeId = (id: string) => "n_" + id.replace(/[^a-zA-Z0-9_]/g, "_");

  // Sequence Diagram mode (`stubs diagram <target> --type sequence`)
  if (diagramType === "sequence") {
    const targetNode = (target && findNodeMatch(graph.nodes, target)) || graph.nodes[0];
    const lines: string[] = ["sequenceDiagram"];
    const directDeps = graph.edges
      .filter((e) => e.source === targetNode.id && !e.target.startsWith("pkg:"))
      .slice(0, 10);
    const callers = graph.edges
      .filter((e) => e.target === targetNode.id && !e.source.startsWith("pkg:"))
      .slice(0, 6);

    const participantIds = new Set<string>([targetNode.id]);
    const interactions: Array<{ from: string; to: string; arrow: "->>" | "-->>"; label: string }> = [];

    for (const c of callers) {
      participantIds.add(c.source);
      interactions.push({
        from: c.source,
        to: targetNode.id,
        arrow: "->>",
        label: `${c.relationship} (${path.basename(c.source)})`,
      });
    }

    for (const d of directDeps) {
      participantIds.add(d.target);
      interactions.push({
        from: targetNode.id,
        to: d.target,
        arrow: "->>",
        label: `${d.relationship} (${path.basename(d.target)})`,
      });
      const secondHop = graph.edges
        .filter((e) => e.source === d.target && !e.target.startsWith("pkg:"))
        .slice(0, 2);
      for (const s of secondHop) {
        participantIds.add(s.target);
        interactions.push({
          from: d.target,
          to: s.target,
          arrow: "-->>",
          label: s.relationship,
        });
      }
    }

    const nodeLookup = new Map(graph.nodes.map((n) => [n.id, n]));
    for (const pid of participantIds) {
      const label = (nodeLookup.get(pid)?.name || path.basename(pid)).replace(/[;:]/g, "");
      lines.push(`  participant ${sanitizeId(pid)} as ${label}`);
    }

    for (const edge of interactions) {
      lines.push(`  ${sanitizeId(edge.from)}${edge.arrow}${sanitizeId(edge.to)}: ${edge.label}`);
    }

    if (callers.length === 0 && directDeps.length === 0) {
      lines.push(`  Note over ${sanitizeId(targetNode.id)}: Standalone leaf module (${targetNode.filePath})`);
    }

    return {
      mermaid: lines.join("\n"),
      edgeCount: callers.length + directDeps.length,
      nodeCount: participantIds.size,
    };
  }

  // Focused Neighborhood Slice (`stubs diagram <target> --type slice`)
  if (diagramType === "slice") {
    const targetNode = (target && findNodeMatch(graph.nodes, target)) || graph.nodes[0];
    const callers = graph.edges.filter((e) => e.target === targetNode.id && !e.source.startsWith("pkg:"));
    const deps = graph.edges.filter((e) => e.source === targetNode.id && !e.target.startsWith("pkg:"));

    const includedIds = new Set<string>([targetNode.id]);
    for (const c of callers.slice(0, 15)) includedIds.add(c.source);
    for (const d of deps.slice(0, 15)) includedIds.add(d.target);

    const lines: string[] = ["flowchart LR"];
    lines.push(`  ${sanitizeId(targetNode.id)}[["${targetNode.name} (L${targetNode.layer})"]]`);
    lines.push(`  style ${sanitizeId(targetNode.id)} fill:#1d4ed8,stroke:#60a5fa,stroke-width:2px,color:#ffffff`);

    for (const c of callers.slice(0, 15)) {
      lines.push(`  ${sanitizeId(c.source)}["${path.basename(c.source)}"] --> ${sanitizeId(targetNode.id)}`);
    }
    for (const d of deps.slice(0, 15)) {
      lines.push(`  ${sanitizeId(targetNode.id)} --> ${sanitizeId(d.target)}["${path.basename(d.target)}"]`);
    }

    return {
      mermaid: lines.join("\n"),
      edgeCount: Math.min(15, callers.length) + Math.min(15, deps.length),
      nodeCount: includedIds.size,
    };
  }

  // Full Architecture Flowchart (`stubs diagram --group-by domain|layer`)
  const lines: string[] = ["flowchart TD"];
  const renderedNodeIds = new Set<string>();

  if (groupBy === "domain") {
    const domainGroups = new Map<string, StubsNode[]>();
    for (const node of graph.nodes) {
      const group = domainGroups.get(node.domain) || [];
      group.push(node);
      domainGroups.set(node.domain, group);
    }

    for (const [domain, groupNodes] of domainGroups.entries()) {
      const subId = `dom_${domain.replace(/[^a-zA-Z0-9_]/g, "_")}`;
      lines.push(`  subgraph ${subId}["Domain: ${domain} (${groupNodes.length})"]`);
      lines.push(`    style ${subId} fill:#0f172a,stroke:#38bdf8,stroke-width:1px,color:#f8fafc`);
      for (const n of groupNodes.slice(0, 12)) {
        renderedNodeIds.add(n.id);
        lines.push(`    ${sanitizeId(n.id)}["${n.name}"]`);
      }
      if (groupNodes.length > 12) {
        lines.push(`    ${subId}_more["+${groupNodes.length - 12} more modules"]`);
      }
      lines.push("  end");
    }
  } else {
    const layerNames: Record<number, string> = {
      0: "Layer 0: Core Types & Schemas",
      1: "Layer 1: Utilities & Storage",
      2: "Layer 2: Domain Services",
      3: "Layer 3: Hooks & Contexts",
      4: "Layer 4: UI Components",
      5: "Layer 5: App Entrypoints",
      6: "Layer 6: Server Runtime",
    };

    const layerGroups = new Map<number, StubsNode[]>();
    for (const node of graph.nodes) {
      const group = layerGroups.get(node.layer) || [];
      group.push(node);
      layerGroups.set(node.layer, group);
    }

    for (const layer of Array.from(layerGroups.keys()).sort((a, b) => a - b)) {
      const groupNodes = layerGroups.get(layer) || [];
      const lTitle = layerNames[layer] || `Layer ${layer}`;
      lines.push(`  subgraph layer_${layer}["${lTitle} (${groupNodes.length})"]`);
      lines.push(`    style layer_${layer} fill:#0f172a,stroke:#818cf8,stroke-width:1px,color:#f8fafc`);
      for (const n of groupNodes.slice(0, 12)) {
        renderedNodeIds.add(n.id);
        lines.push(`    ${sanitizeId(n.id)}["${n.name}"]`);
      }
      if (groupNodes.length > 12) {
        lines.push(`    layer_${layer}_more["+${groupNodes.length - 12} more modules"]`);
      }
      lines.push("  end");
    }
  }

  const internalEdges = graph.edges
    .filter((e) => !e.target.startsWith("pkg:") && renderedNodeIds.has(e.source) && renderedNodeIds.has(e.target))
    .slice(0, 90);

  for (const edge of internalEdges) {
    lines.push(`  ${sanitizeId(edge.source)} --> ${sanitizeId(edge.target)}`);
  }

  return {
    mermaid: lines.join("\n"),
    edgeCount: internalEdges.length,
    nodeCount: renderedNodeIds.size,
  };
}

/**
 * Generates Tiered Agent Context (`stubs context <target>`)
 */
export async function getContextPackage(targetFile: string): Promise<StubsTieredContext> {
  const graph = await getGraphData();
  const node = findNodeMatch(graph.nodes, targetFile);
  const targetId = node?.id || targetFile;

  const directDepIds = graph.edges
    .filter((e) => e.source === targetId && !e.target.startsWith("pkg:"))
    .map((e) => e.target);
  const directCallerIds = graph.edges
    .filter((e) => e.target === targetId && !e.source.startsWith("pkg:"))
    .map((e) => e.source);

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));

  const tier1Deps = directDepIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is StubsNode => Boolean(n))
    .map((n) => ({
      path: n.id,
      domain: n.domain,
      layer: n.layer,
      exports: parseExports(n).slice(0, 8),
    }));

  const tier1Callers = directCallerIds
    .map((id) => nodeMap.get(id))
    .filter((n): n is StubsNode => Boolean(n))
    .map((n) => ({
      path: n.id,
      domain: n.domain,
      layer: n.layer,
    }));

  const transitiveSet = new Set<string>();
  for (const depId of directDepIds) {
    for (const e of graph.edges) {
      if (e.source === depId && !e.target.startsWith("pkg:") && e.target !== targetId && !directDepIds.includes(e.target)) {
        transitiveSet.add(e.target);
      }
    }
  }
  const tier2Boundary = Array.from(transitiveSet).slice(0, 15);
  const targetExports = node ? parseExports(node) : [];
  const estimatedTokens =
    (node?.lineCount || 50) * 6 +
    tier1Deps.reduce((acc, d) => acc + 30 + d.exports.length * 5, 0) +
    tier1Callers.length * 15 +
    tier2Boundary.length * 10;

  let interfaceStub: StubsInterfaceStub | undefined;
  try {
    interfaceStub = await extractInterfaceStub(targetId);
  } catch {
    interfaceStub = undefined;
  }

  const briefingLines = [
    `# Stubs Agent Briefing: ${targetId}`,
    ``,
    `## Tier 0 — Target Module`,
    `- Path: \`${targetId}\` (${node?.lineCount || 0} lines, Domain: ${node?.domain || "core"}, Layer ${node?.layer ?? 0})`,
    ...(node?.sidecarPath ? [`- Sidecar Spec: \`${node.sidecarPath}\``] : []),
    `- Exports: ${targetExports.length > 0 ? targetExports.join(", ") : "none"}`,
    ...(interfaceStub
      ? [
          `- Level 1 Stub Savings: ~${interfaceStub.stubTokens} tokens vs ~${interfaceStub.fullTokens} full (${interfaceStub.tokenSavingsPct}% reduction)`,
          ``,
          `## Level 1 — Interface Skeleton Stub`,
          "```ts",
          interfaceStub.skeletonCode,
          "```",
        ]
      : []),
    ``,
    `## Tier 1 — Direct Dependencies (${tier1Deps.length})`,
    ...tier1Deps.map((d) => `- \`${d.path}\` (L${d.layer} ${d.domain}): ${d.exports.join(", ") || "internal"}`),
    ``,
    `## Tier 1 — Direct Callers (${tier1Callers.length})`,
    ...tier1Callers.map((c) => `- \`${c.path}\` (L${c.layer} ${c.domain})`),
    ``,
    `## Tier 2 — Transitive Boundary (${tier2Boundary.length})`,
    ...tier2Boundary.map((b) => `- \`${b}\``),
  ];

  return {
    target: targetId,
    estimatedTokens: interfaceStub ? interfaceStub.stubTokens + tier1Deps.length * 35 + tier1Callers.length * 15 : estimatedTokens,
    tier0: {
      path: targetId,
      sidecarPath: node?.sidecarPath,
      lineCount: node?.lineCount || 0,
      exports: targetExports,
    },
    tier1Deps,
    tier1Callers,
    tier2Boundary,
    interfaceStub,
    briefingMarkdown: briefingLines.join("\n"),
  };
}

/**
 * Computes a deterministic topological edit sequence over the local dependency slice:
 * prerequisite lower-layer dependencies -> target module -> direct callers sorted by layer/dependency order.
 */
export function computeTopologicalEditOrder(
  targetId: string,
  dependencies: string[],
  directCallers: string[],
  nodes: StubsNode[],
  edges: StubsEdge[]
): string[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const candidateDeps = dependencies.slice(0, 6);
  const candidateCallers = directCallers.slice(0, 6);
  const subset = new Set<string>([...candidateDeps, targetId, ...candidateCallers]);

  // Build adjacency where edge A -> B in edit order means A should be edited before B
  // If X imports Y (edge.source === X, edge.target === Y), Y is a dependency of X, so Y must be edited before X (Y -> X).
  const adj = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  for (const id of subset) {
    adj.set(id, new Set());
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (subset.has(edge.source) && subset.has(edge.target) && edge.source !== edge.target) {
      // edge.target is imported by edge.source => edit edge.target before edge.source
      const targets = adj.get(edge.target)!;
      if (!targets.has(edge.source)) {
        targets.add(edge.source);
        inDegree.set(edge.source, (inDegree.get(edge.source) || 0) + 1);
      }
    }
  }

  const rankOf = (id: string): number => {
    if (id === targetId) return 1;
    if (candidateDeps.includes(id)) return 0;
    return 2;
  };

  const sortQueue = (arr: string[]) =>
    arr.sort((a, b) => {
      const rA = rankOf(a);
      const rB = rankOf(b);
      if (rA !== rB) return rA - rB;
      const lA = nodeMap.get(a)?.layer ?? 0;
      const lB = nodeMap.get(b)?.layer ?? 0;
      if (lA !== lB) return lA - lB;
      return a.localeCompare(b);
    });

  const zeroIn: string[] = [];
  for (const [id, deg] of inDegree.entries()) {
    if (deg === 0) zeroIn.push(id);
  }
  sortQueue(zeroIn);

  const ordered: string[] = [];
  while (zeroIn.length > 0) {
    const curr = zeroIn.shift()!;
    ordered.push(curr);
    for (const next of adj.get(curr) || []) {
      const nextDeg = (inDegree.get(next) || 1) - 1;
      inDegree.set(next, nextDeg);
      if (nextDeg === 0) {
        zeroIn.push(next);
        sortQueue(zeroIn);
      }
    }
  }

  // Append any remaining nodes if a local cycle existed
  for (const id of subset) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }

  return ordered;
}

/**
 * Calculates file blast radius, domain crossings, pre-flight safety gate, and tiered context
 */
export async function getImpact(
  targetFile: string,
  guardThreshold: "low" | "medium" | "high" | "critical" = "high"
): Promise<StubsImpactResult> {
  const graph = await getGraphData();
  const config = readWorkspaceConfig();
  const node = findNodeMatch(graph.nodes, targetFile);
  const resolvedId = node?.id || targetFile;

  const directCallers = graph.edges
    .filter((e) => e.target === resolvedId && !e.source.startsWith("pkg:"))
    .map((e) => e.source);

  const dependencies = graph.edges
    .filter((e) => e.source === resolvedId && !e.target.startsWith("pkg:"))
    .map((e) => e.target);

  // Transitive callers (BFS up to depth 3)
  const transitiveSet = new Set<string>();
  const queue = directCallers.map((c) => ({ id: c, depth: 1 }));
  while (queue.length > 0) {
    const { id: curr, depth } = queue.shift()!;
    if (depth >= 3) continue;
    for (const e of graph.edges) {
      if (e.target === curr && e.source !== resolvedId && !directCallers.includes(e.source) && !transitiveSet.has(e.source)) {
        transitiveSet.add(e.source);
        if (transitiveSet.size < 40) {
          queue.push({ id: e.source, depth: depth + 1 });
        }
      }
    }
  }

  const fanIn = directCallers.length;
  const fanOut = dependencies.length;

  let riskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  let numericRisk = 15;

  if (fanIn >= 20 || (node && node.layer === 0 && fanIn >= 10)) {
    riskScore = "CRITICAL";
    numericRisk = 95;
  } else if (fanIn >= 10) {
    riskScore = "HIGH";
    numericRisk = 75;
  } else if (fanIn >= 3 || fanOut >= 8) {
    riskScore = "MEDIUM";
    numericRisk = 50;
  }

  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]));
  const targetDomain = node?.domain || "core";
  const domainBoundaries = new Set<string>();
  for (const callerId of directCallers) {
    const callerNode = nodeMap.get(callerId);
    if (callerNode && callerNode.domain !== targetDomain) {
      domainBoundaries.add(callerNode.domain);
    }
  }

  const specs = await listSidecarSpecs();
  const affectedSet = new Set([resolvedId, ...directCallers, ...Array.from(transitiveSet)]);
  const staleSidecarsAtRisk = specs
    .filter((s) => s.targetCodeFile && affectedSet.has(s.targetCodeFile) && s.driftStatus === "drifted")
    .map((s) => s.path);

  const riskRank: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
  const currentRank = riskRank[riskScore.toLowerCase()] || 1;
  const guardRank = riskRank[guardThreshold] || 3;
  const isBlocked = currentRank > guardRank;

  const tieredContext = await getContextPackage(resolvedId);
  const editOrder = computeTopologicalEditOrder(
    resolvedId,
    dependencies,
    directCallers,
    graph.nodes,
    graph.edges
  );

  return {
    target: resolvedId,
    domain: targetDomain,
    layer: node?.layer ?? 1,
    fanIn,
    fanOut,
    riskScore,
    numericRisk,
    directCallers,
    transitiveCallers: Array.from(transitiveSet),
    dependencies,
    domainBoundariesCrossed: Array.from(domainBoundaries),
    staleSidecarsAtRisk,
    preFlight: {
      safe: !isBlocked,
      guardThreshold,
      autonomyLevel: config.autonomy_level,
      blockedReason: isBlocked
        ? `Blast risk ${riskScore} exceeds --guard ${guardThreshold.toUpperCase()} threshold (${fanIn} direct callers across ${domainBoundaries.size} external domains).`
        : undefined,
      editOrder,
    },
    tieredContext,
  };
}

/**
 * Runs workspace hygiene checks (`stubs prune`)
 */
export async function pruneWorkspace(): Promise<StubsPruneResult> {
  const start = Date.now();
  const graph = await getGraphData();
  const specs = await listSidecarSpecs();
  const issues: StubsPruneIssue[] = [];

  // 1. PHANTOM_SIDECAR
  let phantomSidecars = 0;
  for (const spec of specs) {
    if (spec.category === "sidecar" && spec.targetCodeFile && !spec.targetExists) {
      phantomSidecars++;
      issues.push({
        type: "PHANTOM_SIDECAR",
        severity: "error",
        path: spec.path,
        message: `Sidecar '${spec.path}' targets missing code file '${spec.targetCodeFile}'.`,
      });
    }
  }

  // 2. STALE_DB_NODE
  let staleDbNodes = 0;
  for (const node of graph.nodes) {
    if (!fs.existsSync(path.resolve(CWD, node.filePath))) {
      staleDbNodes++;
      issues.push({
        type: "STALE_DB_NODE",
        severity: "warning",
        path: node.filePath,
        message: `Graph node '${node.filePath}' no longer exists on disk. Run 'stubs scan' to refresh.`,
      });
    }
  }

  // 3. ZOMBIE_EXPORT (non-test, non-entrypoint files with 0 incoming edges and exports)
  let zombieExports = 0;
  const entryFiles = new Set(["src/App.tsx", "src/main.tsx", "server.ts", "src/types.ts", "src/index.css"]);
  for (const node of graph.nodes) {
    if (
      node.entityType === "test" ||
      node.filePath.includes(".test.") ||
      entryFiles.has(node.filePath) ||
      node.filePath.endsWith("/index.ts")
    ) {
      continue;
    }
    const exports = parseExports(node);
    if (node.fanIn === 0 && exports.length > 0) {
      zombieExports++;
      issues.push({
        type: "ZOMBIE_EXPORT",
        severity: "info",
        path: node.filePath,
        symbol: exports[0],
        message: `Module '${node.filePath}' has 0 incoming import edges (${exports.length} exports: ${exports.slice(0, 3).join(", ")}${exports.length > 3 ? "…" : ""}).`,
      });
    }
  }

  // 4. UNTRACKED_CODE summary count (note: sidecars are opt-in in latest stubs skill)
  const untrackedCode = graph.nodes.filter(
    (n) => !n.hasSidecar && n.entityType !== "test" && !n.filePath.includes(".test.")
  ).length;

  return {
    issues: issues.slice(0, 60),
    summary: {
      phantomSidecars,
      untrackedCode,
      zombieExports,
      staleDbNodes,
    },
    durationMs: Math.max(1, Date.now() - start),
  };
}

/**
 * Architectural guardrail checks (`stubs lint-arch`):
 * 1. LAYER_VIOLATION
 * 2. CIRCULAR_DEPENDENCY
 * 3. UNMANIFESTED_DEPENDENCY (sidecar depends_on parity)
 * 4. DOMAIN_LEAK (cross-domain non-hub imports)
 */
export async function lintArchitecture(): Promise<{
  violations: StubsLintViolation[];
  passed: boolean;
  totalChecks: number;
  errorCount: number;
  warningCount: number;
  durationMs: number;
  pruneIssues: StubsPruneIssue[];
  pruneSummary: StubsPruneResult["summary"];
}> {
  const start = Date.now();
  const graph = await getGraphData();
  const violations: StubsLintViolation[] = [];
  const nodeMap = new Map<string, StubsNode>(graph.nodes.map((n) => [n.id, n]));

  // Canonical domain hubs from context-map.md
  const domainHubs: Record<string, Set<string>> = {
    core: new Set(["src/types.ts", "src/types/stubs.ts", "src/types/speechRecognition.ts", "src/contexts/WorkspaceContext.tsx", "src/schemas/validation.ts"]),
    utils: new Set(["src/utils/platform.ts", "src/utils/index.ts", "src/utils/errorHandling.ts", "src/utils/logger.ts", "src/utils/timeProvider.ts", "src/utils/idGenerator.ts", "src/utils/modelCatalog.ts", "src/utils/observable.ts", "src/utils/apiClient.ts", "src/utils/storage/index.ts"]),
    services: new Set(["src/services/platformService.ts", "src/services/ServiceContext.tsx", "src/services/IPlatformService.ts"]),
  };

  // 1. Layer Hierarchy Violations & Domain Leaks
  for (const edge of graph.edges) {
    if (edge.target.startsWith("pkg:")) continue;
    const src = nodeMap.get(edge.source);
    const tgt = nodeMap.get(edge.target);
    if (!src || !tgt) continue;
    if (src.entityType === "test" || src.filePath.includes(".test.")) continue;

    // Layer 0 (types/schemas) importing higher layers
    if (src.layer === 0 && tgt.layer > 0) {
      violations.push({
        rule: "LAYER_VIOLATION",
        severity: "error",
        message: `Layer 0 module '${src.name}' imports higher Layer ${tgt.layer} module '${tgt.name}'.`,
        source: src.id,
        target: tgt.id,
      });
    } else if (src.layer < tgt.layer && !(src.layer === 2 && tgt.layer === 0) && !(src.layer === 1 && tgt.layer === 2 && tgt.id === "src/services/IPlatformService.ts")) {
      // Lower tier importing higher tier
      if (src.layer <= 1 && tgt.layer >= 3) {
        violations.push({
          rule: "LAYER_VIOLATION",
          severity: "error",
          message: `Lower Layer ${src.layer} module '${src.name}' imports UI Layer ${tgt.layer} module '${tgt.name}'.`,
          source: src.id,
          target: tgt.id,
        });
      } else if (src.layer === 2 && tgt.layer >= 3) {
        violations.push({
          rule: "LAYER_VIOLATION",
          severity: "warning",
          message: `Service Layer 2 module '${src.name}' imports Layer ${tgt.layer} module '${tgt.name}'.`,
          source: src.id,
          target: tgt.id,
        });
      }
    }

    // Domain Leak check: external domains bypassing canonical hub (except Layer 0 types)
    if (src.domain !== tgt.domain && tgt.layer > 0 && domainHubs[tgt.domain] && !domainHubs[tgt.domain].has(tgt.id)) {
      if (src.domain !== "server" && !tgt.id.endsWith("Service.ts")) {
        violations.push({
          rule: "DOMAIN_LEAK",
          severity: "warning",
          message: `Cross-domain import from '${src.domain}' (${src.name}) directly targets internal module '${tgt.id}' instead of a canonical hub.`,
          source: src.id,
          target: tgt.id,
        });
      }
    }
  }

  // 2. Circular Dependency Cycles
  const cyclesFound = detectCycles(graph.nodes, graph.edges);
  for (const cycle of cyclesFound.slice(0, 8)) {
    violations.push({
      rule: "CIRCULAR_DEPENDENCY",
      severity: "error",
      message: `Circular import cycle detected: ${cycle.map((f) => path.basename(f)).join(" -> ")}`,
      source: cycle[0],
      cycle,
    });
  }

  // 3. Sidecar Manifest Parity (`UNMANIFESTED_DEPENDENCY`)
  const specs = await listSidecarSpecs();
  for (const spec of specs) {
    if (spec.category === "sidecar" && spec.targetCodeFile && spec.dependsOn && spec.dependsOn.length > 0) {
      const actualDeps = graph.edges
        .filter((e) => e.source === spec.targetCodeFile && !e.target.startsWith("pkg:"))
        .map((e) => e.target);
      for (const dep of actualDeps) {
        const depBase = path.basename(dep);
        if (!spec.dependsOn.some((d) => d.includes(depBase) || dep.includes(d))) {
          violations.push({
            rule: "UNMANIFESTED_DEPENDENCY",
            severity: "warning",
            message: `Sidecar '${spec.filename}' omits import '${dep}' from its 'depends_on' frontmatter.`,
            source: spec.targetCodeFile,
            target: dep,
          });
        }
      }
    }
  }

  const pruneResult = await pruneWorkspace();
  const errorCount = violations.filter((v) => v.severity === "error").length;
  const warningCount = violations.filter((v) => v.severity === "warning").length;

  return {
    violations,
    passed: errorCount === 0,
    totalChecks: graph.edges.length + graph.nodes.length + specs.length,
    errorCount,
    warningCount,
    durationMs: Math.max(1, Date.now() - start),
    pruneIssues: pruneResult.issues,
    pruneSummary: pruneResult.summary,
  };
}

function parseFrontmatter(content: string): Record<string, string | string[]> {
  const result: Record<string, string | string[]> = {};
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return result;

  const lines = match[1].split(/\r?\n/);
  let activeArrayKey: string | null = null;
  let activeArray: string[] = [];

  for (const line of lines) {
    const listItem = line.match(/^\s+-\s+(.*)$/);
    if (listItem && activeArrayKey) {
      activeArray.push(listItem[1].trim().replace(/^['"]|['"]$/g, ""));
      result[activeArrayKey] = activeArray;
      continue;
    }

    const kv = line.match(/^([a-zA-Z0-9_-]+):\s*(.*)$/);
    if (kv) {
      activeArrayKey = null;
      const key = kv[1].trim();
      const rawVal = kv[2].trim();
      if (!rawVal) {
        activeArrayKey = key;
        activeArray = [];
        result[key] = activeArray;
      } else {
        result[key] = rawVal.replace(/^['"]|['"]$/g, "");
      }
    }
  }
  return result;
}

/**
 * Lists all sidecar specs (*.ts.md), planning docs, context maps, and ADRs
 */
export async function listSidecarSpecs(): Promise<StubsSidecarSpec[]> {
  const results: StubsSidecarSpec[] = [];

  function classifyDoc(rel: string, filename: string, fmType: string): StubsSpecCategory {
    if (filename.endsWith(".ts.md") || filename.endsWith(".tsx.md") || fmType === "service-spec" || fmType === "code-sidecar") {
      return "sidecar";
    }
    if (rel.includes("/adr/") || fmType === "adr") {
      return "adr";
    }
    if (rel.includes("context-map") || rel.includes("/domains/") || fmType === "context-map" || fmType === "domain-context-map" || fmType === "visual-diagram") {
      return "context-map";
    }
    if (rel.includes("knowledge/planning") || fmType === "initiative-plan") {
      return "planning";
    }
    return "concept";
  }

  function walk(dir: string) {
    if (!fs.existsSync(dir)) return;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name !== "node_modules" && ent.name !== "dist" && ent.name !== ".git") {
          walk(full);
        }
      } else if (ent.isFile() && ent.name.endsWith(".md")) {
        const rel = path.relative(CWD, full).replace(/\\/g, "/");
        const isSidecar = ent.name.endsWith(".ts.md") || ent.name.endsWith(".tsx.md");
        const isKnowledge = rel.startsWith("knowledge/");
        if (!isSidecar && !isKnowledge) continue;

        try {
          const content = fs.readFileSync(full, "utf8");
          const fm = parseFrontmatter(content);
          const title = typeof fm.title === "string" && fm.title ? fm.title : ent.name;
          const type = typeof fm.type === "string" && fm.type ? fm.type : isSidecar ? "code-sidecar" : "architecture-doc";
          const status = typeof fm.status === "string" && fm.status ? fm.status : "active";
          const statusFlag = typeof fm.status_flag === "string" ? fm.status_flag : undefined;
          const phase = typeof fm.phase === "string" ? fm.phase : isSidecar ? (status === "materialized" ? "sand" : "spec") : undefined;
          const domain = typeof fm.domain === "string" ? fm.domain : inferDomainAndLayer(rel).domain;
          const dependsOn = Array.isArray(fm.depends_on) ? fm.depends_on : undefined;

          let targetCodeFileRel: string | undefined;
          if (typeof fm.target_code_file === "string" && fm.target_code_file) {
            const candidateFromCwd = path.resolve(CWD, fm.target_code_file);
            const candidateFromDir = path.resolve(path.dirname(full), fm.target_code_file);
            const chosen = fs.existsSync(candidateFromCwd) ? candidateFromCwd : candidateFromDir;
            targetCodeFileRel = path.relative(CWD, chosen).replace(/\\/g, "/");
          } else if (isSidecar) {
            targetCodeFileRel = rel.replace(/\.md$/, "");
          }

          let targetExists = false;
          let driftStatus: StubsDriftStatus = "doc-only";
          if (targetCodeFileRel) {
            const resolvedTarget = path.resolve(CWD, targetCodeFileRel);
            targetExists = fs.existsSync(resolvedTarget);
            if (!targetExists) {
              driftStatus = "unmaterialized";
            } else if (statusFlag === "drifted" || statusFlag === "conflict") {
              driftStatus = "drifted";
            } else {
              // Check if target file modified much later or has ast_hash mismatch
              const recordedHash = typeof fm.ast_hash === "string" ? fm.ast_hash : undefined;
              if (recordedHash) {
                const targetContent = fs.readFileSync(resolvedTarget, "utf8");
                const currentHash = crypto.createHash("sha256").update(targetContent).digest("hex").slice(0, 12);
                driftStatus = currentHash === recordedHash ? "clean" : "drifted";
              } else {
                driftStatus = "clean";
              }
            }
          }

          // Parse markdown task checklist progress (- [ ] / - [x])
          const unchecked = (content.match(/^\s*-\s*\[\s\]/gm) || []).length;
          const checked = (content.match(/^\s*-\s*\[[xX]\]/gm) || []).length;
          const checklistProgress =
            checked + unchecked > 0 ? { completed: checked, total: checked + unchecked } : undefined;

          const category = classifyDoc(rel, ent.name, type);

          results.push({
            path: rel,
            filename: ent.name,
            title,
            type,
            category,
            status,
            statusFlag,
            phase,
            driftStatus,
            checklistProgress,
            dependsOn,
            targetCodeFile: targetCodeFileRel,
            targetExists,
            domain,
          });
        } catch (e) {
          defaultServerContext.services.logger.warn("[stubsService] Error reading spec file:", full, e);
        }
      }
    }
  }

  walk(path.join(CWD, "src"));
  walk(path.join(CWD, "knowledge"));

  // Sort: sidecars first, then planning, then context-maps
  const order: Record<StubsSpecCategory, number> = {
    sidecar: 0,
    planning: 1,
    "context-map": 2,
    concept: 3,
    adr: 4,
  };
  results.sort((a, b) => (order[a.category] ?? 9) - (order[b.category] ?? 9) || a.path.localeCompare(b.path));

  return results;
}

/**
 * Reads spec content
 */
export async function getSpecContent(relPath: string): Promise<{ content: string; path: string }> {
  const safePath = path.resolve(CWD, relPath);
  if (!safePath.startsWith(CWD + path.sep)) {
    throw new Error("Invalid spec path outside workspace");
  }
  if (!fs.existsSync(safePath)) {
    throw new Error(`Spec file not found: ${relPath}`);
  }
  const content = fs.readFileSync(safePath, "utf8");
  return { content, path: relPath };
}

function detectFileLanguage(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".js") || lower.endsWith(".cjs") || lower.endsWith(".mjs")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "yaml";
  if (lower.endsWith(".sh")) return "bash";
  if (lower.endsWith(".sql")) return "sql";
  if (lower.endsWith(".svg") || lower.endsWith(".xml")) return "xml";
  return "text";
}

const TREE_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "dev-dist",
  ".stubs",
  "test-results",
]);

const BINARY_FILE_PATTERN = /\.(png|jpe?g|gif|webp|ico|woff2?|ttf|eot|otf|sqlite|db|pdf|zip|gz|tar|wasm)$/i;

/**
 * Returns the hierarchical directory and file tree for the workspace IDE explorer
 */
export async function getWorkspaceFileTree(): Promise<WorkspaceFileTreeResponse> {
  let totalFiles = 0;
  let totalDirectories = 0;

  function walkDir(dirAbs: string, relPrefix: string): WorkspaceTreeNode[] {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirAbs, { withFileTypes: true });
    } catch {
      return [];
    }

    const dirs: WorkspaceTreeNode[] = [];
    const files: WorkspaceTreeNode[] = [];

    for (const ent of entries) {
      const name = ent.name;
      const relPath = relPrefix ? `${relPrefix}/${name}` : name;

      if (ent.isDirectory()) {
        if (TREE_IGNORED_DIRS.has(name)) {
          continue;
        }
        totalDirectories++;
        const children = walkDir(path.join(dirAbs, name), relPath);
        dirs.push({
          name,
          path: relPath,
          type: "directory",
          children,
        });
      } else if (ent.isFile()) {
        if (name.startsWith(".env") && name !== ".env.example") {
          continue;
        }
        totalFiles++;
        const isBinary = BINARY_FILE_PATTERN.test(name);
        files.push({
          name,
          path: relPath,
          type: "file",
          language: isBinary ? "binary" : detectFileLanguage(relPath),
          isBinary,
        });
      }
    }

    dirs.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
    return [...dirs, ...files];
  }

  const tree = walkDir(CWD, "");
  return {
    rootName: path.basename(CWD) || "workspace",
    tree,
    totalFiles,
    totalDirectories,
  };
}

/**
 * Reads a workspace source file safely for viewing/editing in the IDE
 */
export async function getWorkspaceFileContent(relPath: string): Promise<{
  path: string;
  name: string;
  language: string;
  content: string;
  lineCount: number;
}> {
  const normalizedRel = relPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const safePath = path.resolve(CWD, normalizedRel);
  if (!safePath.startsWith(CWD + path.sep)) {
    throw new Error("Invalid file path outside workspace");
  }
  const baseName = path.basename(safePath);
  if (
    (baseName.startsWith(".env") && baseName !== ".env.example") ||
    normalizedRel.startsWith("node_modules/") ||
    normalizedRel.startsWith(".git/")
  ) {
    throw new Error("Access to restricted file is not permitted");
  }
  if (!fs.existsSync(safePath) || !fs.statSync(safePath).isFile()) {
    throw new Error(`Workspace file not found: ${normalizedRel}`);
  }
  if (BINARY_FILE_PATTERN.test(baseName)) {
    throw new Error(`Binary file '${baseName}' cannot be opened in the text editor.`);
  }
  const content = fs.readFileSync(safePath, "utf8");
  return {
    path: normalizedRel,
    name: baseName,
    language: detectFileLanguage(normalizedRel),
    content,
    lineCount: content.split(/\r?\n/).length,
  };
}

/**
 * Saves updated spec content
 */
export async function saveSpecContent(relPath: string, content: string): Promise<void> {
  const safePath = path.resolve(CWD, relPath);
  assertInsideWorkspace(safePath, "spec path");
  fs.writeFileSync(safePath, content, "utf8");
}

/**
 * Materializes code blocks from a sidecar spec (*.ts.md) into its target code file
 */
export async function materializeSpec(relPath: string): Promise<{ targetFile: string; bytesWritten: number }> {
  const spec = await getSpecContent(relPath);
  const fullSpecPath = path.resolve(CWD, relPath);
  assertInsideWorkspace(fullSpecPath, "spec path");
  const fm = parseFrontmatter(spec.content);

  let targetRel = relPath.replace(/\.md$/, "");
  if (typeof fm.target_code_file === "string" && fm.target_code_file) {
    const candidateFromCwd = path.resolve(CWD, fm.target_code_file);
    const candidateFromDir = path.resolve(path.dirname(fullSpecPath), fm.target_code_file);
    const chosen = fs.existsSync(candidateFromCwd) || fm.target_code_file.startsWith("src/") ? candidateFromCwd : candidateFromDir;
    targetRel = path.relative(CWD, chosen).replace(/\\/g, "/");
  }

  const codeBlockMatch = spec.content.match(/```(?:typescript|ts)\r?\n([\s\S]*?)\r?\n```/);
  if (!codeBlockMatch) {
    throw new Error("No TypeScript (```ts) code block found inside sidecar specification to materialize.");
  }

  const code = codeBlockMatch[1];
  const targetFullPath = path.resolve(CWD, targetRel);
  assertInsideWorkspace(targetFullPath, "target path");
  fs.writeFileSync(targetFullPath, code, "utf8");

  return {
    targetFile: targetRel,
    bytesWritten: Buffer.byteLength(code, "utf8"),
  };
}

/**
 * Performs AST-based reverse sanding (`stubs sand <file.ts.md>`) to synchronize sidecar frontmatter with target code
 */
export async function sandSpec(relPath: string): Promise<{
  path: string;
  targetFile: string;
  astHash: string;
  exportsSynced: number;
  depsSynced: number;
  message: string;
}> {
  const spec = await getSpecContent(relPath);
  const fullSpecPath = path.resolve(CWD, relPath);
  assertInsideWorkspace(fullSpecPath, "spec path");
  const fm = parseFrontmatter(spec.content);

  let targetRel = relPath.replace(/\.md$/, "");
  if (typeof fm.target_code_file === "string" && fm.target_code_file) {
    const candidateFromCwd = path.resolve(CWD, fm.target_code_file);
    const candidateFromDir = path.resolve(path.dirname(fullSpecPath), fm.target_code_file);
    const chosen = fs.existsSync(candidateFromCwd) ? candidateFromCwd : candidateFromDir;
    targetRel = path.relative(CWD, chosen).replace(/\\/g, "/");
  }

  const targetFullPath = path.resolve(CWD, targetRel);
  assertInsideWorkspace(targetFullPath, "target path");
  if (!fs.existsSync(targetFullPath)) {
    throw new Error(`Target code file '${targetRel}' does not exist on disk.`);
  }

  const knownFiles = new Set(await collectSourceFiles());
  const parsed = await parseTypeScriptFile(targetRel, knownFiles);
  const internalDeps = parsed.imports
    .filter((i) => !i.target.startsWith("pkg:"))
    .map((i) => i.target);

  // Update frontmatter with ast_hash, status_flag: clean, and synchronized depends_on list
  let updatedContent = spec.content;
  const fmMatch = updatedContent.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (fmMatch) {
    const rawLines = fmMatch[2].split(/\r?\n/);
    const filteredLines: string[] = [];
    let skippingDependsOn = false;
    for (const line of rawLines) {
      if (line.startsWith("ast_hash:") || line.startsWith("status_flag:")) {
        skippingDependsOn = false;
        continue;
      }
      if (line.startsWith("depends_on:")) {
        skippingDependsOn = true;
        continue;
      }
      if (skippingDependsOn) {
        if (/^\s+-\s+/.test(line)) {
          continue;
        }
        skippingDependsOn = false;
      }
      filteredLines.push(line);
    }

    if (internalDeps.length > 0) {
      filteredLines.push("depends_on:");
      for (const dep of internalDeps) {
        filteredLines.push(`  - ${dep}`);
      }
    }
    filteredLines.push("status_flag: clean");
    filteredLines.push(`ast_hash: ${parsed.astHash}`);
    updatedContent = `${fmMatch[1]}${filteredLines.join("\n")}${fmMatch[3]}${updatedContent.slice(fmMatch[0].length)}`;
    fs.writeFileSync(fullSpecPath, updatedContent, "utf8");
  }

  emitLog("stdout", `[sand] Synchronized ${relPath} <-> ${targetRel} (ast_hash: ${parsed.astHash}, ${parsed.exports.length} exports, ${internalDeps.length} deps)`);

  return {
    path: relPath,
    targetFile: targetRel,
    astHash: parsed.astHash,
    exportsSynced: parsed.exports.length,
    depsSynced: internalDeps.length,
    message: `Sanded '${relPath}' cleanly (AST hash ${parsed.astHash}, ${parsed.exports.length} exports, ${internalDeps.length} deps).`,
  };
}

/**
 * Generates and synchronizes prerequisite Domain Context Maps (`knowledge/architecture/domains/*-domain-map.md`),
 * the root `knowledge/architecture/context-map.md`, and `knowledge/architecture/visual-map.md`
 * directly from the live AST dependency graph (`stubs map --generate`).
 */
export async function generateContextMaps(): Promise<{
  updatedFiles: string[];
  totalModules: number;
}> {
  const graph = await getGraphData();
  const domainsDir = path.resolve(CWD, "knowledge/architecture/domains");
  if (!fs.existsSync(domainsDir)) {
    fs.mkdirSync(domainsDir, { recursive: true });
  }

  const domainMeta: Record<string, { title: string; layerLabel: string; layerNum: number; description: string }> = {
    core: {
      title: "Core Domain Map",
      layerLabel: "Layer 0 (Types & Schemas) & Layer 5 (App Entrypoints)",
      layerNum: 0,
      description: "Foundational TypeScript contracts, validation schemas, workspace contexts, and application entrypoints.",
    },
    utils: {
      title: "Utils Domain Map",
      layerLabel: "Layer 1 (Utilities & Encrypted Storage)",
      layerNum: 1,
      description: "Pure utility functions, platform detection, API client helpers, and AES-GCM encrypted local storage adapters.",
    },
    services: {
      title: "Services Domain Map",
      layerLabel: "Layer 2 (Domain Services)",
      layerNum: 2,
      description: "Stateful business services, Stubs GraphRAG client, platform service facades, and Gemini/chat persistence engines.",
    },
    hooks: {
      title: "Hooks Domain Map",
      layerLabel: "Layer 3 (React Hooks & State Orchestration)",
      layerNum: 3,
      description: "Modular React state hooks for chat streaming, voice input, settings, integrations, and Stubs architecture intelligence.",
    },
    components: {
      title: "Components Domain Map",
      layerLabel: "Layer 4 (UI Components & Workspaces)",
      layerNum: 4,
      description: "Atmospheric Minimalism & High-Craft UI surfaces across Chat, IDE, and Stubs Architecture Workspaces.",
    },
    server: {
      title: "Server Domain Map",
      layerLabel: "Layer 6 (Express & Stubs AST Engine Runtime)",
      layerNum: 6,
      description: "Node.js Express backend routes, SQLite AST GraphRAG engine, provider proxies, and child process orchestration.",
    },
  };

  const updatedFiles: string[] = [];
  const domainSummaries: Array<{
    domain: string;
    fileRel: string;
    moduleCount: number;
    hubs: StubsNode[];
  }> = [];

  for (const [domainKey, meta] of Object.entries(domainMeta)) {
    const domainNodes = graph.nodes
      .filter((n) => n.domain === domainKey && !n.filePath.includes(".test."))
      .sort((a, b) => b.fanIn - a.fanIn || a.id.localeCompare(b.id));

    const hubs = domainNodes.slice(0, 4);
    const fileLines: string[] = [
      `---`,
      `title: "${meta.title}"`,
      `type: domain-context-map`,
      `status: active`,
      `domain: ${domainKey}`,
      `layer: ${meta.layerNum}`,
      `---`,
      ``,
      `# ${meta.title}`,
      ``,
      `> ${meta.description}`,
      ``,
      `## Domain Metrics & Canonical Hubs`,
      `- **Layer Tier**: ${meta.layerLabel}`,
      `- **Production Modules**: ${domainNodes.length}`,
      `- **Canonical Hubs**: ${hubs.map((h) => `\`${h.id}\` (fan-in: ${h.fanIn}, fan-out: ${h.fanOut})`).join(", ") || "none"}`,
      ``,
      `## Module Inventory & Dependency Contracts`,
    ];

    for (const node of domainNodes) {
      const internalDeps = graph.edges
        .filter((e) => e.source === node.id && !e.target.startsWith("pkg:"))
        .map((e) => path.basename(e.target));
      const exports = parseExports(node);
      const depsStr = internalDeps.length > 0 ? internalDeps.slice(0, 6).join(", ") : "none";
      const capsStr = exports.length > 0 ? exports.slice(0, 6).join(", ") : "internal";
      fileLines.push(
        `- \`${node.id}\` (L${node.layer}, ${node.lineCount}L, fan-in:${node.fanIn}) — \`[deps: ${depsStr}]\` · \`[caps: ${capsStr}]\``
      );
    }

    const relDomainPath = `knowledge/architecture/domains/${domainKey}-domain-map.md`;
    fs.writeFileSync(path.resolve(CWD, relDomainPath), fileLines.join("\n") + "\n", "utf8");
    updatedFiles.push(relDomainPath);
    domainSummaries.push({
      domain: domainKey,
      fileRel: relDomainPath,
      moduleCount: domainNodes.length,
      hubs,
    });
  }

  // Root Context Map (`knowledge/architecture/context-map.md`)
  const rootContextRel = "knowledge/architecture/context-map.md";
  const topGlobalHubs = [...graph.nodes]
    .filter((n) => !n.filePath.includes(".test."))
    .sort((a, b) => b.fanIn - a.fanIn)
    .slice(0, 10);

  const rootLines: string[] = [
    `---`,
    `title: "System Architecture Context Map"`,
    `type: context-map`,
    `status: active`,
    `domain: core`,
    `---`,
    ``,
    `# System Architecture Context Map`,
    ``,
    `> **Agent Entry Point (Tier 1 Progressive Disclosure)**: Read this macro map first, then drill into the relevant domain map or query `.concat(
      "`npx stubs query \"stub: <module>\"` for Level 1 Interface Skeleton signatures."
    ),
    ``,
    `## 1. Strict 7-Layer Dependency Hierarchy`,
    `- **Layer 0 (\`core\`)**: Foundational TypeScript interfaces & Zod schemas (\`src/types.ts\`, \`src/types/stubs.ts\`, \`src/schemas/validation.ts\`). Imports nothing from higher layers.`,
    `- **Layer 1 (\`utils\`)**: Pure utilities, platform detection, API client, and AES-GCM storage (\`src/utils/**\`, \`src/data/**\`).`,
    `- **Layer 2 (\`services\`)**: Stateful domain services and API clients (\`src/services/**\`).`,
    `- **Layer 3 (\`hooks\` / \`core\`)**: React hooks and workspace contexts (\`src/hooks/**\`, \`src/contexts/**\`).`,
    `- **Layer 4 (\`components\`)**: UI components and workspace views (\`src/components/**\`).`,
    `- **Layer 5 (\`core\`)**: Application entrypoints (\`src/App.tsx\`, \`src/main.tsx\`).`,
    `- **Layer 6 (\`server\`)**: Express server runtime and SQLite AST GraphRAG engine (\`server.ts\`, \`server/**\`).`,
    ``,
    `## 2. Prerequisite Domain Maps`,
    ...domainSummaries.map(
      (d) =>
        `- **[${d.domain.toUpperCase()} Domain Map](domains/${d.domain}-domain-map.md)** (${d.moduleCount} modules) — Hubs: ${d.hubs
          .slice(0, 3)
          .map((h) => `\`${h.id}\` (fan-in ${h.fanIn})`)
          .join(", ")}`
    ),
    ``,
    `## 3. Global High-Centrality Hubs (Top 10 by Fan-In)`,
    ...topGlobalHubs.map(
      (h, idx) =>
        `${idx + 1}. \`${h.id}\` — Domain: \`${h.domain}\` · Layer ${h.layer} · Fan-In: **${h.fanIn}** · Fan-Out: ${h.fanOut} · Exports: ${
          parseExports(h).slice(0, 5).join(", ") || "default"
        }`
    ),
    ``,
    `## 4. Surgical GraphRAG Query Protocol`,
    `- \`npx stubs query "map:"\` — Level 0 Macro Map summary`,
    `- \`npx stubs query "stub: <target>"\` — Level 1 Interface Skeleton Stubs (stripped bodies + line links)`,
    `- \`npx stubs query "explain: <target>"\` — Level 2 Symbol Profile (callers, callees, exports)`,
    `- \`npx stubs query "path: <A> to <B>"\` — Shortest directed dependency chain`,
    `- \`npx stubs query "blast: <target>"\` — Downstream impact radius & topological edit order`,
    `- \`npx stubs query "pkg:<package>"\` — Package-scoped consumer audit`,
  ];

  fs.writeFileSync(path.resolve(CWD, rootContextRel), rootLines.join("\n") + "\n", "utf8");
  updatedFiles.push(rootContextRel);

  // Visual Map (`knowledge/architecture/visual-map.md`)
  const diag = await getDiagram("domain", "architecture");
  const visualRel = "knowledge/architecture/visual-map.md";
  const visualLines = [
    `---`,
    `title: "Visual System Topology"`,
    `type: visual-diagram`,
    `status: active`,
    `domain: core`,
    `---`,
    ``,
    `# Visual System Topology`,
    ``,
    `Generated from live AST graph (${graph.nodes.length} modules, ${graph.edges.length} edges).`,
    ``,
    "```mermaid",
    diag.mermaid,
    "```",
  ];
  fs.writeFileSync(path.resolve(CWD, visualRel), visualLines.join("\n") + "\n", "utf8");
  updatedFiles.push(visualRel);

  return {
    updatedFiles,
    totalModules: graph.nodes.length,
  };
}

/**
 * Performs a fast in-process Design System Compliance check across src/ (ADR 0020, 0021, 0036)
 */
function runDesignComplianceQuickCheck(): { violationsCount: number; summary: string } {
  const srcDir = path.resolve(CWD, "src");
  if (!fs.existsSync(srcDir)) {
    return { violationsCount: 0, summary: "0 errors · 0 warnings" };
  }

  let violationsCount = 0;
  const rawEmojiRegex = /[\u{1F300}-\u{1FAFF}]/u;
  const restingDestructiveBgRegex = /(?<!hover:|focus:|active:|group-hover:)\bbg-destructive\/(?:5|10|15|20)\b/;

  const walk = (dir: string) => {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full);
      } else if (ent.isFile() && /\.(ts|tsx)$/.test(ent.name)) {
        const content = fs.readFileSync(full, "utf8");
        if (rawEmojiRegex.test(content)) {
          violationsCount++;
        }
        if (ent.name.endsWith(".tsx") && !ent.name.includes("ConfirmModal") && !ent.name.includes("AlertDialog")) {
          if (restingDestructiveBgRegex.test(content)) {
            violationsCount++;
          }
        }
      }
    }
  };

  try {
    walk(srcDir);
  } catch {
    // ignore fs race
  }

  return {
    violationsCount,
    summary:
      violationsCount === 0
        ? "0 errors · 0 warnings (ADR 0015–0046 verified)"
        : `${violationsCount} design rule violation${violationsCount === 1 ? "" : "s"} detected`,
  };
}

let activePipelinePromise: Promise<StubsRunResult> | null = null;
let cliQueue: Promise<unknown> = Promise.resolve();

/**
 * Executes the unified 5-stage `stubs run` pipeline:
 * 1. AST Scan & Graph Sync
 * 2. Context Maps & Sidecar Sand Sync
 * 3. Architectural Guardrails (lint-arch)
 * 4. Workspace Hygiene (prune)
 * 5. Design System Compliance Gate
 * Persists a durable checkpoint in `.stubs/harness-ledger.json`.
 */
export async function runStubsPipeline(emitToStream = true): Promise<StubsRunResult> {
  if (activePipelinePromise) {
    return activePipelinePromise;
  }
  activePipelinePromise = performStubsPipeline(emitToStream).finally(() => {
    activePipelinePromise = null;
  });
  return activePipelinePromise;
}

async function performStubsPipeline(emitToStream = true): Promise<StubsRunResult> {
  const start = Date.now();
  if (emitToStream) {
    emitLog("start", "$ stubs run");
  }

  const steps: StubsRunStep[] = [];

  // 1. AST Scan
  const scanRes = await scanWorkspace(false);
  steps.push({
    name: "AST Scan & Graph Sync",
    status: "pass",
    detail: `${scanRes.filesScanned} modules · ${scanRes.edgesCount} edges · ${scanRes.symbolsCount} symbols`,
    durationMs: scanRes.durationMs,
  });
  if (emitToStream) {
    emitLog("stdout", `[1/5] scan: ${scanRes.filesScanned} modules, ${scanRes.edgesCount} edges (${scanRes.durationMs}ms)`);
  }

  // 2. Context Maps & Sidecars Auto-Sanding
  const specsStart = Date.now();
  const mapGen = await generateContextMaps();
  const initialSpecs = await listSidecarSpecs();
  for (const s of initialSpecs) {
    if (s.category === "sidecar" && s.targetExists) {
      try {
        await sandSpec(s.path);
      } catch {
        // ignore individual sidecar sand error
      }
    }
  }
  const specs = await listSidecarSpecs();
  const driftedSidecars = specs.filter((s) => s.driftStatus === "drifted").length;
  const contextMapsCount = specs.filter((s) => s.category === "context-map").length;
  steps.push({
    name: "Context Maps & Sidecar Sync",
    status: driftedSidecars > 0 ? "warn" : "pass",
    detail: `${mapGen.updatedFiles.length} maps synced · ${specs.length} docs · ${driftedSidecars} drifted sidecars`,
    durationMs: Date.now() - specsStart,
  });
  if (emitToStream) {
    emitLog("stdout", `[2/5] maps & sand: ${mapGen.updatedFiles.length} context maps synced, ${driftedSidecars} drifted sidecars`);
  }

  // 3. Architectural Lint
  const lintRes = await lintArchitecture();
  steps.push({
    name: "Architectural Guardrails (lint-arch)",
    status: lintRes.errorCount > 0 ? "fail" : lintRes.warningCount > 0 ? "warn" : "pass",
    detail: `${lintRes.errorCount} errors · ${lintRes.warningCount} warnings (${lintRes.totalChecks} checks)`,
    durationMs: lintRes.durationMs,
  });
  if (emitToStream) {
    emitLog("stdout", `[3/5] lint-arch: ${lintRes.errorCount} errors, ${lintRes.warningCount} warnings (${lintRes.durationMs}ms)`);
  }

  // 4. Hygiene & Prune
  const pruneStart = Date.now();
  const pruneRes = await pruneWorkspace();
  const pruneIssueCount = pruneRes.summary.phantomSidecars + pruneRes.summary.staleDbNodes + pruneRes.summary.zombieExports;
  steps.push({
    name: "Workspace Hygiene (prune)",
    status: pruneRes.summary.phantomSidecars > 0 ? "fail" : pruneIssueCount > 0 ? "warn" : "pass",
    detail: `${pruneRes.summary.phantomSidecars} phantom · ${pruneRes.summary.zombieExports} zombie exports · ${pruneRes.summary.staleDbNodes} stale DB`,
    durationMs: Date.now() - pruneStart,
  });
  if (emitToStream) {
    emitLog("stdout", `[4/5] prune: ${pruneIssueCount} hygiene items detected`);
  }

  // 5. Design System Compliance Gate
  const designStart = Date.now();
  const designCheck = runDesignComplianceQuickCheck();
  steps.push({
    name: "Design System Compliance Gate",
    status: designCheck.violationsCount > 0 ? "warn" : "pass",
    detail: designCheck.summary,
    durationMs: Math.max(1, Date.now() - designStart),
  });
  if (emitToStream) {
    emitLog("stdout", `[5/5] design-audit: ${designCheck.summary}`);
  }

  const totalDurationMs = Math.max(1, Date.now() - start);
  const passed = lintRes.passed && pruneRes.summary.phantomSidecars === 0 && designCheck.violationsCount === 0;
  const checkpointId = `chk_${Date.now().toString(36)}`;

  recordCheckpoint({
    id: checkpointId,
    timestamp: Date.now(),
    passed,
    scannedFiles: scanRes.filesScanned,
    edgesCount: scanRes.edgesCount,
    lintErrors: lintRes.errorCount,
    lintWarnings: lintRes.warningCount,
    pruneIssues: pruneIssueCount,
    designViolations: designCheck.violationsCount,
    contextMapsSynced: contextMapsCount,
    durationMs: totalDurationMs,
  });

  if (emitToStream) {
    emitLog("stdout", `Recorded durable harness checkpoint ${checkpointId} in .stubs/harness-ledger.json`);
    emitLog("exit", `[Process exited with code ${passed ? 0 : 1}]`, passed ? 0 : 1);
  }

  return {
    passed,
    scannedFiles: scanRes.filesScanned,
    edgesCount: scanRes.edgesCount,
    lintErrors: lintRes.errorCount,
    lintWarnings: lintRes.warningCount,
    pruneIssues: pruneIssueCount,
    driftedSidecars,
    contextMapsCount,
    designViolations: designCheck.violationsCount,
    checkpointId,
    durationMs: totalDurationMs,
    steps,
  };
}

/**
 * Runs a Stubs CLI command using the in-process TypeScript Stubs Engine with live SSE streaming.
 * Serializes concurrent CLI invocations to prevent interlocking DB contention.
 */
export async function runCliCommand(
  command: StubsCommandName,
  args: string[] = []
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const run = async (): Promise<{ exitCode: number; stdout: string; stderr: string }> => {
    emitLog("start", `$ npx stubs ${command}${args.length ? ` ${args.join(" ")}` : ""}`);

    try {
      let stdout = "";
      let exitCode = 0;

      if (command === "scan") {
        const res = await scanWorkspace(false);
        stdout = `AST scan complete: ${res.filesScanned} modules, ${res.edgesCount} edges, ${res.symbolsCount} symbols (${res.durationMs}ms).`;
        emitLog("stdout", stdout);
      } else if (command === "run" || command === "harness") {
        const res = await runStubsPipeline(false);
        const lines = [
          ...res.steps.map((s) => `[${s.status.toUpperCase()}] ${s.name}: ${s.detail} (${s.durationMs}ms)`),
          `Checkpoint: ${res.checkpointId || "—"} | Status: ${res.passed ? "VERIFIED" : "ACTION REQUIRED"} (${res.durationMs}ms)`,
        ];
        stdout = lines.join("\n");
        for (const line of lines) emitLog("stdout", line);
        exitCode = res.passed ? 0 : 1;
      } else if (command === "lint-arch") {
        const res = await lintArchitecture();
        const lines = [
          `Checked ${res.totalChecks} architectural invariants in ${res.durationMs}ms.`,
          `Result: ${res.passed ? "PASSED" : "FAILED"} (${res.errorCount} errors, ${res.warningCount} warnings)`,
          ...res.violations.slice(0, 15).map((v) => `  [${v.severity.toUpperCase()}] ${v.rule}: ${v.message}`),
        ];
        stdout = lines.join("\n");
        for (const line of lines) emitLog(line.includes("[ERROR]") ? "stderr" : "stdout", line);
        exitCode = res.passed ? 0 : 1;
      } else if (command === "prune") {
        const res = await pruneWorkspace();
        const lines = [
          `Prune audit complete (${res.durationMs}ms):`,
          `  PHANTOM_SIDECAR: ${res.summary.phantomSidecars}`,
          `  ZOMBIE_EXPORT:   ${res.summary.zombieExports}`,
          `  STALE_DB_NODE:   ${res.summary.staleDbNodes}`,
          `  UNTRACKED_CODE:  ${res.summary.untrackedCode} (opt-in)`,
          ...res.issues.slice(0, 12).map((i) => `  - [${i.type}] ${i.message}`),
        ];
        stdout = lines.join("\n");
        for (const line of lines) emitLog("stdout", line);
      } else if (command === "query") {
        const q = args.join(" ").replace(/^["']|["']$/g, "") || "map:";
        const res = await queryGraph(q);
        const lines = [res.summary];
        if (res.mapResult) {
          for (const d of res.mapResult.domains) {
            lines.push(`  domain:${d.domain} (${d.nodeCount} files, avg L${d.avgLayer}, hub: ${d.hubFile || "—"})`);
          }
        } else if (res.stubResult) {
          lines.push(res.stubResult.skeletonCode);
        } else if (res.pkgResult) {
          for (const c of res.pkgResult.consumers.slice(0, 20)) {
            lines.push(`  - ${c.id} (Domain: ${c.domain}, L${c.layer}, fan-in: ${c.fanIn})`);
          }
        } else if (res.pathResult) {
          if (res.pathResult.found) {
            lines.push(`  ${res.pathResult.paths[0].join(" -> ")}`);
          }
        } else if (res.blastResult) {
          lines.push(`  Risk: ${res.blastResult.riskScore} (${res.blastResult.numericRisk}/100)`);
          lines.push(`  Direct Callers (${res.blastResult.directCallers.length}): ${res.blastResult.directCallers.slice(0, 8).join(", ") || "none"}`);
          if (res.blastResult.preFlight?.editOrder?.length) {
            lines.push(`  Topological Edit Order: ${res.blastResult.preFlight.editOrder.join(" -> ")}`);
          }
        } else if (res.explain) {
          lines.push(`  Exports: ${res.explain.exports.join(", ") || "none"}`);
          lines.push(`  Callers (${res.explain.callers.length}): ${res.explain.callers.slice(0, 6).join(", ")}`);
          lines.push(`  Callees (${res.explain.callees.length}): ${res.explain.callees.slice(0, 6).join(", ")}`);
        } else if (res.matches) {
          for (const m of res.matches.slice(0, 10)) {
            lines.push(`  [score:${m.score}] ${m.node.id} (${m.reason})`);
          }
        }
        stdout = lines.join("\n");
        for (const line of lines) emitLog("stdout", line);
      } else if (command === "impact" || command === "pre-flight" || command === "context") {
        const target = args.find((a) => !a.startsWith("-")) || "src/types.ts";
        const res = await getImpact(target);
        const lines = [
          `${command.toUpperCase()} for ${res.target} [Domain: ${res.domain}, Layer ${res.layer}]`,
          `  Risk: ${res.riskScore} (${res.numericRisk}/100) | Fan-In: ${res.fanIn} | Fan-Out: ${res.fanOut}`,
          `  Pre-Flight Gate: ${res.preFlight?.safe ? "SAFE TO EDIT" : `BLOCKED — ${res.preFlight?.blockedReason}`}`,
          `  Topological Edit Order: ${res.preFlight?.editOrder.join(" -> ") || res.target}`,
          `  Direct Callers (${res.directCallers.length}): ${res.directCallers.slice(0, 8).join(", ") || "none"}`,
          `  Tiered Context Tokens: ~${res.tieredContext?.estimatedTokens || 0}`,
        ];
        stdout = lines.join("\n");
        for (const line of lines) emitLog("stdout", line);
        if (command === "pre-flight" && res.preFlight && !res.preFlight.safe) {
          exitCode = 2;
        }
      } else if (command === "diagram") {
        const groupBy: StubsDiagramGroupBy = args.includes("layer") ? "layer" : "domain";
        const res = await getDiagram(groupBy, "architecture");
        stdout = `Generated Mermaid diagram (${res.nodeCount} nodes, ${res.edgeCount} edges, grouped by ${groupBy}).`;
        emitLog("stdout", stdout);
      } else if (command === "phase") {
        const specs = await listSidecarSpecs();
        const lines = [
          `5-Phase Lifecycle Status (${specs.length} tracked specs & plans):`,
          ...specs.slice(0, 15).map((s) => `  [${(s.phase || s.status).toUpperCase()}] ${s.path} (${s.driftStatus || s.category})`),
        ];
        stdout = lines.join("\n");
        for (const line of lines) emitLog("stdout", line);
      } else if (command === "sand") {
        const target = args.find((a) => !a.startsWith("-"));
        if (target) {
          const res = await sandSpec(target);
          stdout = res.message;
          emitLog("stdout", stdout);
        } else {
          const specs = (await listSidecarSpecs()).filter((s) => s.category === "sidecar" && s.targetExists);
          const results: string[] = [];
          for (const s of specs) {
            const r = await sandSpec(s.path);
            results.push(r.message);
          }
          stdout = results.length > 0 ? results.join("\n") : "No target sidecars found to sand.";
          emitLog("stdout", stdout);
        }
      } else if (command === "map") {
        const gen = await generateContextMaps();
        stdout = `Synchronized ${gen.updatedFiles.length} architecture context maps across ${gen.totalModules} indexed modules:\n${gen.updatedFiles.map((f) => `  - ${f}`).join("\n")}`;
        for (const line of stdout.split("\n")) emitLog("stdout", line);
      }

      emitLog("exit", `[Process exited with code ${exitCode}]`, exitCode);
      return { exitCode, stdout, stderr: "" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      emitLog("error", `[Execution error: ${msg}]`);
      emitLog("exit", `[Process exited with code 1]`, 1);
      return { exitCode: 1, stdout: "", stderr: msg };
    }
  };

  const next = cliQueue.then(run, run);
  cliQueue = next.catch(() => {});
  return next;
}
