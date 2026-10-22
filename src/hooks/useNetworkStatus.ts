import { useStore } from "./useStore";
import { NetworkStatus, INetworkStatusProvider } from "../utils/networkStatus";


/**
 * Hook to track browser online/offline status with reconnection awareness.
 * Can accept a custom INetworkStatusProvider, defaulting to the browser implementation.
 */
import { useServices } from "../services/ServiceContext";
export function useNetworkStatus(customProvider?: INetworkStatusProvider): NetworkStatus {
  const { networkStatusProvider } = useServices();
  const provider = customProvider || networkStatusProvider;
  return useStore(provider.getObservable(), () => {
     // Initialization is handled natively by getObservable() in the provider now.
  });
}
