import { useState, useEffect } from "react";
import { queueObservable, getOfflineQueue, OfflineMutation } from "../utils/offlineService";

export function useOfflineQueue(): OfflineMutation[] {
  const [queue, setQueue] = useState<OfflineMutation[]>([]);

  useEffect(() => {
    let mounted = true;
    const fetchInitial = async () => {
      const initialQueue = await getOfflineQueue();
      if (mounted) {
        setQueue(initialQueue);
        queueObservable.notify(initialQueue); // initialize observable with current state for other components
      }
    };
    fetchInitial();

    const unsubscribe = queueObservable.subscribe((newQueue) => {
      if (mounted) setQueue(newQueue);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  return queue;
}
