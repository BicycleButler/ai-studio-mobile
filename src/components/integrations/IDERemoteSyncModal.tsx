import React, { useState, useEffect, useMemo } from "react";
import {
  Cloud,
  Upload,
  Settings2,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Database,
  FolderGit2,
  Rocket,
  ShieldCheck,
} from "lucide-react";
import { Dialog } from "../ui/Dialog";
import { IntegrationProviderId, RemoteFileSource } from "../../types/integrations";
import { INTEGRATION_PROVIDER_DEFINITIONS } from "../../utils/integrationCatalog";
import { useIntegrations } from "../../hooks/useIntegrations";
import { getErrorMessage } from "../../utils/errorHandling";
import { FirebaseExplorerPanel } from "./FirebaseExplorerPanel";
import { GcpExplorerPanel } from "./GcpExplorerPanel";
import { GitHubExplorerPanel } from "./GitHubExplorerPanel";
import { VercelExplorerPanel } from "./VercelExplorerPanel";

export interface IDERemoteSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenIntegrationsSettings: () => void;
  activeIdeFile: {
    path: string;
    name: string;
    language: string;
    content: string;
    remoteSource?: RemoteFileSource;
  } | null;
  openedWorkspaceFiles: Array<{
    path: string;
    name: string;
    language: string;
    content: string;
    originalContent: string;
    remoteSource?: RemoteFileSource;
  }>;
  onOpenRemoteFileInIDE: (file: {
    path: string;
    name: string;
    language: string;
    content: string;
    remoteSource: RemoteFileSource;
  }) => void;
  onUpdateRemoteSource?: (filePath: string, remoteSource: RemoteFileSource, syncedContent: string) => void;
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

