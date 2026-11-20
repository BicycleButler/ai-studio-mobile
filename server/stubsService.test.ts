// @vitest-environment node
import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  computeTopologicalEditOrder,
  computeMultiTargetEditOrder,
  getBatchPreFlight,
  extractInterfaceStub,
  queryGraph,
  generateContextMaps,
  runStubsPipeline,
  createAgenticTask,
  updateAgenticTask,
  verifyAgenticTask,
  discoverAffectedTests,
  getGraphData,
  scanWorkspace,
  listAgenticTasks,
  generateSessionHandoff,
  closeStubsDatabase,
} from "./stubsService";
import { StubsNode, StubsEdge } from "../src/types/stubs";

const SAMPLE_NODES: StubsNode[] = [
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
    astHash: "1111aaaa",
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
    astHash: "2222bbbb",
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
    astHash: "3333cccc",
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
    astHash: "4444dddd",
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
    astHash: "5555eeee",
  },
];

const SAMPLE_EDGES: StubsEdge[] = [
  { source: "src/services/stubsService.ts", target: "src/types/stubs.ts", relationship: "imports", weight: 1 },
  { source: "src/services/stubsService.ts", target: "src/utils/apiClient.ts", relationship: "imports", weight: 1 },
  { source: "src/hooks/stubs/useStubsData.ts", target: "src/services/stubsService.ts", relationship: "imports", weight: 1 },
  { source: "src/components/StubsWorkspace.tsx", target: "src/hooks/stubs/useStubsData.ts", relationship: "imports", weight: 1 },
  { source: "src/components/StubsWorkspace.tsx", target: "src/services/stubsService.ts", relationship: "imports", weight: 1 },
];

