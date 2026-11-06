/**
 * Pairwise Document vs Document Similarity Engine
 *
 * Implements Turnitout's Module 5: Multi-Pass Cross-Audit Algorithms:
 * 1. 5-Gram Contiguous Overlap: Identifies exact identical 5+ word phrases.
 * 2. Winnowing Fingerprints: k=5, w=4 rolling hash min-selection for position-independent matching.
 * 3. Cosine TF-IDF: Vector space topical and vocabulary overlap.
 * 4. Longest Common Subsequence (LCS): Structural reordering and syntactic sequence tracking.
 * 5. Synchronized Passage Mapping: Aligned match spans with exact character offsets in both Doc A and Doc B.
 * 6. Risk Level Rating: Low (<15%), Moderate (15-40%), High (>40%).
 */

import {
  winnow,
  jaccardSimilarity,
  fingerprintSimilarity,
  findExactMatchSpans,
} from "./plagiarism.fingerprint";
import { computeTfIdf, cosineSimilarity } from "./plagiarism.scorer";
import type {
  PairwiseComparisonResult,
  PairwiseMatchSpan,
  PairwiseRiskLevel,
  PlagiarismSettings,
} from "./plagiarism.types";

/**
 * Computes token-level Longest Common Subsequence (LCS) ratio between two texts.
 */
function computeTokenLcsRatio(tokensA: string[], tokensB: string[]): number {
  const m = tokensA.length;
  const n = tokensB.length;
  if (m === 0 || n === 0) return 0;

  // Space-optimized LCS table (two rows)
  let prev = new Array(n + 1).fill(0);
  let curr = new Array(n + 1).fill(0);

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (tokensA[i - 1] === tokensB[j - 1]) {
        curr[j] = prev[j - 1] + 1;
      } else {
        curr[j] = Math.max(prev[j], curr[j - 1]);
      }
    }
    prev = [...curr];
  }

  const lcsLength = curr[n];
  const minLen = Math.min(m, n);
  return minLen > 0 ? lcsLength / minLen : 0;
}

/**
 * Finds character offsets of a substring inside source text (Doc B).
 */
function findSubstringOffsets(
  docText: string,
  targetSnippet: string
): { start: number; end: number } {
  const cleanSnippet = targetSnippet.trim();
  const idx = docText.indexOf(cleanSnippet);
  if (idx !== -1) {
    return { start: idx, end: idx + cleanSnippet.length };
  }

  // Fallback: search by first 5 words
  const words = cleanSnippet.split(/\s+/).slice(0, 5).join(" ");
  const fallbackIdx = docText.toLowerCase().indexOf(words.toLowerCase());
  if (fallbackIdx !== -1) {
    return { start: fallbackIdx, end: Math.min(docText.length, fallbackIdx + cleanSnippet.length) };
  }

  return { start: 0, end: Math.min(docText.length, cleanSnippet.length) };
}

/**
 * Executes a full offline pairwise comparison between Document A and Document B.
 *
 * @param docA - Target document draft (e.g. Student paper or active draft).
 * @param docB - Reference document (e.g. Master source or prior version).
 * @param options - Document labels and optional thresholds.
 * @returns {@link PairwiseComparisonResult} with synchronized match breakdown.
 */
