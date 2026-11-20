// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  computeTopologicalEditOrder,
  extractInterfaceStub,
  queryGraph,
  generateContextMaps,
  runStubsPipeline,
  closeStubsDatabase,
} from "./stubsService";
import { StubsNode, StubsEdge } from "../src/types/stubs";

describe("Durable Agentic Harness Engine (server/stubsService)", () => {
  afterAll(() => {
    closeStubsDatabase();
  });

  it("computeTopologicalEditOrder sorts prerequisite dependencies before target and callers after target", () => {
    const nodes: StubsNode[] = [
      {
        id: "src/types/stubs.ts",
        filePath: "src/types/stubs.ts",
        entityType: "type",
        name: "stubs.ts",
        domain: "core",
        layer: 0,
        fanIn: 5,
        fanOut: 0,
        degree: 5,
        lineCount: 250,
      },
      {
        id: "src/utils/apiClient.ts",
        filePath: "src/utils/apiClient.ts",
        entityType: "utility",
        name: "apiClient.ts",
        domain: "utils",
        layer: 1,
        fanIn: 3,
        fanOut: 1,
        degree: 4,
        lineCount: 90,
      },
      {
        id: "src/services/stubsService.ts",
        filePath: "src/services/stubsService.ts",
        entityType: "service",
        name: "stubsService.ts",
        domain: "services",
        layer: 2,
        fanIn: 2,
        fanOut: 2,
        degree: 4,
        lineCount: 260,
      },
      {
        id: "src/hooks/stubs/useStubsData.ts",
        filePath: "src/hooks/stubs/useStubsData.ts",
        entityType: "hook",
        name: "useStubsData.ts",
        domain: "hooks",
        layer: 3,
        fanIn: 1,
        fanOut: 1,
        degree: 2,
        lineCount: 240,
      },
      {
        id: "src/components/StubsWorkspace.tsx",
        filePath: "src/components/StubsWorkspace.tsx",
        entityType: "component",
        name: "StubsWorkspace.tsx",
        domain: "components",
        layer: 4,
        fanIn: 1,
        fanOut: 1,
        degree: 2,
        lineCount: 460,
      },
    ];

    const edges: StubsEdge[] = [
      { source: "src/services/stubsService.ts", target: "src/types/stubs.ts", relationship: "imports", weight: 1 },
      { source: "src/services/stubsService.ts", target: "src/utils/apiClient.ts", relationship: "imports", weight: 1 },
      { source: "src/hooks/stubs/useStubsData.ts", target: "src/services/stubsService.ts", relationship: "imports", weight: 1 },
      { source: "src/components/StubsWorkspace.tsx", target: "src/hooks/stubs/useStubsData.ts", relationship: "imports", weight: 1 },
      { source: "src/components/StubsWorkspace.tsx", target: "src/services/stubsService.ts", relationship: "imports", weight: 1 },
    ];

    const order = computeTopologicalEditOrder(
      "src/services/stubsService.ts",
      ["src/utils/apiClient.ts", "src/types/stubs.ts"],
      ["src/components/StubsWorkspace.tsx", "src/hooks/stubs/useStubsData.ts"],
      nodes,
      edges
    );

    const idxTypes = order.indexOf("src/types/stubs.ts");
    const idxApi = order.indexOf("src/utils/apiClient.ts");
    const idxService = order.indexOf("src/services/stubsService.ts");
    const idxHook = order.indexOf("src/hooks/stubs/useStubsData.ts");
    const idxComp = order.indexOf("src/components/StubsWorkspace.tsx");

    expect(idxTypes).toBeLessThan(idxService);
    expect(idxApi).toBeLessThan(idxService);
    expect(idxService).toBeLessThan(idxHook);
    expect(idxHook).toBeLessThan(idxComp);
  });

  it("extractInterfaceStub extracts exported signatures with line links and >40% token savings", async () => {
    const stub = await extractInterfaceStub("src/services/stubsService.ts");
    expect(stub.path).toBe("src/services/stubsService.ts");
    expect(stub.domain).toBe("services");
    expect(stub.layer).toBe(2);
    expect(stub.symbols.length).toBeGreaterThanOrEqual(4);
    expect(stub.skeletonCode).toContain("interface IStubsClient");
    expect(stub.skeletonCode).toContain("class StubsClient");
    expect(/\/\/ L\d+/.test(stub.skeletonCode)).toBe(true);
    expect(stub.tokenSavingsPct).toBeGreaterThanOrEqual(40);
  });

  it("queryGraph supports map:, stub:, pkg:, explain:, path:, and blast: modes", async () => {
    const mapRes = await queryGraph("map:");
    expect(mapRes.mode).toBe("map");
    expect(mapRes.mapResult?.domains.length || 0).toBeGreaterThanOrEqual(5);

    const stubRes = await queryGraph("stub: StubsClient");
    expect(stubRes.mode).toBe("stub");
    expect(stubRes.stubResult?.path).toBe("src/services/stubsService.ts");

    const pkgRes = await queryGraph("pkg:react");
    expect(pkgRes.mode).toBe("pkg");
    expect(pkgRes.pkgResult?.consumerCount || 0).toBeGreaterThan(10);

    const pathRes = await queryGraph("path: App.tsx to stubs.ts");
    expect(pathRes.mode).toBe("path");
    expect(pathRes.pathResult?.found).toBe(true);

    const blastRes = await queryGraph("blast: src/types/stubs.ts");
    expect(blastRes.mode).toBe("blast");
    expect(blastRes.blastResult?.preFlight?.editOrder.length || 0).toBeGreaterThan(1);
  });

  it("generateContextMaps refreshes domain context maps without stale phantom files", async () => {
    const gen = await generateContextMaps();
    expect(gen.updatedFiles).toContain("knowledge/architecture/context-map.md");
    expect(gen.updatedFiles).toContain("knowledge/architecture/domains/services-domain-map.md");

    const servicesMap = fs.readFileSync(
      path.resolve(process.cwd(), "knowledge/architecture/domains/services-domain-map.md"),
      "utf8"
    );
    expect(servicesMap.includes("julesService.ts")).toBe(false);
    expect(servicesMap.includes("src/services/stubsService.ts")).toBe(true);
  });

  it("runStubsPipeline executes all 5 stages and records a durable checkpoint in .stubs/harness-ledger.json", async () => {
    const res = await runStubsPipeline(false);
    expect(res.steps.length).toBe(5);
    expect(res.lintErrors).toBe(0);
    expect(res.designViolations).toBe(0);
    expect(Boolean(res.checkpointId && res.checkpointId.startsWith("chk_"))).toBe(true);

    const ledgerPath = path.resolve(process.cwd(), ".stubs/harness-ledger.json");
    expect(fs.existsSync(ledgerPath)).toBe(true);
  });
});
