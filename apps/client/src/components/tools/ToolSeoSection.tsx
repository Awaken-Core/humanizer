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
      className={styles.seoSection}
      aria-label={`${config.name} overview and documentation`}
    >
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* SEO Section Header */}
      <div className={styles.seoHeader}>
        <div className={styles.seoBadge}>
          <Sparkles size={14} />
          <span>{config.badge}</span>
        </div>
        <h2 className={styles.seoH2}>{config.h1}</h2>
        <p className={styles.seoSubtitle}>{config.subtitle}</p>
      </div>

      {/* How It Works (Step-by-Step) */}
      <div className={styles.seoBlock}>
        <h3 className={styles.seoBlockTitle}>
          <CheckCircle2 size={18} />
          <span>How to use {config.name}</span>
        </h3>
        <div className={styles.stepsGrid}>
          {config.howItWorks.map((item) => (
            <div key={item.step} className={styles.stepCard}>
              <div className={styles.stepNumber}>{item.step}</div>
              <h4 className={styles.stepTitle}>{item.title}</h4>
              <p className={styles.stepDescription}>{item.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key Capabilities */}
      <div className={styles.seoBlock}>
        <h3 className={styles.seoBlockTitle}>
          <Layers size={18} />
          <span>Key Capabilities</span>
        </h3>
        <div className={styles.featuresGrid}>
          {config.features.map((feature) => (
            <div key={feature.title} className={styles.featureCard}>
              <h4 className={styles.featureTitle}>{feature.title}</h4>
              <p className={styles.featureDescription}>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className={styles.seoBlock}>
        <h3 className={styles.seoBlockTitle}>
          <HelpCircle size={18} />
          <span>Frequently Asked Questions</span>
        </h3>
        <div className={styles.faqList}>
          {config.faqs.map((faq, index) => (
            <details
              key={faq.question}
              className={styles.faqItem}
              open={index === 0}
            >
              <summary className={styles.faqSummary}>
                <span>{faq.question}</span>
                <ChevronDown size={16} />
              </summary>
              <p className={styles.faqAnswer}>{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>

      {/* Cross-Tool Links */}
      <div className={styles.seoBlock}>
        <h3 className={styles.seoBlockTitle}>
          <Sparkles size={18} />
          <span>Explore More AI Writing Tools</span>
        </h3>
        <div className={styles.crossToolsGrid}>
          {otherTools.map((tool) => (
            <Link
              key={tool.slug}
              href={`/${tool.slug}`}
              className={styles.crossToolCard}
            >
              <span className={styles.crossToolName}>
                <span>{tool.name}</span>
                <ArrowRight size={13} />
              </span>
              <p className={styles.crossToolDesc}>{tool.description}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
