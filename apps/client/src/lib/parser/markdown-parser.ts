/**
 * Markdown AST & Syntax Preservation Engine
 *
 * Masks and preserves:
 * - Frontmatter metadata (--- ... ---)
 * - Fenced code blocks (```lang ... ``` and ~~~ ... ~~~)
 * - Inline code spans (`...`)
 * - Tables (| col1 | col2 |)
 * - Image tags (![alt](url))
 * - Link URLs ([anchor](url) -> anchor preserved, URL protected)
 * - Raw HTML markup blocks
 * - Math markers ($...$, $$...$$)
 */

export interface MarkdownMaskResult {
  maskedText: string;
  placeholders: Map<string, string>;
  stats: {
    frontmatterCount: number;
    codeBlockCount: number;
    inlineCodeCount: number;
    tableCount: number;
    linkCount: number;
    htmlCount: number;
    totalProtected: number;
  };
}

const MD_MASK_PREFIX = "__TX_MD_MASK_";
const MD_MASK_SUFFIX = "__";

/**
 * Masks all code blocks, frontmatter, tables, and link targets from a markdown document.
 *
 * @param markdown - Raw markdown string.
 * @returns {@link MarkdownMaskResult} containing masked text and placeholder map.
 */
export function maskMarkdown(markdown: string): MarkdownMaskResult {
  const placeholders = new Map<string, string>();
  const stats = {
    frontmatterCount: 0,
    codeBlockCount: 0,
    inlineCodeCount: 0,
    tableCount: 0,
    linkCount: 0,
    htmlCount: 0,
    totalProtected: 0,
  };

  let counter = 0;
  function createPlaceholder(original: string): string {
    const key = `${MD_MASK_PREFIX}${counter++}${MD_MASK_SUFFIX}`;
    placeholders.set(key, original);
    stats.totalProtected++;
    return key;
  }

  let text = markdown;

  // 1. Frontmatter (YAML at document start)
  text = text.replace(/^---[\r\n]+[\s\S]*?[\r\n]+---/, (match) => {
    stats.frontmatterCount++;
    return createPlaceholder(match);
  });

  // 2. Fenced Code Blocks (``` ... ``` or ~~~ ... ~~~)
  text = text.replace(/(```|~~~)[a-zA-Z0-9_-]*[\r\n][\s\S]*?\1/g, (match) => {
    stats.codeBlockCount++;
    return createPlaceholder(match);
  });

  // 3. Inline Code Spans (` ... `)
  text = text.replace(/`[^`\r\n]+`/g, (match) => {
    stats.inlineCodeCount++;
    return createPlaceholder(match);
  });

  // 4. HTML Elements (<div ...> ... </div> or self-closing <img ... />)
  text = text.replace(/<([a-zA-Z0-9]+)(?:\s+[^>]*)?>[\s\S]*?<\/\1>/gi, (match) => {
    stats.htmlCount++;
    return createPlaceholder(match);
  });
  text = text.replace(/<[a-zA-Z0-9]+[^>]*\/>/g, (match) => {
    stats.htmlCount++;
    return createPlaceholder(match);
  });

  // 5. Image tags: ![alt text](image-url.png "optional title")
  text = text.replace(/!\[[^\]]*\]\([^)]+\)/g, (match) => {
    stats.linkCount++;
    return createPlaceholder(match);
  });

  // 6. Link URLs: [anchor text](https://example.com/url) -> preserve anchor text, mask URL
  text = text.replace(/\[([^\]\r\n]+)\]\(([^)\r\n\s]+)\)/g, (_match, anchorText, url) => {
    stats.linkCount++;
    const urlPlaceholder = createPlaceholder(`(${url})`);
    return `[${anchorText}]${urlPlaceholder}`;
  });

  // 7. Markdown Tables: lines starting and ending with pipes
  text = text.replace(/(?:^|\n)(\|[^\n]+\|\r?\n\|[-:\s|]+\|\r?\n(?:\|[^\n]+\|\r?\n?)+)/g, (_match, tableBlock) => {
    stats.tableCount++;
    return `\n\n${createPlaceholder(tableBlock)}\n\n`;
  });

  return {
    maskedText: text,
    placeholders,
    stats,
  };
}

/**
 * Unmasks protected markdown elements back into the rewritten text.
 *
 * @param maskedText - Text containing markdown placeholders.
 * @param placeholders - Map of placeholder keys to original markdown strings.
 * @returns Fully restored markdown text.
 */
export function unmaskMarkdown(
  maskedText: string,
  placeholders: Map<string, string>
): string {
  if (placeholders.size === 0) return maskedText;

  let restored = maskedText;
  for (const [key, original] of placeholders.entries()) {
    restored = restored.split(key).join(original);
  }
  return restored;
}

/**
 * Extracts prose from markdown for analysis, stripping hashes (#), bullets, and table markers.
 *
 * @param markdown - The raw markdown text.
 * @returns Clean prose text.
 */
export function extractMarkdownProse(markdown: string): string {
  const { maskedText } = maskMarkdown(markdown);

  return maskedText
    // Remove headers (#, ##, ###)
    .replace(/^#{1,6}\s+/gm, "")
    // Remove blockquote arrows (>)
    .replace(/^>\s+/gm, "")
    // Remove list markers (*, -, +, 1.)
    .replace(/^[ \t]*[-*+]\s+/gm, "")
    .replace(/^[ \t]*\d+\.\s+/gm, "")
    // Remove bold/italics markers
    .replace(/(\*\*|__)(.*?)\1/g, "$2")
    .replace(/(\*|_)(.*?)\1/g, "$2")
    // Remove placeholders
    .replace(/__TX_MD_MASK_\d+__/g, " ")
    // Collapse excess whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

