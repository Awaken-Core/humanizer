if (typeof window !== "undefined") {
  throw new Error("This module can only be used on the server.");
}

import { env } from "@/lib/env";
import type { PlagiarismSource } from "./plagiarism.types";
import { SerperSearchResultDto } from "./plagiarism.dto";

// ---------------------------------------------------------------------------
// Stopwords (inline — no external import)
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "is",
  "was",
  "are",
  "were",
  "be",
  "been",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "not",
  "it",
  "this",
  "that",
  "these",
  "those",
  "we",
  "our",
  "their",
  "its",
]);

// ---------------------------------------------------------------------------
// Search Query Construction
// ---------------------------------------------------------------------------

/**
 * Selects 3–5 high-information-density phrases from the text.
 * Uses exact quoted phrases ("...") so that search engines (Serper/Google)
 * locate the verbatim source rather than broad topical matches.
 *
 * @param text - The user-submitted text.
 * @param maxQueries - Maximum number of search queries to return (default 4).
 * @returns Array of search query strings.
 */
export function buildSearchQueries(text: string, maxQueries = 4): string[] {
  // Tokenize into natural words preserving exact sequence (DO NOT strip short words like "a", "to", "in")
  const words = text
    .replace(/[^\w\s]/g, " ")
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length < 5) {
    return [text.slice(0, 100).trim()];
  }

  // Score each word by content value: non-stopword, length > 4 = higher weight
  const wordScores = words.map((w) => ({
    word: w,
    score: STOPWORDS.has(w) ? 0 : w.length > 4 ? 2 : 1,
  }));

  // Build 7-8 word n-gram candidates for exact quoted search
  type Candidate = { phrase: string; score: number; startIdx: number };
  const candidates: Candidate[] = [];

  const NGRAM_SIZE = Math.min(8, words.length);
  for (let i = 0; i <= wordScores.length - NGRAM_SIZE; i++) {
    const slice = wordScores.slice(i, i + NGRAM_SIZE);
    const contentWords = slice.filter((ws) => ws.score > 0).length;
    // We want at least 3 content words so it is meaningful
    if (contentWords < 3) continue;

    const score = slice.reduce((sum, ws) => sum + ws.score, 0);
    candidates.push({
      phrase: `"${slice.map((ws) => ws.word).join(" ")}"`,
      score,
      startIdx: i,
    });
  }

  if (candidates.length === 0) {
    return [`"${words.slice(0, NGRAM_SIZE).join(" ")}"`];
  }

  // Sort by score descending
  candidates.sort((a, b) => b.score - a.score);

  // Greedily select queries that are at least 15 words apart
  const selected: Candidate[] = [];
  const MIN_GAP = 15;
  for (const candidate of candidates) {
    if (selected.length >= maxQueries) break;
    const tooClose = selected.some(
      (s) => Math.abs(s.startIdx - candidate.startIdx) < MIN_GAP,
    );
    if (!tooClose) {
      selected.push(candidate);
    }
  }

  return selected.map((c) => c.phrase);
}

// ---------------------------------------------------------------------------
// Web Search via Serper API
// ---------------------------------------------------------------------------

/**
 * Calls the Serper Google Search API with the provided query string.
 * Returns an empty array when the API key is absent or the request fails.
 *
 * @param query - Search query string.
 * @returns Array of search results with url, title, and snippet.
 */
export async function searchWeb(
  query: string,
): Promise<Array<{ url: string; title: string; snippet: string }>> {
  const apiKey = env.SERPER_API_KEY;

  if (!apiKey) {
    // Graceful degradation: no API key means no retrieval
    return [];
  }

  try {
    const response = await fetch(`${env.SERPER_BASE_URL}/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": apiKey,
      },
      body: JSON.stringify({ q: query, num: 5 }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.warn(
        `Serper API returned ${response.status} for query: "${query}"`,
      );
      return [];
    }

    const data = SerperSearchResultDto.parse(await response.json());

    return (data.organic ?? [])
      .filter((r) => r.link)
      .map((r) => ({
        url: r.link!,
        title: r.title ?? "",
        snippet: r.snippet ?? "",
      }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Web search failed for query "${query}": ${message}`);
    return [];
  }
}

// ---------------------------------------------------------------------------
// Page Text Extraction
// ---------------------------------------------------------------------------

/** Regex patterns for HTML stripping */
const SCRIPT_REGEX = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
const STYLE_REGEX = /<style\b[^>]*>[\s\S]*?<\/style>/gi;
const HTML_TAG_REGEX = /<[^>]+>/g;
const HTML_ENTITY_REGEX = /&(?:#\d+|#x[\da-fA-F]+|[a-zA-Z]+);/g;
const MAX_PAGE_TEXT_LENGTH = 50_000;

/** Common HTML entity decoding map. */
const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
};

