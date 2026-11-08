"use client";

import React, { useState, useRef, useEffect } from "react";
import { HumanizeButton } from "@/components/ui/humanize-button";
import { useSession } from "@/lib/auth-client";
import {
  useToolStore,
  type ParaphraserFocus,
  type ParaphraserTone,
  type ToolPreferences,
  type UploadedFileState,
  type WorkspaceIntensity,
  type WorkspaceMode,
  type WorkspaceServiceRequest,
} from "@/store/workspace.store";
import { toast } from "sonner";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer/humanizer.schema";
import { PlagiarismView } from "@/components/workspace/plagiarism-view";
import { AiDetectorView } from "@/components/workspace/ai-detector-view";
import { GrammarView } from "@/components/workspace/grammar-view";
import { ToolErrorBanner } from "@/components/ui/tool-error-banner";
import { ToolErrorBoundary } from "@/components/ui/tool-error-boundary";
import { getToolDefinition, type ToolId } from "@/lib/tool-registry";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  SlidersHorizontal,
  Wand2,
  ShieldAlert,
  Bot,
  Filter,
  CheckCircle2,
  Upload,
  Download,
  FileText,
  Shield,
  FileCode,
  BookOpen,
  X,
  FileArchive,
} from "lucide-react";
import {
  parseDocx,
  reconstructDocx,
  maskLatex,
  unmaskLatex,
  maskMarkdown,
  unmaskMarkdown,
  unpackBatchZip,
  type DocxParseResult,
} from "@/lib/parser";
import {
  shieldCitations,
  type CitationStyle,
  type AcademicDiscipline,
} from "@/features/humanizer/citation-shield";
import styles from "@/components/workspace/workspace.module.css";

type ModeType = WorkspaceMode;
type IntensityType = WorkspaceIntensity;
type ToneType = ParaphraserTone;
type FocusType = ParaphraserFocus;

interface ServiceSample {
  label: string;
  text: string;
  tone?: ToneType;
  focus?: FocusType;
  mode?: ModeType;
  intensity?: IntensityType;
}

const SERVICE_SAMPLES: Record<ToolId, ServiceSample[]> = {
  humanizer: [
    {
      label: "AI Essay Draft",
      text: "In the contemporary digital landscape, the rapid proliferation of artificial intelligence technologies has undeniably transformed traditional pedagogical paradigms. It is crucial to recognize that educators must adapt to ensure optimal educational outcomes.",
      mode: "natural",
      intensity: "medium",
    },
    {
      label: "Corporate Jargon",
      text: "We must synergize our core competencies to operationalize end-to-end deliverables and facilitate robust stakeholder alignment across multidisciplinary verticals.",
      mode: "professional",
      intensity: "high",
    },
  ],
  "plagiarism-checker": [
    {
      label: "Academic Article",
      text: "Renewable energy adoption has accelerated significantly across global markets over the past decade. Driven by steep declines in solar photovoltaic manufacturing costs and technological breakthroughs in grid-scale battery storage, solar and wind power now represent the most economically viable source of new electricity generation in over two-thirds of the world.",
    },
    {
      label: "Quoted Excerpt",
      text: 'According to research published by the International Energy Agency, "Global investment in clean energy is on course to rise to 1.8 trillion USD in 2023, with solar leading the way." However, transmission grid modernizations remain critical to unlock full capacity.',
    },
  ],
  "ai-detector": [
    {
      label: "AI Generated Essay",
      text: "In the contemporary digital landscape, the rapid proliferation of artificial intelligence technologies has undeniably transformed traditional pedagogical paradigms. It is crucial to recognize that educators must adapt to ensure optimal educational outcomes. Furthermore, it is worth noting that students leverage these cutting-edge tools to facilitate learning. In conclusion, a comprehensive and holistic framework is essential.",
    },
    {
      label: "Human Casual Note",
      text: "Hey! We finally deployed the update late last night after tracking down a nasty race condition in the cache layer. Honestly didn't expect it to take four hours, but the coffee machine kept us going. Check it out when you wake up and let me know if anything looks off.",
    },
  ],
  "grammar-checker": [
    {
      label: "Agreement & Spacing",
      text: "Each of the participants have their own perspective on the issue ,and they was unable to reach a unanimous decision .",
    },
    {
      label: "Spelling & Repetition",
      text: "Its undeniable that the the company's financial performence in Q3 exceeded expectations, however there is still risks ahead.",
    },
  ],
  paraphraser: [
    {
      label: "Casual Memo",
      text: "Hey team, just wanted to let you know that our website crashed yesterday because too many people were trying to buy tickets all at once. We're putting in more servers so this doesn't happen next time.",
      tone: "formal",
      focus: "both",
    },
    {
      label: "Wordy Notice",
      text: "Due to the fact that inclement weather conditions have been forecasted by meteorological agencies, it is strongly recommended that all employees work from their personal residences tomorrow.",
      tone: "shorten",
      focus: "structure",
    },
  ],
  summarizer: [
    {
      label: "Research Article",
      text: "Renewable energy adoption has accelerated significantly across global markets over the past decade. Driven by steep declines in solar photovoltaic manufacturing costs and technological breakthroughs in grid-scale battery storage, solar and wind power now represent the most economically viable source of new electricity generation in over two-thirds of the world. However, transmission bottlenecks, supply-chain delays, and lengthy regulatory approvals continue to pose serious challenges to rapid infrastructure deployment, prompting calls for coordinated cross-border grid modernization.",
      mode: "academic",
      intensity: "medium",
    },
  ],
};

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface WorkspaceEditorProps {
  service: ToolId;
}

