import { describe, it, expect } from 'vitest';
import { BrowserFileDownloadService } from './fileDownloadService';
import { NoOpLogger } from '../utils/logger';

import { BrowserPlatformService } from '../services/platformService';

describe('BrowserFileDownloadService', () => {
    it('should return false if document is not available', async () => {
        const mockPlatformService = {
            ...new BrowserPlatformService(),
            getDocument: () => null
        };
        const service = new BrowserFileDownloadService(new NoOpLogger(), {
            ...({} as unknown as import("./IPlatformService").IPlatformService),
            ...mockPlatformService,
        });
        const result = await service.downloadText('test.txt', 'content');

        expect(result).toBe(false);
    });
});
