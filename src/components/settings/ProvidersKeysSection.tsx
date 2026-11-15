import React, { useState, useEffect } from "react";
import {
  Cpu,
  Key,
  Plus,
  RefreshCw,
  Trash2,
  Edit2,
  Download,
  Play,
  Loader2,
  HardDrive,
  Server,
  Globe,
  Power,
} from "lucide-react";
import { ModelInfo, ModelProviderId, ProviderConnection } from "../../types";
import { SettingsSectionCard } from "./SettingsSectionCard";
import {
  CLOUD_PROVIDER_DEFINITIONS,
  LOCAL_PROVIDER_DEFINITIONS,
  getProviderDefinition,
} from "../../utils/providerCatalog";
import { useProviderConnections } from "../../hooks/useProviderConnections";
import { ProviderConnectionModal } from "./ProviderConnectionModal";

export interface ProvidersKeysSectionProps {
  activeModelId: string;
  onActivateModel: (model: ModelInfo) => void;
}

export const ProvidersKeysSection: React.FC<ProvidersKeysSectionProps> = ({
  activeModelId,
  onActivateModel,
}) => {
  const {
    connections,
    webllmProgress,
    loadedWebLLMModelId,
    isWebGPUSupported,
    browserAIAvailability,
    isVerifying,
    verifyAndSaveConnection,
    refreshConnection,
    toggleConnection,
    deleteConnection,
    loadWebLLMModel,
    unloadWebLLMModel,
    deleteWebLLMCache,
    hasWebLLMModelCached,
  } = useProviderConnections();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialProvider, setModalInitialProvider] = useState<ModelProviderId>("openai");
  const [editingConn, setEditingConn] = useState<ProviderConnection | null>(null);
  const [cachedWebLLMMap, setCachedWebLLMMap] = useState<Record<string, boolean>>({});
  const [localError, setLocalError] = useState<string | null>(null);

  // Quick Local Server inline state
  const [localServerUrl, setLocalServerUrl] = useState("http://localhost:11434");
  const [localProxyViaServer, setLocalProxyViaServer] = useState(false);
  const [localServerFeedback, setLocalServerFeedback] = useState<string | null>(null);

  const webllmDef = LOCAL_PROVIDER_DEFINITIONS.find((p) => p.id === "local-webllm");
  const browserAIDef = LOCAL_PROVIDER_DEFINITIONS.find((p) => p.id === "local-browser");

  const cloudConnections = connections.filter(
    (c) => !getProviderDefinition(c.providerId)?.isLocal
  );
  const localServerConnections = connections.filter(
    (c) => c.providerId === "local-ollama"
  );
  const webllmConnection = connections.find((c) => c.providerId === "local-webllm");
  const browserAIConnection = connections.find((c) => c.providerId === "local-browser");

  // Check cached WebGPU models on mount & after load completes
  useEffect(() => {
    let active = true;
    const checkCaches = async () => {
      if (!webllmDef) return;
      const entries = await Promise.all(
        webllmDef.defaultModels.map(async (m) => [m.id, await hasWebLLMModelCached(m.id)] as const)
      );
      if (active) {
        setCachedWebLLMMap(Object.fromEntries(entries));
      }
    };
    void checkCaches();
    return () => {
      active = false;
    };
  }, [webllmProgress.status, webllmProgress.modelId]);

  const handleOpenAddModal = (provider: ModelProviderId) => {
    setEditingConn(null);
    setModalInitialProvider(provider);
    setModalOpen(true);
  };

  const handleOpenEditModal = (conn: ProviderConnection) => {
    setEditingConn(conn);
    setModalInitialProvider(conn.providerId);
    setModalOpen(true);
  };

  const handleLoadAndActivateWebLLM = async (model: ModelInfo) => {
    setLocalError(null);
    try {
      // Ensure local-webllm connection is enabled so model appears in picker
      if (!webllmConnection || !webllmConnection.enabled) {
        await verifyAndSaveConnection({
          id: webllmConnection?.id,
          providerId: "local-webllm",
          name: "On-Device WebGPU (WebLLM)",
          skipVerification: true,
        });
      }
      await loadWebLLMModel(model.id);
      onActivateModel({
        ...model,
        providerId: "local-webllm",
        providerName: "WebGPU On-Device",
        isLocal: true,
      });
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : "Failed to load on-device model.");
    }
  };

  const handleEnableBrowserAI = async () => {
    setLocalError(null);
    const res = await verifyAndSaveConnection({
      id: browserAIConnection?.id,
      providerId: "local-browser",
      name: "Browser Built-in AI",
      skipVerification: false,
    });
    if (!res.valid) {
      setLocalError(res.error || "Browser Built-in AI is unavailable.");
      return;
    }
    const model = browserAIDef?.defaultModels[0];
    if (model) {
      onActivateModel({
        ...model,
        providerId: "local-browser",
        providerName: "Browser Built-in",
        connectionId: res.connection.id,
        isLocal: true,
      });
    }
  };

  const handleQuickConnectLocalServer = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setLocalServerFeedback(null);
    const url = localServerUrl.trim();
    if (!url) return;

    const label = url.includes("1234") ? "LM Studio Local" : "Ollama Local";
    const res = await verifyAndSaveConnection({
      providerId: "local-ollama",
      name: label,
      baseUrl: url,
      proxyViaServer: localProxyViaServer,
      skipVerification: false,
    });

    if (res.valid) {
      const count = res.connection.discoveredModels?.length || 0;
      setLocalServerFeedback(`Connected to ${label} · ${count} model${count === 1 ? "" : "s"} discovered`);
      if (res.connection.discoveredModels && res.connection.discoveredModels.length > 0) {
        onActivateModel({
          ...res.connection.discoveredModels[0],
          providerId: "local-ollama",
          providerName: label,
          connectionId: res.connection.id,
          isLocal: true,
        });
      }
    } else {
      setLocalError(res.error || "Could not reach local model server.");
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. External Cloud AI Providers */}
      <SettingsSectionCard
        icon={<Key className="w-5 h-5 text-primary" />}
        title={
          <div className="flex items-center justify-between w-full gap-2">
            <span>External AI Providers</span>
            <button
              type="button"
              id="add-provider-btn"
              onClick={() => handleOpenAddModal("openai")}
              className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Provider</span>
            </button>
          </div>
        }
        description="Connect API keys for OpenAI, Anthropic Claude, OpenRouter, Groq, or any OpenAI-compatible endpoint."
      >
        {/* Quick Connect Provider Buttons */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {CLOUD_PROVIDER_DEFINITIONS.map((def) => (
            <button
              key={def.id}
              type="button"
              onClick={() => handleOpenAddModal(def.id)}
              className="px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Globe className="w-3 h-3 text-muted-foreground" />
              <span>{def.shortName}</span>
            </button>
          ))}
        </div>

        {/* Connected Cloud Providers List */}
        {cloudConnections.length > 0 ? (
          <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3">
            {cloudConnections.map((conn) => {
              const modelCount = conn.discoveredModels?.length || conn.customModels?.length || 0;
              return (
                <div
                  key={conn.id}
                  className="py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {conn.name}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono truncate">
                        {conn.enabled ? "Enabled" : "Paused"}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                      <span>{getProviderDefinition(conn.providerId)?.shortName || conn.providerId}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{modelCount} models</span>
                      {conn.statusMessage && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{conn.statusMessage}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => void refreshConnection(conn.id)}
                      disabled={isVerifying}
                      aria-label={`Sync models for ${conn.name}`}
                      title="Sync models"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(conn)}
                      aria-label={`Edit ${conn.name}`}
                      title="Edit connection"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleConnection(conn.id)}
                      aria-label={conn.enabled ? `Disable ${conn.name}` : `Enable ${conn.name}`}
                      title={conn.enabled ? "Disable provider" : "Enable provider"}
                      className={`min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                        conn.enabled
                          ? "text-primary hover:bg-primary/10"
                          : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConnection(conn.id)}
                      aria-label={`Remove ${conn.name}`}
                      title="Remove provider"
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-2">
            No external API providers connected yet. Choose a provider above to connect your API key.
          </p>
        )}
      </SettingsSectionCard>

      {/* 2. On-Device Browser Models (WebGPU / WebLLM + Chrome Built-in AI) */}
      <SettingsSectionCard
        icon={<Cpu className="w-5 h-5 text-primary" />}
        title="On-Device Browser Models"
        description="Run open-weight models directly on your device GPU via WebGPU or Chrome Built-in AI. Works offline with zero API keys."
      >
        <div className="space-y-3">
          {/* WebGPU capability summary */}
          <div className="flex items-center justify-between text-xs px-3 py-2 rounded-lg bg-muted/40">
            <span className="text-muted-foreground">WebGPU Hardware Runtime</span>
            <span className="font-mono font-medium text-foreground">
              {isWebGPUSupported ? "Supported" : "Unavailable"}
            </span>
          </div>

          {/* Live WebLLM Download / Init Progress */}
          {webllmProgress.status === "loading" && (
            <div className="p-3 rounded-xl bg-muted/50 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-foreground truncate">
                  Loading {webllmProgress.modelId}
                </span>
                <span className="font-mono text-primary tabular-nums shrink-0">
                  {Math.round(webllmProgress.progress * 100)}%
                </span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-[width] duration-200"
                  style={{ width: `${Math.max(4, Math.round(webllmProgress.progress * 100))}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground truncate">
                {webllmProgress.text}
              </p>
            </div>
          )}

          {/* WebGPU Curated Model List */}
          <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3">
            {webllmDef?.defaultModels.map((model) => {
              const isLoaded = loadedWebLLMModelId === model.id;
              const isCached = cachedWebLLMMap[model.id];
              const isLoadingThis =
                webllmProgress.status === "loading" && webllmProgress.modelId === model.id;
              const isActive = activeModelId === model.id;

              return (
                <div
                  key={model.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate">
                        {model.name}
                      </span>
                      {isActive && (
                        <span className="text-[11px] font-medium text-primary whitespace-nowrap shrink-0">
                          Active
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                      <span className="tabular-nums">{model.sizeLabel || "—"}</span>
                      <span aria-hidden="true">·</span>
                      <span>{model.contextWindow}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {isLoaded ? "Loaded in GPU" : isCached ? "Cached offline" : "Not downloaded"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isCached && (
                      <button
                        type="button"
                        onClick={() => void deleteWebLLMCache(model.id).then(() => setCachedWebLLMMap((p) => ({ ...p, [model.id]: false })))}
                        aria-label={`Delete cached weights for ${model.name}`}
                        title="Delete cached model weights"
                        className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isLoaded ? (
                      <>
                        <button
                          type="button"
                          onClick={() => void unloadWebLLMModel()}
                          className="px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Unload
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onActivateModel({
                              ...model,
                              providerId: "local-webllm",
                              providerName: "WebGPU On-Device",
                              isLocal: true,
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap shrink-0"
                        >
                          <Play className="w-3 h-3" />
                          <span>{isActive ? "Selected" : "Use"}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={!isWebGPUSupported || isLoadingThis}
                        onClick={() => void handleLoadAndActivateWebLLM(model)}
                        className="px-3 py-1.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
                      >
                        {isLoadingThis ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{isCached ? "Load & Use" : "Download & Use"}</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Browser Built-in AI (Chrome LanguageModel) */}
          <div className="p-3 rounded-xl bg-muted/30 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">
                  Browser Built-in AI (Gemini Nano)
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {browserAIAvailability === "readily"
                  ? "Ready on-device · Zero download"
                  : browserAIAvailability === "after-download"
                  ? "Supported · Downloads automatically on first use"
                  : "Not detected in this browser (Chrome Prompt API)"}
              </p>
            </div>
            <button
              type="button"
              disabled={browserAIAvailability === "unsupported" || browserAIAvailability === "no"}
              onClick={() => void handleEnableBrowserAI()}
              className="px-3 py-1.5 rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-foreground text-xs font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-40"
            >
              {activeModelId === "chrome-gemini-nano" ? "Active" : "Use Built-in"}
            </button>
          </div>
        </div>
      </SettingsSectionCard>

      {/* 3. Local Inference Server (Ollama / LM Studio / llama.cpp) */}
      <SettingsSectionCard
        icon={<Server className="w-5 h-5 text-primary" />}
        title="Local Model Server (Ollama &amp; LM Studio)"
        description="Connect directly to models running on your machine or local network with zero cloud data transfer."
      >
        <form onSubmit={(e) => void handleQuickConnectLocalServer(e)} className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setLocalServerUrl("http://localhost:11434")}
              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              Ollama (11434)
            </button>
            <button
              type="button"
              onClick={() => setLocalServerUrl("http://localhost:1234/v1")}
              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              LM Studio (1234)
            </button>
            <button
              type="button"
              onClick={() => setLocalServerUrl("http://localhost:8080/v1")}
              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0"
            >
              llama.cpp (8080)
            </button>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="url"
              value={localServerUrl}
              onChange={(e) => setLocalServerUrl(e.target.value)}
              placeholder="http://localhost:11434"
              aria-label="Local model server URL"
              className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
            />
            <button
              type="submit"
              disabled={isVerifying || !localServerUrl.trim()}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              {isVerifying ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span>Discover Models</span>
            </button>
          </div>

          <label className="flex items-center gap-2 text-[11px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={localProxyViaServer}
              onChange={(e) => setLocalProxyViaServer(e.target.checked)}
              className="rounded text-primary focus:ring-primary cursor-pointer"
            />
            <span>Proxy through app backend (for self-hosted local server without Ollama CORS)</span>
          </label>
        </form>

        {localServerFeedback && (
          <p className="text-xs text-primary font-medium mt-2.5">{localServerFeedback}</p>
        )}

        {localError && (
          <p role="alert" className="text-xs text-destructive validation mt-2.5 leading-relaxed">
            {localError}
          </p>
        )}

        {localServerConnections.length > 0 && (
          <div className="mt-3 divide-y divide-border/60 rounded-xl bg-muted/30 px-3">
            {localServerConnections.map((conn) => (
              <div key={conn.id} className="py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-xs font-semibold text-foreground block truncate">
                    {conn.name}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono truncate block">
                    {conn.baseUrl} · {conn.discoveredModels?.length || 0} models
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => void refreshConnection(conn.id)}
                    aria-label={`Refresh ${conn.name}`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(conn)}
                    aria-label={`Edit ${conn.name}`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteConnection(conn.id)}
                    aria-label={`Remove ${conn.name}`}
                    className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SettingsSectionCard>

      <ProviderConnectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialProviderId={modalInitialProvider}
        editingConnection={editingConn}
        isVerifying={isVerifying}
        onSaveConnection={verifyAndSaveConnection}
      />
    </div>
  );
};
