import JSZip from "jszip";
import { parseDocx, reconstructDocx } from "./docx-parser";
import { maskLatex, unmaskLatex, extractLatexProse } from "./latex-parser";
import { maskMarkdown, unmaskMarkdown, extractMarkdownProse } from "./markdown-parser";

/**
 * Batch ZIP Archive Processor
 *
 * Traverses uploaded .zip archives in-memory, identifies supported document files
 * (.docx, .tex, .md, .txt), extracts prose while isolating ASTs/formats,
 * allows transformation of each file, and repackages all files preserving
 * the exact directory and folder structure.
 */

export interface BatchFileEntry {
  path: string;
  filename: string;
  extension: "docx" | "tex" | "md" | "txt";
  originalBytes?: Uint8Array;
  originalText?: string;
  extractedProse: string;
}

export interface ZipBatchUnpackResult {
  entries: BatchFileEntry[];
  totalFiles: number;
  unsupportedFilesCount: number;
  zip: JSZip;
}

/**
 * Unpacks a .zip archive in-memory and extracts processable documents.
 *
 * @param zipBuffer - Binary buffer of the .zip file.
 * @returns {@link ZipBatchUnpackResult} containing list of extracted file entries.
 */
export async function unpackBatchZip(
  zipBuffer: ArrayBuffer | Uint8Array | Buffer
): Promise<ZipBatchUnpackResult> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const entries: BatchFileEntry[] = [];
  let unsupportedFilesCount = 0;

  for (const [path, fileObj] of Object.entries(zip.files)) {
    // Skip folders and OS hidden metadata files
    if (fileObj.dir || path.startsWith("__MACOSX/") || path.includes("/.")) {
      continue;
    }

    const lowerPath = path.toLowerCase();
    const parts = path.split("/");
    const filename = parts[parts.length - 1] ?? path;

    if (lowerPath.endsWith(".docx")) {
      const bytes = await fileObj.async("uint8array");
      const { prose } = await parseDocx(bytes);
      entries.push({
        path,
        filename,
        extension: "docx",
        originalBytes: bytes,
        extractedProse: prose,
      });
    } else if (lowerPath.endsWith(".tex")) {
      const text = await fileObj.async("string");
      const prose = extractLatexProse(text);
      entries.push({
        path,
        filename,
        extension: "tex",
        originalText: text,
        extractedProse: prose,
      });
    } else if (lowerPath.endsWith(".md")) {
      const text = await fileObj.async("string");
      const prose = extractMarkdownProse(text);
      entries.push({
        path,
        filename,
        extension: "md",
        originalText: text,
        extractedProse: prose,
      });
    } else if (lowerPath.endsWith(".txt")) {
      const text = await fileObj.async("string");
      entries.push({
        path,
        filename,
        extension: "txt",
        originalText: text,
        extractedProse: text,
      });
    } else {
      unsupportedFilesCount++;
    }
  }

  return {
    entries,
    totalFiles: entries.length,
    unsupportedFilesCount,
    zip,
  };
}

/**
 * Repackages humanized / transformed file entries back into a clean ZIP archive.
 *
 * @param originalZip - The JSZip instance holding original files and structure.
 * @param transformedEntries - Map of relative file paths to their new transformed content.
 * @returns Processed .zip archive as Uint8Array.
 */
export async function repackageBatchZip(
  originalZip: JSZip,
  transformedEntries: Map<string, { prose: string; isModified: boolean }>
): Promise<Uint8Array> {
  const outputZip = new JSZip();

  // Copy non-modified files directly from original zip
  for (const [path, fileObj] of Object.entries(originalZip.files)) {
    if (fileObj.dir || path.startsWith("__MACOSX/")) continue;

    const transform = transformedEntries.get(path);
    if (!transform || !transform.isModified) {
      const content = await fileObj.async("uint8array");
      outputZip.file(path, content);
      continue;
    }

    // Reconstruct modified file according to its format
    const lowerPath = path.toLowerCase();
    if (lowerPath.endsWith(".docx")) {
      const docxBytes = await fileObj.async("uint8array");
      const { zip: subZip, paragraphs } = await parseDocx(docxBytes);
      // Split new prose into paragraphs
      const newParagraphs = transform.prose.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
      const rebuiltDocx = await reconstructDocx(subZip, newParagraphs);
      outputZip.file(path, rebuiltDocx);
    } else if (lowerPath.endsWith(".tex")) {
      const originalTex = await fileObj.async("string");
      const { maskedText, placeholders } = maskLatex(originalTex);
      // If prose was transformed, we unmask placeholders
      const restoredTex = unmaskLatex(transform.prose, placeholders);
      outputZip.file(path, restoredTex);
    } else if (lowerPath.endsWith(".md")) {
      const originalMd = await fileObj.async("string");
      const { maskedText, placeholders } = maskMarkdown(originalMd);
      const restoredMd = unmaskMarkdown(transform.prose, placeholders);
      outputZip.file(path, restoredMd);
    } else {
      // Plain text
      outputZip.file(path, transform.prose);
    }
  }

  return await outputZip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
}

