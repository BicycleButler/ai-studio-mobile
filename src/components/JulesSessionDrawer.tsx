import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
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
  ArrowLeft,
  CheckSquare,
  Square,
  MinusSquare,
} from "lucide-react";
import { JulesSession, JulesRepository, JulesTaskStatus } from "../types";
import {
  fetchJulesRepositories,
  createNewJulesSession,
  deleteJulesSession,
  getStoredJulesSessions,
} from "../services/julesService";
import { loadStoredJulesApiKey } from "../utils/storage";
import { useBackNavigation } from "../hooks/useBackNavigation";
import { safeAddEventListener } from "../utils/platform";

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

  // Enable device/browser back navigation to dismiss drawer smoothly
  useBackNavigation(isOpen, onClose, "jules-sessions-drawer");

  // Keyboard Escape listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, onClose]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // New task creation state
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepo, setCustomRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [initialTaskTitle, setInitialTaskTitle] = useState("");

  const [selectedSessionIds, setSelectedSessionIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

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
    setSelectedSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    refreshSessions();
  };

  const toggleSelection = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number, filteredList: JulesSession[]) => {
      e.stopPropagation();
      setSelectedSessionIds((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastSelectedId) {
          const lastIndex = filteredList.findIndex((s) => s.id === lastSelectedId);
          if (lastIndex !== -1) {
            const start = Math.min(index, lastIndex);
            const end = Math.max(index, lastIndex);
            for (let i = start; i <= end; i++) {
              next.add(filteredList[i].id);
            }
            return next;
          }
        }

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return next;
      });
      setLastSelectedId(id);
    },
    [lastSelectedId]
  );

  const toggleSelectAll = (filteredList: JulesSession[]) => {
    if (selectedSessionIds.size === filteredList.length && filteredList.length > 0) {
      setSelectedSessionIds(new Set());
    } else {
      setSelectedSessionIds(new Set(filteredList.map((s) => s.id)));
    }
  };

  const clearSelection = useCallback(() => {
    setSelectedSessionIds(new Set());
    setLastSelectedId(null);
  }, []);

  const handleBulkDelete = () => {
    Array.from(selectedSessionIds).forEach((id) => {
      deleteJulesSession(id);
    });
    clearSelection();
    setShowBulkDeleteConfirm(false);
    refreshSessions();
  };

  // Keyboard shortcuts (Cmd/Ctrl+A to select all, Esc to clear selection)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedSessionIds.size > 0) {
        clearSelection();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && !isCreating) {
        // Prevent default browser select all
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          const filtered = searchQuery
            ? sessions.filter((s) =>
                s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                s.repository.toLowerCase().includes(searchQuery.toLowerCase())
              )
            : sessions;
          toggleSelectAll(filtered);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, selectedSessionIds.size, isCreating, sessions, searchQuery, clearSelection]);

  const getStatusBadge = (status: JulesTaskStatus) => {
    switch (status) {
      case "planning":
        return (
          <span className="text-xs font-medium text-muted-foreground/70 flex items-center gap-1">
            <RefreshCw className="w-3 h-3 animate-spin" />
            <span>Planning</span>
          </span>
        );
      case "awaiting_approval":
        return (
          <span className="text-xs font-medium text-muted-foreground/70 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>Needs Review</span>
          </span>
        );
      case "executing":
        return (
          <span className="text-xs font-medium text-muted-foreground/70 flex items-center gap-1">
            <PlayCircle className="w-3 h-3 animate-spin" />
            <span>Coding</span>
          </span>
        );
      case "completed":
        return (
          <span className="text-xs font-medium text-muted-foreground/70 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Completed</span>
          </span>
        );
      case "failed":
        return (
          <span className="text-xs font-medium text-muted-foreground/70 flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span className="text-xs font-medium text-muted-foreground/70 flex items-center gap-1">
            <span>Idle</span>
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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="jules-drawer-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.26, ease: "easeOut" }}
          className="fixed inset-0 z-50 flex bg-background/80 backdrop-blur-sm"
        >
          <div
            className="fixed inset-0"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            key="jules-drawer-sheet"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 1.26, ease: [0.32, 0.72, 0, 1] }}
            className="relative ms-auto w-full max-w-md h-full bg-card border-s border-border shadow-2xl flex flex-col z-10 text-foreground"
          >
        {/* Drawer Header */}
        <div className="p-4 border-b border-border bg-muted/40 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <button
              type="button"
              id="jules-drawer-back-btn"
              onClick={onClose}
              className="p-2 -ms-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer flex items-center gap-1.5 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[44px] min-h-[44px]"
              title="Close drawer"
              aria-label="Back / Close drawer"
            >
              <ArrowLeft className="w-5 h-5" />
              <span className="text-xs font-semibold sm:inline hidden">Back</span>
            </button>
            <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-foreground truncate">
                Google Jules Sessions
              </h2>
              <p className="text-[11px] text-muted-foreground truncate">
                Autonomous coding tasks and PR tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setIsCreating(!isCreating)}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-primary hover:text-primary/80 hover:bg-muted rounded-xl transition-colors cursor-pointer touch-manipulation"
              title="New Jules Task Session"
              aria-label="New Jules Session"
            >
              <Plus className="w-5 h-5" />
            </button>
            <button
              type="button"
              id="jules-drawer-close-btn"
              onClick={onClose}
              className="w-11 h-11 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors cursor-pointer touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Close drawer"
              aria-label="Close Jules sessions"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Api Key Alert if missing */}
        {!hasApiKey && (
          <div className="m-3 p-3 rounded-xl bg-muted/40 border border-border/40 text-muted-foreground text-xs flex items-center justify-between gap-2 hover:border-destructive/20 hover:text-destructive group/alert">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 group-hover/alert:text-destructive" />
              <span>Jules API key required to run tasks</span>
            </div>
            <button
              type="button"
              onClick={onOpenApiKeyModal}
              className="px-2.5 py-1 rounded-lg bg-muted hover:bg-destructive/10 group-hover/alert:text-destructive text-muted-foreground text-[11px] font-semibold shrink-0 cursor-pointer transition-colors"
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
                  <GitBranch className="w-3 h-3 text-muted-foreground absolute start-2.5" />
                  <input
                    type="text"
                    value={branch}
                    onChange={(e) => setBranch(e.target.value)}
                    placeholder="main"
                    className="w-full bg-background border border-border rounded-lg ps-7 pe-3 py-1.5 text-xs text-foreground font-mono focus:outline-none focus:border-primary"
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
            <Search className="w-3.5 h-3.5 text-muted-foreground absolute start-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter tasks or repositories..."
              className="w-full bg-background border border-border rounded-xl ps-8 pe-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        {/* Bulk Action Selection Header */}
        {filteredSessions.length > 0 && (
          <div className="px-4 py-2 border-b border-border bg-muted/40 flex flex-col gap-2 text-xs">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSelectAll(filteredSessions)}
                className="text-muted-foreground hover:text-foreground cursor-pointer flex items-center"
                aria-label="Select all sessions on this page"
              >
                {selectedSessionIds.size === filteredSessions.length ? (
                  <CheckSquare className="w-4 h-4 text-primary" />
                ) : selectedSessionIds.size > 0 ? (
                  <MinusSquare className="w-4 h-4 text-primary" />
                ) : (
                  <Square className="w-4 h-4" />
                )}
              </button>
              <span className="text-muted-foreground font-medium">
                {selectedSessionIds.size > 0
                  ? `${selectedSessionIds.size} selected`
                  : "Select all on this page"}
              </span>
            </div>
            {/* Dataset Scope Banner (ADR 0047) */}
            {selectedSessionIds.size === filteredSessions.length && filteredSessions.length > 0 && (
              <div className="text-[11px] text-muted-foreground bg-primary/5 px-2 py-1 rounded border border-primary/20">
                All {filteredSessions.length} items on this page are selected.
              </div>
            )}
          </div>
        )}

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 pb-24">
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
            filteredSessions.map((session, index) => {
              const isActive = session.id === activeSessionId;
              const isSelected = selectedSessionIds.has(session.id);

              return (
                <div
                  key={session.id}
                  onClick={() => {
                    onSelectSession(session);
                    onClose();
                  }}
                  className={`p-3 rounded-xl border transition-colors cursor-pointer group flex items-start gap-3 ${
                    isActive
                      ? "bg-primary/10 border-primary/40 shadow-sm"
                      : isSelected
                      ? "bg-primary/5 border-primary/30"
                      : "bg-card border-border hover:bg-muted"
                  }`}
                >
                  <button
                    type="button"
                    onClick={(e) => toggleSelection(session.id, e, index, filteredSessions)}
                    className="mt-1 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={`Select session ${session.title}`}
                  >
                    {isSelected ? (
                      <CheckSquare className="w-4 h-4 text-primary" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
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
                </div>
              );
            })
          )}
        </div>

        {/* Floating Batch Action Bar */}
        <AnimatePresence>
          {selectedSessionIds.size > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20, x: "-50%" }}
              animate={{ opacity: 1, y: 0, x: "-50%" }}
              exit={{ opacity: 0, y: 20, x: "-50%" }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] shadow-lg bg-background/95 backdrop-blur-md border border-border/60 rounded-full px-4 py-2 flex items-center gap-3"
            >
              <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full whitespace-nowrap">
                {selectedSessionIds.size} Selected
              </span>
              <div className="h-4 w-px bg-border/60" />

              <button
                type="button"
                onClick={() => setShowBulkDeleteConfirm(true)}
                className="px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Archive
              </button>

              <button
                type="button"
                onClick={clearSelection}
                className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:bg-muted rounded-full transition-colors cursor-pointer"
                aria-label="Clear selection"
                title="Deselect all (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Delete Confirmation Modal */}
        <AnimatePresence>
          {showBulkDeleteConfirm && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-sm bg-card border border-border rounded-xl shadow-xl overflow-hidden"
              >
                <div className="p-4 border-b border-border">
                  <h3 className="text-lg font-semibold text-foreground">
                    Delete {selectedSessionIds.size} selected {selectedSessionIds.size === 1 ? 'session' : 'sessions'}?
                  </h3>
                </div>
                <div className="p-4 text-sm text-muted-foreground space-y-4">
                  <p>
                    This action cannot be undone. This will permanently delete the selected Jules sessions and their associated execution histories from your local storage.
                  </p>
                </div>
                <div className="p-4 bg-muted/40 border-t border-border flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkDeleteConfirm(false)}
                    className="px-4 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleBulkDelete}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-destructive hover:bg-destructive/90 text-destructive-foreground transition-colors cursor-pointer shadow-sm"
                  >
                    Delete {selectedSessionIds.size} {selectedSessionIds.size === 1 ? 'Session' : 'Sessions'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
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
      </motion.div>
    </motion.div>
    )}
  </AnimatePresence>
  );
};
