import React from "react";
import { Edit3, Trash2, Check, Plus } from "lucide-react";
import { PromptTemplate } from "../../types";

export interface PromptTemplateItemProps {
  template: PromptTemplate;
  isSelected: boolean;
  selectedIndex: number;
  meta: { label: string; icon: React.ComponentType<{ className?: string }>; color: string };
  onToggleTemplate: (id: string) => void;
  handleStartEdit: (t: PromptTemplate) => void;
  setConfirmDeleteId: (id: string | null) => void;
  confirmDeleteId: string | null;
  handleDelete: (id: string) => void;
}

export const PromptTemplateItem: React.FC<PromptTemplateItemProps> = ({
  template,
  isSelected,
  selectedIndex,
  meta,
  onToggleTemplate,
  handleStartEdit,
  setConfirmDeleteId,
  confirmDeleteId,
  handleDelete,
}) => {
  const Icon = meta.icon;

  return (
    <div
      id={`template-card-${template.id}`}
      className={`p-3.5 rounded-2xl border transition-colors ${
        isSelected
          ? "bg-primary/5 border-primary/40 shadow-xs"
          : "bg-card border-border hover:border-border/80"
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          {/* Numbered Indicator for FIFO Order (Decision Question 2) */}
          {isSelected ? (
            <span
              className="px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-mono font-bold flex items-center gap-1"
              title={`Applied in position #${selectedIndex + 1}`}
            >
              #{selectedIndex + 1}
            </span>
          ) : null}

          <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate">
            {template.title}
          </h4>

          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-medium border flex items-center gap-1 ${meta.color}`}
          >
            <Icon className="w-2.5 h-2.5" />
            <span>{meta.label}</span>
          </span>

          {template.isBuiltin && (
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-muted text-muted-foreground font-mono">
              Built-in
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          {!template.isBuiltin && (
            <>
              <button
                type="button"
                onClick={() => handleStartEdit(template)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                title="Edit custom template"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeleteId(template.id)}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-muted/40 transition-colors cursor-pointer"
                title="Delete custom template"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {/* Toggle selection button */}
          <button
            type="button"
            id={`toggle-template-${template.id}`}
            onClick={() => onToggleTemplate(template.id)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-xs active:scale-95"
                : "bg-muted hover:bg-muted/80 text-foreground border border-border active:scale-95"
            }`}
          >
            {isSelected ? (
              <>
                <Check className="w-3 h-3 stroke-[2.5]" />
                <span>Applied</span>
              </>
            ) : (
              <>
                <Plus className="w-3 h-3" />
                <span>Apply</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Description if present */}
      {template.description && (
        <p className="text-[11px] text-muted-foreground mb-2">
          {template.description}
        </p>
      )}

      {/* Content snippet */}
      <div className="p-2 rounded-xl bg-muted/40 border border-border/60 text-[11px] font-mono text-muted-foreground line-clamp-3 select-all">
        {template.content}
      </div>

      {/* Delete confirmation banner */}
      {confirmDeleteId === template.id && (
        <div className="mt-2 p-2 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-2 animate-in fade-in">
          <span className="text-[11px] text-foreground font-medium">
            Delete &ldquo;{template.title}&rdquo;?
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setConfirmDeleteId(null)}
              className="px-2 py-0.5 rounded text-[11px] bg-muted text-foreground cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleDelete(template.id)}
              className="px-2 py-0.5 rounded text-[11px] bg-muted text-muted-foreground hover:bg-destructive hover:text-destructive-foreground font-semibold cursor-pointer transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
