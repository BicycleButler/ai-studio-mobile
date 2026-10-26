import { useSyncExternalStore, useCallback } from "react";
import { IReadableStore } from "../utils/observable";

export function useStore<T>(
  storeInstance: IReadableStore<T>,
  onSubscribeInit?: () => void
): T {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (onSubscribeInit) {
        onSubscribeInit();
      }
      return storeInstance.subscribe(listener);
    },
    [storeInstance, onSubscribeInit]
  );

  const getSnapshot = useCallback(() => {
    return storeInstance.getSnapshot();
  }, [storeInstance]);

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
