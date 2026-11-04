"use client";

import React, { useState, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { HeaderAuth } from "@/components/header-auth";
import { ModeToggle } from "@/components/theme-toggle";
import { HumanizeButton } from "@/components/ui/humanize-button";
import { useSession } from "@/lib/auth-client";
import {
  useWorkspaceStore,
  type ParaphraserFocus,
  type ParaphraserTone,
  type WorkspaceIntensity,
  type WorkspaceMode,
} from "@/store/workspace.store";
import {
  ANONYMOUS_MAX_INPUT_TEXT_LENGTH,
  AUTHENTICATED_MAX_INPUT_TEXT_LENGTH,
} from "@/features/humanizer/humanizer.schema";
import {
  ANONYMOUS_MAX_PLAGIARISM_LENGTH,
  AUTHENTICATED_MAX_PLAGIARISM_LENGTH,
} from "@/features/plagiarism/plagiarism.schema";
import {
  ANONYMOUS_MAX_GRAMMAR_LENGTH,
  AUTHENTICATED_MAX_GRAMMAR_LENGTH,
} from "@/features/grammar/grammar.types";
import { PlagiarismView } from "@/components/workspace/plagiarism-view";
import { AiDetectorView } from "@/components/workspace/ai-detector-view";
import { GrammarView } from "@/components/workspace/grammar-view";
import {
  ServiceActionLabels,
  ServiceLabels,
  Services,
  type Service,
} from "@/lib/constants";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  extractLatexProse,
  extractMarkdownProse,
  unpackBatchZip,
  repackageBatchZip,
  type DocxParseResult,
} from "@/lib/parser";
import {
  shieldCitations,
  type CitationStyle,
  type AcademicDiscipline,
} from "@/features/humanizer/citation-shield";
import Image from "next/image";

// Dynamically import the 3D Floating Orb with SSR disabled to guarantee transparent WebGL canvas mounting
const FloatingOrb = dynamic(
  () =>
    import("@/components/ui/floating-orb").then((mod) => mod.FloatingOrb),
  { ssr: false }
);

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

interface UploadedFileState {
  name: string;
  format: "docx" | "latex" | "markdown" | "txt" | "zip";
  docxResult?: DocxParseResult;
  latexPlaceholders?: Map<string, string>;
  markdownPlaceholders?: Map<string, string>;
  zipData?: any;
}

