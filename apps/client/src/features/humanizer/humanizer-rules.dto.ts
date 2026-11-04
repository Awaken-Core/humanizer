import { z } from "zod";

export const MarkerRulesDto = z
  .object({ __prompt__: z.string() })
  .catchall(z.array(z.string()));

export const AiSignaturesDto = z
  .object({
    __prompt__: z.string(),
    patterns: z.array(
      z
        .object({
          description: z.string(),
          pattern: z.string(),
          replacements: z.array(z.string()),
        })
        .strict(),
    ),
    forbidden_openers: z.array(z.string()),
    zero_width_chars: z.array(z.string()),
  })
  .strict();
