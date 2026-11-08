if (typeof window !== "undefined") {
  throw new Error("This module can only be used on the server.");
}

import { getDeepSeekClient, DEEPSEEK_CONFIG } from "@/lib/ai/deepseek.client";
import type { PlagiarismScores, PlagiarismSource } from "./plagiarism.types";

// ---------------------------------------------------------------------------
// System Prompt
// ---------------------------------------------------------------------------

/**
 * System prompt for the DeepSeek summary generation.
 * Instructs the model to produce a professional, neutral originality report
 * in plain text (no markdown, no lists).
 */
export const PLAGIARISM_REPORTER_SYSTEM_PROMPT = `You are an academic integrity analyst writing concise originality reports for a plagiarism detection service.

Your task is to produce a 2-3 paragraph plain-text originality report based on the plagiarism analysis data provided by the user.

Guidelines:
- State the overall similarity score clearly in the first paragraph.
- Describe the nature of the matches found (identical copying vs. paraphrased content) in the second paragraph.
- Name the top 2-3 source domains if available and note their significance.
- In the final paragraph, provide brief, practical guidance: whether the similarity level is concerning, and what the author might do to address it.
- Use a professional, neutral, academic tone throughout.
- Do not be alarmist; treat low scores (under 15%) as generally acceptable.
- CRITICAL: Output ONLY plain text. No markdown, no bullet points, no numbered lists, no headers, no asterisks, no formatting symbols of any kind.
- CRITICAL: Do not add any preamble, sign-off, or meta-commentary. Start directly with the report content.`;

// ---------------------------------------------------------------------------
// User Prompt Builder
// ---------------------------------------------------------------------------

/**
 * Builds the user prompt for the DeepSeek report generation, embedding the
 * numerical scores and top-source information.
 *
 * @param scores - Aggregated plagiarism similarity scores.
 * @param sources - Scored candidate sources (sorted by matchPercentage desc).
 * @param wordCount - Total word count of the analyzed text.
 * @returns Formatted user prompt string.
 */
export function buildReporterUserPrompt(
  scores: PlagiarismScores,
  sources: PlagiarismSource[],
  wordCount: number
): string {
  const topSources = sources
    .filter((s) => s.matchPercentage > 0)
    .slice(0, 3)
    .map(
      (s, i) =>
        `${i + 1}. ${s.domain || s.url} — ${s.matchPercentage}% match (${s.matchedWordCount} words)`
    )
    .join("\n");

  return `Plagiarism Analysis Results:

Overall Similarity: ${scores.overallSimilarity}%
Identical Content: ${scores.identicalScore}%
Paraphrased Content: ${scores.paraphrasedScore}%
Quoted Content: ${scores.quotedScore}%
Original Content: ${scores.originalScore}%

Text Length: ${wordCount} words

Top Matching Sources:
${topSources || "No significant sources found."}

Please write a 2-3 paragraph originality report based on these results.`;
}

// ---------------------------------------------------------------------------
// Summary Generator
// ---------------------------------------------------------------------------

/**
 * Calls DeepSeek to generate a natural-language originality report summary.
 * Falls back to a programmatically constructed summary string if the LLM
 * call fails or returns an empty response.
 *
 * @param scores - Aggregated plagiarism scores.
 * @param sources - Scored candidate sources.
 * @param wordCount - Total word count of the submitted text.
 * @returns A 2-3 paragraph plain-text originality report.
 */
export async function generatePlagiarismSummary(
  scores: PlagiarismScores,
  sources: PlagiarismSource[],
  wordCount: number
): Promise<string> {
  try {
    const client = getDeepSeekClient({ timeoutMs: 25_000, maxRetries: 1 });
    const model = DEEPSEEK_CONFIG.defaultModel;
    const userPrompt = buildReporterUserPrompt(scores, sources, wordCount);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: PLAGIARISM_REPORTER_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 400,
      stream: false,
    });

    const content = response.choices?.[0]?.message?.content?.trim();

    if (content && content.length > 0) {
      return content;
    }

    // Fall through to fallback
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("DeepSeek plagiarism summary generation failed:", message);
  }

  // ---------------------------------------------------------------------------
  // Programmatic Fallback
  // ---------------------------------------------------------------------------
  return buildFallbackSummary(scores, sources, wordCount);
}

/**
 * Constructs a sensible fallback summary from the numerical data alone,
 * used when the LLM is unavailable.
 */
function buildFallbackSummary(
  scores: PlagiarismScores,
  sources: PlagiarismSource[],
  wordCount: number
): string {
  const { overallSimilarity, identicalScore, paraphrasedScore, originalScore } = scores;

  const severityLabel =
    overallSimilarity < 15
      ? "low"
      : overallSimilarity < 30
      ? "moderate"
      : overallSimilarity < 50
      ? "significant"
      : "high";

  const topDomains = sources
    .filter((s) => s.matchPercentage > 0)
    .slice(0, 3)
    .map((s) => s.domain || s.url);

  const domainSentence =
    topDomains.length > 0
      ? `The highest-matching sources are: ${topDomains.join(", ")}.`
      : "No significant external sources were identified.";

  const guidance =
    overallSimilarity < 15
      ? "This level of similarity is generally considered acceptable for most academic and professional contexts."
      : overallSimilarity < 30
      ? "Some revision may be beneficial — consider paraphrasing any flagged passages in your own words and adding proper citations."
      : "Substantial revision is recommended. Ensure all borrowed content is properly quoted, paraphrased, and cited.";

  return (
    `The submitted text of ${wordCount} words shows a ${severityLabel} overall similarity score of ${overallSimilarity}%. ` +
    `Of this, ${identicalScore}% was detected as identical content and ${paraphrasedScore}% as paraphrased material, ` +
    `leaving ${originalScore}% of the text classified as original.\n\n` +
    `${domainSentence} Identical matches suggest verbatim copying, while paraphrased matches indicate rephrasing of ` +
    `source material without adequate attribution.\n\n` +
    guidance
  );
}
