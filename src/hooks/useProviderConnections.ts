import { useState, useEffect, useCallback, useMemo } from "react";
import {
  LocalModelLoadProgress,
  ModelInfo,
  ModelProviderId,
  ProviderConnection,
} from "../types";
import { useServices } from "../services/ServiceContext";
import { BrowserAIAvailability } from "../services/localModelService";
import { getProviderDefinition } from "../utils/providerCatalog";
import { getErrorMessage } from "../utils/errorHandling";

export interface ConnectProviderInput {
  id?: string;
  providerId: ModelProviderId;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  customModels?: string[];
  proxyViaServer?: boolean;
  skipVerification?: boolean;
}

export function useProviderConnections() {
  const { providerConnectionService, localModelService, apiClient, timeProvider } = useServices();

  const [connections, setConnections] = useState<ProviderConnection[]>(() =>
    providerConnectionService.loadConnections()
  );
  const [webllmProgress, setWebllmProgress] = useState<LocalModelLoadProgress>(() =>
    localModelService.getWebLLMProgress()
  );
  const [browserAIAvailability, setBrowserAIAvailability] = useState<BrowserAIAvailability>("unsupported");
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const unsubConns = providerConnectionService.connectionsObservable.subscribe((list) => {
      setConnections(list);
    });
    const unsubProgress = localModelService.webllmProgressObservable.subscribe((progress) => {
      setWebllmProgress(progress);
    });
    void localModelService.checkBrowserAIAvailability().then(setBrowserAIAvailability);

    return () => {
      unsubConns();
      unsubProgress();
    };
  }, [providerConnectionService, localModelService]);

  const enabledModels = useMemo<ModelInfo[]>(() => {
    return providerConnectionService.getEnabledProviderModels();
  }, [connections, providerConnectionService]);

  const verifyProvider = useCallback(
    async (input: {
      providerId: ModelProviderId;
      apiKey?: string;
      baseUrl?: string;
      proxyViaServer?: boolean;
    }): Promise<{ valid: boolean; models: ModelInfo[]; error?: string }> => {
      if (input.providerId === "local-webllm") {
        const supported = localModelService.isWebGPUSupported();
        const def = getProviderDefinition("local-webllm");
        return {
          valid: supported,
          models: def?.defaultModels || [],
          error: supported ? undefined : "WebGPU is not supported in this browser.",
        };
      }

      if (input.providerId === "local-browser") {
        const avail = await localModelService.checkBrowserAIAvailability();
        const def = getProviderDefinition("local-browser");
        return {
          valid: avail === "readily" || avail === "after-download",
          models: def?.defaultModels || [],
          error:
            avail === "unsupported" || avail === "no"
              ? "Chrome Built-in LanguageModel API is not enabled in this browser."
              : undefined,
        };
      }

      if (input.providerId === "local-ollama" && !input.proxyViaServer) {
        return await localModelService.probeLocalServer(
          input.baseUrl || "http://localhost:11434"
        );
      }

      try {
        const data = await apiClient.fetch<{
          valid: boolean;
          models?: ModelInfo[];
          error?: string;
        }>("/api/providers/verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(input.apiKey?.trim() ? { "x-provider-api-key": input.apiKey.trim() } : {}),
          },
          body: JSON.stringify({
            providerId: input.providerId,
            baseUrl: input.baseUrl,
          }),
        });

        return {
          valid: Boolean(data.valid),
          models: data.models || [],
          error: data.error,
        };
      } catch (err: unknown) {
        return {
          valid: false,
          models: [],
          error: getErrorMessage(err) || "Verification failed.",
        };
      }
    },
    [apiClient, localModelService]
  );

  const verifyAndSaveConnection = useCallback(
    async (
      input: ConnectProviderInput
    ): Promise<{ connection: ProviderConnection; valid: boolean; error?: string }> => {
      setIsVerifying(true);
      try {
        const def = getProviderDefinition(input.providerId);
        let discoveredModels: ModelInfo[] | undefined = undefined;
        let status: ProviderConnection["status"] = "unverified";
        let statusMessage: string | undefined = undefined;
        let valid = true;

        if (!input.skipVerification) {
          const check = await verifyProvider({
            providerId: input.providerId,
            apiKey: input.apiKey,
            baseUrl: input.baseUrl,
            proxyViaServer: input.proxyViaServer,
          });
          valid = check.valid;
          if (check.valid) {
            discoveredModels = check.models.length > 0 ? check.models : def?.defaultModels;
            status = "connected";
            statusMessage = `${discoveredModels?.length || 0} models available`;
          } else {
            status = "error";
            statusMessage = check.error;
            // For custom OpenAI-compatible endpoints without /models, still allow saving if user provided custom models
            if (
              input.providerId === "openai-compatible" &&
              input.customModels &&
              input.customModels.length > 0
            ) {
              valid = true;
              status = "unverified";
              statusMessage = "Saved with custom model IDs";
            }
          }
        } else {
          discoveredModels = def?.defaultModels;
          status = def?.isLocal ? "connected" : "unverified";
        }

        if (!valid) {
          return {
            connection: {
              id: input.id || "",
              providerId: input.providerId,
              name: input.name || def?.name || input.providerId,
              apiKey: input.apiKey,
              baseUrl: input.baseUrl,
              customModels: input.customModels,
              enabled: false,
              status: "error",
              statusMessage,
              createdAt: timeProvider.now(),
              updatedAt: timeProvider.now(),
            },
            valid: false,
            error: statusMessage,
          };
        }

        const saved = providerConnectionService.upsertConnection({
          id: input.id,
          providerId: input.providerId,
          name: input.name || def?.name || input.providerId,
          apiKey: input.apiKey,
          baseUrl: input.baseUrl || def?.defaultBaseUrl,
          customModels: input.customModels,
          discoveredModels,
          proxyViaServer: input.proxyViaServer,
          enabled: true,
          lastVerifiedAt: timeProvider.now(),
          status,
          statusMessage,
        });

        return { connection: saved, valid: true };
      } finally {
        setIsVerifying(false);
      }
    },
    [providerConnectionService, timeProvider, verifyProvider]
  );

  const refreshConnection = useCallback(
    async (id: string) => {
      const conn = providerConnectionService.getConnectionById(id);
      if (!conn) return;
      setIsVerifying(true);
      try {
        const res = await verifyProvider({
          providerId: conn.providerId,
          apiKey: conn.apiKey,
          baseUrl: conn.baseUrl,
          proxyViaServer: conn.proxyViaServer,
        });
        providerConnectionService.upsertConnection({
          ...conn,
          discoveredModels: res.valid && res.models.length > 0 ? res.models : conn.discoveredModels,
          status: res.valid ? "connected" : "error",
          statusMessage: res.valid
            ? `${res.models.length} models synced`
            : res.error,
          lastVerifiedAt: timeProvider.now(),
        });
      } finally {
        setIsVerifying(false);
      }
    },
    [providerConnectionService, timeProvider, verifyProvider]
  );

  const toggleConnection = useCallback(
    (id: string, enabled?: boolean) => {
      providerConnectionService.toggleConnectionEnabled(id, enabled);
    },
    [providerConnectionService]
  );

  const deleteConnection = useCallback(
    (id: string) => {
      providerConnectionService.deleteConnection(id);
    },
    [providerConnectionService]
  );

  return {
    connections,
    enabledModels,
    webllmProgress,
    loadedWebLLMModelId: localModelService.loadedWebLLMModelId,
    isWebGPUSupported: localModelService.isWebGPUSupported(),
    browserAIAvailability,
    isVerifying,
    verifyProvider,
    verifyAndSaveConnection,
    refreshConnection,
    toggleConnection,
    deleteConnection,
    loadWebLLMModel: (modelId: string) => localModelService.loadWebLLMModel(modelId),
    unloadWebLLMModel: () => localModelService.unloadWebLLMModel(),
    deleteWebLLMCache: (modelId: string) => localModelService.deleteWebLLMCache(modelId),
    hasWebLLMModelCached: (modelId: string) => localModelService.hasWebLLMModelCached(modelId),
  };
}
