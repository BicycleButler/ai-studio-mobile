
import React, { useState, useRef, useEffect, useCallback, useLayoutEffect, useMemo } from "react";
import {
  Play,
  Square,
  Copy,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Download,
  WrapText,
  Sliders,
  CheckCircle2,
  AlertCircle,
  ChevronUp,
  ChevronDown,
  Terminal,
  X,
  FileCode2,
  PanelLeft,
  FolderTree,
  Cloud,
} from "lucide-react";


import type { IDEWorkspaceProps } from "./WorkspaceRouter";
import { useWorkspace } from "../contexts/WorkspaceContext";
import { useServices } from "../services/ServiceContext";
import { CodeEditor } from "./CodeEditor";
import { IDEFileExplorerSidebar } from "./IDEFileExplorerSidebar";
import { IDERemoteSyncModal } from "./integrations/IDERemoteSyncModal";
import { WorkspaceTreeNode } from "../types/stubs";
import { RemoteFileSource } from "../types/integrations";
import { collectAncestorPaths } from "../utils/fileTree";

interface MobileIDEWorkspaceProps extends IDEWorkspaceProps {
}

interface IDEFile {
  id: string;
  name: string;
  filePath?: string;
  language: string;
  content: string;
  isCustom?: boolean;
  isWorkspaceFile?: boolean;
  remoteSource?: RemoteFileSource;
}

interface ConsoleLog {
  id: string;
  timestamp: string;
  type: "info" | "stdout" | "stderr" | "success" | "system";
  message: string;
}

