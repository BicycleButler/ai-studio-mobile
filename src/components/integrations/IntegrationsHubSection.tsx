import React, { useState, useEffect, useMemo } from "react";
import {
  Blocks,
  RefreshCw,
  Edit2,
  Power,
  Trash2,
  Database,
  Cloud,
  FolderGit2,
  Rocket,
  ArrowUpRight,
  Loader2,
  Key,
  AlertCircle,
} from "lucide-react";
import {
  IntegrationAuthMethod,
  IntegrationConnection,
  IntegrationProviderId,
  RemoteFileSource,
} from "../../types/integrations";
import { INTEGRATION_PROVIDER_DEFINITIONS, getIntegrationDefinition } from "../../utils/integrationCatalog";
import { useIntegrations } from "../../hooks/useIntegrations";
import { getErrorMessage } from "../../utils/errorHandling";
import { SettingsSectionCard } from "../settings/SettingsSectionCard";
import { IntegrationConnectionModal } from "./IntegrationConnectionModal";
import { FirebaseExplorerPanel } from "./FirebaseExplorerPanel";
import { GcpExplorerPanel } from "./GcpExplorerPanel";
import { GitHubExplorerPanel } from "./GitHubExplorerPanel";
import { VercelExplorerPanel } from "./VercelExplorerPanel";

export interface IntegrationsHubSectionProps {
  openedWorkspaceFiles?: Array<{ path: string; name: string; content: string; originalContent: string }>;
  activeIdeFile?: { path: string; name: string; content: string } | null;
  onOpenRemoteFileInIDE?: (file: {
    path: string;
    name: string;
    language: string;
    content: string;
    remoteSource: RemoteFileSource;
  }) => void;
}

function getProviderIcon(providerId: IntegrationProviderId) {
  switch (providerId) {
    case "firebase":
      return Database;
    case "gcp":
      return Cloud;
    case "github":
      return FolderGit2;
    case "vercel":
      return Rocket;
  }
}

