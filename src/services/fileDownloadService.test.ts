import { describe, it, expect } from 'vitest';
import { BrowserFileDownloadService } from './fileDownloadService';
import { NoOpLogger } from '../utils/logger';

import { defaultPlatformService } from './platformService';

describe('BrowserFileDownloadService', () => {
    it('should return false if document is not available', async () => {
        const mockPlatformService = {
            ...defaultPlatformService,
            getDocument: () => null
        };
        const service = new BrowserFileDownloadService(new NoOpLogger(), mockPlatformService as any);
        const result = await service.downloadText('test.txt', 'content');

        expect(result).toBe(false);
    });
});