export const MobileIDEWorkspace: React.FC<MobileIDEWorkspaceProps> = ({
  messages,
  freeformText = "",
  structuredExamples = [],
  onSwitchToPrompt: _onSwitchToPrompt,
  openedWorkspaceFiles = [],
  activeWorkspaceFilePath = null,
  isLoadingWorkspaceFile = false,
  workspaceFileError = null,
  onSelectWorkspaceFile,
  onOpenWorkspaceFile,
  onUpdateWorkspaceFileContent,
  onResetWorkspaceFile,
  onCloseWorkspaceFile,
  onOpenRemoteFileInIDE,
  onUpdateRemoteSource,
}) => {
  const { codeGeneratorService, geminiStreamService, stubsClient, logger, clipboardService, fileDownloadService, platformService, idGenerator, timeProvider } = useServices();
  const { config, hasApiKey, onOpenAuth, onOpenParameters, onOpenSettings } = useWorkspace();

  // Generate initial files from prompt context
  const getGeneratedFiles = (): IDEFile[] => [
    ...codeGeneratorService.getAllGenerators().map(generator => ({
      id: generator.id,
      name: generator.name,
      language: generator.language,
      content: generator.generate(config, messages),
    })),
    {
      id: "system",
      name: "system_prompt.md",
      language: "markdown",
      content: config.systemInstruction
        ? `# System Instruction\n\n${config.systemInstruction}`
        : `# System Instruction\n\n// No system instruction currently specified. Add behavioral guidelines or persona here.`,
    },
    {
      id: "config",
      name: "model_config.json",
      language: "json",
      content: JSON.stringify(
        {
          model: config.model,
          temperature: config.temperature,
          topP: config.topP,
          topK: config.topK,
          maxOutputTokens: config.maxOutputTokens,
          responseMimeType: config.responseMimeType,
        },
        null,
        2
      ),
    },
  ];

  const [files, setFiles] = useState<IDEFile[]>(getGeneratedFiles);
  const [activeFileId, setActiveFileId] = useState<string>(() =>
    activeWorkspaceFilePath ? `ws:${activeWorkspaceFilePath}` : "typescript"
  );
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeView, setActiveView] = useState<"editor" | "console" | "split">("editor");
  const [isConsoleDrawerOpen, setIsConsoleDrawerOpen] = useState<boolean>(false);
  const [isRemoteSyncOpen, setIsRemoteSyncOpen] = useState<boolean>(false);

  // Console state
  const [consoleLogs, setConsoleLogs] = useState<ConsoleLog[]>([
    {
      id: "c-0",
      timestamp: timeProvider.date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      type: "system",
      message: `Google AI Studio Mobile IDE v2.5 initialized [Target Model: ${config.model}]`,
    },
    {
      id: "c-1",
      timestamp: timeProvider.date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
      type: "info",
      message: "Ready. Tap 'Run Script' to execute current file in simulated mobile environment.",
    },
  ]);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  const rootRef = useRef<HTMLDivElement>(null);
  const hasInitializedLayoutRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const consoleBottomRef = useRef<HTMLDivElement>(null);
  const tabStripRef = useRef<HTMLDivElement>(null);

  // Hierarchical file explorer sidebar state
  const [isCompactLayout, setIsCompactLayout] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [treeRootName, setTreeRootName] = useState<string>("workspace");
  const [fileTree, setFileTree] = useState<WorkspaceTreeNode[]>([]);
  const [totalTreeFiles, setTotalTreeFiles] = useState<number>(0);
  const [isLoadingTree, setIsLoadingTree] = useState<boolean>(false);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(() => new Set(["src"]));

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const updateLayout = (width: number) => {
      if (width <= 0) return;
      const compact = width < 720;
      setIsCompactLayout(compact);
      if (!hasInitializedLayoutRef.current) {
        hasInitializedLayoutRef.current = true;
        setIsSidebarOpen(!compact);
      }
    };
    updateLayout(el.clientWidth);
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          updateLayout(entry.contentRect.width);
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    }
    return undefined;
  }, []);

  const loadFileTree = useCallback(async () => {
    setIsLoadingTree(true);
    setTreeError(null);
    try {
      const res = await stubsClient.fetchWorkspaceFileTree();
      setTreeRootName(res.rootName || "workspace");
      setFileTree(res.tree || []);
      setTotalTreeFiles(res.totalFiles || 0);
    } catch (err: unknown) {
      setTreeError(err instanceof Error ? err.message : "Failed to load project files");
    } finally {
      setIsLoadingTree(false);
    }
  }, [stubsClient]);

  useEffect(() => {
    void loadFileTree();
  }, [loadFileTree]);

  // Sync active tab and auto-expand parent folders when user opens a workspace file
  useEffect(() => {
    if (activeWorkspaceFilePath) {
      setActiveFileId(`ws:${activeWorkspaceFilePath}`);
      const ancestors = collectAncestorPaths(activeWorkspaceFilePath);
      if (ancestors.length > 0) {
        setExpandedDirs((prev) => {
          const next = new Set(prev);
          let changed = false;
          for (const dir of ancestors) {
            if (!next.has(dir)) {
              next.add(dir);
              changed = true;
            }
          }
          return changed ? next : prev;
        });
      }
    }
  }, [activeWorkspaceFilePath]);

  const workspaceIdeFiles: IDEFile[] = openedWorkspaceFiles.map((wf) => ({
    id: `ws:${wf.path}`,
    name: wf.name,
    filePath: wf.path,
    language: wf.language,
    content: wf.content,
    isWorkspaceFile: true,
    remoteSource: wf.remoteSource,
  }));

  const openWorkspacePaths = useMemo(
    () => new Set(openedWorkspaceFiles.map((wf) => wf.path)),
    [openedWorkspaceFiles]
  );

  const dirtyWorkspacePaths = useMemo(
    () =>
      new Set(
        openedWorkspaceFiles
          .filter((wf) => wf.content !== wf.originalContent)
          .map((wf) => wf.path)
      ),
    [openedWorkspaceFiles]
  );

  const allFiles: IDEFile[] = [...workspaceIdeFiles, ...files];
  const isPendingWorkspaceFile = Boolean(
    activeWorkspaceFilePath &&
      activeFileId === `ws:${activeWorkspaceFilePath}` &&
      !openWorkspacePaths.has(activeWorkspaceFilePath)
  );
  const activeFile = allFiles.find((f) => f.id === activeFileId) || allFiles[0];

  // Keep generated code in sync if user changes tabs, unless active file was manually customized
  const handleResetActiveFile = () => {
    if (activeFile.isWorkspaceFile && activeFile.filePath && onResetWorkspaceFile) {
      onResetWorkspaceFile(activeFile.filePath);
      addConsoleLog("info", `Reset ${activeFile.filePath} to disk contents.`);
      return;
    }
    const generated = getGeneratedFiles();
    const match = generated.find((f) => f.id === activeFileId);
    if (match) {
      setFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, content: match.content } : f))
      );
      addConsoleLog("info", `Reset ${activeFile.name} to generated prompt configuration.`);
    }
  };

  const handleUpdateContent = (newContent: string) => {
    if (activeFile.isWorkspaceFile && activeFile.filePath && onUpdateWorkspaceFileContent) {
      onUpdateWorkspaceFileContent(activeFile.filePath, newContent);
      return;
    }
    setFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: newContent } : f))
    );
  };

  const handleCopyFile = async () => {
    await clipboardService.writeText(activeFile.content);
    setCopied(true);
    platformService.setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadFile = async () => {
    const success = await fileDownloadService.downloadText(activeFile.name, activeFile.content);
    if (success) {
      addConsoleLog("success", `Exported ${activeFile.name} to downloads.`);
    } else {
      addConsoleLog("stderr", `Failed to export file: browser download blocked.`);
    }
  };

  const addConsoleLog = (type: ConsoleLog["type"], message: string) => {
    const timestamp = timeProvider.date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setConsoleLogs((prev) => [...prev, { id: idGenerator.generate("c"), timestamp, type, message }]);
    if (type === "info" || type === "system" || type === "stdout") {
        logger.info(`[IDE] ${message}`);
    } else if (type === "stderr") {
        logger.error(`[IDE] ${message}`);
    } else if (type === "success") {
        logger.info(`[IDE SUCCESS] ${message}`);
    }
  };

  // Run/Execute Code simulation
  const handleRunScript = async () => {
    if (isRunning) return;
    setIsRunning(true);
    // On small screens, open the drawer. On desktop split view
    setIsConsoleDrawerOpen(true);
    const win = platformService.getWindow();
    if (win && win.innerWidth >= 640 && activeView === "editor") {
      setActiveView("split");
    }

    addConsoleLog("system", `----------------------------------------`);
    addConsoleLog("info", `$ executing ${activeFile.name}...`);
    addConsoleLog("info", `[IDE] Initializing runtime environment with model: ${config.model}`);

    if (config.systemInstruction) {
      addConsoleLog("info", `[IDE] System instruction loaded (${config.systemInstruction.length} chars).`);
    }

    const startTime = timeProvider.now();

    // If user has no API key, alert in console
    if (!hasApiKey && activeFile.id !== "system" && activeFile.id !== "config") {
      platformService.setTimeout(() => {
        addConsoleLog(
          "stderr",
          "Error: GEMINI_API_KEY environment variable is not configured. Connect your key via Settings > Authentication to execute live queries."
        );
        addConsoleLog("system", `Process terminated with exit code 1 (${timeProvider.now() - startTime}ms).`);
        setIsRunning(false);
      }, 500);
      return;
    }

    // Prepare prompt text
    let promptQuery = "Hello Gemini!";
    if (messages.length > 0) {
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (lastUser?.text) promptQuery = lastUser.text;
    } else if (freeformText) {
      promptQuery = freeformText.slice(0, 160);
    } else if (structuredExamples.length > 0) {
      promptQuery = structuredExamples[0].input;
    }

    try {
      addConsoleLog("info", `[IDE] Sending payload to Google AI Studio (/api/generate)...`);
      addConsoleLog("info", `[IDE] Target Model: ${config.model} | System: ${config.systemInstruction ? "Active" : "None"}`);

      const data = await geminiStreamService.fetchGenerateContent({
        model: config.model,
        messages: [{ role: "user", text: promptQuery }],
        systemInstruction: config.systemInstruction || undefined,
        temperature: config.temperature,
        topP: config.topP,
        topK: config.topK,
        maxOutputTokens: config.maxOutputTokens,
        stream: false,
      });



      const resultText = data.text || "(Empty response received from model)";
      addConsoleLog("stdout", resultText);

      const elapsed = data.durationMs || timeProvider.now() - startTime;
      const totalTokens = data.usageMetadata?.totalTokenCount || Math.round(resultText.length / 4);
      addConsoleLog(
        "success",
        `[IDE] Live script execution completed in ${elapsed}ms. (Tokens used: ~${totalTokens})`
      );
      addConsoleLog("system", `Process exited with code 0.`);
    } catch (err: unknown) {
      addConsoleLog("stderr", `Execution error: ${err instanceof Error ? err.message : String(err)}`);
      addConsoleLog("system", `Process exited with error code 1.`);
    } finally {
      setIsRunning(false);
    }
  };

  // Scroll console to bottom on update
  useEffect(() => {
    if (consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [consoleLogs]);

  // Insert code snippet at cursor
  const handleInsertSymbol = (symbol: string) => {
    if (!textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const text = el.value;

    let insertion = symbol;
    let cursorOffset = symbol.length;

    // Smart pair insertion
    if (symbol === "{ }") {
      insertion = "{\n  \n}";
      cursorOffset = 4;
    } else if (symbol === "( )") {
      insertion = "()";
      cursorOffset = 1;
    } else if (symbol === "[]") {
      insertion = "[]";
      cursorOffset = 1;
    } else if (symbol === '""') {
      insertion = '""';
      cursorOffset = 1;
    } else if (symbol === "''") {
      insertion = "''";
      cursorOffset = 1;
    } else if (symbol === "Tab") {
      insertion = "  ";
      cursorOffset = 2;
    }

    const nextText = text.substring(0, start) + insertion + text.substring(end);
    handleUpdateContent(nextText);

    platformService.setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(start + cursorOffset, start + cursorOffset);
      }
    }, 10);
  };

  // Track cursor position
  const handleTextareaSelect = () => {
    if (!textareaRef.current) return;
    const selStart = textareaRef.current.selectionStart;
    const lines = textareaRef.current.value.substring(0, selStart).split("\n");
    setCursorPos({
      line: lines.length,
      col: lines[lines.length - 1].length + 1,
    });
  };

  // Create new scratchpad file
  const handleCreateScratchpad = () => {
    const newId = idGenerator.generate("scratch");
    const newFile: IDEFile = {
      id: newId,
      name: `scratch_${files.length + 1}.ts`,
      language: "typescript",
      content: `// Scratchpad script for Google AI Studio\n// Write quick experimentation code here\n\nimport { GoogleGenAI } from "@google/genai";\n\nconsole.log("Ready to test!");\n`,
      isCustom: true,
    };
    setFiles((prev) => [...prev, newFile]);
    setActiveFileId(newId);
    addConsoleLog("info", `Created new scratchpad file: ${newFile.name}`);
  };

  const handleDeleteFile = (id: string, name: string) => {
    if (files.length <= 1) return;
    setFiles((prev) => prev.filter((f) => f.id !== id));
    if (activeFileId === id) {
      setActiveFileId(files[0].id);
    }
    addConsoleLog("info", `Deleted scratchpad file: ${name}`);
  };

  const handleToggleDir = (dirPath: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) {
        next.delete(dirPath);
      } else {
        next.add(dirPath);
      }
      return next;
    });
  };

  const handleCollapseAllDirs = () => {
    setExpandedDirs(new Set());
  };

  const handleSelectTreeFile = (node: WorkspaceTreeNode) => {
    if (node.type !== "file" || node.isBinary) return;
    if (onOpenWorkspaceFile) {
      onOpenWorkspaceFile(node.path);
    } else {
      onSelectWorkspaceFile?.(node.path);
    }
    setActiveFileId(`ws:${node.path}`);
    if (isCompactLayout) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectVirtualFile = (fileId: string) => {
    setActiveFileId(fileId);
    onSelectWorkspaceFile?.(null);
    if (isCompactLayout) {
      setIsSidebarOpen(false);
    }
  };

  const handleSelectFileTab = (file: IDEFile) => {
    setActiveFileId(file.id);
    if (file.isWorkspaceFile && file.filePath) {
      onSelectWorkspaceFile?.(file.filePath);
    } else {
      onSelectWorkspaceFile?.(null);
    }
  };

  const handleCloseWorkspaceTab = (file: IDEFile) => {
    if (!file.filePath) return;
    onCloseWorkspaceFile?.(file.filePath);
    if (activeFileId === file.id) {
      const nextWs = workspaceIdeFiles.find((f) => f.id !== file.id);
      setActiveFileId(nextWs ? nextWs.id : files[0].id);
    }
  };

  // Compute line numbers
  const lines = activeFile.content.split("\n");

  const quickSymbols = [
    { label: "Tab", insert: "Tab" },
    { label: "{ }", insert: "{ }" },
    { label: "( )", insert: "( )" },
    { label: "[]", insert: "[]" },
    { label: '""', insert: '""' },
    { label: "''", insert: "''" },
    { label: ";", insert: ";" },
    { label: "=", insert: " = " },
    { label: "=>", insert: " => " },
    { label: "const", insert: "const " },
    { label: "await", insert: "await " },
    { label: "apiKey", insert: "apiKey" },
    { label: "generate", insert: "generateContent" },
    { label: "//", insert: "// " },
    { label: "$", insert: "$" },
  ];

  return (
    <div
      ref={rootRef}
      className="flex flex-col h-full flex-1 overflow-hidden bg-background text-foreground font-sans select-none"
    >
      {/* 52px Unified Section Toolbar (ADR 0039): Explorer Toggle + Open File Tabs + View Switcher + Run Action */}
      <div className="h-[52px] min-h-[52px] flex items-center justify-between px-2 bg-card border-b border-border shrink-0 gap-2">
        {/* Left: Explorer Sidebar Toggle + Swipeable Pull Strip for Open File Tabs */}
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <button
            type="button"
            id="ide-toggle-explorer-btn"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
            aria-expanded={isSidebarOpen}
            aria-label={isSidebarOpen ? "Hide file explorer" : "Show file explorer"}
            title={isSidebarOpen ? "Hide file explorer" : "Show file explorer"}
            className={`flex items-center justify-center min-w-[38px] min-h-[38px] px-2 rounded-xl border text-xs transition-colors duration-150 shrink-0 cursor-pointer touch-manipulation ${
              isSidebarOpen
                ? "bg-primary/10 text-primary border-primary/30"
                : "bg-muted/50 text-muted-foreground hover:text-foreground hover:bg-muted border-border/60"
            }`}
          >
            <PanelLeft className="w-4 h-4" />
          </button>

          <div
            ref={tabStripRef}
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1.5 min-w-0 flex-1 touch-pan-x cursor-grab active:cursor-grabbing overscroll-x-contain"
          >
            {allFiles.map((file) => {
              const isActive = file.id === activeFileId && !isPendingWorkspaceFile;
              const isDirty = Boolean(file.filePath && dirtyWorkspacePaths.has(file.filePath));
              return (
                <div
                  key={file.id}
                  title={file.filePath || file.name}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono transition-colors cursor-pointer whitespace-nowrap group shrink-0 border select-none ${
                    isActive
                      ? "bg-primary/10 text-primary border-primary/30 font-semibold shadow-xs"
                      : "bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted border-border/50"
                  }`}
                  onClick={() => handleSelectFileTab(file)}
                >
                  {file.isWorkspaceFile && <FileCode2 className="w-3 h-3 shrink-0 opacity-80" />}
                  <span>{file.name}</span>
                  {isDirty && (
                    <span className="text-[10px] font-semibold text-primary" title="Modified">
                      M
                    </span>
                  )}
                  {file.isWorkspaceFile && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseWorkspaceTab(file);
                      }}
                      className="opacity-60 group-hover:opacity-100 p-0.5 hover:text-foreground transition-colors cursor-pointer"
                      title="Close file tab"
                      aria-label={`Close ${file.name}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {file.isCustom && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFile(file.id, file.name);
                      }}
                      className="opacity-60 group-hover:opacity-100 p-0.5 hover:text-destructive transition-colors cursor-pointer"
                      title="Delete scratchpad"
                      aria-label={`Delete ${file.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            <button
              type="button"
              onClick={handleCreateScratchpad}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted border border-dashed border-border rounded-xl transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Create new scratchpad file"
              aria-label="Create scratchpad"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="text-[11px] font-mono">Scratch</span>
            </button>
          </div>
        </div>

        {/* Right: View Switcher (Desktop/Tablet) / Logs Chip (Mobile) & Run Action */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Mobile Peek Logs Trigger (hidden on sm screens) */}
          <button
            type="button"
            onClick={() => setIsConsoleDrawerOpen((prev) => !prev)}
            className="sm:hidden flex items-center gap-1 min-h-[38px] px-2.5 py-1 rounded-xl bg-muted/60 hover:bg-muted text-foreground border border-border text-[11px] font-mono transition-colors cursor-pointer touch-manipulation"
            title="Toggle console logs drawer"
            aria-label="Toggle console drawer"
          >
            <Terminal className="w-3.5 h-3.5 text-primary" />
            <span>Logs</span>
            {isConsoleDrawerOpen ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronUp className="w-3 h-3 text-muted-foreground" />
            )}
          </button>

          {/* Desktop/Tablet View Switcher: Editor, Split, Console (hidden on extra small mobile screens) */}
          <div className="hidden sm:flex bg-muted p-0.5 rounded-xl border border-border text-[11px]">
            <button
              type="button"
              onClick={() => setActiveView("editor")}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer touch-manipulation flex items-center justify-center ${
                activeView === "editor" ? "bg-card text-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Editor only view"
            >
              Editor
            </button>
            <button
              type="button"
              onClick={() => setActiveView("split")}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer touch-manipulation flex items-center justify-center ${
                activeView === "split" ? "bg-card text-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Split editor & console view"
            >
              Split
            </button>
            <button
              type="button"
              onClick={() => setActiveView("console")}
              className={`min-h-[36px] px-2.5 py-1 rounded-lg transition-colors cursor-pointer touch-manipulation flex items-center justify-center ${
                activeView === "console" ? "bg-card text-foreground font-medium shadow-xs" : "text-muted-foreground hover:text-foreground"
              }`}
              title="Console terminal view"
            >
              Console
            </button>
          </div>

          {/* Run Button */}
          <button
            type="button"
            id="mobile-ide-run-btn"
            onClick={handleRunScript}
            disabled={isRunning}
            className={`flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors active:scale-95 cursor-pointer touch-manipulation ${
              isRunning
                ? "bg-muted text-foreground cursor-wait"
                : "bg-primary hover:bg-primary/90 text-primary-foreground"
            }`}
            title="Run active script in mobile console"
            aria-label="Run script"
          >
            {isRunning ? (
              <>
                <Square className="w-3.5 h-3.5 animate-spin" />
                <span>Running...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Run</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main IDE Workspace: Hierarchical Explorer Sidebar + Editor/Console Split */}
      <div className="flex-1 flex min-h-0 overflow-hidden relative">
        <IDEFileExplorerSidebar
          isOpen={isSidebarOpen}
          isOverlay={isCompactLayout}
          onClose={() => setIsSidebarOpen(false)}
          rootName={treeRootName}
          tree={fileTree}
          totalFiles={totalTreeFiles}
          isLoadingTree={isLoadingTree}
          treeError={treeError}
          onRefreshTree={() => void loadFileTree()}
          expandedDirs={expandedDirs}
          onToggleDir={handleToggleDir}
          onCollapseAllDirs={handleCollapseAllDirs}
          activeFileId={activeFileId}
          activeWorkspaceFilePath={activeWorkspaceFilePath}
          openWorkspacePaths={openWorkspacePaths}
          dirtyWorkspacePaths={dirtyWorkspacePaths}
          onSelectWorkspaceFile={handleSelectTreeFile}
          virtualFiles={files}
          onSelectVirtualFile={handleSelectVirtualFile}
          onCreateScratchpad={handleCreateScratchpad}
          onDeleteScratchpad={handleDeleteFile}
        />

        <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden relative">
          {/* Top Editor Area */}
          {(activeView === "editor" || activeView === "split") && (
            <div
              className={`flex flex-col bg-card relative min-h-0 ${
                activeView === "split" ? "h-[58%] border-b border-border" : "h-full"
              }`}
            >
              {/* Editor Subheader: File path, formatting actions */}
              <div className="flex items-center justify-between px-3 py-1 bg-muted/30 border-b border-border text-[11px] text-muted-foreground shrink-0 gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  {!isSidebarOpen && (
                    <button
                      type="button"
                      onClick={() => setIsSidebarOpen(true)}
                      className="p-1 -ms-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
                      title="Open file explorer"
                      aria-label="Open file explorer"
                    >
                      <FolderTree className="w-3.5 h-3.5 text-primary" />
                    </button>
                  )}
                  <span
                    className="font-mono text-foreground truncate"
                    title={
                      isPendingWorkspaceFile && activeWorkspaceFilePath
                        ? activeWorkspaceFilePath
                        : activeFile.filePath || `src/${activeFile.name}`
                    }
                  >
                    {isPendingWorkspaceFile && activeWorkspaceFilePath
                      ? activeWorkspaceFilePath
                      : activeFile.filePath || `src/${activeFile.name}`}
                  </span>
                </div>
                {isLoadingWorkspaceFile && (
                  <span className="text-[11px] text-muted-foreground font-mono shrink-0">
                    Loading file...
                  </span>
                )}
                {workspaceFileError && (
                  <span className="text-[11px] text-muted-foreground font-mono truncate">
                    {workspaceFileError}
                  </span>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    id="ide-cloud-sync-btn"
                    onClick={() => setIsRemoteSyncOpen(true)}
                    className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                    title="Sync with Firebase, Google Cloud, GitHub, or Vercel"
                    aria-label="Cloud and Git Sync"
                  >
                    <Cloud className="w-3 h-3 text-primary" />
                    <span className="text-[10px] font-medium">Cloud Sync</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setWordWrap((prev) => !prev)}
                    className={`p-1 rounded transition-colors cursor-pointer ${
                      wordWrap ? "bg-muted text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                    title="Toggle Word Wrap"
                    aria-label="Toggle Word Wrap"
                  >
                    <WrapText className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleResetActiveFile}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Reset file to latest generated prompt code"
                    aria-label="Reset active file"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyFile}
                    className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
                    title="Copy code to clipboard"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3 h-3 text-primary" />
                        <span className="text-[10px] text-primary font-medium">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3" />
                        <span className="text-[10px]">Copy</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadFile}
                    className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    title="Download file"
                    aria-label="Download file"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Syntax-Highlighted Code Editor with Synchronized Line Numbers */}
              {isPendingWorkspaceFile && isLoadingWorkspaceFile ? (
                <div className="flex-1 flex items-center justify-center text-xs font-mono text-muted-foreground bg-card">
                  Loading {activeWorkspaceFilePath}...
                </div>
              ) : isPendingWorkspaceFile && workspaceFileError ? (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-2 bg-card">
                  <p className="text-xs font-mono text-muted-foreground">{workspaceFileError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (activeWorkspaceFilePath && onOpenWorkspaceFile) {
                        onOpenWorkspaceFile(activeWorkspaceFilePath);
                      }
                    }}
                    className="px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-xs font-medium text-foreground cursor-pointer"
                  >
                    Retry
                  </button>
                </div>
              ) : (
                <CodeEditor
                  value={activeFile.content}
                  onChange={handleUpdateContent}
                  language={activeFile.language}
                  filePath={activeFile.filePath || activeFile.name}
                  wordWrap={wordWrap}
                  textareaRef={textareaRef}
                  onSelect={handleTextareaSelect}
                  onKeyUp={handleTextareaSelect}
                  onClick={handleTextareaSelect}
                />
              )}

              {/* Mobile Keyboard Coding Accessory Bar */}
              <div className="flex items-center gap-1 px-1.5 py-1 bg-muted/30 border-t border-border overflow-x-auto scrollbar-none shrink-0">
                <span className="text-[10px] text-muted-foreground uppercase font-mono px-1 select-none">
                  Tokens:
                </span>
                {quickSymbols.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => handleInsertSymbol(item.insert)}
                    className="px-2 py-0.5 rounded bg-card hover:bg-muted active:bg-primary/20 text-xs font-mono text-foreground border border-border transition-colors whitespace-nowrap active:scale-95 shadow-xs cursor-pointer"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

        {/* Bottom Console Terminal Area (Desktop/Tablet split/console view) */}
        {(activeView === "console" || activeView === "split") && (
          <div
            className={`flex flex-col bg-muted/20 font-mono select-text relative ${
              activeView === "split" ? "flex-1 min-h-[140px]" : "h-full"
            }`}
          >
            {/* Terminal Header */}
            <div className="flex items-center justify-between px-3 py-1 bg-muted/40 border-b border-border text-[11px] text-muted-foreground shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Terminal Output</span>
                {isRunning && (
                  <span className="text-[10px] font-mono uppercase tracking-wider text-primary animate-pulse">
                    Executing
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Clear Console"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const text = consoleLogs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n");
                    await clipboardService.writeText(text);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Copy Console Logs"
                >
                  Copy Logs
                </button>
              </div>
            </div>

            {/* Terminal Logs View */}
            <div className="flex-1 p-2.5 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom,0px))] space-y-1 text-xs leading-relaxed">
              {consoleLogs.length === 0 ? (
                <div className="text-muted-foreground italic text-[11px]">
                  Console cleared. Tap &apos;Run&apos; to execute your script.
                </div>
              ) : (
                consoleLogs.map((log) => {
                  let color = "text-foreground";
                  if (log.type === "stderr") color = "text-destructive font-medium error-text"; // execution error
                  else if (log.type === "stdout") color = "text-primary";
                  else if (log.type === "success") color = "text-primary font-medium";
                  else if (log.type === "system") color = "text-muted-foreground text-[10px]";
                  else if (log.type === "info") color = "text-foreground font-mono";

                  return (
                    <div key={log.id} className={`flex items-start gap-1.5 font-mono ${color}`}>
                      <span className="text-[10px] text-muted-foreground shrink-0 select-none">
                        [{log.timestamp}]
                      </span>
                      <span className="break-all whitespace-pre-wrap flex-1">{log.message}</span>
                    </div>
                  );
                })
              )}
              <div ref={consoleBottomRef} />
            </div>
          </div>
        )}

        {/* Mobile Collapsible Bottom-Sheet Console Drawer (sm:hidden) */}
        {activeView === "editor" && isConsoleDrawerOpen && (
          <div className="sm:hidden absolute inset-x-0 bottom-0 max-h-[55%] flex flex-col bg-card/95 backdrop-blur-md border-t-2 border-primary shadow-xl z-30 font-mono animate-in slide-in-from-bottom duration-200">
            {/* Drawer Drag Bar & Header */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-muted/60 border-b border-border text-[11px] shrink-0">
              <div
                className="flex items-center gap-2 cursor-pointer select-none"
                onClick={() => setIsConsoleDrawerOpen(false)}
              >
                <div className="w-8 h-1 bg-muted-foreground/40 rounded-full mx-auto mb-0.5 sm:hidden" />
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <Terminal className="w-3.5 h-3.5 text-primary" />
                  Terminal Output
                </span>
                {isRunning && (
                  <span className="text-[10px] uppercase tracking-wider text-primary animate-pulse">
                    Executing
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setConsoleLogs([])}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-1.5 py-0.5"
                  title="Clear Console"
                >
                  Clear
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const text = consoleLogs.map((l) => `[${l.timestamp}] ${l.message}`).join("\n");
                    await clipboardService.writeText(text);
                  }}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors cursor-pointer px-1.5 py-0.5"
                  title="Copy Console Logs"
                >
                  Copy
                </button>

                <button
                  type="button"
                  onClick={() => setIsConsoleDrawerOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Close Console Drawer"
                  aria-label="Close Console Drawer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Logs List in Drawer */}
            <div className="flex-1 p-2.5 overflow-y-auto space-y-1.5 text-xs leading-relaxed max-h-56">
              {consoleLogs.length === 0 ? (
                <div className="text-muted-foreground italic text-[11px]">
                  Console cleared. Tap &apos;Run&apos; to execute your script.
                </div>
              ) : (
                consoleLogs.map((log) => {
                  let color = "text-foreground";
                  if (log.type === "stderr") color = "text-destructive font-medium error-text";
                  else if (log.type === "stdout") color = "text-primary";
                  else if (log.type === "success") color = "text-primary font-medium";
                  else if (log.type === "system") color = "text-muted-foreground text-[10px]";
                  else if (log.type === "info") color = "text-foreground font-mono";

                  return (
                    <div key={log.id} className={`flex items-start gap-1.5 font-mono ${color}`}>
                      <span className="text-[10px] text-muted-foreground shrink-0 select-none">
                        [{log.timestamp}]
                      </span>
                      <span className="break-all whitespace-pre-wrap flex-1">{log.message}</span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
        </div>
      </div>

      {/* Mobile IDE Status Bar (Footer) */}
      <div className="flex items-center justify-between px-3 py-1 bg-card border-t border-border text-[10px] text-muted-foreground font-mono shrink-0 select-none">
        <div className="flex items-center gap-3">
          <span className="text-foreground">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span>{lines.length} lines</span>
          <span className="hidden xs:inline uppercase">{activeFile.language}</span>
        </div>

        <div className="flex items-center gap-2">
          {hasApiKey ? (
            <span className="flex items-center gap-1 text-primary">
              <CheckCircle2 className="w-3 h-3" />
              <span className="hidden xs:inline">API Key Connected</span>
            </span>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1 text-destructive hover:underline cursor-pointer"
            >
              <AlertCircle className="w-3 h-3" />
              <span>Connect Key</span>
            </button>
          )}

          {onOpenParameters && (
            <button
              type="button"
              onClick={onOpenParameters}
              className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
              title="Tune parameters"
            >
              <Sliders className="w-3 h-3 text-primary" />
              <span className="hidden xs:inline">{config.model}</span>
            </button>
          )}
        </div>
      </div>

      <IDERemoteSyncModal
        isOpen={isRemoteSyncOpen}
        onClose={() => setIsRemoteSyncOpen(false)}
        onOpenIntegrationsSettings={() => onOpenSettings?.("integrations")}
        activeIdeFile={{
          path: activeFile.filePath || activeFile.name,
          name: activeFile.name,
          language: activeFile.language,
          content: activeFile.content,
          remoteSource: activeFile.remoteSource,
        }}
        openedWorkspaceFiles={openedWorkspaceFiles}
        onOpenRemoteFileInIDE={(file) => {
          onOpenRemoteFileInIDE?.(file);
        }}
        onUpdateRemoteSource={onUpdateRemoteSource}
      />
    </div>
  );
};
