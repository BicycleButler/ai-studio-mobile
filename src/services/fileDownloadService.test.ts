import { describe, it, expect, vi } from 'vitest';
import { BrowserFileDownloadService } from './fileDownloadService';
import { NoOpLogger } from '../utils/logger';

describe('BrowserFileDownloadService', () => {
    it('should return false if document is not available', async () => {
        const service = new BrowserFileDownloadService(new NoOpLogger(), () => null);
        const result = await service.downloadText('test.txt', 'content');

        expect(result).toBe(false);
    });
});
