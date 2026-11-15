import React, { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  ChevronsDownUp,
  File,
  FileCode2,
  FileCog,
  FileImage,
  FileJson,
  FileText,
  Folder,
  FolderOpen,
  FolderTree,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { WorkspaceTreeNode } from "../types/stubs";
import { filterFileTree, getFileCategory } from "../utils/fileTree";

export interface ExplorerVirtualFile {
  id: string;
  name: string;
  language: string;
  isCustom?: boolean;
}

export interface IDEFileExplorerSidebarProps {
  isOpen: boolean;
  isOverlay: boolean;
  onClose: () => void;
  rootName: string;
  tree: WorkspaceTreeNode[];
  totalFiles: number;
  isLoadingTree: boolean;
  treeError: string | null;
  onRefreshTree: () => void;
  expandedDirs: Set<string>;
  onToggleDir: (dirPath: string) => void;
  onCollapseAllDirs: () => void;
  activeFileId: string;
  activeWorkspaceFilePath: string | null;
  openWorkspacePaths: Set<string>;
  dirtyWorkspacePaths: Set<string>;
  onSelectWorkspaceFile: (node: WorkspaceTreeNode) => void;
  virtualFiles: ExplorerVirtualFile[];
  onSelectVirtualFile: (fileId: string) => void;
  onCreateScratchpad: () => void;
  onDeleteScratchpad: (id: string, name: string) => void;
}

const renderFileIcon = (name: string, isBinary = false) => {
  const category = getFileCategory(name, isBinary);
  switch (category) {
    case "code":
      return <FileCode2 className="w-3.5 h-3.5 shrink-0 text-primary/85" />;
    case "json":
      return <FileJson className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />;
    case "markdown":
      return <FileText className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />;
    case "style":
      return <FileCode2 className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />;
    case "config":
      return <FileCog className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />;
    case "binary":
      return <FileImage className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />;
    default:
      return <File className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />;
  }
};

export const IDEFileExplorerSidebar: React.FC<IDEFileExplorerSidebarProps> = ({
  isOpen,
  isOverlay,
  onClose,
  rootName,
  tree,
  totalFiles,
  isLoadingTree,
  treeError,
  onRefreshTree,
  expandedDirs,
  onToggleDir,
  onCollapseAllDirs,
  activeFileId,
  activeWorkspaceFilePath,
  openWorkspacePaths,
  dirtyWorkspacePaths,
  onSelectWorkspaceFile,
  virtualFiles,
  onSelectVirtualFile,
  onCreateScratchpad,
  onDeleteScratchpad,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [isProjectSectionOpen, setIsProjectSectionOpen] = useState(true);
  const [isVirtualSectionOpen, setIsVirtualSectionOpen] = useState(true);

  const isSearching = searchQuery.trim().length > 0;

  const filteredTree = useMemo(
    () => filterFileTree(tree, searchQuery),
    [tree, searchQuery]
  );

  const filteredVirtualFiles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return virtualFiles;
    return virtualFiles.filter((f) => f.name.toLowerCase().includes(q));
  }, [virtualFiles, searchQuery]);

  if (!isOpen) {
    return null;
  }

  const renderTreeNodes = (nodes: WorkspaceTreeNode[], depth: number): React.ReactNode => {
    return nodes.map((node) => {
      if (node.type === "directory") {
        const isExpanded = isSearching || expandedDirs.has(node.path);
        return (
          <div key={node.path} role="treeitem" aria-expanded={isExpanded}>
            <button
              type="button"
              onClick={() => onToggleDir(node.path)}
              style={{ paddingInlineStart: `${depth * 12 + 6}px` }}
              className="w-full flex items-center gap-1.5 pe-2 py-1 rounded-md text-xs text-foreground/90 hover:bg-muted/70 transition-colors duration-150 cursor-pointer text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={node.path}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-3.5 h-3.5 text-primary/80 shrink-0" />
              ) : (
                <Folder className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate font-medium whitespace-nowrap">{node.name}</span>
            </button>

            {isExpanded && node.children && node.children.length > 0 && (
              <div role="group">{renderTreeNodes(node.children, depth + 1)}</div>
            )}
          </div>
        );
      }

      const isActive =
        activeFileId === `ws:${node.path}` || activeWorkspaceFilePath === node.path;
      const isOpenInTab = openWorkspacePaths.has(node.path);
      const isDirty = dirtyWorkspacePaths.has(node.path);

      return (
        <button
          key={node.path}
          type="button"
          role="treeitem"
          aria-selected={isActive}
          disabled={Boolean(node.isBinary)}
          onClick={() => onSelectWorkspaceFile(node)}
          style={{ paddingInlineStart: `${depth * 12 + 22}px` }}
          className={`w-full flex items-center justify-between gap-1.5 pe-2 py-1 rounded-md text-xs transition-colors duration-150 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            node.isBinary
              ? "text-muted-foreground/50 cursor-not-allowed"
              : isActive
              ? "bg-primary/10 text-primary font-semibold cursor-pointer"
              : isOpenInTab
              ? "text-foreground hover:bg-muted/70 cursor-pointer"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
          }`}
          title={
            node.isBinary
              ? `${node.path} (binary asset)`
              : node.path
          }
        >
          <span className="flex items-center gap-1.5 min-w-0">
            {renderFileIcon(node.name, node.isBinary)}
            <span className="truncate font-mono whitespace-nowrap">{node.name}</span>
          </span>
          {isDirty && (
            <span
              className="text-[10px] font-mono font-semibold text-primary shrink-0"
              title="Modified in editor"
              aria-label="Modified"
            >
              M
            </span>
          )}
        </button>
      );
    });
  };

  const sidebarContent = (
    <aside
      aria-label="Workspace file explorer"
      className={
        isOverlay
          ? "absolute inset-y-0 start-0 z-30 w-72 max-w-[85%] bg-card border-e border-border shadow-xl flex flex-col min-h-0 animate-in slide-in-from-left duration-200"
          : "w-64 shrink-0 bg-card/70 border-e border-border flex flex-col min-h-0"
      }
    >
      {/* Explorer Header */}
      <div className="h-9 px-2.5 border-b border-border flex items-center justify-between gap-1.5 shrink-0 bg-muted/30">
        <div className="flex items-center gap-1.5 min-w-0">
          <FolderTree className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="text-xs font-semibold text-foreground truncate whitespace-nowrap">
            Explorer
          </span>
          {totalFiles > 0 && (
            <span className="text-[11px] font-mono tabular-nums text-muted-foreground shrink-0">
              {totalFiles}
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onCollapseAllDirs}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer"
            title="Collapse all folders"
            aria-label="Collapse all folders"
          >
            <ChevronsDownUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRefreshTree}
            disabled={isLoadingTree}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer disabled:opacity-50"
            title="Refresh file tree"
            aria-label="Refresh file tree"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingTree ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer"
            title="Close explorer"
            aria-label="Close file explorer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Filter Input */}
      <div className="p-2 border-b border-border/60 shrink-0">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 text-muted-foreground absolute start-2.5 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter files..."
            aria-label="Filter files"
            className="w-full ps-8 pe-7 py-1.5 text-xs bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors duration-150"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute end-1.5 p-1 rounded text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Clear file filter"
              title="Clear filter"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Sections */}
      <div className="flex-1 overflow-y-auto py-1.5 px-1.5 space-y-2 min-h-0">
        {/* Section 1: Project Directory Tree */}
        <div>
          <button
            type="button"
            onClick={() => setIsProjectSectionOpen((prev) => !prev)}
            aria-expanded={isProjectSectionOpen}
            className="w-full flex items-center justify-between px-1.5 py-1 rounded-md text-[11px] font-semibold text-foreground hover:bg-muted/60 transition-colors duration-150 cursor-pointer"
          >
            <span className="flex items-center gap-1 min-w-0">
              {isProjectSectionOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate whitespace-nowrap">{rootName || "Project Files"}</span>
            </span>
            <span className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
              {totalFiles}
            </span>
          </button>

          {isProjectSectionOpen && (
            <div role="tree" aria-label="Project directory tree" className="mt-0.5 space-y-0.5">
              {isLoadingTree && tree.length === 0 ? (
                <div className="px-2 py-2 space-y-1.5" aria-busy="true">
                  <div className="h-5 bg-muted/60 rounded animate-pulse w-4/5" />
                  <div className="h-5 bg-muted/50 rounded animate-pulse w-3/4 ms-3" />
                  <div className="h-5 bg-muted/50 rounded animate-pulse w-2/3 ms-3" />
                  <div className="h-5 bg-muted/60 rounded animate-pulse w-5/6" />
                </div>
              ) : treeError ? (
                <div className="px-2.5 py-2 text-xs text-destructive space-y-1.5">
                  <p className="leading-snug">{treeError}</p>
                  <button
                    type="button"
                    onClick={onRefreshTree}
                    className="px-2.5 py-1 rounded-md bg-muted hover:bg-muted/80 text-foreground text-[11px] font-medium transition-colors duration-150 cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : filteredTree.length === 0 ? (
                <div className="px-2.5 py-3 text-xs text-muted-foreground">
                  {isSearching ? "No matching project files." : "No workspace files found."}
                </div>
              ) : (
                renderTreeNodes(filteredTree, 0)
              )}
            </div>
          )}
        </div>

        {/* Section 2: Generated Prompt Code & Scratchpads */}
        <div className="pt-1 border-t border-border/60">
          <div className="flex items-center justify-between px-1.5 py-1">
            <button
              type="button"
              onClick={() => setIsVirtualSectionOpen((prev) => !prev)}
              aria-expanded={isVirtualSectionOpen}
              className="flex items-center gap-1 text-[11px] font-semibold text-foreground hover:text-primary transition-colors duration-150 cursor-pointer min-w-0"
            >
              {isVirtualSectionOpen ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="truncate whitespace-nowrap">Prompt & Scratchpads</span>
            </button>

            <button
              type="button"
              onClick={onCreateScratchpad}
              className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors duration-150 cursor-pointer shrink-0"
              title="New scratchpad file"
              aria-label="New scratchpad file"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {isVirtualSectionOpen && (
            <div className="mt-0.5 space-y-0.5">
              {filteredVirtualFiles.length === 0 ? (
                <div className="px-2.5 py-2 text-xs text-muted-foreground">
                  No matching prompt files.
                </div>
              ) : (
                filteredVirtualFiles.map((file) => {
                  const isActive = activeFileId === file.id;
                  return (
                    <div
                      key={file.id}
                      className={`group flex items-center justify-between gap-1 rounded-md pe-1 transition-colors duration-150 ${
                        isActive
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted/70"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectVirtualFile(file.id)}
                        className="flex-1 flex items-center gap-1.5 ps-5 py-1 text-xs text-start min-w-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-md"
                        title={file.name}
                      >
                        {renderFileIcon(file.name, false)}
                        <span className="truncate font-mono whitespace-nowrap">{file.name}</span>
                      </button>
                      {file.isCustom && (
                        <button
                          type="button"
                          onClick={() => onDeleteScratchpad(file.id, file.name)}
                          className="p-1 rounded opacity-70 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-colors duration-150 cursor-pointer shrink-0"
                          title={`Delete ${file.name}`}
                          aria-label={`Delete ${file.name}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );

  if (isOverlay) {
    return (
      <>
        <div
          className="absolute inset-0 z-20 bg-black/35 animate-in fade-in duration-150"
          onClick={onClose}
          aria-hidden="true"
        />
        {sidebarContent}
      </>
    );
  }

  return sidebarContent;
};
