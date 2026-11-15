import { useState, useEffect, useCallback, useMemo } from "react";
import { ModelInfo, ProviderConnection } from "../types";
import { useServices } from "../services/ServiceContext";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  fetchModels
} from "../utils/modelCatalog";

export function useModelConfig(
  customApiKey: string
) {
  const { apiClient, providerConnectionService } = useServices();
  const [googleModels, setGoogleModels] = useState<ModelInfo[]>(() =>
    CURATED_MODELS.map((m) => ({
      ...m,
      providerId: "google" as const,
      providerName: "Google AI Studio",
    }))
  );
  const [connections, setConnections] = useState<ProviderConnection[]>(() =>
    providerConnectionService.loadConnections()
  );

  useEffect(() => {
    const unsub = providerConnectionService.connectionsObservable.subscribe((list) => {
      setConnections(list);
    });
    return () => unsub();
  }, [providerConnectionService]);

  const refreshModels = useCallback(async (apiKey?: string, forceRefresh = false) => {
    try {
      const data = await fetchModels(apiClient, apiKey, forceRefresh);
      if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
        const cleaned = data.models
          .filter((m: ModelInfo) => !isDeprecatedOrUnusableModel(m.id, m.providerId || "google"))
          .map((m: ModelInfo) => ({
            ...m,
            providerId: m.providerId || ("google" as const),
            providerName: m.providerName || "Google AI Studio",
          }));
        if (cleaned.length > 0) {
          setGoogleModels(cleaned);
        }
      }
    } catch {
      // Intentionally ignore fetch errors for fallback models
    }
  }, [apiClient]);

  useEffect(() => {
    refreshModels(customApiKey);
  }, [customApiKey, refreshModels]);

  const models = useMemo(() => {
    const providerModels = providerConnectionService.getEnabledProviderModels();
    return [...googleModels, ...providerModels];
  }, [googleModels, connections, providerConnectionService]);

  return {
    models,
    setModels: setGoogleModels,
    refreshModels,
  };
}
