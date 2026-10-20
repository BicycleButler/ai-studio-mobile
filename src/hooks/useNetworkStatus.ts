import { useStore } from "./useStore";
import { defaultNetworkStatusProvider, NetworkStatus, INetworkStatusProvider } from "../utils/networkStatus";

// We re-export the singleton observable for backwards compatibility
export const networkStatusObservable = defaultNetworkStatusProvider.getObservable();

/**
 * Hook to track browser online/offline status with reconnection awareness.
 * Can accept a custom INetworkStatusProvider, defaulting to the browser implementation.
 */
export function useNetworkStatus(provider: INetworkStatusProvider = defaultNetworkStatusProvider): NetworkStatus {
  return useStore(provider.getObservable(), () => {
     // Initialization is handled natively by getObservable() in the provider now.
  });
}
