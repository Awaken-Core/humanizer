import { analyzeText } from "./humanizer.analyzer";
import { rewriteText } from "./humanizer.rewriter";
import {
  EmptyInputError,
  HumanizeTextInputSchema,
  HumanizerError,
} from "./humanizer.schema";
import {
  HumanizeTextInput,
  HumanizeTextResult,
  HumanizerIntensity,
  HumanizerMode,
} from "./humanizer.types";

/**
 * Normalizes input text by normalizing line breaks and trimming excess whitespace.
 */
function normalizeInputText(text: string): string {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * Normalizes rewritten output by stripping unnecessary conversational framing if returned.
 */
function normalizeOutputText(text: string): string {
  let cleaned = text.trim();

  // Strip accidental outer quotes if model enclosed whole response in quotes
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }

  // Strip accidental "Here is the humanized text:" or "Rewritten version:" intro line
  cleaned = cleaned.replace(
    /^(?:Here is (?:the )?(?:rewritten|humanized) (?:text|version):\s*|Rewritten:\s*)/i,
    ""
  );

  return cleaned.trim();
}

/**
 * Orchestrates the end-to-end humanization workflow:
 * Input Normalization -> DeepSeek Analysis -> Validation -> Strategy Selection -> DeepSeek Rewriting -> Output Normalization
 */
export async function humanizeText(
  input: HumanizeTextInput
): Promise<HumanizeTextResult> {
  const startTime = Date.now();

  // 1. Input Validation
  const validatedInput = HumanizeTextInputSchema.safeParse(input);
  if (!validatedInput.success) {
    const errorMsg = validatedInput.error.issues[0]?.message || "Invalid input parameters.";
    throw new HumanizerError(errorMsg, "INVALID_INPUT", 400, validatedInput.error.issues);
  }

  const { text, mode = HumanizerMode.Natural, intensity = HumanizerIntensity.Medium } =
    validatedInput.data;

  // 2. Input Normalization
  const normalizedText = normalizeInputText(text);
  if (!normalizedText) {
    throw new EmptyInputError("Input text contains only whitespace.");
  }

  // 3. Stage 1: Linguistic and Structural Analysis
  const { analysis, promptTokens: analysisPromptTokens, completionTokens: analysisCompletionTokens } =
    await analyzeText(normalizedText);

  // 4. Stage 2: Rewriting with Selected Strategy
  const rewriteResult = await rewriteText({
    text: normalizedText,
    analysis,
    mode,
    intensity,
  });

  // 5. Output Normalization
  const finalHumanizedText = normalizeOutputText(rewriteResult.rewrittenText);
  const totalDurationMs = Date.now() - startTime;

  // 6. Aggregate Token Metadata
  const totalPromptTokens =
    (analysisPromptTokens ?? 0) + (rewriteResult.promptTokens ?? 0);
  const totalCompletionTokens =
    (analysisCompletionTokens ?? 0) + (rewriteResult.completionTokens ?? 0);

  return {
    originalText: text,
    humanizedText: finalHumanizedText,
    detectedLanguage: analysis.language,
    selectedMode: mode,
    selectedIntensity: intensity,
    processingMetadata: {
      model: rewriteResult.model,
      durationMs: totalDurationMs,
      tokens: {
        promptTokens: totalPromptTokens,
        completionTokens: totalCompletionTokens,
        totalTokens: totalPromptTokens + totalCompletionTokens,
      },
      analysis,
    },
  };
}

