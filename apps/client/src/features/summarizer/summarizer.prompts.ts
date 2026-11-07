import type {
  HumanizerIntensityType,
  HumanizerModeType,
} from "@/features/humanizer";

const MODE_INSTRUCTIONS: Record<HumanizerModeType, string> = {
  Natural: "Use clear, natural language that is easy for a general reader to follow.",
  Academic: "Use an objective, precise, scholarly style and retain technical terminology.",
  Professional: "Use a concise, polished workplace style focused on decisions and key information.",
  Casual: "Use a friendly, straightforward conversational style without losing accuracy.",
};

const INTENSITY_INSTRUCTIONS: Record<HumanizerIntensityType, string> = {
  Low: "Light compression: retain most supporting details while removing repetition and padding.",
  Medium: "Balanced compression: retain the main ideas and the most important supporting details.",
  High: "Strong compression: retain only the essential ideas, conclusions, and critical facts.",
};

export function buildSummarizerSystemPrompt(
  mode: HumanizerModeType,
  intensity: HumanizerIntensityType
): string {
  return `You are an expert editor who produces faithful, self-contained summaries.

STYLE:
${MODE_INSTRUCTIONS[mode]}

SUMMARY INTENSITY:
${INTENSITY_INSTRUCTIONS[intensity]}

NON-NEGOTIABLE RULES:
- Summarize only information present in the source text.
- Never add facts, opinions, explanations, examples, or conclusions.
- Preserve important names, numbers, dates, qualifications, and relationships exactly.
- Preserve the source language; do not translate.
- Preserve uncertainty and attribution. Do not present a claim as fact when the source does not.
- Prefer coherent paragraphs, but retain a list when it is the clearest representation of the source.
- Do NOT use em-dashes (—) or en-dashes (–) as connectors; use standard punctuation (commas, semicolons, periods).
- Output only the summary, with no preface, label, commentary, or surrounding quotation marks.`;
}

export function buildSummarizerUserPrompt(text: string): string {
  return `Summarize the source text according to the system instructions.

--- SOURCE TEXT BEGIN ---
${text}
--- SOURCE TEXT END ---

Output only the summary:`;
}
