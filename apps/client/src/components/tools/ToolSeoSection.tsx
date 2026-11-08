import React from "react";
import Link from "next/link";
import {
  type ToolSeoConfig,
  SEO_TOOLS_CONFIG,
  buildToolJsonLd,
} from "@/lib/seo-data";
import {
  Sparkles,
  ChevronDown,
  ArrowRight,
  Layers,
  HelpCircle,
  CheckCircle2,
} from "lucide-react";
import styles from "@/components/workspace/workspace.module.css";

interface ToolSeoSectionProps {
  config: ToolSeoConfig;
}

export function ToolSeoSection({ config }: ToolSeoSectionProps) {
  const jsonLd = buildToolJsonLd(config);

  const otherTools = Object.values(SEO_TOOLS_CONFIG).filter(
    (t) => t.slug !== config.slug,
  );

  return (
    <section
      className={`${styles.seoSection} w-full max-w-[1440px] mx-auto mt-16 pt-12 border-t border-slate-200 dark:border-white/[0.08] flex flex-col gap-14`}
      aria-label={`${config.name} overview and documentation`}
    >
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* SEO Section Header */}
      <div className="text-center max-w-3xl mx-auto flex flex-col items-center gap-3.5 px-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#5555ff]/10 text-[#5555ff] border border-[#5555ff]/25">
          <Sparkles className="w-3.5 h-3.5 text-[#5555ff]" />
          <span>{config.badge}</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 dark:text-white leading-tight m-0">
          {config.h1}
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed max-w-2xl m-0">
          {config.subtitle}
        </p>
      </div>

      {/* How It Works (Step-by-Step) */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
          <CheckCircle2 className="w-4 h-4 text-[#5555ff]" />
          <span>How to use {config.name}</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {config.howItWorks.map((item) => (
            <div
              key={item.step}
              className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12141a] p-5 flex flex-col gap-3 shadow-xs"
            >
              <div className="w-7 h-7 rounded-lg bg-[#5555ff]/10 text-[#5555ff] border border-[#5555ff]/20 font-bold text-xs flex items-center justify-center shrink-0">
                {item.step}
              </div>
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white m-0">
                {item.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed m-0">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Key Capabilities */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
          <Layers className="w-4 h-4 text-[#5555ff]" />
          <span>Key Capabilities</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {config.features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12141a] p-5 flex flex-col gap-2.5 shadow-xs"
            >
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white m-0">
                {feature.title}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed m-0">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
          <HelpCircle className="w-4 h-4 text-[#5555ff]" />
          <span>Frequently Asked Questions</span>
        </h3>
        <div className="flex flex-col gap-2.5 max-w-4xl mx-auto w-full">
          {config.faqs.map((faq, index) => (
            <details
              key={faq.question}
              className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-white dark:bg-[#12141a] overflow-hidden transition-colors group shadow-xs"
              open={index === 0}
            >
              <summary className="flex items-center justify-between gap-4 p-4 sm:px-5 cursor-pointer font-medium text-xs sm:text-sm text-slate-900 dark:text-white select-none list-none">
                <span>{faq.question}</span>
                <ChevronDown
                  size={16}
                  className="text-slate-400 group-open:rotate-180 transition-transform duration-200 shrink-0"
                />
              </summary>
              <p className="px-4 pb-4 sm:px-5 text-xs text-slate-600 dark:text-slate-400 leading-relaxed m-0 border-t border-slate-100 dark:border-white/[0.04] pt-3">
                {faq.answer}
              </p>
            </details>
          ))}
        </div>
      </div>

      {/* Cross-Tool Links */}
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white flex items-center gap-2 m-0">
          <Sparkles className="w-4 h-4 text-[#5555ff]" />
          <span>Explore More AI Writing Tools</span>
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {otherTools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/${tool.slug}`}
              className="rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50 dark:bg-[#12141a] hover:bg-white dark:hover:bg-[#191c24] hover:border-[#5555ff]/40 p-4 flex flex-col gap-2 transition-all duration-150 group shadow-xs"
            >
              <span className="text-xs font-semibold text-slate-900 dark:text-white flex items-center justify-between">
                <span>{tool.name}</span>
                <ArrowRight
                  size={13}
                  className="text-[#5555ff] group-hover:translate-x-0.5 transition-transform"
                />
              </span>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed m-0 line-clamp-2">
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
