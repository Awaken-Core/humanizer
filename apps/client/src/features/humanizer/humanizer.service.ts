import { analyzeText } from "./humanizer.analyzer";
import {
  preprocessText,
  restoreProtectedBlocks,
} from "./humanizer.preprocessor";
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
 * Replaces unprompted AI em-dashes / en-dashes with natural human punctuation
 * unless the original input text specifically used them.
 */
function sanitizeAiDashes(rewrittenText: string, originalText: string): string {
  // If original input didn't contain em-dash (—) or spaced en-dash ( – ), clean them out of the result
  const originalHadEmDash = /\u2014/.test(originalText);
  const originalHadEnDash = / \u2013 /.test(originalText);

  let cleaned = rewrittenText;

  if (!originalHadEmDash) {
    // Replace " — " or "—" connectors with natural punctuation
    cleaned = cleaned.replace(/ ?\u2014 ?/g, (match, offset, str) => {
      // Check surrounding context: if before lowercase, usually a comma or semicolon
      const nextChar = str[offset + match.length];
      if (nextChar && /[A-Z]/.test(nextChar)) {
        return ". ";
      }
      return ", ";
    });
    // Clean up potential duplicate commas or comma-periods
    cleaned = cleaned.replace(/,\s*,/g, ",").replace(/,\s*\./g, ".").replace(/\s+/g, " ");
  }

  if (!originalHadEnDash) {
    cleaned = cleaned.replace(/ \u2013 /g, ", ");
    cleaned = cleaned.replace(/,\s*,/g, ",").replace(/,\s*\./g, ".").replace(/\s+/g, " ");
  }

  return cleaned;
}

/**
 * Normalizes rewritten output by stripping unnecessary conversational framing if returned.
 */
function normalizeOutputText(text: string, originalText?: string): string {
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

  if (originalText) {
    cleaned = sanitizeAiDashes(cleaned, originalText);
  }

  return cleaned.trim();
}

/**
 * Orchestrates the end-to-end humanization workflow:
 * Input Normalization -> Preprocessing -> DeepSeek Analysis -> Validation ->
 * Strategy Selection -> DeepSeek Rewriting -> Block Restoration -> Output Normalization
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

  // 2b. Decision-Based Preprocessing (deterministic, <5 ms, runs before LLM)
  const preprocessResult = preprocessText(normalizedText, intensity);
  const { processedText } = preprocessResult;

  // 3. Stage 1: Linguistic and Structural Analysis
  const { analysis, promptTokens: analysisPromptTokens, completionTokens: analysisCompletionTokens } =
    await analyzeText(processedText);

  // 4. Stage 2: Rewriting with Selected Strategy
  const rewriteResult = await rewriteText({
    text: processedText,
    analysis,
    mode,
    intensity,
  });

  // 5. Restore Protected Blocks (code fences, inline code, URLs)
  const restoredText = restoreProtectedBlocks(
    rewriteResult.rewrittenText,
    preprocessResult.protectedBlocks
  );

  // 6. Output Normalization
  const finalHumanizedText = normalizeOutputText(restoredText, text);
  const totalDurationMs = Date.now() - startTime;

  // 7. Aggregate Token Metadata
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
      preprocessChanges: preprocessResult.changes,
    },
  };
}
