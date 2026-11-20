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

export interface StubsInterfaceSymbol {
  name: string;
  kind: "interface" | "type" | "class" | "function" | "enum" | "const";
  lineStart: number;
  lineEnd: number;
  signature: string;
  exported: boolean;
}

export interface StubsInterfaceStub {
  path: string;
  domain: string;
  layer: number;
  lineCount: number;
  fullTokens: number;
  stubTokens: number;
  tokenSavingsPct: number;
  skeletonCode: string;
  symbols: StubsInterfaceSymbol[];
}

export interface StubsHarnessCheckpoint {
  id: string;
  timestamp: number;
  passed: boolean;
  scannedFiles: number;
  edgesCount: number;
  lintErrors: number;
  lintWarnings: number;
  pruneIssues: number;
  designViolations: number;
  contextMapsSynced: number;
  durationMs: number;
  changedModulesCount?: number;
  changedModules?: string[];
  activeTaskId?: string;
}

export type StubsTaskStatus = "planning" | "in_progress" | "verifying" | "completed" | "blocked";

export type StubsContractStatus = "intact" | "expanded" | "breaking";

export interface StubsTaskTargetItem {
  path: string;
  domain: string;
  layer: number;
  orderIndex: number;
  role: "target" | "dependency" | "caller";
  riskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  baselineAstHash?: string;
  currentAstHash?: string;
  driftedSinceBaseline: boolean;
  baselineExports?: string[];
  currentExports?: string[];
  addedExports?: string[];
  removedExports?: string[];
  contractStatus?: StubsContractStatus;
  hasSidecar?: boolean;
  sidecarDrifted?: boolean;
  status: "pending" | "edited" | "verified";
}

export interface StubsTaskStep {
  id: string;
  phase: "pre-flight" | "edit" | "test" | "sanding" | "verification";
  label: string;
  status: "pending" | "completed" | "failed";
  detail?: string;
  updatedAt?: number;
}

export interface StubsTaskVerificationReport {
  verifiedAt: number;
  passed: boolean;
  checkpointId?: string;
  preFlightSafe: boolean;
  lintErrors: number;
  lintWarnings: number;
  driftedSidecars: number;
  designViolations: number;
  driftedTargetsCount: number;
  breakingContractsCount: number;
  affectedTests: string[];
  recommendedTestCommand: string;
  summary: string;
}

export interface StubsAgenticTask {
  id: string;
  title: string;
  goal: string;
  status: StubsTaskStatus;
  createdAt: number;
  updatedAt: number;
  autonomyLevel: string;
  guardThreshold: "low" | "medium" | "high" | "critical";
  targetFiles: string[];
  editPlan: StubsTaskTargetItem[];
  steps: StubsTaskStep[];
  baselineCheckpointId?: string;
  latestCheckpointId?: string;
  baselineAstSnapshots?: Record<string, string>;
  baselineExportsSnapshots?: Record<string, string[]>;
  affectedTests?: string[];
  recommendedTestCommand?: string;
  verificationReport?: StubsTaskVerificationReport;
  notes?: string[];
}

export interface StubsBatchPreFlightResult {
  targets: string[];
  safe: boolean;
  overallRiskScore: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  maxNumericRisk: number;
  guardThreshold: "low" | "medium" | "high" | "critical";
  autonomyLevel: string;
  blockedReasons: string[];
  unifiedEditOrder: string[];
  directCallersUnion: string[];
  dependenciesUnion: string[];
  domainBoundariesCrossed: string[];
  estimatedTotalTokens: number;
  affectedTests?: string[];
  recommendedTestCommand?: string;
}

export interface StubsSessionHandoff {
  generatedAt: number;
  projectName: string;
  activeTask?: StubsAgenticTask;
  lastCheckpoint?: StubsHarnessCheckpoint;
  previousCheckpoint?: StubsHarnessCheckpoint;
  changedModules: Array<{
    path: string;
    domain: string;
    layer: number;
    previousHash?: string;
    currentHash?: string;
    status: "modified" | "added" | "drifted-sidecar";
  }>;
  driftedSidecars: string[];
  affectedTests?: string[];
  recommendedTestCommand?: string;
  contractAlerts?: string[];
  nextRecommendedActions: string[];
  handoffMarkdown: string;
}

export interface StubsGraphData {
  projectName: string;
  version: string;
  autonomyLevel?: string;
  cliAvailable?: boolean;
  lastCheckpoint?: StubsHarnessCheckpoint;
  checkpoints?: StubsHarnessCheckpoint[];
  activeTask?: StubsAgenticTask;
  tasks?: StubsAgenticTask[];
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

export type StubsQueryMode =
  | "explain"
  | "path"
  | "blast"
  | "map"
  | "stub"
  | "pkg"
  | "drift"
  | "hubs"
  | "task"
  | "tests"
  | "search";

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
  stubResult?: StubsInterfaceStub;
  pkgResult?: {
    packageName: string;
    consumerCount: number;
    consumers: Array<{
      id: string;
      domain: string;
      layer: number;
      fanIn: number;
      exportsCount: number;
    }>;
  };
  driftResult?: {
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
  };
  hubsResult?: {
    hubs: Array<{
      id: string;
      domain: string;
      layer: number;
      fanIn: number;
      fanOut: number;
      degree: number;
      exports: string[];
    }>;
  };
  taskResult?: {
    activeTask?: StubsAgenticTask;
    totalTasks: number;
  };
  testsResult?: {
    targets: string[];
    directTests: string[];
    callerTests: string[];
    allTests: string[];
    recommendedCommand: string;
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
  interfaceStub?: StubsInterfaceStub;
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
  designViolations?: number;
  changedModulesCount?: number;
  changedModules?: string[];
  activeTaskId?: string;
  checkpointId?: string;
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
  | "map"
  | "harness"
  | "task"
  | "handoff";

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

