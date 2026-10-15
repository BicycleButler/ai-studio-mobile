export interface OfflineMutation {
  type: string;
  payload: unknown;
  timestamp: number;
  id: string;
  version?: number;
}

export interface ConflictData {
  type: string;
  localData: unknown;
  remoteData: unknown;
  id: string;
}

export type SyncHandler = (mutation: OfflineMutation) => Promise<{ success: boolean; conflict?: ConflictData }>;

export const OFFLINE_QUEUE_KEY = "ai_studio_offline_mutations";
