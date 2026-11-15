import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Key,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
  ExternalLink,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  IntegrationAuthMethod,
  IntegrationConnection,
  IntegrationProviderId,
} from "../../types/integrations";
import { OAuthProviderAvailability } from "../../services/integrationService";
import {
  INTEGRATION_PROVIDER_DEFINITIONS,
  getIntegrationDefinition,
} from "../../utils/integrationCatalog";
import { ConnectIntegrationInput } from "../../hooks/useIntegrations";
import { getErrorMessage } from "../../utils/errorHandling";

export interface IntegrationConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProviderId?: IntegrationProviderId;
  initialAuthMethod?: IntegrationAuthMethod;
  editingConnection?: IntegrationConnection | null;
  oauthAvailability: OAuthProviderAvailability;
  isVerifying: boolean;
  onConnectOAuth: (
    providerId: IntegrationProviderId
  ) => Promise<{ providerId: IntegrationProviderId; token: string; accountLabel?: string }>;
  onSaveConnection: (
    input: ConnectIntegrationInput
  ) => Promise<{ connection: IntegrationConnection; valid: boolean; error?: string }>;
}

const AUTH_METHOD_LABELS: Record<IntegrationAuthMethod, string> = {
  oauth: "OAuth Sign-In",
  token: "Access Token",
  service_account: "Service Account JSON",
};

