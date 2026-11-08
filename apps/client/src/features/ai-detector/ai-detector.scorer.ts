if (typeof window !== "undefined") {
  throw new Error("This module can only be used on the server.");
}

/**
 * AI Detector — 100% decision-based scoring engine.
 *
 * Five independent signals, each normalised to [0, 1]:
 *   1. Compression Ratio Proxy  — low entropy ≈ AI (ZipPy-style)
 *   2. Sentence Length Burstiness — low variance ≈ AI
 *   3. Type-Token Ratio (TTR)   — suspiciously high TTR ≈ AI (never repeats words)
 *   4. Discourse Marker Density — over-use of connectives ≈ AI
 *   5. AI Phrase Density        — explicit AI cliché count ≈ AI
 *
 * Weights sum to 1.0. Composite score → verdict.
 */

import type {
  AiDetectionInput,
  AiDetectionResult,
  DetectionSignal,
  DetectionScores,
  HighlightSpan,
} from "./ai-detector.types";

// ---------------------------------------------------------------------------
// Signal weights (must sum to 1.0)
// ---------------------------------------------------------------------------
const WEIGHTS = {
  compressionRatio: 0.20,
  burstiness: 0.25,
  ttr: 0.15,
  discourseMarkerDensity: 0.20,
  aiPhraseDensity: 0.20,
} as const;

// ---------------------------------------------------------------------------
// AI phrase list (decision-based, no JSON import — kept in-module for speed)
// ---------------------------------------------------------------------------
const AI_PHRASES: readonly string[] = [
  "it is worth noting",
  "it is important to note",
  "it is essential to",
  "it is crucial to",
  "in conclusion",
  "in summary",
  "to summarize",
  "furthermore",
  "moreover",
  "additionally",
  "in addition",
  "nevertheless",
  "nonetheless",
  "on the other hand",
  "as a result",
  "consequently",
  "therefore",
  "thus",
  "hence",
  "in this context",
  "in this regard",
  "it should be noted",
  "it can be seen",
  "it is evident",
  "it is clear",
  "it is apparent",
  "as mentioned",
  "as stated",
  "as noted",
  "plays a crucial role",
  "plays an important role",
  "shed light on",
  "a wide range of",
  "a variety of",
  "various aspects",
  "significant impact",
  "significant implications",
  "in order to",
  "with regard to",
  "with respect to",
  "in the realm of",
  "delve into",
  "underscores",
  "underscoring",
  "leveraging",
  "utilize",
  "utilizes",
  "utilizing",
  "facilitate",
  "facilitates",
  "elucidate",
  "elucidates",
  "comprehensive",
  "holistic",
  "robust",
  "nuanced",
  "paradigm",
  "landscape",
  "ecosystem",
  "synergy",
  "cutting-edge",
  "state-of-the-art",
];

// Discourse connectives that AI over-uses
const DISCOURSE_MARKERS: readonly string[] = [
  "furthermore",
  "moreover",
  "additionally",
  "however",
  "nevertheless",
  "nonetheless",
  "consequently",
  "therefore",
  "thus",
  "hence",
  "in conclusion",
  "in summary",
  "in addition",
  "as a result",
  "on the other hand",
  "in contrast",
  "for instance",
  "for example",
  "specifically",
  "in particular",
  "notably",
  "interestingly",
];

// ---------------------------------------------------------------------------
// Tokenisation helpers
// ---------------------------------------------------------------------------

