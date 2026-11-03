/**
 * Core TypeScript types for the Plagiarism Detection feature.
 */

/** Configuration options controlling what content is excluded from analysis. */
export interface PlagiarismSettings {
  excludeQuotes: boolean;
  excludeBibliography: boolean;
  excludeSmallMatches: boolean;
  minWordsThreshold: number;
}

/** Input payload accepted by the plagiarism checking service. */
export interface PlagiarismInput {
  text: string;
  settings?: Partial<PlagiarismSettings>;
}

/** Categorization of a detected plagiarism match. */
export type MatchType = "identical" | "paraphrased" | "quoted";

/** A single flagged passage with character offsets and cross-reference to a source. */
export interface PlagiarismMatch {
  startChar: number;
  endChar: number;
  matchText: string;
  sourceText: string;
  sourceIndex: number;
  matchType: MatchType;
  similarityScore: number;
}

/** An external web source found during candidate retrieval. */
export interface PlagiarismSource {
  url: string;
  title: string;
  domain: string;
  author?: string;
  publishDate?: string;
  matchPercentage: number;
  matchedWordCount: number;
  isExcluded: boolean;
  retrievedAt: Date;
  /** Raw page text — populated internally during processing, not persisted. */
  rawText?: string;
}

/** Aggregated similarity scores as percentages (0–100). */
export interface PlagiarismScores {
  overallSimilarity: number;
  identicalScore: number;
  paraphrasedScore: number;
  quotedScore: number;
  originalScore: number;
}

/** Full result returned from the plagiarism check orchestrator. */
export interface PlagiarismResult {
  scores: PlagiarismScores;
  sources: PlagiarismSource[];
  matches: PlagiarismMatch[];
  wordCount: number;
  sentenceCount: number;
  summary: string;
  processingTimeMs: number;
  settings: PlagiarismSettings;
}

/** A region within the user text that should be excluded from similarity analysis. */
export interface ExclusionRegion {
  start: number;
  end: number;
  type: "quote" | "citation" | "bibliography";
}

/** Risk rating for pairwise document comparison. */
export type PairwiseRiskLevel = "Low" | "Moderate" | "High";

/** A single synchronized match span between Document A and Document B. */
export interface PairwiseMatchSpan {
  id: string;
  docAStart: number;
  docAEnd: number;
  docBStart: number;
  docBEnd: number;
  textA: string;
  textB: string;
  matchType: "identical" | "paraphrased";
  similarity: number;
  wordCount: number;
}

/** Result returned by the pairwise Document vs Document similarity engine. */
export interface PairwiseComparisonResult {
  docAName: string;
  docBName: string;
  docAWordCount: number;
  docBWordCount: number;
  riskLevel: PairwiseRiskLevel;
  scores: {
    overallSimilarity: number;
    identicalPercentage: number;
    paraphrasedPercentage: number;
    originalPercentage: number;
    fiveGramOverlap: number;
    winnowingJaccard: number;
    winnowingContainment: number;
    tfidfCosine: number;
    lcsSimilarity: number;
  };
  matches: PairwiseMatchSpan[];
  summary: string;
  processingTimeMs: number;
}