/**
 * Fetches the page at `url`, strips HTML markup, and returns cleaned plain
 * text up to 50,000 characters. Silently returns an empty string on any error
 * or for PDF/binary content types.
 *
 * @param url - URL of the page to fetch.
 * @returns Plain-text content of the page.
 */
export async function fetchPageText(url: string): Promise<string> {
  try {
    // Reject obvious PDF/binary URLs
    if (/\.pdf(\?.*)?$/i.test(url)) return "";

    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) return "";

    const contentType = response.headers.get("content-type") ?? "";
    if (
      contentType.includes("application/pdf") ||
      contentType.includes("octet-stream")
    ) {
      return "";
    }

    const html = await response.text();

    // 1. Extract embedded Next.js __NEXT_DATA__ content if present (e.g. GeeksforGeeks, Substack)
    let nextDataText = "";
    const nextDataMatch = /<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
    if (nextDataMatch && nextDataMatch[1]) {
      try {
        const nextData = JSON.parse(nextDataMatch[1]);
        const postContent =
          nextData?.props?.pageProps?.postDataFromWriteApi?.post_content ||
          nextData?.props?.pageProps?.post?.content ||
          nextData?.props?.pageProps?.article?.content ||
          "";
        if (typeof postContent === "string" && postContent) {
          nextDataText = postContent
            .replace(HTML_TAG_REGEX, " ")
            .replace(HTML_ENTITY_REGEX, (entity) => HTML_ENTITIES[entity] ?? " ")
            .replace(/\s+/g, " ")
            .trim();
        }
      } catch {}
    }

    // Strip scripts and style blocks
    const stripped = html
      .replace(SCRIPT_REGEX, " ")
      .replace(STYLE_REGEX, " ")
      .replace(HTML_TAG_REGEX, " ")
      .replace(HTML_ENTITY_REGEX, (entity) => HTML_ENTITIES[entity] ?? " ")
      .replace(/\s+/g, " ")
      .trim();

    const combined = (nextDataText ? `${nextDataText} ${stripped}` : stripped).slice(0, MAX_PAGE_TEXT_LENGTH);
    return combined;
  } catch {
    return "";
  }
}

// ---------------------------------------------------------------------------
// Source Retrieval Orchestrator
// ---------------------------------------------------------------------------

/**
 * Full retrieval pipeline: builds search queries from the input text,
 * searches the web, fetches each result page, and returns the candidate
 * sources with their raw page text populated for the scoring stage.
 *
 * Returns an empty array when no API key is configured or all requests fail.
 *
 * @param text - The user-submitted text to check.
 * @param maxSources - Maximum number of sources to return (default 10).
 * @returns Array of PlagiarismSource objects with `rawText` populated.
 */
export async function retrieveCandidateSources(
  text: string,
  maxSources = 10,
): Promise<PlagiarismSource[]> {
  const queries = buildSearchQueries(text);

  if (queries.length === 0) return [];

  // Run all search queries concurrently
  const searchResults = await Promise.all(queries.map((q) => searchWeb(q)));

  // Deduplicate URLs
  const seen = new Set<string>();
  const uniqueResults: Array<{ url: string; title: string; snippet: string }> =
    [];
  for (const batch of searchResults) {
    for (const result of batch) {
      if (!seen.has(result.url)) {
        seen.add(result.url);
        uniqueResults.push(result);
      }
    }
  }

  // Take up to maxSources candidates
  const candidates = uniqueResults.slice(0, maxSources);

  // Fetch all pages concurrently
  const sources = await Promise.all(
    candidates.map(async (result): Promise<PlagiarismSource> => {
      let rawText = await fetchPageText(result.url);

      // Resilient fallback: If scraping was blocked by Cloudflare/WAF or authwall (e.g., Medium, LinkedIn, Facebook),
      // we utilize the exact indexed snippet returned by Google/Serper so we can still score the matched passage!
      if (!rawText || rawText.length < 50) {
        rawText = result.snippet ? `${result.title} ${result.snippet}` : "";
      }

      const domain = extractDomain(result.url);
      return {
        url: result.url,
        title: result.title,
        domain,
        matchPercentage: 0,
        matchedWordCount: 0,
        isExcluded: false,
        retrievedAt: new Date(),
        rawText,
      };
    }),
  );

  // Filter out sources where we have neither scraped text nor snippet
  return sources.filter((s) => (s.rawText?.length ?? 0) > 15);
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts the hostname (domain) from a URL string.
 * Returns the full URL if parsing fails.
 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}
