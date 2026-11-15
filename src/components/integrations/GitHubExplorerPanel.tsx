import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  GitBranch,
  GitCommit,
  FolderGit2,
  RefreshCw,
  FileCode2,
  Upload,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Save,
} from "lucide-react";
import {
  GitHubBranchSummary,
  GitHubCommitSummary,
  GitHubRepoSummary,
  GitHubTreeEntry,
  IntegrationConnection,
  IntegrationCredentialsPayload,
  RemoteFileSource,
} from "../../types/integrations";
import { IIntegrationApiService } from "../../services/integrationService";
import { getErrorMessage } from "../../utils/errorHandling";

export interface GitHubExplorerPanelProps {
  connection: IntegrationConnection;
  credentials: IntegrationCredentialsPayload;
  apiService: IIntegrationApiService;
  activeIdeFile?: { path: string; name: string; content: string } | null;
  openedWorkspaceFiles?: Array<{ path: string; name: string; content: string; originalContent: string }>;
  onOpenRemoteFileInIDE?: (file: {
    path: string;
    name: string;
    language: string;
    content: string;
    remoteSource: RemoteFileSource;
  }) => void;
}

function inferLanguageFromPath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (lower.endsWith(".ts") || lower.endsWith(".tsx")) return "typescript";
  if (lower.endsWith(".js") || lower.endsWith(".jsx") || lower.endsWith(".mjs")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".html")) return "html";
  if (lower.endsWith(".css")) return "css";
  return "plaintext";
}

