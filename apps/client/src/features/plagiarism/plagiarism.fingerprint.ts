/**
 * Plagiarism Fingerprinting Engine
 * Implements the Winnowing algorithm (Schleimer, Wilkerson & Aiken, 2003)
 * with Rabin-Karp rolling hash for document fingerprinting.
 *
 * Parameters: k=5 (k-gram size), w=4 (window size)
 * Guarantee: Any matching passage of 8+ consecutive words is ALWAYS detected.
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of words per k-gram used for fingerprinting. */
export const FINGERPRINT_K = 5;

/** Sliding window size for the Winnowing min-hash selection. */
export const FINGERPRINT_W = 4;

// ---------------------------------------------------------------------------
// Text Normalization
// ---------------------------------------------------------------------------

/**
 * Normalizes text for fingerprinting: lowercase, strip punctuation/formatting,
 * collapse whitespace so only space-delimited words remain.
 *
 * @param text - Raw input text.
 * @returns Cleaned, normalized string.
 */
export function normalizeForFingerprint(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ") // Remove all punctuation and special chars
    .replace(/\d+/g, " ")     // Strip standalone numbers that add noise
    .replace(/\s+/g, " ")     // Collapse runs of whitespace
    .trim();
}

// ---------------------------------------------------------------------------
// Hash Function
// ---------------------------------------------------------------------------

/**
 * Deterministic Rabin-Karp-style polynomial rolling hash.
 * Maps a k-gram string to a non-negative 32-bit integer fingerprint.
 *
 * Uses base 31 and modulus 2^31 - 1 (Mersenne prime) for low collision rate.
 *
 * @param str - The k-gram string to hash.
 * @returns A non-negative integer hash value.
 */
export function rabinKarpHash(str: string): number {
  const BASE = 31;
  const MOD = 2_147_483_647; // 2^31 - 1 (Mersenne prime)
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * BASE + str.charCodeAt(i)) % MOD;
  }
  return hash;
}

// ---------------------------------------------------------------------------
// K-Gram Extraction
// ---------------------------------------------------------------------------

/**
 * Generates all overlapping k-grams from an array of words.
 * Each k-gram is formed by joining k consecutive words with a space.
 *
 * @param words - Tokenized word array.
 * @param k - K-gram width (number of words).
 * @returns Array of k-gram strings (empty if words.length < k).
 */
export function extractKgrams(words: string[], k: number): string[] {
  if (words.length < k) return [];
  const kgrams: string[] = [];
  for (let i = 0; i <= words.length - k; i++) {
    kgrams.push(words.slice(i, i + k).join(" "));
  }
  return kgrams;
}

// ---------------------------------------------------------------------------
// Winnowing Algorithm
// ---------------------------------------------------------------------------

/**
 * Applies the Winnowing algorithm to a text document, producing its fingerprint
 * as a set of selected hash values.
 *
 * Steps:
 *   1. Normalize the text.
 *   2. Tokenize into words.
 *   3. Form overlapping k-grams and hash each.
 *   4. Slide a window of size w over the hash sequence; in each window,
 *      select the minimum hash (ties broken by rightmost). Add to fingerprint
 *      only when the selected hash changes.
 *
 * @param text - Raw document text.
 * @param k - K-gram size (defaults to FINGERPRINT_K).
 * @param w - Window size (defaults to FINGERPRINT_W).
 * @returns Set of selected hash fingerprints.
 */
export function winnow(
  text: string,
  k: number = FINGERPRINT_K,
  w: number = FINGERPRINT_W
): Set<number> {
  const normalized = normalizeForFingerprint(text);
  const words = normalized.split(" ").filter((word) => word.length > 0);
  const kgrams = extractKgrams(words, k);

  if (kgrams.length === 0) return new Set<number>();

  // Hash all k-grams
  const hashes = kgrams.map(rabinKarpHash);

  const fingerprint = new Set<number>();
  let prevMin = -1;

  // Slide window of size w over hashes
  for (let i = 0; i <= hashes.length - w; i++) {
    const window = hashes.slice(i, i + w);

    // Find minimum in window (rightmost on tie)
    let minHash = window[0]!;
    for (let j = 1; j < window.length; j++) {
      if (window[j]! <= minHash) {
        minHash = window[j]!;
      }
    }

    // Add to fingerprint only when the selected minimum changes
    if (minHash !== prevMin) {
      fingerprint.add(minHash);
      prevMin = minHash;
    }
  }

  return fingerprint;
}