export const IDERemoteSyncModal: React.FC<IDERemoteSyncModalProps> = ({
  isOpen,
  onClose,
  onOpenIntegrationsSettings,
  activeIdeFile,
  openedWorkspaceFiles,
  onOpenRemoteFileInIDE,
  onUpdateRemoteSource,
}) => {
  const {
    enabledConnections,
    oauthAvailability,
    connectWithOAuthAndSave,
    updateConnectionDetails,
    getCredentials,
    integrationApiService,
  } = useIntegrations();
  const [selectedConnId, setSelectedConnId] = useState<string>("");
  const [commitMsg, setCommitMsg] = useState("");
  const [isPushing, setIsPushing] = useState(false);
  const [signingInProvider, setSigningInProvider] = useState<IntegrationProviderId | null>(null);
  const [pushFeedback, setPushFeedback] = useState<string | null>(null);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPushFeedback(null);
    setPushError(null);
    if (activeIdeFile?.remoteSource?.connectionId) {
      setSelectedConnId(activeIdeFile.remoteSource.connectionId);
    } else if (!selectedConnId && enabledConnections.length > 0) {
      setSelectedConnId(enabledConnections[0].id);
    }
    if (activeIdeFile) {
      setCommitMsg(`Update ${activeIdeFile.name} from Mobile IDE`);
    }
  }, [isOpen, activeIdeFile?.path, enabledConnections]);

  const activeConnection = useMemo(
    () => enabledConnections.find((c) => c.id === selectedConnId) || enabledConnections[0] || null,
    [enabledConnections, selectedConnId]
  );

  const matchingOriginConnection = useMemo(() => {
    const connId = activeIdeFile?.remoteSource?.connectionId;
    if (!connId) return null;
    return enabledConnections.find((c) => c.id === connId) || null;
  }, [activeIdeFile?.remoteSource?.connectionId, enabledConnections]);

  const handleQuickOAuthConnect = async (providerId: IntegrationProviderId) => {
    setPushError(null);
    if (!oauthAvailability[providerId]) {
      onClose();
      onOpenIntegrationsSettings();
      return;
    }
    setSigningInProvider(providerId);
    try {
      const res = await connectWithOAuthAndSave(providerId);
      if (res.valid) {
        setSelectedConnId(res.connection.id);
      } else {
        setPushError(res.error || `Failed to connect ${providerId}`);
      }
    } catch (err) {
      setPushError(getErrorMessage(err));
    } finally {
      setSigningInProvider(null);
    }
  };

  const handleQuickPushBack = async () => {
    if (!activeIdeFile || !activeIdeFile.remoteSource || !matchingOriginConnection) return;
    const src = activeIdeFile.remoteSource;
    const creds = getCredentials(matchingOriginConnection);

    setIsPushing(true);
    setPushError(null);
    setPushFeedback(null);
    try {
      if (src.providerId === "github" && src.owner && src.repo) {
        const res = await integrationApiService.writeGitHubFile(creds, {
          owner: src.owner,
          repo: src.repo,
          branch: src.branch,
          path: activeIdeFile.path.replace(/^\/+/, ""),
          content: activeIdeFile.content,
          message: commitMsg.trim() || `Update ${activeIdeFile.path}`,
          sha: src.sha,
        });
        onUpdateRemoteSource?.(
          activeIdeFile.path,
          { ...src, sha: res.sha },
          activeIdeFile.content
        );
        setPushFeedback(`Pushed commit ${res.commitSha.slice(0, 7)} to ${src.owner}/${src.repo}@${src.branch || "main"}`);
      } else if (src.providerId === "gcp" && src.bucket && src.objectName) {
        await integrationApiService.writeGcsObject(
          creds,
          src.bucket,
          src.objectName,
          activeIdeFile.content
        );
        onUpdateRemoteSource?.(activeIdeFile.path, src, activeIdeFile.content);
        setPushFeedback(`Uploaded updated object to gs://${src.bucket}/${src.objectName}`);
      } else if (src.providerId === "firebase" && src.collectionPath && src.docId) {
        const parsed = JSON.parse(activeIdeFile.content) as Record<string, unknown>;
        await integrationApiService.writeFirebaseDocument(
          creds,
          src.collectionPath,
          parsed,
          src.docId,
          false
        );
        onUpdateRemoteSource?.(activeIdeFile.path, src, activeIdeFile.content);
        setPushFeedback(`Saved Firestore document ${src.collectionPath}/${src.docId}`);
      }
    } catch (err) {
      setPushError(getErrorMessage(err));
    } finally {
      setIsPushing(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={
        <div className="flex items-center gap-2">
          <Cloud className="w-4 h-4 text-primary" />
          <span>Cloud &amp; Git Bi-Directional Sync</span>
        </div>
      }
      description="Pull remote files into the Mobile IDE or push local changes back to GitHub, Google Cloud, Firebase, or Vercel."
    >
      <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
        {/* 1-click Push Back banner when editing a file pulled from GitHub / GCS / Firestore */}
        {activeIdeFile?.remoteSource && matchingOriginConnection && activeIdeFile.remoteSource.providerId !== "workspace" && (
          <div className="p-3.5 rounded-xl bg-muted/40 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-semibold text-foreground block truncate">
                  Active File Origin: {matchingOriginConnection.name}
                </span>
                <span className="text-[11px] font-mono text-muted-foreground block truncate">
                  {activeIdeFile.remoteSource.providerId === "github"
                    ? `${activeIdeFile.remoteSource.owner}/${activeIdeFile.remoteSource.repo}@${activeIdeFile.remoteSource.branch} · ${activeIdeFile.path}`
                    : activeIdeFile.remoteSource.providerId === "gcp"
                    ? `gs://${activeIdeFile.remoteSource.bucket}/${activeIdeFile.remoteSource.objectName}`
                    : `${activeIdeFile.remoteSource.collectionPath}/${activeIdeFile.remoteSource.docId}`}
                </span>
              </div>
              <button
                type="button"
                disabled={isPushing}
                onClick={() => void handleQuickPushBack()}
                className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              >
                {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Push Active File Back</span>
              </button>
            </div>

            {activeIdeFile.remoteSource.providerId === "github" && (
              <input
                type="text"
                value={commitMsg}
                onChange={(e) => setCommitMsg(e.target.value)}
                placeholder="Commit message..."
                aria-label="Commit message for push back"
                className="w-full bg-background border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
              />
            )}

            {pushFeedback && (
              <div className="text-xs text-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{pushFeedback}</span>
              </div>
            )}
          </div>
        )}

        {pushError && (
          <div role="alert" className="p-3 rounded-xl bg-muted/60 border border-border text-foreground text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{pushError}</span>
          </div>
        )}

        {enabledConnections.length === 0 ? (
          <div className="p-5 rounded-xl bg-muted/30 space-y-4">
            <div className="text-center space-y-1">
              <p className="text-xs font-semibold text-foreground">
                Sign in directly to start syncing files
              </p>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Connect Firebase, Google Cloud, GitHub, or Vercel to pull remote files into the Mobile IDE and push edits back.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INTEGRATION_PROVIDER_DEFINITIONS.map((def) => {
                const Icon = getProviderIcon(def.id);
                const hasOAuth = Boolean(oauthAvailability[def.id]);
                const isBusy = signingInProvider === def.id;
                return (
                  <button
                    key={def.id}
                    type="button"
                    disabled={Boolean(signingInProvider)}
                    onClick={() => void handleQuickOAuthConnect(def.id)}
                    className="min-h-[44px] px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium flex items-center justify-between gap-2 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Icon className="w-4 h-4 text-primary shrink-0" />
                      <span className="truncate">{def.shortName}</span>
                    </span>
                    <span className="text-[11px] font-semibold text-primary flex items-center gap-1 shrink-0">
                      {isBusy ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : hasOAuth ? (
                        <>
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>{def.oauthButtonLabel}</span>
                        </>
                      ) : (
                        <span>Connect</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenIntegrationsSettings();
                }}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Open Advanced Integrations Settings</span>
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1.5">
                {enabledConnections.map((conn) => (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={() => setSelectedConnId(conn.id)}
                    className={`min-h-[36px] px-3 py-1 rounded-xl text-xs font-medium transition-colors cursor-pointer ${
                      activeConnection?.id === conn.id
                        ? "bg-foreground text-background"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {conn.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenIntegrationsSettings();
                }}
                className="text-xs text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5" />
                <span>Manage Connections</span>
              </button>
            </div>

            {activeConnection && activeConnection.providerId === "firebase" && (
              <FirebaseExplorerPanel
                connection={activeConnection}
                credentials={getCredentials(activeConnection)}
                apiService={integrationApiService}
                activeIdeFile={activeIdeFile}
                onSelectProjectId={(pid) => updateConnectionDetails(activeConnection.id, { projectId: pid })}
                onOpenRemoteFileInIDE={(file) => {
                  onOpenRemoteFileInIDE(file);
                  onClose();
                }}
              />
            )}

            {activeConnection && activeConnection.providerId === "gcp" && (
              <GcpExplorerPanel
                connection={activeConnection}
                credentials={getCredentials(activeConnection)}
                apiService={integrationApiService}
                activeIdeFile={activeIdeFile}
                onSelectProjectId={(pid) => updateConnectionDetails(activeConnection.id, { projectId: pid })}
                onOpenRemoteFileInIDE={(file) => {
                  onOpenRemoteFileInIDE(file);
                  onClose();
                }}
              />
            )}

            {activeConnection && activeConnection.providerId === "github" && (
              <GitHubExplorerPanel
                connection={activeConnection}
                credentials={getCredentials(activeConnection)}
                apiService={integrationApiService}
                activeIdeFile={activeIdeFile}
                openedWorkspaceFiles={openedWorkspaceFiles}
                onOpenRemoteFileInIDE={(file) => {
                  onOpenRemoteFileInIDE(file);
                  onClose();
                }}
              />
            )}

            {activeConnection && activeConnection.providerId === "vercel" && (
              <VercelExplorerPanel
                connection={activeConnection}
                credentials={getCredentials(activeConnection)}
                apiService={integrationApiService}
                activeIdeFile={activeIdeFile}
                openedWorkspaceFiles={openedWorkspaceFiles}
                onSelectTeamId={(tid) => updateConnectionDetails(activeConnection.id, { teamId: tid })}
              />
            )}
          </>
        )}
      </div>
    </Dialog>
  );
};
