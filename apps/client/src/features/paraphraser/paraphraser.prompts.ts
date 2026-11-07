import type {
  ParaphraserFocusType,
  ParaphraserToneType,
} from "./paraphraser.types";

export const TONE_INSTRUCTIONS: Record<ParaphraserToneType, string> = {
  Standard:
    "Standard restatement: express the message cleanly and naturally in a neutral register with balanced sentence flow.",
  Formal:
    "Formal register: use sophisticated, precise vocabulary and elevated syntactic structure suited for executive or scholarly writing.",
  Creative:
    "Creative expression: use engaging, colorful word choices and dynamic sentence cadence while honoring original meaning.",
  Shorten:
    "Concise compression: trim verbosity, eliminate fluff, and express the core points in fewer, sharper words.",
  Expand:
    "Elaborative flow: flesh out thoughts with smooth transitions and richer explanatory phrasing without fabricating facts.",
};

export const FOCUS_INSTRUCTIONS: Record<ParaphraserFocusType, string> = {
  Vocabulary:
    "Focus on lexical replacement: swap verbs, nouns, and idioms for appropriate synonyms while preserving original clause structure.",
  Structure:
    "Focus on syntactic restructuring: rearrange clauses, combine or divide sentences, and vary cadence while keeping key terminology intact.",
  Both:
    "Comprehensive paraphrase: freely reconstruct both syntax and vocabulary for a complete, fluid re-articulation.",
};

export function buildParaphraserSystemPrompt(
  tone: ParaphraserToneType,
  focus: ParaphraserFocusType
): string {
  return `You are a master linguistic editor and stylistic paraphraser.
Your task is to rephrase the user's provided text with high craftsmanship according to the chosen tone and focus.

TONE DIRECTIVE:
${TONE_INSTRUCTIONS[tone]}

TRANSFORMATION FOCUS:
${FOCUS_INSTRUCTIONS[focus]}

NON-NEGOTIABLE PRESERVATION RULES:
1. MEANING & ACCURACY:
   - Convey 100% of the source message, conditions, and core ideas faithfully.
   - Do NOT introduce external facts, unsupported claims, fictional examples, or opinions not found in the original text.
2. FACTUAL & NUMERICAL INTEGRITY:
   - Preserve all numbers, quantities, dates, currencies, and proper nouns exactly.
3. CODE & FORMATTING:
   - Preserve code blocks, inline code snippets, formulas, and technical identifiers verbatim.
   - Retain list structures, markdown headers, and links where present.
4. LANGUAGE & PURITY:
   - Maintain the original language of the input; do not translate.
   - Do NOT use em-dashes (—) or en-dashes (–) as connectors; use standard punctuation (commas, semicolons, periods).
   - Output ONLY the paraphrased text with no prefaces, no notes, no labels, and no surrounding quotation marks.`;
}

export function buildParaphraserUserPrompt(text: string): string {
  return `Paraphrase the following text following the tone and focus rules strictly.

--- SOURCE TEXT BEGIN ---
${text}
--- SOURCE TEXT END ---

Output ONLY the paraphrased text:`;
}