// ---------------------------------------------------------------------------
// Similarity Metrics
// ---------------------------------------------------------------------------

/**
 * Computes the Jaccard similarity coefficient between two fingerprint sets.
 * Defined as |A ∩ B| / |A ∪ B|.
 *
 * @param a - Fingerprint set for document A.
 * @param b - Fingerprint set for document B.
 * @returns Similarity score in [0, 1]. Returns 0 if both sets are empty.
 */
export function jaccardSimilarity(a: Set<number>, b: Set<number>): number {
  if (a.size === 0 && b.size === 0) return 0;

  let intersectionCount = 0;
  for (const hash of a) {
    if (b.has(hash)) intersectionCount++;
  }

  const unionCount = a.size + b.size - intersectionCount;
  return unionCount === 0 ? 0 : intersectionCount / unionCount;
}

/**
 * Convenience function: fingerprints both texts via Winnowing and returns
 * their Jaccard similarity score in [0, 1].
 *
 * @param textA - First document.
 * @param textB - Second document.
 * @returns Jaccard similarity of their fingerprints.
 */
export function fingerprintSimilarity(textA: string, textB: string): number {
  const fpA = winnow(textA);
  const fpB = winnow(textB);
  return jaccardSimilarity(fpA, fpB);
}

/**
 * Computes containment of text A (user submission) inside text B (candidate web page):
 * |A ∩ B| / |A|
 * Standard metric in plagiarism detection: measures what portion of the user's
 * document appears within a potentially much larger reference webpage.
 *
 * @param userText - User submitted text (document A).
 * @param sourceText - Web source text (document B).
 * @returns Containment ratio in [0, 1].
 */
export function fingerprintContainment(userText: string, sourceText: string): number {
  const fpA = winnow(userText);
  const fpB = winnow(sourceText);
  if (fpA.size === 0) return 0;

  let intersection = 0;
  for (const hash of fpA) {
    if (fpB.has(hash)) intersection++;
  }
  return intersection / fpA.size;
}

// ---------------------------------------------------------------------------
// Exact Match Span Detection
// ---------------------------------------------------------------------------

/**
 * Finds verbatim overlapping passages between the user text and a source text
 * using Longest Common Subsequence (LCS) on word arrays. Maps the discovered
 * LCS word runs back to character offsets in both texts.
 *
 * @param userText - The text submitted by the user.
 * @param sourceText - The candidate source text fetched from the web.
 * @param minWords - Minimum contiguous words required to report a match (default 5).
 * @returns Array of match spans with character offsets in the user text and
 *          the corresponding source text fragment.
 */
export function findExactMatchSpans(
  userText: string,
  sourceText: string,
  minWords = 5
): Array<{
  startChar: number;
  endChar: number;
  matchText: string;
  sourceText: string;
}> {
  // Tokenize preserving original casing for char-offset mapping
  const userWords = tokenizeWithOffsets(userText);
  const srcWords = tokenizeWithOffsets(sourceText);

  if (userWords.length === 0 || srcWords.length === 0) return [];

  // Normalized word lists for comparison
  const userNorm = userWords.map((w) => w.word.toLowerCase());
  const srcNorm = srcWords.map((w) => w.word.toLowerCase());

  // Build LCS table (space-optimized rolling rows)
  const m = userNorm.length;
  const n = srcNorm.length;

  // For large inputs, use a greedy sliding-window approach to avoid O(m*n) memory
  const MAX_LCS_CELLS = 500_000;
  if (m * n > MAX_LCS_CELLS) {
    return findMatchesGreedy(userText, sourceText, userNorm, userWords, srcNorm, srcWords, minWords);
  }

  // Standard DP LCS
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (userNorm[i - 1] === srcNorm[j - 1]) {
        dp[i]![j] = dp[i - 1]![j - 1]! + 1;
      } else {
        dp[i]![j] = Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
      }
    }
  }

  // Backtrack to extract aligned word runs
  const runs = backtrackLCS(dp, userNorm, srcNorm, m, n);

  // Convert runs of aligned indices to char-offset spans
  return runsToSpans(runs, userWords, srcWords, userText, sourceText, minWords);
}

/** Token with its character offset in the original string. */
interface TokenWithOffset {
  word: string;
  start: number;
  end: number;
}

