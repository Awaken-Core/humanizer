import type { ProcessingMetadata } from "@/features/humanizer";

/**
 * Tone controls the flavor/register of the paraphrased output.
 */
export const ParaphraserTone = {
  Standard: "Standard",
  Formal: "Formal",
  Creative: "Creative",
  Shorten: "Shorten",
  Expand: "Expand",
} as const;

export type ParaphraserToneType =
  (typeof ParaphraserTone)[keyof typeof ParaphraserTone];

/**
 * Focus controls what aspect of the text is altered.
 */
export const ParaphraserFocus = {
  Vocabulary: "Vocabulary",
  Structure: "Structure",
  Both: "Both",
} as const;

export type ParaphraserFocusType =
  (typeof ParaphraserFocus)[keyof typeof ParaphraserFocus];

/**
 * Input request contract for the paraphrasing service
 */
export interface ParaphraseTextInput {
  text: string;
  tone?: ParaphraserToneType;
  focus?: ParaphraserFocusType;
}

/**
 * Generation output from DeepSeek model call
 */
export interface ParaphraseGenerationResult {
  paraphrasedText: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}

/**
 * Final service result returned by the paraphrasing pipeline
 */
export interface ParaphraseTextResult {
  originalText: string;
  paraphrasedText: string;
  selectedTone: ParaphraserToneType;
  selectedFocus: ParaphraserFocusType;
  processingMetadata: Omit<ProcessingMetadata, "analysis">;
}
