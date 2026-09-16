/**
 * Utility to parse agent responses and extract spoken-friendly text,
 * strictly omitting code blocks, inline code, and formatting artifacts.
 */

export function extractSpokenText(markdown: string, isStreaming = false): string {
  if (!markdown || typeof markdown !== "string") {
    return "";
  }

  let cleaned = markdown;

  // If currently streaming, safely strip unclosed trailing code blocks or inline code
  if (isStreaming) {
    cleaned = cleaned.replace(/```[\s\S]*$/, " ");
    cleaned = cleaned.replace(/`[^`\n]*$/, " ");
  }

  // 1. Omit multi-line code blocks (fenced code: ```lang ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, " ");

  // 2. Omit inline code snippets (e.g. `val x = 1` or `myFunction()`)
  cleaned = cleaned.replace(/`[^`\n]*`/g, " ");

  // 3. Omit Markdown images: ![alt](url)
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^)]*\)/g, " ");

  // 4. Retain link anchor text while omitting target URL: [Google](https://...) -> Google
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");

  // 5. Omit raw web URLs to avoid TTS spelling out domain characters
  cleaned = cleaned.replace(/https?:\/\/\S+/gi, " ");

  // 6. Omit HTML tags (<br>, <div>, etc.)
  cleaned = cleaned.replace(/<[^>]+>/g, " ");

  // 7. Strip Markdown headings (#, ##, ###, etc.)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, "");

  // 8. Strip Markdown blockquote markers (> )
  cleaned = cleaned.replace(/^>\s+/gm, "");

  // 9. Strip text styling marks: bold (**text** or __text__), italic (*text* or _text_), strikethrough (~~text~~)
  cleaned = cleaned.replace(/(\*\*|__)(.*?)\1/g, "$2");
  cleaned = cleaned.replace(/(\*|_)(.*?)\1/g, "$2");
  cleaned = cleaned.replace(/~~(.*?)~~/g, "$1");

  // 10. Clean unordered list bullets (*, -, +)
  cleaned = cleaned.replace(/^[\*\-\+]\s+/gm, "");

  // 11. Normalize newlines to sentence pauses and remove duplicate spaces
  cleaned = cleaned
    .replace(/\r\n/g, "\n")
    .replace(/\n{2,}/g, ". ")
    .replace(/\n/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

  return cleaned;
}
