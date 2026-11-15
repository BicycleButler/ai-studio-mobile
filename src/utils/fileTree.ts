import { WorkspaceTreeNode } from "../types/stubs";

/**
 * Returns all ancestor directory paths for a given relative file path.
 * Example: "src/components/stubs/StubsGraphTab.tsx"
 * -> ["src", "src/components", "src/components/stubs"]
 */
export function collectAncestorPaths(filePath: string): string[] {
  const normalized = filePath.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (!normalized) return [];
  const parts = normalized.split("/");
  if (parts.length <= 1) return [];
  const ancestors: string[] = [];
  for (let i = 1; i < parts.length; i++) {
    ancestors.push(parts.slice(0, i).join("/"));
  }
  return ancestors;
}

/**
 * Collects all directory paths recursively from a workspace tree.
 */
export function collectDirectoryPaths(nodes: WorkspaceTreeNode[]): string[] {
  const dirs: string[] = [];
  for (const node of nodes) {
    if (node.type === "directory") {
      dirs.push(node.path);
      if (node.children && node.children.length > 0) {
        dirs.push(...collectDirectoryPaths(node.children));
      }
    }
  }
  return dirs;
}

/**
 * Recursively filters a workspace tree by search query (matches file name, path, or directory name).
 * Preserves parent directories that contain matching descendants; when a directory name itself
 * matches, all of its descendants remain accessible or matching children are kept.
 */
export function filterFileTree(
  nodes: WorkspaceTreeNode[],
  rawQuery: string
): WorkspaceTreeNode[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return nodes;

  const filtered: WorkspaceTreeNode[] = [];

  for (const node of nodes) {
    const nameMatches = node.name.toLowerCase().includes(query);
    const pathMatches = node.path.toLowerCase().includes(query);

    if (node.type === "directory") {
      const matchingChildren = filterFileTree(node.children || [], query);
      if (matchingChildren.length > 0) {
        filtered.push({
          ...node,
          children: matchingChildren,
        });
      } else if (nameMatches) {
        filtered.push({
          ...node,
          children: node.children || [],
        });
      }
    } else if (nameMatches || pathMatches) {
      filtered.push(node);
    }
  }

  return filtered;
}

/**
 * Counts files and directories in a tree structure.
 */
export function countTreeNodes(nodes: WorkspaceTreeNode[]): {
  files: number;
  directories: number;
} {
  let files = 0;
  let directories = 0;

  for (const node of nodes) {
    if (node.type === "directory") {
      directories++;
      if (node.children) {
        const sub = countTreeNodes(node.children);
        files += sub.files;
        directories += sub.directories;
      }
    } else {
      files++;
    }
  }

  return { files, directories };
}

export type FileVisualCategory =
  | "code"
  | "json"
  | "markdown"
  | "style"
  | "config"
  | "binary"
  | "text";

/**
 * Classifies a file name into a visual category for choosing an appropriate icon.
 */
export function getFileCategory(name: string, isBinary = false): FileVisualCategory {
  if (isBinary) return "binary";
  const lower = name.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".mdx")) return "markdown";
  if (lower.endsWith(".css") || lower.endsWith(".scss") || lower.endsWith(".less")) return "style";
  if (
    lower.endsWith(".ts") ||
    lower.endsWith(".tsx") ||
    lower.endsWith(".js") ||
    lower.endsWith(".jsx") ||
    lower.endsWith(".mjs") ||
    lower.endsWith(".cjs") ||
    lower.endsWith(".py") ||
    lower.endsWith(".kt") ||
    lower.endsWith(".html") ||
    lower.endsWith(".sql")
  ) {
    return "code";
  }
  if (
    lower.endsWith(".yml") ||
    lower.endsWith(".yaml") ||
    lower.endsWith(".toml") ||
    lower.startsWith(".env") ||
    lower === ".gitignore" ||
    lower.endsWith(".config.ts") ||
    lower.endsWith(".config.js")
  ) {
    return "config";
  }
  return "text";
}
