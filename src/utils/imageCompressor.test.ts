import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateProportionalDimensions, ImageCompressor, CanvasImageCompressionStrategy, IImageCompressionStrategy } from './imageCompressor';
import { IPlatformService } from '../services/platformService';
import { MessageAttachment } from '../types';

describe('ImageCompressor Utils', () => {
    describe('calculateProportionalDimensions', () => {
        it('should not scale if within limits', () => {
            expect(calculateProportionalDimensions(800, 600, 1000)).toEqual({ width: 800, height: 600 });
        });

        it('should scale down wide images proportionally', () => {
            expect(calculateProportionalDimensions(2000, 1000, 1000)).toEqual({ width: 1000, height: 500 });
        });

        it('should scale down tall images proportionally', () => {
            expect(calculateProportionalDimensions(1000, 2000, 1000)).toEqual({ width: 500, height: 1000 });
        });
    });

    describe('ImageCompressor Configuration Injection', () => {
        it('should use provided strategy', async () => {
            const mockStrategy: IImageCompressionStrategy = {
                compress: vi.fn().mockResolvedValue({ id: 'test' } as MessageAttachment)
            };
            const compressor = new ImageCompressor({ strategy: mockStrategy });
            const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

            await compressor.compressImageForGemini(mockFile);
            expect(mockStrategy.compress).toHaveBeenCalledWith(mockFile, {});
        });

        it('should use default Canvas strategy if no strategy provided', () => {
            const compressor = new ImageCompressor();
            expect((compressor as unknown as { strategy: unknown }).strategy).toBeInstanceOf(CanvasImageCompressionStrategy);
        });
    });

    describe('CanvasImageCompressionStrategy', () => {
        let mockPlatformService: IPlatformService;

        beforeEach(() => {
            mockPlatformService = {
                getDocument: () => null, // Stub just enough for testing init
                createFileReader: () => null,
                createImage: () => null
            } as unknown as IPlatformService;
        });

        it('should handle missing document gracefully (returns unsupported for webp)', () => {
            const strategy = new CanvasImageCompressionStrategy({ platformService: mockPlatformService });
            expect(((strategy as CanvasImageCompressionStrategy) as unknown as { isWebPSupported: () => boolean }).isWebPSupported()).toBe(false);
        });

        it('should fail compression gracefully if FileReader is unavailable', async () => {
            const strategy = new CanvasImageCompressionStrategy({ platformService: mockPlatformService });
            const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

            await expect(strategy.compress(mockFile, {})).rejects.toThrow("FileReader is not available");
        });

        it('should fail compression gracefully if Image API is unavailable', async () => {
            const fileReaderMock = {
                readAsDataURL: vi.fn(function(this: FileReader) {
                    setTimeout(() => this.onload?.({ target: { result: 'data:image/png;base64,abc' } } as unknown as ProgressEvent<FileReader>), 0);
                })
            };

            mockPlatformService = {
                getDocument: () => null,
                createFileReader: () => (fileReaderMock as unknown as FileReader),
                createImage: () => null
            } as unknown as IPlatformService;

            const strategy = new CanvasImageCompressionStrategy({ platformService: mockPlatformService });
            const mockFile = new File(['test'], 'test.png', { type: 'image/png' });

            await expect(strategy.compress(mockFile, {})).rejects.toThrow("Image API is not available");
        });
    });
});
