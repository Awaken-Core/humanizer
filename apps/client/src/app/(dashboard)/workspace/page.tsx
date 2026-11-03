"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { HeaderAuth } from "@/components/header-auth";
import { ModeToggle } from "@/components/theme-toggle";
import { HumanizeButton } from "@/components/ui/humanize-button";
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
} from "lucide-react";

// Dynamically import the 3D Floating Orb with SSR disabled to guarantee transparent WebGL canvas mounting
const FloatingOrb = dynamic(
  () =>
    import("@/components/ui/floating-orb").then((mod) => mod.FloatingOrb),
  { ssr: false }
);

type ModeType = "natural" | "academic" | "professional" | "casual";
type IntensityType = "low" | "medium" | "high";
type ToneType = "standard" | "formal" | "creative" | "shorten" | "expand";
type FocusType = "vocabulary" | "structure" | "both";

interface ServiceRequest {
  text: string;
  mode: ModeType;
  intensity: IntensityType;
}

interface ParaphraseRequest {
  text: string;
  tone: ToneType;
  focus: FocusType;
}

interface ServiceSample {
  label: string;
  text: string;
  tone?: ToneType;
  focus?: FocusType;
  mode?: ModeType;
  intensity?: IntensityType;
}

const SERVICE_SAMPLES: Record<Service, ServiceSample[]> = {
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
    {
      label: "Technical Invariant",
      text: "On October 14, 2025, Project Apollo processed 4,820 transactions totaling $152,400.95. Run `bun run dev --port 3000` to inspect the metrics at https://example.com/api/v1/health.",
      tone: "standard",
      focus: "vocabulary",
    },
  ],
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
  summarizer: [
    {
      label: "Research Article",
      text: "Renewable energy adoption has accelerated significantly across global markets over the past decade. Driven by steep declines in solar photovoltaic manufacturing costs and technological breakthroughs in grid-scale battery storage, solar and wind power now represent the most economically viable source of new electricity generation in over two-thirds of the world. However, transmission bottlenecks, supply-chain delays, and lengthy regulatory approvals continue to pose serious challenges to rapid infrastructure deployment, prompting calls for coordinated cross-border grid modernization.",
      mode: "academic",
      intensity: "medium",
    },
  ],
  "grammar-checker": [],
  "plagiarism-checker": [],
};

async function runHumanizer(request: ServiceRequest): Promise<string> {
  const response = await fetch("/api/v1/humanize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || "Failed to humanize text.");
  }

  return data.data.humanizedText;
}

async function runSummarizer(request: ServiceRequest): Promise<string> {
  const response = await fetch("/api/v1/summarize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || "Failed to summarize text.");
  }

  return data.data.summaryText;
}

async function runParaphraser(request: ParaphraseRequest): Promise<string> {
  const response = await fetch("/api/v1/paraphrase", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(request),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || "Failed to paraphrase text.");
  }

  return data.data.paraphrasedText;
}

async function runService(
  service: Service,
  serviceRequest: ServiceRequest,
  paraphraseRequest: ParaphraseRequest
): Promise<string> {
  switch (service) {
    case "humanizer":
      return runHumanizer(serviceRequest);
    case "summarizer":
      return runSummarizer(serviceRequest);
    case "paraphraser":
      return runParaphraser(paraphraseRequest);
    default:
      throw new Error(`${ServiceLabels[service]} is not available yet.`);
  }
}