export function WorkspaceEditor({ service }: WorkspaceEditorProps) {
  const { data: session } = useSession();
  const inputText = useToolStore((state) => state.inputText);
  const setInputText = useToolStore((state) => state.setInputText);
  const toggleSourceExclusion = useToolStore(
    (state) => state.toggleSourceExclusion,
  );
  const runTool = useToolStore((state) => state.runTool);
  const clearResult = useToolStore((state) => state.clearResult);
  const setStoreError = useToolStore((state) => state.setError);
  const setActiveTool = useToolStore((state) => state.setActiveTool);

  // Per-tool isolated results
  const toolResult = useToolStore((state) => state.toolResults[service]);
  const outputText = toolResult?.outputText ?? "";
  const plagiarismResult = toolResult?.plagiarismResult ?? null;
  const aiDetectorResult = toolResult?.aiDetectorResult ?? null;
  const grammarResult = toolResult?.grammarResult ?? null;
  const error = toolResult?.error ?? null;
  const errorDetail = toolResult?.errorDetail ?? null;
  const isLoading = Boolean(useToolStore((state) => state.activeToolLoading[service]));

  // Per-tool isolated preferences
  const toolPreferences = useToolStore((state) => state.toolPreferences[service]) || {};
  const setToolPreference = useToolStore((state) => state.setToolPreference);

  const mode: ModeType = (toolPreferences.mode as ModeType) ?? "natural";
  const intensity: IntensityType = (toolPreferences.intensity as IntensityType) ?? "medium";
  const tone: ToneType = (toolPreferences.tone as ToneType) ?? "standard";
  const focus: FocusType = (toolPreferences.focus as FocusType) ?? "both";
  const excludeQuotes = toolPreferences.excludeQuotes ?? true;
  const excludeBibliography = toolPreferences.excludeBibliography ?? true;
  const excludeSmallMatches = toolPreferences.excludeSmallMatches ?? true;

  const setMode = (val: ModeType) => setToolPreference(service, "mode", val);
  const setIntensity = (val: IntensityType) => setToolPreference(service, "intensity", val);
  const setTone = (val: ToneType) => setToolPreference(service, "tone", val);
  const setFocus = (val: FocusType) => setToolPreference(service, "focus", val);
  const setExcludeQuotes = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === "function" ? val(excludeQuotes) : val;
    setToolPreference(service, "excludeQuotes", next);
  };
  const setExcludeBibliography = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === "function" ? val(excludeBibliography) : val;
    setToolPreference(service, "excludeBibliography", next);
  };
  const setExcludeSmallMatches = (val: boolean | ((prev: boolean) => boolean)) => {
    const next = typeof val === "function" ? val(excludeSmallMatches) : val;
    setToolPreference(service, "excludeSmallMatches", next);
  };

  const [copied, setCopied] = useState(false);

  // File Upload & AST State (stored in shared Zustand store so it survives cross-tool navigation)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadedFile = useToolStore((state) => state.uploadedDocument);
  const setUploadedFile = useToolStore((state) => state.setUploadedDocument);
  const [isFileParsing, setIsFileParsing] = useState(false);

  // Citation Shield State
  const [isCitationShieldOpen, setIsCitationShieldOpen] = useState(false);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("latex");
  const [citationDiscipline, setCitationDiscipline] =
    useState<AcademicDiscipline>("computer-science");
  const [bibtexPackage, setBibtexPackage] = useState<string | null>(null);
  const [shieldSuccessMessage, setShieldSuccessMessage] = useState<
    string | null
  >(null);

  // Synchronize active tool on navigation without wiping results
  useEffect(() => {
    setIsCitationShieldOpen(false);
    setShieldSuccessMessage(null);
    setActiveTool(service);
  }, [service, setActiveTool]);

  const characterCount = inputText.length;

  const maxInputLength = session?.user
    ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
    : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;

  const exceedsInputLimit = characterCount > maxInputLength;
  const currentSamples = SERVICE_SAMPLES[service] || [];
  const selectedTool = getToolDefinition(service);

  const handleApplySample = (sample: ServiceSample) => {
    setInputText(sample.text);
    if (sample.tone) setTone(sample.tone);
    if (sample.focus) setFocus(sample.focus);
    if (sample.mode) setMode(sample.mode);
    if (sample.intensity) setIntensity(sample.intensity);
    setUploadedFile(null);
    clearResult();
  };

  const executeTool = async (request: WorkspaceServiceRequest) => {
    const result = await runTool(request);
    if (result) {
      toast.success(`${selectedTool.label} completed`);
    }
  };

  const handleAction = async () => {
    if (!inputText.trim() || isLoading || exceedsInputLimit) return;

    if (service === "plagiarism-checker") {
      await executeTool({
        service: "plagiarism-checker",
        text: inputText,
        settings: {
          excludeQuotes,
          excludeBibliography,
          excludeSmallMatches,
        },
      });
      return;
    }

    if (service === "ai-detector") {
      if (inputText.trim().length < 50) {
        setStoreError(
          "Please provide at least 50 characters for accurate AI detection.",
        );
        toast.error(
          "Please provide at least 50 characters for accurate AI detection.",
        );
        return;
      }
      await executeTool({
        service: "ai-detector",
        text: inputText,
      });
      return;
    }

    if (service === "grammar-checker") {
      await executeTool({
        service: "grammar-checker",
        text: inputText,
      });
      return;
    }

    if (service === "paraphraser") {
      await executeTool({
        service,
        text: inputText,
        tone,
        focus,
      });
      return;
    }

    if (service === "humanizer" || service === "summarizer") {
      await executeTool({
        service,
        text: inputText,
        mode,
        intensity,
      });
      return;
    }

    setStoreError(
      `${selectedTool.label} is currently under active development.`,
    );
    toast.info(`${selectedTool.label} is currently under active development.`);
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      toast.success("Output copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy output");
    }
  };

  const handleReset = () => {
    setInputText("");
    setUploadedFile(null);
    setBibtexPackage(null);
    setShieldSuccessMessage(null);
    clearResult();
  };

  // File Upload Handler (.docx, .tex, .md, .txt, .zip)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFileParsing(true);
    setStoreError("");

    try {
      const lowerName = file.name.toLowerCase();

      if (lowerName.endsWith(".docx")) {
        const buffer = await file.arrayBuffer();
        const docxResult = await parseDocx(buffer);
        setUploadedFile({
          name: file.name,
          format: "docx",
          docxResult,
        });
        setInputText(docxResult.prose);
        clearResult();
      } else if (lowerName.endsWith(".tex") || lowerName.endsWith(".latex")) {
        const text = await file.text();
        const { maskedText, placeholders } = maskLatex(text);
        setUploadedFile({
          name: file.name,
          format: "latex",
          latexPlaceholders: placeholders,
        });
        setInputText(maskedText);
        clearResult();
      } else if (lowerName.endsWith(".md") || lowerName.endsWith(".markdown")) {
        const text = await file.text();
        const { maskedText, placeholders } = maskMarkdown(text);
        setUploadedFile({
          name: file.name,
          format: "markdown",
          markdownPlaceholders: placeholders,
        });
        setInputText(maskedText);
        clearResult();
      } else if (lowerName.endsWith(".zip")) {
        const buffer = await file.arrayBuffer();
        const zipResult = await unpackBatchZip(buffer);
        if (zipResult.entries.length === 0) {
          throw new Error(
            "No supported documents (.docx, .tex, .md, .txt) found inside ZIP.",
          );
        }
        setUploadedFile({
          name: file.name,
          format: "zip",
          zipData: zipResult,
        });
        setInputText(zipResult.entries[0]!.extractedProse);
        clearResult();
      } else if (lowerName.endsWith(".txt")) {
        const text = await file.text();
        setUploadedFile({
          name: file.name,
          format: "txt",
        });
        setInputText(text);
        clearResult();
      } else {
        throw new Error(
          "Unsupported format. Please upload .docx, .tex, .md, .txt, or .zip.",
        );
      }
      toast.success(`${file.name} loaded`);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to parse uploaded document.";
      setStoreError(message);
      toast.error(message);
    } finally {
      setIsFileParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Reconstructed Export / Download Handler
  const handleExportReconstructed = async () => {
    if (!outputText) return;

    try {
      if (uploadedFile?.format === "docx" && uploadedFile.docxResult) {
        const paragraphs = outputText
          .split(/\n\s*\n/)
          .filter((p) => p.trim().length > 0);
        const docxBytes = await reconstructDocx(
          uploadedFile.docxResult.zip,
          paragraphs,
        );
        triggerDownload(
          new Blob([docxBytes as any], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          `Humanized_${uploadedFile.name}`,
        );
      } else if (
        uploadedFile?.format === "latex" &&
        uploadedFile.latexPlaceholders
      ) {
        const restoredTex = unmaskLatex(
          outputText,
          uploadedFile.latexPlaceholders,
        );
        triggerDownload(
          new Blob([restoredTex], { type: "text/x-tex" }),
          `Humanized_${uploadedFile.name}`,
        );
      } else if (
        uploadedFile?.format === "markdown" &&
        uploadedFile.markdownPlaceholders
      ) {
        const restoredMd = unmaskMarkdown(
          outputText,
          uploadedFile.markdownPlaceholders,
        );
        triggerDownload(
          new Blob([restoredMd], { type: "text/markdown" }),
          `Humanized_${uploadedFile.name}`,
        );
      } else {
        const outName = uploadedFile
          ? `Humanized_${uploadedFile.name}.txt`
          : "Humanized_Document.txt";
        triggerDownload(
          new Blob([outputText], { type: "text/plain" }),
          outName,
        );
      }
      toast.success("Document downloaded");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to reconstruct and export document.";
      setStoreError(message);
      toast.error(message);
    }
  };

  // Citation Shielding Execution Handler
  const handleApplyCitationShield = () => {
    if (!inputText.trim()) return;

    const res = shieldCitations(inputText, {
      style: citationStyle,
      discipline: citationDiscipline,
    });

    setInputText(res.shieldedText);
    setBibtexPackage(res.bibtexPackage);
    setShieldSuccessMessage(
      `Citation Shield Applied: Injected ${res.injectedCitations.length} reference anchor(s). Broken Turnitin rolling hash chains by ${res.densityReductionScore}%.`,
    );
    setIsCitationShieldOpen(false);
    toast.success("Citation shield applied");
  };

  const hasSpecializedResult =
    (service === "plagiarism-checker" && plagiarismResult) ||
    (service === "ai-detector" && aiDetectorResult) ||
    (service === "grammar-checker" && grammarResult);

  return (
    <>
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".docx,.tex,.latex,.md,.markdown,.txt,.zip"
        className="hidden"
      />

      {/* Editor Intro Title */}
      <div className={styles.editorIntro}>
        <div>
          <span className={styles.eyebrow}>YOUR WRITING TOOLKIT</span>
          <h1>
            {service === "plagiarism-checker"
              ? "Verify originality"
              : service === "ai-detector"
                ? "Understand how your text reads"
                : service === "grammar-checker"
                  ? "Polish every sentence"
                  : service === "paraphraser"
                    ? "Say it a different way"
                    : service === "summarizer"
                      ? "Find the essential ideas"
                      : "Make it sound more like you"}
          </h1>
        </div>
        <span className={styles.serviceStatus}>
          <span /> {selectedTool.label} ready
        </span>
      </div>

      {/* Editor Controls Bar */}
      <div
        className={`${styles.controlBar} mb-3 flex w-full flex-wrap items-center justify-start gap-3 text-xs text-slate-600 dark:text-[#9CA3AF]`}
      >
        {service === "plagiarism-checker" ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white/90">
              <Filter className="h-3.5 w-3.5 text-[#5555ff]" />
              Exclusions:
            </span>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 dark:border-white/[0.08] dark:bg-[#12141A]">
              <input
                type="checkbox"
                checked={excludeQuotes}
                onChange={(e) => setExcludeQuotes(e.target.checked)}
                className="rounded border-slate-300 text-[#5555ff] focus:ring-[#5555ff]"
              />
              <span>Quotes</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 dark:border-white/[0.08] dark:bg-[#12141A]">
              <input
                type="checkbox"
                checked={excludeBibliography}
                onChange={(e) => setExcludeBibliography(e.target.checked)}
                className="rounded border-slate-300 text-[#5555ff] focus:ring-[#5555ff]"
              />
              <span>Bibliography</span>
            </label>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 dark:border-white/[0.08] dark:bg-[#12141A]">
              <input
                type="checkbox"
                checked={excludeSmallMatches}
                onChange={(e) => setExcludeSmallMatches(e.target.checked)}
                className="rounded border-slate-300 text-[#5555ff] focus:ring-[#5555ff]"
              />
              <span>Small matches (&lt; 8 words)</span>
            </label>
          </div>
        ) : service === "ai-detector" ? (
          <div className="flex items-center gap-2">
            <Bot className="h-3.5 w-3.5 text-[#5555ff]" />
            <span className="font-medium text-slate-900 dark:text-white/90">
              Decision Signals:
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-300">
              ZipPy Perplexity + Burstiness CV + MATTR + Cliché Scanner
            </span>
          </div>
        ) : service === "grammar-checker" ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium text-slate-900 dark:text-white/90">
              Rule & Neural Checker:
            </span>
            <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-300">
              Punctuation, Agreement, Syntax, & Tone Verification
            </span>
          </div>
        ) : service === "paraphraser" ? (
          <>
            {/* Paraphraser Controls: Tone */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#5555ff]" />
              <span className="font-medium text-slate-900 dark:text-white/90">
                Tone:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                {(
                  [
                    "standard",
                    "formal",
                    "creative",
                    "shorten",
                    "expand",
                  ] as ToneType[]
                ).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                      tone === t
                        ? "bg-[#5555ff] text-white font-medium shadow-xs"
                        : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Paraphraser Controls: Focus */}
            <div
              className={`${styles.trailingControl} flex items-center gap-2`}
            >
              <span className="font-medium text-slate-900 dark:text-white/90">
                Focus:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                {(["vocabulary", "structure", "both"] as FocusType[]).map(
                  (f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFocus(f)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                        focus === f
                          ? "bg-[#5555ff] text-white font-medium shadow-xs"
                          : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                      }`}
                    >
                      {f}
                    </button>
                  ),
                )}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Mode Controls */}
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#5555ff]" />
              <span className="font-medium text-slate-900 dark:text-white/90">
                Mode:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                {(
                  [
                    "natural",
                    "academic",
                    "professional",
                    "casual",
                  ] as ModeType[]
                ).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                      mode === m
                        ? "bg-[#5555ff] text-white font-medium shadow-xs"
                        : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>

            {/* Intensity Controls */}
            <div
              className={`${styles.trailingControl} flex items-center gap-2`}
            >
              <span className="font-medium text-slate-900 dark:text-white/90">
                Intensity:
              </span>
              <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                {(["low", "medium", "high"] as IntensityType[]).map(
                  (lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensity(lvl)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                        intensity === lvl
                          ? "bg-[#5555ff] text-white font-medium shadow-xs"
                          : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                      }`}
                    >
                      {lvl}
                    </button>
                  ),
                )}
              </div>
            </div>
          </>
        )}

        {/* Citation Shield is a Humanizer-only feature */}
        {service === "humanizer" && (
          <button
            type="button"
            onClick={() => setIsCitationShieldOpen(!isCitationShieldOpen)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#5555ff]/35 bg-[#5555ff]/10 px-3 py-1 font-medium text-[#5555ff] transition-colors hover:bg-[#5555ff]/15"
          >
            <Shield className="h-3.5 w-3.5" />
            <span>Citation Shield (Turnitin 8-Gram Breaker)</span>
          </button>
        )}
      </div>

      {/* Citation Shield Dropdown Settings Panel */}
      {service === "humanizer" && isCitationShieldOpen && (
        <div
          className={`${styles.noticePanel} mb-4 w-full rounded-xl border border-[#5555ff]/25 bg-[#5555ff]/[0.04] p-4 shadow-sm`}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-[#5555ff]" />
                <span>Risk-Driven Citation Shielding</span>
              </h4>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                Injects reference markers at dense 8-token rolling hash
                boundaries to mathematically fragment Turnitin fingerprints
                while maintaining academic validity.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Style:
                </span>
                <select
                  value={citationStyle}
                  onChange={(e) =>
                    setCitationStyle(e.target.value as CitationStyle)
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-2xs dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200"
                >
                  <option value="latex">
                    LaTeX (\cite&#123;key&#125;)
                  </option>
                  <option value="ieee">IEEE ([1], [2])</option>
                  <option value="apa">APA (Author, Year)</option>
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                  Discipline:
                </span>
                <select
                  value={citationDiscipline}
                  onChange={(e) =>
                    setCitationDiscipline(
                      e.target.value as AcademicDiscipline,
                    )
                  }
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-2xs dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200"
                >
                  <option value="computer-science">
                    Computer Science & AI
                  </option>
                  <option value="engineering">Engineering & Physics</option>
                  <option value="mathematics">
                    Mathematics & Statistics
                  </option>
                  <option value="finance">Quantitative Finance</option>
                  <option value="medicine">Medical & Life Sciences</option>
                  <option value="general">General Science</option>
                </select>
              </div>

              <button
                type="button"
                onClick={handleApplyCitationShield}
                disabled={!inputText.trim()}
                className="rounded-md bg-[#5555ff] px-3 py-1 text-xs font-semibold text-white shadow-xs hover:brightness-110 disabled:opacity-50"
              >
                Apply Shield Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shield Success Notification */}
      {service === "humanizer" && shieldSuccessMessage && (
        <div
          className={`${styles.noticePanel} mb-4 flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span>{shieldSuccessMessage}</span>
          </div>
          {bibtexPackage && (
            <button
              type="button"
              onClick={() =>
                triggerDownload(
                  new Blob([bibtexPackage], { type: "text/plain" }),
                  "citations.bib",
                )
              }
              className="inline-flex items-center gap-1 font-semibold text-[#5555ff] hover:underline"
            >
              <Download className="h-3 w-3" />
              <span>Download citations.bib</span>
            </button>
          )}
        </div>
      )}

      {/* Text Editor Surface */}
      <div
        className={`${styles.editorGrid} w-full grid grid-cols-1 lg:grid-cols-2 gap-4`}
      >
        {/* Input Panel */}
        <div
          className={`${styles.editorPanel} relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 dark:border-white/[0.08] dark:bg-[#101216]/75`}
        >
          <div
            className={`${styles.panelHeader} flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-white/[0.06]`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-[#D1D5DB]">
                Input Text
              </span>

              {/* Upload Document Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isFileParsing}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
                title="Upload .docx, .tex, .md, .txt, or .zip archive"
              >
                <Upload className="h-3 w-3" />
                <span>{isFileParsing ? "Parsing..." : "Upload File"}</span>
              </button>

              {currentSamples.length > 0 && !inputText && (
                <button
                  type="button"
                  onClick={() => handleApplySample(currentSamples[0])}
                  className="inline-flex items-center gap-1 rounded-full border border-[#5555ff]/25 bg-[#5555ff]/10 px-2 py-0.5 text-[11px] font-medium text-[#5555ff] transition-colors hover:bg-[#5555ff]/15"
                >
                  <Wand2 className="w-2.5 h-2.5" />
                  <span>Try Sample</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {inputText && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-xs text-slate-500 transition-colors hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Active Document Badge */}
          {uploadedFile && (
            <div className="flex items-center justify-between border-b border-[#5555ff]/20 bg-[#5555ff]/[0.04] px-4 py-1.5 text-xs text-slate-800 dark:text-slate-200">
              <div className="flex items-center gap-1.5 truncate">
                {uploadedFile.format === "docx" ? (
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                ) : uploadedFile.format === "latex" ? (
                  <FileCode className="h-3.5 w-3.5 text-indigo-500" />
                ) : uploadedFile.format === "zip" ? (
                  <FileArchive className="h-3.5 w-3.5 text-amber-500" />
                ) : (
                  <BookOpen className="h-3.5 w-3.5 text-emerald-500" />
                )}
                <span className="font-semibold truncate">
                  {uploadedFile.name}
                </span>
                <span className="text-[10px] text-[#5555ff]">
                  {uploadedFile.format === "docx"
                    ? "(Word XML Runs Locked)"
                    : uploadedFile.format === "latex"
                      ? "(LaTeX Math & Macros Protected)"
                      : uploadedFile.format === "markdown"
                        ? "(Markdown AST Locked)"
                        : uploadedFile.format === "zip"
                          ? `(${uploadedFile.zipData?.entries?.length || 0} files unpacked)`
                          : "(Plain Text)"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setUploadedFile(null)}
                className="rounded p-0.5 hover:bg-[#5555ff]/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Quick Sample Selector Pills */}
          {!inputText && currentSamples.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/50 px-4 py-2 dark:border-white/[0.03] dark:bg-white/[0.01]">
              <span className="text-[11px] font-medium text-slate-500 dark:text-[#6B7280]">
                Samples:
              </span>
              {currentSamples.map((sample) => (
                <button
                  key={sample.label}
                  type="button"
                  onClick={() => handleApplySample(sample)}
                  className="rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs transition-colors hover:border-[#5555ff] hover:text-[#5555ff] dark:border-white/[0.08] dark:bg-[#191919] dark:text-[#D1D5DB] dark:hover:border-[#5555ff] dark:hover:text-[#5555ff]"
                >
                  ✦ {sample.label}
                </button>
              ))}
            </div>
          )}

          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            maxLength={maxInputLength}
            placeholder={
              service === "plagiarism-checker"
                ? `Paste your text or upload a document to scan for plagiarism & web attribution (up to ${maxInputLength.toLocaleString()} characters)...`
                : service === "ai-detector"
                  ? `Paste text to analyze for AI patterns (min 50 chars, up to ${maxInputLength.toLocaleString()} characters)...`
                  : service === "grammar-checker"
                    ? `Paste text to review grammar, spelling, and style (up to ${maxInputLength.toLocaleString()} characters)...`
                    : service === "paraphraser"
                      ? `Paste your text or upload a document to paraphrase here (up to ${maxInputLength.toLocaleString()} characters)...`
                      : `Paste your AI-generated text or upload a document (.docx, .tex, .md, .zip) here...`
            }
            className="w-full flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-[#F3F4F6] dark:placeholder:text-[#4B5563]"
          />

          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.01]">
            <span
              className={`text-xs ${
                exceedsInputLimit
                  ? "text-red-500"
                  : "text-slate-500 dark:text-[#6B7280]"
              }`}
            >
              Characters: {characterCount.toLocaleString()} /{" "}
              {maxInputLength.toLocaleString()}
            </span>

            {/* Action Button */}
            <HumanizeButton
              onClick={handleAction}
              isLoading={isLoading}
              disabled={!inputText.trim() || exceedsInputLimit}
              label={`${selectedTool.actionLabel} text`}
            />
          </div>
        </div>

        {/* Output / Report Panel */}
        <div
          className={`${styles.editorPanel} relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 dark:border-white/[0.08] dark:bg-[#101216]/75`}
        >
          <div
            className={`${styles.panelHeader} flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-white/[0.06]`}
          >
            <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-[#D1D5DB]">
              <span className="w-2 h-2 rounded-full bg-[#5555ff]" />
              {selectedTool.label} Output
            </span>

            <div className="flex items-center gap-2">
              {outputText && !hasSpecializedResult && (
                <>
                  <button
                    type="button"
                    onClick={handleExportReconstructed}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200"
                    title={
                      uploadedFile?.format === "docx"
                        ? "Download as .docx with preserved formatting"
                        : uploadedFile?.format === "latex"
                          ? "Download as .tex with preserved math formulas"
                          : "Download transformed text"
                    }
                  >
                    <Download className="w-3 h-3 text-[#5555ff]" />
                    <span>
                      {uploadedFile?.format === "docx"
                        ? "Download .docx"
                        : uploadedFile?.format === "latex"
                          ? "Download .tex"
                          : uploadedFile?.format === "markdown"
                            ? "Download .md"
                            : "Download"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleCopy}
                    className="inline-flex items-center gap-1 text-xs text-[#5555ff] hover:brightness-110 font-medium transition-colors"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-slate-900 dark:text-[#F3F4F6]">
            <ToolErrorBoundary
              fallbackTitle={`Error rendering ${selectedTool.label} output`}
              onReset={clearResult}
            >
              {(error || errorDetail) && (
                <ToolErrorBanner
                  error={errorDetail || error}
                  onRetry={handleAction}
                  onDismiss={() => setStoreError(null)}
                  isLoading={isLoading}
                />
              )}

              {service === "plagiarism-checker" && plagiarismResult ? (
                <PlagiarismView
                  result={plagiarismResult}
                  originalText={inputText}
                  onToggleExcludeSource={toggleSourceExclusion}
                />
              ) : service === "ai-detector" && aiDetectorResult ? (
                <AiDetectorView
                  result={aiDetectorResult}
                  originalText={inputText}
                />
              ) : service === "grammar-checker" && grammarResult ? (
                <GrammarView
                  result={grammarResult}
                  originalText={inputText}
                />
              ) : outputText ? (
                <p className="whitespace-pre-wrap">{outputText}</p>
              ) : (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center text-slate-400 dark:text-[#4B5563]">
                  {service === "plagiarism-checker" ? (
                    <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  ) : service === "ai-detector" ? (
                    <Bot className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  ) : service === "grammar-checker" ? (
                    <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  ) : (
                    <Sparkles className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  )}
                  <p className="text-xs max-w-xs font-medium">
                    Your {selectedTool.label.toLowerCase()} report and analysis
                    will appear here.
                  </p>
                </div>
              )}
            </ToolErrorBoundary>
          </div>
        </div>
      </div>
    </>
  );
}

