import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StubsClient } from './stubsService';
import { IApiClient } from '../utils/apiClient';

describe('StubsClient', () => {
    let mockApiClient: import("vitest").Mocked<IApiClient>;
    let client: StubsClient;

    beforeEach(() => {
        mockApiClient = {
            fetch: vi.fn(),
        } as any as import("vitest").Mocked<IApiClient>;
        client = new StubsClient(mockApiClient);
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
});
