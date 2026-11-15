import { describe, it, expect } from "vitest";
import {
  collectAncestorPaths,
  collectDirectoryPaths,
  filterFileTree,
  countTreeNodes,
  getFileCategory,
} from "./fileTree";
import { WorkspaceTreeNode } from "../types/stubs";

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
            name: "MobileIDEWorkspace.tsx",
            path: "src/components/MobileIDEWorkspace.tsx",
            type: "file",
            language: "tsx",
          },
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
      {
        name: "index.css",
        path: "src/index.css",
        type: "file",
        language: "css",
      },
    ],
  },
  {
    name: "public",
    path: "public",
    type: "directory",
    children: [
      {
        name: "pwa-192x192.png",
        path: "public/pwa-192x192.png",
        type: "file",
        language: "binary",
        isBinary: true,
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

describe("fileTree utilities", () => {
  it("collects ancestor directory paths accurately", () => {
    expect(collectAncestorPaths("src/components/stubs/StubsGraphTab.tsx")).toEqual([
      "src",
      "src/components",
      "src/components/stubs",
    ]);
    expect(collectAncestorPaths("package.json")).toEqual([]);
    expect(collectAncestorPaths("/src/App.tsx/")).toEqual(["src"]);
  });

  it("collects all directory paths recursively", () => {
    expect(collectDirectoryPaths(SAMPLE_TREE)).toEqual([
      "src",
      "src/components",
      "public",
    ]);
  });

  it("filters tree by file name while preserving ancestor folders", () => {
    const result = filterFileTree(SAMPLE_TREE, "CodeEditor");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("src");
    expect(result[0].children).toHaveLength(1);
    expect(result[0].children?.[0].name).toBe("components");
    expect(result[0].children?.[0].children?.map((c) => c.name)).toEqual(["CodeEditor.tsx"]);
  });

  it("filters tree by partial path query", () => {
    const result = filterFileTree(SAMPLE_TREE, "src/App");
    expect(result).toHaveLength(1);
    expect(result[0].children?.map((c) => c.path)).toEqual(["src/App.tsx"]);
  });

  it("preserves full directory contents when directory name matches query", () => {
    const result = filterFileTree(SAMPLE_TREE, "components");
    expect(result).toHaveLength(1);
    expect(result[0].children?.[0].name).toBe("components");
    expect(result[0].children?.[0].children).toHaveLength(2);
  });

  it("returns original tree when query is empty or whitespace", () => {
    expect(filterFileTree(SAMPLE_TREE, "   ")).toBe(SAMPLE_TREE);
  });

  it("counts files and directories accurately", () => {
    expect(countTreeNodes(SAMPLE_TREE)).toEqual({
      files: 6,
      directories: 3,
    });
  });

  it("classifies file extensions into expected visual categories", () => {
    expect(getFileCategory("App.tsx")).toBe("code");
    expect(getFileCategory("package.json")).toBe("json");
    expect(getFileCategory("README.md")).toBe("markdown");
    expect(getFileCategory("index.css")).toBe("style");
    expect(getFileCategory("logo.png", true)).toBe("binary");
    expect(getFileCategory(".env.example")).toBe("config");
    expect(getFileCategory("LICENSE")).toBe("text");
  });
});
