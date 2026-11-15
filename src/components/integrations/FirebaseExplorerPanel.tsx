import React, { useState, useEffect, useCallback } from "react";
import {
  Database,
  RefreshCw,
  Plus,
  Trash2,
  Save,
  FileCode2,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Upload,
} from "lucide-react";
import {
  FirebaseDocumentSummary,
  FirebaseProjectSummary,
  IntegrationConnection,
  IntegrationCredentialsPayload,
  RemoteFileSource,
} from "../../types/integrations";
import { IIntegrationApiService } from "../../services/integrationService";
import { getErrorMessage } from "../../utils/errorHandling";

export interface FirebaseExplorerPanelProps {
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

export const FirebaseExplorerPanel: React.FC<FirebaseExplorerPanelProps> = ({
  connection,
  credentials,
  apiService,
  activeIdeFile = null,
  onSelectProjectId,
  onReauthorizeOAuth,
  onOpenRemoteFileInIDE,
}) => {
  const [subMode, setSubMode] = useState<"firestore" | "rtdb">("firestore");
  const [projects, setProjects] = useState<FirebaseProjectSummary[]>([]);
  const [activeProjectId, setActiveProjectId] = useState(credentials.projectId || connection.projectId || "");
  const [manualProjectInput, setManualProjectInput] = useState("");
  const [collections, setCollections] = useState<string[]>([]);
  const [collectionPath, setCollectionPath] = useState("");
  const [documents, setDocuments] = useState<FirebaseDocumentSummary[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<FirebaseDocumentSummary | null>(null);
  const [docIdInput, setDocIdInput] = useState("");
  const [docJsonInput, setDocJsonInput] = useState('{\n  "updatedAt": "now"\n}');
  const [mergeWrite, setMergeWrite] = useState(true);
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(null);

  // RTDB state
  const [rtdbUrl, setRtdbUrl] = useState("");
  const [rtdbPath, setRtdbPath] = useState("/");
  const [rtdbJson, setRtdbJson] = useState("{}");

  const [isLoading, setIsLoading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const scopedCreds = useCallback(
    (projectOverride?: string): IntegrationCredentialsPayload => ({
      ...credentials,
      projectId: (projectOverride ?? activeProjectId).trim() || credentials.projectId,
    }),
    [activeProjectId, credentials]
  );

  const loadProjectsAndCollections = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    let targetProjectId = activeProjectId.trim();
    try {
      const projRes = await apiService.listFirebaseProjects(scopedCreds()).catch(() => ({ projects: [] }));
      setProjects(projRes.projects || []);
      if (!targetProjectId && projRes.projects.length > 0) {
        targetProjectId = projRes.projects[0].projectId;
        setActiveProjectId(targetProjectId);
        onSelectProjectId?.(targetProjectId);
        if (projRes.projects[0].rtdbUrl && !rtdbUrl) {
          setRtdbUrl(projRes.projects[0].rtdbUrl);
        }
      }
      if (targetProjectId) {
        const res = await apiService.listFirebaseCollections(scopedCreds(targetProjectId));
        setCollections(res.collectionIds || []);
        if (res.collectionIds.length > 0 && !collectionPath) {
          setCollectionPath(res.collectionIds[0]);
        }
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [activeProjectId, apiService, collectionPath, onSelectProjectId, rtdbUrl, scopedCreds]);

  const loadCollections = useCallback(
    async (projectOverride?: string) => {
      const targetProj = (projectOverride ?? activeProjectId).trim();
      if (!targetProj) {
        await loadProjectsAndCollections();
        return;
      }
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiService.listFirebaseCollections(scopedCreds(targetProj));
        setCollections(res.collectionIds || []);
        if (res.collectionIds.length > 0) {
          setCollectionPath((prev) => prev || res.collectionIds[0]);
        }
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [activeProjectId, apiService, loadProjectsAndCollections, scopedCreds]
  );

  const loadDocuments = useCallback(
    async (targetCol?: string) => {
      const col = (targetCol ?? collectionPath).trim();
      if (!col) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const res = await apiService.listFirebaseDocuments(scopedCreds(), col, 50);
        setDocuments(res.documents || []);
        setFeedbackMsg(`Loaded ${res.documents.length} document${res.documents.length === 1 ? "" : "s"} from '${col}'`);
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [apiService, collectionPath, scopedCreds]
  );

  useEffect(() => {
    setActiveProjectId(credentials.projectId || connection.projectId || "");
    setCollections([]);
    setDocuments([]);
    setSelectedDoc(null);
    setErrorMsg(null);
    setFeedbackMsg(null);
    void loadProjectsAndCollections();
  }, [connection.id]);

  const handleSelectDocument = (doc: FirebaseDocumentSummary) => {
    setSelectedDoc(doc);
    setDocIdInput(doc.id);
    setDocJsonInput(JSON.stringify(doc.data, null, 2));
    setConfirmDeletePath(null);
    setErrorMsg(null);
  };

  const handleWriteDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setFeedbackMsg(null);

    const col = collectionPath.trim();
    if (!col) {
      setErrorMsg("Enter a collection path first (e.g. users or settings).");
      return;
    }

    let parsedData: Record<string, unknown>;
    try {
      const raw = JSON.parse(docJsonInput) as unknown;
      if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
        setErrorMsg("Firestore document body must be a JSON object.");
        return;
      }
      parsedData = raw as Record<string, unknown>;
    } catch {
      setErrorMsg("Invalid JSON payload. Check syntax and try again.");
      return;
    }

    setIsWriting(true);
    try {
      const res = await apiService.writeFirebaseDocument(
        scopedCreds(),
        col,
        parsedData,
        docIdInput.trim() || undefined,
        mergeWrite
      );
      setSelectedDoc(res.document);
      setDocIdInput(res.document.id);
      setDocJsonInput(JSON.stringify(res.document.data, null, 2));
      setFeedbackMsg(`Saved document '${res.document.path}'`);
      await loadDocuments(col);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleDeleteDocument = async (documentPath: string) => {
    setIsWriting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      await apiService.deleteFirebaseDocument(scopedCreds(), documentPath);
      setDocuments((prev) => prev.filter((d) => d.path !== documentPath));
      if (selectedDoc?.path === documentPath) {
        setSelectedDoc(null);
        setDocIdInput("");
      }
      setConfirmDeletePath(null);
      setFeedbackMsg(`Deleted document '${documentPath}'`);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleOpenInIDE = (doc: FirebaseDocumentSummary) => {
    if (!onOpenRemoteFileInIDE) return;
    onOpenRemoteFileInIDE({
      path: `firebase/${doc.path}.json`,
      name: `${doc.id}.json`,
      language: "json",
      content: JSON.stringify(doc.data, null, 2),
      remoteSource: {
        providerId: "firebase",
        connectionId: connection.id,
        collectionPath: collectionPath.trim(),
        docId: doc.id,
      },
    });
  };

  const handlePushActiveIdeFile = () => {
    if (!activeIdeFile) return;
    try {
      const parsed = JSON.parse(activeIdeFile.content) as Record<string, unknown>;
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        setDocJsonInput(JSON.stringify(parsed, null, 2));
      } else {
        setDocJsonInput(JSON.stringify({ content: activeIdeFile.content, fileName: activeIdeFile.name }, null, 2));
      }
    } catch {
      setDocJsonInput(
        JSON.stringify(
          {
            fileName: activeIdeFile.name,
            filePath: activeIdeFile.path,
            content: activeIdeFile.content,
          },
          null,
          2
        )
      );
    }
    if (!docIdInput.trim()) {
      setDocIdInput(activeIdeFile.name.replace(/[^a-zA-Z0-9._-]/g, "_"));
    }
    setFeedbackMsg(`Loaded '${activeIdeFile.name}' into document editor below. Review & Save to Firestore.`);
  };

  const handleReadRtdb = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await apiService.readFirebaseRtdb(scopedCreds(), rtdbPath, rtdbUrl.trim() || undefined);
      setRtdbJson(JSON.stringify(res.data ?? null, null, 2));
      setFeedbackMsg(`Read RTDB node ${rtdbPath || "/"}`);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleWriteRtdb = async () => {
    setErrorMsg(null);
    setFeedbackMsg(null);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rtdbJson);
    } catch {
      setErrorMsg("RTDB value must be valid JSON.");
      return;
    }
    setIsWriting(true);
    try {
      const res = await apiService.writeFirebaseRtdb(scopedCreds(), rtdbPath, parsed, rtdbUrl.trim() || undefined);
      setRtdbJson(JSON.stringify(res.data ?? null, null, 2));
      setFeedbackMsg(`Wrote RTDB node ${rtdbPath || "/"}`);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleSelectProject = (nextProjId: string) => {
    setActiveProjectId(nextProjId);
    setCollections([]);
    setDocuments([]);
    setSelectedDoc(null);
    setCollectionPath("");
    onSelectProjectId?.(nextProjId);
    const meta = projects.find((p) => p.projectId === nextProjId);
    if (meta?.rtdbUrl) setRtdbUrl(meta.rtdbUrl);
    void loadCollections(nextProjId);
  };

  return (
    <div className="space-y-4">
      {/* Sub-mode + Project switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setSubMode("firestore")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "firestore" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Cloud Firestore
          </button>
          <button
            type="button"
            onClick={() => setSubMode("rtdb")}
            className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
              subMode === "rtdb" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Realtime Database
          </button>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          {projects.length > 0 ? (
            <select
              aria-label="Active Firebase Project"
              value={activeProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            >
              {projects.map((p) => (
                <option key={p.projectId} value={p.projectId}>
                  {p.displayName && p.displayName !== p.projectId ? `${p.displayName} (${p.projectId})` : p.projectId}
                </option>
              ))}
            </select>
          ) : activeProjectId ? (
            <span className="text-[11px] font-mono text-muted-foreground truncate">
              Project: {activeProjectId} · DB: {connection.databaseId || "(default)"}
            </span>
          ) : (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                aria-label="Enter Firebase Project ID"
                value={manualProjectInput}
                onChange={(e) => setManualProjectInput(e.target.value)}
                placeholder="Enter project-id..."
                className="w-36 bg-background border border-border rounded-lg px-2.5 py-1 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
              />
              <button
                type="button"
                onClick={() => manualProjectInput.trim() && handleSelectProject(manualProjectInput.trim())}
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground cursor-pointer"
              >
                Load
              </button>
            </div>
          )}
        </div>
      </div>

      {subMode === "firestore" ? (
        <div className="space-y-4">
          {/* Root collections & collection path bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="fb-collection-input" className="text-xs font-medium text-foreground block">
                Collection Path
              </label>
              <button
                type="button"
                onClick={() => void loadCollections()}
                disabled={isLoading}
                className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
                <span>Refresh Collections</span>
              </button>
            </div>

            {collections.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {collections.map((cid) => (
                  <button
                    key={cid}
                    type="button"
                    onClick={() => {
                      setCollectionPath(cid);
                      void loadDocuments(cid);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-colors cursor-pointer ${
                      collectionPath === cid
                        ? "bg-primary/15 text-primary font-semibold"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cid}
                  </button>
                ))}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                id="fb-collection-input"
                type="text"
                value={collectionPath}
                onChange={(e) => setCollectionPath(e.target.value)}
                placeholder="e.g. users or projects/demo/tasks"
                className="flex-1 bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
              />
              <button
                type="button"
                onClick={() => void loadDocuments()}
                disabled={isLoading || !collectionPath.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                <span>Load Documents</span>
              </button>
            </div>
          </div>

          {/* Documents List */}
          {documents.length > 0 && (
            <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3 max-h-56 overflow-y-auto">
              {documents.map((doc) => {
                const isSelected = selectedDoc?.path === doc.path;
                const isConfirming = confirmDeletePath === doc.path;
                return (
                  <div key={doc.path} className="py-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleSelectDocument(doc)}
                      className="min-w-0 flex-1 text-start cursor-pointer group"
                    >
                      <span
                        className={`text-xs font-mono block truncate ${
                          isSelected ? "text-primary font-semibold" : "text-foreground group-hover:text-primary"
                        }`}
                      >
                        {doc.id}
                      </span>
                      <span className="text-[11px] text-muted-foreground block truncate">
                        {Object.keys(doc.data).length} field{Object.keys(doc.data).length === 1 ? "" : "s"}
                        {doc.updateTime ? ` · Updated ${new Date(doc.updateTime).toLocaleDateString()}` : ""}
                      </span>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      {onOpenRemoteFileInIDE && (
                        <button
                          type="button"
                          onClick={() => handleOpenInIDE(doc)}
                          aria-label={`Open ${doc.id} in Mobile IDE`}
                          title="Open JSON in Mobile IDE"
                          className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                        >
                          <FileCode2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDeleteDocument(doc.path)}
                            className="px-2 py-1 rounded-lg bg-muted border border-border text-foreground hover:bg-destructive hover:text-destructive-foreground transition-colors text-[11px] font-semibold cursor-pointer"
                          >
                            Confirm
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeletePath(null)}
                            className="px-2 py-1 rounded-lg bg-muted text-foreground text-[11px] cursor-pointer"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeletePath(doc.path)}
                          aria-label={`Delete ${doc.id}`}
                          title="Delete document"
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

          {/* Create / Update Document Editor */}
          <form onSubmit={(e) => void handleWriteDocument(e)} className="p-3.5 rounded-xl bg-muted/30 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-foreground">
                {selectedDoc ? `Edit Document: ${selectedDoc.id}` : "Create or Update Document"}
              </span>
              <div className="flex items-center gap-2">
                {activeIdeFile && (
                  <button
                    type="button"
                    onClick={handlePushActiveIdeFile}
                    className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground flex items-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Use Active IDE File ({activeIdeFile.name})</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDoc(null);
                    setDocIdInput("");
                    setDocJsonInput('{\n  "title": "",\n  "active": true\n}');
                  }}
                  className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="w-3 h-3" />
                  <span>New Doc</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label htmlFor="fb-doc-id" className="text-xs font-medium text-foreground block">
                  Document ID (Leave empty to auto-generate)
                </label>
                <input
                  id="fb-doc-id"
                  type="text"
                  value={docIdInput}
                  onChange={(e) => setDocIdInput(e.target.value)}
                  placeholder="auto-generated-id"
                  className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                />
              </div>
              <div className="flex items-end pb-1.5">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mergeWrite}
                    onChange={(e) => setMergeWrite(e.target.checked)}
                    className="rounded text-primary focus:ring-primary cursor-pointer"
                  />
                  <span>Merge fields (preserve existing keys not listed)</span>
                </label>
              </div>
            </div>

            <div className="space-y-1">
              <label htmlFor="fb-doc-json" className="text-xs font-medium text-foreground block">
                Document JSON Data
              </label>
              <textarea
                id="fb-doc-json"
                rows={6}
                value={docJsonInput}
                onChange={(e) => setDocJsonInput(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary font-mono resize-y"
              />
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isWriting || !collectionPath.trim()}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Write to Firestore</span>
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="space-y-3 p-3.5 rounded-xl bg-muted/30">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="fb-rtdb-url" className="text-xs font-medium text-foreground block">
                Database URL (Optional override)
              </label>
              <input
                id="fb-rtdb-url"
                type="url"
                value={rtdbUrl}
                onChange={(e) => setRtdbUrl(e.target.value)}
                placeholder={`https://${connection.projectId || "my-project"}-default-rtdb.firebaseio.com`}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="fb-rtdb-path" className="text-xs font-medium text-foreground block">
                RTDB Node Path
              </label>
              <input
                id="fb-rtdb-path"
                type="text"
                value={rtdbPath}
                onChange={(e) => setRtdbPath(e.target.value)}
                placeholder="/config/flags"
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="fb-rtdb-json" className="text-xs font-medium text-foreground block">
              JSON Value
            </label>
            <textarea
              id="fb-rtdb-json"
              rows={6}
              value={rtdbJson}
              onChange={(e) => setRtdbJson(e.target.value)}
              className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs text-foreground focus:outline-none focus:border-primary font-mono resize-y"
            />
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleReadRtdb()}
              disabled={isLoading}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              <span>Read Node</span>
            </button>
            <button
              type="button"
              onClick={() => void handleWriteRtdb()}
              disabled={isWriting}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Write Node</span>
            </button>
          </div>
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
