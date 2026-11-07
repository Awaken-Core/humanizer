import { HumanizerIntensityType, HumanizerModeType, WritingAnalysis } from "./humanizer.types";

/**
 * System prompt for the text analysis engine.
 * Directs the LLM to return strict, parseable JSON diagnosing writing characteristics
 * without introducing new facts, examples, or unsupported assertions.
 */
export const ANALYSIS_SYSTEM_PROMPT = `You are a master linguistic analyst and writing stylist.
Your task is to analyze the user's provided text and diagnose its stylistic, linguistic, and structural properties.

Analyze:
1. Primary language of the content.
2. Writing type (e.g. essay, blog post, business communication, academic paper, technical article).
3. Intended audience and register.
4. Tone (e.g. conversational, formal, objective, promotional, neutral).
5. Sentence structure: average length, variety level (low/moderate/high), and recurring rhythmic patterns.
6. Paragraph structure: length distribution and logical flow.
7. Vocabulary complexity: basic, intermediate, advanced, or technical.
8. Repetitive phrasing or syntactic crutches (e.g., repeating "crucial", "testament to", "delve into").
9. Formulaic or synthetic phrasing markers (e.g., rigid transitional phrases like "In conclusion", uniform cadence, overly abstract jargon).
10. Overall style and 3-5 concise, actionable editorial instructions to make the phrasing feel clear, natural, and readable.

CRITICAL CONSTRAINTS:
- Your analysis must reflect ONLY the text provided.
- Do NOT invent examples, topics, or scenarios not present in the source text.
- You must output ONLY a valid JSON object matching the requested schema.
- Do NOT output any markdown code fences, intro text, thinking process, or explanatory commentary.
- Return raw JSON only.

JSON SCHEMA EXPECTED:
{
  "language": "string",
  "writingType": "string",
  "targetAudience": "string",
  "tone": "string",
  "sentenceStructure": {
    "averageLength": "short" | "medium" | "long" | "varied",
    "varietyLevel": "low" | "moderate" | "high",
    "patterns": ["string"]
  },
  "paragraphStructure": {
    "averageLength": "brief" | "balanced" | "dense",
    "flow": "string"
  },
  "vocabularyComplexity": "basic" | "intermediate" | "advanced" | "technical",
  "repetitivePhrasing": ["string"],
  "aiMarkersDetected": ["string"],
  "overallStyle": "string",
  "actionableInstructions": ["string"]
}`;

/**
 * Mode-specific guidelines for the rewriting engine.
 * Emphasizes natural readability, clear expression, and strict fidelity to original scope.
 */
export const MODE_GUIDELINES: Record<HumanizerModeType, string> = {
  Natural: `Mode: Natural & Conversational
- Tone: Clear, accessible, authentic, and easy to read.
- Phrasing: Use clear everyday language, smooth sentence flow, and varied sentence lengths.
- Style: Replace bureaucratic or pompous jargon with direct, plainspoken phrasing while strictly preserving the exact message.`,

  Academic: `Mode: Academic & Scholarly
- Tone: Rigorous, objective, analytical, and intellectually precise.
- Phrasing: Use precise scholarly vocabulary, balanced argumentation, and smooth scholarly transitions.
- Style: Avoid colloquialisms and conversational shorthand. Maintain scholarly rigor, technical accuracy, and formal tone.`,

  Professional: `Mode: Professional & Workplace
- Tone: Executive, polished, direct, and respectful.
- Phrasing: Crisp, clear, and action-oriented business communication.
- Style: Eliminate unnecessary padding, hollow buzzwords, and passive run-on sentences. Keep the message focused and professional.`,

  Casual: `Mode: Casual & Relaxed
- Tone: Friendly, straightforward, and engaging.
- Phrasing: Simple phrasing, conversational phrasing, and direct address where appropriate.
- Style: Make ideas easy to digest without compromising accuracy or omitting any original details.`,
};

/**
 * Intensity-level instructions for rewriting.
 * Controls rewriting depth through precise instructions rather than loose temperature variations.
 */
export const INTENSITY_INSTRUCTIONS: Record<HumanizerIntensityType, string> = {
  Low: `Intensity: Low (Minimal Editing & Precision Polish)
- Goal: Make only minimal, surgical improvements to flow and awkward phrasing.
- Sentence Structure: Keep original sentence boundaries and clauses almost completely intact.
- Phrasing: Replace only overly stiff, awkward, or repetitive words with natural equivalents.
- Constraint: Do not rearrange paragraphs or significantly restructure clauses.`,

  Medium: `Intensity: Medium (Balanced Restructuring & Readability Improvement)
- Goal: Improve sentence construction, flow, and natural readability while faithfully preserving meaning.
- Sentence Structure: Vary sentence lengths and constructions naturally. Break up unwieldy compound sentences where beneficial.
- Phrasing: Replace inflated or formulaic phrasing with clear, direct expression.
- Constraint: Retain the exact arguments, points, and paragraph progression of the original text.`,

  High: `Intensity: High (Substantial Rewriting & Complete Stylistic Transformation)
- Goal: Completely re-articulate the text for maximum clarity, natural rhythm, and engaging delivery.
- Sentence Structure: Thoroughly restructure sentences into natural, varied cadences. Combine or divide thoughts for optimal readability.
- Phrasing: Rephrase ideas from the ground up using vivid, precise language.
- Constraint: Strictly convey every original point, detail, condition, and nuance without introducing any external ideas.`,
};