const SERVICE_SAMPLES: Record<Service, ServiceSample[]> = {
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
      text: "According to research published by the International Energy Agency, \"Global investment in clean energy is on course to rise to 1.8 trillion USD in 2023, with solar leading the way.\" However, transmission grid modernizations remain critical to unlock full capacity.",
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

export default function HumanizerPage() {
  const { data: session } = useSession();
  const [inputText, setInputText] = useState("");
  const outputText = useWorkspaceStore((state) => state.outputText);
  const plagiarismResult = useWorkspaceStore((state) => state.plagiarismResult);
  const aiDetectorResult = useWorkspaceStore((state) => state.aiDetectorResult);
  const grammarResult = useWorkspaceStore((state) => state.grammarResult);
  const toggleSourceExclusion = useWorkspaceStore((state) => state.toggleSourceExclusion);
  const isLoading = useWorkspaceStore((state) => state.isLoading);
  const error = useWorkspaceStore((state) => state.error);
  const runService = useWorkspaceStore((state) => state.runService);
  const clearResult = useWorkspaceStore((state) => state.clearResult);
  const setStoreError = useWorkspaceStore((state) => state.setError);

  const [mode, setMode] = useState<ModeType>("natural");
  const [intensity, setIntensity] = useState<IntensityType>("medium");
  const [tone, setTone] = useState<ToneType>("standard");
  const [focus, setFocus] = useState<FocusType>("both");
  const [copied, setCopied] = useState(false);
  const [selectedService, setSelectedService] = useState<Service>(Services[0]);

  // Plagiarism-specific settings
  const [excludeQuotes, setExcludeQuotes] = useState(true);
  const [excludeBibliography, setExcludeBibliography] = useState(true);
  const [excludeSmallMatches, setExcludeSmallMatches] = useState(true);

  // File Upload & AST State
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<UploadedFileState | null>(null);
  const [isFileParsing, setIsFileParsing] = useState(false);

  // Citation Shield State
  const [isCitationShieldOpen, setIsCitationShieldOpen] = useState(false);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("latex");
  const [citationDiscipline, setCitationDiscipline] = useState<AcademicDiscipline>("computer-science");
  const [bibtexPackage, setBibtexPackage] = useState<string | null>(null);
  const [shieldSuccessMessage, setShieldSuccessMessage] = useState<string | null>(null);

  const characterCount = inputText.length;

  const maxInputLength = useMemo(() => {
    const isAuth = !!session?.user;
    if (selectedService === "plagiarism-checker") {
      return isAuth
        ? AUTHENTICATED_MAX_PLAGIARISM_LENGTH
        : ANONYMOUS_MAX_PLAGIARISM_LENGTH;
    }
    if (selectedService === "ai-detector") {
      return isAuth ? 50_000 : 2_000;
    }
    if (selectedService === "grammar-checker") {
      return isAuth
        ? AUTHENTICATED_MAX_GRAMMAR_LENGTH
        : ANONYMOUS_MAX_GRAMMAR_LENGTH;
    }
    return isAuth
      ? AUTHENTICATED_MAX_INPUT_TEXT_LENGTH
      : ANONYMOUS_MAX_INPUT_TEXT_LENGTH;
  }, [session?.user, selectedService]);

  const exceedsInputLimit = characterCount > maxInputLength;
  const currentSamples = SERVICE_SAMPLES[selectedService] || [];

  const handleApplySample = (sample: ServiceSample) => {
    setInputText(sample.text);
    if (sample.tone) setTone(sample.tone);
    if (sample.focus) setFocus(sample.focus);
    if (sample.mode) setMode(sample.mode);
    if (sample.intensity) setIntensity(sample.intensity);
    setUploadedFile(null);
    clearResult();
  };

  const handleAction = async () => {
    if (!inputText.trim() || isLoading || exceedsInputLimit) return;

    if (selectedService === "plagiarism-checker") {
      await runService({
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

    if (selectedService === "ai-detector") {
      if (inputText.trim().length < 50) {
        setStoreError("Please provide at least 50 characters for accurate AI detection.");
        return;
      }
      await runService({
        service: "ai-detector",
        text: inputText,
      });
      return;
    }

    if (selectedService === "grammar-checker") {
      await runService({
        service: "grammar-checker",
        text: inputText,
      });
      return;
    }

    if (selectedService === "paraphraser") {
      await runService({ service: selectedService, text: inputText, tone, focus });
      return;
    }

    if (selectedService === "humanizer" || selectedService === "summarizer") {
      await runService({ service: selectedService, text: inputText, mode, intensity });
      return;
    }

    setStoreError(`${ServiceLabels[selectedService]} is currently under active development.`);
  };

  const handleCopy = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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
          throw new Error("No supported documents (.docx, .tex, .md, .txt) found inside ZIP.");
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
        throw new Error("Unsupported format. Please upload .docx, .tex, .md, .txt, or .zip.");
      }
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : "Failed to parse uploaded document.");
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
        // Reconstruct Word .docx preserving paragraph formatting & XML runs
        const paragraphs = outputText.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
        const docxBytes = await reconstructDocx(uploadedFile.docxResult.zip, paragraphs);
        triggerDownload(
          new Blob([docxBytes as any], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          }),
          `Humanized_${uploadedFile.name}`
        );
      } else if (uploadedFile?.format === "latex" && uploadedFile.latexPlaceholders) {
        // Unmask LaTeX preserving math formulas, equations, and citations
        const restoredTex = unmaskLatex(outputText, uploadedFile.latexPlaceholders);
        triggerDownload(new Blob([restoredTex], { type: "text/x-tex" }), `Humanized_${uploadedFile.name}`);
      } else if (uploadedFile?.format === "markdown" && uploadedFile.markdownPlaceholders) {
        // Unmask Markdown preserving code blocks and tables
        const restoredMd = unmaskMarkdown(outputText, uploadedFile.markdownPlaceholders);
        triggerDownload(new Blob([restoredMd], { type: "text/markdown" }), `Humanized_${uploadedFile.name}`);
      } else {
        // Standard text download
        const outName = uploadedFile ? `Humanized_${uploadedFile.name}.txt` : "Humanized_Document.txt";
        triggerDownload(new Blob([outputText], { type: "text/plain" }), outName);
      }
    } catch (err) {
      setStoreError(err instanceof Error ? err.message : "Failed to reconstruct and export document.");
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
      `Citation Shield Applied: Injected ${res.injectedCitations.length} reference anchor(s). Broken Turnitin rolling hash chains by ${res.densityReductionScore}%.`
    );
    setIsCitationShieldOpen(false);
  };

  const hasSpecializedResult =
    (selectedService === "plagiarism-checker" && plagiarismResult) ||
    (selectedService === "ai-detector" && aiDetectorResult) ||
    (selectedService === "grammar-checker" && grammarResult);

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-950 antialiased selection:bg-[#0070F3]/30 dark:bg-[#08080A] dark:text-[#F3F4F6] dark:selection:text-white">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        accept=".docx,.tex,.latex,.md,.markdown,.txt,.zip"
        className="hidden"
      />

      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-[radial-gradient(ellipse_at_top,_rgba(0,112,243,0.12),_rgba(120,40,200,0.05)_45%,_transparent_75%)] blur-3xl -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-white/[0.06] dark:bg-[#08080A]/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0066FF] to-[#00D4FF] flex items-center justify-center shadow-[0_0_16px_rgba(0,112,243,0.4)]">
              <Image alt="logo" src="/image/logo.svg" height={32} width={32} className="size-7" />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
              Awaken <span className="text-[#00B4D8]">Intelligence Studio</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <ModeToggle />
            <HeaderAuth />
          </div>
        </div>
      </header>

      {/* Hero Section with Floating 3D Orb */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 pt-10 pb-20 flex flex-col items-center">
        {/* Floating 3D Orb Centerpiece */}
        <div className="relative w-full flex flex-col items-center justify-center mb-6">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-72 h-72 rounded-full bg-[radial-gradient(circle,_rgba(0,180,255,0.22)_0%,_rgba(138,43,226,0.12)_45%,_transparent_70%)] blur-2xl pointer-events-none -z-10" />
            <FloatingOrb size={240} className="z-10" />
          </div>

          <h1 className="mt-4 text-center text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl dark:text-white">
            {selectedService === "plagiarism-checker"
              ? "Verify Originality with Industry-Grade Detection"
              : selectedService === "ai-detector"
              ? "Detect AI-Generated Text with High Confidence"
              : selectedService === "grammar-checker"
              ? "Enhance Clarity & Polish Grammar"
              : selectedService === "paraphraser"
              ? "Paraphrase AI Text with Precision"
              : selectedService === "summarizer"
              ? "Summarize Text with Clarity"
              : "Humanize AI Text with Precision"}
          </h1>
          <p className="mt-3 max-w-2xl text-center text-sm leading-relaxed text-slate-600 sm:text-base dark:text-[#9CA3AF]">
            {selectedService === "plagiarism-checker"
              ? "Cross-examine text against billions of web pages and academic sources using winnowing algorithms, pairwise offline audit, and neural semantic verification."
              : selectedService === "ai-detector"
              ? "Multi-signal structural analysis examining burstiness, lexical entropy, type-token diversity, and AI discourse patterns without external LLM calls."
              : selectedService === "grammar-checker"
              ? "Identify punctuation, syntax, spelling, and stylistic improvements with real-time actionable suggestions."
              : selectedService === "paraphraser"
              ? "Express thoughts with a fresh vocabulary and sentence structure while faithfully maintaining every fact and nuance."
              : selectedService === "summarizer"
              ? "Distill lengthy documents into concise, high-impact summaries without losing critical details."
              : "Transform artificial, mechanical writing into natural, authentic prose with native LaTeX math protection and Word XML run preservation."}
          </p>
        </div>

        {/* Editor Controls Bar */}
        <div className="mb-3 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-[#9CA3AF]">
          {selectedService === "plagiarism-checker" ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1.5 font-medium text-slate-900 dark:text-white/90">
                <Filter className="h-3.5 w-3.5 text-[#00B4D8]" />
                Exclusions:
              </span>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 dark:border-white/[0.08] dark:bg-[#12141A]">
                <input
                  type="checkbox"
                  checked={excludeQuotes}
                  onChange={(e) => setExcludeQuotes(e.target.checked)}
                  className="rounded border-slate-300 text-[#0070F3] focus:ring-[#0070F3]"
                />
                <span>Quotes</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 dark:border-white/[0.08] dark:bg-[#12141A]">
                <input
                  type="checkbox"
                  checked={excludeBibliography}
                  onChange={(e) => setExcludeBibliography(e.target.checked)}
                  className="rounded border-slate-300 text-[#0070F3] focus:ring-[#0070F3]"
                />
                <span>Bibliography</span>
              </label>
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 dark:border-white/[0.08] dark:bg-[#12141A]">
                <input
                  type="checkbox"
                  checked={excludeSmallMatches}
                  onChange={(e) => setExcludeSmallMatches(e.target.checked)}
                  className="rounded border-slate-300 text-[#0070F3] focus:ring-[#0070F3]"
                />
                <span>Small matches (&lt; 8 words)</span>
              </label>
            </div>
          ) : selectedService === "ai-detector" ? (
            <div className="flex items-center gap-2">
              <Bot className="h-3.5 w-3.5 text-[#00B4D8]" />
              <span className="font-medium text-slate-900 dark:text-white/90">
                Decision Signals:
              </span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-300">
                ZipPy Perplexity + Burstiness CV + MATTR + Cliché Scanner
              </span>
            </div>
          ) : selectedService === "grammar-checker" ? (
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="font-medium text-slate-900 dark:text-white/90">
                Rule & Neural Checker:
              </span>
              <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] text-slate-600 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-300">
                Punctuation, Agreement, Syntax, & Tone Verification
              </span>
            </div>
          ) : selectedService === "paraphraser" ? (
            <>
              {/* Paraphraser Controls: Tone */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#00B4D8]" />
                <span className="font-medium text-slate-900 dark:text-white/90">Tone:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["standard", "formal", "creative", "shorten", "expand"] as ToneType[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                          tone === t
                            ? "bg-[#0070F3] text-white font-medium shadow-xs"
                            : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                        }`}
                      >
                        {t}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Paraphraser Controls: Focus */}
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white/90">Focus:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["vocabulary", "structure", "both"] as FocusType[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFocus(f)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                        focus === f
                          ? "bg-[#0070F3] text-white font-medium shadow-xs"
                          : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Mode Controls */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#00B4D8]" />
                <span className="font-medium text-slate-900 dark:text-white/90">Mode:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["natural", "academic", "professional", "casual"] as ModeType[]).map(
                    (m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                          mode === m
                            ? "bg-[#0070F3] text-white font-medium shadow-xs"
                            : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                        }`}
                      >
                        {m}
                      </button>
                    )
                  )}
                </div>
              </div>

              {/* Intensity Controls */}
              <div className="flex items-center gap-2">
                <span className="font-medium text-slate-900 dark:text-white/90">Intensity:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["low", "medium", "high"] as IntensityType[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensity(lvl)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                        intensity === lvl
                          ? "bg-[#0070F3] text-white font-medium shadow-xs"
                          : "text-slate-600 hover:text-slate-950 dark:text-[#9CA3AF] dark:hover:text-white"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Citation Shield Button (For Humanizer & Paraphraser) */}
          {(selectedService === "humanizer" || selectedService === "paraphraser") && (
            <button
              type="button"
              onClick={() => setIsCitationShieldOpen(!isCitationShieldOpen)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 px-3 py-1 font-medium text-[#0070F3] transition-colors hover:bg-blue-500/20 dark:text-[#00D4FF]"
            >
              <Shield className="h-3.5 w-3.5" />
              <span>Citation Shield (Turnitin 8-Gram Breaker)</span>
            </button>
          )}
        </div>

        {/* Citation Shield Dropdown Settings Panel */}
        {isCitationShieldOpen && (
          <div className="mb-4 w-full max-w-6xl rounded-xl border border-blue-500/30 bg-blue-50/50 p-4 shadow-sm dark:border-blue-500/20 dark:bg-blue-950/20">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="font-semibold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Shield className="h-4 w-4 text-[#0070F3] dark:text-[#00D4FF]" />
                  <span>Risk-Driven Citation Shielding</span>
                </h4>
                <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-0.5">
                  Injects reference markers at dense 8-token rolling hash boundaries to mathematically fragment Turnitin fingerprints while maintaining academic validity.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Style:</span>
                  <select
                    value={citationStyle}
                    onChange={(e) => setCitationStyle(e.target.value as CitationStyle)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-2xs dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200"
                  >
                    <option value="latex">LaTeX (\cite&#123;key&#125;)</option>
                    <option value="ieee">IEEE ([1], [2])</option>
                    <option value="apa">APA (Author, Year)</option>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Discipline:</span>
                  <select
                    value={citationDiscipline}
                    onChange={(e) => setCitationDiscipline(e.target.value as AcademicDiscipline)}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 shadow-2xs dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200"
                  >
                    <option value="computer-science">Computer Science & AI</option>
                    <option value="engineering">Engineering & Physics</option>
                    <option value="mathematics">Mathematics & Statistics</option>
                    <option value="finance">Quantitative Finance</option>
                    <option value="medicine">Medical & Life Sciences</option>
                    <option value="general">General Science</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleApplyCitationShield}
                  disabled={!inputText.trim()}
                  className="rounded-md bg-[#0070F3] px-3 py-1 text-xs font-semibold text-white shadow-xs hover:bg-[#0060df] disabled:opacity-50"
                >
                  Apply Shield Now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Shield Success Notification */}
        {shieldSuccessMessage && (
          <div className="mb-4 flex w-full max-w-6xl items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-50/50 p-3 text-xs text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-950/20 dark:text-emerald-300">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
              <span>{shieldSuccessMessage}</span>
            </div>
            {bibtexPackage && (
              <button
                type="button"
                onClick={() =>
                  triggerDownload(new Blob([bibtexPackage], { type: "text/plain" }), "citations.bib")
                }
                className="inline-flex items-center gap-1 font-semibold text-[#0070F3] hover:underline dark:text-[#00D4FF]"
              >
                <Download className="h-3 w-3" />
                <span>Download citations.bib</span>
              </button>
            )}
          </div>
        )}

        {/* Text Editor Surface */}
        <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Input Panel */}
          <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#101216]/75 dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
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
                    className="inline-flex items-center gap-1 rounded-full border border-sky-500/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-[#0070F3] transition-colors hover:bg-sky-500/20 dark:text-[#00D4FF]"
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

                <Select
                  value={selectedService}
                  onValueChange={(value) => {
                    setSelectedService(value as Service);
                    clearResult();
                  }}
                >
                  <SelectTrigger className="w-full max-w-44">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Intelligence Tools</SelectLabel>
                      {Services.map((item) => (
                        <SelectItem key={item} value={item}>
                          {ServiceLabels[item]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Active Document Badge */}
            {uploadedFile && (
              <div className="flex items-center justify-between border-b border-blue-500/20 bg-blue-50/50 px-4 py-1.5 text-xs text-blue-900 dark:bg-blue-950/30 dark:text-blue-200">
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
                  <span className="font-semibold truncate">{uploadedFile.name}</span>
                  <span className="text-[10px] text-blue-600 dark:text-blue-300">
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
                  className="rounded p-0.5 hover:bg-blue-100 dark:hover:bg-blue-900/50"
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
                    className="rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-2xs transition-colors hover:border-[#0070F3] hover:text-[#0070F3] dark:border-white/[0.08] dark:bg-[#12141A] dark:text-[#D1D5DB] dark:hover:border-[#00B4D8] dark:hover:text-[#00D4FF]"
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
                selectedService === "plagiarism-checker"
                  ? `Paste your text or upload a document to scan for plagiarism & web attribution (up to ${maxInputLength.toLocaleString()} characters)...`
                  : selectedService === "ai-detector"
                  ? `Paste text to analyze for AI patterns (min 50 chars, up to ${maxInputLength.toLocaleString()} characters)...`
                  : selectedService === "grammar-checker"
                  ? `Paste text to review grammar, spelling, and style (up to ${maxInputLength.toLocaleString()} characters)...`
                  : selectedService === "paraphraser"
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
                Characters: {characterCount.toLocaleString()} / {maxInputLength.toLocaleString()}
              </span>

              {/* Action Button */}
              <HumanizeButton
                onClick={handleAction}
                isLoading={isLoading}
                disabled={!inputText.trim() || exceedsInputLimit}
                label={`${ServiceActionLabels[selectedService]} text`}
              />
            </div>
          </div>

          {/* Output / Report Panel */}
          <div className="relative flex min-h-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#101216]/75 dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-[#D1D5DB]">
                <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
                {ServiceLabels[selectedService]} Output
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
                      <Download className="w-3 h-3 text-[#0070F3]" />
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
                      className="inline-flex items-center gap-1 text-xs text-[#00B4D8] hover:text-[#00D4FF] font-medium transition-colors"
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
              {selectedService === "plagiarism-checker" && plagiarismResult ? (
                <PlagiarismView
                  result={plagiarismResult}
                  originalText={inputText}
                  onToggleExcludeSource={toggleSourceExclusion}
                />
              ) : selectedService === "ai-detector" && aiDetectorResult ? (
                <AiDetectorView
                  result={aiDetectorResult}
                  originalText={inputText}
                />
              ) : selectedService === "grammar-checker" && grammarResult ? (
                <GrammarView
                  result={grammarResult}
                  originalText={inputText}
                />
              ) : outputText ? (
                <p className="whitespace-pre-wrap">{outputText}</p>
              ) : (
                <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 text-center text-slate-400 dark:text-[#4B5563]">
                  {selectedService === "plagiarism-checker" ? (
                    <ShieldAlert className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  ) : selectedService === "ai-detector" ? (
                    <Bot className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  ) : selectedService === "grammar-checker" ? (
                    <CheckCircle2 className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  ) : (
                    <Sparkles className="h-8 w-8 text-slate-300 dark:text-[#2A2F3D]" />
                  )}
                  <p className="text-xs max-w-xs font-medium">
                    Your {ServiceLabels[selectedService].toLowerCase()} report and analysis will appear here.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="px-4 py-2.5 bg-red-950/40 border-t border-red-500/20 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
