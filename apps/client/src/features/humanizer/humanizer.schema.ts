import { z } from "zod";
import { HumanizerIntensity, HumanizerMode } from "./humanizer.types";

/**
 * Maximum characters allowed for input text in API requests
 */
export const MAX_INPUT_TEXT_LENGTH = 15_000;

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
 * Helper to normalize mode strings (e.g. "natural" -> "Natural")
 */
function normalizeModeString(val: unknown): unknown {
  if (typeof val === "string") {
    const capitalized = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
    if (capitalized in HumanizerMode) {
      return capitalized;
    }
  }
  return val;
}

/**
 * Helper to normalize intensity strings (e.g. "medium" -> "Medium")
 */
function normalizeIntensityString(val: unknown): unknown {
  if (typeof val === "string") {
    const capitalized = val.charAt(0).toUpperCase() + val.slice(1).toLowerCase();
    if (capitalized in HumanizerIntensity) {
      return capitalized;
    }
  }
  return val;
}

/**
 * Zod schema for input request validation, accepting both capitalized ("Natural")
 * and lowercase ("natural") mode and intensity inputs.
 */
export const HumanizeTextInputSchema = z.object({
  text: z
    .string({
      required_error: "The 'text' field is required.",
      invalid_type_error: "The 'text' field must be a string.",
    })
    .trim()
    .min(1, "Input text cannot be empty or contain only whitespace.")
    .max(
      MAX_INPUT_TEXT_LENGTH,
      `Input text exceeds the maximum allowed limit of ${MAX_INPUT_TEXT_LENGTH.toLocaleString()} characters.`
    ),
  mode: z
    .preprocess(
      normalizeModeString,
      z.nativeEnum(HumanizerMode, {
        errorMap: () => ({
          message: "Mode must be one of: 'natural', 'academic', 'professional', or 'casual'.",
        }),
      })
    )
    .optional()
    .default(HumanizerMode.Natural),
  intensity: z
    .preprocess(
      normalizeIntensityString,
      z.nativeEnum(HumanizerIntensity, {
        errorMap: () => ({
          message: "Intensity must be one of: 'low', 'medium', or 'high'.",
        }),
      })
    )
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

export class PayloadTooLargeError extends HumanizerError {
  constructor(message = `Input text exceeds the maximum allowed length of ${MAX_INPUT_TEXT_LENGTH} characters.`) {
    super(message, "PAYLOAD_TOO_LARGE", 413);
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
