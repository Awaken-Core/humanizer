import { getDeepSeekClient, DEEPSEEK_CONFIG } from "@/lib/ai/deepseek.client";
import {
  buildRewriterSystemPrompt,
  buildRewriterUserPrompt,
} from "./humanizer.prompts";
import { ProviderApiError, RewritingFailedError } from "./humanizer.schema";
import {
  HumanizerIntensityType,
  HumanizerModeType,
  WritingAnalysis,
} from "./humanizer.types";

export interface RewriteTextOptions {
  text: string;
  analysis: WritingAnalysis;
  mode: HumanizerModeType;
  intensity: HumanizerIntensityType;
}

export interface RewriteResult {
  rewrittenText: string;
  promptTokens?: number;
  completionTokens?: number;
  model: string;
}

/**
 * Controlled sampling temperature.
 * Kept restrained to prioritize meaning preservation while allowing natural linguistic fluidity.
 * Low: 0.2 (strict precision)
 * Medium: 0.4 (clean natural readability)
 * High: 0.6 (expressive restructuring without hallucination)
 */
function getTemperatureForIntensity(intensity: HumanizerIntensityType): number {
  switch (intensity) {
    case "Low":
      return 0.2;
    case "Medium":
      return 0.4;
    case "High":
      return 0.6;
    default:
      return 0.4;
  }
}

/**
 * Executes the rewriting pass using DeepSeek with tailored prompts and temperature settings.
 */
export async function rewriteText(
  options: RewriteTextOptions
): Promise<RewriteResult> {
  const { text, analysis, mode, intensity } = options;
  const client = getDeepSeekClient();
  const model = DEEPSEEK_CONFIG.defaultModel;

  const systemPrompt = buildRewriterSystemPrompt(mode, intensity);
  const userPrompt = buildRewriterUserPrompt(text, analysis, mode, intensity);
  const temperature = getTemperatureForIntensity(intensity);

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      temperature,
      stream: false,
    });

    const content = response.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new RewritingFailedError(
        "DeepSeek returned an empty response during the text rewriting phase."
      );
    }

    return {
      rewrittenText: content,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
      model: response.model || model,
    };
  } catch (error) {
    if (error instanceof RewritingFailedError) {
      throw error;
    }

    const message =
      error instanceof Error ? error.message : "Unknown error during DeepSeek rewriting";
    const status = (error as { status?: number })?.status ?? 502;
    throw new ProviderApiError(`DeepSeek rewriting request failed: ${message}`, status, error);
  }
}
