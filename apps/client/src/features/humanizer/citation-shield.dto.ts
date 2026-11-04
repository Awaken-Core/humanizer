import { z } from "zod";

export const CitationShieldRequestDto = z
  .object({
    text: z.string().min(1, "Text cannot be empty").max(100_000),
    style: z.enum(["latex", "ieee", "apa"]).default("latex"),
    discipline: z
      .enum([
        "computer-science",
        "engineering",
        "mathematics",
        "finance",
        "medicine",
        "general",
      ])
      .default("computer-science"),
    maxCitations: z.number().int().positive().optional(),
    densityThreshold: z.number().int().min(3).max(15).optional(),
  })
  .strict();
