import { useState, useCallback, useEffect } from "react";
import { safeGetStorage, safeSetStorage } from "../utils/storage";

export function useOfflineMutationQueue<T>(storageKey: string) {
  const [queue, setQueue] = useState<T[]>(() => {
    return safeGetStorage<T[]>(storageKey, []);
  });

  // Sync to storage whenever the queue changes
  useEffect(() => {
    safeSetStorage(storageKey, queue);
  }, [queue, storageKey]);

  const enqueue = useCallback((item: T) => {
    setQueue((prevQueue) => [...prevQueue, item]);
  }, []);

  const dequeue = useCallback(() => {
    setQueue((prevQueue) => prevQueue.slice(1));
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
  }, []);

  return { queue, enqueue, dequeue, clear };
}