export const IntegrationConnectionModal: React.FC<IntegrationConnectionModalProps> = ({
  isOpen,
  onClose,
  initialProviderId = "firebase",
  initialAuthMethod,
  editingConnection = null,
  oauthAvailability,
  isVerifying,
  onConnectOAuth,
  onSaveConnection,
}) => {
  const [providerId, setProviderId] = useState<IntegrationProviderId>(initialProviderId);
  const [authMethod, setAuthMethod] = useState<IntegrationAuthMethod>("oauth");
  const [name, setName] = useState("");
  const [token, setToken] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [projectId, setProjectId] = useState("");
  const [databaseId, setDatabaseId] = useState("(default)");
  const [teamId, setTeamId] = useState("");
  const [accountLabel, setAccountLabel] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isOAuthPending, setIsOAuthPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickDefaultMethod = (pid: IntegrationProviderId): IntegrationAuthMethod => {
    if (oauthAvailability[pid]) return "oauth";
    return "token";
  };

  useEffect(() => {
    if (!isOpen) return;
    if (editingConnection) {
      const def = getIntegrationDefinition(editingConnection.providerId);
      setProviderId(editingConnection.providerId);
      setAuthMethod(editingConnection.authMethod || def?.defaultAuthMethod || "oauth");
      setName(editingConnection.name || "");
      setToken(editingConnection.token || "");
      setServiceAccountJson(editingConnection.serviceAccountJson || "");
      setProjectId(editingConnection.projectId || "");
      setDatabaseId(editingConnection.databaseId || "(default)");
      setTeamId(editingConnection.teamId || "");
      setAccountLabel(editingConnection.accountLabel || "");
      setShowAdvanced(Boolean(editingConnection.projectId || editingConnection.teamId));
    } else {
      setProviderId(initialProviderId);
      setAuthMethod(initialAuthMethod || pickDefaultMethod(initialProviderId));
      setName("");
      setToken("");
      setServiceAccountJson("");
      setProjectId("");
      setDatabaseId(initialProviderId === "firebase" ? "(default)" : "");
      setTeamId("");
      setAccountLabel("");
      setShowAdvanced(false);
    }
    setShowSecret(false);
    setErrorMsg(null);
    setStatusNote(null);
    setIsOAuthPending(false);
  }, [isOpen, initialProviderId, initialAuthMethod, editingConnection]);

  const activeDef = getIntegrationDefinition(providerId);
  const isGoogleProvider = providerId === "firebase" || providerId === "gcp";
  const hasOAuth = Boolean(oauthAvailability[providerId]);

  const handleSelectProvider = (nextId: IntegrationProviderId) => {
    setProviderId(nextId);
    setAuthMethod(oauthAvailability[nextId] ? "oauth" : "token");
    setName("");
    setToken("");
    setServiceAccountJson("");
    setProjectId("");
    setDatabaseId(nextId === "firebase" ? "(default)" : "");
    setTeamId("");
    setAccountLabel("");
    setShowAdvanced(false);
    setErrorMsg(null);
    setStatusNote(null);
  };

  const applyServiceAccountRaw = (raw: string) => {
    setServiceAccountJson(raw);
    try {
      const parsed = JSON.parse(raw) as { project_id?: string; client_email?: string };
      if (parsed.project_id && !projectId.trim()) {
        setProjectId(parsed.project_id);
      }
      if (parsed.client_email) {
        setAccountLabel(parsed.client_email);
      }
      if (parsed.project_id && !name.trim()) {
        setName(`${activeDef?.shortName || providerId} (${parsed.project_id})`);
      }
    } catch {
      // ignore partial JSON while user types
    }
  };

  const handleUploadJsonFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      applyServiceAccountRaw(text);
      setErrorMsg(null);
      setStatusNote(`Loaded key file: ${file.name}`);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      e.target.value = "";
    }
  };

  // 1-click OAuth popup -> auto-verify -> auto-save & close
  const handleLaunchOAuth = async () => {
    setErrorMsg(null);
    setStatusNote(null);
    setIsOAuthPending(true);
    try {
      const oauthRes = await onConnectOAuth(providerId);
      setToken(oauthRes.token);
      if (oauthRes.accountLabel) {
        setAccountLabel(oauthRes.accountLabel);
      }
      const autoName =
        name.trim() ||
        (oauthRes.accountLabel
          ? `${activeDef?.shortName || providerId} (${oauthRes.accountLabel})`
          : activeDef?.name || providerId);

      const savedRes = await onSaveConnection({
        id: editingConnection?.id,
        providerId,
        name: autoName,
        authMethod: "oauth",
        token: oauthRes.token,
        accountLabel: oauthRes.accountLabel,
        projectId: projectId.trim() || undefined,
        databaseId: providerId === "firebase" ? databaseId.trim() || "(default)" : undefined,
        teamId: providerId === "vercel" ? teamId.trim() || undefined : undefined,
      });

      if (savedRes.valid) {
        onClose();
      } else {
        setErrorMsg(savedRes.error || "Authorization succeeded, but project verification failed.");
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsOAuthPending(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusNote(null);

    if (authMethod === "oauth") {
      await handleLaunchOAuth();
      return;
    }

    if (authMethod === "service_account") {
      if (!serviceAccountJson.trim()) {
        setErrorMsg("Upload or paste your Google Service Account JSON key.");
        return;
      }
    } else if (!token.trim()) {
      setErrorMsg(`Paste a valid ${activeDef?.tokenLabel || "Access Token"} to connect.`);
      return;
    }

    const res = await onSaveConnection({
      id: editingConnection?.id,
      providerId,
      name: name.trim(),
      authMethod,
      token: authMethod === "service_account" ? "" : token.trim(),
      serviceAccountJson: authMethod === "service_account" ? serviceAccountJson.trim() : "",
      projectId: projectId.trim(),
      databaseId: providerId === "firebase" ? databaseId.trim() || "(default)" : "",
      teamId: providerId === "vercel" ? teamId.trim() : "",
      accountLabel: accountLabel.trim(),
    });

    if (res.valid) {
      onClose();
    } else {
      setErrorMsg(res.error || "Could not verify credentials.");
    }
  };

  const callbackOrigin =
    typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="integration-conn-backdrop"
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
            key="integration-conn-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="integration-conn-title"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] text-foreground"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-muted/30 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h2 id="integration-conn-title" className="text-sm font-semibold text-foreground truncate">
                    {editingConnection ? `Update ${editingConnection.name}` : `Connect ${activeDef?.shortName || "Project"}`}
                  </h2>
                  <p className="text-xs text-muted-foreground truncate">
                    {activeDef?.description}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close integration connection dialog"
                className="min-w-[44px] min-h-[44px] rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmit(e)} className="p-5 space-y-4 overflow-y-auto">
              {/* Provider selector */}
              {!editingConnection && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground block">
                    Service
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {INTEGRATION_PROVIDER_DEFINITIONS.map((def) => {
                      const active = providerId === def.id;
                      return (
                        <button
                          key={def.id}
                          type="button"
                          onClick={() => handleSelectProvider(def.id)}
                          className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? "bg-primary text-primary-foreground shadow-xs"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          {def.shortName}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Auth method tabs */}
              <div className="flex flex-wrap gap-1.5 bg-muted/40 p-1 rounded-xl">
                {(activeDef?.supportedAuthMethods || ["oauth", "token"]).map((method) => {
                  const active = authMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => {
                        setAuthMethod(method);
                        setErrorMsg(null);
                      }}
                      className={`min-h-[36px] flex-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                        active
                          ? "bg-card text-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {AUTH_METHOD_LABELS[method]}
                    </button>
                  );
                })}
              </div>

              {/* OAuth Primary 1-Click Sign-In */}
              {authMethod === "oauth" && (
                <div className="p-4 rounded-xl bg-muted/40 space-y-3">
                  {hasOAuth ? (
                    <>
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {isGoogleProvider
                          ? "Sign in with Google to automatically grant access and discover your projects—no manual keys or Project IDs needed."
                          : `Sign in directly with ${activeDef?.shortName} in a secure popup. Your username and repositories load automatically.`}
                      </p>
                      <button
                        type="button"
                        onClick={() => void handleLaunchOAuth()}
                        disabled={isOAuthPending || isVerifying}
                        className="min-h-[44px] w-full px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                      >
                        {isOAuthPending || isVerifying ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Authorizing {activeDef?.shortName}...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="w-4 h-4" />
                            <span>{activeDef?.oauthButtonLabel || `Sign in with ${activeDef?.shortName}`}</span>
                          </>
                        )}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-xs text-foreground font-medium">
                        {activeDef?.shortName} OAuth app credentials are not configured on this server yet.
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Switch to <button type="button" onClick={() => setAuthMethod("token")} className="text-primary font-medium hover:underline cursor-pointer">Access Token</button> for a 1-step paste connection, or configure <span className="font-mono text-foreground">{providerId.toUpperCase()}_CLIENT_ID</span> &amp; <span className="font-mono text-foreground">{providerId.toUpperCase()}_CLIENT_SECRET</span> with callback URL:
                      </p>
                      <p className="text-[11px] font-mono text-foreground break-all bg-background/80 px-2.5 py-1.5 rounded-lg border border-border/60">
                        {callbackOrigin}/api/integrations/oauth/{providerId}/callback
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Token input (single field + 1-click generate link) */}
              {authMethod === "token" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="intg-token-input" className="text-xs font-medium text-foreground block">
                      {activeDef?.tokenLabel || "Access Token"}
                    </label>
                    <a
                      href={activeDef?.quickTokenUrl || activeDef?.docsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-primary hover:underline flex items-center gap-1 whitespace-nowrap font-medium"
                    >
                      <span>Create Token</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <div className="relative flex items-center">
                    <input
                      id="intg-token-input"
                      type={showSecret ? "text" : "password"}
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder={activeDef?.tokenPlaceholder || "Paste access token..."}
                      className="w-full bg-background border border-border rounded-xl ps-3.5 pe-12 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((p) => !p)}
                      aria-label={showSecret ? "Hide token" : "Show token"}
                      className="absolute end-1 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Account &amp; project details are discovered automatically. Stored encrypted on this device.
                  </p>
                </div>
              )}

              {/* Service Account JSON (Firebase / GCP) */}
              {authMethod === "service_account" && isGoogleProvider && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label htmlFor="intg-sa-json-input" className="text-xs font-medium text-foreground block">
                      Service Account JSON Key
                    </label>
                    <div className="flex items-center gap-2 shrink-0">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json,application/json"
                        onChange={(e) => void handleUploadJsonFile(e)}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Upload className="w-3 h-3" />
                        <span>Upload .json</span>
                      </button>
                    </div>
                  </div>
                  <textarea
                    id="intg-sa-json-input"
                    rows={5}
                    value={serviceAccountJson}
                    onChange={(e) => applyServiceAccountRaw(e.target.value)}
                    placeholder={'{\n  "type": "service_account",\n  "project_id": "my-project",\n  "private_key": "...",\n  "client_email": "..."\n}'}
                    className="w-full bg-background border border-border rounded-xl px-3.5 py-2.5 text-[11px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors resize-y"
                  />
                </div>
              )}

              {/* Collapsible Optional Overrides (Name, Project ID, DB ID, Team ID) */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  <span>Optional label &amp; project overrides</span>
                </button>

                {showAdvanced && (
                  <div className="mt-2.5 p-3 rounded-xl bg-muted/30 space-y-3">
                    <div className="space-y-1">
                      <label htmlFor="intg-name-input" className="text-xs font-medium text-foreground block">
                        Display Label
                      </label>
                      <input
                        id="intg-name-input"
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={`Auto-named from ${activeDef?.shortName} account`}
                        className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
                      />
                    </div>

                    {isGoogleProvider && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label htmlFor="intg-project-id-input" className="text-xs font-medium text-foreground block">
                            Project ID Override
                          </label>
                          <input
                            id="intg-project-id-input"
                            type="text"
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            placeholder="Auto-detected if blank"
                            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors"
                          />
                        </div>
                        {providerId === "firebase" && (
                          <div className="space-y-1">
                            <label htmlFor="intg-db-id-input" className="text-xs font-medium text-foreground block">
                              Firestore Database ID
                            </label>
                            <input
                              id="intg-db-id-input"
                              type="text"
                              value={databaseId}
                              onChange={(e) => setDatabaseId(e.target.value)}
                              placeholder="(default)"
                              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {providerId === "vercel" && (
                      <div className="space-y-1">
                        <label htmlFor="intg-vercel-team-input" className="text-xs font-medium text-foreground block">
                          Default Team ID (Optional)
                        </label>
                        <input
                          id="intg-vercel-team-input"
                          type="text"
                          value={teamId}
                          onChange={(e) => setTeamId(e.target.value)}
                          placeholder="Auto-listed in explorer"
                          className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono transition-colors"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>

              {statusNote && (
                <div className="p-3 rounded-xl bg-muted/50 text-foreground text-xs flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                  <span>{statusNote}</span>
                </div>
              )}

              {errorMsg && (
                <div role="alert" className="p-3 rounded-xl bg-muted/60 border border-border text-foreground text-xs flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span className="leading-relaxed">{errorMsg}</span>
                </div>
              )}

              {/* Footer Actions */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  Cancel
                </button>
                {authMethod !== "oauth" && (
                  <button
                    type="submit"
                    disabled={isVerifying || isOAuthPending}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                  >
                    {isVerifying ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Connecting...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Connect {activeDef?.shortName}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