export const IntegrationsHubSection: React.FC<IntegrationsHubSectionProps> = ({
  openedWorkspaceFiles = [],
  activeIdeFile = null,
  onOpenRemoteFileInIDE,
}) => {
  const {
    connections,
    enabledConnections,
    oauthAvailability,
    isVerifying,
    verifyAndSaveConnection,
    refreshConnection,
    connectWithOAuth,
    connectWithOAuthAndSave,
    updateConnectionDetails,
    toggleConnection,
    deleteConnection,
    getCredentials,
    integrationApiService,
  } = useIntegrations();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalInitialProvider, setModalInitialProvider] = useState<IntegrationProviderId>("firebase");
  const [modalInitialMethod, setModalInitialMethod] = useState<IntegrationAuthMethod | undefined>(undefined);
  const [editingConn, setEditingConn] = useState<IntegrationConnection | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<string>(() => enabledConnections[0]?.id || "");
  const [signingInProvider, setSigningInProvider] = useState<IntegrationProviderId | null>(null);
  const [quickConnectError, setQuickConnectError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedConnectionId || !enabledConnections.some((c) => c.id === selectedConnectionId)) {
      setSelectedConnectionId(enabledConnections[0]?.id || "");
    }
  }, [enabledConnections, selectedConnectionId]);

  const activeConnection = useMemo(
    () => enabledConnections.find((c) => c.id === selectedConnectionId) || enabledConnections[0] || null,
    [enabledConnections, selectedConnectionId]
  );

  const handleOpenModal = (provider: IntegrationProviderId, method?: IntegrationAuthMethod) => {
    setEditingConn(null);
    setModalInitialProvider(provider);
    setModalInitialMethod(method);
    setModalOpen(true);
  };

  const handleOpenEditModal = (conn: IntegrationConnection) => {
    setEditingConn(conn);
    setModalInitialProvider(conn.providerId);
    setModalInitialMethod(conn.authMethod);
    setModalOpen(true);
  };

  const handleDirectProviderConnect = async (providerId: IntegrationProviderId) => {
    setQuickConnectError(null);
    if (!oauthAvailability[providerId]) {
      handleOpenModal(providerId, "token");
      return;
    }

    setSigningInProvider(providerId);
    try {
      const existingSameProvider = connections.find(
        (c) => c.providerId === providerId && c.authMethod === "oauth"
      );
      const res = await connectWithOAuthAndSave(providerId, existingSameProvider?.id);
      if (res.valid) {
        setSelectedConnectionId(res.connection.id);
      } else {
        setQuickConnectError(res.error || `Failed to verify ${providerId} connection.`);
      }
    } catch (err) {
      setQuickConnectError(getErrorMessage(err));
    } finally {
      setSigningInProvider(null);
    }
  };

  const handleReauthorizeConnection = async (conn: IntegrationConnection) => {
    setQuickConnectError(null);
    setSigningInProvider(conn.providerId);
    try {
      const res = await connectWithOAuthAndSave(conn.providerId, conn.id);
      if (res.valid) {
        setSelectedConnectionId(res.connection.id);
      } else {
        setQuickConnectError(res.error || "Re-authorization failed.");
      }
    } catch (err) {
      setQuickConnectError(getErrorMessage(err));
    } finally {
      setSigningInProvider(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* 1. One-Click Direct Sign-In Cards */}
      <SettingsSectionCard
        icon={<Blocks className="w-5 h-5 text-primary" />}
        title="Cloud &amp; Repository Integrations"
        description="Sign in directly with OAuth to browse, edit, and push across Firebase, Google Cloud, GitHub, and Vercel."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
          {INTEGRATION_PROVIDER_DEFINITIONS.map((def) => {
            const Icon = getProviderIcon(def.id);
            const providerConns = connections.filter((c) => c.providerId === def.id && c.enabled);
            const primaryConn = providerConns[0];
            const isSigning = signingInProvider === def.id;
            const hasOAuth = Boolean(oauthAvailability[def.id]);

            return (
              <div
                key={def.id}
                className="p-3 rounded-xl bg-muted/40 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-background text-primary flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-foreground block truncate">
                      {def.shortName}
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {primaryConn
                        ? primaryConn.accountLabel || primaryConn.projectId || `${providerConns.length} connected`
                        : hasOAuth
                        ? "1-click OAuth ready"
                        : "Quick token or OAuth"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={Boolean(signingInProvider)}
                  onClick={() => void handleDirectProviderConnect(def.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
                    primaryConn
                      ? "bg-muted hover:bg-muted/80 text-foreground"
                      : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
                  }`}
                >
                  {isSigning ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : primaryConn ? (
                    <span>{hasOAuth ? "Reconnect" : "Add Account"}</span>
                  ) : (
                    <span>{hasOAuth ? def.oauthButtonLabel : `Connect ${def.shortName}`}</span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pb-2">
          <span className="text-[11px] text-muted-foreground">
            Credentials are encrypted on this device.
          </span>
          <button
            type="button"
            id="add-integration-btn"
            onClick={() => handleOpenModal("firebase", "token")}
            className="text-[11px] text-primary hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
          >
            <Key className="w-3 h-3" />
            <span>Use token or Service Account JSON</span>
          </button>
        </div>

        {quickConnectError && (
          <div role="alert" className="mb-3 p-3 rounded-xl bg-muted/60 border border-border text-foreground text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{quickConnectError}</span>
          </div>
        )}

        {/* Saved Connections List */}
        {connections.length > 0 && (
          <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3 mt-1">
            {connections.map((conn) => {
              const def = getIntegrationDefinition(conn.providerId);
              const Icon = getProviderIcon(conn.providerId);
              const isSelected = activeConnection?.id === conn.id;
              return (
                <div key={conn.id} className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <button
                    type="button"
                    disabled={!conn.enabled}
                    onClick={() => setSelectedConnectionId(conn.id)}
                    className="min-w-0 flex-1 flex items-center gap-2.5 text-start cursor-pointer disabled:opacity-50"
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-semibold truncate ${isSelected ? "text-primary" : "text-foreground"}`}>
                          {conn.name}
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground shrink-0">
                          {conn.enabled ? "Active" : "Paused"}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5 truncate">
                        <span>{def?.shortName || conn.providerId}</span>
                        {(conn.projectId || conn.accountLabel) && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono truncate">{conn.projectId || conn.accountLabel}</span>
                          </>
                        )}
                        {conn.statusMessage && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="truncate">{conn.statusMessage}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-1 shrink-0 self-end sm:self-center">
                    {conn.enabled && (
                      <button
                        type="button"
                        onClick={() => setSelectedConnectionId(conn.id)}
                        className={`min-h-[36px] px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors flex items-center gap-1 cursor-pointer ${
                          isSelected ? "bg-primary/15 text-primary" : "bg-muted text-foreground hover:bg-muted/80"
                        }`}
                      >
                        <span>{isSelected ? "Exploring" : "Explore"}</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => void refreshConnection(conn.id)}
                      disabled={isVerifying}
                      aria-label={`Verify ${conn.name}`}
                      title="Re-verify connection"
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isVerifying ? "animate-spin" : ""}`} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(conn)}
                      aria-label={`Edit ${conn.name}`}
                      title="Edit connection"
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleConnection(conn.id)}
                      aria-label={conn.enabled ? `Disable ${conn.name}` : `Enable ${conn.name}`}
                      title={conn.enabled ? "Pause connection" : "Enable connection"}
                      className={`min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg transition-colors cursor-pointer ${
                        conn.enabled ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      <Power className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteConnection(conn.id)}
                      aria-label={`Remove ${conn.name}`}
                      title="Remove integration"
                      className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SettingsSectionCard>

      {/* 2. Bi-Directional Explorer for Selected Active Integration */}
      {activeConnection && (
        <SettingsSectionCard
          icon={React.createElement(getProviderIcon(activeConnection.providerId), { className: "w-5 h-5 text-primary" })}
          title={`Bi-Directional Explorer · ${activeConnection.name}`}
          description={`Read, edit, push, and manage live resources in ${getIntegrationDefinition(activeConnection.providerId)?.name || activeConnection.providerId}.`}
        >
          {enabledConnections.length > 1 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {enabledConnections.map((conn) => (
                <button
                  key={conn.id}
                  type="button"
                  onClick={() => setSelectedConnectionId(conn.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                    conn.id === activeConnection.id
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {conn.name}
                </button>
              ))}
            </div>
          )}

          {activeConnection.providerId === "firebase" && (
            <FirebaseExplorerPanel
              connection={activeConnection}
              credentials={getCredentials(activeConnection)}
              apiService={integrationApiService}
              activeIdeFile={activeIdeFile}
              onSelectProjectId={(pid) => updateConnectionDetails(activeConnection.id, { projectId: pid })}
              onReauthorizeOAuth={() => void handleReauthorizeConnection(activeConnection)}
              onOpenRemoteFileInIDE={onOpenRemoteFileInIDE}
            />
          )}

          {activeConnection.providerId === "gcp" && (
            <GcpExplorerPanel
              connection={activeConnection}
              credentials={getCredentials(activeConnection)}
              apiService={integrationApiService}
              activeIdeFile={activeIdeFile}
              onSelectProjectId={(pid) => updateConnectionDetails(activeConnection.id, { projectId: pid })}
              onReauthorizeOAuth={() => void handleReauthorizeConnection(activeConnection)}
              onOpenRemoteFileInIDE={onOpenRemoteFileInIDE}
            />
          )}

          {activeConnection.providerId === "github" && (
            <GitHubExplorerPanel
              connection={activeConnection}
              credentials={getCredentials(activeConnection)}
              apiService={integrationApiService}
              activeIdeFile={activeIdeFile}
              openedWorkspaceFiles={openedWorkspaceFiles}
              onOpenRemoteFileInIDE={onOpenRemoteFileInIDE}
            />
          )}

          {activeConnection.providerId === "vercel" && (
            <VercelExplorerPanel
              connection={activeConnection}
              credentials={getCredentials(activeConnection)}
              apiService={integrationApiService}
              activeIdeFile={activeIdeFile}
              openedWorkspaceFiles={openedWorkspaceFiles}
              onSelectTeamId={(tid) => updateConnectionDetails(activeConnection.id, { teamId: tid })}
            />
          )}
        </SettingsSectionCard>
      )}

      <IntegrationConnectionModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        initialProviderId={modalInitialProvider}
        initialAuthMethod={modalInitialMethod}
        editingConnection={editingConn}
        oauthAvailability={oauthAvailability}
        isVerifying={isVerifying}
        onConnectOAuth={connectWithOAuth}
        onSaveConnection={async (input) => {
          const res = await verifyAndSaveConnection(input);
          if (res.valid) {
            setSelectedConnectionId(res.connection.id);
          }
          return res;
        }}
      />
    </div>
  );
};
