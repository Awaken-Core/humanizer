/**
 * Core TypeScript types for the AI Detector feature.
 * 100% decision-based — no LLM calls.
 */

/** Individual signal used by the AI detection engine. */
export interface DetectionSignal {
  /** Machine-readable signal identifier. */
  name: string;
  /** Human-readable label. */
  label: string;
  /** Raw computed value for this signal (range varies per signal). */
  rawValue: number;
  /** Normalised score 0–1 where 1 = strongly AI-like. */
  score: number;
  /** Weight applied when computing the overall composite score. */
  weight: number;
  /** Short natural-language interpretation of this signal's reading. */
  interpretation: string;
}

/** Aggregated scoring from all detection signals. */
export interface DetectionScores {
  /** Weighted composite AI probability 0–100. */
  aiProbability: number;
  /** Inverse: estimated human-written percentage 0–100. */
  humanProbability: number;
  /** Categorical verdict. */
  verdict: "likely_ai" | "possibly_ai" | "uncertain" | "likely_human";
  /** Individual signal breakdown. */
  signals: DetectionSignal[];
}

/** Highlighted span within the original text. */
export interface HighlightSpan {
  startChar: number;
  endChar: number;
  /** Higher confidence = more AI-like. */
  confidence: number;
  /** Which signal(s) triggered this highlight. */
  reasons: string[];
}

/** Full result returned from the AI detection service. */
export interface AiDetectionResult {
  scores: DetectionScores;
  highlights: HighlightSpan[];
  wordCount: number;
  sentenceCount: number;
  /** Brief narrative summary of findings (template-generated, no LLM). */
  summary: string;
  processingTimeMs: number;
}

/** Input to the AI detection service. */
export interface AiDetectionInput {
  text: string;
}

