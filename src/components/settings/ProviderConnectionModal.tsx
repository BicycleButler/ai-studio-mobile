import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Key,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Globe,
  Server,
} from "lucide-react";
import { ModelProviderId, ProviderConnection } from "../../types";
import {
  CLOUD_PROVIDER_DEFINITIONS,
  getProviderDefinition,
} from "../../utils/providerCatalog";
import { ConnectProviderInput } from "../../hooks/useProviderConnections";

export interface ProviderConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProviderId?: ModelProviderId;
  editingConnection?: ProviderConnection | null;
  isVerifying: boolean;
  onSaveConnection: (
    input: ConnectProviderInput
  ) => Promise<{ connection: ProviderConnection; valid: boolean; error?: string }>;
}

export const ProviderConnectionModal: React.FC<ProviderConnectionModalProps> = ({
  isOpen,
  onClose,
  initialProviderId = "openai",
  editingConnection = null,
  isVerifying,
  onSaveConnection,
}) => {
  const [providerId, setProviderId] = useState<ModelProviderId>(initialProviderId);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [customModelsText, setCustomModelsText] = useState("");
  const [proxyViaServer, setProxyViaServer] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    if (editingConnection) {
      const def = getProviderDefinition(editingConnection.providerId);
      setProviderId(editingConnection.providerId);
      setName(editingConnection.name || def?.name || "");
      setApiKey(editingConnection.apiKey || "");
      setBaseUrl(editingConnection.baseUrl || def?.defaultBaseUrl || "");
      setCustomModelsText((editingConnection.customModels || []).join(", "));
      setProxyViaServer(Boolean(editingConnection.proxyViaServer));
    } else {
      const def = getProviderDefinition(initialProviderId);
      setProviderId(initialProviderId);
      setName(def?.name || "");
      setApiKey("");
      setBaseUrl(def?.defaultBaseUrl || "");
      setCustomModelsText("");
      setProxyViaServer(false);
    }
    setShowKey(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [isOpen, initialProviderId, editingConnection]);

  const handleSelectProvider = (nextId: ModelProviderId) => {
    const def = getProviderDefinition(nextId);
    setProviderId(nextId);
    setName(def?.name || "");
    setBaseUrl(def?.defaultBaseUrl || "");
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const activeDef = getProviderDefinition(providerId);
  const isLocalServer = providerId === "local-ollama";

  const parseCustomModels = () =>
    customModelsText
      .split(/[,\n]/)
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSubmit = async (e: React.FormEvent, skipVerification = false) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (activeDef?.requiresApiKey && !apiKey.trim()) {
      setErrorMsg(`Please enter an API key for ${activeDef.name}.`);
      return;
    }

    if (activeDef?.supportsBaseUrl && !baseUrl.trim()) {
      setErrorMsg(`Please provide a base endpoint URL.`);
      return;
    }

    const res = await onSaveConnection({
      id: editingConnection?.id,
      providerId,
      name: name.trim() || activeDef?.name || providerId,
      apiKey: apiKey.trim(),
      baseUrl: baseUrl.trim() || activeDef?.defaultBaseUrl,
      customModels: parseCustomModels(),
      proxyViaServer,
      skipVerification,
    });

    if (res.valid) {
      setSuccessMsg(
        `Connected ${res.connection.name} (${res.connection.discoveredModels?.length || 0} models)`
      );
      onClose();
    } else {
      setErrorMsg(res.error || "Could not verify provider connection.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="provider-conn-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="fixed inset-0 z-80 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            key="provider-conn-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="provider-conn-title"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] text-foreground"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  {isLocalServer ? <Server className="w-4 h-4" /> : <Key className="w-4 h-4" />}
                </div>
                <div className="min-w-0">
                  <h2 id="provider-conn-title" className="text-sm font-semibold text-foreground truncate">
                    {editingConnection ? `Edit ${editingConnection.name}` : "Connect AI Provider"}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {activeDef?.description || "Configure API credentials and endpoint"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close provider connection dialog"
                className="min-w-[44px] min-h-[44px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e, false)} className="p-5 space-y-4 overflow-y-auto">
              {/* Provider Type Selector when adding new */}
              {!editingConnection && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    Provider
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {CLOUD_PROVIDER_DEFINITIONS.map((def) => {
                      const active = providerId === def.id;
                      return (
                        <button
                          key={def.id}
                          type="button"
                          onClick={() => handleSelectProvider(def.id)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {def.shortName}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => handleSelectProvider("local-ollama")}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        providerId === "local-ollama"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Ollama / Local
                    </button>
                  </div>
                </div>
              )}

              {/* Connection Name */}
              <div className="space-y-1.5">
                <label htmlFor="provider-name-input" className="text-xs font-medium text-foreground block">
                  Display Name
                </label>
                <input
                  id="provider-name-input"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={activeDef?.name || "My AI Provider"}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                />
              </div>

              {/* Base URL */}
              {activeDef?.supportsBaseUrl && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="provider-baseurl-input" className="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                      <span>Base Endpoint URL</span>
                    </label>
                    {isLocalServer && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setBaseUrl("http://localhost:11434")}
                          className="text-[11px] text-primary hover:underline cursor-pointer whitespace-nowrap shrink-0"
                        >
                          Ollama (11434)
                        </button>
                        <span className="text-muted-foreground/50">·</span>
                        <button
                          type="button"
                          onClick={() => setBaseUrl("http://localhost:1234/v1")}
                          className="text-[11px] text-primary hover:underline cursor-pointer whitespace-nowrap shrink-0"
                        >
                          LM Studio (1234)
                        </button>
                      </div>
                    )}
                  </div>
                  <input
                    id="provider-baseurl-input"
                    type="url"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder={activeDef.defaultBaseUrl || "https://api.example.com/v1"}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors"
                  />
                </div>
              )}

              {/* API Key Input */}
              {(!isLocalServer || providerId === "local-ollama") && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label htmlFor="provider-apikey-input" className="text-xs font-medium text-foreground block">
                      {activeDef?.requiresApiKey ? "API Key" : "API Key (Optional)"}
                    </label>
                    {activeDef?.docsUrl && (
                      <a
                        href={activeDef.docsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-primary hover:underline"
                      >
                        Get API Key
                      </a>
                    )}
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="provider-apikey-input"
                      type={showKey ? "text" : "password"}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={activeDef?.keyPlaceholder || "Paste secret key..."}
                      className="w-full bg-background border border-border rounded-xl ps-3.5 pe-11 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKey((prev) => !prev)}
                      aria-label={showKey ? "Hide API key" : "Show API key"}
                      className="absolute end-1.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Encrypted on-device before storage. {isLocalServer ? "Only needed if your local server requires bearer auth." : "Sent only to the selected provider endpoint."}
                  </p>
                </div>
              )}

              {/* Custom Model IDs */}
              <div className="space-y-1.5">
                <label htmlFor="provider-custom-models-input" className="text-xs font-medium text-foreground block">
                  Custom Model IDs (Optional)
                </label>
                <input
                  id="provider-custom-models-input"
                  type="text"
                  value={customModelsText}
                  onChange={(e) => setCustomModelsText(e.target.value)}
                  placeholder={
                    isLocalServer
                      ? "e.g. llama3.2, qwen2.5-coder:7b"
                      : "e.g. deepseek-chat, mistral-large-latest"
                  }
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors"
                />
                <p className="text-[11px] text-muted-foreground">
                  Comma-separated model IDs to include in addition to auto-discovered models.
                </p>
              </div>

              {/* Local server proxy option */}
              {isLocalServer && (
                <label className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={proxyViaServer}
                    onChange={(e) => setProxyViaServer(e.target.checked)}
                    className="mt-0.5 rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <div className="text-xs">
                    <span className="font-medium text-foreground block">
                      Proxy through app backend
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Keep unchecked for direct browser connection to localhost (recommended when hosted remotely). Check only if running the app backend locally without CORS enabled on Ollama.
                    </span>
                  </div>
                </label>
              )}

              {/* Inline validation error or success */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-muted/60 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {successMsg && (
                <div className="p-3 rounded-xl bg-muted/60 text-foreground text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{successMsg}</span>
                </div>
              )}

              {/* Actions: Cancel left, Confirm right */}
              <div className="pt-2 border-t border-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-2">
                  {providerId === "openai-compatible" && (
                    <button
                      type="button"
                      disabled={isVerifying}
                      onClick={(e) => void handleSubmit(e, true)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                    >
                      Save Directly
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={isVerifying}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <span>Verify &amp; Connect</span>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
