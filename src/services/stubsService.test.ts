import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StubsClient } from './stubsService';
import { IApiClient } from '../utils/apiClient';

describe('StubsClient', () => {
    let mockApiClient: import("vitest").Mocked<IApiClient>;
    let client: StubsClient;

    beforeEach(() => {
        mockApiClient = {
            fetch: vi.fn(),
        } as unknown as import("vitest").Mocked<IApiClient>;
        client = new StubsClient({ apiClient: mockApiClient });
    });

    it('should call fetchGraphData correctly', async () => {
        const mockData = { nodes: [], edges: [] };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.fetchGraphData();

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/graph',
            undefined,
            'Failed to fetch Stubs graph data'
        );
        expect(result).toEqual(mockData);
    });

    it('should call fetchDiagram with default param', async () => {
        const mockData = { mermaid: 'test', edgeCount: 1, nodeCount: 1 };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.fetchDiagram();

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/diagram?groupBy=domain',
            undefined,
            'Failed to fetch Stubs diagram'
        );
        expect(result).toEqual(mockData);
    });

    it('should call fetchDiagram with specific param', async () => {
        const mockData = { mermaid: 'test', edgeCount: 1, nodeCount: 1 };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.fetchDiagram('layer');

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/diagram?groupBy=layer',
            undefined,
            'Failed to fetch Stubs diagram'
        );
        expect(result).toEqual(mockData);
    });

    it('should call fetchImpact correctly', async () => {
        const mockData = { target: 'test', paths: [] };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.fetchImpact('test_target');

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/impact?target=test_target',
            undefined,
            'Failed to fetch impact analysis'
        );
        expect(result).toEqual(mockData);
    });

    it('should call fetchLintResults correctly', async () => {
        const mockData = { violations: [], passed: true, totalChecks: 0 };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.fetchLintResults();

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/lint',
            undefined,
            'Failed to fetch architecture lint results'
        );
        expect(result).toEqual(mockData);
    });

    it('should call fetchSidecarSpecs correctly', async () => {
        const mockData = { specs: [] };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.fetchSidecarSpecs();

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/specs',
            undefined,
            'Failed to list sidecar specs'
        );
        expect(result).toEqual(mockData);
    });

    it('should call executeStubsCommand correctly', async () => {
        const mockData = { exitCode: 0, stdout: 'ok', stderr: '' };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.executeStubsCommand('scan', ['--fast']);

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/execute',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: 'scan', args: ['--fast'] }),
            },
            'Failed to execute stubs scan'
        );
        expect(result).toEqual(mockData);
    });

    it('should call queryGraph correctly', async () => {
        const mockData = { mode: 'map', query: 'map:', summary: 'ok' };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.queryGraph('explain: StubsClient', 1200);

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/query?q=explain%3A%20StubsClient&budget=1200',
            undefined,
            'Failed to execute GraphRAG query'
        );
        expect(result).toEqual(mockData);
    });

    it('should call runPipeline correctly', async () => {
        const mockData = { passed: true, scannedFiles: 10 };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.runPipeline();

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/run',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            },
            'Failed to run Stubs pipeline'
        );
        expect(result).toEqual(mockData);
    });

    it('should call sandSpec correctly', async () => {
        const mockData = { success: true, message: 'Sanded', result: { path: 'a.ts.md', targetFile: 'a.ts', astHash: 'abc' } };
        mockApiClient.fetch.mockResolvedValueOnce(mockData);

        const result = await client.sandSpec('src/services/a.ts.md');

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/spec-sand',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path: 'src/services/a.ts.md' }),
            },
            'Failed to sand spec'
        );
        expect(result).toEqual(mockData);
    });

    it('should call fetchWorkspaceFileTree correctly', async () => {
        const mockTree = {
            rootName: 'react-example',
            tree: [
                {
                    name: 'src',
                    path: 'src',
                    type: 'directory' as const,
                    children: [
                        { name: 'App.tsx', path: 'src/App.tsx', type: 'file' as const, language: 'tsx' }
                    ]
                }
            ],
            totalFiles: 1,
            totalDirectories: 1,
        };
        mockApiClient.fetch.mockResolvedValueOnce(mockTree);

        const result = await client.fetchWorkspaceFileTree();

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/tree',
            undefined,
            'Failed to load workspace file tree'
        );
        expect(result).toEqual(mockTree);
    });

    it('should call fetchWorkspaceFile correctly', async () => {
        const mockFile = {
            path: 'src/components/StubsWorkspace.tsx',
            name: 'StubsWorkspace.tsx',
            language: 'tsx',
            content: 'export const StubsWorkspace = () => null;',
            lineCount: 1,
        };
        mockApiClient.fetch.mockResolvedValueOnce(mockFile);

        const result = await client.fetchWorkspaceFile('src/components/StubsWorkspace.tsx');

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/file?path=src%2Fcomponents%2FStubsWorkspace.tsx',
            undefined,
            'Failed to open workspace file'
        );
        expect(result).toEqual(mockFile);
    });

    it('should call fetchInterfaceStub correctly', async () => {
        const mockStub = {
            path: 'src/services/stubsService.ts',
            domain: 'services',
            layer: 2,
            lineCount: 258,
            fullTokens: 2400,
            stubTokens: 420,
            tokenSavingsPct: 83,
            skeletonCode: '// Level 1 Interface Skeleton',
            symbols: [],
        };
        mockApiClient.fetch.mockResolvedValueOnce(mockStub);

        const result = await client.fetchInterfaceStub('src/services/stubsService.ts');

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/stub?target=src%2Fservices%2FstubsService.ts',
            undefined,
            'Failed to extract Level 1 Interface Skeleton Stub'
        );
        expect(result).toEqual(mockStub);
    });

    it('should call syncContextMaps correctly', async () => {
        const mockSync = {
            updatedFiles: ['knowledge/architecture/context-map.md'],
            totalModules: 140,
        };
        mockApiClient.fetch.mockResolvedValueOnce(mockSync);

        const result = await client.syncContextMaps();

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/map',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            },
            'Failed to synchronize architecture context maps'
        );
        expect(result).toEqual(mockSync);
    });

    it('should call runBatchPreFlight correctly', async () => {
        const mockBatch = {
            targets: ['src/types.ts', 'src/App.tsx'],
            safe: true,
            overallRiskScore: 'MEDIUM' as const,
            maxNumericRisk: 35,
            guardThreshold: 'high' as const,
            autonomyLevel: 'act_with_gate' as const,
            blockedReasons: [],
            unifiedEditOrder: ['src/types.ts', 'src/App.tsx'],
            directCallersUnion: [],
            dependenciesUnion: [],
            domainBoundariesCrossed: [],
            estimatedTotalTokens: 420,
        };
        mockApiClient.fetch.mockResolvedValueOnce(mockBatch);

        const result = await client.runBatchPreFlight(['src/types.ts', 'src/App.tsx'], 'high');

        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/pre-flight-batch',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ targets: ['src/types.ts', 'src/App.tsx'], guard: 'high' }),
            },
            'Failed to compute multi-target batch pre-flight'
        );
        expect(result).toEqual(mockBatch);
    });

    it('should call createTask, updateTask, and fetchSessionHandoff correctly', async () => {
        const mockTask = {
            id: 'task_1',
            title: 'Test Durable Task',
            goal: 'Verify durable ledger',
            status: 'in_progress' as const,
            createdAt: 100,
            updatedAt: 100,
            autonomyLevel: 'act_with_gate' as const,
            guardThreshold: 'high' as const,
            targetFiles: ['src/types.ts'],
            editPlan: [],
            steps: [],
            notes: [],
        };
        mockApiClient.fetch.mockResolvedValueOnce({ task: mockTask });

        const created = await client.createTask({
            title: 'Test Durable Task',
            goal: 'Verify durable ledger',
            targetFiles: ['src/types.ts'],
        });
        expect(created.task.id).toBe('task_1');

        mockApiClient.fetch.mockResolvedValueOnce({ task: { ...mockTask, status: 'completed' } });
        const updated = await client.updateTask({ taskId: 'task_1', taskStatus: 'completed' });
        expect(updated.task.status).toBe('completed');

        const mockHandoff = {
            generatedAt: 200,
            projectName: 'ai-studio-mobile',
            activeTask: mockTask,
            changedModules: [],
            driftedSidecars: [],
            nextRecommendedActions: ['Run npx stubs run'],
            handoffMarkdown: '# Handoff',
        };
        mockApiClient.fetch.mockResolvedValueOnce(mockHandoff);
        const handoff = await client.fetchSessionHandoff('task_1');
        expect(handoff.handoffMarkdown).toBe('# Handoff');

        const mockVerify = {
            task: mockTask,
            report: {
                verifiedAt: 300,
                passed: true,
                preFlightSafe: true,
                lintErrors: 0,
                lintWarnings: 0,
                driftedSidecars: 0,
                designViolations: 0,
                driftedTargetsCount: 1,
                breakingContractsCount: 0,
                affectedTests: ['src/services/stubsService.test.ts'],
                recommendedTestCommand: 'npx vitest run src/services/stubsService.test.ts',
                summary: 'All 5 durable task gates verified.',
            },
            pipeline: {
                passed: true,
                scannedFiles: 120,
                edgesCount: 300,
                lintErrors: 0,
                lintWarnings: 0,
                pruneIssues: 0,
                driftedSidecars: 0,
                contextMapsCount: 7,
                designViolations: 0,
                durationMs: 45,
                steps: [],
            },
        };
        mockApiClient.fetch.mockResolvedValueOnce(mockVerify);
        const verified = await client.verifyTask('task_1');
        expect(mockApiClient.fetch).toHaveBeenCalledWith(
            '/api/stubs/tasks/verify',
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId: 'task_1' }),
            },
            'Failed to verify durable agentic task gates'
        );
        expect(verified.report.passed).toBe(true);
    });
});

describe('StubsClient Stream Config', () => {
    it('handles undefined EventSource environment gracefully via createEventSource', () => {
        const mockApiClient = {
            fetch: vi.fn(),
        } as unknown as import("vitest").Mocked<import("../utils/apiClient").IApiClient>;

        const mockLogger = {
            debug: vi.fn(),
            info: vi.fn(),
            warn: vi.fn(),
            error: vi.fn(),
        } as import("vitest").Mocked<import("../utils/logger").ILogger>;

        const client = new StubsClient({
            apiClient: mockApiClient,
            logger: mockLogger,
            createEventSource: () => undefined
        });

        const onLog = vi.fn();
        const cleanup = client.connectStubsStream(onLog, '/test');

        expect(mockLogger.warn).toHaveBeenCalledWith(
            "[stubs stream] EventSource is not supported in this environment"
        );

        // must return a callable cleanup function
        expect(typeof cleanup).toBe('function');

        // executing cleanup must not crash
        cleanup();
    });
});
