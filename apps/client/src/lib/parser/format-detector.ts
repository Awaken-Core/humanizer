import { parseDocx, reconstructDocx } from "./docx-parser";
import { maskLatex, unmaskLatex, extractLatexProse } from "./latex-parser";
import { maskMarkdown, unmaskMarkdown, extractMarkdownProse } from "./markdown-parser";
import { unpackBatchZip, repackageBatchZip } from "./zip-batch";

export type SupportedDocumentFormat = "docx" | "latex" | "markdown" | "txt" | "zip" | "unknown";

/**
 * Detects the document format from filename and optional content snippet.
 */
export function detectDocumentFormat(
  filename?: string,
  contentSnippet?: string
): SupportedDocumentFormat {
  if (filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith(".docx")) return "docx";
    if (lower.endsWith(".tex") || lower.endsWith(".latex")) return "latex";
    if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
    if (lower.endsWith(".txt")) return "txt";
    if (lower.endsWith(".zip")) return "zip";
  }

  if (contentSnippet) {
    const trimmed = contentSnippet.trim();
    if (
      trimmed.includes("\\documentclass") ||
      trimmed.includes("\\begin{document}") ||
      trimmed.includes("\\begin{equation}") ||
      trimmed.includes("\\section{")
    ) {
      return "latex";
    }
    if (
      trimmed.startsWith("# ") ||
      trimmed.startsWith("## ") ||
      trimmed.startsWith("---") ||
      trimmed.includes("```")
    ) {
      return "markdown";
    }
  }

  return "unknown";
}

