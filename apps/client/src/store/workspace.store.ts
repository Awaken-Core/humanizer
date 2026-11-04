import { create } from "zustand";
import {
  getToolDefinition,
  getToolOutputText,
  type ParaphraserFocus,
  type ParaphraserTone,
  type ToolIntensity,
  type ToolMode,
  type ToolRunRequest,
} from "@/lib/tool-registry";
import type {
  PlagiarismResult,
  PlagiarismSettings,
} from "@/features/plagiarism/plagiarism.types";
import type { AiDetectionResult } from "@/features/ai-detector/ai-detector.types";
import type { GrammarCheckResult } from "@/features/grammar/grammar.types";

export type WorkspaceMode = ToolMode;
export type WorkspaceIntensity = ToolIntensity;
export type { ParaphraserFocus, ParaphraserTone };
export type WorkspaceServiceRequest = ToolRunRequest;

interface ApiResponse {
  success?: boolean;
  data?: {
    humanizedText?: string;
    summaryText?: string;
    paraphrasedText?: string;
    correctedText?: string;
    scores?: PlagiarismResult["scores"] | AiDetectionResult["scores"];
    sources?: PlagiarismResult["sources"];
    matches?: PlagiarismResult["matches"];
    highlights?: AiDetectionResult["highlights"];
    issues?: GrammarCheckResult["issues"];
    wordCount?: number;
    sentenceCount?: number;
    summary?: string;
    score?: number;
    processingTimeMs?: number;
    settings?: PlagiarismSettings;
  };
  error?: { message?: string } | string;
}

interface ToolStore {
  outputText: string;
  plagiarismResult: PlagiarismResult | null;
  aiDetectorResult: AiDetectionResult | null;
  grammarResult: GrammarCheckResult | null;
  isLoading: boolean;
  error: string | null;
  runTool: (
    request: WorkspaceServiceRequest,
  ) => Promise<Record<string, unknown> | null>;
  /** @deprecated Use runTool. */
  runService: (request: WorkspaceServiceRequest) => Promise<void>;
  toggleSourceExclusion: (sourceUrl: string) => void;
  clearResult: () => void;
  setError: (message: string) => void;
}

export const useToolStore = create<ToolStore>((set, get) => ({
  outputText: "",
  plagiarismResult: null,
  aiDetectorResult: null,
  grammarResult: null,
  isLoading: false,
  error: null,

  runTool: async (request) => {
    if (get().isLoading) return null;
    set({
      isLoading: true,
      error: null,
      outputText: "",
      plagiarismResult: null,
      aiDetectorResult: null,
      grammarResult: null,
    });

    try {
      const { service, ...payload } = request;
      const tool = getToolDefinition(service);

      const response = await fetch(tool.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success || !data.data) {
        const errorMsg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message || `Failed to run ${tool.label}.`;
        throw new Error(errorMsg);
      }

      if (tool.resultKind === "plagiarism") {
        set({
          plagiarismResult: data.data as unknown as PlagiarismResult,
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
        });
      } else if (tool.resultKind === "ai-detection") {
        set({
          aiDetectorResult: data.data as unknown as AiDetectionResult,
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
        });
      } else if (tool.resultKind === "grammar") {
        const gResult = data.data as unknown as GrammarCheckResult;
        set({
          grammarResult: gResult,
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
        });
      } else {
        set({
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
        });
      }
      return data.data as Record<string, unknown>;
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
      return null;
    } finally {
      set({ isLoading: false });
    }
  },

  runService: async (request) => {
    await get().runTool(request);
  },

  toggleSourceExclusion: (sourceUrl: string) => {
    const current = get().plagiarismResult;
    if (!current) return;

    const updatedSources = current.sources.map((s) =>
      s.url === sourceUrl ? { ...s, isExcluded: !s.isExcluded } : s,
    );

    const activeSources = updatedSources.filter((s) => !s.isExcluded);
    const activeUrls = new Set(activeSources.map((s) => s.url));

    const activeMatches = current.matches.filter((m) => {
      const src = current.sources[m.sourceIndex];
      return src ? activeUrls.has(src.url) : true;
    });

    const totalWords = Math.max(1, current.wordCount);
    let matchedWords = 0;
    for (const src of activeSources) {
      matchedWords += src.matchedWordCount;
    }
    const overallSimilarity = Math.min(
      100,
      Math.round((matchedWords / totalWords) * 100),
    );

    set({
      plagiarismResult: {
        ...current,
        sources: updatedSources,
        matches: activeMatches,
        scores: {
          ...current.scores,
          overallSimilarity,
          originalScore: Math.max(0, 100 - overallSimilarity),
        },
      },
    });
  },

  clearResult: () =>
    set({
      outputText: "",
      plagiarismResult: null,
      aiDetectorResult: null,
      grammarResult: null,
      error: null,
    }),

  setError: (message) =>
    set({
      outputText: "",
      plagiarismResult: null,
      aiDetectorResult: null,
      grammarResult: null,
      error: message,
    }),
}));

/** @deprecated Prefer useToolStore for new workspace and document integrations. */
export const useWorkspaceStore = useToolStore;
