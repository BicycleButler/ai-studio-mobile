import { useState, useEffect, useCallback } from "react";
import { ModelInfo } from "../types";
import { useServices } from "../services/ServiceContext";
import {
  CURATED_MODELS,
  isDeprecatedOrUnusableModel,
  fetchModels
} from "../utils/modelCatalog";

export function useModelConfig(
  customApiKey: string
) {
  const { apiClient } = useServices();
  const [models, setModels] = useState<ModelInfo[]>(CURATED_MODELS);

  const refreshModels = useCallback(async (apiKey?: string, forceRefresh = false) => {
    try {
      const data = await fetchModels(apiClient, apiKey, forceRefresh);
      if (data?.models && Array.isArray(data.models) && data.models.length > 0) {
        const cleaned = data.models.filter((m: ModelInfo) => !isDeprecatedOrUnusableModel(m.id));
        if (cleaned.length > 0) {
          setModels(cleaned);
        }
      }
    } catch (e) {
      // Intentionally ignore fetch errors for fallback models
    }
  }, [apiClient]);

  useEffect(() => {
    refreshModels(customApiKey);
  }, [customApiKey, refreshModels]);

  return {
    models,
    setModels,
    refreshModels,
  };
}
