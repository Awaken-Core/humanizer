import { DEEPSEEK_CONFIG, getDeepSeekClient } from "@/lib/ai/deepseek.client";
import {
  HumanizeTextInputSchema,
  HumanizerError,
  HumanizerIntensity,
  HumanizerMode,
  ProviderApiError,
} from "@/features/humanizer";
import {
  buildSummarizerSystemPrompt,
  buildSummarizerUserPrompt,
} from "./summarizer.prompts";
import type {
  SummarizeTextInput,
  SummarizeTextResult,
  SummaryGenerationResult,
} from "./summarizer.types";

function normalizeSummary(text: string): string {
  let summary = text.trim();

  if (
    (summary.startsWith('"') && summary.endsWith('"')) ||
    (summary.startsWith("'") && summary.endsWith("'"))
  ) {
    summary = summary.slice(1, -1).trim();
  }

  return summary
    .replace(/^(?:here is (?:the )?summary:|summary:)\s*/i, "")
    .trim();
}

async function generateSummary(
  text: string,
  mode: SummarizeTextResult["selectedMode"],
  intensity: SummarizeTextResult["selectedIntensity"]
): Promise<SummaryGenerationResult> {
  const client = getDeepSeekClient({ timeoutMs: 25_000, maxRetries: 1 });
  const model = DEEPSEEK_CONFIG.defaultModel;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: buildSummarizerSystemPrompt(mode, intensity),
        },
        {
          role: "user",
          content: buildSummarizerUserPrompt(text),
        },
      ],
      temperature: 0.2,
      max_tokens: 2_000,
      stream: false,
    });

    const summaryText = response.choices[0]?.message?.content?.trim();
    if (!summaryText) {
      throw new HumanizerError(
        "Summarization engine returned an empty result.",
        "SUMMARIZATION_FAILED",
        502
      );
    }

    return {
      summaryText,
      model: response.model || model,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    };
  } catch (error) {
    if (error instanceof HumanizerError) throw error;

    const message =
      error instanceof Error ? error.message : "Error during summarization";
    const status = (error as { status?: number })?.status ?? 502;
    throw new ProviderApiError(
      `Summarization request failed: ${message}`,
      status,
      error
    );
  }
}

export async function summarizeText(
  input: SummarizeTextInput
): Promise<SummarizeTextResult> {
  const startTime = Date.now();
  const validatedInput = HumanizeTextInputSchema.safeParse(input);

  if (!validatedInput.success) {
    const message =
      validatedInput.error.issues[0]?.message || "Invalid input parameters.";
    throw new HumanizerError(
      message,
      "INVALID_INPUT",
      400,
      validatedInput.error.issues
    );
  }

  const {
    text,
    mode = HumanizerMode.Natural,
    intensity = HumanizerIntensity.Medium,
  } = validatedInput.data;
  const originalText = text;
  const normalizedText = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  const generated = await generateSummary(normalizedText, mode, intensity);
  const summaryText = normalizeSummary(generated.summaryText);

  if (!summaryText) {
    throw new HumanizerError(
      "The generated summary was empty.",
      "SUMMARIZATION_FAILED",
      502
    );
  }

  const promptTokens = generated.promptTokens ?? 0;
  const completionTokens = generated.completionTokens ?? 0;

  return {
    originalText,
    summaryText,
    selectedMode: mode,
    selectedIntensity: intensity,
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
