import { describe, it, expect, vi } from 'vitest';
import { DefaultLoggerFactory, NoOpLoggerFactory } from './logger';

describe('ConsoleLogger (via DefaultLoggerFactory)', () => {
    it('should delegate to console methods', () => {
        const logger = new DefaultLoggerFactory().createLogger();

        const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
        const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        logger.debug('debug msg', 1);
        logger.info('info msg', 2);
        logger.warn('warn msg', 3);
        logger.error('error msg', 4);

        expect(debugSpy).toHaveBeenCalledWith('debug msg', 1);
        expect(infoSpy).toHaveBeenCalledWith('info msg', 2);
        expect(warnSpy).toHaveBeenCalledWith('warn msg', 3);
        expect(errorSpy).toHaveBeenCalledWith('error msg', 4);

        debugSpy.mockRestore();
        infoSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });
});

describe('NoOpLogger (via NoOpLoggerFactory)', () => {
    it('should not throw errors', () => {
        const logger = new NoOpLoggerFactory().createLogger();
        expect(() => {
            logger.debug('debug');
            logger.info('info');
            logger.warn('warn');
            logger.error('error');
        }).not.toThrow();
    });
});