function tokenizeWords(text: string): string[] {
  return text.toLowerCase().match(/\b[a-z']+\b/g) ?? [];
}

function tokenizeSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

// ---------------------------------------------------------------------------
// Signal 1: Compression Ratio Proxy
//
// Idea: AI text tends to be more predictable / lower entropy than human text.
// Proxy: ratio of unique trigrams to total trigrams. Low ratio → AI-like.
// We compute character trigrams for efficiency.
// ---------------------------------------------------------------------------
function computeCompressionSignal(text: string): DetectionSignal {
  const trigrams: string[] = [];
  for (let i = 0; i < text.length - 2; i++) {
    trigrams.push(text.slice(i, i + 3));
  }
  if (trigrams.length === 0) {
    return makeSignal("compressionRatio", "Entropy (Compression)", 0, 0, 0.5, "Insufficient text");
  }
  const unique = new Set(trigrams).size;
  const ratio = unique / trigrams.length; // 0–1; lower = more repetitive = more AI-like
  // Typical AI: 0.55–0.75. Human creative: 0.75–0.95.
  // Normalize: score 1 when ratio ≤ 0.60, score 0 when ratio ≥ 0.90.
  const score = clamp(1 - (ratio - 0.60) / (0.90 - 0.60), 0, 1);
  const interpretation =
    ratio < 0.65
      ? "Very low lexical entropy — strongly AI-like"
      : ratio < 0.75
        ? "Below-average entropy — possibly AI-generated"
        : ratio < 0.85
          ? "Normal entropy — inconclusive"
          : "High entropy — appears human-authored";
  return makeSignal("compressionRatio", "Entropy (Compression)", ratio, score, WEIGHTS.compressionRatio, interpretation);
}

// ---------------------------------------------------------------------------
// Signal 2: Sentence Length Burstiness
//
// Human prose has high variance in sentence length (short punchy + long flowing).
// AI prose has suspiciously uniform sentence lengths (low CV).
// CV (coefficient of variation) = stddev / mean.
// ---------------------------------------------------------------------------
function computeBurstinessSignal(sentences: string[]): DetectionSignal {
  if (sentences.length < 3) {
    return makeSignal("burstiness", "Sentence Burstiness", 0, 0.5, WEIGHTS.burstiness, "Too few sentences to assess");
  }
  const lengths = sentences.map((s) => tokenizeWords(s).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  if (mean === 0) {
    return makeSignal("burstiness", "Sentence Burstiness", 0, 0.5, WEIGHTS.burstiness, "Empty sentences");
  }
  const variance = lengths.reduce((acc, l) => acc + Math.pow(l - mean, 2), 0) / lengths.length;
  const cv = Math.sqrt(variance) / mean; // coefficient of variation
  // Typical AI: CV 0.20–0.40. Human: CV 0.50–0.90.
  // Score 1 when CV ≤ 0.25, score 0 when CV ≥ 0.70.
  const score = clamp(1 - (cv - 0.25) / (0.70 - 0.25), 0, 1);
  const interpretation =
    cv < 0.30
      ? "Very uniform sentence lengths — strongly AI-like"
      : cv < 0.45
        ? "Somewhat uniform — possibly AI-generated"
        : cv < 0.60
          ? "Moderate variation — inconclusive"
          : "High variation — appears human-authored";
  return makeSignal("burstiness", "Sentence Burstiness", cv, score, WEIGHTS.burstiness, interpretation);
}

// ---------------------------------------------------------------------------
// Signal 3: Type-Token Ratio (TTR)
//
// AI tends to avoid repeating words, producing an abnormally high TTR.
// We use a windowed TTR (MATTR) to reduce text-length bias: average TTR
// across a sliding 50-word window.
// ---------------------------------------------------------------------------
function computeTTRSignal(words: string[]): DetectionSignal {
  if (words.length < 20) {
    return makeSignal("ttr", "Vocabulary Diversity (TTR)", 0, 0.3, WEIGHTS.ttr, "Insufficient text");
  }
  const windowSize = Math.min(50, words.length);
  const windows = Math.max(1, words.length - windowSize + 1);
  let totalTTR = 0;
  for (let i = 0; i < windows; i++) {
    const window = words.slice(i, i + windowSize);
    totalTTR += new Set(window).size / window.length;
  }
  const mattr = totalTTR / windows; // 0–1; higher = more unique words
  // AI: MATTR typically 0.78–0.92. Human: 0.60–0.80.
  // Score 1 when mattr ≥ 0.85, score 0 when mattr ≤ 0.65.
  const score = clamp((mattr - 0.65) / (0.85 - 0.65), 0, 1);
  const interpretation =
    mattr > 0.88
      ? "Suspiciously high lexical diversity — AI pattern"
      : mattr > 0.78
        ? "Above-average vocabulary diversity — possibly AI"
        : mattr > 0.68
          ? "Normal vocabulary diversity"
          : "Low diversity — likely human (repetitive style)";
  return makeSignal("ttr", "Vocabulary Diversity (TTR)", mattr, score, WEIGHTS.ttr, interpretation);
}

// ---------------------------------------------------------------------------
// Signal 4: Discourse Marker Density
//
// Count how many discourse connectives appear per 100 words.
// AI habitually connects every sentence with "Furthermore", "Moreover", etc.
// ---------------------------------------------------------------------------
function computeDiscourseSignal(text: string, words: string[]): DetectionSignal {
  const lower = text.toLowerCase();
  let count = 0;
  for (const marker of DISCOURSE_MARKERS) {
    const re = new RegExp(`\\b${marker.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const matches = lower.match(re);
    if (matches) count += matches.length;
  }
  const density = words.length > 0 ? (count / words.length) * 100 : 0; // per 100 words
  // AI: typically 4–10 per 100 words. Human: 1–4.
  // Score 1 when density ≥ 8, score 0 when density ≤ 2.
  const score = clamp((density - 2) / (8 - 2), 0, 1);
  const interpretation =
    density > 8
      ? "Very high discourse marker density — strongly AI-like"
      : density > 5
        ? "Above-average connective use — possibly AI"
        : density > 2
          ? "Moderate connective use — inconclusive"
          : "Low connective density — appears human-authored";
  return makeSignal("discourseMarkerDensity", "Discourse Marker Density", density, score, WEIGHTS.discourseMarkerDensity, interpretation);
}

// ---------------------------------------------------------------------------
// Signal 5: AI Phrase Density
//
// Count occurrences of known AI-favoured phrases per 100 words.
// ---------------------------------------------------------------------------
function computeAiPhraseSignal(text: string, words: string[]): DetectionSignal {
  const lower = text.toLowerCase();
  let count = 0;
  for (const phrase of AI_PHRASES) {
    const re = new RegExp(`\\b${phrase.replace(/\s+/g, "\\s+")}\\b`, "gi");
    const matches = lower.match(re);
    if (matches) count += matches.length;
  }
  const density = words.length > 0 ? (count / words.length) * 100 : 0;
  // Score 1 when density ≥ 5, score 0 when density ≤ 0.5.
  const score = clamp((density - 0.5) / (5 - 0.5), 0, 1);
  const interpretation =
    density > 5
      ? "Very high AI phrase density — strongly AI-like"
      : density > 3
        ? "Elevated AI phrase usage — possibly AI"
        : density > 1
          ? "Occasional AI phrases — inconclusive"
          : "Low AI phrase density — appears human-authored";
  return makeSignal("aiPhraseDensity", "AI Phrase Density", density, score, WEIGHTS.aiPhraseDensity, interpretation);
}

// ---------------------------------------------------------------------------
// Highlight generation
//
// Scan sentence by sentence — flag sentences whose composite signal score
// (from phrases + discourse markers present in them) exceeds a threshold.
// ---------------------------------------------------------------------------
function generateHighlights(text: string, sentences: string[]): HighlightSpan[] {
  const highlights: HighlightSpan[] = [];
  let searchFrom = 0;

  for (const sentence of sentences) {
    const startChar = text.indexOf(sentence, searchFrom);
    if (startChar === -1) continue;
    const endChar = startChar + sentence.length;
    searchFrom = endChar;

    const lower = sentence.toLowerCase();
    const reasons: string[] = [];
    let signalScore = 0;

    for (const phrase of AI_PHRASES) {
      if (lower.includes(phrase)) {
        reasons.push(`AI phrase: "${phrase}"`);
        signalScore += 0.25;
      }
    }
    for (const marker of DISCOURSE_MARKERS) {
      const re = new RegExp(`\\b${marker.replace(/\s+/g, "\\s+")}\\b`, "i");
      if (re.test(lower)) {
        reasons.push(`Discourse marker: "${marker}"`);
        signalScore += 0.15;
      }
    }

    const confidence = clamp(signalScore, 0, 1);
    if (confidence > 0.2) {
      highlights.push({ startChar, endChar, confidence, reasons: [...new Set(reasons)] });
    }
  }
  return highlights;
}

// ---------------------------------------------------------------------------
// Verdict thresholds
// ---------------------------------------------------------------------------
function toVerdict(probability: number): DetectionScores["verdict"] {
  if (probability >= 75) return "likely_ai";
  if (probability >= 50) return "possibly_ai";
  if (probability >= 30) return "uncertain";
  return "likely_human";
}

// ---------------------------------------------------------------------------
// Summary template (no LLM)
// ---------------------------------------------------------------------------
function buildSummary(scores: DetectionScores, wordCount: number): string {
  const prob = scores.aiProbability;
  const verdict = scores.verdict;
  const topSignal = [...scores.signals].sort((a, b) => b.score * b.weight - a.score * a.weight)[0];

  const verdictText =
    verdict === "likely_ai"
      ? "This text is **likely AI-generated**"
      : verdict === "possibly_ai"
        ? "This text **may be AI-generated**"
        : verdict === "uncertain"
          ? "The AI origin of this text is **uncertain**"
          : "This text **appears to be human-written**";

  return (
    `${verdictText} (${prob.toFixed(1)}% AI probability, analysed ${wordCount} words). ` +
    `The strongest indicator was **${topSignal?.label ?? "N/A"}**: ${topSignal?.interpretation ?? "no data"}.`
  );
}

// ---------------------------------------------------------------------------
// Utility helpers
// ---------------------------------------------------------------------------
function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function makeSignal(
  name: string,
  label: string,
  rawValue: number,
  score: number,
  weight: number,
  interpretation: string
): DetectionSignal {
  return { name, label, rawValue, score, weight, interpretation };
}

// ---------------------------------------------------------------------------
// Main export: detectAi
// ---------------------------------------------------------------------------

/**
 * Runs the full 5-signal AI detection pipeline on the supplied text.
 * Pure computation — no network calls, no LLM.
 */
export function detectAi(input: AiDetectionInput): AiDetectionResult {
  const start = Date.now();
  const { text } = input;

  const words = tokenizeWords(text);
  const sentences = tokenizeSentences(text);
  const wordCount = words.length;
  const sentenceCount = sentences.length;

  // --- Run all signals ---
  const compressionSignal = computeCompressionSignal(text);
  const burstinessSignal = computeBurstinessSignal(sentences);
  const ttrSignal = computeTTRSignal(words);
  const discourseSignal = computeDiscourseSignal(text, words);
  const aiPhraseSignal = computeAiPhraseSignal(text, words);

  const signals: DetectionSignal[] = [
    compressionSignal,
    burstinessSignal,
    ttrSignal,
    discourseSignal,
    aiPhraseSignal,
  ];

  // --- Composite score ---
  const compositeRaw = signals.reduce((acc, s) => acc + s.score * s.weight, 0);
  const aiProbability = clamp(compositeRaw * 100, 0, 100);
  const humanProbability = 100 - aiProbability;
  const verdict = toVerdict(aiProbability);

  const scores: DetectionScores = {
    aiProbability: Math.round(aiProbability * 10) / 10,
    humanProbability: Math.round(humanProbability * 10) / 10,
    verdict,
    signals,
  };

  const highlights = generateHighlights(text, sentences);
  const summary = buildSummary(scores, wordCount);

  return {
    scores,
    highlights,
    wordCount,
    sentenceCount,
    summary,
    processingTimeMs: Date.now() - start,
  };
}