/** Splits text into word tokens and records each token's character offsets. */
function tokenizeWithOffsets(text: string): TokenWithOffset[] {
  const tokens: TokenWithOffset[] = [];
  const regex = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tokens.push({ word: match[0], start: match.index, end: match.index + match[0].length });
  }
  return tokens;
}

/** Pair of aligned word indices (user index, source index). */
type AlignedPair = [number, number];

/** Backtrack through an LCS DP table and return aligned index pairs. */
function backtrackLCS(
  dp: number[][],
  userNorm: string[],
  srcNorm: string[],
  m: number,
  n: number
): AlignedPair[] {
  const pairs: AlignedPair[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (userNorm[i - 1] === srcNorm[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--;
      j--;
    } else if (dp[i - 1]![j]! >= dp[i]![j - 1]!) {
      i--;
    } else {
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}

/** Converts aligned LCS pairs into contiguous span objects with char offsets. */
function runsToSpans(
  pairs: AlignedPair[],
  userWords: TokenWithOffset[],
  srcWords: TokenWithOffset[],
  userText: string,
  sourceText: string,
  minWords: number
): Array<{ startChar: number; endChar: number; matchText: string; sourceText: string }> {
  if (pairs.length === 0) return [];

  const spans: Array<{ startChar: number; endChar: number; matchText: string; sourceText: string }> = [];

  // Group pairs into contiguous runs (consecutive user indices)
  let runStart = 0;
  for (let k = 1; k <= pairs.length; k++) {
    const isEnd = k === pairs.length;
    const consecutive =
      !isEnd &&
      pairs[k]![0] === pairs[k - 1]![0] + 1 &&
      pairs[k]![1] === pairs[k - 1]![1] + 1;

    if (!consecutive) {
      const run = pairs.slice(runStart, k);
      if (run.length >= minWords) {
        const firstUserIdx = run[0]![0];
        const lastUserIdx = run[run.length - 1]![0];
        const firstSrcIdx = run[0]![1];
        const lastSrcIdx = run[run.length - 1]![1];

        const startChar = userWords[firstUserIdx]!.start;
        const endChar = userWords[lastUserIdx]!.end;
        const srcStartChar = srcWords[firstSrcIdx]!.start;
        const srcEndChar = srcWords[lastSrcIdx]!.end;

        spans.push({
          startChar,
          endChar,
          matchText: userText.slice(startChar, endChar),
          sourceText: sourceText.slice(srcStartChar, srcEndChar),
        });
      }
      runStart = k;
    }
  }

  return spans;
}

/**
 * Greedy n-gram matching fallback for very large texts where the full LCS DP
 * would exceed memory limits. Slides a window of `minWords` over the user text
 * and looks up each phrase in the source text.
 */
function findMatchesGreedy(
  userText: string,
  sourceText: string,
  userNorm: string[],
  userWords: TokenWithOffset[],
  srcNorm: string[],
  srcWords: TokenWithOffset[],
  minWords: number
): Array<{ startChar: number; endChar: number; matchText: string; sourceText: string }> {
  const results: Array<{ startChar: number; endChar: number; matchText: string; sourceText: string }> = [];

  // Build a lookup map: phrase -> first source word index
  const srcPhraseMap = new Map<string, number>();
  for (let j = 0; j <= srcNorm.length - minWords; j++) {
    const phrase = srcNorm.slice(j, j + minWords).join(" ");
    if (!srcPhraseMap.has(phrase)) {
      srcPhraseMap.set(phrase, j);
    }
  }

  let i = 0;
  while (i <= userNorm.length - minWords) {
    const phrase = userNorm.slice(i, i + minWords).join(" ");
    const srcIdx = srcPhraseMap.get(phrase);

    if (srcIdx !== undefined) {
      // Extend the match as far as possible
      let len = minWords;
      while (
        i + len < userNorm.length &&
        srcIdx + len < srcNorm.length &&
        userNorm[i + len] === srcNorm[srcIdx + len]
      ) {
        len++;
      }

      const startChar = userWords[i]!.start;
      const endChar = userWords[i + len - 1]!.end;
      const srcStartChar = srcWords[srcIdx]!.start;
      const srcEndChar = srcWords[srcIdx + len - 1]!.end;

      results.push({
        startChar,
        endChar,
        matchText: userText.slice(startChar, endChar),
        sourceText: sourceText.slice(srcStartChar, srcEndChar),
      });

      i += len; // Skip past the matched run
    } else {
      i++;
    }
  }

  return results;
}
