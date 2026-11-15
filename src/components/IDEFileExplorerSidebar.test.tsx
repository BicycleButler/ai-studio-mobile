import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { IDEFileExplorerSidebar } from "./IDEFileExplorerSidebar";
import { WorkspaceTreeNode } from "../types/stubs";

afterEach(() => {
  cleanup();
});

const SAMPLE_TREE: WorkspaceTreeNode[] = [
  {
    name: "src",
    path: "src",
    type: "directory",
    children: [
      {
        name: "components",
        path: "src/components",
        type: "directory",
        children: [
          {
            name: "CodeEditor.tsx",
            path: "src/components/CodeEditor.tsx",
            type: "file",
            language: "tsx",
          },
        ],
      },
      {
        name: "App.tsx",
        path: "src/App.tsx",
        type: "file",
        language: "tsx",
      },
    ],
  },
  {
    name: "package.json",
    path: "package.json",
    type: "file",
    language: "json",
  },
];

describe("IDEFileExplorerSidebar", () => {
  it("renders hierarchical directories, expanded children, and virtual prompt files", () => {
    const onSelectWorkspaceFile = vi.fn();
    const onSelectVirtualFile = vi.fn();
    const onToggleDir = vi.fn();

    render(
      <IDEFileExplorerSidebar
        isOpen={true}
        isOverlay={false}
        onClose={vi.fn()}
        rootName="react-example"
        tree={SAMPLE_TREE}
        totalFiles={3}
        isLoadingTree={false}
        treeError={null}
        onRefreshTree={vi.fn()}
        expandedDirs={new Set(["src"])}
        onToggleDir={onToggleDir}
        onCollapseAllDirs={vi.fn()}
        activeFileId="ws:src/App.tsx"
        activeWorkspaceFilePath="src/App.tsx"
        openWorkspacePaths={new Set(["src/App.tsx"])}
        dirtyWorkspacePaths={new Set(["src/App.tsx"])}
        onSelectWorkspaceFile={onSelectWorkspaceFile}
        virtualFiles={[
          { id: "typescript", name: "gemini.ts", language: "typescript" },
          { id: "scratch-1", name: "scratch_1.ts", language: "typescript", isCustom: true },
        ]}
        onSelectVirtualFile={onSelectVirtualFile}
        onCreateScratchpad={vi.fn()}
        onDeleteScratchpad={vi.fn()}
      />
    );

    expect(screen.getByText("src")).toBeTruthy();
    expect(screen.getByText("components")).toBeTruthy();
    expect(screen.getByText("App.tsx")).toBeTruthy();
    expect(screen.getByText("package.json")).toBeTruthy();
    // src/components is collapsed so CodeEditor.tsx is hidden until expanded or filtered
    expect(screen.queryByText("CodeEditor.tsx")).toBeNull();
    // Dirty indicator M for src/App.tsx
    expect(screen.getByLabelText("Modified")).toBeTruthy();

    // Toggle directory
    fireEvent.click(screen.getByText("components"));
    expect(onToggleDir).toHaveBeenCalledWith("src/components");

    // Select workspace file
    fireEvent.click(screen.getByText("App.tsx"));
    expect(onSelectWorkspaceFile).toHaveBeenCalledWith(
      expect.objectContaining({ path: "src/App.tsx", type: "file" })
    );

    // Select virtual prompt file
    fireEvent.click(screen.getByText("gemini.ts"));
    expect(onSelectVirtualFile).toHaveBeenCalledWith("typescript");
  });

  it("filters tree and auto-reveals nested matching files", () => {
    render(
      <IDEFileExplorerSidebar
        isOpen={true}
        isOverlay={false}
        onClose={vi.fn()}
        rootName="react-example"
        tree={SAMPLE_TREE}
        totalFiles={3}
        isLoadingTree={false}
        treeError={null}
        onRefreshTree={vi.fn()}
        expandedDirs={new Set()}
        onToggleDir={vi.fn()}
        onCollapseAllDirs={vi.fn()}
        activeFileId="typescript"
        activeWorkspaceFilePath={null}
        openWorkspacePaths={new Set()}
        dirtyWorkspacePaths={new Set()}
        onSelectWorkspaceFile={vi.fn()}
        virtualFiles={[{ id: "typescript", name: "gemini.ts", language: "typescript" }]}
        onSelectVirtualFile={vi.fn()}
        onCreateScratchpad={vi.fn()}
        onDeleteScratchpad={vi.fn()}
      />
    );

    // Initially collapsed
    expect(screen.queryByText("CodeEditor.tsx")).toBeNull();

    const filterInput = screen.getByLabelText("Filter files");
    fireEvent.change(filterInput, { target: { value: "CodeEditor" } });

    expect(screen.getByText("CodeEditor.tsx")).toBeTruthy();
    expect(screen.queryByText("package.json")).toBeNull();
  });
});
