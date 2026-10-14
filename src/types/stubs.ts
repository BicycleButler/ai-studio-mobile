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
  nodes: StubsNode[];
  edges: StubsEdge[];
  summary: {
    totalFiles: number;
    totalEdges: number;
    totalSymbols: number;
    cyclesCount: number;
    domains: Record<string, number>;
    layers: Record<number, number>;
  };
}

export interface StubsLintViolation {
  rule: string;
  severity: "error" | "warning";
  message: string;
  source?: string;
  target?: string;
  cycle?: string[];
}

export interface StubsImpactResult {
  target: string;
  domain: string;
  layer: number;
  fanIn: number;
  fanOut: number;
  riskScore: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  numericRisk: number; // 0-100
  directCallers: string[];
  transitiveCallers?: string[];
  dependencies: string[];
}

export interface StubsSidecarSpec {
  path: string;
  filename: string;
  title: string;
  type: string;
  status: string;
  targetCodeFile?: string;
  targetExists?: boolean;
  domain?: string;
  layer?: number;
  content?: string;
}