export default function HumanizerPage() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [mode, setMode] = useState<ModeType>("natural");
  const [intensity, setIntensity] = useState<IntensityType>("medium");
  const [tone, setTone] = useState<ToneType>("standard");
  const [focus, setFocus] = useState<FocusType>("both");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<Service>(Services[0]);

  const maxChars = selectedService === "paraphraser" ? 10_000 : 15_000;
  const characterCount = inputText.length;

  const currentSamples = SERVICE_SAMPLES[selectedService] || [];

  const handleApplySample = (sample: ServiceSample) => {
    setInputText(sample.text);
    if (sample.tone) setTone(sample.tone);
    if (sample.focus) setFocus(sample.focus);
    if (sample.mode) setMode(sample.mode);
    if (sample.intensity) setIntensity(sample.intensity);
    setOutputText("");
    setError(null);
  };

  const handleHumanize = async () => {
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const result = await runService(
        selectedService,
        {
          text: inputText,
          mode,
          intensity,
        },
        {
          text: inputText,
          tone,
          focus,
        }
      );
      setOutputText(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setInputText("");
    setOutputText("");
    setError(null);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-950 antialiased selection:bg-[#0070F3]/30 dark:bg-[#08080A] dark:text-[#F3F4F6] dark:selection:text-white">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-[radial-gradient(ellipse_at_top,_rgba(0,112,243,0.12),_rgba(120,40,200,0.05)_45%,_transparent_75%)] blur-3xl -z-10" />

      {/* Navigation Header */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-white/[0.06] dark:bg-[#08080A]/80">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0066FF] to-[#00D4FF] flex items-center justify-center shadow-[0_0_16px_rgba(0,112,243,0.4)]">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-base font-semibold tracking-tight text-slate-950 dark:text-white">
              Awaken <span className="text-[#00B4D8]">Humanizer</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <ModeToggle />
            <HeaderAuth />
          </div>
        </div>
      </header>

      {/* Hero Section with Floating 3D Orb */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 pt-10 pb-20 flex flex-col items-center">
        {/* Floating 3D Orb Centerpiece */}
        <div className="relative w-full flex flex-col items-center justify-center mb-6">
          <div className="relative flex items-center justify-center">
            {/* Ambient Cyan/Violet Backlight */}
            <div className="absolute w-72 h-72 rounded-full bg-[radial-gradient(circle,_rgba(0,180,255,0.22)_0%,_rgba(138,43,226,0.12)_45%,_transparent_70%)] blur-2xl pointer-events-none -z-10" />

            {/* Genuine 3D Liquid-Iridescent Orb */}
            <FloatingOrb size={260} className="z-10" />
          </div>

          {/* Clean Dynamic Typography */}
          <h1 className="mt-4 text-center text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl lg:text-5xl dark:text-white">
            {selectedService === "paraphraser"
              ? "Paraphrase AI Text with Precision"
              : selectedService === "summarizer"
              ? "Summarize Text with Clarity"
              : "Humanize AI Text with Precision"}
          </h1>
          <p className="mt-3 max-w-xl text-center text-sm leading-relaxed text-slate-600 sm:text-base dark:text-[#9CA3AF]">
            {selectedService === "paraphraser"
              ? "Express thoughts with a fresh vocabulary and sentence structure while faithfully maintaining every fact and nuance."
              : selectedService === "summarizer"
              ? "Distill lengthy documents into concise, high-impact summaries without losing critical details."
              : "Transform artificial, mechanical writing into natural, authentic prose while strictly preserving all facts, numbers, and intent."}
          </p>
        </div>

        {/* Editor Controls Bar */}
        <div className="mb-3 flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 text-xs text-slate-600 dark:text-[#9CA3AF]">
          {selectedService === "paraphraser" ? (
            <>
              {/* Paraphraser Controls: Tone */}
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#00B4D8]" />
                <span className="font-medium text-slate-900 dark:text-white/90">Tone:</span>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["standard", "formal", "creative", "shorten", "expand"] as ToneType[]).map(
                    (t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTone(t)}
                        className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                          tone === t
                            ? "bg-[#0070F3] text-white font-medium shadow-sm"
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
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["vocabulary", "structure", "both"] as FocusType[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFocus(f)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                        focus === f
                          ? "bg-[#0070F3] text-white font-medium shadow-sm"
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
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["natural", "academic", "professional", "casual"] as ModeType[]).map(
                    (m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                          mode === m
                            ? "bg-[#0070F3] text-white font-medium shadow-sm"
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
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-sm dark:border-white/[0.08] dark:bg-[#12141A] dark:shadow-none">
                  {(["low", "medium", "high"] as IntensityType[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setIntensity(lvl)}
                      className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                        intensity === lvl
                          ? "bg-[#0070F3] text-white font-medium shadow-sm"
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
        </div>

        {/* Text Editor Surface */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Panel */}
          <div className="relative flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#101216]/75 dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-[#D1D5DB]">
                  Input Text
                </span>
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
                    setOutputText("");
                    setError(null);
                  }}
                >
                  <SelectTrigger className="w-full max-w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectLabel>Services</SelectLabel>
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
                    className="rounded-md border border-slate-200/80 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-700 shadow-xs transition-colors hover:border-[#0070F3] hover:text-[#0070F3] dark:border-white/[0.08] dark:bg-[#12141A] dark:text-[#D1D5DB] dark:hover:border-[#00B4D8] dark:hover:text-[#00D4FF]"
                  >
                    ✦ {sample.label}
                  </button>
                ))}
              </div>
            )}

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={
                selectedService === "paraphraser"
                  ? "Paste your text to paraphrase here (up to 10,000 characters)..."
                  : `Paste your AI-generated text here (up to ${maxChars.toLocaleString()} characters)...`
              }
              className="w-full flex-1 resize-none bg-transparent p-4 text-sm leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-[#F3F4F6] dark:placeholder:text-[#4B5563]"
            />

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-4 py-3 dark:border-white/[0.06] dark:bg-white/[0.01]">
              <span className="text-xs text-slate-500 dark:text-[#6B7280]">
                Characters: {characterCount.toLocaleString()} / {maxChars.toLocaleString()}
              </span>

              {/* Action Button */}
              <HumanizeButton
                onClick={handleHumanize}
                isLoading={isLoading}
                disabled={!inputText.trim() || characterCount > maxChars}
                label={`${ServiceActionLabels[selectedService]} text`}
              />
            </div>
          </div>

          {/* Output Panel */}
          <div className="relative flex min-h-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/80 shadow-[0_4px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl dark:border-white/[0.08] dark:bg-[#101216]/75 dark:shadow-[0_4px_24px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 dark:text-[#D1D5DB]">
                <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
                {ServiceLabels[selectedService]} Result
              </span>
              {outputText && (
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
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 text-sm leading-relaxed text-slate-900 dark:text-[#F3F4F6]">
              {outputText ? (
                <p className="whitespace-pre-wrap">{outputText}</p>
              ) : (
                <div className="flex h-full min-h-[220px] flex-col items-center justify-center gap-2 text-center text-slate-400 dark:text-[#4B5563]">
                  <Sparkles className="h-6 w-6 text-slate-300 dark:text-[#2A2F3D]" />
                  <p className="text-xs max-w-xs">
                    Your {ServiceLabels[selectedService].toLowerCase()} result will
                    appear here.
                  </p>
                </div>
              )}
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-950/40 border-t border-red-500/20 text-xs text-red-300">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
