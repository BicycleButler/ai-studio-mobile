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
