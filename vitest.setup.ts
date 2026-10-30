import { vi } from 'vitest';

const channels = new Map<string, Set<BroadcastChannelMock>>();

class BroadcastChannelMock {
  name: string;
  onmessage: ((event: unknown) => void) | null = null;

  constructor(name: string) {
    this.name = name;
    if (!channels.has(this.name)) {
      channels.set(this.name, new Set());
    }
    channels.get(this.name)!.add(this);
  }

  postMessage(message: unknown) {
    const subscribers = channels.get(this.name);
    if (subscribers) {
      for (const subscriber of subscribers) {
        if (subscriber !== this && subscriber.onmessage) {
          subscriber.onmessage({ data: message });
        }
      }
    }
  }

  close() {
    const subscribers = channels.get(this.name);
    if (subscribers) {
      subscribers.delete(this);
    }
  }
}

vi.stubGlobal('BroadcastChannel', BroadcastChannelMock);