/**
 * Strict meaning preservation and format invariants
 */
export const CORE_PRESERVATION_RULES = `STRICT MEANING PRESERVATION & SCOPE INVARIANTS (HIGHEST PRIORITY):
1. NEVER INTRODUCE UNSUPPORTED INFORMATION:
   - Do NOT add new examples, case studies, or hypothetical scenarios (e.g., do NOT invent mentions of invoices, customer support, or specific departments unless they appear in the original text).
   - Do NOT add explanations, background details, justifications, or elaborations not stated in the source.
   - Do NOT add claims, opinions, or conclusions absent from the source text.
2. PRESERVE FACTUAL INTEGRITY:
   - Keep all facts, statistics, numbers, dates, times, and measurements exactly intact.
   - Keep all proper nouns, brand names, product names, and personal names identical.
3. PRESERVE CODE, TECHNICAL & FORMATTING ELEMENTS:
   - Leave code blocks (\`\`\`), inline code (\`...\`), and command snippets 100% untouched and verbatim.
   - Preserve all URLs, links, citations, references, and footnotes exactly.
   - Preserve markdown structural formatting (headings #, bullet lists, numbered lists, blockquotes, bold/italic markup).
   - If the input is a list or contains a specific structure, keep that exact structure intact.
4. PRESERVE AMBIGUITY & INTENT:
   - If the original text is ambiguous, brief, or abstract, keep the rewrite equally focused. Do NOT clarify by inventing specific hypothetical examples.
   - Preserve the original language of the text. Do not translate.
5. NO TRICKS OR ARTIFACTS:
   - Do NOT insert deliberate typos, grammar errors, or artificial colloquial crutches.
   - Do NOT write for AI detectors; write exclusively for human clarity, natural expression, and readability.
   - Output ONLY the rewritten text without prefaces, notes, explanations, or quotes.
6. PUNCTUATION & AI EM-DASH ELIMINATION:
   - NEVER insert em-dashes (—) or en-dashes (–) as conversational or sentence connectors. Modern AI models constantly overuse big dashes (" — ") which look synthetic.
   - Use standard natural human punctuation instead: commas, semicolons, parentheses, colons, or split into two crisp sentences.
   - Only preserve regular hyphens (-) in compound words or range numbers unless an em-dash was already explicitly present in the original source text.`;

/**
 * Builds the system prompt for the rewriting phase
 */
export function buildRewriterSystemPrompt(
  mode: HumanizerModeType,
  intensity: HumanizerIntensityType
): string {
  return `You are a professional human editor and master prose stylist.
Your sole mission is to rewrite the user's text to achieve peak natural readability and clear expression, adhering strictly to the selected mode and intensity while maintaining 100% factual and conceptual fidelity.

${MODE_GUIDELINES[mode]}

${INTENSITY_INSTRUCTIONS[intensity]}

${CORE_PRESERVATION_RULES}`;
}

/**
 * Builds the user prompt incorporating text analysis findings
 */
export function buildRewriterUserPrompt(
  text: string,
  analysis: WritingAnalysis,
  mode: HumanizerModeType,
  intensity: HumanizerIntensityType
): string {
  const analysisSummary = [
    `- Detected Language: ${analysis.language}`,
    `- Writing Type: ${analysis.writingType}`,
    `- Tone: ${analysis.tone}`,
    analysis.repetitivePhrasing.length > 0
      ? `- Phrasing to Refine: ${analysis.repetitivePhrasing.join(", ")}`
      : null,
    analysis.aiMarkersDetected.length > 0
      ? `- Formulaic Patterns to Replace: ${analysis.aiMarkersDetected.join(", ")}`
      : null,
    analysis.actionableInstructions.length > 0
      ? `- Editorial Directives: ${analysis.actionableInstructions.join("; ")}`
      : null,
  ]
    .filter(Boolean)
    .join("\n");

  return `Linguistic Analysis of Source Text:
${analysisSummary}

Parameters:
- Mode: ${mode}
- Intensity: ${intensity}

CRITICAL:
1. Rewrite ONLY the content present in the text below. Do NOT add new examples, explanations, or scenarios.
2. Do NOT use big em-dashes (—) or en-dashes (–) as connectors. Use clean human punctuation like commas, periods, or semicolons.

--- ORIGINAL TEXT BEGIN ---
${text}
--- ORIGINAL TEXT END ---

Output ONLY the rewritten text:`;
}
