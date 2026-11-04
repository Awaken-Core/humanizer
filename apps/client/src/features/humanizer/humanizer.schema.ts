import { z } from "zod";
import { HumanizerIntensity, HumanizerMode } from "./humanizer.types";

export const ANONYMOUS_MAX_INPUT_TEXT_LENGTH = 800;
export const AUTHENTICATED_MAX_INPUT_TEXT_LENGTH = 15_000;
export const MAX_INPUT_TEXT_LENGTH = AUTHENTICATED_MAX_INPUT_TEXT_LENGTH;

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

const HumanizerModeDto = z
  .string()
  .transform(
    (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
  )
  .pipe(z.nativeEnum(HumanizerMode));

const HumanizerIntensityDto = z
  .string()
  .transform(
    (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
  )
  .pipe(z.nativeEnum(HumanizerIntensity));

export function createHumanizeTextInputSchema(maxLength: number) {
  return z
    .object({
      text: z
        .string({ error: "The 'text' field must be a string." })
        .trim()
        .min(1, "Input text cannot be empty or contain only whitespace.")
        .max(
          maxLength,
          `Input text exceeds the maximum allowed limit of ${maxLength.toLocaleString()} characters.`,
        ),
      mode: HumanizerModeDto.optional().default(HumanizerMode.Natural),
      intensity: HumanizerIntensityDto.optional().default(
        HumanizerIntensity.Medium,
      ),
    })
    .strict();
}

export const HumanizeTextInputSchema = createHumanizeTextInputSchema(
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
);

export class HumanizerError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly causeDetails?: unknown;

  constructor(
    message: string,
    code = "HUMANIZER_ERROR",
    status = 500,
    causeDetails?: unknown,
  ) {
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
  constructor(
    message = `Input text exceeds the maximum allowed length of ${MAX_INPUT_TEXT_LENGTH} characters.`,
  ) {
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
