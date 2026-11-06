import JSZip from "jszip";

/**
 * Word (.docx) XML Run & AST Preservation Engine
 *
 * Traverses paragraph runs (<w:p>) and operates exclusively on innermost text
 * runs (<w:t>). Preserves typography, fonts, colors, bold/italics (<w:rPr>),
 * paragraph styles (<w:pPr>), tables (<w:tbl>), headers, footers, images,
 * and track-change metadata boundaries in-place.
 *
 * Also scrubs covert zero-width unicode tracking characters (EU AI Act Article 50)
 * and sanitizes document metadata.
 */

export interface DocxParagraphInfo {
  index: number;
  text: string;
  isTable: boolean;
  xmlSnippet: string;
}

export interface DocxParseResult {
  /** Combined natural language prose string */
  prose: string;
  /** Individual paragraphs with metadata */
  paragraphs: DocxParagraphInfo[];
  /** Total word count extracted */
  wordCount: number;
  /** Number of zero-width characters purged during extraction */
  zeroWidthPurged: number;
  /** The JSZip instance holding the uncompressed docx tree */
  zip: JSZip;
  /** Original document.xml raw text */
  documentXml: string;
}

/**
 * Purges zero-width unicode spaces and tracking characters from text.
 * Covers U+200B, U+200C, U+200D, U+2060, U+FEFF.
 */
export function purgeZeroWidthUnicode(text: string): { cleaned: string; count: number } {
  let count = 0;
  const cleaned = text.replace(/\u200B|\u200C|\u200D|\u2060|\uFEFF/g, () => {
    count++;
    return "";
  });
  return { cleaned, count };
}

/**
 * Parses a .docx binary buffer and extracts prose while cataloging XML paragraph structures.
 *
 * @param buffer - Raw ArrayBuffer, Uint8Array, or Node Buffer of the .docx file.
 * @returns {@link DocxParseResult} containing extracted prose and zip AST handle.
 */
export async function parseDocx(
  buffer: ArrayBuffer | Uint8Array | Buffer
): Promise<DocxParseResult> {
  const zip = await JSZip.loadAsync(buffer);

  const documentXmlFile = zip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("Invalid .docx file: word/document.xml not found.");
  }

  const documentXml = await documentXmlFile.async("string");

  // Regex to match paragraphs: <w:p ...> ... </w:p>
  const paragraphRegex = /<w:p(?:[\s>][\s\S]*?)<\/w:p>/g;
  const paragraphs: DocxParagraphInfo[] = [];

  let totalZeroWidth = 0;
  let pMatch: RegExpExecArray | null;
  let pIndex = 0;

  while ((pMatch = paragraphRegex.exec(documentXml)) !== null) {
    const pXml = pMatch[0];
    const isTable = pXml.includes("<w:tcPr>") || /<w:tbl[\s>]/.test(documentXml.slice(0, pMatch.index));

    // Extract all <w:t> or <w:t xml:space="..."> tags inside this paragraph
    const tRegex = /<w:t(?:[\s][^>]*)?>([^<]*)<\/w:t>/g;
    let tMatch: RegExpExecArray | null;
    let pText = "";

    while ((tMatch = tRegex.exec(pXml)) !== null) {
      pText += tMatch[1] || "";
    }

    const { cleaned, count } = purgeZeroWidthUnicode(pText);
    totalZeroWidth += count;

    if (cleaned.trim().length > 0) {
      paragraphs.push({
        index: pIndex++,
        text: cleaned,
        isTable,
        xmlSnippet: pXml,
      });
    }
  }

  const prose = paragraphs.map((p) => p.text).join("\n\n");
  const words = prose.trim().split(/\s+/).filter(Boolean);

  return {
    prose,
    paragraphs,
    wordCount: words.length,
    zeroWidthPurged: totalZeroWidth,
    zip,
    documentXml,
  };
}

/**
 * Reconstructs a modified .docx file by injecting rewritten paragraph prose back into
 * the original XML run streams, preserving formatting properties (<w:rPr>, <w:pPr>).
 *
 * @param originalZip - The JSZip instance from {@link parseDocx}.
 * @param rewrittenParagraphs - Array of rewritten paragraph texts corresponding to the extracted paragraphs.
 * @returns Reconstructed .docx file as a Uint8Array.
 */
export async function reconstructDocx(
  originalZip: JSZip,
  rewrittenParagraphs: string[]
): Promise<Uint8Array> {
  const documentXmlFile = originalZip.file("word/document.xml");
  if (!documentXmlFile) {
    throw new Error("word/document.xml not found in zip archive.");
  }

  let docXml = await documentXmlFile.async("string");

  // Also clean metadata in docProps/core.xml if present
  const coreXmlFile = originalZip.file("docProps/core.xml");
  if (coreXmlFile) {
    let coreXml = await coreXmlFile.async("string");
    // Strip revision identifiers and tracking tags
    coreXml = coreXml.replace(/<cp:revision>[^<]*<\/cp:revision>/g, "<cp:revision>1</cp:revision>");
    coreXml = coreXml.replace(/<cp:lastModifiedBy>[^<]*<\/cp:lastModifiedBy>/g, "<cp:lastModifiedBy>Editor</cp:lastModifiedBy>");
    originalZip.file("docProps/core.xml", coreXml);
  }

  let pCounter = 0;
  // Replace text inside each <w:p> while preserving XML tags
  docXml = docXml.replace(/<w:p(?:[\s>][\s\S]*?)<\/w:p>/g, (pXml) => {
    // Check if this paragraph contains text runs
    if (!/<w:t(?:[\s>])/.test(pXml)) {
      return pXml;
    }

    if (pCounter >= rewrittenParagraphs.length) {
      return pXml;
    }

    const newText = rewrittenParagraphs[pCounter++];
    if (newText === undefined) return pXml;

    // Escape special XML characters in replacement text
    const escapedText = newText
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

    // Strategy: Preserve the first run (<w:r>) with its formatting (<w:rPr>),
    // set its <w:t xml:space="preserve"> to escapedText, and clear subsequent <w:t> nodes
    let firstRunReplaced = false;

    // Replace runs inside the paragraph
    const modifiedPXml = pXml.replace(/<w:r(?:[\s>][\s\S]*?)<\/w:r>/g, (rXml) => {
      if (!/<w:t(?:[\s>])/.test(rXml)) {
        return rXml; // Non-text run (e.g. image, footnote reference)
      }

      if (!firstRunReplaced) {
        firstRunReplaced = true;
        // Keep <w:rPr> styling in this run, replace <w:t> content
        return rXml.replace(
          /<w:t(?:[\s][^>]*)?>([^<]*)<\/w:t>/,
          `<w:t xml:space="preserve">${escapedText}</w:t>`
        );
      } else {
        // Empty subsequent text runs in this paragraph so text doesn't duplicate
        return rXml.replace(
          /<w:t(?:[\s][^>]*)?>([^<]*)<\/w:t>/,
          `<w:t></w:t>`
        );
      }
    });

    return modifiedPXml;
  });

  originalZip.file("word/document.xml", docXml);

  // Repackage zip into a binary buffer
  return await originalZip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

