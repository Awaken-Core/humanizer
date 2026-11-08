import { DEEPSEEK_CONFIG, getDeepSeekClient } from "@/lib/ai/deepseek.client";
import { HumanizerError, ProviderApiError } from "@/features/humanizer";
import {
  buildParaphraserSystemPrompt,
  buildParaphraserUserPrompt,
} from "./paraphraser.prompts";
import {
  ParaphraserFocus,
  ParaphraserTone,
  type ParaphraseGenerationResult,
  type ParaphraseTextInput,
  type ParaphraseTextResult,
  type ParaphraserFocusType,
  type ParaphraserToneType,
} from "./paraphraser.types";
import { ParaphraseTextInputSchema } from "./paraphraser.dto";

export {
  createParaphraseTextInputSchema,
  MAX_PARAPHRASE_TEXT_LENGTH,
  ParaphraseTextInputSchema,
} from "./paraphraser.dto";

function normalizeOutput(text: string): string {
  let cleaned = text.trim();

  // Strip accidental outer quotes if model enclosed whole response
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Strip accidental intro chatter
  cleaned = cleaned.replace(
    /^(?:here is (?:the )?paraphrased (?:text|version):|paraphrased:\s*)/i,
    "",
  );

  return cleaned.trim();
}

async function generateParaphrase(
  text: string,
  tone: ParaphraserToneType,
  focus: ParaphraserFocusType,
): Promise<ParaphraseGenerationResult> {
  const client = getDeepSeekClient({ timeoutMs: 25_000, maxRetries: 1 });
  const model = DEEPSEEK_CONFIG.defaultModel;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildParaphraserSystemPrompt(tone, focus),
        },
        {
          role: "user",
          content: buildParaphraserUserPrompt(text),
        },
      ],
      temperature: 0.3,
      max_tokens: 3_000,
      stream: false,
    });

    const paraphrasedText = response.choices[0]?.message?.content?.trim();
    if (!paraphrasedText) {
      throw new HumanizerError(
        "Paraphrasing engine returned an empty result.",
        "PARAPHRASING_FAILED",
        502,
      );
    }

    return {
      paraphrasedText,
      model: response.model || model,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    };
  } catch (error) {
    if (error instanceof HumanizerError) throw error;

    const message =
      error instanceof Error ? error.message : "Error during paraphrasing";
    const status = (error as { status?: number })?.status ?? 502;
    throw new ProviderApiError(
      `Paraphrasing request failed: ${message}`,
      status,
      error,
    );
  }
}

export async function paraphraseText(
  input: ParaphraseTextInput,
): Promise<ParaphraseTextResult> {
  const startTime = Date.now();
  const validatedInput = ParaphraseTextInputSchema.safeParse(input);

  if (!validatedInput.success) {
    const message =
      validatedInput.error.issues[0]?.message || "Invalid input parameters.";
    throw new HumanizerError(
      message,
      "INVALID_INPUT",
      400,
      validatedInput.error.issues,
    );
  }

  const {
    text,
    tone = ParaphraserTone.Standard,
    focus = ParaphraserFocus.Both,
  } = validatedInput.data;

  const originalText = text;
  const normalizedText = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();
  const generated = await generateParaphrase(normalizedText, tone, focus);
  const paraphrasedText = normalizeOutput(generated.paraphrasedText);

  if (!paraphrasedText) {
    throw new HumanizerError(
      "The generated paraphrase was empty.",
      "PARAPHRASING_FAILED",
      502,
    );
  }

  const promptTokens = generated.promptTokens ?? 0;
  const completionTokens = generated.completionTokens ?? 0;

  return {
    originalText,
    paraphrasedText,
    selectedTone: tone,
    selectedFocus: focus,
    processingMetadata: {
      model: generated.model,
      durationMs: Date.now() - startTime,
      tokens: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
    },
  };
}
