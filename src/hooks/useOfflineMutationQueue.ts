import { useState, useCallback, useEffect, useMemo } from "react";
import { StorageCollection } from "../utils/storage";

export function useOfflineMutationQueue<T extends { id: string }>(storageKey: string) {
  const queueSingleton = useMemo(() => new StorageCollection<T>(storageKey, {}), [storageKey]);

  const [queue, setQueue] = useState<T[]>(() => {
    return queueSingleton.load();
  });

  // Sync to storage whenever the queue changes
  useEffect(() => {
    queueSingleton.save(queue);
  }, [queue, queueSingleton]);

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
