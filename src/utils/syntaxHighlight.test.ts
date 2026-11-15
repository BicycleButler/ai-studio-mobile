import { describe, it, expect } from "vitest";
import { highlightCodeToHtml, normalizeEditorLanguage } from "./syntaxHighlight";

describe("syntaxHighlight", () => {
  it("normalizes common workspace extensions and generator languages", () => {
    expect(normalizeEditorLanguage("tsx", "src/App.tsx")).toBe("typescript");
    expect(normalizeEditorLanguage("typescript")).toBe("typescript");
    expect(normalizeEditorLanguage("curl", "gemini_request.sh")).toBe("bash");
    expect(normalizeEditorLanguage("kotlin", "GeminiQuickstart.kt")).toBe("kotlin");
    expect(normalizeEditorLanguage("html", "index.html")).toBe("xml");
    expect(normalizeEditorLanguage("unknown", "notes.txt")).toBe("text");
  });

  it("highlights TypeScript and TSX tokens cleanly", () => {
    const html = highlightCodeToHtml('export const count: number = 42;\nconst el = <div className="x" />;', "tsx");
    expect(html).toContain("hljs-keyword");
    expect(html).toContain("hljs-number");
    expect(html).toContain("hljs-string");
  });

  it("highlights JSON, Python, Kotlin, and Bash", () => {
    expect(highlightCodeToHtml('{"model": "gemini-2.5-flash", "temp": 0.7}', "json")).toContain("hljs-attr");
    expect(highlightCodeToHtml('def run():\n  return "ok"', "python")).toContain("hljs-keyword");
    expect(highlightCodeToHtml('fun main() { val x = 1 }', "kotlin")).toContain("hljs-keyword");
    expect(highlightCodeToHtml('curl -X POST "https://example.com"', "curl")).toContain("hljs-string");
  });

  it("safely escapes HTML in plain text mode without raw tag injection", () => {
    const html = highlightCodeToHtml('<script>alert("xss")</script>', "text");
    expect(html).toBe("&lt;script&gt;alert(\"xss\")&lt;/script&gt;");
  });

  it("preserves trailing newline spacing for pre/textarea parity", () => {
    const html = highlightCodeToHtml("const a = 1;\n", "typescript");
    expect(html.endsWith("\n ")).toBe(true);
  });

  it("falls back cleanly for oversized files", () => {
    const huge = "const x = '<tag>';\n".repeat(15_000);
    const html = highlightCodeToHtml(huge, "typescript");
    expect(html).toContain("&lt;tag&gt;");
    expect(html).not.toContain("hljs-keyword");
  });
});
