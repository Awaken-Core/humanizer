import { z } from "zod";
import { HumanizerIntensity, HumanizerMode } from "./humanizer.types";

/**
 * Zod schema for runtime validation of the DeepSeek analysis response
 */
export const WritingAnalysisSchema = z.object({
  language: z.string().min(1).default("English"),
  writingType: z.string().min(1).default("general prose"),
  targetAudience: z.string().min(1).default("general audience"),
  tone: z.string().min(1).default("neutral"),
  sentenceStructure: z.object({
    averageLength: z
      .enum(["short", "medium", "long", "varied"])
      .default("varied"),
    varietyLevel: z.enum(["low", "moderate", "high"]).default("moderate"),
    patterns: z.array(z.string()).default([]),
  }),
  paragraphStructure: z.object({
    averageLength: z.enum(["brief", "balanced", "dense"]).default("balanced"),
    flow: z.string().default("standard progression"),
  }),
  vocabularyComplexity: z
    .enum(["basic", "intermediate", "advanced", "technical"])
    .default("intermediate"),
  repetitivePhrasing: z.array(z.string()).default([]),
  aiMarkersDetected: z.array(z.string()).default([]),
  overallStyle: z.string().default("direct"),
  actionableInstructions: z.array(z.string()).default([]),
});

/**
 * Zod schema for input request validation
 */
export const HumanizeTextInputSchema = z.object({
  text: z
    .string()
    .min(1, "Input text cannot be empty.")
    .max(50_000, "Input text exceeds maximum allowed length of 50,000 characters."),
  mode: z
    .nativeEnum(HumanizerMode)
    .optional()
    .default(HumanizerMode.Natural),
  intensity: z
    .nativeEnum(HumanizerIntensity)
    .optional()
    .default(HumanizerIntensity.Medium),
});

/**
 * Standard typed errors for the Humanizer engine
 */
export class HumanizerError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly causeDetails?: unknown;

  constructor(message: string, code = "HUMANIZER_ERROR", status = 500, causeDetails?: unknown) {
    super(message);
    this.name = "HumanizerError";
    this.code = code;
    this.status = status;
    this.causeDetails = causeDetails;
  }
}

export class EmptyInputError extends HumanizerError {
  constructor(message = "Input text must contain non-whitespace characters.") {
    super(message, "EMPTY_INPUT", 400);
  }
}

export class ProviderApiError extends HumanizerError {
  constructor(message: string, status = 502, causeDetails?: unknown) {
    super(message, "PROVIDER_API_ERROR", status, causeDetails);
  }
}

export class AnalysisParseError extends HumanizerError {
  constructor(message: string, causeDetails?: unknown) {
    super(message, "ANALYSIS_PARSE_ERROR", 502, causeDetails);
  }
}

export class RewritingFailedError extends HumanizerError {
  constructor(message: string, causeDetails?: unknown) {
    super(message, "REWRITING_FAILED", 502, causeDetails);
  }
}

