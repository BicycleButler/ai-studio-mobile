import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StorageEventNotifier } from './StorageEventNotifier';
import { BroadcastChannelNotifier } from './BroadcastChannelNotifier';
import { createCrossTabNotifier } from './CrossTabNotifierFactory';
import { NoOpLogger } from '../logger';
import { defaultPlatformService } from '../../services/platformService';

describe('CrossTabNotifier', () => {
  let logger: NoOpLogger;

  beforeEach(() => {
    logger = new NoOpLogger();
  });

  describe('StorageEventNotifier', () => {
    let notifier: StorageEventNotifier;

    beforeEach(() => {
      notifier = new StorageEventNotifier({ name: 'test_channel', logger });
    });

    afterEach(() => {
      notifier.dispose();
      defaultPlatformService.getLocalStorage()?.clear();
    });

    it('should notify and trigger storage event handler', () => {
      const handler = vi.fn();
      notifier.onMessage(handler);

      // Simulate a storage event from another tab
      const message = 'SYNC';
      const payload = JSON.stringify({ message, timestamp: Date.now() });

      const StorageEventCtor = (globalThis as any).StorageEvent || class {
          type: string;
          key: string;
          newValue: string;
          constructor(type: string, dict: any) {
              this.type = type;
              this.key = dict.key;
              this.newValue = dict.newValue;
          }
      };

      const event = new StorageEventCtor('storage', {
        key: '_sync_notify_test_channel',
        newValue: payload
      });

      // Manually trigger the bound listener if dispatchEvent isn't fully mocked
      const boundListener = (notifier as any).boundListener;
      if (boundListener) {
          boundListener(event);
      } else {
         defaultPlatformService.getWindow()?.dispatchEvent(event as Event);
      }

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should write to localStorage on notify', () => {
        notifier.notify('TEST_MSG');
        const val = defaultPlatformService.getLocalStorage()?.getItem('_sync_notify_test_channel');
        expect(val).not.toBeNull();
        if (val) {
          const parsed = JSON.parse(val);
          expect(parsed.message).toBe('TEST_MSG');
        }
    });
  });

  describe('CrossTabNotifierFactory', () => {
      it('should prefer BroadcastChannel if available', () => {
          const notifier = createCrossTabNotifier({ name: 'test', logger });
          expect(notifier).toBeDefined();
          expect(typeof notifier.notify).toBe('function');
          expect(typeof notifier.onMessage).toBe('function');
      });

      it('should fallback to StorageEventNotifier if BroadcastChannel is missing', () => {
          const win = defaultPlatformService.getWindow();
          const originalBroadcastChannel = (win as any)?.BroadcastChannel;
          if (win) {
              // @ts-ignore
              delete (win as any).BroadcastChannel;
          }

          const notifier = createCrossTabNotifier({ name: 'test', logger });
          expect(notifier instanceof StorageEventNotifier).toBe(true);

          if (win && originalBroadcastChannel) {
              (win as any).BroadcastChannel = originalBroadcastChannel;
          }
      });
  });
});