export async function comparePairwise(
  docA: string,
  docB: string,
  options: {
    docAName?: string;
    docBName?: string;
    settings?: Partial<PlagiarismSettings>;
  } = {}
): Promise<PairwiseComparisonResult> {
  const startTime = Date.now();

  const docAName = options.docAName || "Document A (Draft)";
  const docBName = options.docBName || "Document B (Reference)";
  const minWords = options.settings?.minWordsThreshold ?? 5;

  const wordsA = docA.trim().split(/\s+/).filter(Boolean);
  const wordsB = docB.trim().split(/\s+/).filter(Boolean);

  const docAWordCount = wordsA.length;
  const docBWordCount = wordsB.length;

  if (docAWordCount === 0 || docBWordCount === 0) {
    return {
      docAName,
      docBName,
      docAWordCount,
      docBWordCount,
      riskLevel: "Low",
      scores: {
        overallSimilarity: 0,
        identicalPercentage: 0,
        paraphrasedPercentage: 0,
        originalPercentage: 100,
        fiveGramOverlap: 0,
        winnowingJaccard: 0,
        winnowingContainment: 0,
        tfidfCosine: 0,
        lcsSimilarity: 0,
      },
      matches: [],
      summary: "One or both documents are empty.",
      processingTimeMs: Date.now() - startTime,
    };
  }

  // 1. Winnowing Rolling Hash Fingerprints (k=5, w=4)
  const fpA = winnow(docA);
  const fpB = winnow(docB);
  const jaccard = jaccardSimilarity(fpA, fpB);

  let intersectCount = 0;
  for (const hash of fpA) {
    if (fpB.has(hash)) intersectCount++;
  }
  const containment = fpA.size > 0 ? intersectCount / fpA.size : 0;

  // 2. TF-IDF Cosine Vector Similarity
  const tfidfA = computeTfIdf(docA);
  const tfidfB = computeTfIdf(docB);
  const tfidfCosine = cosineSimilarity(tfidfA, tfidfB);

  // 3. Exact 5-Gram / Multi-word contiguous match spans
  const rawExactSpans = findExactMatchSpans(docA, docB, minWords);

  // Map exact matches to PairwiseMatchSpan format with offsets in both documents
  const matches: PairwiseMatchSpan[] = rawExactSpans.map((span, idx) => {
    const offsetsB = findSubstringOffsets(docB, span.sourceText);
    const spanWords = span.matchText.trim().split(/\s+/).filter(Boolean).length;
    return {
      id: `match_${idx + 1}`,
      docAStart: span.startChar,
      docAEnd: span.endChar,
      docBStart: offsetsB.start,
      docBEnd: offsetsB.end,
      textA: span.matchText,
      textB: span.sourceText,
      matchType: "identical",
      similarity: 1.0,
      wordCount: spanWords,
    };
  });

  // Calculate character coverage in Document A for identical matches
  let identicalCharCount = 0;
  // Sort and merge spans to avoid double-counting overlapping ranges
  const sortedSpans = [...matches].sort((a, b) => a.docAStart - b.docAStart);
  let curStart = -1;
  let curEnd = -1;

  for (const s of sortedSpans) {
    if (s.docAStart >= curEnd) {
      if (curStart !== -1) {
        identicalCharCount += curEnd - curStart;
      }
      curStart = s.docAStart;
      curEnd = s.docAEnd;
    } else {
      curEnd = Math.max(curEnd, s.docAEnd);
    }
  }
  if (curStart !== -1) {
    identicalCharCount += curEnd - curStart;
  }

  const identicalPercentage = Math.min(
    100,
    Math.round((identicalCharCount / Math.max(1, docA.length)) * 100)
  );

  // 4. Token-level LCS similarity (normalized lowercase)
  const normTokensA = wordsA.map((w) => w.toLowerCase().replace(/[^\w]/g, "")).filter(Boolean);
  const normTokensB = wordsB.map((w) => w.toLowerCase().replace(/[^\w]/g, "")).filter(Boolean);
  const lcsRatio = computeTokenLcsRatio(
    normTokensA.slice(0, 1500),
    normTokensB.slice(0, 1500)
  );

  // 5. Paraphrase detection: sentences in Doc A that have high cosine overlap with Doc B but aren't identical
  let paraphrasedCharCount = 0;
  const sentenceRegex = /[^.!?]+(?:[.!?]+(?:\s+|$)|$)/g;
  let sMatch: RegExpExecArray | null;

  while ((sMatch = sentenceRegex.exec(docA)) !== null) {
    const sText = sMatch[0];
    const sStart = sMatch.index;
    const sEnd = sStart + sText.length;

    // Skip if already covered by an identical match
    const coveredByIdentical = matches.some(
      (m) => sStart >= m.docAStart && sEnd <= m.docAEnd
    );
    if (coveredByIdentical) continue;

    const sWords = sText.trim().split(/\s+/).filter(Boolean);
    if (sWords.length < 6) continue;

    const sTfidf = computeTfIdf(sText);
    const sCosine = cosineSimilarity(sTfidf, tfidfB);

    if (sCosine >= 0.72) {
      paraphrasedCharCount += sText.length;
      const sOffsetsB = findSubstringOffsets(docB, sText);
      matches.push({
        id: `para_${matches.length + 1}`,
        docAStart: sStart,
        docAEnd: sEnd,
        docBStart: sOffsetsB.start,
        docBEnd: sOffsetsB.end,
        textA: sText.trim(),
        textB: docB.slice(sOffsetsB.start, sOffsetsB.end) || sText.trim(),
        matchType: "paraphrased",
        similarity: Math.round(sCosine * 100) / 100,
        wordCount: sWords.length,
      });
    }
  }

  const paraphrasedPercentage = Math.min(
    100 - identicalPercentage,
    Math.round((paraphrasedCharCount / Math.max(1, docA.length)) * 100)
  );

  // 6. Overall Similarity Composite Score
  // Weighted combination: Winnowing Containment (40%) + 5-Gram Coverage (35%) + TF-IDF (15%) + LCS (10%)
  const fiveGramOverlapScore = Math.min(100, identicalPercentage);
  const winnowingContainmentPct = Math.round(containment * 100);
  const tfidfScore = Math.round(tfidfCosine * 100);
  const lcsScore = Math.round(lcsRatio * 100);

  const rawOverall =
    winnowingContainmentPct * 0.4 +
    fiveGramOverlapScore * 0.35 +
    tfidfScore * 0.15 +
    lcsScore * 0.1;

  const overallSimilarity = Math.min(
    100,
    Math.max(
      identicalPercentage + paraphrasedPercentage,
      Math.round(rawOverall)
    )
  );

  const originalPercentage = Math.max(0, 100 - overallSimilarity);

  // 7. Risk Rating
  let riskLevel: PairwiseRiskLevel = "Low";
  if (overallSimilarity >= 40) {
    riskLevel = "High";
  } else if (overallSimilarity >= 15) {
    riskLevel = "Moderate";
  }

  const summary = `Pairwise comparison detected ${overallSimilarity}% overall similarity (${identicalPercentage}% identical, ${paraphrasedPercentage}% paraphrased) across ${matches.length} matching passage(s). Risk Level: ${riskLevel}.`;

  return {
    docAName,
    docBName,
    docAWordCount,
    docBWordCount,
    riskLevel,
    scores: {
      overallSimilarity,
      identicalPercentage,
      paraphrasedPercentage,
      originalPercentage,
      fiveGramOverlap: fiveGramOverlapScore,
      winnowingJaccard: Math.round(jaccard * 100),
      winnowingContainment: winnowingContainmentPct,
      tfidfCosine: tfidfScore,
      lcsSimilarity: lcsScore,
    },
    matches,
    summary,
    processingTimeMs: Date.now() - startTime,
  };
}
