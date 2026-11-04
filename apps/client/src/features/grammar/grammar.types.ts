/**
 * Core TypeScript types for the Grammar & Style Checker feature.
 */

export const ANONYMOUS_MAX_GRAMMAR_LENGTH = 800;
export const AUTHENTICATED_MAX_GRAMMAR_LENGTH = 15_000;

export type GrammarCategory =
  | "grammar"
  | "spelling"
  | "punctuation"
  | "clarity"
  | "style";

export interface GrammarIssue {
  startChar: number;
  endChar: number;
  original: string;
  replacement: string;
  category: GrammarCategory;
  explanation: string;
}

export interface GrammarCheckInput {
  text: string;
}

export interface GrammarCheckResult {
  originalText: string;
  correctedText: string;
  issues: GrammarIssue[];
  /** Overall correctness score 0–100. */
  score: number;
  wordCount: number;
  summary: string;
  processingTimeMs: number;
}
