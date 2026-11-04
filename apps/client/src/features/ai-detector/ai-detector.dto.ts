import { z } from "zod";

export const createAiDetectDto = (maxLength: number) =>
  z
    .object({
      text: z
        .string({ error: "The 'text' field must be a string." })
        .trim()
        .min(
          50,
          "Please provide at least 50 characters for accurate AI detection.",
        )
        .max(
          maxLength,
          `Text exceeds the ${maxLength.toLocaleString()}-character limit.`,
        ),
    })
    .strict();

export const AiDetectionResultDto = z
  .object({
    scores: z
      .object({
        aiProbability: z.number(),
        humanProbability: z.number(),
        verdict: z.enum([
          "likely_ai",
          "possibly_ai",
          "uncertain",
          "likely_human",
        ]),
        signals: z.array(
          z
            .object({
              name: z.string(),
              label: z.string(),
              rawValue: z.number(),
              score: z.number(),
              weight: z.number(),
              interpretation: z.string(),
            })
            .strict(),
        ),
      })
      .passthrough(),
    highlights: z.array(
      z
        .object({
          startChar: z.number().int().nonnegative(),
          endChar: z.number().int().nonnegative(),
          confidence: z.number(),
          reasons: z.array(z.string()),
        })
        .strict(),
    ),
    wordCount: z.number().int().nonnegative(),
    sentenceCount: z.number().int().nonnegative(),
    summary: z.string(),
    processingTimeMs: z.number().nonnegative(),
  })
  .passthrough();
