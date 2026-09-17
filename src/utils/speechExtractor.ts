/**
 * Utility to parse agent responses and extract spoken-friendly text,
 * strictly omitting code blocks, inline code, and formatting artifacts.
 */

export function extractSpokenText(markdown: string, isStreaming = false): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  let cleaned = markdown;

  // 1. Omit completed multi-line code blocks FIRST so greedy unclosed matching doesn't destroy earlier text
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");

  // 2. If currently streaming, safely strip unclosed trailing code block
  if (isStreaming) {
    cleaned = cleaned.replace(/```[a-zA-Z0-9_-]*\s*[\s\S]*$/, " ");
  }

  // 3. Omit completed inline code snippets
  cleaned = cleaned.replace(/`[^`\n]*`/g, " ");

  // 4. If currently streaming, safely strip unclosed trailing inline code
  if (isStreaming) {
    cleaned = cleaned.replace(/`[^`\n]*$/, " ");
  }

  // 5. Omit Markdown table rows and table separator rows (|---|---|)
  cleaned = cleaned.replace(/^\s*\|.*\|\s*$/gm, " ");
  cleaned = cleaned.replace(/^\s*\|?[-:| ]+\|?\s*$/gm, " ");

  // 6. Omit Markdown images: ![alt](url)
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]*\)/g, " ");

  // 7. Retain link anchor text while omitting target URL: [Google](https://...) -> Google
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // 8. Omit raw web URLs to avoid TTS spelling out domain characters
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, " ");

  // 9. Omit HTML tags (<br>, <div>, etc.)
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 10. Strip Markdown headings (#, ##, ###, etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // 11. Strip Markdown blockquote markers (> )
  cleaned = cleaned.replace(/^>\s+/gm, "");

  // 12. Strip text styling marks: bold (**text** or __text__), italic (*text* or _text_), strikethrough (~~text~~)
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, "$2");
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, "$2");
  cleaned = cleaned.replace(/~~(.*?)~~/g, "$1");

  // 13. Clean list bullets (*, -, +) and ordered list prefixes (1., 2.)
  cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, "");
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");

  // 14. Strip LaTeX math expressions: $$...$$ and $...$
  cleaned = cleaned.replace(/\$\$[\s\S]*?\$\$/g, " ");
  cleaned = cleaned.replace(/\$[^$\n]+\$/g, " ");

  // 15. Normalize newlines to sentence pauses and remove duplicate spaces
  cleaned = cleaned
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}
