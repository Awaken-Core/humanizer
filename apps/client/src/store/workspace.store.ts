import { create } from "zustand";
import {
  getToolDefinition,
  getToolOutputText,
  type ParaphraserFocus,
  type ParaphraserTone,
  type ToolId,
  type ToolIntensity,
  type ToolMode,
  type ToolRunRequest,
} from "@/lib/tool-registry";
import type {
  PlagiarismResult,
} from "@/features/plagiarism/plagiarism.types";
import type { AiDetectionResult } from "@/features/ai-detector/ai-detector.types";
import type { GrammarCheckResult } from "@/features/grammar/grammar.types";
import { AiDetectionResultDto } from "@/features/ai-detector/ai-detector.dto";
import { GrammarCheckResultDto } from "@/features/grammar/grammar.dto";
import { PlagiarismResultDto } from "@/features/plagiarism/plagiarism.dto";
import {
  normalizeClientError,
  ToolApiResponseDto,
  type NormalizedClientError,
} from "@/lib/api.dto";

export type WorkspaceMode = ToolMode;
export type WorkspaceIntensity = ToolIntensity;
export type { ParaphraserFocus, ParaphraserTone };
export type WorkspaceServiceRequest = ToolRunRequest;

const TOOL_CLIENT_TIMEOUTS_MS: Record<ToolId, number> = {
  humanizer: 48_000,
  paraphraser: 32_000,
  summarizer: 32_000,
  "plagiarism-checker": 55_000,
  "grammar-checker": 28_000,
  "ai-detector": 12_000,
};

interface ToolStore {
  inputText: string;
  setInputText: (text: string) => void;
  outputText: string;
  plagiarismResult: PlagiarismResult | null;
  aiDetectorResult: AiDetectionResult | null;
  grammarResult: GrammarCheckResult | null;
  isLoading: boolean;
  error: string | null;
  errorDetail: NormalizedClientError | null;
  activeAbortController: AbortController | null;
  cancelActiveRequest: () => void;
  runTool: (
    request: WorkspaceServiceRequest,
  ) => Promise<Record<string, unknown> | null>;
  /** @deprecated Use runTool. */
  runService: (request: WorkspaceServiceRequest) => Promise<void>;
  toggleSourceExclusion: (sourceUrl: string) => void;
  clearResult: () => void;
  setError: (error: string | NormalizedClientError | null) => void;
}

export const useToolStore = create<ToolStore>((set, get) => ({
  inputText: "",
  setInputText: (inputText: string) => set({ inputText }),
  outputText: "",
  plagiarismResult: null,
  aiDetectorResult: null,
  grammarResult: null,
  isLoading: false,
  error: null,
  errorDetail: null,
  activeAbortController: null,

  cancelActiveRequest: () => {
    const active = get().activeAbortController;
    if (active) {
      active.abort();
      set({ activeAbortController: null, isLoading: false });
    }
  },

  runTool: async (request) => {
    // 1. Abort any previous in-flight request to prevent race conditions
    const previousController = get().activeAbortController;
    if (previousController) {
      previousController.abort();
    }

    const abortController = new AbortController();
    const toolTimeout = TOOL_CLIENT_TIMEOUTS_MS[request.service] ?? 30_000;
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, toolTimeout);

    // 2. Set loading state WITHOUT clearing previous results (preserves user state on error)
    set({
      isLoading: true,
      error: null,
      errorDetail: null,
      activeAbortController: abortController,
    });

    try {
      const { service, documentId, inputSource, ...payload } = request;
      const tool = getToolDefinition(service);

      const response = await fetch(tool.endpoint, {
        method: "POST",
        signal: abortController.signal,
        headers: {
          "Content-Type": "application/json",
          ...(documentId ? { "X-Document-Id": documentId } : {}),
          ...(inputSource ? { "X-Tool-Input-Source": inputSource } : {}),
        },
        body: JSON.stringify(payload),
      });

      let jsonPayload: unknown;
      try {
        jsonPayload = await response.json();
      } catch {
        throw new Error("Unable to parse server response.");
      }

      const parsedResponse = ToolApiResponseDto.safeParse(jsonPayload);
      const data = parsedResponse.success ? parsedResponse.data : null;

      if (!response.ok || !data?.success || !data.data) {
        const normalized = normalizeClientError(
          data?.error || (jsonPayload as Record<string, unknown>)?.error,
          `Failed to run ${tool.label}.`
        );
        set({
          error: normalized.message,
          errorDetail: normalized,
        });
        return null;
      }

      // Success: populate new results cleanly
      if (tool.resultKind === "plagiarism") {
        const result = PlagiarismResultDto.parse(data.data);
        set({
          plagiarismResult: result,
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
          error: null,
          errorDetail: null,
        });
      } else if (tool.resultKind === "ai-detection") {
        const result = AiDetectionResultDto.parse(data.data);
        set({
          aiDetectorResult: result,
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
          error: null,
          errorDetail: null,
        });
      } else if (tool.resultKind === "grammar") {
        const gResult = GrammarCheckResultDto.parse(data.data);
        set({
          grammarResult: gResult,
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
          error: null,
          errorDetail: null,
        });
      } else {
        set({
          outputText: getToolOutputText(
            tool,
            data.data as Record<string, unknown>,
          ),
          error: null,
          errorDetail: null,
        });
      }
      return data.data as Record<string, unknown>;
    } catch (error) {
      // Don't show errors if request was aborted due to superseding request
      if (error instanceof DOMException && error.name === "AbortError") {
        // If superseded by a newer request, activeAbortController will differ
        if (get().activeAbortController !== abortController) {
          return null;
        }
      }

      const normalized = normalizeClientError(error);
      set({
        error: normalized.message,
        errorDetail: normalized,
      });
      return null;
    } finally {
      clearTimeout(timeoutId);
      if (get().activeAbortController === abortController) {
        set({ isLoading: false, activeAbortController: null });
      }
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
      errorDetail: null,
    }),

  setError: (err) => {
    if (!err) {
      set({ error: null, errorDetail: null });
      return;
    }
    const normalized = typeof err === "string" ? normalizeClientError(err) : err;
    set({
      error: normalized.message,
      errorDetail: normalized,
    });
  },
}));

/** @deprecated Prefer useToolStore for new workspace and document integrations. */
export const useWorkspaceStore = useToolStore;
