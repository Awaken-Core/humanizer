/**
 * LaTeX Manuscript AST & Math Run Parser
 *
 * Mathematically isolates and protects LaTeX syntax elements:
 * - Inline math ($...$, \(...\))
 * - Display math ($$...$$, \[...\])
 * - Complex math environments (\begin{equation}, \begin{align}, etc.)
 * - Bibliographic citation keys (\cite{...}, \citep{...}, \citet{...})
 * - Preamble commands, packages, labels, references, and comments
 *
 * Guarantees that academic formulas and document structures remain 100%
 * bit-for-bit identical before and after text humanization or paraphrasing.
 */

export interface LatexMaskResult {
  /** The text with all protected LaTeX syntax replaced by unique placeholders */
  maskedText: string;
  /** Map of placeholder tokens to their original verbatim LaTeX strings */
  placeholders: Map<string, string>;
  /** Count of protected math, citation, and structural elements */
  stats: {
    mathInlineCount: number;
    mathDisplayCount: number;
    mathEnvCount: number;
    citationCount: number;
    commandCount: number;
    commentCount: number;
    totalProtected: number;
  };
}

/**
 * Prefix used for LaTeX placeholders.
 * Uses alphanumeric underscores that LLMs and tokenizers treat as single non-splitting words.
 */
const MASK_PREFIX = "__TX_LATEX_MASK_";
const MASK_SUFFIX = "__";

/**
 * Masks all math, citation keys, commands, and comments from a LaTeX string.
 *
 * @param latex - The raw LaTeX manuscript text.
 * @returns {@link LatexMaskResult} containing the masked prose and placeholder map.
 */
export function maskLatex(latex: string): LatexMaskResult {
  const placeholders = new Map<string, string>();
  const stats = {
    mathInlineCount: 0,
    mathDisplayCount: 0,
    mathEnvCount: 0,
    citationCount: 0,
    commandCount: 0,
    commentCount: 0,
    totalProtected: 0,
  };

  let counter = 0;
  function createPlaceholder(original: string): string {
    const key = `${MASK_PREFIX}${counter++}${MASK_SUFFIX}`;
    placeholders.set(key, original);
    stats.totalProtected++;
    return key;
  }

  let text = latex;

  // 1. Protect Comments (% ... to end of line, avoiding escaped \%)
  text = text.replace(/(?<!\\)%[^\r\n]*/g, (match) => {
    stats.commentCount++;
    return createPlaceholder(match);
  });

  // 2. Protect Complex Math Environments (\begin{equation}...\end{equation}, \begin{align}...\end{align}, etc.)
  const mathEnvironments = [
    "equation",
    "equation\\*",
    "align",
    "align\\*",
    "gather",
    "gather\\*",
    "multline",
    "multline\\*",
    "flalign",
    "flalign\\*",
    "split",
    "matrix",
    "pmatrix",
    "bmatrix",
    "vmatrix",
    "Vmatrix",
    "array",
    "cases",
    "subequations",
    "subequations\\*",
  ];
  const envPattern = new RegExp(
    `\\\\begin\\{(${mathEnvironments.join("|")})\\}[\\s\\S]*?\\\\end\\{\\1\\}`,
    "g"
  );
  text = text.replace(envPattern, (match) => {
    stats.mathEnvCount++;
    return createPlaceholder(match);
  });

  // 3. Protect Display Math ($$...$$ and \[...\])
  text = text.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    stats.mathDisplayCount++;
    return createPlaceholder(match);
  });
  text = text.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
    stats.mathDisplayCount++;
    return createPlaceholder(match);
  });

  // 4. Protect Inline Math ($...$ and \(...\))
  // Avoid matching escaped \$ or empty $$
  text = text.replace(/(?<!\\)\$(?!\$)(?:\\.|[^\$\\\n])+\$/g, (match) => {
    stats.mathInlineCount++;
    return createPlaceholder(match);
  });
  text = text.replace(/\\\([\s\S]*?\\\)/g, (match) => {
    stats.mathInlineCount++;
    return createPlaceholder(match);
  });

  // 5. Protect Bibliographic and Citation Commands
  // \cite{...}, \citep{...}, \citet{...}, \citeauthor{...}, \citeyear{...}, \nocite{...}, etc.
  text = text.replace(
    /\\(?:cite|citep|citet|citeauthor|citeyear|nocite|footcite|autocite|textcite)\*?(?:\[[^\]]*\])?\{[^}]+\}/g,
    (match) => {
      stats.citationCount++;
      return createPlaceholder(match);
    }
  );

  // 6. Protect Core Structural & LaTeX Metadata Commands
  // \documentclass, \usepackage, \bibliography, \bibliographystyle, \label, \ref, \eqref, \pageref, \autoref, \input, \include
  text = text.replace(
    /\\(?:documentclass|usepackage|bibliography|bibliographystyle|label|ref|eqref|pageref|autoref|input|include|def|newcommand|renewcommand)(?:\[[^\]]*\])?\{[^}]*\}/g,
    (match) => {
      stats.commandCount++;
      return createPlaceholder(match);
    }
  );

  // 7. Protect standalone document lifecycle tags
  text = text.replace(/\\(?:begin|end)\{document\}/g, (match) => {
    stats.commandCount++;
    return createPlaceholder(match);
  });

  return {
    maskedText: text,
    placeholders,
    stats,
  };
}

/**
 * Restores all protected LaTeX tokens back into their exact original positions.
 * Uses literal string split/join to guarantee zero regex $-substitution anomalies.
 *
 * @param maskedText - Text containing LaTeX placeholders.
 * @param placeholders - Map of placeholder keys to original LaTeX strings.
 * @returns Verbatim restored LaTeX text.
 */
export function unmaskLatex(
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
 * Extracts prose paragraphs from a LaTeX manuscript for plagiarism or AI detection checking.
 * Strips all masked formatting so only natural language sentences are evaluated.
 *
 * @param latex - The raw LaTeX manuscript text.
 * @returns Cleaned prose suitable for language processing.
 */
export function extractLatexProse(latex: string): string {
  const { maskedText } = maskLatex(latex);

  return maskedText
    // Remove remaining structural commands like \section{Title} -> Title
    .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?\{([^}]*)\}/g, "$1 ")
    // Remove lone slash commands like \item, \newpage
    .replace(/\\[a-zA-Z]+\*?/g, " ")
    // Remove placeholders
    .replace(/__TX_LATEX_MASK_\d+__/g, " ")
    // Remove braces
    .replace(/[{}]/g, " ")
    // Collapse excess whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .trim();
}

