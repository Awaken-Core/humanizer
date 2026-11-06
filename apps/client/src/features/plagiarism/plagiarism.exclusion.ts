import type { ExclusionRegion, PlagiarismMatch, PlagiarismSettings } from "./plagiarism.types";

// ---------------------------------------------------------------------------
// Citation Pattern Regexes
// ---------------------------------------------------------------------------

/** Double or smart-quoted passages containing at least 10 characters. */
const QUOTE_REGEX = /(?:[""])[^"""]{10,}(?:[""])/g;

/** APA in-text citation: (Author, 2024) or (Author & Other, 2024, p. 12) */
const APA_CITATION_REGEX = /\([A-Z][a-zA-ZÀ-ÖØ-öø-ÿ\s,&.]+,\s*\d{4}(?:,\s*p{1,2}\.\s*\d+(?:–\d+)?)?\)/g;

/** MLA in-text citation: (Author 45) or (Author 12-15) */
const MLA_CITATION_REGEX = /\([A-Z][a-zA-ZÀ-ÖØ-öø-ÿ]+(?:\s+[a-zA-ZÀ-ÖØ-öø-ÿ]+)*\s+\d+(?:[-–]\d+)?\)/g;

/** IEEE numeric citation: [1] or [1-4] or [1, 2, 3] */
const IEEE_CITATION_REGEX = /\[\d+(?:[,\s\-–]+\d+)*\]/g;

/** Chicago-style footnote marker (superscript digit embedded inline): not detectable in plain text, but we match "fn.N" */
const CHICAGO_FOOTNOTE_REGEX = /\bfn\.\s*\d+\b/gi;

/** Bibliography section heading, case-insensitive, must start a line. */
const BIBLIOGRAPHY_HEADING_REGEX =
  /^[ \t]*(?:references?|bibliography|works\s+cited|sources?)[ \t]*$/im;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scans the text for quotations, in-text citations, and optionally the full
 * bibliography section, returning ordered, non-overlapping ExclusionRegion
 * objects that cover all detected regions.
 *
 * @param text - The full user-submitted text.
 * @param settings - Plagiarism settings controlling which exclusions apply.
 * @returns Sorted, merged list of exclusion regions.
 */
export function detectExclusionRegions(
  text: string,
  settings: PlagiarismSettings
): ExclusionRegion[] {
  const regions: ExclusionRegion[] = [];

  // --- Bibliography section (everything from heading to end of text) ---
  if (settings.excludeBibliography) {
    const headingMatch = BIBLIOGRAPHY_HEADING_REGEX.exec(text);
    if (headingMatch) {
      regions.push({
        start: headingMatch.index,
        end: text.length,
        type: "bibliography",
      });
    }
    // Reset lastIndex as BIBLIOGRAPHY_HEADING_REGEX has 'm' flag (global state)
    BIBLIOGRAPHY_HEADING_REGEX.lastIndex = 0;
  }

  // --- Quoted passages ---
  if (settings.excludeQuotes) {
    for (const match of text.matchAll(QUOTE_REGEX)) {
      regions.push({
        start: match.index!,
        end: match.index! + match[0].length,
        type: "quote",
      });
    }
  }

  // --- In-text citations ---
  const citationPatterns = [
    APA_CITATION_REGEX,
    MLA_CITATION_REGEX,
    IEEE_CITATION_REGEX,
    CHICAGO_FOOTNOTE_REGEX,
  ];
  for (const pattern of citationPatterns) {
    for (const match of text.matchAll(pattern)) {
      regions.push({
        start: match.index!,
        end: match.index! + match[0].length,
        type: "citation",
      });
    }
  }

  return mergeRegions(regions);
}

/**
 * Returns a version of the text where every excluded region has been replaced
 * with space characters of the same length, preserving all character offsets.
 *
 * @param text - Original user text.
 * @param regions - Exclusion regions (may overlap; will be handled correctly).
 * @returns Text with excluded regions blanked out.
 */
export function stripExclusionRegions(
  text: string,
  regions: ExclusionRegion[]
): string {
  if (regions.length === 0) return text;

  const chars = text.split("");
  for (const region of regions) {
    const start = Math.max(0, region.start);
    const end = Math.min(chars.length, region.end);
    for (let i = start; i < end; i++) {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

/**
 * Determines whether a specific character offset falls inside any exclusion
 * region, using binary search for efficiency.
 *
 * @param offset - Character offset to test.
 * @param regions - Sorted list of exclusion regions.
 * @returns `true` if the offset is within an excluded region.
 */
export function isCharExcluded(offset: number, regions: ExclusionRegion[]): boolean {
  let lo = 0;
  let hi = regions.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const region = regions[mid]!;
    if (offset < region.start) {
      hi = mid - 1;
    } else if (offset >= region.end) {
      lo = mid + 1;
    } else {
      return true;
    }
  }
  return false;
}

/**
 * Removes matches that substantially overlap with any exclusion region.
 * A match is considered overlapping if its midpoint falls inside an excluded region,
 * or if its start or end falls inside one.
 *
 * @param matches - Array of detected plagiarism matches.
 * @param regions - Sorted exclusion regions.
 * @returns Filtered matches that do not overlap with excluded content.
 */
export function filterMatchesByExclusions(
  matches: PlagiarismMatch[],
  regions: ExclusionRegion[]
): PlagiarismMatch[] {
  if (regions.length === 0) return matches;
  return matches.filter((match) => {
    const mid = Math.floor((match.startChar + match.endChar) / 2);
    return (
      !isCharExcluded(match.startChar, regions) &&
      !isCharExcluded(mid, regions) &&
      !isCharExcluded(match.endChar - 1, regions)
    );
  });
}

// ---------------------------------------------------------------------------
// Internal Helpers
// ---------------------------------------------------------------------------

/**
 * Sorts regions by start offset and merges overlapping/adjacent ones.
 * Prefers the "bibliography" type when merging with other types,
 * otherwise keeps the type of the first region in the merge group.
 */
function mergeRegions(regions: ExclusionRegion[]): ExclusionRegion[] {
  if (regions.length === 0) return [];

  regions.sort((a, b) => a.start - b.start || a.end - b.end);

  const merged: ExclusionRegion[] = [{ ...regions[0]! }];

  for (let i = 1; i < regions.length; i++) {
    const current = regions[i]!;
    const last = merged[merged.length - 1]!;

    if (current.start <= last.end) {
      // Overlapping or adjacent — merge
      last.end = Math.max(last.end, current.end);
      // Upgrade type to bibliography if either is bibliography
      if (current.type === "bibliography" || last.type === "bibliography") {
        last.type = "bibliography";
      }
    } else {
      merged.push({ ...current });
    }
  }

  return merged;
}
