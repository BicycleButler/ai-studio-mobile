export interface StubsNode {
  id: string;
  filePath: string;
  entityType: string;
  name: string;
  domain: string;
  layer: number;
  fanIn: number;
  fanOut: number;
  degree: number;
  astHash?: string;
  lineCount: number;
  exportsJson?: string;
  hasSidecar?: boolean;
  sidecarPath?: string;
  phase?: string;
  statusFlag?: string;
}

export interface StubsEdge {
  id?: number;
  source: string;
  target: string;
  relationship: string;
  weight: number;
}

export interface StubsGraphData {
  projectName: string;
  version: string;
  autonomyLevel?: string;
  cliAvailable?: boolean;
  nodes: StubsNode[];
  edges: StubsEdge[];
  summary: {
    totalFiles: number;
    totalEdges: number;
    totalSymbols: number;
    cyclesCount: number;
    sidecarsCount?: number;
    planningDocsCount?: number;
    domains: Record<string, number>;
    layers: Record<number, number>;
    lastScannedAt?: number;
  };
}

export type StubsQueryMode = "explain" | "path" | "blast" | "map" | "search";

export interface StubsQueryMatch {
  node: StubsNode;
  score: number;
  reason: string;
  exports: string[];
}

export interface StubsQueryResult {
  mode: StubsQueryMode;
  query: string;
  summary: string;
  estimatedTokens?: number;
  matches?: StubsQueryMatch[];
  explain?: {
    node: StubsNode;
    exports: string[];
    callers: string[];
    callees: string[];
    community: string;
    sidecarPath?: string;
  };
  pathResult?: {
    from: string;
    to: string;
    found: boolean;
    paths: string[][];
    hops: number;
  };
  blastResult?: StubsImpactResult;
  mapResult?: {
    domains: Array<{
      domain: string;
      nodeCount: number;
      hubFile?: string;
      avgLayer: number;
    }>;
  };
}

export interface StubsLintViolation {
  rule:
    | "LAYER_VIOLATION"
    | "CIRCULAR_DEPENDENCY"
    | "UNMANIFESTED_DEPENDENCY"
    | "DOMAIN_LEAK"
    | string;
  severity: "error" | "warning";
  message: string;
  source?: string;
  target?: string;
  cycle?: string[];
}

export interface StubsPruneIssue {
  type: "PHANTOM_SIDECAR" | "UNTRACKED_CODE" | "ZOMBIE_EXPORT" | "STALE_DB_NODE";
  severity: "error" | "warning" | "info";
  path: string;
  symbol?: string;
  message: string;
}

export interface StubsPruneResult {
  issues: StubsPruneIssue[];
  summary: {
    phantomSidecars: number;
    untrackedCode: number;
    zombieExports: number;
    staleDbNodes: number;
  };
  durationMs: number;
}

export interface StubsTieredContext {
  target: string;
  estimatedTokens: number;
  tier0: {
    path: string;
    sidecarPath?: string;
    lineCount: number;
    exports: string[];
  };
  tier1Deps: Array<{
    path: string;
    domain: string;
    layer: number;
    exports: string[];
  }>;
  tier1Callers: Array<{
    path: string;
    domain: string;
    layer: number;
  }>;
  tier2Boundary: string[];
  briefingMarkdown: string;
}

export interface StubsImpactResult {
  target: string;
  domain: string;
  layer: number;
  fanIn: number;
  fanOut: number;
  riskScore: "LOW" | "MEDIUM" | "MODERATE" | "HIGH" | "CRITICAL";
  numericRisk: number; // 0-100
  directCallers: string[];
  transitiveCallers?: string[];
  dependencies: string[];
  domainBoundariesCrossed?: string[];
  staleSidecarsAtRisk?: string[];
  preFlight?: {
    safe: boolean;
    guardThreshold: string;
    autonomyLevel: string;
    blockedReason?: string;
    editOrder: string[];
  };
  tieredContext?: StubsTieredContext;
}

export type StubsSpecCategory = "sidecar" | "planning" | "context-map" | "adr" | "concept";
export type StubsDriftStatus = "clean" | "drifted" | "unmaterialized" | "doc-only";

export interface StubsSidecarSpec {
  path: string;
  filename: string;
  title: string;
  type: string;
  category: StubsSpecCategory;
  status: string;
  statusFlag?: string;
  phase?: string;
  driftStatus?: StubsDriftStatus;
  checklistProgress?: {
    completed: number;
    total: number;
  };
  dependsOn?: string[];
  targetCodeFile?: string;
  targetExists?: boolean;
  domain?: string;
  layer?: number;
  content?: string;
}

export interface StubsRunStep {
  name: string;
  status: "pass" | "warn" | "fail";
  detail: string;
  durationMs: number;
}

export interface StubsRunResult {
  passed: boolean;
  scannedFiles: number;
  edgesCount: number;
  lintErrors: number;
  lintWarnings: number;
  pruneIssues: number;
  driftedSidecars: number;
  contextMapsCount: number;
  durationMs: number;
  steps: StubsRunStep[];
}

export type StubsDiagramType = "architecture" | "sequence" | "slice";
export type StubsDiagramGroupBy = "domain" | "layer";

export type StubsCommandName =
  | "run"
  | "scan"
  | "lint-arch"
  | "diagram"
  | "impact"
  | "sand"
  | "query"
  | "pre-flight"
  | "prune"
  | "phase"
  | "context"
  | "map";

export interface StubsWorkspaceFileContent {
  path: string;
  name: string;
  language: string;
  content: string;
  lineCount: number;
}

export interface WorkspaceTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  language?: string;
  isBinary?: boolean;
  children?: WorkspaceTreeNode[];
}

export interface WorkspaceFileTreeResponse {
  rootName: string;
  tree: WorkspaceTreeNode[];
  totalFiles: number;
  totalDirectories: number;
}

