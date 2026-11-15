import React, { useState, useEffect, useCallback } from "react";
import {
  Cloud,
  RefreshCw,
  Trash2,
  Upload,
  Eye,
  Plus,
  FileCode2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  GcpCloudRunServiceSummary,
  GcpProjectSummary,
  GcpSecretSummary,
  GcsBucketSummary,
  GcsObjectSummary,
  IntegrationConnection,
  IntegrationCredentialsPayload,
  RemoteFileSource,
} from "../../types/integrations";
import { IIntegrationApiService } from "../../services/integrationService";
import { getErrorMessage } from "../../utils/errorHandling";

export interface GcpExplorerPanelProps {
  connection: IntegrationConnection;
  credentials: IntegrationCredentialsPayload;
  apiService: IIntegrationApiService;
  activeIdeFile?: { path: string; name: string; content: string } | null;
  onSelectProjectId?: (projectId: string) => void;
  onReauthorizeOAuth?: () => void;
  onOpenRemoteFileInIDE?: (file: {
    path: string;
    name: string;
    language: string;
    content: string;
    remoteSource: RemoteFileSource;
  }) => void;
}

function inferLanguageFromName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".css")) return "css";
  return "plaintext";
}

export const GcpExplorerPanel: React.FC<GcpExplorerPanelProps> = ({
  connection,
  credentials,
  apiService,
  activeIdeFile = null,
  onSelectProjectId,
  onReauthorizeOAuth,
  onOpenRemoteFileInIDE,
}) => {
  const [subMode, setSubMode] = useState<"gcs" | "secrets" | "cloudrun">("gcs");
  const [projects, setProjects] = useState<GcpProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(credentials.projectId || connection.projectId || "");
  const [manualProjectInput, setManualProjectInput] = useState("");

  // GCS state
  const [buckets, setBuckets] = useState<GcsBucketSummary[]>([]);
  const [selectedBucket, setSelectedBucket] = useState(connection.bucket || "");
  const [prefix, setPrefix] = useState("");
  const [objects, setObjects] = useState<GcsObjectSummary[]>([]);
  const [uploadObjectName, setUploadObjectName] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [confirmDeleteObject, setConfirmDeleteObject] = useState<string | null>(null);

  // Secrets state
  const [secrets, setSecrets] = useState<GcpSecretSummary[]>([]);
  const [revealedSecret, setRevealedSecret] = useState<{ id: string; value: string } | null>(null);
  const [newSecretId, setNewSecretId] = useState("");
  const [newSecretValue, setNewSecretValue] = useState("");

  // Cloud Run state
  const [services, setServices] = useState<GcpCloudRunServiceSummary[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const scopedCreds = useCallback(
    (): IntegrationCredentialsPayload => ({
      ...credentials,
      projectId: activeProjectId.trim() || credentials.projectId,
    }),
    [activeProjectId, credentials]
  );

  const loadGcsBuckets = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const creds = scopedCreds();
      const [projRes, bucketRes] = await Promise.allSettled([
        apiService.listGcpProjects(creds),
        apiService.listGcsBuckets(creds),
      ]);
      if (projRes.status === "fulfilled") {
        setProjects(projRes.value.projects || []);
        if (!activeProjectId && projRes.value.projects.length > 0) {
          const firstId = projRes.value.projects[0].projectId;
          setActiveProjectId(firstId);
          onSelectProjectId?.(firstId);
        }
      }
      if (bucketRes.status === "fulfilled") {
        const list = bucketRes.value.buckets || [];
        setBuckets(list);
        if (list.length > 0 && !selectedBucket) {
          setSelectedBucket(list[0].name);
        }
      } else {
        throw bucketRes.reason;
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, apiService, scopedCreds, selectedBucket]);

  const loadObjects = useCallback(
    async (bucketOverride?: string) => {
      const bucket = (bucketOverride ?? selectedBucket).trim();
      if (!bucket) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiService.listGcsObjects(scopedCreds(), bucket, prefix.trim() || undefined);
        setObjects(res.objects || []);
        setFeedbackMsg(`Loaded ${res.objects.length} object${res.objects.length === 1 ? "" : "s"} from gs://${bucket}`);
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [apiService, prefix, scopedCreds, selectedBucket]
  );

  const loadSecrets = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiService.listGcpSecrets(scopedCreds());
      setSecrets(res.secrets || []);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [apiService, scopedCreds]);

  const loadCloudRun = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiService.listCloudRunServices(scopedCreds());
      setServices(res.services || []);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [apiService, scopedCreds]);

  useEffect(() => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    if (subMode === "gcs") {
      void loadGcsBuckets();
    } else if (subMode === "secrets") {
      void loadSecrets();
    } else {
      void loadCloudRun();
    }
  }, [connection.id, subMode]);

  const handleOpenObjectInIDE = async (obj: GcsObjectSummary) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiService.readGcsObject(scopedCreds(), obj.bucket, obj.name);
      if (onOpenRemoteFileInIDE) {
        const fileName = obj.name.split("/").pop() || obj.name;
        onOpenRemoteFileInIDE({
          path: `gcs/${obj.bucket}/${obj.name}`,
          name: fileName,
          language: inferLanguageFromName(fileName),
          content: res.content,
          remoteSource: {
            providerId: "gcp",
            connectionId: connection.id,
            bucket: obj.bucket,
            objectName: obj.name,
          },
        });
      } else {
        setUploadObjectName(obj.name);
        setUploadContent(res.content);
        setFeedbackMsg(`Loaded '${obj.name}' into editor below.`);
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadObject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBucket.trim() || !uploadObjectName.trim()) {
      setErrorMsg("Select a bucket and specify an object name.");
      return;
    }
    setIsWriting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const name = uploadObjectName.trim();
      const contentType = name.endsWith(".json")
        ? "application/json; charset=utf-8"
        : "text/plain; charset=utf-8";
      await apiService.writeGcsObject(scopedCreds(), selectedBucket.trim(), name, uploadContent, contentType);
      setFeedbackMsg(`Uploaded gs://${selectedBucket.trim()}/${name}`);
      await loadObjects(selectedBucket.trim());
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleDeleteObject = async (obj: GcsObjectSummary) => {
    setIsWriting(true);
    setErrorMsg(null);
    try {
      await apiService.deleteGcsObject(scopedCreds(), obj.bucket, obj.name);
      setObjects((prev) => prev.filter((o) => o.name !== obj.name));
      setConfirmDeleteObject(null);
      setFeedbackMsg(`Deleted gs://${obj.bucket}/${obj.name}`);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleRevealSecret = async (secretId: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiService.accessGcpSecret(scopedCreds(), secretId, "latest");
      setRevealedSecret({ id: secretId, value: res.value });
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleWriteSecret = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSecretId.trim() || !newSecretValue) {
      setErrorMsg("Secret ID and Secret Value are required.");
      return;
    }
    setIsWriting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await apiService.writeGcpSecret(scopedCreds(), newSecretId.trim(), newSecretValue);
      setFeedbackMsg(`Saved secret version for '${newSecretId.trim()}'`);
      setNewSecretValue("");
      await loadSecrets();
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Sub-mode + Project Selector */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSubMode("gcs")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "gcs" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cloud Storage
          </button>
          <button
            type="button"
            onClick={() => setSubMode("secrets")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "secrets" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Secret Manager
          </button>
          <button
            type="button"
            onClick={() => setSubMode("cloudrun")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "cloudrun" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cloud Run
          </button>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {projects.length > 0 ? (
            <select
              aria-label="Active GCP Project"
              value={activeProjectId}
              onChange={(e) => {
                const nextId = e.target.value;
                setActiveProjectId(nextId);
                onSelectProjectId?.(nextId);
              }}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.name && p.name !== p.projectId ? `${p.name} (${p.projectId})` : p.projectId}
                </option>
              ))}
            </select>
          ) : activeProjectId ? (
            <span className="text-[11px] font-mono text-muted-foreground">
              Project: {activeProjectId}
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label="Enter GCP Project ID"
                value={manualProjectInput}
                onChange={(e) => setManualProjectInput(e.target.value)}
                placeholder="Enter project-id..."
                className="w-36 bg-background border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => {
                  const next = manualProjectInput.trim();
                  if (!next) return;
                  setActiveProjectId(next);
                  onSelectProjectId?.(next);
                }}
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground cursor-pointer"
              >
                Load
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Cloud Storage Explorer */}
      {subMode === "gcs" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label htmlFor="gcp-bucket-select" className="text-xs font-medium text-foreground block">
                  GCS Bucket
                </label>
                <button
                  type="button"
                  onClick={() => void loadGcsBuckets()}
                  disabled={isLoading}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                  <span>Refresh</span>
                </button>
              </div>
              {buckets.length > 0 ? (
                <select
                  id="gcp-bucket-select"
                  value={selectedBucket}
                  onChange={(e) => {
                    setSelectedBucket(e.target.value);
                    void loadObjects(e.target.value);
                  }}
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                >
                  {buckets.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name} ({b.location || "global"})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="gcp-bucket-select"
                  type="text"
                  value={selectedBucket}
                  onChange={(e) => setSelectedBucket(e.target.value)}
                  placeholder="my-gcs-bucket"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="gcp-prefix-input" className="text-xs font-medium text-foreground block">
                Object Prefix Filter
              </label>
              <div className="flex gap-2">
                <input
                  id="gcp-prefix-input"
                  type="text"
                  value={prefix}
                  onChange={(e) => setPrefix(e.target.value)}
                  placeholder="config/ or logs/"
                  className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => void loadObjects()}
                  disabled={isLoading || !selectedBucket.trim()}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
                >
                  List Objects
                </button>
              </div>
            </div>
          </div>

          {objects.length > 0 && (
            <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3 max-h-56 overflow-y-auto">
              {objects.map((obj) => {
                const isConfirming = confirmDeleteObject === obj.name;
                return (
                  <div key={obj.name} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-xs font-mono text-foreground block truncate">{obj.name}</span>
                      <span className="text-[11px] text-muted-foreground tabular-nums block truncate">
                        {obj.size.toLocaleString()} B · {obj.contentType || "application/octet-stream"}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleOpenObjectInIDE(obj)}
                        title={onOpenRemoteFileInIDE ? "Open in Mobile IDE" : "Load into editor"}
                        aria-label={`Read ${obj.name}`}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                      </button>
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDeleteObject(obj)}
                            className="px-2 py-1 rounded-lg bg-muted border border-border text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors text-[11px] font-semibold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteObject(null)}
                            className="px-2 py-1 rounded-lg bg-muted text-foreground text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteObject(obj.name)}
                          aria-label={`Delete ${obj.name}`}
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-muted transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Upload / Write GCS Object */}
          <form onSubmit={(e) => void handleUploadObject(e)} className="p-3.5 rounded-xl bg-muted/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">Upload / Update GCS Object</span>
              {activeIdeFile && (
                <button
                  type="button"
                  onClick={() => {
                    setUploadObjectName(activeIdeFile.path.replace(/^\/+/, ""));
                    setUploadContent(activeIdeFile.content);
                  }}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <Upload className="w-3 h-3" />
                  <span>Load Active IDE File ({activeIdeFile.name})</span>
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label htmlFor="gcp-upload-name" className="text-xs font-medium text-foreground block">
                Object Path in Bucket
              </label>
              <input
                id="gcp-upload-name"
                type="text"
                value={uploadObjectName}
                onChange={(e) => setUploadObjectName(e.target.value)}
                placeholder="exports/config.json"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="gcp-upload-content" className="text-xs font-medium text-foreground block">
                Object Content
              </label>
              <textarea
                id="gcp-upload-content"
                rows={5}
                value={uploadContent}
                onChange={(e) => setUploadContent(e.target.value)}
                placeholder="Paste text, JSON, or code to upload..."
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isWriting || !selectedBucket.trim() || !uploadObjectName.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                <span>Upload to GCS</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Secret Manager */}
      {subMode === "secrets" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Project Secrets</span>
            <button
              type="button"
              onClick={() => void loadSecrets()}
              disabled={isLoading}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {secrets.length > 0 ? (
            <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3">
              {secrets.map((sec) => (
                <div key={sec.name} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-foreground block truncate">{sec.shortName}</span>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      Replication: {sec.replication || "automatic"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRevealSecret(sec.shortName)}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-medium flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Access Latest</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No secrets found or Secret Manager API inactive.</p>
          )}

          {revealedSecret && (
            <div className="p-3 rounded-xl bg-muted/50 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-semibold text-foreground">{revealedSecret.id} (latest)</span>
                <button
                  type="button"
                  onClick={() => setRevealedSecret(null)}
                  className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  Hide
                </button>
              </div>
              <pre className="text-xs font-mono text-foreground bg-background p-2.5 rounded-lg overflow-x-auto select-all">
                {revealedSecret.value}
              </pre>
            </div>
          )}

          <form onSubmit={(e) => void handleWriteSecret(e)} className="p-3.5 rounded-xl bg-muted/30 space-y-3">
            <span className="text-xs font-semibold text-foreground block">Create Secret or Add New Version</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="gcp-secret-id" className="text-xs font-medium text-foreground block">
                  Secret ID
                </label>
                <input
                  id="gcp-secret-id"
                  type="text"
                  value={newSecretId}
                  onChange={(e) => setNewSecretId(e.target.value)}
                  placeholder="API_WEBHOOK_SECRET"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="gcp-secret-val" className="text-xs font-medium text-foreground block">
                  Secret Value
                </label>
                <input
                  id="gcp-secret-val"
                  type="password"
                  value={newSecretValue}
                  onChange={(e) => setNewSecretValue(e.target.value)}
                  placeholder="Paste secret payload..."
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isWriting || !newSecretId.trim() || !newSecretValue}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                <span>Save Secret Version</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Cloud Run Services */}
      {subMode === "cloudrun" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">Cloud Run Services</span>
            <button
              type="button"
              onClick={() => void loadCloudRun()}
              disabled={isLoading}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
          {services.length > 0 ? (
            <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3">
              {services.map((svc) => (
                <div key={svc.name} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs font-mono font-semibold text-foreground block truncate">
                      {svc.shortName}
                    </span>
                    <span className="text-[11px] text-muted-foreground block truncate">
                      {svc.region || "global"} · {svc.uri || "—"}
                    </span>
                  </div>
                  {svc.uri && (
                    <a
                      href={svc.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground text-[11px] font-medium flex items-center gap-1 shrink-0"
                    >
                      <span>Open</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
              <Cloud className="w-4 h-4 shrink-0" />
              <span>No Cloud Run v2 services discovered in this project.</span>
            </div>
          )}
        </div>
      )}

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-muted/50 text-foreground text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-3 rounded-xl bg-muted/60 border border-border text-foreground text-xs flex items-start justify-between gap-2">
          <div className="flex items-start gap-2 min-w-0">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
          {onReauthorizeOAuth && connection.authMethod === "oauth" && (
            <button
              type="button"
              onClick={onReauthorizeOAuth}
              className="px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[11px] font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              Re-authorize
            </button>
          )}
        </div>
      )}
    </div>
  );
};
