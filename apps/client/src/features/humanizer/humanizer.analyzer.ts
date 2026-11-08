import { getDeepSeekClient, DEEPSEEK_CONFIG } from "@/lib/ai/deepseek.client";
import { ANALYSIS_SYSTEM_PROMPT } from "./humanizer.prompts";
import { AnalysisParseError, ProviderApiError, WritingAnalysisSchema } from "./humanizer.schema";
import { WritingAnalysis } from "./humanizer.types";

/**
 * Extracts and parses JSON from DeepSeek response, handling potential wrapping markdown fences.
 */
function cleanAndParseJson(raw: string): unknown {
  let cleaned = raw.trim();

  // Strip markdown code fences if model accidentally wrapped output in ```json ... ```
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  }

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    // Attempt extracting the first JSON object using regex
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        // Fall through
      }
    }
    throw new AnalysisParseError("Failed to parse JSON analysis from DeepSeek model response.", {
      rawOutput: raw,
      parseError: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Executes linguistic and structural analysis of the input text via DeepSeek.
 */
export async function analyzeText(text: string): Promise<{
  analysis: WritingAnalysis;
  promptTokens?: number;
  completionTokens?: number;
}> {
  const client = getDeepSeekClient({ timeoutMs: 30_000, maxRetries: 1 });
  const model = DEEPSEEK_CONFIG.defaultModel;

  try {
    const response = await client.chat.completions.create({
      model,
      messages: [
        {
          role: "system",
          content: ANALYSIS_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: `Analyze the following text according to instructions:\n\n${text}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for deterministic analysis
      max_tokens: 1500,
      stream: false,
    });

    const content = response.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new ProviderApiError("Analysis engine returned an empty response.");
    }

    const parsedJson = cleanAndParseJson(content);
    const validated = WritingAnalysisSchema.safeParse(parsedJson);

    if (!validated.success) {
      throw new AnalysisParseError("Analysis structure failed validation.", {
        issues: validated.error.issues,
        rawJson: parsedJson,
      });
    }

    return {
      analysis: validated.data as WritingAnalysis,
      promptTokens: response.usage?.prompt_tokens,
      completionTokens: response.usage?.completion_tokens,
    };
  } catch (error) {
    if (error instanceof AnalysisParseError || error instanceof ProviderApiError) {
      throw error;
    }

    const message = error instanceof Error ? error.message : "Error during text analysis";
    const status = (error as { status?: number })?.status ?? 502;
    throw new ProviderApiError(`Text analysis failed: ${message}`, status, error);
  }
}

