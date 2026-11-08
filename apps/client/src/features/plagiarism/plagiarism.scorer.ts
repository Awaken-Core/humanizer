import type {
  ExclusionRegion,
  MatchType,
  PlagiarismMatch,
  PlagiarismScores,
  PlagiarismSettings,
  PlagiarismSource,
} from "./plagiarism.types";
import {
  filterMatchesByExclusions,
  isCharExcluded,
} from "./plagiarism.exclusion";
import {
  findExactMatchSpans,
  fingerprintContainment,
  fingerprintSimilarity,
} from "./plagiarism.fingerprint";

// ---------------------------------------------------------------------------
// TF-IDF & Cosine Similarity
// ---------------------------------------------------------------------------

/**
 * Tokenizes text into lowercase words (3+ chars, no punctuation) and computes
 * a TF-IDF weight map. Because we have no global IDF corpus here, IDF is
 * approximated as log(1 + 1/tf) to down-weight extremely frequent terms within
 * the document itself.
 *
 * @param text - Input text to vectorize.
 * @returns Map of word → TF-IDF weight.
 */
export function computeTfIdf(text: string): Map<string, number> {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3);

  if (words.length === 0) return new Map();

  // Term frequencies
  const tf = new Map<string, number>();
  for (const word of words) {
    tf.set(word, (tf.get(word) ?? 0) + 1);
  }

  // Apply log-normalization and pseudo-IDF
  const result = new Map<string, number>();
  const total = words.length;
  for (const [word, count] of tf) {
    const termFreq = count / total;
    const idf = Math.log(1 + 1 / termFreq); // Pseudo-IDF: rare within doc → higher weight
    result.set(word, termFreq * idf);
  }

  return result;
}

/**
 * Computes the cosine similarity between two TF-IDF weight vectors.
 *
 * @param vecA - Weight map for document A.
 * @param vecB - Weight map for document B.
 * @returns Cosine similarity in [0, 1].
 */
