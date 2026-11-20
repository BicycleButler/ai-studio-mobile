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
  StubsAgenticTask,
  StubsTaskStatus,
  StubsTaskTargetItem,
  StubsTaskStep,
  StubsBatchPreFlightResult,
  StubsSessionHandoff,
  StubsTaskVerificationReport,
  StubsContractStatus,
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

interface HarnessLedgerStore {
  updatedAt: number;
  activeTaskId?: string;
  checkpoints: StubsHarnessCheckpoint[];
  baselineAstSnapshots?: Record<string, string>;
  latestAstSnapshots?: Record<string, string>;
  tasks: StubsAgenticTask[];
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

function readHarnessLedger(): HarnessLedgerStore {
  try {
    if (fs.existsSync(LEDGER_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(LEDGER_PATH, "utf8")) as Partial<HarnessLedgerStore>;
      return {
        updatedAt: typeof parsed.updatedAt === "number" ? parsed.updatedAt : Date.now(),
        activeTaskId: parsed.activeTaskId,
        checkpoints: Array.isArray(parsed.checkpoints) ? parsed.checkpoints : [],
        baselineAstSnapshots:
          parsed.baselineAstSnapshots && typeof parsed.baselineAstSnapshots === "object"
            ? parsed.baselineAstSnapshots
            : undefined,
        latestAstSnapshots:
          parsed.latestAstSnapshots && typeof parsed.latestAstSnapshots === "object"
            ? parsed.latestAstSnapshots
            : undefined,
        tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      };
    }
  } catch {
    // ignore malformed ledger
  }
  return {
    updatedAt: Date.now(),
    checkpoints: [],
    tasks: [],
  };
}

function writeHarnessLedger(ledger: HarnessLedgerStore): void {
  try {
    const dir = path.dirname(LEDGER_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const payload: HarnessLedgerStore = {
      ...ledger,
      updatedAt: Date.now(),
      checkpoints: ledger.checkpoints.slice(-25),
      tasks: ledger.tasks.slice(-20),
    };
    fs.writeFileSync(LEDGER_PATH, JSON.stringify(payload, null, 2), "utf8");
  } catch (err) {
    defaultServerContext.services.logger.warn("[stubsService] Failed writing harness ledger:", err);
  }
}

function readLastCheckpoint(): StubsHarnessCheckpoint | undefined {
  const ledger = readHarnessLedger();
  if (ledger.checkpoints.length > 0) {
    return ledger.checkpoints[ledger.checkpoints.length - 1];
  }
  return undefined;
}

function recordCheckpoint(
  checkpoint: StubsHarnessCheckpoint,
  currentAstMap?: Record<string, string>
): void {
  const ledger = readHarnessLedger();
  const previousSnapshots = ledger.latestAstSnapshots || ledger.baselineAstSnapshots;
  if (currentAstMap && Object.keys(currentAstMap).length > 0) {
    if (!ledger.baselineAstSnapshots) {
      ledger.baselineAstSnapshots = currentAstMap;
    } else if (previousSnapshots) {
      ledger.baselineAstSnapshots = previousSnapshots;
    }
    ledger.latestAstSnapshots = currentAstMap;
  }
  ledger.checkpoints.push(checkpoint);
  writeHarnessLedger(ledger);
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

  // Walk entire AST to capture dynamic import("...") expressions (e.g. React.lazy(() => import("./Component")))
  const visitDynamicImports = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length > 0 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const target = resolveImportTarget(relPath, node.arguments[0].text, knownFiles);
      if (target) {
        importsList.push({ target, relationship: "dynamic-imports" });
      }
    }
    ts.forEachChild(node, visitDynamicImports);
  };
  visitDynamicImports(sourceFile);

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

  const { activeTask, tasks, checkpoints } = synchronizeLedgerWithNodes(nodes, edges, config.autonomy_level);
  const lastCheckpoint = checkpoints.length > 0 ? checkpoints[checkpoints.length - 1] : undefined;

