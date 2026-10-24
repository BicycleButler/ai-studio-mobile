import React, { useState, useEffect } from "react";
import { BatchSelectionHeader } from "./BatchSelectionHeader";
import { FloatingBatchActionBar } from "./FloatingBatchActionBar";
import { BulkDeleteConfirmModal } from "./BulkDeleteConfirmModal";
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
  } from "lucide-react";
import { JulesSession, JulesRepository, JulesTaskStatus } from "../types";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { useServices } from "../services/ServiceContext";
import { safeAddEventListener } from "../utils/platform";
import { Combobox } from "./Combobox";
import { useBatchSelection } from "../hooks/useBatchSelection";
import { useBulkActionConfirm } from "../hooks/useBulkActionConfirm";
import { Drawer } from "./ui/Drawer";

interface JulesSessionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeSessionId: string | null;
  onSelectSession: (session: JulesSession) => void;
  onBulkDeleteSessions: (sessionIds: string[]) => void;
  onOpenApiKeyModal: () => void;
}

export const JulesSessionDrawer: React.FC<JulesSessionDrawerProps> = ({


  isOpen,
  onClose,
  activeSessionId,
  onSelectSession,
  onBulkDeleteSessions,
  onOpenApiKeyModal,
}) => {
  const { julesStorageService, julesClient } = useServices();
  const [sessions, setSessions] = useState<JulesSession[]>([]);
  const [repositories, setRepositories] = useState<JulesRepository[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");

  const offlineQueue = useOfflineQueue();
  const pendingIds = new Set(
    offlineQueue.filter(m => m.type === "jules_sessions").flatMap(m => {
      if (Array.isArray(m.payload)) return m.payload.map(s => s.id);
      return [];
    })
  );


  const [isCreating, setIsCreating] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);

  // New task creation state
  const [selectedRepo, setSelectedRepo] = useState("");
  const [customRepo, setCustomRepo] = useState("");
  const [branch, setBranch] = useState("main");
  const [initialTaskTitle, setInitialTaskTitle] = useState("");

  const refreshSessions = () => {
    const list = julesStorageService.getStoredJulesSessions();
    setSessions(list);
  };

  const filteredSessions = searchQuery
    ? sessions.filter((s) =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.repository.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.branch && s.branch.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : sessions;

  const {
    selectedIds: selectedSessionIds,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    removeFromSelection,
    getSelectionState,
  } = useBatchSelection({ clearOnDependencies: [searchQuery],
    items: filteredSessions,
    getItemId: (s) => s.id,
  });

  const {
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    handleBulkDelete,
  } = useBulkActionConfirm({
    onConfirm: () => {
      const ids = Array.from(selectedSessionIds);
      onBulkDeleteSessions(ids);
      refreshSessions();
    },
    onClearSelection: clearSelection,
  });

  useEffect(() => {
    if (isOpen) {
      refreshSessions();
      const { julesStorageService } = useServices();
      const key = julesStorageService.loadStoredJulesApiKey();
      setHasApiKey(Boolean(key));

      if (key) {
        setLoadingRepos(true);
        julesClient.fetchRepositories(key)
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

    const newSess = julesStorageService.createNewJulesSession(
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
    julesStorageService.deleteJulesSession(id);
    removeFromSelection(id);
    refreshSessions();
  };

  // Keyboard shortcuts (Cmd/Ctrl+A to select all, Esc to clear selection)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showBulkDeleteConfirm) {
          setShowBulkDeleteConfirm(false);
          setBulkDeleteConfirmationText("");
        } else if (selectedSessionIds.size > 0) {
          clearSelection();
        } else {
          onClose();
        }
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a" && !isCreating) {
        // Prevent default browser select all
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleSelectAll(filteredSessions);
        }
      }
    };

    const removeKey = safeAddEventListener("keydown", handleKeyDown);
    return () => removeKey();
  }, [isOpen, selectedSessionIds.size, isCreating, filteredSessions, onClose, showBulkDeleteConfirm, setShowBulkDeleteConfirm, setBulkDeleteConfirmationText, clearSelection, toggleSelectAll]);

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

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      drawerId="jules-session-drawer"
      position="right"
      hideHeader={true}
      className="!p-0"
    >
      <div className="flex flex-col h-full bg-card text-foreground">
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
              <ArrowLeft className="rtl:rotate-180 w-5 h-5" />
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

            <div className="space-y-1">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] text-muted-foreground">Target Repository</label>
              </div>
              <Combobox
                options={repositories.map(r => ({
                  id: r.fullName,
                  label: r.fullName,
                  subLabel: `Default branch: ${r.defaultBranch || 'main'}`
                }))}
                value={selectedRepo}
                onChange={(val) => {
                  setSelectedRepo(val);
                  setCustomRepo(val);
                  const found = repositories.find((r) => r.fullName === val);
                  if (found) setBranch(found.defaultBranch || "main");
                }}
                placeholder="Search or enter repository (owner/repo)..."
                isLoading={loadingRepos}
                emptyText="No repositories found."
                onCreateNew={(query) => {
                  setSelectedRepo(query);
                  setCustomRepo(query);
                  if (!repositories.find((r) => r.fullName === query)) {
                     const [owner, name] = query.split("/");
                     setRepositories((prev) => [...prev, { id: query, fullName: query, defaultBranch: "main", owner: owner || "custom", name: name || query, isPrivate: true }]);
                  }
                }}
              />
            </div>

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
          <BatchSelectionHeader
            selectedCount={selectedSessionIds.size}
            totalCount={filteredSessions.length}
            selectionState={getSelectionState(filteredSessions)}
            onToggleSelectAll={() => toggleSelectAll(filteredSessions)}
          />
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
                        {pendingIds.has(session.id) && (
                          <Clock className="w-3.5 h-3.5 text-muted-foreground/60 ml-2" aria-label="Pending sync" />
                        )}
                      </div>
                      <span className="font-mono">{session.steps.length} steps</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>


        <BulkDeleteConfirmModal
          isOpen={showBulkDeleteConfirm}
          onClose={() => {
            setShowBulkDeleteConfirm(false);
            setBulkDeleteConfirmationText("");
          }}
          onConfirm={handleBulkDelete}
          selectedCount={selectedSessionIds.size}
          itemType="session"
          confirmationText={bulkDeleteConfirmationText}
          onConfirmationTextChange={setBulkDeleteConfirmationText}
        />

        {/* Floating Batch Action Bar for Sessions */}
        <FloatingBatchActionBar
          isVisible={selectedSessionIds.size > 0}
          selectedCount={selectedSessionIds.size}
          actions={[
            {
              label: 'Delete',
              icon: <Trash2 />,
              onClick: () => setShowBulkDeleteConfirm(true),
              variant: 'destructive'
            }
          ]}
          onClearSelection={clearSelection}
        />

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
    </Drawer>
  );
};
