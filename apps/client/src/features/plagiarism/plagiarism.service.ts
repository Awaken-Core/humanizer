if (typeof window !== "undefined") {
  throw new Error("This module can only be used on the server.");
}

import {
  DEFAULT_PLAGIARISM_SETTINGS,
  PlagiarismEmptyInputError,
  PlagiarismInputSchema,
} from "./plagiarism.schema";
import { detectExclusionRegions } from "./plagiarism.exclusion";
import { retrieveCandidateSources } from "./plagiarism.retrieval";
import { scoreAllSources } from "./plagiarism.scorer";
import { generatePlagiarismSummary } from "./plagiarism.reporter";
import type { PlagiarismInput, PlagiarismResult, PlagiarismSettings } from "./plagiarism.types";

// ---------------------------------------------------------------------------
// Text Utilities
// ---------------------------------------------------------------------------

/**
 * Normalizes line endings (CRLF → LF, CR → LF) and trims leading/trailing
 * whitespace from the input text.
 *
 * @param text - Raw text from the request body.
 * @returns Normalized text string.
 */
function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * Counts words in a text string.
 *
 * @param text - Text to count words in.
 * @returns Number of whitespace-delimited word tokens.
 */
function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Counts sentences in a text string using common sentence-ending punctuation.
 *
 * @param text - Text to count sentences in.
 * @returns Estimated sentence count (minimum 1 if text is non-empty).
 */
function countSentences(text: string): number {
  if (!text.trim()) return 0;
  const matches = text.match(/[^.!?]+[.!?]*/g);
  return Math.max(1, matches?.length ?? 1);
}

// ---------------------------------------------------------------------------
// Main Orchestrator
// ---------------------------------------------------------------------------

/**
 * Orchestrates the full plagiarism detection pipeline:
 *
 *   1. Validate and normalize input.
 *   2. Detect exclusion regions (quotes, citations, bibliography).
 *   3. Count words and sentences.
 *   4. Retrieve candidate web sources.
 *   5. Score all sources via fingerprinting + cosine similarity.
 *   6. Generate an LLM-powered natural-language summary.
 *   7. Return the complete PlagiarismResult.
 *
 * @param input - Caller-supplied text and optional settings.
 * @returns Full plagiarism result with scores, matches, sources, and summary.
 * @throws {PlagiarismEmptyInputError} When the text is blank after normalization.
 * @throws {PlagiarismError} For other unrecoverable failures.
 */
export async function checkPlagiarism(input: PlagiarismInput): Promise<PlagiarismResult> {
  const startTime = Date.now();

  // --- Step 1: Validate ---
  const validated = PlagiarismInputSchema.safeParse(input);
  if (!validated.success) {
    const message =
      validated.error.issues[0]?.message || "Invalid plagiarism check input.";
    throw new PlagiarismEmptyInputError(message);
  }

  const { text: rawText, settings: partialSettings } = validated.data;

  // --- Step 2: Normalize text ---
  const text = normalizeText(rawText);
  if (!text) {
    throw new PlagiarismEmptyInputError("Input text contains only whitespace.");
  }

  // Merge caller settings with defaults
  const settings: PlagiarismSettings = {
    ...DEFAULT_PLAGIARISM_SETTINGS,
    ...partialSettings,
  };

  // --- Step 3: Detect exclusion regions ---
  const exclusionRegions = detectExclusionRegions(text, settings);

  // --- Step 4: Compute text statistics ---
  const wordCount = countWords(text);
  const sentenceCount = countSentences(text);

  // --- Step 5: Retrieve candidate web sources ---
  const candidateSources = await retrieveCandidateSources(text);

  // --- Step 6: Score all sources ---
  const { sources, matches, scores } = await scoreAllSources(
    text,
    candidateSources,
    exclusionRegions,
    settings
  );

  // --- Step 7: Generate summary ---
  const summary = await generatePlagiarismSummary(scores, sources, wordCount);

  const processingTimeMs = Date.now() - startTime;

  return {
    scores,
    sources,
    matches,
    wordCount,
    sentenceCount,
    summary,
    processingTimeMs,
    settings,
  };
}
