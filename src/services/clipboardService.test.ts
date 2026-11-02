import { describe, it, expect, vi } from 'vitest';
import { BrowserClipboardService } from './clipboardService';
import { NoOpLogger } from '../utils/logger';

describe('BrowserClipboardService', () => {
    it('should successfully write text to clipboard', async () => {
        const mockWriteText = vi.fn().mockResolvedValue(undefined);
        const mockClipboard = { writeText: mockWriteText } as unknown as Clipboard;

        const mockPlatformService = {
            ...({} as unknown as import("./platformService").IPlatformService),
            getNavigator: () => ({ clipboard: mockClipboard }) as unknown as Navigator,
        };
        const service = new BrowserClipboardService(new NoOpLogger(), mockPlatformService);
        const result = await service.writeText('test text');

        expect(result).toBe(true);
        expect(mockWriteText).toHaveBeenCalledWith('test text');
    });

    it('should handle failure when writing to clipboard', async () => {
        const mockWriteText = vi.fn().mockRejectedValue(new Error('clipboard error'));
        const mockClipboard = { writeText: mockWriteText } as unknown as Clipboard;

        const mockPlatformService = {
            ...({} as unknown as import("./platformService").IPlatformService),
            getNavigator: () => ({ clipboard: mockClipboard }) as unknown as Navigator,
        };
        const service = new BrowserClipboardService(new NoOpLogger(), mockPlatformService);
        const result = await service.writeText('test text');

        expect(result).toBe(false);
    });

    it('should return false if clipboard is not available', async () => {
        const mockPlatformService = {
            ...({} as unknown as import("./platformService").IPlatformService),
            getNavigator: () => ({ clipboard: null }) as unknown as Navigator,
        };
        const service = new BrowserClipboardService(new NoOpLogger(), mockPlatformService);
        const result = await service.writeText('test text');

        expect(result).toBe(false);
    });
});
