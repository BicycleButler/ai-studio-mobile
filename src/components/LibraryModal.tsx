import { getSafeWindow, getSafeDocument } from "../utils/platform";
import React, { useState, useEffect } from "react";
import { BatchSelectionHeader } from "./BatchSelectionHeader";
import { FloatingBatchActionBar } from "./FloatingBatchActionBar";
import { BulkDeleteConfirmModal } from "./BulkDeleteConfirmModal";
import {
  FolderHeart,
  Trash2,
  Clock,
  Sparkles,
  ArrowRight,
  BookmarkPlus,
  Calendar,
  Layers,
  CheckSquare,
  Square,
  } from "lucide-react";
import { SavedPrompt } from "../types";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { STARTER_TEMPLATES } from "../data/templates";
import { useBatchSelection } from "../hooks/useBatchSelection";
import { useBulkActionConfirm } from "../hooks/useBulkActionConfirm";

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

  const offlineQueue = useOfflineQueue();
  const pendingPromptIds = new Set(
    offlineQueue.filter(m => m.type === "saved_prompts").flatMap(m => {
      if (typeof m.payload === "object" && m.payload !== null && "prompts" in m.payload && Array.isArray((m.payload as Record<string, unknown>).prompts)) {
          return ((m.payload as Record<string, unknown>).prompts as Record<string, unknown>[]).map(p => p.id as string);
      }
      return [];
    })
  );


  const {
    selectedIds: selectedPromptIds,
    toggleSelection,
    toggleSelectAll,
    clearSelection,
    removeFromSelection,
    getSelectionState,
  } = useBatchSelection({
    items: savedPrompts,
    getItemId: (p) => p.id,
  });

  const {
    showBulkDeleteConfirm,
    setShowBulkDeleteConfirm,
    bulkDeleteConfirmationText,
    setBulkDeleteConfirmationText,
    handleBulkDelete,
  } = useBulkActionConfirm({
    onConfirm: () => {
      const ids = Array.from(selectedPromptIds);
      if (onBulkDeletePrompts) {
        onBulkDeletePrompts(ids);
      } else {
        ids.forEach((id) => onDeletePrompt(id));
      }
    },
    onClearSelection: clearSelection,
  });

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
         if (showBulkDeleteConfirm) {
            setShowBulkDeleteConfirm(false);
            setBulkDeleteConfirmationText("");
         } else if (selectedPromptIds.size > 0) {
            clearSelection();
         }
      }

      if ((e.metaKey || e.ctrlKey) && e.key === "a") {
        if (getSafeDocument()!.activeElement?.tagName !== 'INPUT' && getSafeDocument()!.activeElement?.tagName !== 'TEXTAREA') {
          e.preventDefault();
          toggleSelectAll(savedPrompts);
        }
      }
    };

    getSafeWindow()!.addEventListener("keydown", handleKeyDown);
    return () => getSafeWindow()!.removeEventListener("keydown", handleKeyDown);
  }, [toggleSelectAll, savedPrompts, selectedPromptIds.size, showBulkDeleteConfirm, clearSelection, setShowBulkDeleteConfirm, setBulkDeleteConfirmationText]);

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
                <span className="text-primary flex items-center gap-0.5 group-hover:translate-x-0.5 group-hover:rtl:-translate-x-0.5 transition-transform">
                  Load Template <ArrowRight className="rtl:rotate-180 w-3 h-3" />
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. User Saved Prompts */}
      <div className="space-y-2 pt-2">
        <div className="flex items-center justify-between px-1 mb-2">
          <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
            My Saved Prompts ({savedPrompts.length})
          </div>
        </div>

        {/* Bulk Action Selection Header */}
        {savedPrompts.length > 0 && (
          <BatchSelectionHeader
          selectedCount={selectedPromptIds.size}
          totalCount={savedPrompts.length}
          selectionState={getSelectionState(savedPrompts)}
          onToggleSelectAll={() => toggleSelectAll()}
          className="!px-2 mb-2"
        />
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
                  className="me-3 shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
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
                      {pendingPromptIds.has(item.id) && (
                        <Clock className="w-3.5 h-3.5 text-muted-foreground/60 ml-2 flex-shrink-0 inline-block" aria-label="Pending sync" />
                      )}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeletePrompt(item.id);
                      removeFromSelection(item.id);
                    }}
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
      <FloatingBatchActionBar
        isVisible={selectedPromptIds.size > 0}
        selectedCount={selectedPromptIds.size}
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

      <BulkDeleteConfirmModal
        isOpen={showBulkDeleteConfirm}
        onClose={() => {
          setShowBulkDeleteConfirm(false);
          setBulkDeleteConfirmationText("");
        }}
        onConfirm={handleBulkDelete}
        selectedCount={selectedPromptIds.size}
        itemType="prompt"
        confirmationText={bulkDeleteConfirmationText}
        onConfirmationTextChange={setBulkDeleteConfirmationText}
      />
    </div>
  );
};
