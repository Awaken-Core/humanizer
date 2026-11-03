import { create } from "zustand";
import { ServiceLabels, type Service } from "@/lib/constants";
import type { PlagiarismResult, PlagiarismSettings } from "@/features/plagiarism/plagiarism.types";
import type { AiDetectionResult } from "@/features/ai-detector/ai-detector.types";
import type { GrammarCheckResult } from "@/features/grammar/grammar.types";

export type WorkspaceMode = "natural" | "academic" | "professional" | "casual";
export type WorkspaceIntensity = "low" | "medium" | "high";
export type ParaphraserTone = "standard" | "formal" | "creative" | "shorten" | "expand";
export type ParaphraserFocus = "vocabulary" | "structure" | "both";

export type WorkspaceServiceRequest =
  | {
      service: "humanizer" | "summarizer";
      text: string;
      mode: WorkspaceMode;
      intensity: WorkspaceIntensity;
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
  | {
      service: "ai-detector";
      text: string;
    }
  | {
      service: "grammar-checker";
      text: string;
    };

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

interface WorkspaceStore {
  outputText: string;
  plagiarismResult: PlagiarismResult | null;
  aiDetectorResult: AiDetectionResult | null;
  grammarResult: GrammarCheckResult | null;
  isLoading: boolean;
  error: string | null;
  runService: (request: WorkspaceServiceRequest) => Promise<void>;
  toggleSourceExclusion: (sourceUrl: string) => void;
  clearResult: () => void;
  setError: (message: string) => void;
}

const SERVICE_ENDPOINTS: Record<WorkspaceServiceRequest["service"], string> = {
  humanizer: "/api/v1/humanize",
  summarizer: "/api/v1/summarize",
  paraphraser: "/api/v1/paraphrase",
  "plagiarism-checker": "/api/v1/plagiarism",
  "ai-detector": "/api/v1/ai-detect",
  "grammar-checker": "/api/v1/grammar",
};

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  outputText: "",
  plagiarismResult: null,
  aiDetectorResult: null,
  grammarResult: null,
  isLoading: false,
  error: null,

  runService: async (request) => {
    if (get().isLoading) return;
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
      const endpoint = SERVICE_ENDPOINTS[service];
      if (!endpoint) {
        throw new Error(`Service "${service}" is not supported yet.`);
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.success || !data.data) {
        const errorMsg =
          typeof data.error === "string"
            ? data.error
            : data.error?.message ||
              `Failed to run ${ServiceLabels[service as Service] || service}.`;
        throw new Error(errorMsg);
      }

      if (service === "plagiarism-checker") {
        set({
          plagiarismResult: data.data as unknown as PlagiarismResult,
          outputText: data.data.summary || "",
        });
      } else if (service === "ai-detector") {
        set({
          aiDetectorResult: data.data as unknown as AiDetectionResult,
          outputText: data.data.summary || "",
        });
      } else if (service === "grammar-checker") {
        const gResult = data.data as unknown as GrammarCheckResult;
        set({
          grammarResult: gResult,
          outputText: gResult.correctedText || "",
        });
      } else {
        const textResult =
          data.data.humanizedText ??
          data.data.summaryText ??
          data.data.paraphrasedText ??
          "";
        set({ outputText: textResult });
      }
    } catch (error) {
      set({
        error:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  toggleSourceExclusion: (sourceUrl: string) => {
    const current = get().plagiarismResult;
    if (!current) return;

    const updatedSources = current.sources.map((s) =>
      s.url === sourceUrl ? { ...s, isExcluded: !s.isExcluded } : s
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
      Math.round((matchedWords / totalWords) * 100)
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
