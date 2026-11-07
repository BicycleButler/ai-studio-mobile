import React from "react";
import { Copy, Check, Send } from "lucide-react";

interface PromptToolActionDockProps {
  onCopy: () => void;
  hasCopied: boolean;
  onInsert?: () => void;
  hasInserted: boolean;
  previewContent: string;
}

export const PromptToolActionDock: React.FC<PromptToolActionDockProps> = ({
  onCopy,
  hasCopied,
  onInsert,
  hasInserted,
  previewContent,
}) => {
  return (
    <div className="p-3.5 rounded-xl bg-muted/40 border border-border space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground">Formatted Prompt Preview</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCopy}
            className="px-2.5 py-1 rounded-lg bg-background hover:bg-muted text-foreground border border-border text-xs font-medium flex items-center gap-1 transition cursor-pointer"
          >
            {hasCopied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{hasCopied ? "Copied" : "Copy"}</span>
          </button>
          {onInsert && (
            <button
              type="button"
              onClick={onInsert}
              className="px-3 py-1 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-sm active:scale-95"
            >
              {hasInserted ? <Check className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
              <span>{hasInserted ? "Inserted" : "Insert into Chat"}</span>
            </button>
          )}
        </div>
      </div>

      <pre className="p-2.5 rounded-lg bg-background/80 border border-border/80 text-[11px] font-mono text-foreground whitespace-pre-wrap max-h-44 overflow-y-auto leading-relaxed">
        {previewContent}
      </pre>
    </div>
  );
};
