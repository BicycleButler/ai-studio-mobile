import React, { useMemo, useRef, useCallback, useEffect } from "react";
import { highlightCodeToHtml } from "../utils/syntaxHighlight";

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  filePath?: string;
  wordWrap?: boolean;
  placeholder?: string;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSelect?: () => void;
  onKeyUp?: () => void;
  onClick?: () => void;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  filePath,
  wordWrap = true,
  placeholder = "// Write code here...",
  textareaRef,
  onSelect,
  onKeyUp,
  onClick,
}) => {
  const gutterRef = useRef<HTMLDivElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const lines = useMemo(() => value.split("\n"), [value]);
  const highlightedHtml = useMemo(
    () => highlightCodeToHtml(value, language, filePath),
    [value, language, filePath]
  );

  const syncScroll = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (gutterRef.current) {
      gutterRef.current.scrollTop = textarea.scrollTop;
    }
    if (preRef.current) {
      preRef.current.scrollTop = textarea.scrollTop;
      preRef.current.scrollLeft = textarea.scrollLeft;
    }
  }, [textareaRef]);

  useEffect(() => {
    syncScroll();
  }, [value, wordWrap, syncScroll]);

  const wrapClass = wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre";

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden relative bg-card">
      {/* Synchronized Line Numbers Gutter */}
      <div
        ref={gutterRef}
        className="w-10 py-2.5 select-none text-end pe-2.5 font-mono text-[11px] tabular-nums text-muted-foreground bg-muted/50 border-e border-border overflow-hidden leading-5 shrink-0"
        aria-hidden="true"
      >
        {lines.map((_, idx) => (
          <div key={idx}>{idx + 1}</div>
        ))}
      </div>

      {/* Synchronized Syntax Highlight Layer + Transparent Editable Textarea */}
      <div className="flex-1 relative min-w-0 min-h-0 overflow-hidden">
        <pre
          ref={preRef}
          aria-hidden="true"
          className={`code-editor-layer code-editor-highlight m-0 p-2.5 font-mono text-xs leading-5 overflow-auto pointer-events-none select-none ${wrapClass}`}
        >
          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </pre>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            syncScroll();
          }}
          onScroll={syncScroll}
          onSelect={onSelect}
          onKeyUp={onKeyUp}
          onClick={onClick}
          spellCheck={false}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect="off"
          aria-label={filePath ? `Code editor for ${filePath}` : "Code editor"}
          className={`code-editor-layer code-editor-textarea p-2.5 font-mono text-xs bg-transparent resize-none focus:outline-none leading-5 overflow-auto ${wrapClass}`}
          placeholder={placeholder}
        />
      </div>
    </div>
  );
};
