import { z } from "zod";

export const createGrammarInputDto = (maxLength: number) =>
  z
    .object({
      text: z
        .string({ error: "The 'text' field must be a string." })
        .trim()
        .min(1, "Input text cannot be empty or contain only whitespace.")
        .max(
          maxLength,
          `Text exceeds the ${maxLength.toLocaleString()}-character limit.`,
        ),
    })
    .strict();

export const DeepSeekGrammarResponseDto = z
  .object({
    correctedText: z.string().optional(),
    score: z.number().min(0).max(100).optional(),
    summary: z.string().optional(),
    issues: z
      .array(
        z
          .object({
            original: z.string().min(1),
            replacement: z.string(),
            category: z
              .enum(["grammar", "spelling", "punctuation", "clarity", "style"])
              .catch("grammar"),
            explanation: z.string(),
          })
          .strict(),
      )
      .default([]),
  })
  .strict();

export const GrammarCheckResultDto = z
  .object({
    originalText: z.string(),
    correctedText: z.string(),
    issues: z.array(
      z
        .object({
          startChar: z.number().int().nonnegative(),
          endChar: z.number().int().nonnegative(),
          original: z.string(),
          replacement: z.string(),
          category: z.enum([
            "grammar",
            "spelling",
            "punctuation",
            "clarity",
            "style",
          ]),
          explanation: z.string(),
        })
        .strict(),
    ),
    score: z.number(),
    wordCount: z.number().int().nonnegative(),
    summary: z.string(),
    processingTimeMs: z.number().nonnegative(),
  })
  .passthrough();
