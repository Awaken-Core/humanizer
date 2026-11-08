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
import type { PlagiarismResult } from "@/features/plagiarism/plagiarism.types";
import type { AiDetectionResult } from "@/features/ai-detector/ai-detector.types";
import type { GrammarCheckResult } from "@/features/grammar/grammar.types";
import type { DocxParseResult } from "@/lib/parser/docx-parser";
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

export interface UploadedFileState {
  name: string;
  format: "docx" | "latex" | "markdown" | "txt" | "zip";
  docxResult?: DocxParseResult;
  latexPlaceholders?: Map<string, string>;
  markdownPlaceholders?: Map<string, string>;
  zipData?: any;
}

export interface ToolPreferences {
  mode?: ToolMode;
  intensity?: ToolIntensity;
  tone?: ParaphraserTone;
  focus?: ParaphraserFocus;
  excludeQuotes?: boolean;
  excludeBibliography?: boolean;
  excludeSmallMatches?: boolean;
}

export interface ToolResultState {
  outputText: string;
  plagiarismResult: PlagiarismResult | null;
  aiDetectorResult: AiDetectionResult | null;
  grammarResult: GrammarCheckResult | null;
  error: string | null;
  errorDetail: NormalizedClientError | null;
}

/**
 * Client execution deadlines derived from server maxDuration plus network/serialization buffer:
 * - humanizer: 60s server maxDuration (two sequential DeepSeek calls up to 30s each) -> 65s client deadline
 * - plagiarism-checker: 60s server maxDuration (fingerprinting + multi-source retrieval + synthesis) -> 65s
 * - grammar-checker: 45s server maxDuration (DeepSeek + rule-based fallback verification) -> 50s
 * - paraphraser: 45s server maxDuration (25s DeepSeek budget + parsing) -> 50s
 * - summarizer: 45s server maxDuration (25s DeepSeek budget + chunking) -> 50s
 * - ai-detector: 15s server maxDuration (local heuristics) -> 18s
 */
export const TOOL_CLIENT_TIMEOUTS_MS: Record<ToolId, number> = {
  humanizer: 65_000,
  "plagiarism-checker": 65_000,
  "grammar-checker": 50_000,
  paraphraser: 50_000,
  summarizer: 50_000,
  "ai-detector": 18_000,
};

export const DEFAULT_TOOL_PREFERENCES: Record<ToolId, ToolPreferences> = {
  humanizer: { mode: "natural", intensity: "medium" },
  paraphraser: { tone: "standard", focus: "both" },
  summarizer: { mode: "academic", intensity: "medium" },
  "plagiarism-checker": {
    excludeQuotes: true,
    excludeBibliography: true,
    excludeSmallMatches: true,
  },
  "ai-detector": {},
  "grammar-checker": {},
};

const createEmptyResult = (): ToolResultState => ({
  outputText: "",
  plagiarismResult: null,
  aiDetectorResult: null,
  grammarResult: null,
  error: null,
  errorDetail: null,
});

const createInitialResults = (): Record<ToolId, ToolResultState> => ({
  humanizer: createEmptyResult(),
  "plagiarism-checker": createEmptyResult(),
  "ai-detector": createEmptyResult(),
  paraphraser: createEmptyResult(),
  summarizer: createEmptyResult(),
  "grammar-checker": createEmptyResult(),
});

interface ToolStore {
  // Input text (shared across writing tools)
  inputText: string;
  setInputText: (text: string) => void;

  // Uploaded document with reconstruction metadata (preserved across navigation)
  uploadedDocument: UploadedFileState | null;
  setUploadedDocument: (doc: UploadedFileState | null) => void;

  // Active Tool identification & switching
  activeTool: ToolId;
  setActiveTool: (tool: ToolId) => void;

  // Isolated per-tool results
  toolResults: Record<ToolId, ToolResultState>;
  getToolResult: (tool: ToolId) => ToolResultState;

  // Isolated per-tool preferences
  toolPreferences: Record<ToolId, ToolPreferences>;
  setToolPreference: <K extends keyof ToolPreferences>(
    tool: ToolId,
    key: K,
    value: ToolPreferences[K],
  ) => void;

