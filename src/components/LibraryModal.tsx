import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  FolderHeart,
  Trash2,
  Sparkles,
  ArrowRight,
  BookmarkPlus,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  MinusSquare,
  X,
} from "lucide-react";
import { SavedPrompt } from "../types";
import { STARTER_TEMPLATES } from "../data/templates";

interface LibraryModalProps {
  savedPrompts: SavedPrompt[];
  onLoadPrompt: (prompt: SavedPrompt) => void;
  onSaveCurrentPrompt: (title: string) => void;
  onDeletePrompt: (id: string) => void;
  onBulkDeletePrompts?: (ids: string[]) => void;
  currentTitle?: string;
  isEmbedded?: boolean;
}

export const LibraryModal: React.FC<LibraryModalProps> = ({
  savedPrompts,
  onLoadPrompt,
  onSaveCurrentPrompt,
  onDeletePrompt,
  onBulkDeletePrompts,
  currentTitle = "My Custom Prompt",
  isEmbedded = false,
}) => {
  const [newTitle, setNewTitle] = useState(currentTitle);
  const [showSaveForm, setShowSaveForm] = useState(false);

  // Batch Selection State
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);

  const toggleSelection = useCallback(
    (id: string, e: React.MouseEvent | React.KeyboardEvent, index: number) => {
      e.stopPropagation();
      setSelectedPromptIds((prev) => {
        const next = new Set(prev);
        if (e.shiftKey && lastSelectedId) {
          const lastIndex = savedPrompts.findIndex((p) => p.id === lastSelectedId);
          if (lastIndex !== -1) {
            const start = Math.min(index, lastIndex);
            const end = Math.max(index, lastIndex);
            for (let i = start; i <= end; i++) {
              next.add(savedPrompts[i].id);
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
    [lastSelectedId, savedPrompts]
  );

  const toggleSelectAll = () => {
    if (selectedPromptIds.size === savedPrompts.length && savedPrompts.length > 0) {
      setSelectedPromptIds(new Set());
    } else {
      setSelectedPromptIds(new Set(savedPrompts.map((p) => p.id)));
    }
  };

  const clearSelection = useCallback(() => {
    setSelectedPromptIds(new Set());
    setLastSelectedId(null);
  }, []);

  const handleBulkDelete = () => {
    if (onBulkDeletePrompts) {
      onBulkDeletePrompts(Array.from(selectedPromptIds));
    } else {
      // Fallback if bulk delete is not provided
      Array.from(selectedPromptIds).forEach((id) => {
        onDeletePrompt(id);
      });
    }
    clearSelection();
    setShowBulkDeleteConfirm(false);
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedPromptIds.size > 0) {
        clearSelection();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleSelectAll();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedPromptIds.size, clearSelection, savedPrompts, toggleSelectAll]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    onSaveCurrentPrompt(newTitle.trim());
    setShowSaveForm(false);
  };

  return (
    <div
      className={`flex flex-col space-y-4 ${
        isEmbedded ? "bg-transparent p-0" : "h-full overflow-y-auto bg-background p-3.5"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-border">
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <FolderHeart className="w-4 h-4 text-primary" />
            <span>Prompt Library & Templates</span>
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Quick-load starter templates or save prompts for future mobile sessions.
          </p>
        </div>
        <button
          onClick={() => setShowSaveForm(!showSaveForm)}
          className="px-2.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
        >
          <BookmarkPlus className="w-3.5 h-3.5" />
          <span>Save Current</span>
        </button>
      </div>

      {/* Save current prompt form */}
      {showSaveForm && (
        <form
          onSubmit={handleSave}
          className="bg-card border border-border rounded-xl p-3 space-y-2.5 animate-in fade-in"
        >
          <label className="text-xs font-semibold text-foreground">
            Prompt Name
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., Android Navigation Assistant"
              className="flex-1 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 cursor-pointer"
            >
              Save
            </button>
          </div>
        </form>
      )}

      {/* 1. Starter Templates */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">
          Google AI Studio Templates
        </div>
        <div className="grid grid-cols-1 gap-2">
          {STARTER_TEMPLATES.map((tmpl) => (
            <div
              key={tmpl.id}
              onClick={() => onLoadPrompt(tmpl)}
              className="group p-3 rounded-xl bg-card hover:bg-muted border border-border hover:border-border cursor-pointer transition-colors flex flex-col justify-between"
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
                    {tmpl.title}
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono border border-border">
                  {tmpl.type}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground line-clamp-2 mb-2">
                {tmpl.config.systemInstruction || "Ready-to-run prompt template"}
              </p>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3 h-3 text-muted-foreground" />
                  <span>{tmpl.config.model}</span>
                </div>
                <span className="text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                  Load Template <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. User Saved Prompts */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            My Saved Prompts ({savedPrompts.length})
          </div>
          {savedPrompts.length > 0 && (
            <button
              type="button"
              onClick={toggleSelectAll}
              className="text-[11px] font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer flex items-center gap-1"
            >
              {selectedPromptIds.size === savedPrompts.length ? (
                <>
                  <CheckSquare className="w-3.5 h-3.5" />
                  Deselect All
                </>
              ) : selectedPromptIds.size > 0 ? (
                <>
                  <MinusSquare className="w-3.5 h-3.5" />
                  Select All
                </>
              ) : (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Select All
                </>
              )}
            </button>
          )}
        </div>

        {/* Dataset Scope Banner (ADR 0047) */}
        {selectedPromptIds.size === savedPrompts.length && savedPrompts.length > 0 && (
          <div className="text-[11px] text-muted-foreground bg-primary/5 px-2 py-1 rounded border border-primary/20">
            All {savedPrompts.length} items on this page are selected.
          </div>
        )}

        {savedPrompts.length === 0 ? (
          <div className="p-6 rounded-xl bg-card border border-dashed border-border text-center text-xs text-muted-foreground">
            No saved prompts yet. Click &quot;Save Current&quot; above to store your mobile prompt configurations.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {savedPrompts.map((item, index) => {
              const isSelected = selectedPromptIds.has(item.id);

              return (
              <div
                key={item.id}
                className={`p-3 rounded-xl border transition-colors flex items-center justify-between ${
                  isSelected ? "bg-primary/5 border-primary/30" : "bg-card border-border hover:border-border"
                }`}
              >
                <button
                  type="button"
                  onClick={(e) => toggleSelection(item.id, e, index)}
                  className="mr-3 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label={`Select prompt ${item.title}`}
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <Square className="w-4 h-4" />
                  )}
                </button>
                <div
                  onClick={() => onLoadPrompt(item)}
                  className="flex-1 cursor-pointer min-w-0 pe-2"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground truncate">
                      {item.title}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
                      {item.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.updatedAt).toLocaleDateString()}
                    </span>
                    <span>• {item.config.model}</span>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => onLoadPrompt(item)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-muted hover:bg-primary hover:text-primary-foreground text-foreground transition-colors cursor-pointer border border-border"
                  >
                    Open
                  </button>
                  <button
                    onClick={() => onDeletePrompt(item.id)}
                    className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-muted/40 transition-colors cursor-pointer"
                    title="Delete prompt"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Floating Batch Action Bar */}
      <AnimatePresence>
        {selectedPromptIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: 20, x: "-50%" }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] shadow-lg bg-background/95 backdrop-blur-md border border-border/60 rounded-full px-4 py-2 flex items-center gap-3"
          >
            <span className="text-xs font-semibold px-2 py-1 bg-muted rounded-full whitespace-nowrap">
              {selectedPromptIds.size} Selected
            </span>
            <div className="h-4 w-px bg-border/60" />

            <button
              type="button"
              onClick={() => setShowBulkDeleteConfirm(true)}
              className="px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 rounded-full transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
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
                  Delete {selectedPromptIds.size} selected {selectedPromptIds.size === 1 ? 'prompt' : 'prompts'}?
                </h3>
              </div>
              <div className="p-4 text-sm text-muted-foreground space-y-4">
                <p>
                  This action cannot be undone. This will permanently delete the selected saved prompts from your local storage.
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
                  Delete {selectedPromptIds.size} {selectedPromptIds.size === 1 ? 'Prompt' : 'Prompts'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
