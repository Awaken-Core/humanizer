import type { PlagiarismSettings } from "@/features/plagiarism/plagiarism.types";
import { z } from "zod";

export const TOOL_IDS = [
  "humanizer",
  "plagiarism-checker",
  "ai-detector",
  "paraphraser",
  "summarizer",
  "grammar-checker",
] as const;

export type ToolId = (typeof TOOL_IDS)[number];
export type ToolContext = "workspace" | "document";
export type ToolResultKind = "text" | "plagiarism" | "ai-detection" | "grammar";
export type ToolControlKind =
  "mode-intensity" | "tone-focus" | "plagiarism-settings" | "none";

export type ToolMode = "natural" | "academic" | "professional" | "casual";
export type ToolIntensity = "low" | "medium" | "high";
export type ParaphraserTone =
  "standard" | "formal" | "creative" | "shorten" | "expand";
export type ParaphraserFocus = "vocabulary" | "structure" | "both";

export type ToolRunRequest = (
  | {
      service: "humanizer" | "summarizer";
      text: string;
      mode: ToolMode;
      intensity: ToolIntensity;
    }
  | {
      service: "paraphraser";
      text: string;
      tone: ParaphraserTone;
      focus: ParaphraserFocus;
    }
  | {
      service: "plagiarism-checker";
      text: string;
      settings?: Partial<PlagiarismSettings>;
    }
  | { service: "ai-detector"; text: string }
  | { service: "grammar-checker"; text: string }
) & {
  documentId?: string;
  inputSource?: "document" | "selection";
};

export interface ToolDefinition {
  id: ToolId;
  label: string;
  actionLabel: string;
  description: string;
  endpoint: `/api/v1/${string}`;
  contexts: readonly ToolContext[];
  controlKind: ToolControlKind;
  resultKind: ToolResultKind;
  minimumCharacters?: number;
  outputTextKeys: readonly string[];
}

export const TOOL_REGISTRY = {
  humanizer: {
    id: "humanizer",
    label: "Humanizer",
    actionLabel: "Humanize",
    description: "Rewrite AI-sounding text in a more natural voice.",
    endpoint: "/api/v1/humanize",
    contexts: ["workspace", "document"],
    controlKind: "mode-intensity",
    resultKind: "text",
    outputTextKeys: ["humanizedText"],
  },
  "plagiarism-checker": {
    id: "plagiarism-checker",
    label: "Plagiarism checker",
    actionLabel: "Check plagiarism",
    description: "Inspect text for matching sources and attribution risks.",
    endpoint: "/api/v1/plagiarism",
    contexts: ["workspace", "document"],
    controlKind: "plagiarism-settings",
    resultKind: "plagiarism",
    outputTextKeys: ["summary"],
  },
  "ai-detector": {
    id: "ai-detector",
    label: "AI detector",
    actionLabel: "Detect AI",
    description: "Analyze writing patterns associated with generated text.",
    endpoint: "/api/v1/ai-detect",
    contexts: ["workspace", "document"],
    controlKind: "none",
    resultKind: "ai-detection",
    minimumCharacters: 50,
    outputTextKeys: ["summary"],
  },
  paraphraser: {
    id: "paraphraser",
    label: "Paraphraser",
    actionLabel: "Paraphrase",
    description: "Rephrase text while controlling tone and structural focus.",
    endpoint: "/api/v1/paraphrase",
    contexts: ["workspace", "document"],
    controlKind: "tone-focus",
    resultKind: "text",
    outputTextKeys: ["paraphrasedText"],
  },
  summarizer: {
    id: "summarizer",
    label: "Summarizer",
    actionLabel: "Summarize",
    description: "Condense longer writing into its essential ideas.",
    endpoint: "/api/v1/summarize",
    contexts: ["workspace", "document"],
    controlKind: "mode-intensity",
    resultKind: "text",
    outputTextKeys: ["summaryText"],
  },
  "grammar-checker": {
    id: "grammar-checker",
    label: "Grammar checker",
    actionLabel: "Check grammar",
    description: "Review grammar, spelling, punctuation, and style.",
    endpoint: "/api/v1/grammar",
    contexts: ["workspace", "document"],
    controlKind: "none",
    resultKind: "grammar",
    outputTextKeys: ["correctedText"],
  },
} as const satisfies Record<ToolId, ToolDefinition>;

export function getToolDefinition(toolId: ToolId): ToolDefinition {
  return TOOL_REGISTRY[toolId];
}

export function getToolsForContext(context: ToolContext): ToolDefinition[] {
  return TOOL_IDS.map(getToolDefinition).filter((tool) =>
    tool.contexts.includes(context),
  );
}

export function getToolOutputText(
  tool: ToolDefinition,
  data: Record<string, unknown>,
): string {
  for (const key of tool.outputTextKeys) {
    const value = z.string().safeParse(data[key]);
    if (value.success) return value.data;
  }
  return "";
}

export function createDefaultToolRequest(
  service: ToolId,
  text: string,
): ToolRunRequest {
  switch (service) {
    case "humanizer":
    case "summarizer":
      return { service, text, mode: "natural", intensity: "medium" };
    case "paraphraser":
      return { service, text, tone: "standard", focus: "both" };
    case "plagiarism-checker":
      return { service, text };
    case "ai-detector":
    case "grammar-checker":
      return { service, text };
  }
}