  // Active generation tracking to prevent race conditions
  toolGenerations: Record<ToolId, number>;
  activeControllers: Partial<Record<ToolId, AbortController>>;
  activeToolLoading: Partial<Record<ToolId, boolean>>;

  // Backward-compatible top-level mirrors (reflect activeTool)
  outputText: string;
  plagiarismResult: PlagiarismResult | null;
  aiDetectorResult: AiDetectionResult | null;
  grammarResult: GrammarCheckResult | null;
  isLoading: boolean;
  error: string | null;
  errorDetail: NormalizedClientError | null;
  activeAbortController: AbortController | null;

  cancelActiveRequest: (tool?: ToolId) => void;
  runTool: (
    request: WorkspaceServiceRequest,
  ) => Promise<Record<string, unknown> | null>;
  /** @deprecated Use runTool. */
  runService: (request: WorkspaceServiceRequest) => Promise<void>;
  toggleSourceExclusion: (sourceUrl: string) => void;
  clearResult: (tool?: ToolId) => void;
  setError: (error: string | NormalizedClientError | null, tool?: ToolId) => void;
}

export const useToolStore = create<ToolStore>((set, get) => ({
  inputText: "",
  setInputText: (inputText: string) => set({ inputText }),

  uploadedDocument: null,
  setUploadedDocument: (uploadedDocument: UploadedFileState | null) =>
    set({ uploadedDocument }),

  activeTool: "humanizer",
  setActiveTool: (activeTool: ToolId) => {
    const state = get();
    const result = state.toolResults[activeTool] ?? createEmptyResult();
    set({
      activeTool,
      outputText: result.outputText,
      plagiarismResult: result.plagiarismResult,
      aiDetectorResult: result.aiDetectorResult,
      grammarResult: result.grammarResult,
      error: result.error,
      errorDetail: result.errorDetail,
      isLoading: Boolean(state.activeToolLoading[activeTool]),
      activeAbortController: state.activeControllers[activeTool] ?? null,
    });
  },

  toolResults: createInitialResults(),
  getToolResult: (tool: ToolId) => {
    return get().toolResults[tool] ?? createEmptyResult();
  },

  toolPreferences: { ...DEFAULT_TOOL_PREFERENCES },
  setToolPreference: (tool, key, value) => {
    set((state) => ({
      toolPreferences: {
        ...state.toolPreferences,
        [tool]: {
          ...state.toolPreferences[tool],
          [key]: value,
        },
      },
    }));
  },

  toolGenerations: {
    humanizer: 0,
    "plagiarism-checker": 0,
    "ai-detector": 0,
    paraphraser: 0,
    summarizer: 0,
    "grammar-checker": 0,
  },
  activeControllers: {},
  activeToolLoading: {},

  outputText: "",
  plagiarismResult: null,
  aiDetectorResult: null,
  grammarResult: null,
  isLoading: false,
  error: null,
  errorDetail: null,
  activeAbortController: null,

  cancelActiveRequest: (tool?: ToolId) => {
    const targetTool = tool ?? get().activeTool;
    const active = get().activeControllers[targetTool];
    if (active) {
      active.abort();
      set((state) => {
        const nextControllers = { ...state.activeControllers };
        delete nextControllers[targetTool];
        const nextLoading = { ...state.activeToolLoading, [targetTool]: false };
        const isCurrentActive = state.activeTool === targetTool;

        return {
          activeControllers: nextControllers,
          activeToolLoading: nextLoading,
          ...(isCurrentActive
            ? { activeAbortController: null, isLoading: false }
            : {}),
        };
      });
    }
  },

  runTool: async (request) => {
    const service = request.service;
    const previousController = get().activeControllers[service];
    if (previousController) {
      previousController.abort();
    }

    const abortController = new AbortController();
    const toolTimeout = TOOL_CLIENT_TIMEOUTS_MS[service] ?? 50_000;
    const timeoutId = setTimeout(() => {
      abortController.abort();
    }, toolTimeout);

    const nextGeneration = (get().toolGenerations[service] ?? 0) + 1;

    set((state) => {
      const nextGenerations = { ...state.toolGenerations, [service]: nextGeneration };
      const nextControllers = { ...state.activeControllers, [service]: abortController };
      const nextLoading = { ...state.activeToolLoading, [service]: true };

      // Clear previous error for this tool while keeping previous result
      const currentResult = state.toolResults[service] ?? createEmptyResult();
      const updatedToolResult: ToolResultState = {
        ...currentResult,
        error: null,
        errorDetail: null,
      };

      const isCurrentActive = state.activeTool === service;

      return {
        toolGenerations: nextGenerations,
        activeControllers: nextControllers,
        activeToolLoading: nextLoading,
        toolResults: {
          ...state.toolResults,
          [service]: updatedToolResult,
        },
        ...(isCurrentActive
          ? {
              isLoading: true,
              error: null,
              errorDetail: null,
              activeAbortController: abortController,
            }
          : {}),
      };
    });

    try {
      const { service: reqService, documentId, inputSource, ...payload } = request;
      const tool = getToolDefinition(reqService);

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

      // Check if this request was superseded by a newer request for this tool
      if (get().toolGenerations[service] !== nextGeneration) {
        return null;
      }

      const parsedResponse = ToolApiResponseDto.safeParse(jsonPayload);
      const data = parsedResponse.success ? parsedResponse.data : null;

      if (!response.ok || !data?.success || !data.data) {
        const normalized = normalizeClientError(
          data?.error || (jsonPayload as Record<string, unknown>)?.error,
          `Failed to run ${tool.label}.`,
        );

        set((state) => {
          if (state.toolGenerations[service] !== nextGeneration) return {};
          const cur = state.toolResults[service] ?? createEmptyResult();
          const nextResult: ToolResultState = {
            ...cur,
            error: normalized.message,
            errorDetail: normalized,
          };
          const isCurrentActive = state.activeTool === service;

          return {
            toolResults: { ...state.toolResults, [service]: nextResult },
            ...(isCurrentActive
              ? { error: normalized.message, errorDetail: normalized }
              : {}),
          };
        });
        return null;
      }

      // Format output according to tool resultKind
      let outputText = "";
      let plagiarismResult: PlagiarismResult | null = null;
      let aiDetectorResult: AiDetectionResult | null = null;
      let grammarResult: GrammarCheckResult | null = null;

      if (tool.resultKind === "plagiarism") {
        plagiarismResult = PlagiarismResultDto.parse(data.data);
        outputText = getToolOutputText(tool, data.data as Record<string, unknown>);
      } else if (tool.resultKind === "ai-detection") {
        aiDetectorResult = AiDetectionResultDto.parse(data.data);
        outputText = getToolOutputText(tool, data.data as Record<string, unknown>);
      } else if (tool.resultKind === "grammar") {
        grammarResult = GrammarCheckResultDto.parse(data.data);
        outputText = getToolOutputText(tool, data.data as Record<string, unknown>);
      } else {
        outputText = getToolOutputText(tool, data.data as Record<string, unknown>);
      }

      const successfulResult: ToolResultState = {
        outputText,
        plagiarismResult,
        aiDetectorResult,
        grammarResult,
        error: null,
        errorDetail: null,
      };

      set((state) => {
        if (state.toolGenerations[service] !== nextGeneration) return {};
        const isCurrentActive = state.activeTool === service;

        return {
          toolResults: {
            ...state.toolResults,
            [service]: successfulResult,
          },
          ...(isCurrentActive
            ? {
                outputText: successfulResult.outputText,
                plagiarismResult: successfulResult.plagiarismResult,
                aiDetectorResult: successfulResult.aiDetectorResult,
                grammarResult: successfulResult.grammarResult,
                error: null,
                errorDetail: null,
              }
            : {}),
        };
      });

      return data.data as Record<string, unknown>;
    } catch (error) {
      if (get().toolGenerations[service] !== nextGeneration) {
        return null;
      }

      if (error instanceof DOMException && error.name === "AbortError") {
        // If superseded by a newer request, active controller will differ
        if (get().activeControllers[service] !== abortController) {
          return null;
        }
      }

      const normalized = normalizeClientError(error);

      set((state) => {
        if (state.toolGenerations[service] !== nextGeneration) return {};
        const cur = state.toolResults[service] ?? createEmptyResult();
        const nextResult: ToolResultState = {
          ...cur,
          error: normalized.message,
          errorDetail: normalized,
        };
        const isCurrentActive = state.activeTool === service;

        return {
          toolResults: { ...state.toolResults, [service]: nextResult },
          ...(isCurrentActive
            ? { error: normalized.message, errorDetail: normalized }
            : {}),
        };
      });
      return null;
    } finally {
      clearTimeout(timeoutId);
      set((state) => {
        if (state.toolGenerations[service] !== nextGeneration) return {};
        const nextControllers = { ...state.activeControllers };
        if (nextControllers[service] === abortController) {
          delete nextControllers[service];
        }
        const nextLoading = { ...state.activeToolLoading, [service]: false };
        const isCurrentActive = state.activeTool === service;

        return {
          activeControllers: nextControllers,
          activeToolLoading: nextLoading,
          ...(isCurrentActive
            ? {
                isLoading: false,
                activeAbortController: null,
              }
            : {}),
        };
      });
    }
  },

  runService: async (request) => {
    await get().runTool(request);
  },

  toggleSourceExclusion: (sourceUrl: string) => {
    const current =
      get().toolResults["plagiarism-checker"]?.plagiarismResult ??
      get().plagiarismResult;
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

    const updatedResult: PlagiarismResult = {
      ...current,
      sources: updatedSources,
      matches: activeMatches,
      scores: {
        ...current.scores,
        overallSimilarity,
        originalScore: Math.max(0, 100 - overallSimilarity),
      },
    };

    set((state) => {
      const cur = state.toolResults["plagiarism-checker"] ?? createEmptyResult();
      const nextToolResult: ToolResultState = {
        ...cur,
        plagiarismResult: updatedResult,
      };

      const isCurrentActive = state.activeTool === "plagiarism-checker";

      return {
        toolResults: {
          ...state.toolResults,
          "plagiarism-checker": nextToolResult,
        },
        ...(isCurrentActive ? { plagiarismResult: updatedResult } : {}),
      };
    });
  },

  clearResult: (tool?: ToolId) => {
    const targetTool = tool ?? get().activeTool;
    const empty = createEmptyResult();

    set((state) => {
      const isCurrentActive = state.activeTool === targetTool;
      return {
        toolResults: {
          ...state.toolResults,
          [targetTool]: empty,
        },
        ...(isCurrentActive
          ? {
              outputText: "",
              plagiarismResult: null,
              aiDetectorResult: null,
              grammarResult: null,
              error: null,
              errorDetail: null,
            }
          : {}),
      };
    });
  },

  setError: (err, tool?: ToolId) => {
    const targetTool = tool ?? get().activeTool;
    if (!err) {
      set((state) => {
        const cur = state.toolResults[targetTool] ?? createEmptyResult();
        const next = { ...cur, error: null, errorDetail: null };
        const isCurrentActive = state.activeTool === targetTool;
        return {
          toolResults: { ...state.toolResults, [targetTool]: next },
          ...(isCurrentActive ? { error: null, errorDetail: null } : {}),
        };
      });
      return;
    }

    const normalized = typeof err === "string" ? normalizeClientError(err) : err;
    set((state) => {
      const cur = state.toolResults[targetTool] ?? createEmptyResult();
      const next = {
        ...cur,
        error: normalized.message,
        errorDetail: normalized,
      };
      const isCurrentActive = state.activeTool === targetTool;
      return {
        toolResults: { ...state.toolResults, [targetTool]: next },
        ...(isCurrentActive
          ? { error: normalized.message, errorDetail: normalized }
          : {}),
      };
    });
  },
}));

/** @deprecated Prefer useToolStore for new workspace and document integrations. */
export const useWorkspaceStore = useToolStore;
