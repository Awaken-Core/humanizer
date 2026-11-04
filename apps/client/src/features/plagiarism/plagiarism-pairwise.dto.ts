import { z } from "zod";

export const PairwiseRequestDto = z
  .object({
    docA: z.string().min(1).max(200_000),
    docB: z.string().min(1).max(200_000),
    docAName: z.string().max(100).optional(),
    docBName: z.string().max(100).optional(),
    settings: z
      .object({
        excludeQuotes: z.boolean().optional(),
        excludeBibliography: z.boolean().optional(),
        excludeSmallMatches: z.boolean().optional(),
        minWordsThreshold: z.number().int().min(3).max(30).optional(),
      })
      .strict()
      .optional(),
  })
  .strict();
