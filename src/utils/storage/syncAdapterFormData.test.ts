import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FormDataSyncTransport } from './syncAdapterFormData';
import { IApiClient } from '../apiClient';

describe('FormDataSyncTransport', () => {
    let mockApiClient: import("vitest").Mocked<IApiClient>;

    beforeEach(() => {
        mockApiClient = {
            ...({} as unknown as import("vitest").Mocked<IApiClient>),
            fetch: vi.fn().mockResolvedValue({ ok: true }),
        } as unknown as import("vitest").Mocked<IApiClient>;
    });

    it('should build request using the injected form data builder', async () => {
        const formDataBuilder = (item: { file: string, type: string }) => {
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('type', item.type);
            return formData;
        };

        const transport = new FormDataSyncTransport(mockApiClient, formDataBuilder);
        await transport.transmit('/api/upload', { file: 'test.png', type: 'image' }, 'POST');

        expect(mockApiClient.fetch).toHaveBeenCalledWith('/api/upload', expect.objectContaining({
            method: 'POST',
            body: expect.any(FormData)
        }));
    });
});
