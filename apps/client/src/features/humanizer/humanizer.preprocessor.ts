if (typeof window !== "undefined") {
  throw new Error("This module can only be executed on the server.");
}

import type { HumanizerIntensityType } from "./humanizer.types";
import aiMarkersRaw from "./rules/ai-markers.json";
import discourseMarkersRaw from "./rules/discourse-markers.json";
import aiSignaturesRaw from "./rules/ai-signatures.json";
import { AiSignaturesDto, MarkerRulesDto } from "./humanizer-rules.dto";

// ---------------------------------------------------------------------------
// Type helpers for the JSON imports
// ---------------------------------------------------------------------------

// Parse static rule files once at module initialization.
const { __prompt__: _aiPrompt, ...aiMarkers } =
  MarkerRulesDto.parse(aiMarkersRaw);
const { __prompt__: _discPrompt, ...discourseMarkers } =
  MarkerRulesDto.parse(discourseMarkersRaw);
const aiSignatures = AiSignaturesDto.parse(aiSignaturesRaw);

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/**
 * Describes a single preprocessing transformation applied to the text.
 */
export interface PreprocessChange {
  stage:
    | "zero-width-purge"
    | "ai-marker-erasure"
    | "discourse-rotation"
    | "signature-normalization";
  description: string;
  count: number;
}

/**
 * Result produced by {@link preprocessText}.
 */
