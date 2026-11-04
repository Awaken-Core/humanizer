import { z } from "zod";

export const StoredDocumentAiJobDto = z
  .object({
    _id: z.unknown(),
    type: z.enum([
      "AI_HUMANIZER",
      "PLAGIARISM_CHECKER",
      "AI_DETECTOR",
      "PARAPHRASER",
      "AI_SUMMARIZER",
      "GRAMMAR_CHECKER",
    ]),
    status: z.enum([
      "PENDING",
      "PROCESSING",
      "COMPLETED",
      "FAILED",
      "CANCELLED",
    ]),
    input: z
      .object({
        content: z.string(),
        options: z.unknown().optional(),
      })
      .passthrough(),
    result: z.unknown().nullable().optional(),
    error: z
      .object({ message: z.string().optional() })
      .passthrough()
      .optional(),
    createdAt: z.coerce.date(),
  })
  .passthrough();

export type StoredDocumentAiJob = z.infer<typeof StoredDocumentAiJobDto>;

export const AiJobContentResultDto = z
  .object({ content: z.string() })
  .passthrough();

export const AiJobCorrectedResultDto = z
  .object({ correctedText: z.string() })
  .passthrough();

export const AiJobSummaryResultDto = z
  .object({ summary: z.string() })
  .passthrough();

export const AiJobPlagiarismResultDto = z
  .object({
    scores: z.object({ overallSimilarity: z.number() }).passthrough(),
  })
  .passthrough();

export const AiJobInputOptionsDto = z
  .object({ inputSource: z.enum(["document", "selection"]).optional() })
  .passthrough();
