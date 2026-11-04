import type { LucideIcon } from "lucide-react";
import {
  Bot,
  FileSearch,
  ListCollapse,
  Repeat2,
  ShieldCheck,
  SpellCheck2,
} from "lucide-react";
import type { ToolId } from "@/lib/tool-registry";

export const DOCUMENT_TOOL_ICONS: Record<ToolId, LucideIcon> = {
  humanizer: Bot,
  "plagiarism-checker": ShieldCheck,
  "ai-detector": FileSearch,
  paraphraser: Repeat2,
  summarizer: ListCollapse,
  "grammar-checker": SpellCheck2,
};