export interface PreprocessResult {
  /** The text after all preprocessing stages have been applied. */
  processedText: string;
  /**
   * Protected content blocks (code fences, inline code, URLs) extracted
   * before LLM processing. Indexed by their placeholder ordinal so they
   * can be restored via {@link restoreProtectedBlocks}.
   */
  protectedBlocks: string[];
  /** Log of every transformation stage that was applied. */
  changes: PreprocessChange[];
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Computes a deterministic 32-bit integer hash from a string (djb2 variant).
 * Used to pick replacement alternatives without relying on Math.random().
 */
function hashString(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    // eslint-disable-next-line no-bitwise
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  // Ensure unsigned 32-bit
  // eslint-disable-next-line no-bitwise
  return hash >>> 0;
}

/**
 * Picks a deterministic index into an alternatives array using a seed string.
 * The seed combines the document text hash with the phrase being replaced so
 * each phrase gets its own stable but document-specific selection.
 */
function deterministicPick(alternatives: string[], seedStr: string): string {
  const idx = hashString(seedStr) % alternatives.length;
  return alternatives[idx];
}

/**
 * Escapes special regex metacharacters in a literal string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Preserves the original capitalisation of the matched token when substituting.
 * Rules:
 *  - ALL_CAPS → replacement.toUpperCase()
 *  - Title Case (first letter upper) → replacement with first letter uppercased
 *  - Otherwise → replacement as-is
 */
function matchCase(original: string, replacement: string): string {
  if (
    original === original.toUpperCase() &&
    original !== original.toLowerCase()
  ) {
    return replacement.toUpperCase();
  }
  if (
    original.length > 0 &&
    original[0] === original[0].toUpperCase() &&
    original[0] !== original[0].toLowerCase()
  ) {
    return replacement.charAt(0).toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

// ---------------------------------------------------------------------------
// Stage implementations
// ---------------------------------------------------------------------------

/**
 * Stage 1 — Zero-Width Unicode Purge.
 * Removes invisible/zero-width characters often inserted by AI tools as
 * watermarks or artefacts: U+200B, U+200C, U+200D, U+2060, U+FEFF.
 */
function purgeZeroWidthChars(text: string): { text: string; count: number } {
  const zeroWidthRe = /\u200B|\u200C|\u200D|\u2060|\uFEFF/g;
  let count = 0;
  const result = text.replace(zeroWidthRe, () => {
    count++;
    return "";
  });
  return { text: result, count };
}

/**
 * Stage 2 — AI Marker Erasure.
 * Replaces known AI-cliché phrases with deterministic natural alternatives.
 * Replacement is chosen by hashing the document text + phrase, so the same
 * document always produces the same output.
 */
function eraseAiMarkers(
  text: string,
  docHash: number,
): { text: string; count: number } {
  let result = text;
  let count = 0;

  for (const [phrase, alternatives] of Object.entries(aiMarkers)) {
    if (!Array.isArray(alternatives) || alternatives.length === 0) continue;

    // Build a word-boundary-aware, case-insensitive pattern
    const pattern = new RegExp(
      `(?<![\\w])${escapeRegex(phrase)}(?![\\w])`,
      "gi",
    );

    result = result.replace(pattern, (match) => {
      const seed = String(docHash) + phrase;
      const replacement = deterministicPick(alternatives, seed);
      count++;
      return matchCase(match, replacement);
    });
  }

  return { text: result, count };
}

/**
 * Stage 3 — Discourse Marker Rotation.
 * For discourse markers that appear 2 or more times in the text, subsequent
 * occurrences (2nd, 3rd, …) are rotated through the alternatives pool so the
 * same connector is not repeated verbatim.
 */
function rotateDiscourseMarkers(text: string): { text: string; count: number } {
  let result = text;
  let totalCount = 0;

  for (const [marker, alternatives] of Object.entries(discourseMarkers)) {
    if (!Array.isArray(alternatives) || alternatives.length === 0) continue;

    const pattern = new RegExp(
      `(?<![\\w])${escapeRegex(marker)}(?![\\w])`,
      "g",
    );

    const matchPositions: number[] = [];
    let m: RegExpExecArray | null;

    // First pass: count occurrences
    while ((m = pattern.exec(result)) !== null) {
      matchPositions.push(m.index);
    }

    if (matchPositions.length < 2) continue;

    // Second pass: replace occurrences ≥ 2 with rotated alternatives
    let rotationIndex = 0;
    let occurrenceCount = 0;

    result = result.replace(
      new RegExp(`(?<![\\w])${escapeRegex(marker)}(?![\\w])`, "g"),
      (match) => {
        occurrenceCount++;
        if (occurrenceCount === 1) {
          // Keep the first occurrence intact
          return match;
        }
        const replacement = alternatives[rotationIndex % alternatives.length];
        rotationIndex++;
        totalCount++;
        return matchCase(match, replacement);
      },
    );
  }

  return { text: result, count: totalCount };
}

/**
 * Stage 4 — AI Signature Normalization.
 * Fixes structural patterns that are characteristic of AI prose:
 * - Em-dashes used as sentence connectors
 * - Forbidden sentence openers
 */
function normalizeSignatures(
  text: string,
  docHash: number,
): { text: string; count: number } {
  let result = text;
  let count = 0;

  // Replace em-dash " — " used as a sentence connector (followed by lowercase)
  const emDashRe = / \u2014 (?=[a-z])/g;
  result = result.replace(emDashRe, () => {
    count++;
    return ", ";
  });

  // Process other patterns from ai-signatures.json
  for (const sig of aiSignatures.patterns) {
    // Skip em-dash — already handled above
    if (sig.pattern === " \u2014 ") continue;
    if (!Array.isArray(sig.replacements) || sig.replacements.length === 0)
      continue;

    const seed = String(docHash) + sig.pattern;
    const replacement = deterministicPick(sig.replacements, seed);
    const re = new RegExp(escapeRegex(sig.pattern), "g");
    result = result.replace(re, () => {
      count++;
      return replacement;
    });
  }

  // Remove forbidden openers by stripping them from the start of sentences
  for (const opener of aiSignatures.forbidden_openers) {
    const re = new RegExp(`(^|(?<=\\.\\s+))${escapeRegex(opener)}`, "gi");
    result = result.replace(re, (match, prefix: string) => {
      count++;
      // Preserve the prefix (start or period+space), strip the opener phrase
      return prefix;
    });
  }

  return { text: result, count };
}

/**
 * Stage 5 — Protected Region Masking.
 * Extracts fenced code blocks, inline code snippets, URLs, LaTeX math environments,
 * inline/display math ($...$, $$...$$, \[...\]), and bibliographic citations (\cite{...}),
 * replacing them with `\x00BLOCK_N\x00` placeholders. The originals are stored in the
 * returned array and must be restored after LLM processing via
 * {@link restoreProtectedBlocks}.
 *
 * This stage runs regardless of intensity level to preserve syntax and formulas.
 */
function maskProtectedBlocks(text: string): {
  text: string;
  blocks: string[];
} {
  const blocks: string[] = [];

  const placeholder = (idx: number): string => `\x00BLOCK_${idx}\x00`;

  // Order matters: fenced blocks first (they may contain backtick runs, math, or URLs)
  const fencedCodeRe = /```[\s\S]*?```/g;
  let result = text.replace(fencedCodeRe, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });

  // LaTeX Math Environments (\begin{equation}...\end{equation}, \begin{align}...\end{align}, etc.)
  const mathEnvRe =
    /\\begin\{(?:equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|split|matrix|pmatrix|bmatrix|array|cases)\}[\s\S]*?\\end\{(?:equation\*?|align\*?|gather\*?|multline\*?|flalign\*?|split|matrix|pmatrix|bmatrix|array|cases)\}/g;
  result = result.replace(mathEnvRe, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });

  // Display math ($$...$$ and \[...\])
  result = result.replace(/\$\$[\s\S]*?\$\$/g, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });
  result = result.replace(/\\\[[\s\S]*?\\\]/g, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });

  // Inline math ($...$ and \(...\))
  result = result.replace(/(?<!\\)\$(?!\$)(?:\\.|[^\$\\\n])+\$/g, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });
  result = result.replace(/\\\([\s\S]*?\\\)/g, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });

  // Bibliographic and Citation Commands (\cite{...}, \citep{...}, \citet{...}, etc.)
  const citationRe =
    /\\(?:cite|citep|citet|citeauthor|citeyear|nocite|footcite|autocite)\*?(?:\[[^\]]*\])?\{[^}]+\}/g;
  result = result.replace(citationRe, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });

  // Inline code (single backtick pairs, non-greedy, not crossing newlines)
  const inlineCodeRe = /`[^`\n]+`/g;
  result = result.replace(inlineCodeRe, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });

  // URLs (http / https)
  const urlRe = /https?:\/\/\S+/g;
  result = result.replace(urlRe, (match) => {
    const idx = blocks.length;
    blocks.push(match);
    return placeholder(idx);
  });

  return { text: result, blocks };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs the five-stage deterministic preprocessing pipeline on `text` before
 * it enters the LLM workflow.
 *
 * Stages:
 * 1. Zero-Width Unicode Purge (always)
 * 2. AI Marker Erasure (skipped when intensity is "Low")
 * 3. Discourse Marker Rotation (skipped when intensity is "Low")
 * 4. AI Signature Normalization (always)
 * 5. Protected Region Masking (always)
 *
 * The function is **deterministic**: identical inputs always produce identical
 * outputs. Variation across documents is achieved by hashing the source text.
 *
 * @param text - The normalised input text to preprocess.
 * @param intensity - The user-selected humanisation intensity level.
 * @returns A {@link PreprocessResult} containing the processed text, the list
 *   of protected blocks for later restoration, and a change log.
 */
export function preprocessText(
  text: string,
  intensity: HumanizerIntensityType,
): PreprocessResult {
  const changes: PreprocessChange[] = [];

  // Handle degenerate inputs early
  if (!text || !text.trim()) {
    return { processedText: text, protectedBlocks: [], changes };
  }

  // Compute a single document-level hash used throughout all stages
  const docHash = hashString(text);

  // ── Stage 5 first: mask protected blocks so subsequent stages never touch
  //    code or URLs.
  const { text: maskedText, blocks: protectedBlocks } =
    maskProtectedBlocks(text);

  let current = maskedText;

  // ── Stage 1: Zero-Width Unicode Purge
  const s1 = purgeZeroWidthChars(current);
  current = s1.text;
  if (s1.count > 0) {
    changes.push({
      stage: "zero-width-purge",
      description: "Removed invisible zero-width unicode characters.",
      count: s1.count,
    });
  }

  // ── Stage 2: AI Marker Erasure (Medium / High only)
  if (intensity !== "Low") {
    const s2 = eraseAiMarkers(current, docHash);
    current = s2.text;
    if (s2.count > 0) {
      changes.push({
        stage: "ai-marker-erasure",
        description: `Replaced ${s2.count} AI cliché phrase(s) with natural alternatives.`,
        count: s2.count,
      });
    }
  }

  // ── Stage 3: Discourse Marker Rotation (Medium / High only)
  if (intensity !== "Low") {
    const s3 = rotateDiscourseMarkers(current);
    current = s3.text;
    if (s3.count > 0) {
      changes.push({
        stage: "discourse-rotation",
        description: `Rotated ${s3.count} repeated discourse marker(s) to prevent over-repetition.`,
        count: s3.count,
      });
    }
  }

  // ── Stage 4: AI Signature Normalization
  const s4 = normalizeSignatures(current, docHash);
  current = s4.text;
  if (s4.count > 0) {
    changes.push({
      stage: "signature-normalization",
      description: `Normalised ${s4.count} AI structural signature(s) (em-dashes, forbidden openers, etc.).`,
      count: s4.count,
    });
  }

  return {
    processedText: current,
    protectedBlocks,
    changes,
  };
}

/**
 * Restores protected content blocks (code, URLs) that were masked by
 * {@link preprocessText} back into the final LLM output.
 *
 * Call this on the humanized text **after** the LLM has finished rewriting,
 * passing the same `protectedBlocks` array returned by `preprocessText`.
 *
 * @param text - The LLM-rewritten text containing `\x00BLOCK_N\x00` placeholders.
 * @param blocks - The protected blocks array from the matching `preprocessText` call.
 * @returns The text with all placeholders replaced by the original content.
 */
export function restoreProtectedBlocks(text: string, blocks: string[]): string {
  if (blocks.length === 0) return text;

  let result = text;
  for (let i = 0; i < blocks.length; i++) {
    // Use a literal string replacement to avoid regex interpretation of $ in URLs
    result = result.split(`\x00BLOCK_${i}\x00`).join(blocks[i]);
  }
  return result;
}
