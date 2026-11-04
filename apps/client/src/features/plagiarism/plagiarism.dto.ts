export {
  ANONYMOUS_MAX_PLAGIARISM_LENGTH,
  AUTHENTICATED_MAX_PLAGIARISM_LENGTH,
  PlagiarismInputSchema,
  PlagiarismSettingsSchema,
  createPlagiarismInputSchema,
} from "./plagiarism.schema";

import { z } from "zod";

export const PlagiarismResultDto = z
  .object({
    scores: z
      .object({
        overallSimilarity: z.number(),
        identicalScore: z.number(),
        paraphrasedScore: z.number(),
        quotedScore: z.number(),
        originalScore: z.number(),
      })
      .strict(),
    sources: z.array(
      z
        .object({
          url: z.url(),
          title: z.string(),
          domain: z.string(),
          author: z.string().optional(),
          publishDate: z.string().optional(),
          matchPercentage: z.number(),
          matchedWordCount: z.number().int().nonnegative(),
          isExcluded: z.boolean(),
          retrievedAt: z.coerce.date(),
          rawText: z.string().optional(),
        })
        .strict(),
    ),
    matches: z.array(
      z
        .object({
          startChar: z.number().int().nonnegative(),
          endChar: z.number().int().nonnegative(),
          matchText: z.string(),
          sourceText: z.string(),
          sourceIndex: z.number().int().nonnegative(),
          matchType: z.enum(["identical", "paraphrased", "quoted"]),
          similarityScore: z.number(),
        })
        .strict(),
    ),
    wordCount: z.number().int().nonnegative(),
    sentenceCount: z.number().int().nonnegative(),
    summary: z.string(),
    processingTimeMs: z.number().nonnegative(),
    settings: z
      .object({
        excludeQuotes: z.boolean(),
        excludeBibliography: z.boolean(),
        excludeSmallMatches: z.boolean(),
        minWordsThreshold: z.number().int(),
      })
      .strict(),
  })
  .passthrough();

export const SerperSearchResultDto = z
  .object({
    organic: z
      .array(
        z
          .object({
            link: z.url().optional(),
            title: z.string().optional(),
            snippet: z.string().optional(),
          })
          .passthrough(),
      )
      .optional(),
  })
  .passthrough();