export const GitHubExplorerPanel: React.FC<GitHubExplorerPanelProps> = ({
  connection,
  credentials,
  apiService,
  activeIdeFile = null,
  openedWorkspaceFiles = [],
  onOpenRemoteFileInIDE,
}) => {
  const [repos, setRepos] = useState<GitHubRepoSummary[]>([]);
  const [selectedRepoFull, setSelectedRepoFull] = useState(
    connection.owner && connection.repo ? `${connection.owner}/${connection.repo}` : ""
  );
  const [branches, setBranches] = useState<GitHubBranchSummary[]>([]);
  const [selectedBranch, setSelectedBranch] = useState(connection.branch || "");
  const [treeEntries, setTreeEntries] = useState<GitHubTreeEntry[]>([]);
  const [commits, setCommits] = useState<GitHubCommitSummary[]>([]);
  const [filterQuery, setFilterQuery] = useState("");
  const [viewMode, setViewMode] = useState<"files" | "commits">("files");

  // Single file read/write editor
  const [editingPath, setEditingPath] = useState("");
  const [editingSha, setEditingSha] = useState<string | undefined>(undefined);
  const [editingContent, setEditingContent] = useState("");
  const [commitMessage, setCommitMessage] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [confirmDeletePath, setConfirmDeletePath] = useState<{ path: string; sha: string } | null>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const selectedRepoObj = useMemo(
    () => repos.find((r) => r.fullName === selectedRepoFull) || null,
    [repos, selectedRepoFull]
  );

  const owner = selectedRepoObj?.owner || selectedRepoFull.split("/")[0] || "";
  const repo = selectedRepoObj?.name || selectedRepoFull.split("/")[1] || "";

  const loadRepos = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await apiService.listGitHubRepos(credentials);
      setRepos(res.repos || []);
      if (res.repos.length > 0 && !selectedRepoFull) {
        setSelectedRepoFull(res.repos[0].fullName);
        setSelectedBranch(res.repos[0].defaultBranch);
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [apiService, credentials, selectedRepoFull]);

  const loadRepoData = useCallback(
    async (targetOwner: string, targetRepo: string, branchHint?: string) => {
      if (!targetOwner || !targetRepo) return;
      setIsLoading(true);
      setErrorMsg(null);
      try {
        const brRes = await apiService.listGitHubBranches(credentials, targetOwner, targetRepo);
        setBranches(brRes.branches || []);
        const resolvedBranch =
          branchHint ||
          selectedBranch ||
          selectedRepoObj?.defaultBranch ||
          brRes.branches[0]?.name ||
          "main";
        setSelectedBranch(resolvedBranch);

        const [treeRes, commitRes] = await Promise.all([
          apiService.getGitHubTree(credentials, targetOwner, targetRepo, resolvedBranch),
          apiService.listGitHubCommits(credentials, targetOwner, targetRepo, resolvedBranch),
        ]);
        setTreeEntries(treeRes.entries || []);
        setCommits(commitRes.commits || []);
      } catch (err) {
        setErrorMsg(getErrorMessage(err));
      } finally {
        setIsLoading(false);
      }
    },
    [apiService, credentials, selectedBranch, selectedRepoObj?.defaultBranch]
  );

  useEffect(() => {
    setRepos([]);
    setTreeEntries([]);
    setCommits([]);
    setErrorMsg(null);
    setFeedbackMsg(null);
    void loadRepos();
  }, [connection.id]);

  useEffect(() => {
    if (owner && repo) {
      void loadRepoData(owner, repo, selectedRepoObj?.defaultBranch || selectedBranch);
    }
  }, [selectedRepoFull]);

  const blobEntries = useMemo(() => {
    const blobs = treeEntries.filter((e) => e.type === "blob");
    const q = filterQuery.trim().toLowerCase();
    if (!q) return blobs.slice(0, 100);
    return blobs.filter((b) => b.path.toLowerCase().includes(q)).slice(0, 100);
  }, [treeEntries, filterQuery]);

  const handleOpenGitHubFile = async (entry: GitHubTreeEntry) => {
    if (!owner || !repo) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const file = await apiService.readGitHubFile(credentials, owner, repo, entry.path, selectedBranch);
      if (onOpenRemoteFileInIDE) {
        const fileName = file.path.split("/").pop() || file.path;
        onOpenRemoteFileInIDE({
          path: file.path,
          name: fileName,
          language: inferLanguageFromPath(file.path),
          content: file.content,
          remoteSource: {
            providerId: "github",
            connectionId: connection.id,
            owner,
            repo,
            branch: selectedBranch,
            sha: file.sha,
          },
        });
      } else {
        setEditingPath(file.path);
        setEditingSha(file.sha);
        setEditingContent(file.content);
        setCommitMessage(`Update ${file.path}`);
        setFeedbackMsg(`Loaded '${file.path}' into commit editor below.`);
      }
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCommitSingleFile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!owner || !repo || !editingPath.trim()) {
      setErrorMsg("Repository and file path are required.");
      return;
    }
    setIsWriting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await apiService.writeGitHubFile(credentials, {
        owner,
        repo,
        branch: selectedBranch || undefined,
        path: editingPath.trim().replace(/^\/+/, ""),
        content: editingContent,
        message: commitMessage.trim() || `Update ${editingPath.trim()}`,
        sha: editingSha,
      });
      setEditingSha(res.sha);
      setFeedbackMsg(`Committed '${editingPath.trim()}' (${res.commitSha.slice(0, 7)})`);
      await loadRepoData(owner, repo, selectedBranch);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const dirtyWorkspaceFiles = useMemo(
    () => openedWorkspaceFiles.filter((f) => f.content !== f.originalContent),
    [openedWorkspaceFiles]
  );

  const handleBatchPushDirtyFiles = async () => {
    const filesToPush = dirtyWorkspaceFiles.length > 0 ? dirtyWorkspaceFiles : openedWorkspaceFiles;
    if (!owner || !repo || filesToPush.length === 0) return;
    setIsWriting(true);
    setErrorMsg(null);
    setFeedbackMsg(null);
    try {
      const res = await apiService.batchPushGitHubFiles(credentials, {
        owner,
        repo,
        branch: selectedBranch || "main",
        message: commitMessage.trim() || `Sync ${filesToPush.length} workspace file(s) from AI Studio IDE`,
        files: filesToPush.map((f) => ({ path: f.path.replace(/^\/+/, ""), content: f.content })),
      });
      setFeedbackMsg(`Pushed ${res.filesCount} file(s) to ${owner}/${repo}@${selectedBranch} (${res.commitSha.slice(0, 7)})`);
      await loadRepoData(owner, repo, selectedBranch);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleDeleteGitHubFile = async (target: { path: string; sha: string }) => {
    if (!owner || !repo) return;
    setIsWriting(true);
    setErrorMsg(null);
    try {
      await apiService.deleteGitHubFile(credentials, {
        owner,
        repo,
        branch: selectedBranch || undefined,
        path: target.path,
        message: `Delete ${target.path}`,
        sha: target.sha,
      });
      setConfirmDeletePath(null);
      setFeedbackMsg(`Deleted '${target.path}'`);
      await loadRepoData(owner, repo, selectedBranch);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!owner || !repo || !newBranchName.trim()) return;
    setIsWriting(true);
    setErrorMsg(null);
    try {
      const created = newBranchName.trim();
      await apiService.createGitHubBranch(credentials, {
        owner,
        repo,
        newBranch: created,
        fromBranch: selectedBranch || undefined,
      });
      setSelectedBranch(created);
      setNewBranchName("");
      setFeedbackMsg(`Created branch '${created}'`);
      await loadRepoData(owner, repo, created);
    } catch (err) {
      setErrorMsg(getErrorMessage(err));
    } finally {
      setIsWriting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Repository & Branch Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label htmlFor="gh-repo-select" className="text-xs font-medium text-foreground block">
              Repository
            </label>
            <button
              type="button"
              onClick={() => void loadRepos()}
              disabled={isLoading}
              className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3 h-3 ${isLoading ? "animate-spin" : ""}`} />
              <span>Reload</span>
            </button>
          </div>
          <select
            id="gh-repo-select"
            value={selectedRepoFull}
            onChange={(e) => {
              setSelectedRepoFull(e.target.value);
              const nextRepo = repos.find((r) => r.fullName === e.target.value);
              setSelectedBranch(nextRepo?.defaultBranch || "main");
            }}
            className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          >
            {repos.length === 0 && <option value="">Select repository...</option>}
            {repos.map((r) => (
              <option key={r.id} value={r.fullName}>
                {r.fullName} {r.private ? "(Private)" : "(Public)"}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="gh-branch-select" className="text-xs font-medium text-foreground block">
            Branch
          </label>
          <div className="flex gap-2">
            <select
              id="gh-branch-select"
              value={selectedBranch}
              onChange={(e) => {
                setSelectedBranch(e.target.value);
                if (owner && repo) {
                  void loadRepoData(owner, repo, e.target.value);
                }
              }}
              className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            >
              {branches.length === 0 && <option value={selectedBranch || "main"}>{selectedBranch || "main"}</option>}
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Create Branch + View Mode Switcher */}
      {owner && repo && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setViewMode("files")}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "files" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Files ({treeEntries.filter((e) => e.type === "blob").length})
            </button>
            <button
              type="button"
              onClick={() => setViewMode("commits")}
              className={`min-h-[36px] px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                viewMode === "commits" ? "bg-card text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Commits ({commits.length})
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={newBranchName}
              onChange={(e) => setNewBranchName(e.target.value)}
              placeholder="new-branch-name"
              aria-label="New branch name"
              className="w-36 sm:w-44 bg-background border border-border rounded-xl px-2.5 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => void handleCreateBranch()}
              disabled={isWriting || !newBranchName.trim()}
              className="min-h-[36px] px-3 py-1 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-xs font-medium flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Branch</span>
            </button>
          </div>
        </div>
      )}

      {/* Files / Commits Browser */}
      {viewMode === "files" ? (
        <div className="space-y-2">
          <input
            type="search"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filter repository files (e.g. src/, package.json)..."
            aria-label="Filter repository files"
            className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
          />

          {blobEntries.length > 0 ? (
            <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3 max-h-56 overflow-y-auto">
              {blobEntries.map((entry) => {
                const isConfirming = confirmDeletePath?.path === entry.path;
                return (
                  <div key={entry.path} className="py-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => void handleOpenGitHubFile(entry)}
                      className="min-w-0 flex-1 text-start cursor-pointer group"
                    >
                      <span className="text-xs font-mono text-foreground group-hover:text-primary block truncate">
                        {entry.path}
                      </span>
                      <span className="text-[11px] text-muted-foreground tabular-nums block">
                        {typeof entry.size === "number" ? `${entry.size.toLocaleString()} B` : "—"} · {entry.sha.slice(0, 7)}
                      </span>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => void handleOpenGitHubFile(entry)}
                        aria-label={`Open ${entry.path}`}
                        title={onOpenRemoteFileInIDE ? "Open in Mobile IDE" : "Edit file"}
                        className="min-w-[38px] min-h-[38px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors cursor-pointer"
                      >
                        <FileCode2 className="w-3.5 h-3.5" />
                      </button>
                      {isConfirming ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => void handleDeleteGitHubFile({ path: entry.path, sha: entry.sha })}
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
                          onClick={() => setConfirmDeletePath({ path: entry.path, sha: entry.sha })}
                          aria-label={`Delete ${entry.path}`}
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
          ) : (
            <div className="p-4 rounded-xl bg-muted/30 text-xs text-muted-foreground flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 shrink-0" />
              <span>{isLoading ? "Loading repository tree..." : "No matching files found in this branch."}</span>
            </div>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border/60 rounded-xl bg-muted/30 px-3 max-h-56 overflow-y-auto">
          {commits.map((c) => (
            <div key={c.sha} className="py-2.5 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="text-xs font-medium text-foreground block truncate">{c.message}</span>
                <span className="text-[11px] text-muted-foreground font-mono block truncate">
                  {c.sha.slice(0, 7)} · {c.authorName}
                  {c.date ? ` · ${new Date(c.date).toLocaleDateString()}` : ""}
                </span>
              </div>
              <GitCommit className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
            </div>
          ))}
        </div>
      )}

      {/* Commit / Batch Push Form */}
      <form onSubmit={(e) => void handleCommitSingleFile(e)} className="p-3.5 rounded-xl bg-muted/30 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">Commit File or Push IDE Changes</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {activeIdeFile && (
              <button
                type="button"
                onClick={() => {
                  const cleanPath = activeIdeFile.path.replace(/^\/+/, "");
                  setEditingPath(cleanPath);
                  setEditingContent(activeIdeFile.content);
                  setCommitMessage(`Update ${cleanPath} from Mobile IDE`);
                }}
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground flex items-center gap-1 cursor-pointer"
              >
                <Upload className="w-3 h-3" />
                <span>Load Active IDE File ({activeIdeFile.name})</span>
              </button>
            )}
            {openedWorkspaceFiles.length > 0 && (
              <button
                type="button"
                onClick={() => void handleBatchPushDirtyFiles()}
                disabled={isWriting || !owner || !repo}
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-[11px] font-medium text-foreground flex items-center gap-1 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-3 h-3" />
                <span>
                  Batch Push ({dirtyWorkspaceFiles.length > 0 ? `${dirtyWorkspaceFiles.length} modified` : `${openedWorkspaceFiles.length} open`})
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label htmlFor="gh-commit-path" className="text-xs font-medium text-foreground block">
              Target File Path
            </label>
            <input
              id="gh-commit-path"
              type="text"
              value={editingPath}
              onChange={(e) => {
                setEditingPath(e.target.value);
                setEditingSha(undefined);
              }}
              placeholder="src/config.ts"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="gh-commit-msg" className="text-xs font-medium text-foreground block">
              Commit Message
            </label>
            <input
              id="gh-commit-msg"
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="chore: update configuration"
              className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label htmlFor="gh-commit-content" className="text-xs font-medium text-foreground block">
            File Content
          </label>
          <textarea
            id="gh-commit-content"
            rows={5}
            value={editingContent}
            onChange={(e) => setEditingContent(e.target.value)}
            placeholder="Paste file contents or load active IDE file..."
            className="w-full bg-background border border-border rounded-xl px-3 py-2.5 text-xs font-mono text-foreground focus:outline-none focus:border-primary resize-y"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isWriting || !owner || !repo || !editingPath.trim()}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isWriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>Commit &amp; Push to {selectedBranch || "main"}</span>
          </button>
        </div>
      </form>

      {feedbackMsg && (
        <div className="p-3 rounded-xl bg-muted/50 text-foreground text-xs flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="p-3 rounded-xl bg-muted/60 border border-border text-foreground text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
