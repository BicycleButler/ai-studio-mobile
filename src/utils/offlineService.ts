
import { safeGetStorage, safeSetStorage } from "./storage";

export interface OfflineMutation {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
}

export const OFFLINE_QUEUE_KEY = "ai_studio_offline_mutations";

export function enqueueOfflineMutation(type: string, payload: unknown) {
  const queue = safeGetStorage<OfflineMutation[]>(OFFLINE_QUEUE_KEY, []);
  queue.push({
    type,
    payload,
    timestamp: Date.now(),
    id: Math.random().toString(36).substring(2, 9),
  });
  safeSetStorage(OFFLINE_QUEUE_KEY, queue);
}

export async function processOfflineMutations(): Promise<void> {
  const queue = safeGetStorage<OfflineMutation[]>(OFFLINE_QUEUE_KEY, []);
  if (queue.length === 0) return;

  const remainingQueue: OfflineMutation[] = [];

  for (const mutation of queue) {
    let success = false;
    try {
      if (mutation.type === "jules_sessions") {
        const res = await fetch("/api/jules/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(mutation.payload),
        });
        if (res.ok) success = true;
      } else if (mutation.type === "saved_prompts") {
        const res = await fetch("/api/prompts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompts: mutation.payload }),
        });
        if (res.ok) success = true;
      } else if (mutation.type === "projects") {
        const res = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projects: mutation.payload }),
        });
        if (res.ok) success = true;
      } else {
        // Unknown type, discard it
        success = true;
      }
    } catch (e) {
      console.error(`Failed to sync offline mutation ${mutation.type}`, e);
    }

    if (!success) {
      remainingQueue.push(mutation);
    }
  }

  safeSetStorage(OFFLINE_QUEUE_KEY, remainingQueue);
}
