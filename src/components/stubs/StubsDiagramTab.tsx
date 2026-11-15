import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Hammer, Copy, Check, Code2, Eye, ExternalLink } from "lucide-react";
import { StubsDiagramGroupBy, StubsDiagramType } from "../../types/stubs";
import { Combobox } from "../Combobox";

export interface StubsDiagramTabProps {
  diagramHtml: string;
  diagramMermaid: string;
  diagramGroupBy: StubsDiagramGroupBy;
  onSetDiagramGroupBy: (mode: StubsDiagramGroupBy) => void;
  diagramType: StubsDiagramType;
  onSetDiagramType: (type: StubsDiagramType) => void;
  diagramTarget: string;
  onSetDiagramTarget: (target: string) => void;
  diagramViewMode: "svg" | "code";
  onSetDiagramViewMode: (mode: "svg" | "code") => void;
  availableNodes: string[];
  isLoading: boolean;
  error: string | null;
  onCopyMermaid: (code: string) => void;
  onOpenFileInIDE?: (filePath: string) => void;
}

function toSanitizedMermaidId(nodeId: string): string {
  return "n_" + nodeId.replace(/[^a-zA-Z0-9_]/g, "_");
}

function extractMermaidIdFromAttr(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("n_")) return raw;
  const flowchartMatch = raw.match(/^flowchart-(n_[a-zA-Z0-9_]+?)-\d+$/);
  if (flowchartMatch) return flowchartMatch[1];
  const suffixMatch = raw.match(/^(n_[a-zA-Z0-9_]+?)-\d+$/);
  if (suffixMatch) return suffixMatch[1];
  return null;
}

