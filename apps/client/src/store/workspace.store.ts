import { create } from "zustand";
import { ServiceLabels } from "@/lib/constants";

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
    };

interface ApiResponse {
  success?: boolean;
  data?: {
    humanizedText?: string;
    summaryText?: string;
    paraphrasedText?: string;
  };
  error?: { message?: string };
}

interface WorkspaceStore {
  outputText: string;
  isLoading: boolean;
  error: string | null;
  runService: (request: WorkspaceServiceRequest) => Promise<void>;
  clearResult: () => void;
  setError: (message: string) => void;
}

const SERVICE_ENDPOINTS: Record<WorkspaceServiceRequest["service"], string> = {
  humanizer: "/api/v1/humanize",
  summarizer: "/api/v1/summarize",
  paraphraser: "/api/v1/paraphrase",
};

function readResult(data: ApiResponse["data"]): string | undefined {
  return data?.humanizedText ?? data?.summaryText ?? data?.paraphrasedText;
}

export const useWorkspaceStore = create<WorkspaceStore>((set, get) => ({
  outputText: "",
  isLoading: false,
  error: null,

  runService: async (request) => {
    if (get().isLoading) return;
    set({ isLoading: true, error: null });

    try {
      const { service, ...payload } = request;
      const response = await fetch(SERVICE_ENDPOINTS[service], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ApiResponse;
      const result = readResult(data.data);

      if (!response.ok || !data.success || !result) {
        throw new Error(
          data.error?.message || `Failed to run ${ServiceLabels[service].toLowerCase()}.`
        );
      }

      set({ outputText: result });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      });
    } finally {
      set({ isLoading: false });
    }
  },

  clearResult: () => set({ outputText: "", error: null }),
  setError: (message) => set({ outputText: "", error: message }),
}));
