"use client";

import React, { useState, useMemo } from "react";
import type {
  PlagiarismResult,
  PlagiarismMatch,
  PlagiarismSource,
  PairwiseComparisonResult,
  PairwiseMatchSpan,
} from "@/features/plagiarism/plagiarism.types";
import {
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  Quote,
  FileText,
  Eye,
  EyeOff,
  Filter,
  Sparkles,
  Columns,
  Search,
  Upload,
  ArrowRight,
  RotateCcw,
  Layers,
  FileCheck,
  AlertTriangle,
} from "lucide-react";

interface PlagiarismViewProps {
  result: PlagiarismResult;
  originalText: string;
  onToggleExcludeSource?: (url: string) => void;
}

export function PlagiarismView({
  result,
  originalText,
  onToggleExcludeSource,
}: PlagiarismViewProps) {
  // Mode: "web" (Live Google Search) vs "pairwise" (Doc vs Doc Offline Comparison)
  const [activeMode, setActiveMode] = useState<"web" | "pairwise">("web");

  // Web search state
  const [selectedSourceIndex, setSelectedSourceIndex] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<"all" | "identical" | "paraphrased" | "quoted">("all");
  const [activeTab, setActiveTab] = useState<"text" | "sources" | "summary">("text");

  // Pairwise state
  const [pairwiseDocA, setPairwiseDocA] = useState<string>(originalText || "");
  const [pairwiseDocB, setPairwiseDocB] = useState<string>("");
  const [docAName, setDocAName] = useState<string>("Document A (Draft)");
  const [docBName, setDocBName] = useState<string>("Document B (Reference)");
  const [pairwiseResult, setPairwiseResult] = useState<PairwiseComparisonResult | null>(null);
  const [isComparing, setIsComparing] = useState<boolean>(false);
  const [pairwiseError, setPairwiseError] = useState<string | null>(null);
  const [selectedPairwiseMatchId, setSelectedPairwiseMatchId] = useState<string | null>(null);

  const { scores, sources, matches, wordCount, summary, processingTimeMs } = result;

  // Filtered matches for Web mode
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (filterType !== "all" && m.matchType !== filterType) return false;
      if (selectedSourceIndex !== null && m.sourceIndex !== selectedSourceIndex) return false;
      return true;
    });
  }, [matches, filterType, selectedSourceIndex]);

  // Render text with highlight spans for Web mode
  const renderedWebTextSpans = useMemo(() => {
    if (!originalText) return null;
    if (matches.length === 0) {
      return <span>{originalText}</span>;
    }

    const sorted = [...filteredMatches].sort((a, b) => a.startChar - b.startChar);
    const elements: React.ReactNode[] = [];
    let lastIndex = 0;

    sorted.forEach((match, idx) => {
      const start = Math.max(0, Math.min(match.startChar, originalText.length));
      const end = Math.max(start, Math.min(match.endChar, originalText.length));

      if (start > lastIndex) {
        elements.push(
          <span key={`plain-${lastIndex}-${start}`}>
            {originalText.slice(lastIndex, start)}
          </span>
        );
      }

      if (start < end) {
        const matchedText = originalText.slice(start, end);
        const source = sources[match.sourceIndex];

        let bgClass = "bg-blue-500/20 text-blue-900 dark:text-blue-200 border-b-2 border-blue-500";
        if (match.matchType === "paraphrased") {
          bgClass = "bg-purple-500/20 text-purple-900 dark:text-purple-200 border-b-2 border-purple-500";
        } else if (match.matchType === "quoted") {
          bgClass = "bg-amber-500/20 text-amber-900 dark:text-amber-200 border-b-2 border-amber-500";
        }

        elements.push(
          <mark
            key={`match-${idx}-${start}`}
            title={`Source: ${source?.domain || source?.url || "Web"} (${match.matchType})`}
            className={`cursor-pointer rounded-sm px-1 py-0.5 transition-colors duration-150 hover:opacity-80 ${bgClass}`}
            onClick={() => setSelectedSourceIndex(match.sourceIndex)}
          >
            {matchedText}
          </mark>
        );
        lastIndex = end;
      }
    });

    if (lastIndex < originalText.length) {
      elements.push(
        <span key={`plain-${lastIndex}-${originalText.length}`}>
          {originalText.slice(lastIndex)}
        </span>
      );
    }

    return elements;
  }, [originalText, matches, filteredMatches, sources]);

  // Pairwise execution handler
  const handleRunPairwise = async () => {
    if (!pairwiseDocA.trim() || !pairwiseDocB.trim()) {
      setPairwiseError("Please provide both Document A and Document B to compare.");
      return;
    }

    setIsComparing(true);
    setPairwiseError(null);

    try {
      const res = await fetch("/api/v1/plagiarism/pairwise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docA: pairwiseDocA,
          docB: pairwiseDocB,
          docAName,
          docBName,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: { message?: string };
        data: PairwiseComparisonResult;
      };
      if (!res.ok || !json.success) {
        throw new Error(json.error?.message || "Pairwise comparison failed.");
      }

      setPairwiseResult(json.data);
      if (json.data.matches.length > 0) {
        setSelectedPairwiseMatchId(json.data.matches[0].id);
      }
    } catch (err) {
      setPairwiseError(err instanceof Error ? err.message : "Failed to run comparison.");
    } finally {
      setIsComparing(false);
    }
  };

  const handleLoadPairwiseSample = () => {
    setPairwiseDocA(
      "Renewable energy adoption has accelerated significantly across global markets over the past decade. Driven by steep declines in solar photovoltaic manufacturing costs and technological breakthroughs in grid-scale battery storage, solar and wind power now represent the most economically viable source of new electricity generation in over two-thirds of the world."
    );
    setPairwiseDocB(
      "Renewable energy adoption has accelerated significantly across global markets over the past decade. Solar photovoltaic manufacturing costs have fallen dramatically, and battery storage breakthroughs make wind and solar the most economically viable electricity generation method in most countries."
    );
    setDocAName("Student Essay (Draft)");
    setDocBName("IEA 2024 Report (Reference)");
    setPairwiseResult(null);
  };

  const severityColor =
    scores.overallSimilarity > 35
      ? "text-rose-500 dark:text-rose-400 border-rose-500/30 bg-rose-500/10"
      : scores.overallSimilarity > 15
      ? "text-amber-500 dark:text-amber-400 border-amber-500/30 bg-amber-500/10"
      : "text-emerald-500 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/10";

  return (
    <div className="flex h-full flex-col gap-4 text-xs">
      {/* Top Engine Mode Selector */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-white/[0.06]">
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A]">
          <button
            type="button"
            onClick={() => setActiveMode("web")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeMode === "web"
                ? "bg-[#0070F3] text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Live Web Search</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveMode("pairwise");
              if (!pairwiseDocA && originalText) {
                setPairwiseDocA(originalText);
              }
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-colors ${
              activeMode === "pairwise"
                ? "bg-[#0070F3] text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            <Columns className="h-3.5 w-3.5" />
            <span>Doc vs. Doc (Pairwise)</span>
          </button>
        </div>

        <span className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:inline">
          {activeMode === "web"
            ? "Google Search + Crawl + Winnowing"
            : "Offline 5-Gram Overlap + Winnowing + Cosine TF-IDF"}
        </span>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODE 1: LIVE WEB SEARCH VIEW                                  */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMode === "web" && (
        <>
          {/* Top Score Summary Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3.5 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border font-bold ${severityColor}`}
              >
                <span className="text-lg leading-none">{scores.overallSimilarity}%</span>
                <span className="text-[10px] uppercase tracking-wider font-semibold">Match</span>
              </div>
              <div>
                <div className="flex items-center gap-1.5 font-semibold text-slate-900 dark:text-white">
                  {scores.overallSimilarity < 15 ? (
                    <>
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span>Originality Verified</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="h-4 w-4 text-amber-500" />
                      <span>Potential Overlaps Detected</span>
                    </>
                  )}
                </div>
                <p className="mt-0.5 text-slate-500 dark:text-slate-400">
                  {wordCount.toLocaleString()} words analyzed in {(processingTimeMs / 1000).toFixed(2)}s •{" "}
                  {sources.length} sources referenced
                </p>
              </div>
            </div>

            {/* Breakdown chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/20 bg-blue-500/10 px-2.5 py-1 text-blue-600 dark:text-blue-300">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                Identical: {scores.identicalScore}%
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/20 bg-purple-500/10 px-2.5 py-1 text-purple-600 dark:text-purple-300">
                <span className="h-1.5 w-1.5 rounded-full bg-purple-500" />
                Paraphrased: {scores.paraphrasedScore}%
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-amber-600 dark:text-amber-300">
                <Quote className="h-2.5 w-2.5" />
                Quoted: {scores.quotedScore}%
              </span>
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-emerald-600 dark:text-emerald-300">
                <CheckCircle2 className="h-2.5 w-2.5" />
                Original: {scores.originalScore}%
              </span>
            </div>
          </div>

          {/* Subtabs: Highlighted Text / Sources / Originality Report */}
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2 dark:border-white/[0.06]">
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 shadow-xs dark:border-white/[0.08] dark:bg-[#12141A]">
              <button
                type="button"
                onClick={() => setActiveTab("text")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "text"
                    ? "bg-[#0070F3] text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Highlighted Text ({filteredMatches.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("sources")}
                className={`px-3 py-1 rounded-md font-medium transition-colors ${
                  activeTab === "sources"
                    ? "bg-[#0070F3] text-white"
                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                Sources ({sources.length})
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
                Originality Report
              </button>
            </div>

            {activeTab === "text" && (
              <div className="flex items-center gap-2">
                <Filter className="h-3 w-3 text-slate-400" />
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-700 shadow-2xs focus:outline-none dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200"
                >
                  <option value="all">All Match Types</option>
                  <option value="identical">Identical Only</option>
                  <option value="paraphrased">Paraphrased Only</option>
                  <option value="quoted">Quoted Only</option>
                </select>

                {selectedSourceIndex !== null && (
                  <button
                    type="button"
                    onClick={() => setSelectedSourceIndex(null)}
                    className="rounded-md border border-slate-200 px-2 py-1 text-slate-500 hover:text-slate-900 dark:border-white/[0.08] dark:text-slate-400 dark:hover:text-white"
                  >
                    Clear Filter
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Subtab Contents */}
          <div className="flex-1 overflow-y-auto">
            {activeTab === "text" && (
              <div className="whitespace-pre-wrap rounded-xl border border-slate-200/80 bg-white p-4 leading-relaxed text-slate-800 dark:border-white/[0.06] dark:bg-[#12141A] dark:text-slate-200">
                {renderedWebTextSpans}
              </div>
            )}

            {activeTab === "sources" && (
              <div className="space-y-3">
                {sources.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center text-slate-500 dark:text-slate-400">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mb-2" />
                    <p className="font-semibold text-slate-800 dark:text-slate-200">
                      No Overlapping Sources Detected
                    </p>
                    <p className="text-xs">Your draft has zero significant matches across crawled web repositories.</p>
                  </div>
                ) : (
                  sources.map((source, index) => (
                    <div
                      key={source.url}
                      className={`flex items-start justify-between gap-4 rounded-xl border p-3.5 transition-colors ${
                        source.isExcluded
                          ? "border-slate-200/50 bg-slate-100/50 opacity-60 dark:border-white/[0.03] dark:bg-white/[0.01]"
                          : "border-slate-200/80 bg-white hover:border-slate-300 dark:border-white/[0.06] dark:bg-[#12141A] dark:hover:border-white/[0.12]"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-700 dark:bg-white/[0.06] dark:text-slate-300 text-[10px]">
                            {index + 1}
                          </span>
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-slate-900 hover:text-[#0070F3] dark:text-white dark:hover:text-[#00D4FF] truncate inline-flex items-center gap-1"
                          >
                            <span>{source.title || source.domain}</span>
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                          </a>
                        </div>
                        <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {source.url}
                        </p>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-semibold text-slate-900 dark:text-white">
                            {source.matchPercentage}%
                          </span>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400">
                            {source.matchedWordCount} words
                          </p>
                        </div>

                        {onToggleExcludeSource && (
                          <button
                            type="button"
                            onClick={() => onToggleExcludeSource(source.url)}
                            title={source.isExcluded ? "Include source" : "Exclude source from score"}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-white/[0.08] dark:text-slate-400 dark:hover:bg-white/[0.04] dark:hover:text-white"
                          >
                            {source.isExcluded ? (
                              <EyeOff className="h-3.5 w-3.5 text-rose-500" />
                            ) : (
                              <Eye className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "summary" && (
              <div className="rounded-xl border border-slate-200/80 bg-white p-4 leading-relaxed text-slate-800 dark:border-white/[0.06] dark:bg-[#12141A] dark:text-slate-200">
                <div className="flex items-center gap-2 font-semibold text-slate-900 dark:text-white mb-3">
                  <Sparkles className="h-4 w-4 text-[#0070F3] dark:text-[#00D4FF]" />
                  <span>DeepSeek Originality & Attribution Audit</span>
                </div>
                <div className="prose prose-xs dark:prose-invert max-w-none">
                  {summary}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* MODE 2: PAIRWISE DOCUMENT COMPARISON (DOC VS DOC)              */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeMode === "pairwise" && (
        <div className="flex flex-col gap-4 flex-1">
          {/* Pairwise Header Controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-slate-50/80 p-3 dark:border-white/[0.06] dark:bg-white/[0.02]">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-[#0070F3] dark:text-[#00D4FF]" />
              <span className="font-semibold text-slate-900 dark:text-white">
                Turnitout Pairwise Multi-Pass Engine
              </span>
              <span className="rounded-full bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 text-[10px] text-blue-600 dark:text-blue-300 font-medium">
                Offline & Zero Data Leak
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleLoadPairwiseSample}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-700 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-200 dark:hover:bg-white/[0.04]"
              >
                Load Sample
              </button>
              <button
                type="button"
                onClick={handleRunPairwise}
                disabled={isComparing || !pairwiseDocA.trim() || !pairwiseDocB.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#0070F3] px-3 py-1 text-[11px] font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {isComparing ? (
                  <>
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Auditing...</span>
                  </>
                ) : (
                  <>
                    <Columns className="h-3.5 w-3.5" />
                    <span>Compare Documents</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {pairwiseError && (
            <div className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/10 p-2.5 text-xs text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{pairwiseError}</span>
            </div>
          )}

          {/* Pairwise Metric Cards (When Results Exist) */}
          {pairwiseResult && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/[0.06] dark:bg-[#12141A]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Overall Similarity</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-xl font-bold text-slate-900 dark:text-white">
                    {pairwiseResult.scores.overallSimilarity}%
                  </span>
                  <span
                    className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                      pairwiseResult.riskLevel === "High"
                        ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        : pairwiseResult.riskLevel === "Moderate"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                        : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                    }`}
                  >
                    {pairwiseResult.riskLevel} Risk
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/[0.06] dark:bg-[#12141A]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Identical 5-Grams</p>
                <p className="text-xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                  {pairwiseResult.scores.identicalPercentage}%
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Winnowing k=5, w=4</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/[0.06] dark:bg-[#12141A]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Paraphrased</p>
                <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mt-1">
                  {pairwiseResult.scores.paraphrasedPercentage}%
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">Semantic Cosine TF-IDF</p>
              </div>

              <div className="rounded-xl border border-slate-200/80 bg-white p-3 dark:border-white/[0.06] dark:bg-[#12141A]">
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Original Content</p>
                <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                  {pairwiseResult.scores.originalPercentage}%
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {pairwiseResult.matches.length} matched passage(s)
                </p>
              </div>
            </div>
          )}

          {/* Synchronized Dual Document Editor Panes */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-[360px]">
            {/* Document A (Draft) */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#12141A] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-blue-500" />
                  <input
                    type="text"
                    value={docAName}
                    onChange={(e) => setDocAName(e.target.value)}
                    className="font-medium bg-transparent border-none text-slate-900 dark:text-white text-xs focus:outline-none"
                    placeholder="Document A (Draft)"
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pairwiseDocA.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto">
                {pairwiseResult ? (
                  <div className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                    {/* Render Doc A with highlighted spans */}
                    {(() => {
                      const text = pairwiseDocA;
                      const spans = [...pairwiseResult.matches].sort((a, b) => a.docAStart - b.docAStart);
                      const elements: React.ReactNode[] = [];
                      let lastIdx = 0;

                      spans.forEach((span) => {
                        const start = Math.max(0, Math.min(span.docAStart, text.length));
                        const end = Math.max(start, Math.min(span.docAEnd, text.length));

                        if (start > lastIdx) {
                          elements.push(
                            <span key={`docA-plain-${lastIdx}-${start}`}>
                              {text.slice(lastIdx, start)}
                            </span>
                          );
                        }

                        const isSelected = selectedPairwiseMatchId === span.id;
                        const bgClass =
                          span.matchType === "identical"
                            ? isSelected
                              ? "bg-blue-500/40 border-b-2 border-blue-600"
                              : "bg-blue-500/20 border-b-2 border-blue-400"
                            : isSelected
                            ? "bg-purple-500/40 border-b-2 border-purple-600"
                            : "bg-purple-500/20 border-b-2 border-purple-400";

                        elements.push(
                          <mark
                            key={span.id}
                            onClick={() => setSelectedPairwiseMatchId(span.id)}
                            className={`cursor-pointer rounded-xs px-1 py-0.5 transition-all ${bgClass}`}
                            title={`Match ${span.id} (${span.matchType}, ${(span.similarity * 100).toFixed(0)}%)`}
                          >
                            {text.slice(start, end)}
                          </mark>
                        );
                        lastIdx = end;
                      });

                      if (lastIdx < text.length) {
                        elements.push(
                          <span key={`docA-plain-end`}>{text.slice(lastIdx)}</span>
                        );
                      }
                      return elements;
                    })()}
                  </div>
                ) : (
                  <textarea
                    value={pairwiseDocA}
                    onChange={(e) => setPairwiseDocA(e.target.value)}
                    placeholder="Paste Document A (your draft or submission to audit)..."
                    className="h-full w-full resize-none border-none bg-transparent font-sans text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
                  />
                )}
              </div>
            </div>

            {/* Document B (Reference) */}
            <div className="flex flex-col rounded-xl border border-slate-200 bg-white dark:border-white/[0.08] dark:bg-[#12141A] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/70 px-3 py-2 dark:border-white/[0.06] dark:bg-white/[0.02]">
                <div className="flex items-center gap-2">
                  <FileCheck className="h-3.5 w-3.5 text-purple-500" />
                  <input
                    type="text"
                    value={docBName}
                    onChange={(e) => setDocBName(e.target.value)}
                    className="font-medium bg-transparent border-none text-slate-900 dark:text-white text-xs focus:outline-none"
                    placeholder="Document B (Reference Source)"
                  />
                </div>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {pairwiseDocB.trim().split(/\s+/).filter(Boolean).length} words
                </span>
              </div>

              <div className="flex-1 p-3 overflow-y-auto">
                {pairwiseResult ? (
                  <div className="whitespace-pre-wrap leading-relaxed text-slate-800 dark:text-slate-200">
                    {/* Render Doc B with highlighted spans */}
                    {(() => {
                      const text = pairwiseDocB;
                      const spans = [...pairwiseResult.matches].sort((a, b) => a.docBStart - b.docBStart);
                      const elements: React.ReactNode[] = [];
                      let lastIdx = 0;

                      spans.forEach((span) => {
                        const start = Math.max(0, Math.min(span.docBStart, text.length));
                        const end = Math.max(start, Math.min(span.docBEnd, text.length));

                        if (start > lastIdx) {
                          elements.push(
                            <span key={`docB-plain-${lastIdx}-${start}`}>
                              {text.slice(lastIdx, start)}
                            </span>
                          );
                        }

                        const isSelected = selectedPairwiseMatchId === span.id;
                        const bgClass =
                          span.matchType === "identical"
                            ? isSelected
                              ? "bg-blue-500/40 border-b-2 border-blue-600"
                              : "bg-blue-500/20 border-b-2 border-blue-400"
                            : isSelected
                            ? "bg-purple-500/40 border-b-2 border-purple-600"
                            : "bg-purple-500/20 border-b-2 border-purple-400";

                        elements.push(
                          <mark
                            key={`b-${span.id}`}
                            onClick={() => setSelectedPairwiseMatchId(span.id)}
                            className={`cursor-pointer rounded-xs px-1 py-0.5 transition-all ${bgClass}`}
                            title={`Aligned Reference: Match ${span.id}`}
                          >
                            {text.slice(start, end) || span.textB}
                          </mark>
                        );
                        lastIdx = end;
                      });

                      if (lastIdx < text.length) {
                        elements.push(
                          <span key={`docB-plain-end`}>{text.slice(lastIdx)}</span>
                        );
                      }
                      return elements;
                    })()}
                  </div>
                ) : (
                  <textarea
                    value={pairwiseDocB}
                    onChange={(e) => setPairwiseDocB(e.target.value)}
                    placeholder="Paste Document B (the reference paper, published article, or previous draft to compare against)..."
                    className="h-full w-full resize-none border-none bg-transparent font-sans text-xs leading-relaxed text-slate-900 placeholder:text-slate-400 focus:outline-none dark:text-white"
                  />
                )}
              </div>
            </div>
          </div>

          {/* Reset Pairwise Button if result is shown */}
          {pairwiseResult && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setPairwiseResult(null)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-white/[0.08] dark:bg-[#12141A] dark:text-slate-300 dark:hover:bg-white/[0.04]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset Comparison / Edit Inputs</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
