import React, { useMemo, useRef, useCallback, useEffect, useDeferredValue } from "react";
import { highlightCodeToHtml, countLines } from "../utils/syntaxHighlight";

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

const DEFER_HIGHLIGHT_THRESHOLD = 8_000;

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
  const scrollRafRef = useRef<number | null>(null);

  const lineCount = useMemo(() => countLines(value), [value]);
  const lineNumbers = useMemo(
    () => Array.from({ length: lineCount }, (_, idx) => idx + 1),
    [lineCount]
  );

  // Keep keystrokes instantaneous on large files by deferring syntax highlighting updates
  const deferredValue = useDeferredValue(value);
  const highlightSource = value.length > DEFER_HIGHLIGHT_THRESHOLD ? deferredValue : value;

  const highlightedHtml = useMemo(
    () => highlightCodeToHtml(highlightSource, language, filePath),
    [highlightSource, language, filePath]
  );

  const applyScrollSync = useCallback(() => {
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

  const syncScroll = useCallback(() => {
    if (typeof requestAnimationFrame !== "function") {
      applyScrollSync();
      return;
    }
    if (scrollRafRef.current !== null) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      applyScrollSync();
    });
  }, [applyScrollSync]);

  useEffect(() => {
    syncScroll();
  }, [value, wordWrap, syncScroll]);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null && typeof cancelAnimationFrame === "function") {
        cancelAnimationFrame(scrollRafRef.current);
        scrollRafRef.current = null;
      }
    };
  }, []);

  const wrapClass = wordWrap ? "whitespace-pre-wrap break-words" : "whitespace-pre";

  return (
    <div className="flex-1 flex min-h-0 overflow-hidden relative bg-card">
      {/* Synchronized Line Numbers Gutter */}
      <div
        ref={gutterRef}
        className="w-10 py-2.5 select-none text-end pe-2.5 font-mono text-[11px] tabular-nums text-muted-foreground bg-muted/50 border-e border-border overflow-hidden leading-5 shrink-0"
        aria-hidden="true"
      >
        {lineNumbers.map((lineNum) => (
          <div key={lineNum}>{lineNum}</div>
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