export const StubsDiagramTab: React.FC<StubsDiagramTabProps> = ({
  diagramHtml,
  diagramMermaid,
  diagramGroupBy,
  onSetDiagramGroupBy,
  diagramType,
  onSetDiagramType,
  diagramTarget,
  onSetDiagramTarget,
  diagramViewMode,
  onSetDiagramViewMode,
  availableNodes,
  isLoading,
  error,
  onCopyMermaid,
  onOpenFileInIDE,
}) => {
  const [copied, setCopied] = useState(false);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    onCopyMermaid(diagramMermaid);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const nodeOptions = availableNodes.map((n) => ({ id: n, label: n }));

  const sanitizedIdToPath = useMemo(() => {
    const map = new Map<string, string>();
    for (const nodePath of availableNodes) {
      map.set(toSanitizedMermaidId(nodePath), nodePath);
    }
    return map;
  }, [availableNodes]);

  const sequenceLabelToPath = useMemo(() => {
    const map = new Map<string, string>();
    const participantRegex = /^\s*participant\s+(n_[a-zA-Z0-9_]+)\s+as\s+(.+)$/gm;
    let match: RegExpExecArray | null;
    while ((match = participantRegex.exec(diagramMermaid)) !== null) {
      const sanitizedId = match[1].trim();
      const label = match[2].trim();
      const resolved = sanitizedIdToPath.get(sanitizedId);
      if (resolved && label) {
        map.set(label, resolved);
      }
    }
    if (diagramTarget) {
      const targetName = diagramTarget.split("/").pop();
      if (targetName && !map.has(targetName)) {
        map.set(targetName, diagramTarget);
      }
    }
    return map;
  }, [diagramMermaid, diagramTarget, sanitizedIdToPath]);

  const resolveFilePathFromElement = useCallback(
    (startEl: Element | null, boundary: HTMLElement | null): string | null => {
      let current: Element | null = startEl;
      while (current && current !== boundary) {
        const stamped = current.getAttribute("data-stubs-file");
        if (stamped) return stamped;

        const dataId = current.getAttribute("data-id");
        if (dataId && sanitizedIdToPath.has(dataId)) {
          return sanitizedIdToPath.get(dataId) || null;
        }

        const nameAttr = current.getAttribute("name");
        if (nameAttr) {
          if (sanitizedIdToPath.has(nameAttr)) {
            return sanitizedIdToPath.get(nameAttr) || null;
          }
          if (nameAttr === "Target" && diagramTarget) {
            return diagramTarget;
          }
        }

        const parsedId = extractMermaidIdFromAttr(current.getAttribute("id"));
        if (parsedId && sanitizedIdToPath.has(parsedId)) {
          return sanitizedIdToPath.get(parsedId) || null;
        }

        current = current.parentElement;
      }

      if (startEl && diagramType === "sequence") {
        const actorEl = startEl.closest("text.actor, g");
        if (actorEl) {
          const text = actorEl.textContent?.trim() || "";
          if (text && sequenceLabelToPath.has(text)) {
            return sequenceLabelToPath.get(text) || null;
          }
        }
      }

      return null;
    },
    [diagramTarget, diagramType, sanitizedIdToPath, sequenceLabelToPath]
  );

  // Enhance rendered Mermaid SVG nodes with clickability, titles, and keyboard focusability
  useEffect(() => {
    const container = svgContainerRef.current;
    if (!container || diagramViewMode !== "svg" || !diagramHtml || !onOpenFileInIDE) {
      return;
    }

    const svg = container.querySelector("svg");
    if (!svg) return;

    const markInteractiveNode = (el: Element, filePath: string) => {
      el.setAttribute("data-stubs-file", filePath);
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-label", `Open ${filePath} in IDE`);

      const existingTitle = Array.from(el.children).find((c) => c.tagName.toLowerCase() === "title");
      if (!existingTitle) {
        const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "title");
        titleEl.textContent = `Open ${filePath} in IDE`;
        el.prepend(titleEl);
      }
    };

    // 1. Mark flowchart nodes (architecture & slice diagrams)
    const flowchartNodes = svg.querySelectorAll("g.node");
    flowchartNodes.forEach((nodeEl) => {
      const resolved = resolveFilePathFromElement(nodeEl, container);
      if (resolved) {
        markInteractiveNode(nodeEl, resolved);
      }
    });

    // 2. Mark sequence diagram actor groups / elements
    const actorNamedEls = svg.querySelectorAll("[name]");
    actorNamedEls.forEach((namedEl) => {
      const resolved = resolveFilePathFromElement(namedEl, container);
      if (!resolved) return;
      const parentGroup = namedEl.parentElement;
      const targetEl =
        parentGroup &&
        parentGroup.tagName.toLowerCase() === "g" &&
        Array.from(parentGroup.children).some((c) => c.classList.contains("actor"))
          ? parentGroup
          : namedEl;
      markInteractiveNode(targetEl, resolved);
    });

    if (diagramType === "sequence") {
      const actorTexts = svg.querySelectorAll("text.actor");
      actorTexts.forEach((textEl) => {
        const label = textEl.textContent?.trim() || "";
        const resolved = sequenceLabelToPath.get(label);
        if (!resolved) return;
        const parentGroup = textEl.parentElement;
        const targetEl =
          parentGroup && parentGroup.tagName.toLowerCase() === "g" ? parentGroup : textEl;
        if (!targetEl.getAttribute("data-stubs-file")) {
          markInteractiveNode(targetEl, resolved);
        }
      });
    }
  }, [diagramHtml, diagramType, diagramViewMode, onOpenFileInIDE, resolveFilePathFromElement, sequenceLabelToPath]);

  const handleDiagramClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onOpenFileInIDE) return;
    const container = svgContainerRef.current;
    if (!container) return;
    const targetEl = e.target as Element | null;
    if (!targetEl) return;
    const filePath = resolveFilePathFromElement(targetEl, container);
    if (filePath) {
      onOpenFileInIDE(filePath);
    }
  };

  const handleDiagramKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!onOpenFileInIDE) return;
    if (e.key !== "Enter" && e.key !== " ") return;
    const container = svgContainerRef.current;
    if (!container) return;
    const targetEl = e.target as Element | null;
    if (!targetEl) return;
    const filePath = resolveFilePathFromElement(targetEl, container);
    if (filePath) {
      e.preventDefault();
      onOpenFileInIDE(filePath);
    }
  };

  return (
    <div className="space-y-3.5 max-w-6xl mx-auto animate-in fade-in duration-150">
      {/* Control Bar */}
      <div className="p-3 rounded-xl bg-card border border-border flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {/* Diagram Type Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
              Type
            </span>
            <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border">
              {(["architecture", "slice", "sequence"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onSetDiagramType(t)}
                  className={`px-2.5 py-1 text-xs font-medium capitalize rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    diagramType === t
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Clustering Mode for architecture OR Target Module for slice/sequence */}
          {diagramType === "architecture" ? (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground whitespace-nowrap">
                Group By
              </span>
              <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border">
                {(["domain", "layer"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => onSetDiagramGroupBy(mode)}
                    className={`px-2.5 py-1 text-xs font-medium capitalize rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      diagramGroupBy === mode
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <div className="w-60 sm:w-72">
                <Combobox
                  options={nodeOptions}
                  value={diagramTarget}
                  onChange={(val) => val && onSetDiagramTarget(val)}
                  placeholder="Select target module..."
                />
              </div>
              {onOpenFileInIDE && diagramTarget && (
                <button
                  type="button"
                  onClick={() => onOpenFileInIDE(diagramTarget)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  title={`Open ${diagramTarget} in IDE`}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Open File</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* View Mode + Copy */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex bg-muted/50 p-0.5 rounded-lg border border-border">
            <button
              type="button"
              onClick={() => onSetDiagramViewMode("svg")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                diagramViewMode === "svg"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visual</span>
            </button>
            <button
              type="button"
              onClick={() => onSetDiagramViewMode("code")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                diagramViewMode === "code"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Mermaid</span>
            </button>
          </div>

          {diagramMermaid && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border hover:bg-muted text-xs font-medium text-foreground transition-colors whitespace-nowrap cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-primary" />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Diagram Canvas */}
      <div className="bg-card border border-border rounded-xl p-4 sm:p-6 min-h-[500px] flex flex-col justify-between gap-3 overflow-auto relative">
        <div className="flex-1 flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center text-muted-foreground">
              <Hammer className="w-7 h-7 mb-2 opacity-50 animate-pulse" />
              <p className="text-xs font-medium">Generating Mermaid diagram...</p>
            </div>
          ) : diagramViewMode === "code" ? (
            <div className="w-full h-full self-start">
              {error && (
                <div className="mb-3 p-2.5 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
                  SVG renderer fallback active: {error}
                </div>
              )}
              <pre className="p-4 rounded-lg bg-background border border-border text-xs font-mono text-foreground whitespace-pre-wrap overflow-x-auto leading-relaxed">
                {diagramMermaid || "No Mermaid source generated."}
              </pre>
            </div>
          ) : error ? (
            <div className="text-center p-6 max-w-md bg-muted/20 border border-border rounded-xl space-y-2">
              <p className="text-foreground font-semibold text-sm">Diagram Render Error</p>
              <p className="text-xs text-muted-foreground font-mono break-words">{error}</p>
              <button
                type="button"
                onClick={() => onSetDiagramViewMode("code")}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer"
              >
                View Mermaid Source
              </button>
            </div>
          ) : diagramHtml ? (
            <div
              ref={svgContainerRef}
              onClick={handleDiagramClick}
              onKeyDown={handleDiagramKeyDown}
              className="w-full h-full flex items-center justify-center mermaid-container"
              dangerouslySetInnerHTML={{ __html: diagramHtml }}
            />
          ) : (
            <p className="text-muted-foreground text-sm">
              No architecture data available to diagram.
            </p>
          )}
        </div>

        {!isLoading && !error && diagramHtml && diagramViewMode === "svg" && onOpenFileInIDE && (
          <div className="pt-2 border-t border-border/50 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Click any file node in the diagram to open it in the IDE.</span>
            <span className="font-mono tabular-nums">{availableNodes.length} indexed modules</span>
          </div>
        )}
      </div>
    </div>
  );
};
