"use client";

import React, { useState } from "react";
import type {
  GrammarCheckResult,
  GrammarIssue,
  GrammarCategory,
} from "@/features/grammar/grammar.types";
import {
  CheckCircle,
  AlertCircle,
  Copy,
  Check,
  Sparkles,
  ArrowRight,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

interface GrammarViewProps {
  result: GrammarCheckResult;
  originalText: string;
}

export function GrammarView({ result, originalText }: GrammarViewProps) {
  const [activeTab, setActiveTab] = useState<
    "issues" | "corrected" | "summary"
  >("issues");
  const [selectedCategory, setSelectedCategory] = useState<
    "all" | GrammarCategory
  >("all");
  const [copied, setCopied] = useState(false);

  const { correctedText, issues, score, wordCount, summary, processingTimeMs } =
    result;

  const filteredIssues = issues.filter((issue) =>
    selectedCategory === "all" ? true : issue.category === selectedCategory,
  );

  const handleCopyCorrected = async () => {
    if (!correctedText) return;
    try {
      await navigator.clipboard.writeText(correctedText);
      setCopied(true);
      toast.success("Corrected text copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Unable to copy corrected text");
    }
  };

  const scoreBadgeColor =
    score >= 90
      ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/10"
      : score >= 75
        ? "text-amber-500 border-amber-500/20 bg-amber-500/10"
        : "text-rose-500 border-rose-500/20 bg-rose-500/10";

  return (
    <div className="flex h-full flex-col gap-4 text-xs">
      {/* Top Correctness Score Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border font-bold ${scoreBadgeColor}`}
          >
            <span className="text-base leading-none">{score}</span>
            <span className="text-[9px] uppercase tracking-wider font-semibold">
              Score
            </span>
          </div>
          <div>
            <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
              {score >= 90 ? (
                <>
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>Excellent Writing Quality</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-amber-500" />
                  <span>Improvements Recommended</span>
                </>
              )}
            </div>
            <p className="mt-0.5 text-slate-500 dark:text-slate-400">
              {wordCount.toLocaleString()} words • {issues.length} issue(s)
              identified • {processingTimeMs}ms
            </p>
          </div>
        </div>

        {/* Copy Corrected Text CTA */}
        <button
          type="button"
          onClick={handleCopyCorrected}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 shadow-2xs hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#1A1D24] dark:text-slate-200 dark:hover:bg-[#222630]"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-emerald-500" />
              <span>Copied All!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy Corrected</span>
            </>
          )}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-white/[0.06]">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-2xs dark:border-white/[0.08] dark:bg-[#12141A]">
          <button
            type="button"
            onClick={() => setActiveTab("issues")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === "issues"
                ? "bg-[#0070F3] text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Suggestions ({issues.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("corrected")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === "corrected"
                ? "bg-[#0070F3] text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Corrected Text
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("summary")}
            className={`px-3 py-1 rounded-md font-medium transition-colors ${
              activeTab === "summary"
                ? "bg-[#0070F3] text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Summary
          </button>
        </div>

        {activeTab === "issues" && (
          <div className="flex items-center gap-1.5">
            <Filter className="h-3 w-3 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value as any)}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 shadow-2xs focus:outline-none dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200"
            >
              <option value="all">All Categories</option>
              <option value="grammar">Grammar</option>
              <option value="spelling">Spelling</option>
              <option value="punctuation">Punctuation</option>
              <option value="clarity">Clarity</option>
              <option value="style">Style</option>
            </select>
          </div>
        )}
      </div>

      {/* Main Tab Panels */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === "issues" && (
          <div className="space-y-2.5">
            {filteredIssues.length === 0 ? (
              <div className="py-12 text-center text-slate-400">
                <CheckCircle className="mx-auto mb-2 h-8 w-8 text-emerald-500" />
                <p>
                  No issues detected! Your writing appears grammatically sound.
                </p>
              </div>
            ) : (
              filteredIssues.map((issue, idx) => (
                <div
                  key={idx}
                  className="rounded-lg border border-slate-200/80 bg-white/80 p-3.5 shadow-2xs transition-colors dark:border-white/[0.06] dark:bg-[#12141A]/80"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="line-through text-rose-500 font-medium">
                        {issue.original}
                      </span>
                      <ArrowRight className="h-3 w-3 text-slate-400" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {issue.replacement}
                      </span>
                    </div>

                    <span className="rounded-md border border-slate-200/60 bg-slate-100/70 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:border-white/[0.06] dark:bg-white/[0.04] dark:text-slate-300">
                      {issue.category}
                    </span>
                  </div>

                  <p className="mt-2 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    {issue.explanation}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "corrected" && (
          <div className="rounded-lg border border-slate-200/60 bg-white/50 p-4 text-sm leading-relaxed text-slate-800 dark:border-white/[0.04] dark:bg-[#101216]/50 dark:text-slate-200">
            <p className="whitespace-pre-wrap">{correctedText}</p>
          </div>
        )}

        {activeTab === "summary" && (
          <div className="space-y-3 rounded-lg border border-slate-200/80 bg-white/70 p-4 leading-relaxed text-slate-800 dark:border-white/[0.06] dark:bg-[#101216]/60 dark:text-slate-200">
            <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-[#00B4D8]" />
              <span>Editorial Assessment</span>
            </div>
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {summary}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
