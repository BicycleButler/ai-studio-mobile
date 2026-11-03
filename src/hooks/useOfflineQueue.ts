import { IOfflineService, OfflineMutation } from "../utils/offlineService";
import { useServices } from "../services/ServiceContext";
import { useStore } from "./useStore";

export function useOfflineQueue(customOfflineService?: IOfflineService): OfflineMutation[] {
  const { offlineService: contextOfflineService } = useServices();
  const offlineService = customOfflineService || contextOfflineService;

  return useStore(offlineService.getObservable());
}