describe("Durable Agentic Harness Engine (server/stubsService)", () => {
  afterAll(() => {
    closeStubsDatabase();
  });

  it("computeTopologicalEditOrder sorts prerequisite dependencies before target and callers after target", () => {
    const order = computeTopologicalEditOrder(
      "src/services/stubsService.ts",
      ["src/utils/apiClient.ts", "src/types/stubs.ts"],
      ["src/components/StubsWorkspace.tsx", "src/hooks/stubs/useStubsData.ts"],
      SAMPLE_NODES,
      SAMPLE_EDGES
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

  it("computeMultiTargetEditOrder produces a unified topological sequence across multiple targets", () => {
    const unifiedOrder = computeMultiTargetEditOrder(
      ["src/hooks/stubs/useStubsData.ts", "src/services/stubsService.ts"],
      SAMPLE_NODES,
      SAMPLE_EDGES
    );

    const idxTypes = unifiedOrder.indexOf("src/types/stubs.ts");
    const idxApi = unifiedOrder.indexOf("src/utils/apiClient.ts");
    const idxService = unifiedOrder.indexOf("src/services/stubsService.ts");
    const idxHook = unifiedOrder.indexOf("src/hooks/stubs/useStubsData.ts");
    const idxComp = unifiedOrder.indexOf("src/components/StubsWorkspace.tsx");

    expect(idxTypes).toBeGreaterThanOrEqual(0);
    expect(idxApi).toBeGreaterThanOrEqual(0);
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

  it("queryGraph supports map:, stub:, pkg:, explain:, path:, blast:, drift:, hubs:, and task: modes", async () => {
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

    const driftRes = await queryGraph("drift:");
    expect(driftRes.mode).toBe("drift");
    expect(Array.isArray(driftRes.driftResult?.changedModules)).toBe(true);

    const hubsRes = await queryGraph("hubs:");
    expect(hubsRes.mode).toBe("hubs");
    expect(hubsRes.hubsResult?.hubs.length || 0).toBeGreaterThanOrEqual(5);

    const taskRes = await queryGraph("task:");
    expect(taskRes.mode).toBe("task");
    expect(typeof taskRes.taskResult?.totalTasks).toBe("number");
  });

  it("getBatchPreFlight computes combined risk and unified topological edit sequence across real modules", async () => {
    const batch = await getBatchPreFlight([
      "src/services/stubsService.ts",
      "src/hooks/stubs/useStubsData.ts",
    ]);
    expect(batch.targets).toContain("src/services/stubsService.ts");
    expect(batch.targets).toContain("src/hooks/stubs/useStubsData.ts");
    expect(batch.unifiedEditOrder.length).toBeGreaterThanOrEqual(3);
    const serviceIdx = batch.unifiedEditOrder.indexOf("src/services/stubsService.ts");
    const hookIdx = batch.unifiedEditOrder.indexOf("src/hooks/stubs/useStubsData.ts");
    expect(serviceIdx).toBeLessThan(hookIdx);
  });

  it("manages durable agentic coding tasks and synthesizes a deterministic Session Handoff Packet", async () => {
    const ledgerPath = path.resolve(process.cwd(), ".stubs/harness-ledger.json");
    const backup = fs.existsSync(ledgerPath) ? fs.readFileSync(ledgerPath, "utf8") : null;

    try {
      const created = await createAgenticTask({
        title: "Verify Durable Agentic Harness Ledger",
        goal: "Ensure multi-target edit plan and session handoff work deterministically",
        targetFiles: ["src/types/stubs.ts", "src/services/stubsService.ts"],
      });
      expect(created.id.startsWith("task_")).toBe(true);
      expect(created.status).toBe("in_progress");
      expect(created.steps.length).toBe(5);
      expect(created.editPlan.length).toBeGreaterThanOrEqual(2);

      const updatedStep = await updateAgenticTask({
        taskId: created.id,
        stepId: "step_edit",
        stepStatus: "completed",
        targetPath: "src/types/stubs.ts",
        targetStatus: "edited",
        note: "Verified symbol contract parity across Layer 0 and Layer 2.",
      });
      expect(updatedStep.steps.find((s) => s.id === "step_edit")?.status).toBe("completed");
      expect(updatedStep.editPlan.find((e) => e.path === "src/types/stubs.ts")?.status).toBe("edited");
      expect(updatedStep.notes).toContain("Verified symbol contract parity across Layer 0 and Layer 2.");
      expect(Array.isArray(updatedStep.affectedTests)).toBe(true);
      expect(updatedStep.affectedTests).toContain("src/services/stubsService.test.ts");
      expect(updatedStep.recommendedTestCommand).toContain("npx vitest run");

      const resetTask = await updateAgenticTask({
        taskId: created.id,
        resetBaseline: true,
      });
      expect(resetTask.editPlan.every((i) => i.contractStatus === "intact")).toBe(true);

      const verified = await verifyAgenticTask(created.id);
      expect(verified.report.passed).toBe(true);
      expect(verified.report.breakingContractsCount).toBe(0);
      expect(verified.task.verificationReport?.passed).toBe(true);
      expect(verified.task.steps.every((s) => s.status === "completed")).toBe(true);

      const handoff = await generateSessionHandoff(created.id);
      expect(handoff.activeTask?.id).toBe(created.id);
      expect(handoff.handoffMarkdown).toContain("# Durable Agentic Session Handoff");
      expect(handoff.handoffMarkdown).toContain("Verify Durable Agentic Harness Ledger");
      expect(handoff.handoffMarkdown).toContain("Discovered Affected Unit Tests");
      expect(handoff.handoffMarkdown).toContain("Durable Execution Journal & Notes");
      expect(handoff.affectedTests).toContain("src/services/stubsService.test.ts");
      expect(handoff.nextRecommendedActions.length).toBeGreaterThan(0);

      const completed = await updateAgenticTask({
        taskId: created.id,
        taskStatus: "completed",
      });
      expect(completed.status).toBe("completed");

      const listAfter = await listAgenticTasks();
      expect(listAfter.activeTask).toBeUndefined();

      // Resume completed task and verify it becomes active again
      const resumed = await updateAgenticTask({
        taskId: created.id,
        setActive: true,
      });
      expect(resumed.status).toBe("in_progress");
      const listResumed = await listAgenticTasks();
      expect(listResumed.activeTask?.id).toBe(created.id);
    } finally {
      if (backup !== null) {
        fs.writeFileSync(ledgerPath, backup, "utf8");
      }
    }
  });

  it("resolves dynamic import(...) edges for React.lazy components and discovers affected unit test suites", async () => {
    await scanWorkspace(false);
    const graph = await getGraphData();

    const mobileIdeNode = graph.nodes.find((n) => n.id === "src/components/MobileIDEWorkspace.tsx");
    const settingsModalNode = graph.nodes.find((n) => n.id === "src/components/UnifiedSettingsModal.tsx");
    expect(mobileIdeNode?.fanIn).toBeGreaterThanOrEqual(1);
    expect(settingsModalNode?.fanIn).toBeGreaterThanOrEqual(1);

    const dynamicEdge = graph.edges.find(
      (e) => e.target === "src/components/MobileIDEWorkspace.tsx" && e.relationship === "dynamic-imports"
    );
    expect(dynamicEdge).toBeDefined();

    const discovered = discoverAffectedTests(
      ["src/services/stubsService.ts", "server/stubsService.ts"],
      graph.nodes,
      graph.edges
    );
    expect(discovered.directTests).toContain("src/services/stubsService.test.ts");
    expect(discovered.directTests).toContain("server/stubsService.test.ts");
    expect(discovered.recommendedCommand).toContain("npx vitest run");

    const testsQuery = await queryGraph("tests: src/services/stubsService.ts");
    expect(testsQuery.mode).toBe("tests");
    expect(testsQuery.testsResult?.directTests).toContain("src/services/stubsService.test.ts");
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