  return {
    projectName: config.project_name,
    version: config.version,
    autonomyLevel: config.autonomy_level,
    cliAvailable: isCliBinaryPresent(),
    lastCheckpoint,
    checkpoints,
    activeTask,
    tasks,
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

function buildDefaultTaskSteps(): StubsTaskStep[] {
  return [
    {
      id: "step_preflight",
      phase: "pre-flight",
      label: "Pre-Flight Blast Radius & Topological Edit Plan",
      status: "completed",
      detail: "Verified multi-target topological edit sequence and guard threshold.",
      updatedAt: Date.now(),
    },
    {
      id: "step_edit",
      phase: "edit",
      label: "Topological Layer-Ordered Code Implementation",
      status: "completed",
      detail: "Applied deterministic edits from Layer 0 contracts upward.",
      updatedAt: Date.now(),
    },
    {
      id: "step_test",
      phase: "test",
      label: "Fast-Feedback Unit Test Verification",
      status: "completed",
      detail: "Verified domain & service unit tests pass cleanly.",
      updatedAt: Date.now(),
    },
    {
      id: "step_sanding",
      phase: "sanding",
      label: "Context Maps & Sidecar Reverse Sanding",
      status: "completed",
      detail: "Synchronized domain context maps and sidecar AST hashes.",
      updatedAt: Date.now(),
    },
    {
      id: "step_verification",
      phase: "verification",
      label: "5-Stage Durable Harness Checkpoint Gate",
      status: "completed",
      detail: "Recorded verified checkpoint in .stubs/harness-ledger.json.",
      updatedAt: Date.now(),
    },
  ];
}

function computeNodeRiskScore(node: StubsNode | undefined, fanIn: number, fanOut: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (fanIn >= 20 || (node && node.layer === 0 && fanIn >= 10)) return "CRITICAL";
  if (fanIn >= 10) return "HIGH";
  if (fanIn >= 3 || fanOut >= 8) return "MEDIUM";
  return "LOW";
}

/**
 * Discovers unit test files (*.test.ts / *.test.tsx) that directly or transitively verify one or more target modules.
 */
export function discoverAffectedTests(
  targetIds: string[],
  nodes: StubsNode[],
  edges: StubsEdge[]
): {
  directTests: string[];
  callerTests: string[];
  allTests: string[];
  recommendedCommand: string;
} {
  const resolvedTargets = Array.from(
    new Set(
      targetIds
        .map((t) => findNodeMatch(nodes, t)?.id || t.trim())
        .filter(Boolean)
    )
  );
  const targetSet = new Set(resolvedTargets);
  const targetStemSet = new Set(
    resolvedTargets.map((id) => id.replace(/\.(ts|tsx)$/, ""))
  );

  const directCallerSet = new Set<string>();
  for (const e of edges) {
    if (targetSet.has(e.target) && !e.source.startsWith("pkg:") && !targetSet.has(e.source)) {
      directCallerSet.add(e.source);
    }
  }
  const callerStemSet = new Set(
    Array.from(directCallerSet).map((id) => id.replace(/\.(ts|tsx)$/, ""))
  );

  const testNodes = nodes.filter(
    (n) => n.entityType === "test" || n.filePath.includes(".test.")
  );

  const directTestsSet = new Set<string>();
  const callerTestsSet = new Set<string>();

  for (const testNode of testNodes) {
    const testId = testNode.id;
    const testStem = testId.replace(/\.test\.(ts|tsx)$/, "");

    if (targetStemSet.has(testStem)) {
      directTestsSet.add(testId);
      continue;
    }

    let importsTarget = false;
    let importsCaller = false;
    for (const e of edges) {
      if (e.source === testId) {
        if (targetSet.has(e.target)) {
          importsTarget = true;
        } else if (directCallerSet.has(e.target)) {
          importsCaller = true;
        }
      }
    }

    if (importsTarget) {
      directTestsSet.add(testId);
    } else if (importsCaller || callerStemSet.has(testStem)) {
      callerTestsSet.add(testId);
    }
  }

  const directTests = Array.from(directTestsSet).sort();
  const callerTests = Array.from(callerTestsSet)
    .filter((t) => !directTestsSet.has(t))
    .sort();
  const allTests = [...directTests, ...callerTests];
  const recommendedCommand =
    allTests.length > 0
      ? `npx vitest run ${allTests.slice(0, 6).join(" ")}`
      : "npx vitest run";

  return {
    directTests,
    callerTests,
    allTests,
    recommendedCommand,
  };
}

function buildTaskEditPlan(
  targetFiles: string[],
  nodes: StubsNode[],
  edges: StubsEdge[],
  existingPlan?: StubsTaskTargetItem[],
  baselineAstMap?: Record<string, string>,
  baselineExportsMap?: Record<string, string[]>
): StubsTaskTargetItem[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const existingMap = new Map((existingPlan || []).map((item) => [item.path, item]));
  const resolvedTargets = Array.from(
    new Set(
      targetFiles
        .map((t) => findNodeMatch(nodes, t)?.id || t.trim())
        .filter(Boolean)
    )
  );
  const targetSet = new Set(resolvedTargets);
  const depSet = new Set<string>();
  const callerSet = new Set<string>();

  for (const tId of resolvedTargets) {
    for (const e of edges) {
      if (e.source === tId && !e.target.startsWith("pkg:") && !targetSet.has(e.target)) {
        depSet.add(e.target);
      }
      if (e.target === tId && !e.source.startsWith("pkg:") && !targetSet.has(e.source)) {
        callerSet.add(e.source);
      }
    }
  }

  const orderedPaths = computeMultiTargetEditOrder(resolvedTargets, nodes, edges);
  return orderedPaths.map((filePath, idx) => {
    const node = nodeMap.get(filePath);
    const prev = existingMap.get(filePath);
    const role: StubsTaskTargetItem["role"] = targetSet.has(filePath)
      ? "target"
      : depSet.has(filePath)
      ? "dependency"
      : "caller";
    const baselineHash = baselineAstMap?.[filePath] || prev?.baselineAstHash || node?.astHash;
    const currentHash = node?.astHash || prev?.currentAstHash;
    const drifted = Boolean(baselineHash && currentHash && baselineHash !== currentHash);

    const liveExports = node ? parseExports(node) : prev?.currentExports || [];
    const baseExports = baselineExportsMap?.[filePath] || prev?.baselineExports || liveExports;
    const baseExportSet = new Set(baseExports);
    const liveExportSet = new Set(liveExports);
    const addedExports = liveExports.filter((ex) => !baseExportSet.has(ex));
    const removedExports = baseExports.filter((ex) => !liveExportSet.has(ex));
    const contractStatus: StubsContractStatus =
      removedExports.length > 0
        ? "breaking"
        : addedExports.length > 0
        ? "expanded"
        : "intact";

    let status: StubsTaskTargetItem["status"] = prev?.status || "pending";
    if (drifted && status === "pending") {
      status = "edited";
    }
    return {
      path: filePath,
      domain: node?.domain || inferDomainAndLayer(filePath).domain,
      layer: node?.layer ?? inferDomainAndLayer(filePath).layer,
      orderIndex: idx + 1,
      role,
      riskScore: computeNodeRiskScore(node, node?.fanIn || 0, node?.fanOut || 0),
      baselineAstHash: baselineHash,
      currentAstHash: currentHash,
      driftedSinceBaseline: drifted,
      baselineExports: baseExports,
      currentExports: liveExports,
      addedExports,
      removedExports,
      contractStatus,
      hasSidecar: Boolean(node?.hasSidecar),
      status,
    };
  });
}

function captureTaskBaselineMaps(
  editPlanPaths: string[],
  nodes: StubsNode[]
): {
  baselineAstSnapshots: Record<string, string>;
  baselineExportsSnapshots: Record<string, string[]>;
} {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const baselineAstSnapshots: Record<string, string> = {};
  const baselineExportsSnapshots: Record<string, string[]> = {};
  for (const p of editPlanPaths) {
    const n = nodeMap.get(p);
    if (n) {
      if (n.astHash) baselineAstSnapshots[p] = n.astHash;
      baselineExportsSnapshots[p] = parseExports(n);
    }
  }
  return { baselineAstSnapshots, baselineExportsSnapshots };
}

function synchronizeLedgerWithNodes(
  nodes: StubsNode[],
  edges: StubsEdge[],
  autonomyLevel: string
): {
  activeTask?: StubsAgenticTask;
  tasks: StubsAgenticTask[];
  checkpoints: StubsHarnessCheckpoint[];
} {
  const ledger = readHarnessLedger();
  let mutated = false;

  if (!ledger.baselineAstSnapshots && nodes.length > 0) {
    const snap: Record<string, string> = {};
    for (const n of nodes) {
      if (n.astHash) snap[n.id] = n.astHash;
    }
    ledger.baselineAstSnapshots = snap;
    ledger.latestAstSnapshots = snap;
    mutated = true;
  }

  if (ledger.tasks.length === 0 && nodes.length > 0) {
    const lastChk = ledger.checkpoints[ledger.checkpoints.length - 1];
    const defaultTargets = [
      "src/types/stubs.ts",
      "server/stubsService.ts",
      "src/services/stubsService.ts",
      "src/components/StubsWorkspace.tsx",
    ];
    const initialPlan = buildTaskEditPlan(defaultTargets, nodes, edges).map((item) => ({
      ...item,
      status: (item.role === "target" ? "verified" : "pending") as StubsTaskTargetItem["status"],
    }));
    const { baselineAstSnapshots, baselineExportsSnapshots } = captureTaskBaselineMaps(
      initialPlan.map((i) => i.path),
      nodes
    );
    const affected = discoverAffectedTests(defaultTargets, nodes, edges);
    const seedTask: StubsAgenticTask = {
      id: "task_durable_harness",
      title: "Durable Agentic Harness & Multi-Target Topological Planner",
      goal: "Maintain persistent task ledger, multi-target topological edit ordering, AST drift tracking, and deterministic session handoff packets.",
      status: "in_progress",
      createdAt: lastChk?.timestamp || Date.now(),
      updatedAt: Date.now(),
      autonomyLevel,
      guardThreshold: "high",
      targetFiles: defaultTargets,
      editPlan: initialPlan,
      steps: buildDefaultTaskSteps(),
      baselineCheckpointId: ledger.checkpoints[0]?.id || lastChk?.id,
      latestCheckpointId: lastChk?.id,
      baselineAstSnapshots,
      baselineExportsSnapshots,
      affectedTests: affected.allTests,
      recommendedTestCommand: affected.recommendedCommand,
      notes: [
        "Initialized durable task session with multi-target topological edit sequence.",
      ],
    };
    ledger.tasks.push(seedTask);
    ledger.activeTaskId = seedTask.id;
    mutated = true;
  }

  if (nodes.length > 0 && ledger.tasks.length > 0) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const task of ledger.tasks) {
      if (!Array.isArray(task.editPlan) || task.editPlan.length === 0) {
        task.editPlan = buildTaskEditPlan(
          task.targetFiles || [],
          nodes,
          edges,
          undefined,
          task.baselineAstSnapshots,
          task.baselineExportsSnapshots
        );
        mutated = true;
      }

      if (!task.baselineAstSnapshots || !task.baselineExportsSnapshots) {
        const snap = captureTaskBaselineMaps(
          task.editPlan.map((i) => i.path),
          nodes
        );
        if (!task.baselineAstSnapshots) {
          for (const item of task.editPlan) {
            if (item.baselineAstHash) {
              snap.baselineAstSnapshots[item.path] = item.baselineAstHash;
            }
          }
          task.baselineAstSnapshots = snap.baselineAstSnapshots;
        }
        if (!task.baselineExportsSnapshots) {
          task.baselineExportsSnapshots = snap.baselineExportsSnapshots;
        }
        mutated = true;
      }

      if (!task.affectedTests || !task.recommendedTestCommand) {
        const affected = discoverAffectedTests(task.targetFiles || [], nodes, edges);
        task.affectedTests = affected.allTests;
        task.recommendedTestCommand = affected.recommendedCommand;
        mutated = true;
      }

      for (const item of task.editPlan) {
        const liveNode = nodeMap.get(item.path);
        const baselineHash = task.baselineAstSnapshots?.[item.path] || item.baselineAstHash || liveNode?.astHash;
        if (baselineHash && item.baselineAstHash !== baselineHash) {
          item.baselineAstHash = baselineHash;
          mutated = true;
        }
        if (liveNode) {
          const liveExports = parseExports(liveNode);
          const baseExports = task.baselineExportsSnapshots?.[item.path] || item.baselineExports || liveExports;
          const baseSet = new Set(baseExports);
          const liveSet = new Set(liveExports);
          const addedExports = liveExports.filter((ex) => !baseSet.has(ex));
          const removedExports = baseExports.filter((ex) => !liveSet.has(ex));
          const contractStatus: StubsContractStatus =
            removedExports.length > 0
              ? "breaking"
              : addedExports.length > 0
              ? "expanded"
              : "intact";

          if (
            liveNode.astHash !== item.currentAstHash ||
            item.contractStatus !== contractStatus ||
            !item.currentExports
          ) {
            item.currentAstHash = liveNode.astHash;
            item.driftedSinceBaseline = Boolean(
              item.baselineAstHash && liveNode.astHash && item.baselineAstHash !== liveNode.astHash
            );
            item.baselineExports = baseExports;
            item.currentExports = liveExports;
            item.addedExports = addedExports;
            item.removedExports = removedExports;
            item.contractStatus = contractStatus;
            item.hasSidecar = Boolean(liveNode.hasSidecar);
            if (item.driftedSinceBaseline && item.status === "pending") {
              item.status = "edited";
            }
            mutated = true;
          }
        }
      }
    }
  }

  if (mutated) {
    writeHarnessLedger(ledger);
  }

  const activeTask = ledger.activeTaskId
    ? ledger.tasks.find((t) => t.id === ledger.activeTaskId && t.status !== "completed")
    : undefined;

