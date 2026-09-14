import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Bot,
  GitBranch,
  FolderGit2,
  Clock,
  CheckCircle2,
  AlertCircle,
  PlayCircle,
  ExternalLink,
  Trash2,
  Search,
  ShieldCheck,
  RefreshCw,
  GitPullRequest,
} from "lucide-react";
import { JulesSession, JulesRepository, JulesTaskStatus } from "../types";
import {
  fetchJulesRepositories,
  createNewJulesSession,
  deleteJulesSession,
  getStoredJulesSessions,
} from "../services/julesService";
import { loadStoredJulesApiKey } from "../utils/storage";

interface JulesSessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSessionId: string | null;
  onSelectSession: (session: JulesSession) => void;
  onOpenApiKeyModal: () => void;
}

export const JulesSessionDrawer: React.FC<JulesSessionDrawerProps> = ({
  isOpen,
  onClose,
  activeSessionId,
  onSelectSession,
  onOpenApiKeyModal,
}) => {
  const [sessions, setSessions] = useState<JulesSession[]>([]);
  const [repositories, setRepositories] = useState<JulesRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // New task creation state
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepo, setCustomRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [initialTaskTitle, setInitialTaskTitle] = useState("");

  const refreshSessions = () => {
    const list = getStoredJulesSessions();
    setSessions(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshSessions();
      const key = loadStoredJulesApiKey();
      setHasApiKey(Boolean(key));

      if (key) {
        setLoadingRepos(true);
        fetchJulesRepositories(key)
          .then((repos) => {
            setRepositories(repos);
            if (repos.length > 0 && !selectedRepo) {
              setSelectedRepo(repos[0].fullName);
              setBranch(repos[0].defaultBranch || "main");
            }
          })
          .catch(() => {})
          .finally(() => setLoadingRepos(false));
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCreateSession = (e: React.FormEvent) => {
    e.preventDefault();
    const repo = (selectedRepo || customRepo).trim();
    if (!repo) return;

    const newSess = createNewJulesSession(
      repo,
      branch.trim() || "main",
      initialTaskTitle.trim() || undefined
    );

    refreshSessions();
    setIsCreating(false);
    setSelectedRepo("");
    setCustomRepo("");
    setInitialTaskTitle("");
    onSelectSession(newSess);
    onClose();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteJulesSession(id);
    refreshSessions();
  };

  const getStatusBadge = (status: JulesTaskStatus) => {
    switch (status) {
      case "planning":
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-foreground border border-border flex items-center gap-1">
            <RefreshCw className="w-2.5 h-2.5 animate-spin text-primary" />
            <span>Planning</span>
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-foreground border border-border flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5 text-primary" />
            <span>Needs Review</span>
          </span>
        );
      case "executing":
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
            <PlayCircle className="w-2.5 h-2.5 animate-spin text-primary" />
            <span>Coding</span>
          </span>
        );
      case "completed":
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-foreground border border-border flex items-center gap-1">
            <CheckCircle2 className="w-2.5 h-2.5 text-primary" />
            <span>Completed</span>
          </span>
        );
      case "failed":
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
            <AlertCircle className="w-2.5 h-2.5 text-destructive" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground border border-border">
            Idle
          </span>
        );
    }
  };

  const filteredSessions = sessions.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.repository.toLowerCase().includes(q) ||
      s.branch.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex bg-background/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div className="relative ml-auto w-full max-w-md h-full bg-card border-l border-border shadow-2xl flex flex-col z-10 animate-in slide-in-from-right duration-200 text-foreground">
        {/* Drawer Header */}
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">
                Google Jules Sessions
              </h2>
              <p className="text-[11px] text-muted-foreground">
                Autonomous coding tasks and PR tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="p-2 text-primary hover:text-primary/80 hover:bg-muted rounded-xl transition-colors cursor-pointer"
              title="New Jules Task Session"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Api Key Alert if missing */}
        {!hasApiKey && (
          <div className="m-3 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-destructive" />
              <span>Jules API key required to run tasks</span>
            </div>
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="px-2.5 py-1 rounded-lg bg-destructive/20 hover:bg-destructive/30 text-destructive text-[11px] font-semibold shrink-0 cursor-pointer"
            >
              Configure
            </button>
          </div>
        )}

        {/* New Session Panel (Expandable) */}
        {isCreating && (
          <form
            onSubmit={handleCreateSession}
            className="p-4 bg-muted/30 border-b border-border space-y-3 animate-in slide-in-from-top-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <FolderGit2 className="w-3.5 h-3.5 text-primary" />
                <span>New Jules Session</span>
              </span>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Cancel
              </button>
            </div>

            {repositories.length > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] text-muted-foreground">Target Repository</label>
                  {loadingRepos && (
                    <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                  )}
                </div>
                <select
                  value={selectedRepo}
                  onChange={(e) => {
                    setSelectedRepo(e.target.value);
                    const found = repositories.find((r) => r.fullName === e.target.value);
                    if (found) setBranch(found.defaultBranch || "main");
                  }}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                >
                  {repositories.map((repo) => (
                    <option key={repo.id} value={repo.fullName}>
                      {repo.fullName} ({repo.defaultBranch})
                    </option>
                  ))}
                  <option value="">Other / Enter custom repo...</option>
                </select>
              </div>
            ) : null}

            {(!selectedRepo || repositories.length === 0) && (
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">
                  Repository Name (e.g. owner/repo)
                </label>
                <input
                  type="text"
                  value={customRepo}
                  onChange={(e) => setCustomRepo(e.target.value)}
                  placeholder="github-user/repository"
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary font-mono"
                  required={!selectedRepo}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Base Branch</label>
                <div className="relative flex items-center">
                  <GitBranch className="w-3 h-3 text-muted-foreground absolute left-2.5" />
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-background border border-border rounded-lg pl-7 pr-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-muted-foreground">Session Name</label>
                <input
                  type="text"
                  value={initialTaskTitle}
                  onChange={(e) => setInitialTaskTitle(e.target.value)}
                  placeholder="e.g. Fix auth flow"
                  className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-semibold shadow-md active:scale-95 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" />
              <span>Create Task Workspace</span>
            </button>
          </form>
        )}

        {/* Search Bar */}
        <div className="p-3 border-b border-border bg-muted/20">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks or repositories..."
              className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {filteredSessions.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center p-4">
              <Bot className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-xs font-medium text-foreground">
                {searchQuery ? "No matching sessions found" : "No Jules sessions yet"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                Start a new task on any GitHub repository authorized in your Jules account.
              </p>
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="mt-3 px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20 text-xs font-medium hover:bg-primary/20 transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Create First Task</span>
              </button>
            </div>
          ) : (
            filteredSessions.map((session) => {
              const isActive = session.id === activeSessionId;
              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer group ${
                    isActive
                      ? "bg-primary/10 border-primary/40 shadow-sm"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {session.title || "Untitled Jules Task"}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                        <FolderGit2 className="w-3 h-3 text-primary shrink-0" />
                        <span className="font-mono truncate">{session.repository}</span>
                        <span>•</span>
                        <GitBranch className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span className="font-mono text-foreground">{session.branch}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {getStatusBadge(session.status)}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(session.id, e)}
                        className="p-1 text-muted-foreground hover:text-destructive rounded transition-colors opacity-0 group-hover:opacity-100 cursor-pointer"
                        title="Delete Session"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {session.pullRequest && (
                    <div className="mt-2 pt-2 border-t border-border flex items-center justify-between text-[11px]">
                      <a
                        href={session.pullRequest.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-primary hover:text-primary/80 font-semibold flex items-center gap-1"
                      >
                        <GitPullRequest className="w-3 h-3 text-primary" />
                        <span>PR #{session.pullRequest.number} Created</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {session.pullRequest.branch}
                      </span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(session.updatedAt).toLocaleDateString()}</span>
                    </div>
                    <span className="font-mono">{session.steps.length} steps</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-border bg-muted/40 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span className="text-[11px]">Single account-level key</span>
          </div>

          <button
            type="button"
            onClick={onOpenApiKeyModal}
            className="text-[11px] text-primary hover:text-primary/80 font-medium cursor-pointer"
          >
            Manage Jules Key
          </button>
        </div>
      </div>
    </div>
  );
};
