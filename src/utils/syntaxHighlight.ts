import hljs from "highlight.js/lib/core";
import typescript from "highlight.js/lib/languages/typescript";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import markdown from "highlight.js/lib/languages/markdown";
import css from "highlight.js/lib/languages/css";
import xml from "highlight.js/lib/languages/xml";
import python from "highlight.js/lib/languages/python";
import kotlin from "highlight.js/lib/languages/kotlin";
import bash from "highlight.js/lib/languages/bash";

hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("json", json);
hljs.registerLanguage("markdown", markdown);
hljs.registerLanguage("css", css);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("python", python);
hljs.registerLanguage("kotlin", kotlin);
hljs.registerLanguage("bash", bash);

const MAX_HIGHLIGHT_CHARS = 200_000;
const MAX_CACHEABLE_CHARS = 100_000;
const MAX_CACHE_ENTRIES = 40;

const highlightCache = new Map<string, string>();

export function clearHighlightCache(): void {
  highlightCache.clear();
}

export function countLines(input: string): number {
  if (!input) return 1;
  let count = 1;
  for (let i = 0; i < input.length; i++) {
    if (input.charCodeAt(i) === 10) count++;
  }
  return count;
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function normalizeEditorLanguage(language?: string, filePath?: string): string {
  const raw = (language || "").toLowerCase().trim();
  const ext = (filePath || "").toLowerCase().split(".").pop() || "";

  const candidate = raw || ext;
  switch (candidate) {
    case "ts":
    case "tsx":
    case "typescript":
      return "typescript";
    case "js":
    case "jsx":
    case "mjs":
    case "cjs":
    case "javascript":
      return "javascript";
    case "json":
      return "json";
    case "md":
    case "markdown":
      return "markdown";
    case "css":
      return "css";
    case "html":
    case "htm":
    case "svg":
    case "xml":
      return "xml";
    case "py":
    case "python":
      return "python";
    case "kt":
    case "kts":
    case "kotlin":
      return "kotlin";
    case "sh":
    case "shell":
    case "bash":
    case "curl":
    case "zsh":
      return "bash";
    default:
      return "text";
  }
}

export function highlightCodeToHtml(
  code: string,
  language?: string,
  filePath?: string
): string {
  if (!code) return "";

  const resolvedLang = normalizeEditorLanguage(language, filePath);
  const canCache = code.length <= MAX_CACHEABLE_CHARS;
  const cacheKey = canCache ? `${resolvedLang}\0${code}` : "";

  if (canCache) {
    const cached = highlightCache.get(cacheKey);
    if (cached !== undefined) {
      // Refresh LRU position
      highlightCache.delete(cacheKey);
      highlightCache.set(cacheKey, cached);
      return cached;
    }
  }

  let html: string;

  if (resolvedLang === "text" || code.length > MAX_HIGHLIGHT_CHARS || !hljs.getLanguage(resolvedLang)) {
    html = escapeHtml(code);
  } else {
    try {
      html = hljs.highlight(code, { language: resolvedLang, ignoreIllegals: true }).value;
    } catch {
      html = escapeHtml(code);
    }
  }

  // Ensure a trailing newline occupies the final line box in <pre> just like <textarea>
  const result = code.endsWith("\n") ? `${html} ` : html;

  if (canCache) {
    if (highlightCache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = highlightCache.keys().next().value;
      if (oldestKey !== undefined) {
        highlightCache.delete(oldestKey);
      }
    }
    highlightCache.set(cacheKey, result);
  }

  return result;
}
