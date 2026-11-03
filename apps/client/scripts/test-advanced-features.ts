import {
  maskLatex,
  unmaskLatex,
  extractLatexProse,
  maskMarkdown,
  unmaskMarkdown,
  extractMarkdownProse,
  purgeZeroWidthUnicode,
  parseDocx,
  reconstructDocx,
} from "../src/lib/parser";
import { shieldCitations } from "../src/features/humanizer/citation-shield";
import { comparePairwise } from "../src/features/plagiarism/plagiarism.pairwise";
import JSZip from "jszip";

async function runTests() {
  console.log("==================================================================");
  console.log("RUNNING TURNITOUT ADVANCED CAPABILITY TEST SUITE");
  console.log("==================================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, desc: string) {
    if (condition) {
      console.log(`[PASS] ${desc}`);
      passed++;
    } else {
      console.error(`[FAIL] ${desc}`);
      failed++;
    }
  }

  // ---------------------------------------------------------------------------
  // 1. LaTeX Math & Macro Protection
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 1: LaTeX Math & XML Run Protection ---");
  const sampleLatex = `\\documentclass{article}
\\usepackage{amsmath}
\\begin{document}
\\section{Introduction}
In modern artificial intelligence, deep learning models optimize the loss function:
\\begin{equation}
\\mathcal{L}_{\\theta} = - \\sum_{i=1}^N y_i \\log p_\\theta(x_i) + \\frac{\\lambda}{2} ||\\theta||^2
\\end{equation}
Furthermore, the inline parameter $\\alpha > 0.05$ demonstrates empirical stability \\cite{vaswani2017attention}.
\\end{document}`;

  const { maskedText, placeholders, stats } = maskLatex(sampleLatex);
  assert(stats.mathEnvCount === 1, `Protected 1 equation environment (found: ${stats.mathEnvCount})`);
  assert(stats.mathInlineCount === 1, `Protected 1 inline math expression (found: ${stats.mathInlineCount})`);
  assert(stats.citationCount === 1, `Protected 1 citation command (found: ${stats.citationCount})`);
  assert(!maskedText.includes("\\mathcal{L}"), "Prose stream contains no raw equation symbols");

  // Mutate non-math prose
  const mutatedText = maskedText.replace("demonstrates empirical stability", "shows consistent practical performance");
  const restoredLatex = unmaskLatex(mutatedText, placeholders);

  assert(restoredLatex.includes("\\mathcal{L}_{\\theta}"), "Equation restored verbatim bit-for-bit");
  assert(restoredLatex.includes("$\\alpha > 0.05$"), "Inline math restored bit-for-bit");
  assert(restoredLatex.includes("\\cite{vaswani2017attention}"), "Citation key restored bit-for-bit");
  assert(restoredLatex.includes("shows consistent practical performance"), "Prose replacement applied cleanly");

  // ---------------------------------------------------------------------------
  // 2. Zero-Width Unicode Scrubbing
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 2: Steganographic Zero-Width Unicode Scrubbing ---");
  const watermarkedText = "This\u200B text\u200C has\u200D covert\u2060 zero-width\uFEFF watermarks.";
  const { cleaned, count } = purgeZeroWidthUnicode(watermarkedText);
  assert(count === 5, `Detected and purged 5 zero-width characters (found: ${count})`);
  assert(cleaned === "This text has covert zero-width watermarks.", "Cleaned text matches authentic string");

  // ---------------------------------------------------------------------------
  // 3. Word (.docx) Parsing and XML Reconstruction
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 3: Word (.docx) XML Run Preservation ---");
  const mockZip = new JSZip();
  const mockDocumentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:rPr><w:b/></w:rPr><w:t>Research Overview</w:t></w:r>
    </w:p>
    <w:p>
      <w:r><w:t>The neural network demonstrates substantial accuracy across distributed clusters.</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`;
  mockZip.file("word/document.xml", mockDocumentXml);
  const docxBuffer = await mockZip.generateAsync({ type: "uint8array" });

  const parsedDocx = await parseDocx(docxBuffer);
  assert(parsedDocx.paragraphs.length === 2, `Parsed 2 XML paragraphs (found: ${parsedDocx.paragraphs.length})`);
  assert(parsedDocx.prose.includes("Research Overview"), "Extracted heading text");
  assert(parsedDocx.prose.includes("substantial accuracy"), "Extracted paragraph body");

  const newParagraphs = [
    "Research Overview",
    "The neural system exhibits remarkable precision across distributed server clusters.",
  ];
  const reconstructedBytes = await reconstructDocx(parsedDocx.zip, newParagraphs);
  const reParsedDocx = await parseDocx(reconstructedBytes);
  assert(
    reParsedDocx.prose.includes("exhibits remarkable precision"),
    "Reconstructed docx reflects updated humanized text"
  );
  assert(
    reParsedDocx.documentXml.includes('w:val="Heading1"'),
    "Reconstructed docx preserves paragraph formatting XML tags"
  );

  // ---------------------------------------------------------------------------
  // 4. Citation Shielding Engine
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 4: Turnitin Citation Shielding (8-Gram Breaker) ---");
  const longDenseText =
    "Renewable energy adoption has accelerated significantly across global industrial and commercial markets over the past decade. Driven by steep declines in solar photovoltaic manufacturing costs and technological breakthroughs in grid-scale battery storage, solar and wind power now represent the most economically viable source of new electricity generation in over two-thirds of the world.";

  const shieldResult = shieldCitations(longDenseText, {
    style: "latex",
    discipline: "computer-science",
  });

  assert(shieldResult.injectedCitations.length > 0, `Injected ${shieldResult.injectedCitations.length} citation markers`);
  assert(shieldResult.shieldedText.includes("\\cite{"), "Shielded text contains LaTeX \\cite marker");
  assert(shieldResult.bibtexPackage.includes("@article{"), "Generated companion citations.bib BibTeX package");
  assert(shieldResult.brokenNgramsCount > 0, `Broke ${shieldResult.brokenNgramsCount} rolling-hash n-gram chains`);

  // ---------------------------------------------------------------------------
  // 5. Pairwise Document Similarity ("Doc vs Doc")
  // ---------------------------------------------------------------------------
  console.log("\n--- TEST 5: Pairwise Document Comparison Multi-Pass Engine ---");
  const docA =
    "Deep residual networks facilitate the training of substantially deeper neural networks than previously feasible. We explicitly reformulate the layers as learning residual functions with reference to the layer inputs.";
  const docB =
    "Deep residual networks facilitate the training of substantially deeper neural networks than previously feasible. In this paper, we reformulate layers to optimize residual mappings rather than unreferenced functions.";

  const pairwise = await comparePairwise(docA, docB, {
    docAName: "Draft Paper",
    docBName: "He et al. (2016)",
  });

  assert(pairwise.scores.overallSimilarity > 50, `Overall similarity is high as expected (${pairwise.scores.overallSimilarity}%)`);
  assert(pairwise.scores.identicalPercentage > 30, `Identical 5-gram overlap detected (${pairwise.scores.identicalPercentage}%)`);
  assert(pairwise.scores.winnowingContainment > 40, `Winnowing rolling hash containment detected (${pairwise.scores.winnowingContainment}%)`);
  assert(pairwise.matches.length >= 1, `Flagged matching passages (found: ${pairwise.matches.length})`);
  assert(pairwise.riskLevel === "High", `Risk level rated High (found: ${pairwise.riskLevel})`);

  console.log("==================================================================");
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((e) => {
  console.error("Test runner crashed:", e);
  process.exit(1);
});