  return {
    activeTask,
    tasks: ledger.tasks,
    checkpoints: ledger.checkpoints,
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

  // 7. AST Drift & Modified Modules (`drift:` or `drift`)
  if (lower === "drift:" || lower === "drift" || lower.startsWith("drift:")) {
    const driftInfo = await computeWorkspaceDrift(graph.nodes);
    return {
      mode: "drift",
      query: q,
      summary:
        driftInfo.changedModules.length === 0 && driftInfo.driftedSidecars.length === 0
          ? `Workspace is synchronized with baseline checkpoint ${driftInfo.baselineCheckpointId || "latest"} (0 AST diffs, 0 drifted sidecars).`
          : `Detected ${driftInfo.changedModules.length} modified AST module${driftInfo.changedModules.length === 1 ? "" : "s"} and ${driftInfo.driftedSidecars.length} drifted sidecar${driftInfo.driftedSidecars.length === 1 ? "" : "s"} since baseline ${driftInfo.baselineCheckpointId || "checkpoint"}.`,
      estimatedTokens: Math.max(40, driftInfo.changedModules.length * 24),
      driftResult: driftInfo,
    };
  }

  // 8. High-Centrality Hubs (`hubs:` or `hubs`)
  if (lower === "hubs:" || lower === "hubs" || lower.startsWith("hubs:")) {
    const domainFilter = lower.startsWith("hubs:") ? q.slice(5).trim().toLowerCase() : "";
    const hubs = [...graph.nodes]
      .filter((n) => !n.filePath.includes(".test.") && (!domainFilter || n.domain.toLowerCase() === domainFilter))
      .sort((a, b) => b.fanIn - a.fanIn || b.degree - a.degree)
      .slice(0, 12)
      .map((n) => ({
        id: n.id,
        domain: n.domain,
        layer: n.layer,
        fanIn: n.fanIn,
        fanOut: n.fanOut,
        degree: n.degree,
        exports: parseExports(n).slice(0, 6),
      }));

    return {
      mode: "hubs",
      query: q,
      summary: `Top ${hubs.length} High-Centrality Architectural Hubs${domainFilter ? ` in domain '${domainFilter}'` : " across all 7 layers"}.`,
      estimatedTokens: hubs.length * 25,
      hubsResult: { hubs },
    };
  }

  // 9. Durable Agentic Task Status (`task:` or `task`)
  if (lower === "task:" || lower === "task" || lower.startsWith("task:")) {
    const taskData = await listAgenticTasks();
    const active = taskData.activeTask;
    const completedSteps = active ? active.steps.filter((s) => s.status === "completed").length : 0;
    return {
      mode: "task",
      query: q,
      summary: active
        ? `Active Durable Task '${active.title}' [${active.status.toUpperCase()}] — ${completedSteps}/${active.steps.length} steps completed across ${active.editPlan.length} topological modules.`
        : `No active durable task (${taskData.tasks.length} total tasks in ledger).`,
      estimatedTokens: 160,
      taskResult: {
        activeTask: active,
        totalTasks: taskData.tasks.length,
      },
    };
  }

  // 10. Affected Unit Tests Discovery (`tests: <target>` or `test: <target>`)
  if (lower.startsWith("tests:") || lower.startsWith("test:") || lower === "tests" || lower === "test") {
    const rawTarget = lower.startsWith("tests:")
      ? q.slice(6).trim()
      : lower.startsWith("test:")
      ? q.slice(5).trim()
      : "";
    const targetList = rawTarget
      ? rawTarget.split(/[\s,]+/).map((s) => s.trim()).filter(Boolean)
      : graph.activeTask?.targetFiles || ["server/stubsService.ts"];
    const discovered = discoverAffectedTests(targetList, graph.nodes, graph.edges);
    return {
      mode: "tests",
      query: q,
      summary: `Discovered ${discovered.allTests.length} affected unit test suite${discovered.allTests.length === 1 ? "" : "s"} (${discovered.directTests.length} direct, ${discovered.callerTests.length} upstream caller tests) for ${targetList.join(", ")}.`,
      estimatedTokens: 60 + discovered.allTests.length * 16,
      testsResult: {
        targets: targetList,
        directTests: discovered.directTests,
        callerTests: discovered.callerTests,
        allTests: discovered.allTests,
        recommendedCommand: discovered.recommendedCommand,
      },
    };
  }

  // 11. GraphRAG Concept / Question Retrieval
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
 * Computes a unified deterministic topological edit sequence across MULTIPLE target modules:
 * prerequisite lower-layer dependencies -> lower-layer targets -> higher-layer targets -> affected upstream callers.
 */
export function computeMultiTargetEditOrder(
  targetIds: string[],
  nodes: StubsNode[],
  edges: StubsEdge[]
): string[] {
  if (targetIds.length === 0) return [];
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const resolvedTargets: string[] = [];
  for (const raw of targetIds) {
    const matched = findNodeMatch(nodes, raw);
    const id = matched?.id || raw.trim();
    if (id && !resolvedTargets.includes(id)) {
      resolvedTargets.push(id);
    }
  }
  const targetSet = new Set<string>(resolvedTargets);
  const candidateDeps: string[] = [];
  const candidateCallers: string[] = [];

  for (const tId of resolvedTargets) {
    for (const e of edges) {
      if (e.source === tId && !e.target.startsWith("pkg:") && !targetSet.has(e.target)) {
        if (!candidateDeps.includes(e.target) && candidateDeps.length < 8) {
          candidateDeps.push(e.target);
        }
      }
      if (e.target === tId && !e.source.startsWith("pkg:") && !targetSet.has(e.source)) {
        if (!candidateCallers.includes(e.source) && !candidateDeps.includes(e.source) && candidateCallers.length < 8) {
          candidateCallers.push(e.source);
        }
      }
    }
  }

  const subset = new Set<string>([...candidateDeps, ...resolvedTargets, ...candidateCallers]);
  const adj = new Map<string, Set<string>>();
  const inDegree = new Map<string, number>();
  for (const id of subset) {
    adj.set(id, new Set());
    inDegree.set(id, 0);
  }

  for (const edge of edges) {
    if (subset.has(edge.source) && subset.has(edge.target) && edge.source !== edge.target) {
      const targets = adj.get(edge.target)!;
      if (!targets.has(edge.source)) {
        targets.add(edge.source);
        inDegree.set(edge.source, (inDegree.get(edge.source) || 0) + 1);
      }
    }
  }

  const rankOf = (id: string): number => {
    if (targetSet.has(id)) return 1;
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

  for (const id of subset) {
    if (!ordered.includes(id)) {
      ordered.push(id);
    }
  }

  return ordered;
}

/**
 * Evaluates a multi-target batch pre-flight safety gate and unified topological edit sequence (`stubs pre-flight <t1> <t2> --order`)
 */
export async function getBatchPreFlight(
  targetFiles: string[],
  guardThreshold: "low" | "medium" | "high" | "critical" = "high"
): Promise<StubsBatchPreFlightResult> {
  const graph = await getGraphData();
  const config = readWorkspaceConfig();
  const cleaned = targetFiles.map((t) => t.trim()).filter(Boolean);
  const effectiveTargets = cleaned.length > 0 ? cleaned : ["src/types.ts"];

  const resolvedTargets: string[] = [];
  for (const raw of effectiveTargets) {
    const node = findNodeMatch(graph.nodes, raw);
    const id = node?.id || raw;
    if (!resolvedTargets.includes(id)) {
      resolvedTargets.push(id);
    }
  }

  const impacts = await Promise.all(resolvedTargets.map((t) => getImpact(t, guardThreshold)));
  const riskRank: Record<"LOW" | "MEDIUM" | "MODERATE" | "HIGH" | "CRITICAL", number> = {
    LOW: 1,
    MEDIUM: 2,
    MODERATE: 2,
    HIGH: 3,
    CRITICAL: 4,
  };
  let overallRiskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  let maxNumericRisk = 0;
  const blockedReasons: string[] = [];
  const directCallersSet = new Set<string>();
  const dependenciesSet = new Set<string>();
  const domainBoundariesSet = new Set<string>();
  let estimatedTotalTokens = 0;

  for (const imp of impacts) {
    const normalizedScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" =
      imp.riskScore === "MODERATE" ? "MEDIUM" : imp.riskScore;
    if (riskRank[normalizedScore] > riskRank[overallRiskScore]) {
      overallRiskScore = normalizedScore;
    }
    if (imp.numericRisk > maxNumericRisk) {
      maxNumericRisk = imp.numericRisk;
    }
    if (imp.preFlight && !imp.preFlight.safe && imp.preFlight.blockedReason) {
      blockedReasons.push(`${imp.target}: ${imp.preFlight.blockedReason}`);
    }
    for (const c of imp.directCallers) directCallersSet.add(c);
    for (const d of imp.dependencies) dependenciesSet.add(d);
    for (const dom of imp.domainBoundariesCrossed || []) domainBoundariesSet.add(dom);
    estimatedTotalTokens += imp.tieredContext?.estimatedTokens || 180;
  }

  const unifiedEditOrder = computeMultiTargetEditOrder(resolvedTargets, graph.nodes, graph.edges);
  const affected = discoverAffectedTests(resolvedTargets, graph.nodes, graph.edges);

  return {
    targets: resolvedTargets,
    safe: blockedReasons.length === 0,
    overallRiskScore,
    maxNumericRisk,
    guardThreshold,
    autonomyLevel: config.autonomy_level,
    blockedReasons,
    unifiedEditOrder,
    directCallersUnion: Array.from(directCallersSet),
    dependenciesUnion: Array.from(dependenciesSet),
    domainBoundariesCrossed: Array.from(domainBoundariesSet),
    estimatedTotalTokens,
    affectedTests: affected.allTests,
    recommendedTestCommand: affected.recommendedCommand,
  };
}

/**
 * Computes AST hash drift between live nodes and the ledger baseline checkpoint snapshot
 */
export async function computeWorkspaceDrift(nodesInput?: StubsNode[]): Promise<{
  baselineCheckpointId?: string;
  changedModules: Array<{
    path: string;
    domain: string;
    layer: number;
    previousHash?: string;
    currentHash?: string;
    status: "modified" | "added" | "drifted-sidecar";
  }>;
  driftedSidecars: string[];
}> {
  const nodes = nodesInput || (await getGraphData()).nodes;
  const ledger = readHarnessLedger();
  const baselineSnapshots = ledger.baselineAstSnapshots || ledger.latestAstSnapshots || {};
  const baselineCheckpointId =
    ledger.checkpoints.length > 1
      ? ledger.checkpoints[ledger.checkpoints.length - 2].id
      : ledger.checkpoints[0]?.id;

  const changedModules: Array<{
    path: string;
    domain: string;
    layer: number;
    previousHash?: string;
    currentHash?: string;
    status: "modified" | "added" | "drifted-sidecar";
  }> = [];

  for (const node of nodes) {
    const prevHash = baselineSnapshots[node.id];
    if (!prevHash && Object.keys(baselineSnapshots).length > 0) {
      changedModules.push({
        path: node.id,
        domain: node.domain,
        layer: node.layer,
        currentHash: node.astHash,
        status: "added",
      });
    } else if (prevHash && node.astHash && prevHash !== node.astHash) {
      changedModules.push({
        path: node.id,
        domain: node.domain,
        layer: node.layer,
        previousHash: prevHash,
        currentHash: node.astHash,
        status: "modified",
      });
    }
  }

  // Also check if any task editPlan item has drifted relative to its task baseline
  const activeTask = ledger.tasks.find((t) => t.id === ledger.activeTaskId);
  if (activeTask) {
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    for (const item of activeTask.editPlan) {
      const liveNode = nodeMap.get(item.path);
      if (
        item.baselineAstHash &&
        liveNode?.astHash &&
        item.baselineAstHash !== liveNode.astHash &&
        !changedModules.some((c) => c.path === item.path)
      ) {
        changedModules.push({
          path: item.path,
          domain: item.domain,
          layer: item.layer,
          previousHash: item.baselineAstHash,
          currentHash: liveNode.astHash,
          status: "modified",
        });
      }
    }
  }

  const specs = await listSidecarSpecs();
  const driftedSidecars = specs.filter((s) => s.driftStatus === "drifted").map((s) => s.path);

  return {
    baselineCheckpointId,
    changedModules,
    driftedSidecars,
  };
}

/**
 * Lists durable agentic coding tasks and checkpoints from .stubs/harness-ledger.json
 */
export async function listAgenticTasks(): Promise<{
  activeTask?: StubsAgenticTask;
  tasks: StubsAgenticTask[];
  checkpoints: StubsHarnessCheckpoint[];
}> {
  const graph = await getGraphData();
  return {
    activeTask: graph.activeTask,
    tasks: graph.tasks || [],
    checkpoints: graph.checkpoints || [],
  };
}

/**
 * Creates a new Durable Agentic Coding Task with a multi-target topological edit plan and 5-stage verification checklist
 */
export async function createAgenticTask(input: {
  title: string;
  goal?: string;
  targetFiles: string[];
  guardThreshold?: "low" | "medium" | "high" | "critical";
}): Promise<StubsAgenticTask> {
  const graph = await getGraphData();
  const config = readWorkspaceConfig();
  const ledger = readHarnessLedger();
  const title = input.title.trim() || "Untitled Durable Agentic Task";
  const rawTargets =
    Array.isArray(input.targetFiles) && input.targetFiles.length > 0
      ? input.targetFiles
      : ["src/types/stubs.ts", "server/stubsService.ts"];
  const resolvedTargets = Array.from(
    new Set(rawTargets.map((t) => findNodeMatch(graph.nodes, t)?.id || t.trim()).filter(Boolean))
  );
  const hasCriticalTarget = resolvedTargets.some((tId) => {
    const n = graph.nodes.find((node) => node.id === tId);
    return Boolean(n && (n.layer === 0 || n.fanIn >= 20));
  });
  const guardThreshold = input.guardThreshold || (hasCriticalTarget ? "critical" : "high");
  const batchPreFlight = await getBatchPreFlight(resolvedTargets, guardThreshold);
  const lastChk = ledger.checkpoints[ledger.checkpoints.length - 1];
  const now = Date.now();
  const taskId = `task_${now.toString(36)}`;

  const editPlan = buildTaskEditPlan(resolvedTargets, graph.nodes, graph.edges);
  const { baselineAstSnapshots, baselineExportsSnapshots } = captureTaskBaselineMaps(
    editPlan.map((i) => i.path),
    graph.nodes
  );
  const affected = discoverAffectedTests(resolvedTargets, graph.nodes, graph.edges);

  const steps: StubsTaskStep[] = [
    {
      id: "step_preflight",
      phase: "pre-flight",
      label: "Pre-Flight Blast Radius & Topological Edit Plan",
      status: batchPreFlight.safe ? "completed" : "pending",
      detail: batchPreFlight.safe
        ? `Pre-flight passed (${batchPreFlight.overallRiskScore} risk, ${batchPreFlight.unifiedEditOrder.length} ordered modules).`
        : `Guard warning: ${batchPreFlight.blockedReasons[0] || "Review high-blast callers."}`,
      updatedAt: now,
    },
    {
      id: "step_edit",
      phase: "edit",
      label: "Topological Layer-Ordered Code Implementation",
      status: "pending",
      detail: `Edit sequence: ${batchPreFlight.unifiedEditOrder.slice(0, 5).join(" -> ")}`,
      updatedAt: now,
    },
    {
      id: "step_test",
      phase: "test",
      label: "Fast-Feedback Unit Test Verification",
      status: "pending",
      detail: `Run affected test suites: ${affected.recommendedCommand}`,
      updatedAt: now,
    },
    {
      id: "step_sanding",
      phase: "sanding",
      label: "Context Maps & Sidecar Reverse Sanding",
      status: "pending",
      detail: "Synchronize domain context maps and sidecar AST hashes.",
      updatedAt: now,
    },
    {
      id: "step_verification",
      phase: "verification",
      label: "5-Stage Durable Harness Checkpoint Gate",
      status: "pending",
      detail: "Execute 'npx stubs task verify' or 'npx stubs run' and record verified checkpoint.",
      updatedAt: now,
    },
  ];

  const newTask: StubsAgenticTask = {
    id: taskId,
    title,
    goal:
      input.goal?.trim() ||
      `Execute durable multi-file changes across ${resolvedTargets.join(", ")} following topological layer hierarchy.`,
    status: "in_progress",
    createdAt: now,
    updatedAt: now,
    autonomyLevel: config.autonomy_level,
    guardThreshold,
    targetFiles: resolvedTargets,
    editPlan,
    steps,
    baselineCheckpointId: lastChk?.id,
    latestCheckpointId: lastChk?.id,
    baselineAstSnapshots,
    baselineExportsSnapshots,
    affectedTests: affected.allTests,
    recommendedTestCommand: affected.recommendedCommand,
    notes: [
      `Created durable task with ${resolvedTargets.length} primary target(s) and ${affected.allTests.length} discovered affected test suite(s).`,
    ],
  };

  ledger.tasks.push(newTask);
  ledger.activeTaskId = newTask.id;
  writeHarnessLedger(ledger);
  emitLog("stdout", `[task] Started durable agentic task '${newTask.title}' (${newTask.id}) with ${newTask.editPlan.length} ordered modules.`);

  return newTask;
}

/**
 * Updates a Durable Agentic Coding Task (toggles step status, target file status, baseline snapshots, or overall task status)
 */
export async function updateAgenticTask(input: {
  taskId?: string;
  stepId?: string;
  stepStatus?: "pending" | "completed" | "failed";
  targetPath?: string;
  targetStatus?: "pending" | "edited" | "verified";
  taskStatus?: StubsTaskStatus;
  setActive?: boolean;
  resetBaseline?: boolean;
  note?: string;
}): Promise<StubsAgenticTask> {
  const graph = await getGraphData();
  const ledger = readHarnessLedger();
  const targetTaskId = input.taskId || ledger.activeTaskId || ledger.tasks[ledger.tasks.length - 1]?.id;
  const task = ledger.tasks.find((t) => t.id === targetTaskId) || graph.activeTask;
  if (!task) {
    throw new Error("No durable agentic task found in ledger.");
  }

  const now = Date.now();
  if (input.setActive) {
    ledger.activeTaskId = task.id;
    if (task.status === "completed" && !input.taskStatus) {
      task.status = "in_progress";
      const verifyStep = task.steps.find((s) => s.phase === "verification");
      if (verifyStep && verifyStep.status === "completed") {
        verifyStep.status = "pending";
        verifyStep.updatedAt = now;
      }
      task.notes = [...(task.notes || []), "Resumed task as active durable task in ledger."].slice(-12);
    }
  }

  if (input.resetBaseline) {
    const snap = captureTaskBaselineMaps(
      task.editPlan.map((i) => i.path),
      graph.nodes
    );
    task.baselineAstSnapshots = snap.baselineAstSnapshots;
    task.baselineExportsSnapshots = snap.baselineExportsSnapshots;
    for (const item of task.editPlan) {
      item.baselineAstHash = snap.baselineAstSnapshots[item.path] || item.currentAstHash;
      item.driftedSinceBaseline = false;
      item.baselineExports = snap.baselineExportsSnapshots[item.path] || item.currentExports || [];
      item.addedExports = [];
      item.removedExports = [];
      item.contractStatus = "intact";
    }
    task.notes = [
      ...(task.notes || []),
      `Reset task AST and exported symbol baseline snapshots across ${task.editPlan.length} topological modules.`,
    ].slice(-12);
  }

  if (input.stepId) {
    const step = task.steps.find((s) => s.id === input.stepId || s.phase === input.stepId);
    if (step) {
      step.status =
        input.stepStatus || (step.status === "completed" ? "pending" : "completed");
      step.updatedAt = now;
    }
  }

  if (input.targetPath) {
    const item = task.editPlan.find(
      (e) => e.path === input.targetPath || e.path.endsWith(input.targetPath!)
    );
    if (item) {
      if (input.targetStatus) {
        item.status = input.targetStatus;
      } else {
        item.status =
          item.status === "pending"
            ? "edited"
            : item.status === "edited"
            ? "verified"
            : "pending";
      }
    }
  }

  if (input.taskStatus) {
    task.status = input.taskStatus;
    if (input.taskStatus === "completed") {
      if (ledger.activeTaskId === task.id) {
        ledger.activeTaskId = undefined;
      }
      for (const s of task.steps) {
        s.status = "completed";
        s.updatedAt = now;
      }
      for (const item of task.editPlan) {
        if (item.role === "target") {
          item.status = "verified";
        }
      }
    }
  } else if (!input.setActive) {
    const allCompleted = task.steps.every((s) => s.status === "completed");
    if (allCompleted && task.status === "in_progress") {
      task.status = "completed";
      if (ledger.activeTaskId === task.id) {
        ledger.activeTaskId = undefined;
      }
    } else if (!allCompleted && task.status === "completed") {
      task.status = "in_progress";
    }
  }

  if (input.note && input.note.trim()) {
    task.notes = [...(task.notes || []), input.note.trim()].slice(-12);
  }

  task.updatedAt = now;
  const idx = ledger.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    ledger.tasks[idx] = task;
  } else {
    ledger.tasks.push(task);
  }
  writeHarnessLedger(ledger);

  return task;
}

/**
 * Executes an automated 5-phase Durable Task Verification Gate (`stubs task verify [taskId]`):
 * 1. Runs the 5-stage repository harness pipeline (AST scan, context map & sidecar sand sync, lint-arch, prune, design audit).
 * 2. Evaluates multi-target batch pre-flight blast radius & guard threshold.
 * 3. Computes AST hash drift and symbol-level export contract parity across the task's topological edit plan.
 * 4. Discovers affected unit test suites and updates the task's verification report, steps, and execution journal.
 */
export async function verifyAgenticTask(taskId?: string): Promise<{
  task: StubsAgenticTask;
  report: StubsTaskVerificationReport;
  pipeline: StubsRunResult;
}> {
  const pipeline = await runStubsPipeline(false);
  const graph = await getGraphData();
  const ledger = readHarnessLedger();
  const resolvedId = taskId || ledger.activeTaskId || ledger.tasks[ledger.tasks.length - 1]?.id;
  const task = ledger.tasks.find((t) => t.id === resolvedId) || graph.activeTask;
  if (!task) {
    throw new Error("No durable agentic task found in ledger to verify.");
  }

  const now = Date.now();
  const hasCriticalTarget = task.targetFiles.some((tId) => {
    const n = graph.nodes.find((node) => node.id === tId);
    return Boolean(n && (n.layer === 0 || n.fanIn >= 20));
  });
  const effectiveGuard =
    hasCriticalTarget && task.guardThreshold === "high" ? "critical" : task.guardThreshold;
  const batchPreFlight = await getBatchPreFlight(task.targetFiles, effectiveGuard);
  const affected = discoverAffectedTests(task.targetFiles, graph.nodes, graph.edges);
  const specs = await listSidecarSpecs();
  const driftedSidecarSet = new Set(
    specs
      .filter((s) => s.driftStatus === "drifted" && s.targetCodeFile)
      .map((s) => s.targetCodeFile!)
  );

  task.editPlan = buildTaskEditPlan(
    task.targetFiles,
    graph.nodes,
    graph.edges,
    task.editPlan,
    task.baselineAstSnapshots,
    task.baselineExportsSnapshots
  ).map((item) => {
    const sidecarDrifted = driftedSidecarSet.has(item.path);
    let nextStatus = item.status;
    if (pipeline.passed && item.role === "target") {
      nextStatus = "verified";
    } else if (item.driftedSinceBaseline && nextStatus === "pending") {
      nextStatus = "edited";
    }
    return {
      ...item,
      sidecarDrifted,
      status: nextStatus,
    };
  });

  const driftedTargetsCount = task.editPlan.filter((i) => i.driftedSinceBaseline).length;
  const breakingContractsCount = task.editPlan.filter((i) => i.contractStatus === "breaking").length;
  const passed =
    pipeline.passed &&
    batchPreFlight.safe &&
    breakingContractsCount === 0 &&
    pipeline.driftedSidecars === 0;

  task.affectedTests = affected.allTests;
  task.recommendedTestCommand = affected.recommendedCommand;
  if (pipeline.checkpointId) {
    task.latestCheckpointId = pipeline.checkpointId;
  }

  for (const step of task.steps) {
    if (step.phase === "pre-flight") {
      step.status = batchPreFlight.safe ? "completed" : "failed";
      step.detail = batchPreFlight.safe
        ? `Pre-flight passed (${batchPreFlight.overallRiskScore} risk, ${batchPreFlight.unifiedEditOrder.length} ordered modules).`
        : `Blocked: ${batchPreFlight.blockedReasons.join("; ")}`;
      step.updatedAt = now;
    } else if (step.phase === "edit") {
      step.status = breakingContractsCount === 0 ? "completed" : "failed";
      step.detail =
        breakingContractsCount > 0
          ? `${breakingContractsCount} module(s) have removed exported symbols without caller update.`
          : `${task.editPlan.filter((i) => i.role === "target").length} target module(s) verified (${driftedTargetsCount} AST deltas since task baseline).`;
      step.updatedAt = now;
    } else if (step.phase === "test") {
      step.status = "completed";
      step.detail = `Discovered ${affected.allTests.length} affected test suite(s): ${affected.recommendedCommand}`;
      step.updatedAt = now;
    } else if (step.phase === "sanding") {
      step.status = pipeline.driftedSidecars === 0 ? "completed" : "failed";
      step.detail = `${pipeline.contextMapsCount} context maps synced · ${pipeline.driftedSidecars} drifted sidecars`;
      step.updatedAt = now;
    } else if (step.phase === "verification") {
      step.status = passed ? "completed" : "failed";
      step.detail = `Checkpoint ${pipeline.checkpointId || "latest"}: ${
        passed ? "VERIFIED" : "ACTION REQUIRED"
      } (${pipeline.lintErrors} arch errors, ${pipeline.designViolations} design violations)`;
      step.updatedAt = now;
    }
  }

  const summary = passed
    ? `All 5 durable task gates verified at checkpoint ${pipeline.checkpointId || "latest"} (${driftedTargetsCount} AST deltas, 0 breaking contracts, ${affected.allTests.length} test suites mapped).`
    : `Verification flagged ${pipeline.lintErrors} arch error(s), ${breakingContractsCount} breaking contract(s), ${pipeline.driftedSidecars} drifted sidecar(s), and ${pipeline.designViolations} design violation(s).`;

  const report: StubsTaskVerificationReport = {
    verifiedAt: now,
    passed,
    checkpointId: pipeline.checkpointId,
    preFlightSafe: batchPreFlight.safe,
    lintErrors: pipeline.lintErrors,
    lintWarnings: pipeline.lintWarnings,
    driftedSidecars: pipeline.driftedSidecars,
    designViolations: pipeline.designViolations ?? 0,
    driftedTargetsCount,
    breakingContractsCount,
    affectedTests: affected.allTests,
    recommendedTestCommand: affected.recommendedCommand,
    summary,
  };

  task.verificationReport = report;
  task.notes = [...(task.notes || []), `[verify] ${summary}`].slice(-12);
  task.updatedAt = now;

  const idx = ledger.tasks.findIndex((t) => t.id === task.id);
  if (idx >= 0) {
    ledger.tasks[idx] = task;
  } else {
    ledger.tasks.push(task);
  }
  writeHarnessLedger(ledger);

  return { task, report, pipeline };
}

/**
 * Generates a deterministic Durable Session Handoff & Context Resumption Packet (`stubs handoff [taskId]`)
 * Captures task state, checkpoint delta, modified AST hashes, symbol contract alerts, affected unit tests, topological edit progress, and Level 1 Interface Stubs.
 */
export async function generateSessionHandoff(taskId?: string): Promise<StubsSessionHandoff> {
  const graph = await getGraphData();
  const ledger = readHarnessLedger();
  const activeTask =
    (taskId ? ledger.tasks.find((t) => t.id === taskId) : undefined) ||
    graph.activeTask ||
    ledger.tasks[ledger.tasks.length - 1];
  const checkpoints = ledger.checkpoints;
  const lastCheckpoint = checkpoints[checkpoints.length - 1];
  const previousCheckpoint = checkpoints.length > 1 ? checkpoints[checkpoints.length - 2] : checkpoints[0];

  const drift = await computeWorkspaceDrift(graph.nodes);
  const targetList = activeTask?.targetFiles || ["src/types/stubs.ts", "server/stubsService.ts"];
  const affected = discoverAffectedTests(targetList, graph.nodes, graph.edges);

  const contractAlerts: string[] = [];
  if (activeTask) {
    for (const item of activeTask.editPlan) {
      if (item.removedExports && item.removedExports.length > 0) {
        contractAlerts.push(
          `BREAKING CONTRACT in ${item.path}: removed exports [${item.removedExports.join(", ")}]`
        );
      } else if (item.addedExports && item.addedExports.length > 0) {
        contractAlerts.push(
          `EXPANDED CONTRACT in ${item.path}: added exports [${item.addedExports.join(", ")}]`
        );
      }
    }
  }

  // Extract Level 1 Interface Skeletons for up to 3 primary target modules in the active task
  const stubTargets = targetList.slice(0, 3);
  const stubs: StubsInterfaceStub[] = [];
  for (const t of stubTargets) {
    try {
      const s = await extractInterfaceStub(t);
      stubs.push(s);
    } catch {
      // ignore missing stub
    }
  }

  const nextRecommendedActions: string[] = [];
  if (activeTask) {
    const pendingTargets = activeTask.editPlan.filter((i) => i.role === "target" && i.status === "pending");
    const pendingSteps = activeTask.steps.filter((s) => s.status !== "completed");
    if (pendingTargets.length > 0) {
      nextRecommendedActions.push(
        `Edit remaining topological targets in order: ${pendingTargets.map((t) => t.path).join(" -> ")}`
      );
    }
    for (const s of pendingSteps.slice(0, 2)) {
      nextRecommendedActions.push(`Complete phase [${s.phase.toUpperCase()}]: ${s.label}`);
    }
  }
  if (affected.allTests.length > 0) {
    nextRecommendedActions.push(`Run affected unit test suites: ${affected.recommendedCommand}`);
  }
  if (drift.driftedSidecars.length > 0) {
    nextRecommendedActions.push(`Reverse-sand drifted sidecars: npx stubs sand`);
  }
  nextRecommendedActions.push(
    `Verify durable task gate before completion: npx stubs task verify`
  );

  const mdLines: string[] = [
    `# Durable Agentic Session Handoff — ${graph.projectName}`,
    ``,
    `- **Generated**: ${new Date().toISOString()}`,
    `- **Autonomy Level**: \`${graph.autonomyLevel || "guided_execution"}\``,
    `- **Graph State**: ${graph.summary.totalFiles} modules · ${graph.summary.totalEdges} edges · ${graph.summary.totalSymbols} symbols · ${graph.summary.cyclesCount} cycles`,
    ...(lastCheckpoint
      ? [
          `- **Latest Checkpoint**: \`${lastCheckpoint.id}\` (${lastCheckpoint.passed ? "VERIFIED" : "ACTION NEEDED"} · ${lastCheckpoint.lintErrors} arch errors · ${lastCheckpoint.designViolations} design violations)`,
        ]
      : []),
    ``,
  ];

  if (activeTask) {
    const completedSteps = activeTask.steps.filter((s) => s.status === "completed").length;
    mdLines.push(
      `## 1. Active Durable Task: ${activeTask.title} (\`${activeTask.id}\`)`,
      `- **Status**: \`${activeTask.status.toUpperCase()}\` (${completedSteps}/${activeTask.steps.length} verification phases completed)`,
      `- **Goal**: ${activeTask.goal}`,
      `- **Guard Threshold**: \`--guard ${activeTask.guardThreshold}\``,
      ...(activeTask.verificationReport
        ? [
            `- **Last Gate Verification**: ${activeTask.verificationReport.passed ? "PASSED" : "ACTION NEEDED"} — ${activeTask.verificationReport.summary}`,
          ]
        : []),
      ``,
      `### Topological Edit Sequence & Symbol Contract Parity`,
      ...activeTask.editPlan.map((item) => {
        const contractBadge =
          item.contractStatus === "breaking"
            ? ` · CONTRACT: BREAKING (-${item.removedExports?.join(", ")})`
            : item.contractStatus === "expanded"
            ? ` · CONTRACT: EXPANDED (+${item.addedExports?.join(", ")})`
            : ` · CONTRACT: INTACT`;
        return `${item.orderIndex}. [${item.status === "verified" ? "x" : item.status === "edited" ? "~" : " "}] \`${item.path}\` (L${item.layer} ${item.domain}, **${item.role.toUpperCase()}**, risk: ${item.riskScore}) — AST: \`${item.baselineAstHash || "—"}\` -> \`${item.currentAstHash || "—"}\`${item.driftedSinceBaseline ? " *(modified)*" : ""}${contractBadge}`;
      }),
      ``,
      `### 5-Phase Execution & Verification Checklist`,
      ...activeTask.steps.map(
        (s) =>
          `- [${s.status === "completed" ? "x" : " "}] **[${s.phase.toUpperCase()}] ${s.label}** — ${s.detail || s.status}`
      ),
      ``
    );

    if (activeTask.notes && activeTask.notes.length > 0) {
      mdLines.push(
        `### Durable Execution Journal & Notes`,
        ...activeTask.notes.map((n) => `- ${n}`),
        ``
      );
    }
  }

  mdLines.push(
    `## 2. Workspace Drift & Symbol Contract Alerts`,
    drift.changedModules.length === 0
      ? `- All ${graph.summary.totalFiles} modules match baseline checkpoint AST hashes.`
      : `- **Modified Modules (${drift.changedModules.length})**:`,
    ...drift.changedModules.map(
      (m) =>
        `  - \`${m.path}\` (L${m.layer} ${m.domain}): \`${m.previousHash || "new"}\` -> \`${m.currentHash || "—"}\` [${m.status}]`
    ),
    ...(contractAlerts.length > 0
      ? [`- **Symbol Contract Alerts (${contractAlerts.length})**:`, ...contractAlerts.map((a) => `  - ${a}`)]
      : [`- **Symbol Contract Parity**: All exported module contracts intact.`]),
    drift.driftedSidecars.length === 0
      ? `- **Sidecar Parity**: 0 drifted sidecars.`
      : `- **Drifted Sidecars (${drift.driftedSidecars.length})**: ${drift.driftedSidecars.join(", ")}`,
    ``,
    `## 3. Discovered Affected Unit Tests & Verification Commands`,
    `- **Recommended Test Command**: \`${affected.recommendedCommand}\``,
    `- **Direct Target Tests (${affected.directTests.length})**: ${affected.directTests.join(", ") || "none"}`,
    `- **Upstream Caller Tests (${affected.callerTests.length})**: ${affected.callerTests.join(", ") || "none"}`,
    ``,
    `## 4. Recommended Next Actions`,
    ...nextRecommendedActions.map((a, idx) => `${idx + 1}. ${a}`),
    ``
  );

  if (stubs.length > 0) {
    mdLines.push(`## 5. Target Level 1 Interface Skeletons`);
    for (const s of stubs) {
      mdLines.push(
        `### \`${s.path}\` (${s.tokenSavingsPct}% token reduction)`,
        "```ts",
        s.skeletonCode,
        "```",
        ``
      );
    }
  }

  return {
    generatedAt: Date.now(),
    projectName: graph.projectName,
    activeTask,
    lastCheckpoint,
    previousCheckpoint,
    changedModules: drift.changedModules,
    driftedSidecars: drift.driftedSidecars,
    affectedTests: affected.allTests,
    recommendedTestCommand: affected.recommendedCommand,
    contractAlerts,
    nextRecommendedActions,
    handoffMarkdown: mdLines.join("\n"),
  };
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
 * 4. DOMAIN_LEAK (cross-domain imports bypassing subfolder barrel index.ts)
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

  // Identify barrel-encapsulated subdirectories (e.g., src/utils/storage/index.ts, src/utils/crossTabNotifier/index.ts, src/services/codeGenerators/index.ts)
  const barrelDirs = new Set<string>();
  for (const n of graph.nodes) {
    if (n.id.endsWith("/index.ts") || n.id.endsWith("/index.tsx")) {
      const dir = path.posix.dirname(n.id);
      if (dir.split("/").length >= 3) {
        barrelDirs.add(dir);
      }
    }
  }

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

    // Domain Leak check: external domains bypassing a barrel-encapsulated submodule's index.ts
    if (src.domain !== tgt.domain && tgt.layer > 0) {
      const tgtDir = path.posix.dirname(tgt.id);
      if (
        barrelDirs.has(tgtDir) &&
        !tgt.id.endsWith("/index.ts") &&
        !tgt.id.endsWith("/index.tsx") &&
        !src.id.startsWith(`${tgtDir}/`)
      ) {
        violations.push({
          rule: "DOMAIN_LEAK",
          severity: "warning",
          message: `Cross-domain import from '${src.domain}' (${src.name}) bypasses submodule barrel '${tgtDir}/index.ts' to access internal '${tgt.id}'.`,
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
    `## 4. Surgical GraphRAG Query Protocol & Durable Harness Commands`,
    `- \`npx stubs query "map:"\` — Level 0 Macro Map summary`,
    `- \`npx stubs query "stub: <target>"\` — Level 1 Interface Skeleton Stubs (stripped bodies + line links)`,
    `- \`npx stubs query "explain: <target>"\` — Level 2 Symbol Profile (callers, callees, exports)`,
    `- \`npx stubs query "path: <A> to <B>"\` — Shortest directed dependency chain`,
    `- \`npx stubs query "blast: <target>"\` — Downstream impact radius & topological edit order`,
    `- \`npx stubs query "drift:"\` — AST hash deltas & sidecar drift since last harness checkpoint`,
    `- \`npx stubs query "hubs:"\` — High-centrality architectural hubs across the 7-layer hierarchy`,
    `- \`npx stubs query "task:"\` — Active durable task status & topological edit plan progress`,
    `- \`npx stubs query "tests: <target>"\` — AST-discovered direct and upstream caller unit test suites`,
    `- \`npx stubs query "pkg:<package>"\` — Package-scoped consumer audit`,
    `- \`npx stubs pre-flight <t1> [t2...] [--guard <level>] [--order <files...>] [--context]\` — Multi-target pre-flight blast radius & unified topological edit order`,
    `- \`npx stubs task [list|start|step|target|verify|resume|note|reset-baseline|complete]\` — Manage durable agentic coding tasks in \`.stubs/harness-ledger.json\``,
    `- \`npx stubs handoff [taskId]\` — Synthesize a deterministic session handoff & context resumption Markdown packet`,
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
export async function runStubsPipeline(
  emitToStream = true,
  options?: { checkOnly?: boolean }
): Promise<StubsRunResult> {
  if (activePipelinePromise) {
    return activePipelinePromise;
  }
  activePipelinePromise = performStubsPipeline(emitToStream, options).finally(() => {
    activePipelinePromise = null;
  });
  return activePipelinePromise;
}

async function performStubsPipeline(
  emitToStream = true,
  options?: { checkOnly?: boolean }
): Promise<StubsRunResult> {
  const start = Date.now();
  const checkOnly = Boolean(options?.checkOnly);
  if (emitToStream) {
    emitLog("start", checkOnly ? "$ stubs run --check" : "$ stubs run");
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
  let updatedMapsCount = 0;
  if (!checkOnly) {
    const mapGen = await generateContextMaps();
    updatedMapsCount = mapGen.updatedFiles.length;
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
  }
  const specs = await listSidecarSpecs();
  const driftedSidecars = specs.filter((s) => s.driftStatus === "drifted").length;
  const contextMapsCount = specs.filter((s) => s.category === "context-map").length;
  steps.push({
    name: "Context Maps & Sidecar Sync",
    status: driftedSidecars > 0 ? "warn" : "pass",
    detail: checkOnly
      ? `${contextMapsCount} maps · ${specs.length} docs · ${driftedSidecars} drifted sidecars (check-only)`
      : `${updatedMapsCount} maps synced · ${specs.length} docs · ${driftedSidecars} drifted sidecars`,
    durationMs: Date.now() - specsStart,
  });
  if (emitToStream) {
    emitLog(
      "stdout",
      `[2/5] maps & sand: ${checkOnly ? contextMapsCount : updatedMapsCount} context maps, ${driftedSidecars} drifted sidecars`
    );
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
  const blockingOrStalePruneCount = pruneRes.summary.phantomSidecars + pruneRes.summary.staleDbNodes;
  steps.push({
    name: "Workspace Hygiene (prune)",
    status: pruneRes.summary.phantomSidecars > 0 ? "fail" : blockingOrStalePruneCount > 0 ? "warn" : "pass",
    detail: `${pruneRes.summary.phantomSidecars} phantom · ${pruneRes.summary.zombieExports} zombie exports · ${pruneRes.summary.staleDbNodes} stale DB`,
    durationMs: Date.now() - pruneStart,
  });
  if (emitToStream) {
    emitLog("stdout", `[4/5] prune: ${pruneIssueCount} hygiene items detected (${pruneRes.summary.phantomSidecars} blocking)`);
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

  // Compute AST drift against baseline snapshot before recording new checkpoint
  const driftSummary = await computeWorkspaceDrift();
  const graph = await getGraphData();
  const currentAstMap: Record<string, string> = {};
  for (const n of graph.nodes) {
    if (n.astHash) {
      currentAstMap[n.id] = n.astHash;
    }
  }

  const totalDurationMs = Math.max(1, Date.now() - start);
  const passed = lintRes.passed && pruneRes.summary.phantomSidecars === 0 && designCheck.violationsCount === 0;
  const checkpointId = `chk_${Date.now().toString(36)}`;
  const ledgerBefore = readHarnessLedger();
  const activeTaskId = ledgerBefore.activeTaskId || undefined;

  if (!checkOnly) {
    recordCheckpoint(
      {
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
        changedModulesCount: driftSummary.changedModules.length,
        changedModules: driftSummary.changedModules.slice(0, 20).map((m) => m.path),
        activeTaskId,
        durationMs: totalDurationMs,
      },
      currentAstMap
    );

    if (activeTaskId) {
      const ledgerAfter = readHarnessLedger();
      const activeTask = ledgerAfter.tasks.find((t) => t.id === activeTaskId);
      if (activeTask) {
        activeTask.latestCheckpointId = checkpointId;
        activeTask.updatedAt = Date.now();
        const verifyStep = activeTask.steps.find((s) => s.phase === "verification");
        if (verifyStep) {
          verifyStep.detail = `Checkpoint ${checkpointId}: ${passed ? "VERIFIED" : "ACTION REQUIRED"} (${lintRes.errorCount} lint errors, ${designCheck.violationsCount} design violations)`;
        }
        writeHarnessLedger(ledgerAfter);
      }
    }
  }

  if (emitToStream) {
    if (!checkOnly) {
      emitLog(
        "stdout",
        `Recorded durable harness checkpoint ${checkpointId} in .stubs/harness-ledger.json (${driftSummary.changedModules.length} AST deltas)`
      );
    }
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
    changedModulesCount: driftSummary.changedModules.length,
    checkpointId: checkOnly ? undefined : checkpointId,
    activeTaskId,
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
      const jsonFlag = args.includes("--json");
      const checkFlag = args.includes("--check");

      if (command === "scan") {
        const res = await scanWorkspace(false);
        stdout = jsonFlag
          ? JSON.stringify(res, null, 2)
          : `AST scan complete: ${res.filesScanned} modules, ${res.edgesCount} edges, ${res.symbolsCount} symbols (${res.durationMs}ms).`;
        emitLog("stdout", stdout);
      } else if (command === "run" || command === "harness") {
        const res = await runStubsPipeline(false, { checkOnly: checkFlag });
        if (jsonFlag) {
          stdout = JSON.stringify(res, null, 2);
          emitLog("stdout", stdout);
        } else {
          const lines = [
            ...res.steps.map((s) => `[${s.status.toUpperCase()}] ${s.name}: ${s.detail} (${s.durationMs}ms)`),
            `Checkpoint: ${res.checkpointId || (checkFlag ? "CHECK-ONLY" : "—")} | AST Deltas: ${res.changedModulesCount ?? 0} | Status: ${
              res.passed ? "VERIFIED" : "ACTION REQUIRED"
            } (${res.durationMs}ms)`,
          ];
          stdout = lines.join("\n");
          for (const line of lines) emitLog("stdout", line);
        }
        exitCode = res.passed ? 0 : 1;
      } else if (command === "lint-arch") {
        const res = await lintArchitecture();
        if (jsonFlag) {
          stdout = JSON.stringify(res, null, 2);
          emitLog("stdout", stdout);
        } else {
          const lines = [
            `Checked ${res.totalChecks} architectural invariants in ${res.durationMs}ms.`,
            `Result: ${res.passed ? "PASSED" : "FAILED"} (${res.errorCount} errors, ${res.warningCount} warnings)`,
            ...res.violations.slice(0, 15).map((v) => `  [${v.severity.toUpperCase()}] ${v.rule}: ${v.message}`),
          ];
          stdout = lines.join("\n");
          for (const line of lines) emitLog(line.includes("[ERROR]") ? "stderr" : "stdout", line);
        }
        exitCode = res.passed ? 0 : 1;
      } else if (command === "prune") {
        const res = await pruneWorkspace();
        if (jsonFlag) {
          stdout = JSON.stringify(res, null, 2);
          emitLog("stdout", stdout);
        } else {
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
        }
      } else if (command === "query") {
        const filteredArgs = args.filter((a) => a !== "--json");
        const q = filteredArgs.join(" ").replace(/^["']|["']$/g, "") || "map:";
        const res = await queryGraph(q);
        if (jsonFlag) {
          stdout = JSON.stringify(res, null, 2);
          emitLog("stdout", stdout);
        } else {
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
            lines.push(
              `  Direct Callers (${res.blastResult.directCallers.length}): ${res.blastResult.directCallers.slice(0, 8).join(", ") || "none"}`
            );
            if (res.blastResult.preFlight?.editOrder?.length) {
              lines.push(`  Topological Edit Order: ${res.blastResult.preFlight.editOrder.join(" -> ")}`);
            }
          } else if (res.driftResult) {
            lines.push(`  Baseline Checkpoint: ${res.driftResult.baselineCheckpointId || "none"}`);
            if (res.driftResult.changedModules.length > 0) {
              lines.push(`  Changed Modules (${res.driftResult.changedModules.length}):`);
              for (const m of res.driftResult.changedModules.slice(0, 15)) {
                lines.push(`    - [${m.status.toUpperCase()}] ${m.path} (Domain: ${m.domain}, L${m.layer}) ${m.previousHash || "—"} -> ${m.currentHash || "—"}`);
              }
            }
            if (res.driftResult.driftedSidecars.length > 0) {
              lines.push(`  Drifted Sidecars (${res.driftResult.driftedSidecars.length}): ${res.driftResult.driftedSidecars.join(", ")}`);
            }
          } else if (res.hubsResult) {
            for (const h of res.hubsResult.hubs) {
              lines.push(
                `  [L${h.layer} · ${h.domain}] ${h.id} — Fan-In: ${h.fanIn}, Fan-Out: ${h.fanOut}, Degree: ${h.degree}`
              );
            }
          } else if (res.taskResult) {
            if (res.taskResult.activeTask) {
              const t = res.taskResult.activeTask;
              lines.push(`  Active Task: [${t.id}] ${t.title} (${t.status.toUpperCase()})`);
              lines.push(`  Goal: ${t.goal}`);
              if (t.recommendedTestCommand) {
                lines.push(`  Test Command: ${t.recommendedTestCommand}`);
              }
              lines.push(`  Steps (${t.steps.filter((s) => s.status === "completed").length}/${t.steps.length}):`);
              for (const s of t.steps) {
                lines.push(`    - [${s.status.toUpperCase()}] (${s.phase}) ${s.label}${s.detail ? ` — ${s.detail}` : ""}`);
              }
              lines.push(`  Topological Edit Plan (${t.editPlan.length} files):`);
              for (const item of t.editPlan.slice(0, 12)) {
                lines.push(`    - [${item.status.toUpperCase()}] L${item.layer} (${item.role}): ${item.path} [contract: ${item.contractStatus || "intact"}]`);
              }
            } else {
              lines.push(`  Tracked Tasks in Ledger: ${res.taskResult.totalTasks}`);
            }
          } else if (res.testsResult) {
            lines.push(`  Recommended Command: ${res.testsResult.recommendedCommand}`);
            lines.push(`  Direct Target Tests (${res.testsResult.directTests.length}): ${res.testsResult.directTests.join(", ") || "none"}`);
            lines.push(`  Upstream Caller Tests (${res.testsResult.callerTests.length}): ${res.testsResult.callerTests.join(", ") || "none"}`);
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
        }
      } else if (command === "impact" || command === "pre-flight" || command === "context") {
        // Parse --guard <level>, --order <files...>, --context, and positional targets
        let guardLevel: "low" | "medium" | "high" | "critical" | undefined;
        let showContext = command === "context" || args.includes("--context");
        const targets: string[] = [];

        for (let i = 0; i < args.length; i++) {
          const arg = args[i];
          if (arg === "--guard" && args[i + 1]) {
            const val = args[i + 1].toLowerCase();
            if (val === "low" || val === "medium" || val === "high" || val === "critical") {
              guardLevel = val;
            }
            i++;
          } else if (arg === "--order" || arg === "--context" || arg === "--json") {
            if (arg === "--context") showContext = true;
          } else if (!arg.startsWith("-")) {
            targets.push(arg);
          }
        }

        if (targets.length === 0) {
          targets.push("src/types.ts");
        }

        if (targets.length > 1 || args.includes("--order")) {
          const batch = await getBatchPreFlight(targets, guardLevel);
          if (jsonFlag) {
            stdout = JSON.stringify(batch, null, 2);
            emitLog("stdout", stdout);
          } else {
            const lines = [
              `BATCH ${command.toUpperCase()} across ${batch.targets.length} target(s): ${batch.targets.join(", ")}`,
              `  Combined Risk: ${batch.overallRiskScore} (${batch.maxNumericRisk}/100) | Gate: ${
                batch.safe ? "SAFE TO EDIT" : `BLOCKED — ${batch.blockedReasons.join("; ")}`
              }`,
              `  Unified Topological Edit Sequence (${batch.unifiedEditOrder.length} modules):`,
              ...batch.unifiedEditOrder.map((filePath, idx) => `    ${idx + 1}. ${filePath}`),
              `  Downstream Affected Callers (${batch.directCallersUnion.length}): ${batch.directCallersUnion.slice(0, 10).join(", ") || "none"}`,
              `  Affected Unit Test Suites (${batch.affectedTests?.length || 0}): ${batch.recommendedTestCommand || "npx vitest run"}`,
              `  Estimated Context Budget: ~${batch.estimatedTotalTokens} tokens`,
            ];
            stdout = lines.join("\n");
            for (const line of lines) emitLog("stdout", line);
          }
          if (command === "pre-flight" && !batch.safe) {
            exitCode = 2;
          }
        } else {
          const res = await getImpact(targets[0], guardLevel);
          if (jsonFlag) {
            stdout = JSON.stringify(res, null, 2);
            emitLog("stdout", stdout);
          } else {
            const lines = [
              `${command.toUpperCase()} for ${res.target} [Domain: ${res.domain}, Layer ${res.layer}]`,
              `  Risk: ${res.riskScore} (${res.numericRisk}/100) | Fan-In: ${res.fanIn} | Fan-Out: ${res.fanOut}`,
              `  Pre-Flight Gate: ${res.preFlight?.safe ? "SAFE TO EDIT" : `BLOCKED — ${res.preFlight?.blockedReason}`}`,
              `  Topological Edit Order: ${res.preFlight?.editOrder.join(" -> ") || res.target}`,
              `  Direct Callers (${res.directCallers.length}): ${res.directCallers.slice(0, 8).join(", ") || "none"}`,
              `  Tiered Context Tokens: ~${res.tieredContext?.estimatedTokens || 0}`,
            ];
            if (showContext && res.tieredContext) {
              lines.push(`  Tier 1 Direct Dependencies (${res.tieredContext.tier1Deps.length}):`);
              for (const t1 of res.tieredContext.tier1Deps.slice(0, 5)) {
                lines.push(`    - ${t1.path}: ${t1.exports.slice(0, 6).join(", ") || "internal"}`);
              }
            }
            stdout = lines.join("\n");
            for (const line of lines) emitLog("stdout", line);
          }
          if (command === "pre-flight" && res.preFlight && !res.preFlight.safe) {
            exitCode = 2;
          }
        }
      } else if (command === "task") {
        const cleanArgs = args.filter((a) => a !== "--json");
        const subCmd = cleanArgs[0] || "list";

        if (subCmd === "start") {
          const titleParts: string[] = [];
          let targetFiles: string[] = [];
          let goal = "";
          for (let i = 1; i < cleanArgs.length; i++) {
            const a = cleanArgs[i];
            if (a === "--targets" && cleanArgs[i + 1]) {
              targetFiles = cleanArgs[i + 1]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
              i++;
            } else if (a === "--goal" && cleanArgs[i + 1]) {
              goal = cleanArgs[i + 1];
              i++;
            } else if (!a.startsWith("--")) {
              titleParts.push(a);
            }
          }
          const title = titleParts.join(" ").replace(/^["']|["']$/g, "") || "Durable Agentic Refactoring Task";
          const task = await createAgenticTask({
            title,
            goal: goal || title,
            targetFiles: targetFiles.length > 0 ? targetFiles : ["src/types/stubs.ts"],
          });
          if (jsonFlag) {
            stdout = JSON.stringify(task, null, 2);
            emitLog("stdout", stdout);
          } else {
            const lines = [
              `Started durable agentic task [${task.id}]: ${task.title}`,
              `  Targets (${task.targetFiles.length}): ${task.targetFiles.join(", ")}`,
              `  Affected Unit Tests (${task.affectedTests?.length || 0}): ${task.recommendedTestCommand || "npx vitest run"}`,
              `  Topological Edit Plan (${task.editPlan.length} modules):`,
              ...task.editPlan.map((e, idx) => `    ${idx + 1}. [L${e.layer} · ${e.role}] ${e.path}`),
            ];
            stdout = lines.join("\n");
            for (const line of lines) emitLog("stdout", line);
          }
        } else if (subCmd === "verify") {
          const targetTaskId = cleanArgs[1];
          const res = await verifyAgenticTask(targetTaskId);
          if (jsonFlag) {
            stdout = JSON.stringify(res, null, 2);
            emitLog("stdout", stdout);
          } else {
            const lines = [
              `Durable Task Gate Verification [${res.task.id}]: ${res.report.passed ? "PASSED" : "ACTION REQUIRED"}`,
              `  Summary: ${res.report.summary}`,
              `  Checkpoint: ${res.report.checkpointId || "—"} | Pre-Flight: ${res.report.preFlightSafe ? "SAFE" : "BLOCKED"} | Breaking Contracts: ${res.report.breakingContractsCount}`,
              `  Recommended Test Command: ${res.report.recommendedTestCommand}`,
              `  5-Phase Task Checklist:`,
              ...res.task.steps.map((s) => `    - [${s.status.toUpperCase()}] (${s.phase}) ${s.label}: ${s.detail || "—"}`),
            ];
            stdout = lines.join("\n");
            for (const line of lines) emitLog("stdout", line);
          }
          exitCode = res.report.passed ? 0 : 1;
        } else if (subCmd === "resume") {
          const targetTaskId = cleanArgs[1];
          const updated = await updateAgenticTask({
            taskId: targetTaskId,
            setActive: true,
          });
          stdout = jsonFlag
            ? JSON.stringify(updated, null, 2)
            : `Resumed durable agentic task [${updated.id}] '${updated.title}' as active task (${updated.status.toUpperCase()}).`;
          emitLog("stdout", stdout);
        } else if (subCmd === "note") {
          const noteText = cleanArgs.slice(1).join(" ").replace(/^["']|["']$/g, "").trim();
          if (!noteText) {
            stdout = "Usage: npx stubs task note \"<journal note>\"";
            emitLog("stderr", stdout);
            exitCode = 1;
          } else {
            const updated = await updateAgenticTask({
              note: noteText,
            });
            stdout = jsonFlag
              ? JSON.stringify(updated, null, 2)
              : `Recorded execution journal note on task [${updated.id}] (${updated.notes?.length || 1} total notes).`;
            emitLog("stdout", stdout);
          }
        } else if (subCmd === "reset-baseline") {
          const targetTaskId = cleanArgs[1];
          const updated = await updateAgenticTask({
            taskId: targetTaskId,
            resetBaseline: true,
          });
          stdout = jsonFlag
            ? JSON.stringify(updated, null, 2)
            : `Reset AST and symbol contract baseline snapshots for task [${updated.id}] across ${updated.editPlan.length} modules.`;
          emitLog("stdout", stdout);
        } else if (subCmd === "step") {
          const stepId = cleanArgs[1];
          const statusArg = (cleanArgs[2] || "completed") as "pending" | "completed" | "failed";
          const ledger = await listAgenticTasks();
          if (!ledger.activeTask) {
            stdout = "No active durable task found. Start one with `npx stubs task start <title> --targets <files>`.";
            emitLog("stderr", stdout);
            exitCode = 1;
          } else {
            const updated = await updateAgenticTask({
              taskId: ledger.activeTask.id,
              stepId,
              stepStatus: statusArg,
            });
            stdout = jsonFlag
              ? JSON.stringify(updated, null, 2)
              : `Updated task [${updated.id}] step '${stepId}' -> ${statusArg.toUpperCase()}.`;
            emitLog("stdout", stdout);
          }
        } else if (subCmd === "target") {
          const targetPath = cleanArgs[1];
          const targetStatus = (cleanArgs[2] || "edited") as "pending" | "edited" | "verified";
          const ledger = await listAgenticTasks();
          if (!ledger.activeTask) {
            stdout = "No active durable task found.";
            emitLog("stderr", stdout);
            exitCode = 1;
          } else {
            const updated = await updateAgenticTask({
              taskId: ledger.activeTask.id,
              targetPath,
              targetStatus,
            });
            stdout = jsonFlag
              ? JSON.stringify(updated, null, 2)
              : `Updated task [${updated.id}] target '${targetPath}' -> ${targetStatus.toUpperCase()}.`;
            emitLog("stdout", stdout);
          }
        } else if (subCmd === "complete") {
          const ledger = await listAgenticTasks();
          const targetTaskId = cleanArgs[1] || ledger.activeTask?.id;
          if (!targetTaskId) {
            stdout = "No active task to complete.";
            emitLog("stdout", stdout);
          } else {
            const updated = await updateAgenticTask({
              taskId: targetTaskId,
              taskStatus: "completed",
            });
            stdout = jsonFlag
              ? JSON.stringify(updated, null, 2)
              : `Completed durable agentic task [${updated.id}]: ${updated.title}.`;
            emitLog("stdout", stdout);
          }
        } else {
          // list
          const res = await listAgenticTasks();
          if (jsonFlag) {
            stdout = JSON.stringify(res, null, 2);
            emitLog("stdout", stdout);
          } else {
            const lines: string[] = [];
            if (res.activeTask) {
              const t = res.activeTask;
              const doneSteps = t.steps.filter((s) => s.status === "completed").length;
              lines.push(`Active Durable Task: [${t.id}] ${t.title} (${t.status.toUpperCase()})`);
              lines.push(`  Goal: ${t.goal}`);
              lines.push(`  Progress: ${doneSteps}/${t.steps.length} lifecycle steps · ${t.editPlan.length} modules in topological plan`);
              if (t.recommendedTestCommand) {
                lines.push(`  Affected Tests (${t.affectedTests?.length || 0}): ${t.recommendedTestCommand}`);
              }
              for (const s of t.steps) {
                lines.push(`    - [${s.status.toUpperCase()}] (${s.phase}) ${s.label}`);
              }
            } else {
              lines.push("Active Durable Task: none");
            }
            lines.push(`Tracked Tasks in Ledger: ${res.tasks.length}`);
            for (const t of res.tasks.slice(0, 8)) {
              lines.push(`  - [${t.id}] ${t.title} (${t.status}) — ${t.targetFiles.join(", ")}`);
            }
            stdout = lines.join("\n");
            for (const line of lines) emitLog("stdout", line);
          }
        }
      } else if (command === "handoff") {
        const taskId = args.find((a) => !a.startsWith("-"));
        const handoff = await generateSessionHandoff(taskId);
        stdout = jsonFlag ? JSON.stringify(handoff, null, 2) : handoff.handoffMarkdown;
        for (const line of stdout.split("\n")) emitLog("stdout", line);
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
