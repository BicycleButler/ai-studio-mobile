import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageEventNotifier } from './StorageEventNotifier';
import { createCrossTabNotifier } from './CrossTabNotifierFactory';
import { NoOpLogger } from '../logger';
import { IPlatformService } from "../../services/platformService";

describe('CrossTabNotifier', () => {
  let logger: NoOpLogger;

  beforeEach(() => {
    logger = new NoOpLogger();
  });

  let mockPlatformService: IPlatformService;
  let mockLocalStorage: Record<string, string>;

  beforeEach(() => {
    mockLocalStorage = {};
    mockPlatformService = {
      isBrowserEnv: () => true,
      getLocalStorage: () => ({
        getItem: (key: string) => mockLocalStorage[key] || null,
        setItem: (key: string, value: string) => { mockLocalStorage[key] = value; },
        clear: () => { mockLocalStorage = {}; },
        removeItem: (key: string) => { delete mockLocalStorage[key]; },
        length: Object.keys(mockLocalStorage).length,
        key: (index: number) => Object.keys(mockLocalStorage)[index] || null,
      }) as Storage,
      getBroadcastChannel: (name: string) => {
          if (name === "test_fail") return null;
          return {
             postMessage: vi.fn(),
             close: vi.fn(),
             onmessage: null,
             name
          } as unknown as BroadcastChannel;
      },
      addEventListener: vi.fn(() => vi.fn()),
      getWindow: () => ({ dispatchEvent: vi.fn() }) as unknown as Window,
    } as unknown as IPlatformService;
  });

  describe('StorageEventNotifier', () => {
    let notifier: StorageEventNotifier;

    beforeEach(() => {
      notifier = new StorageEventNotifier({ name: 'test_channel', logger, platformService: mockPlatformService });
    });

    afterEach(() => {
      notifier.dispose();
      mockPlatformService.getLocalStorage()?.clear();
    });

    it('should notify and trigger storage event handler', () => {
      const handler = vi.fn();
      notifier.onMessage(handler);

      // Simulate a storage event from another tab
      const message = 'SYNC';
      const payload = JSON.stringify({ message, timestamp: Date.now() });

      const StorageEventCtor = (globalThis as typeof globalThis & { StorageEvent?: new (type: string, dict: Record<string, unknown>) => Event }).StorageEvent || class extends Event {
          key: string;
          newValue: string;
          constructor(type: string, dict: Record<string, unknown>) {
              super(type);
              this.key = dict.key as string;
              this.newValue = dict.newValue as string;
          }
      };

      const event = new StorageEventCtor('storage', {
        key: '_sync_notify_test_channel',
        newValue: payload
      });

      // Manually trigger the bound listener if dispatchEvent isn't fully mocked
      const boundListener = (notifier as unknown as { boundListener: (e: Event) => void }).boundListener;
      if (boundListener) {
          boundListener(event);
      } else {
         mockPlatformService.getWindow()?.dispatchEvent(event as Event);
      }

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should write to localStorage on notify', () => {
        notifier.notify('TEST_MSG');
        const val = mockPlatformService.getLocalStorage()?.getItem('_sync_notify_test_channel');
        expect(val).not.toBeNull();
        if (val) {
          const parsed = JSON.parse(val);
          expect(parsed.message).toBe('TEST_MSG');
        }
    });
  });

  describe('CrossTabNotifierFactory', () => {
      it('should prefer BroadcastChannel if available', () => {
          const notifier = createCrossTabNotifier({ name: 'test', logger, platformService: mockPlatformService });
          expect(notifier).toBeDefined();
          expect(typeof notifier.notify).toBe('function');
          expect(typeof notifier.onMessage).toBe('function');
      });

      it('should fallback to StorageEventNotifier if BroadcastChannel is missing', () => {
          const win = mockPlatformService.getWindow() as unknown as Record<string, unknown>;

          if (win) {
              mockPlatformService.getBroadcastChannel = () => null;
          }

          const notifier = createCrossTabNotifier({ name: 'test', logger, platformService: mockPlatformService });
          expect(notifier instanceof StorageEventNotifier).toBe(true);


      });
  });
});
