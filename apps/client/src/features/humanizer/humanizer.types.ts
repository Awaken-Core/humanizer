import { z } from "zod";
import type { PreprocessChange } from "./humanizer.preprocessor";

/**
 * Supported Writing Modes
 */
export const HumanizerMode = {
  Natural: "Natural",
  Academic: "Academic",
  Professional: "Professional",
  Casual: "Casual",
} as const;

export type HumanizerModeType =
  (typeof HumanizerMode)[keyof typeof HumanizerMode];

/**
 * Supported Humanization Intensity Levels
 */
export const HumanizerIntensity = {
  Low: "Low",
  Medium: "Medium",
  High: "High",
} as const;

export type HumanizerIntensityType =
  (typeof HumanizerIntensity)[keyof typeof HumanizerIntensity];

/**
 * Structured Writing Analysis produced by the analyzer engine
 */
export interface WritingAnalysis {
  language: string;
  writingType: string;
  targetAudience: string;
  tone: string;
  sentenceStructure: {
    averageLength: "short" | "medium" | "long" | "varied";
    varietyLevel: "low" | "moderate" | "high";
    patterns: string[];
  };
  paragraphStructure: {
    averageLength: "brief" | "balanced" | "dense";
    flow: string;
  };
  vocabularyComplexity: "basic" | "intermediate" | "advanced" | "technical";
  repetitivePhrasing: string[];
  aiMarkersDetected: string[];
  overallStyle: string;
  actionableInstructions: string[];
}

/**
 * Input request for the humanization service
 */
export interface HumanizeTextInput {
  text: string;
  mode?: HumanizerModeType;
  intensity?: HumanizerIntensityType;
}

/**
 * Processing metadata returned with humanized output
 */
export interface ProcessingMetadata {
  model: string;
  durationMs: number;
  tokens?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  analysis: WritingAnalysis;
  /** Log of deterministic preprocessing transformations applied before the LLM pipeline. */
  preprocessChanges?: PreprocessChange[];
}

/**
 * Output result from the humanization service
 */
export interface HumanizeTextResult {
  originalText: string;
  humanizedText: string;
  detectedLanguage: string;
  selectedMode: HumanizerModeType;
  selectedIntensity: HumanizerIntensityType;
  processingMetadata: ProcessingMetadata;
}
