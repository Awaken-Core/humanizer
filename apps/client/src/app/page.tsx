"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { HeaderAuth } from "@/components/header-auth";
import { HumanizeButton } from "@/components/ui/humanize-button";
import {
  Sparkles,
  Copy,
  Check,
  RotateCcw,
  SlidersHorizontal,
  ChevronDown,
} from "lucide-react";

// Dynamically import the 3D Floating Orb with SSR disabled to guarantee transparent WebGL canvas mounting
const FloatingOrb = dynamic(
  () =>
    import("@/components/ui/floating-orb").then((mod) => mod.FloatingOrb),
  { ssr: false }
);

type ModeType = "natural" | "academic" | "professional" | "casual";
type IntensityType = "low" | "medium" | "high";

export default function HumanizerPage() {
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [mode, setMode] = useState<ModeType>("natural");
  const [intensity, setIntensity] = useState<IntensityType>("medium");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const characterCount = inputText.length;
  const wordCount = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;

  const handleHumanize = async () => {
    if (!inputText.trim() || isLoading) return;
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/humanize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: inputText,
          mode,
          intensity,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to humanize text.");
      }

      setOutputText(data.data.humanizedText);
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
    <div className="relative min-h-screen bg-[#08080A] text-[#F3F4F6] selection:bg-[#0070F3]/30 selection:text-white flex flex-col font-sans antialiased overflow-x-hidden">
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-[radial-gradient(ellipse_at_top,_rgba(0,112,243,0.12),_rgba(120,40,200,0.05)_45%,_transparent_75%)] blur-3xl -z-10" />

      {/* Navigation Header */}
      <header className="w-full border-b border-white/[0.06] bg-[#08080A]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[#0066FF] to-[#00D4FF] flex items-center justify-center shadow-[0_0_16px_rgba(0,112,243,0.4)]">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold tracking-tight text-base text-white">
              Awaken <span className="text-[#00B4D8]">Humanizer</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
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
            
            {/* Genuine 3D Liquid-Iridescent Orb (No black box or image frame) */}
            <FloatingOrb size={260} className="z-10" />
          </div>

          {/* Clean Typography */}
          <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-center text-white">
            Humanize AI Text with Precision
          </h1>
          <p className="mt-3 text-sm sm:text-base text-[#9CA3AF] max-w-xl text-center leading-relaxed">
            Transform artificial, mechanical writing into natural, authentic prose while strictly preserving all facts, numbers, and intent.
          </p>
        </div>

        {/* Editor Controls Bar */}
        <div className="w-full max-w-5xl mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-[#9CA3AF]">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#00B4D8]" />
            <span className="font-medium text-white/90">Mode:</span>
            <div className="inline-flex rounded-lg bg-[#12141A] p-0.5 border border-white/[0.08]">
              {(["natural", "academic", "professional", "casual"] as ModeType[]).map(
                (m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                      mode === m
                        ? "bg-[#0070F3] text-white font-medium shadow-sm"
                        : "text-[#9CA3AF] hover:text-white"
                    }`}
                  >
                    {m}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-white/90">Intensity:</span>
            <div className="inline-flex rounded-lg bg-[#12141A] p-0.5 border border-white/[0.08]">
              {(["low", "medium", "high"] as IntensityType[]).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setIntensity(lvl)}
                  className={`px-3 py-1 rounded-md capitalize transition-colors duration-150 ${
                    intensity === lvl
                      ? "bg-[#0070F3] text-white font-medium shadow-sm"
                      : "text-[#9CA3AF] hover:text-white"
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Text Editor Surface */}
        <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Input Panel */}
          <div className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-[#101216]/75 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden min-h-[360px]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs font-semibold text-[#D1D5DB] tracking-wide uppercase">
                Input Text
              </span>
              {inputText && (
                <button
                  type="button"
                  onClick={handleReset}
                  className="inline-flex items-center gap-1 text-xs text-[#9CA3AF] hover:text-white transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Paste your AI-generated text here (up to 15,000 characters)..."
              className="flex-1 w-full bg-transparent p-4 text-sm text-[#F3F4F6] placeholder-[#4B5563] resize-none focus:outline-none leading-relaxed"
            />

            <div className="flex items-center justify-between px-4 py-3 border-t border-white/[0.06] bg-white/[0.01]">
              <span className="text-xs text-[#6B7280]">
                {wordCount} words &bull; {characterCount.toLocaleString()} / 15,000
              </span>

              {/* Redesigned Premium Humanize Action Button */}
              <HumanizeButton
                onClick={handleHumanize}
                isLoading={isLoading}
                disabled={!inputText.trim()}
                label="Humanize text"
              />
            </div>
          </div>

          {/* Output Panel */}
          <div className="relative flex flex-col rounded-2xl border border-white/[0.08] bg-[#101216]/75 backdrop-blur-xl shadow-[0_4px_24px_rgba(0,0,0,0.5)] overflow-hidden min-h-[360px]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] bg-white/[0.02]">
              <span className="text-xs font-semibold text-[#D1D5DB] tracking-wide uppercase flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#00D4FF] animate-pulse" />
                Humanized Result
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

            <div className="flex-1 p-4 text-sm text-[#F3F4F6] leading-relaxed overflow-y-auto">
              {outputText ? (
                <p className="whitespace-pre-wrap">{outputText}</p>
              ) : (
                <div className="h-full min-h-[220px] flex flex-col items-center justify-center text-center text-[#4B5563] gap-2">
                  <Sparkles className="w-6 h-6 text-[#2A2F3D]" />
                  <p className="text-xs max-w-xs">
                    Your polished human text will appear here with strict meaning and factual fidelity.
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