export function cosineSimilarity(
  vecA: Map<string, number>,
  vecB: Map<string, number>
): number {
  if (vecA.size === 0 || vecB.size === 0) return 0;

  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, weightA] of vecA) {
    const weightB = vecB.get(term) ?? 0;
    dot += weightA * weightB;
    normA += weightA * weightA;
  }
  for (const [, weightB] of vecB) {
    normB += weightB * weightB;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Computes cosine similarity between a single sentence and a source text.
 *
 * @param sentence - A sentence from the user text.
 * @param sourceText - The full source page text.
 * @returns Cosine similarity score in [0, 1].
 */
export function scoreSentenceAgainstSource(
  sentence: string,
  sourceText: string
): number {
  return cosineSimilarity(computeTfIdf(sentence), computeTfIdf(sourceText));
}

// ---------------------------------------------------------------------------
// Main Scoring Function
// ---------------------------------------------------------------------------

/** Minimum fingerprint Jaccard score to bother scoring a source. */
const MIN_FINGERPRINT_THRESHOLD = 0.03;

/** Cosine threshold above which a sentence is flagged as paraphrased. */
const PARAPHRASE_COSINE_THRESHOLD = 0.75;

/**
 * Main scoring engine. For each candidate source:
 *   1. Compute fingerprint Jaccard similarity (fast gating).
 *   2. Find exact match spans via LCS.
 *   3. Compute sentence-level cosine similarities for paraphrase detection.
 *   4. Build and de-overlap the match list.
 *   5. Filter by exclusion regions and minimum word threshold.
 *   6. Compute aggregate scores.
 *
 * @param userText - The user-submitted text.
 * @param sources - Candidate sources with rawText populated.
 * @param exclusionRegions - Regions to exclude from scoring.
 * @param settings - Plagiarism settings (thresholds, exclusions).
 * @returns Scored sources, match list, and aggregate scores.
 */
export async function scoreAllSources(
  userText: string,
  sources: PlagiarismSource[],
  exclusionRegions: ExclusionRegion[],
  settings: PlagiarismSettings
): Promise<{
  sources: PlagiarismSource[];
  matches: PlagiarismMatch[];
  scores: PlagiarismScores;
}> {
  const userWords = userText
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
  const totalWordCount = Math.max(1, userWords.length);

  const allMatches: PlagiarismMatch[] = [];
  const scoredSources: PlagiarismSource[] = [];

  // Split user text into sentences for paraphrase detection
  const userSentences = splitSentences(userText);

  for (let sourceIndex = 0; sourceIndex < sources.length; sourceIndex++) {
    const source = sources[sourceIndex]!;
    const rawText = source.rawText ?? "";

    if (rawText.length < 20) {
      scoredSources.push({ ...source, matchPercentage: 0, matchedWordCount: 0 });
      continue;
    }

    // --- Stage 1: Asymmetric containment gating ---
    // If rawText is long, prune only if there is genuinely 0 containment and 0 jaccard
    if (rawText.length >= 300) {
      const containment = fingerprintContainment(userText, rawText);
      const jaccard = fingerprintSimilarity(userText, rawText);
      if (containment === 0 && jaccard < 0.005) {
        scoredSources.push({ ...source, matchPercentage: 0, matchedWordCount: 0 });
        continue;
      }
    }

    // --- Stage 2: Exact match spans via LCS ---
    const exactSpans = findExactMatchSpans(
      userText,
      rawText,
      settings.minWordsThreshold
    );

    const sourceMatches: PlagiarismMatch[] = [];

    for (const span of exactSpans) {
      if (isCharExcluded(span.startChar, exclusionRegions)) continue;

      sourceMatches.push({
        startChar: span.startChar,
        endChar: span.endChar,
        matchText: span.matchText,
        sourceText: span.sourceText,
        sourceIndex,
        matchType: "identical" as MatchType,
        similarityScore: 1.0,
      });
    }

    // --- Stage 3: Sentence-level paraphrase detection ---
    const exactRanges = sourceMatches.map((m) => ({ start: m.startChar, end: m.endChar }));

    for (const sentence of userSentences) {
      const sentenceWords = sentence.text.split(/\s+/).filter((w) => w.length > 0);
      if (sentenceWords.length < settings.minWordsThreshold) continue;
      if (isCharExcluded(sentence.start, exclusionRegions)) continue;

      // Skip if this sentence is already covered by an exact match
      if (isRangeCovered(sentence.start, sentence.end, exactRanges)) continue;

      const cosine = scoreSentenceAgainstSource(sentence.text, rawText);
      if (cosine >= PARAPHRASE_COSINE_THRESHOLD) {
        sourceMatches.push({
          startChar: sentence.start,
          endChar: sentence.end,
          matchText: sentence.text,
          sourceText: "",
          sourceIndex,
          matchType: "paraphrased" as MatchType,
          similarityScore: cosine,
        });
      }
    }

    // Compute per-source metrics
    const matchedWords = countWordsInMatches(sourceMatches, userText);
    const matchPercentage =
      totalWordCount > 0
        ? Math.min(100, Math.round((matchedWords / totalWordCount) * 100 * 10) / 10)
        : 0;

    scoredSources.push({
      ...source,
      matchPercentage,
      matchedWordCount: matchedWords,
    });

    allMatches.push(...sourceMatches);
  }

  // --- Filter by exclusion regions and min threshold ---
  let filteredMatches = filterMatchesByExclusions(allMatches, exclusionRegions);

  if (settings.excludeSmallMatches) {
    filteredMatches = filteredMatches.filter((m) => {
      const words = m.matchText.split(/\s+/).filter((w) => w.length > 0);
      return words.length >= settings.minWordsThreshold;
    });
  }

  // De-overlap matches (keep highest similarity when spans overlap)
  filteredMatches = deoverlapMatches(filteredMatches);

  // --- Aggregate scores ---
  const identicalWords = countWordsInMatchesByType(filteredMatches, userText, "identical");
  const paraphrasedWords = countWordsInMatchesByType(filteredMatches, userText, "paraphrased");
  const quotedWords = countWordsInMatchesByType(filteredMatches, userText, "quoted");

  const identicalScore = Math.min(100, Math.round((identicalWords / totalWordCount) * 100 * 10) / 10);
  const paraphrasedScore = Math.min(100, Math.round((paraphrasedWords / totalWordCount) * 100 * 10) / 10);
  const quotedScore = Math.min(100, Math.round((quotedWords / totalWordCount) * 100 * 10) / 10);
  const overallSimilarity = Math.min(100, Math.round((identicalScore + paraphrasedScore) * 10) / 10);
  const originalScore = Math.max(0, Math.round((100 - overallSimilarity) * 10) / 10);

  const scores: PlagiarismScores = {
    overallSimilarity,
    identicalScore,
    paraphrasedScore,
    quotedScore,
    originalScore,
  };

  // Sort sources by match percentage descending
  scoredSources.sort((a, b) => b.matchPercentage - a.matchPercentage);

  // Retain only sources with actual detected overlap so UI is never cluttered with 0% 0-word false positives
  const nonZeroSources = scoredSources.filter((s) => s.matchedWordCount > 0);

  if (nonZeroSources.length > 0) {
    const sourceIndexMap = new Map<number, number>();
    nonZeroSources.forEach((source, newIdx) => {
      const oldIdx = sources.findIndex((s) => s.url === source.url);
      if (oldIdx !== -1) sourceIndexMap.set(oldIdx, newIdx);
    });

    const remappedMatches = filteredMatches
      .filter((m) => sourceIndexMap.has(m.sourceIndex))
      .map((m) => ({
        ...m,
        sourceIndex: sourceIndexMap.get(m.sourceIndex)!,
      }));

    return { sources: nonZeroSources, matches: remappedMatches, scores };
  }

  // If no source had matches, return empty sources and empty matches
  return { sources: [], matches: [], scores };
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

interface SentenceWithOffsets {
  text: string;
  start: number;
  end: number;
}

/**
 * Splits text into sentences, preserving character offsets for each sentence.
 * Uses a simple sentence-boundary regex (handles ., !, ?).
 */
function splitSentences(text: string): SentenceWithOffsets[] {
  const sentences: SentenceWithOffsets[] = [];
  const sentenceRegex = /[^.!?]+[.!?]*/g;
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const s = match[0].trim();
    if (s.length > 0) {
      sentences.push({ text: s, start: match.index, end: match.index + match[0].length });
    }
  }

  // Capture any trailing text that doesn't end in punctuation
  const lastIdx = sentences.length > 0 ? sentences[sentences.length - 1]!.end : 0;
  const trailing = text.slice(lastIdx).trim();
  if (trailing.length > 0) {
    sentences.push({ text: trailing, start: lastIdx, end: text.length });
  }

  return sentences;
}

/** Returns true if the range [start, end) is fully covered by any of the given ranges. */
function isRangeCovered(
  start: number,
  end: number,
  ranges: Array<{ start: number; end: number }>
): boolean {
  return ranges.some((r) => r.start <= start && r.end >= end);
}

/** Counts the number of words within the union of all match spans. */
function countWordsInMatches(matches: PlagiarismMatch[], text: string): number {
  if (matches.length === 0) return 0;
  const covered = buildCoveredSet(matches.map((m) => ({ start: m.startChar, end: m.endChar })));
  return countWordsInOffsets(text, covered);
}

/** Counts the number of words within matches of a specific type. */
function countWordsInMatchesByType(
  matches: PlagiarismMatch[],
  text: string,
  type: MatchType
): number {
  const typed = matches.filter((m) => m.matchType === type);
  return countWordsInMatches(typed, text);
}

/** Builds a Set of character offsets covered by the given ranges. */
function buildCoveredSet(ranges: Array<{ start: number; end: number }>): Set<number> {
  const covered = new Set<number>();
  for (const r of ranges) {
    for (let i = r.start; i < r.end; i++) covered.add(i);
  }
  return covered;
}

/** Counts words whose first character is in the covered offset set. */
function countWordsInOffsets(text: string, covered: Set<number>): number {
  let count = 0;
  const wordRegex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = wordRegex.exec(text)) !== null) {
    if (covered.has(match.index)) count++;
  }
  return count;
}

/**
 * Removes overlapping matches, keeping the one with the higher similarity score.
 * Uses a greedy interval-scheduling approach on sorted start positions.
 */
function deoverlapMatches(matches: PlagiarismMatch[]): PlagiarismMatch[] {
  if (matches.length <= 1) return matches;

  // Sort by start char, then by descending similarity (keep best)
  const sorted = [...matches].sort(
    (a, b) => a.startChar - b.startChar || b.similarityScore - a.similarityScore
  );

  const result: PlagiarismMatch[] = [sorted[0]!];

  for (let i = 1; i < sorted.length; i++) {
    const last = result[result.length - 1]!;
    const current = sorted[i]!;

    if (current.startChar >= last.endChar) {
      // No overlap
      result.push(current);
    } else if (current.similarityScore > last.similarityScore) {
      // Current is better — replace (tricky: may require proper merge; we simplify)
      result[result.length - 1] = current;
    }
    // Otherwise discard current (last is better or equal)
  }

  return result;
}
