import { useOfflineQueue } from "./useOfflineQueue";
import { useMemo } from "react";

/**
 * Extracts a set of IDs that are currently pending synchronization in the offline queue
 * for a specific mutation type.
 *
 * @param type - The mutation type (e.g., "projects", "saved_prompts", "jules_sessions")
 * @param arrayKey - The key where the array is stored if the payload is a wrapper object (e.g. "projects", "prompts")
 */
export function usePendingSyncIds(type: string, arrayKey?: string): Set<string> {
  const offlineQueue = useOfflineQueue();

  return useMemo(() => {
    const ids = offlineQueue
      .filter((m) => m.type === type)
      .flatMap((m) => {
        const payload = m.payload;

        // Handle case where payload is an array directly
        if (Array.isArray(payload)) {
          return payload.map((item: unknown) => (item as Record<string, unknown>).id as string);
        }

        // Handle case where payload is a nested object
        if (
          arrayKey &&
          typeof payload === "object" &&
          payload !== null &&
          arrayKey in payload &&
          Array.isArray((payload as Record<string, unknown>)[arrayKey])
        ) {
          return ((payload as Record<string, unknown>)[arrayKey] as Record<string, unknown>[]).map(
            (p) => p.id as string
          );
        }

        return [];
      });

    return new Set(ids);
  }, [offlineQueue, type, arrayKey]);
}
