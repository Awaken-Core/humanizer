import { z } from "zod";
import { ParaphraserFocus, ParaphraserTone } from "./paraphraser.types";

export const MAX_PARAPHRASE_TEXT_LENGTH = 15_000;

const ParaphraserToneDto = z
  .string()
  .transform(
    (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
  )
  .pipe(z.nativeEnum(ParaphraserTone));

const ParaphraserFocusDto = z
  .string()
  .transform(
    (value) => value.charAt(0).toUpperCase() + value.slice(1).toLowerCase(),
  )
  .pipe(z.nativeEnum(ParaphraserFocus));

export function createParaphraseTextInputSchema(maxLength: number) {
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
      tone: ParaphraserToneDto.optional().default(ParaphraserTone.Standard),
      focus: ParaphraserFocusDto.optional().default(ParaphraserFocus.Both),
    })
    .strict();
}

export const ParaphraseTextInputSchema = createParaphraseTextInputSchema(
  MAX_PARAPHRASE_TEXT_LENGTH,
);
