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
      const event = new StorageEvent('storage', {
        key: '_sync_notify_test_channel',
        newValue: payload
      });
      defaultPlatformService.getWindow()?.dispatchEvent(event);

      expect(handler).toHaveBeenCalledWith(message);
    });

    it('should write to localStorage on notify', () => {
        notifier.notify('TEST_MSG');
        const val = defaultPlatformService.getLocalStorage()?.getItem('_sync_notify_test_channel');
        expect(val).toBeDefined();
        const parsed = JSON.parse(val!);
        expect(parsed.message).toBe('TEST_MSG');
    });
  });

  describe('CrossTabNotifierFactory', () => {
      it('should prefer BroadcastChannel if available', () => {
          // jsdom supports BroadcastChannel
          const notifier = createCrossTabNotifier({ name: 'test', logger });
          expect(notifier instanceof BroadcastChannelNotifier).toBe(true);
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
