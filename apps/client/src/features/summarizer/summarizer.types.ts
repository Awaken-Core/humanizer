import type {
  HumanizeTextInput,
  HumanizerIntensityType,
  HumanizerModeType,
  ProcessingMetadata,
} from "@/features/humanizer";

// Every writing service intentionally accepts the same input contract.
export type SummarizeTextInput = HumanizeTextInput;

export interface SummarizeTextResult {
  originalText: string;
  summaryText: string;
  selectedMode: HumanizerModeType;
  selectedIntensity: HumanizerIntensityType;
  processingMetadata: Omit<ProcessingMetadata, "analysis">;
}

export interface SummaryGenerationResult {
  summaryText: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
}
