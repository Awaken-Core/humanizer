import { z } from "zod";
import type { PlagiarismSettings } from "./plagiarism.types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum characters allowed for unauthenticated (anonymous) requests. */
export const ANONYMOUS_MAX_PLAGIARISM_LENGTH = 800;

/** Maximum characters allowed for authenticated user requests. */
export const AUTHENTICATED_MAX_PLAGIARISM_LENGTH = 15_000;

/** Default settings applied when the caller omits settings entirely. */
export const DEFAULT_PLAGIARISM_SETTINGS: PlagiarismSettings = {
  excludeQuotes: true,
  excludeBibliography: true,
  excludeSmallMatches: true,
  minWordsThreshold: 8,
};

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

/** Validates and coerces caller-supplied plagiarism settings. */
export const PlagiarismSettingsSchema = z
  .object({
    excludeQuotes: z.boolean().default(true),
    excludeBibliography: z.boolean().default(true),
    excludeSmallMatches: z.boolean().default(true),
    minWordsThreshold: z.number().int().min(1).max(50).default(8),
  })
  .strict();

/**
 * Factory that produces a Zod input schema enforcing a caller-specific text length cap.
 * @param maxLength - Maximum number of characters allowed in the text field.
 */
export function createPlagiarismInputSchema(maxLength: number) {
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
      settings: PlagiarismSettingsSchema.partial().optional(),
    })
    .strict();
}

/** Default input schema using the authenticated character limit. */
export const PlagiarismInputSchema = createPlagiarismInputSchema(
  AUTHENTICATED_MAX_PLAGIARISM_LENGTH,
);

// ---------------------------------------------------------------------------
// Error Classes
// ---------------------------------------------------------------------------

/** Base error class for all plagiarism feature failures. */
export class PlagiarismError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly causeDetails?: unknown;

  constructor(
    message: string,
    code = "PLAGIARISM_ERROR",
    status = 500,
    causeDetails?: unknown,
  ) {
    super(message);
    this.name = "PlagiarismError";
    this.code = code;
    this.status = status;
    this.causeDetails = causeDetails;
  }
}

/** Thrown when the submitted text is blank or consists only of whitespace. */
export class PlagiarismEmptyInputError extends PlagiarismError {
  constructor(message = "Input text must contain non-whitespace characters.") {
    super(message, "PLAGIARISM_EMPTY_INPUT", 400);
    this.name = "PlagiarismEmptyInputError";
  }
}

/** Thrown when the web retrieval stage cannot fetch or search for source pages. */
export class PlagiarismRetrievalError extends PlagiarismError {
  constructor(message: string, causeDetails?: unknown) {
    super(message, "PLAGIARISM_RETRIEVAL_ERROR", 502, causeDetails);
    this.name = "PlagiarismRetrievalError";
  }
}

/** Thrown when the scoring pipeline encounters an unrecoverable internal error. */
export class PlagiarismScoringError extends PlagiarismError {
  constructor(message: string, causeDetails?: unknown) {
    super(message, "PLAGIARISM_SCORING_ERROR", 500, causeDetails);
    this.name = "PlagiarismScoringError";
  }
}
