if (typeof window !== "undefined") {
  throw new Error("This module can only be used on the server.");
}

import { getDeepSeekClient, DEEPSEEK_CONFIG } from "@/lib/ai/deepseek.client";
import {
  GRAMMAR_CHECKER_SYSTEM_PROMPT,
  buildGrammarCheckerUserPrompt,
} from "./grammar.prompts";
import {
  ANONYMOUS_MAX_GRAMMAR_LENGTH,
  AUTHENTICATED_MAX_GRAMMAR_LENGTH,
  type GrammarCheckInput,
  type GrammarCheckResult,
  type GrammarIssue,
} from "./grammar.types";
import { DeepSeekGrammarResponseDto } from "./grammar.dto";

/**
 * Fast deterministic heuristics to detect common mechanical issues
 * (repeated words, double punctuation, spacing mistakes).
 */
function runDeterministicGrammarChecks(text: string): GrammarIssue[] {
  const issues: GrammarIssue[] = [];

  // 1. Repeated words (e.g. "the the", "in in")
  const repeatedRegex = /\b([a-zA-Z]+)\s+\1\b/gi;
  let match: RegExpExecArray | null;
  while ((match = repeatedRegex.exec(text)) !== null) {
    issues.push({
      startChar: match.index,
      endChar: match.index + match[0].length,
      original: match[0],
      replacement: match[1],
      category: "grammar",
      explanation: `Repeated word "${match[1]}". Consider removing the duplicate.`,
    });
  }

  // 2. Double punctuation (e.g. ",,", "..", ";;")
  const doublePunctRegex = /([,;:!])\1+/g;
  while ((match = doublePunctRegex.exec(text)) !== null) {
    issues.push({
      startChar: match.index,
      endChar: match.index + match[0].length,
      original: match[0],
      replacement: match[1],
      category: "punctuation",
      explanation: "Duplicate punctuation mark detected.",
    });
  }

  // 3. Space before punctuation
  const spaceBeforePunctRegex = /[ \t]+([,.;:!?])/g;
  while ((match = spaceBeforePunctRegex.exec(text)) !== null) {
    issues.push({
      startChar: match.index,
      endChar: match.index + match[0].length,
      original: match[0],
      replacement: match[1],
      category: "punctuation",
      explanation: "Remove unexpected space before punctuation mark.",
    });
  }

  return issues;
}

/**
 * Main service function to inspect and correct grammar, spelling, and style.
 */
export async function checkGrammar(
  input: GrammarCheckInput,
): Promise<GrammarCheckResult> {
  const start = Date.now();
  const text = input.text.trim();
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const wordCount = words.length;

  const deterministicIssues = runDeterministicGrammarChecks(text);

  try {
    const client = getDeepSeekClient({ timeoutMs: 20_000, maxRetries: 1 });
    const model = DEEPSEEK_CONFIG.defaultModel;

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: GRAMMAR_CHECKER_SYSTEM_PROMPT },
        { role: "user", content: buildGrammarCheckerUserPrompt(text) },
      ],
      temperature: 0.2,
      max_tokens: 2500,
      stream: false,
    });

    const content = response.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error("Empty response received from grammar model.");
    }

    // Clean any accidental markdown code fences
    const cleanJson = content
      .replace(/^```json\s*/i, "")
      .replace(/```$/i, "")
      .trim();
    const parsed = DeepSeekGrammarResponseDto.parse(JSON.parse(cleanJson));

    const correctedText = parsed.correctedText || text;
    const score = parsed.score ?? 90;
    const summary = parsed.summary || "Grammar analysis completed.";

    // Locate character offsets for model-reported issues
    const modelIssues: GrammarIssue[] = [];
    {
      let searchOffset = 0;
      for (const rawIssue of parsed.issues) {
        const foundIndex = text.indexOf(rawIssue.original, searchOffset);
        const startChar =
          foundIndex !== -1 ? foundIndex : text.indexOf(rawIssue.original);
        if (startChar !== -1) {
          const endChar = startChar + rawIssue.original.length;
          modelIssues.push({
            startChar,
            endChar,
            original: rawIssue.original,
            replacement: rawIssue.replacement,
            category: rawIssue.category,
            explanation: rawIssue.explanation,
          });
          searchOffset = endChar;
        }
      }
    }

    // Deduplicate between deterministic and model issues
    const allIssues = [...deterministicIssues];
    for (const mi of modelIssues) {
      const exists = allIssues.some(
        (di) => di.startChar === mi.startChar && di.endChar === mi.endChar,
      );
      if (!exists) {
        allIssues.push(mi);
      }
    }

    // Sort issues by appearance order
    allIssues.sort((a, b) => a.startChar - b.startChar);

    return {
      originalText: text,
      correctedText,
      issues: allIssues,
      score,
      wordCount,
      summary,
      processingTimeMs: Date.now() - start,
    };
  } catch (error) {
    console.warn("Grammar LLM check failed, using rule-based fallback:", error);

    // Apply deterministic replacements to produce a corrected text fallback
    let fallbackCorrected = text;
    const sortedIssuesDesc = [...deterministicIssues].sort(
      (a, b) => b.startChar - a.startChar,
    );
    for (const issue of sortedIssuesDesc) {
      fallbackCorrected =
        fallbackCorrected.slice(0, issue.startChar) +
        issue.replacement +
        fallbackCorrected.slice(issue.endChar);
    }

    const penalty = deterministicIssues.length * 5;
    const score = Math.max(60, 100 - penalty);

    return {
      originalText: text,
      correctedText: fallbackCorrected,
      issues: deterministicIssues,
      score,
      wordCount,
      summary:
        deterministicIssues.length === 0
          ? "No mechanical punctuation or repetition errors detected in the text."
          : `Detected ${deterministicIssues.length} punctuation or repetition issue(s) that require attention.`,
      processingTimeMs: Date.now() - start,
    };
  }
}
