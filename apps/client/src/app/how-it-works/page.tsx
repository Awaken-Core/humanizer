import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle, Cpu, Network, ShieldCheck, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { env } from "@/lib/env";
import styles from "@/app/content-page.module.css";

export const metadata: Metadata = {
  title: "How It Works | The Science of AI Text Naturalization",
  description:
    "Explore how Humanizer breaks mechanical AI detection patterns, improves perplexity and burstiness, and preserves 100% of your facts and meaning without generative hallucinations.",
  alternates: {
    canonical: "/how-it-works",
  },
};

export default function HowItWorksPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "How to Naturalize AI-Generated Writing with Humanizer",
    description:
      "A step-by-step guide explaining how Humanizer transforms machine-written text into natural human writing while preserving original meaning.",
    step: [
      {
        "@type": "HowToStep",
        name: "Input Your Draft",
        text: "Paste your raw text, essay, or AI-generated paragraph into the Humanizer workspace.",
        url: `${env.NEXT_PUBLIC_APP_BASE_URL}/workspace`,
      },
      {
        "@type": "HowToStep",
        name: "Select Tone & Intensity",
        text: "Choose between Natural, Academic, Professional, or Casual writing modes with customizable rewriting intensity.",
      },
      {
        "@type": "HowToStep",
        name: "Review & Compare Side-by-Side",
        text: "Compare original and humanized drafts with highlighted changes to ensure factual precision and voice authenticity.",
      },
    ],
  };

  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.main}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />

        <div className={styles.headerSection}>
          <span className={styles.badge}>Linguistic Engineering & AI Detection</span>
          <h1 className={styles.title}>How Humanizer Works</h1>
          <p className={styles.description}>
            Discover the mechanics behind AI text naturalization. Learn how we eliminate robotic
            syntax patterns, elevate sentence burstiness, and preserve your original ideas.
          </p>
        </div>

        <section className={styles.card} aria-labelledby="how-ai-detectors-work">
          <h2 id="how-ai-detectors-work" className={styles.sectionTitle}>
            How AI Detectors Flag Machine-Generated Text
          </h2>
          <p className={styles.text}>
            AI detectors like Turnitin, GPTZero, CopyLeaks, and ZeroGPT do not actually &quot;know&quot; who wrote a document.
            Instead, they compute mathematical heuristics across two core metrics:
          </p>

          <div className={styles.grid2}>
            <div className={styles.featureBox}>
              <Cpu className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>1. Perplexity (Word Unpredictability)</h3>
              <p>
                Perplexity measures how surprised a language model is by each subsequent word. AI models generate predictable,
                high-probability word pairings. When every sentence picks the statistically obvious token, perplexity drops,
                triggering AI alerts.
              </p>
            </div>

            <div className={styles.featureBox}>
              <Network className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>2. Burstiness (Sentence Rhythm Variance)</h3>
              <p>
                Human writers naturally alternate between punchy short statements, multi-clause explanations, and conversational
                transitions. Large language models tend to produce uniform sentence lengths and monotone structures.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="naturalization-pipeline">
          <h2 id="naturalization-pipeline" className={styles.sectionTitle}>
            Our Approach: Linguistic Naturalization Without Hallucination
          </h2>
          <p className={styles.text}>
            Traditional commercial paraphrasers often re-prompt large generative models, which introduces hallucinations, breaks
            technical formulas, and generates new AI artifacts. Humanizer takes a fundamentally different approach:
          </p>

          <div className={styles.grid3}>
            <div className={styles.featureBox}>
              <Sparkles className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>Discourse Connective Rotation</h3>
              <p>
                Replaces stereotypical AI transition markers (&quot;moreover&quot;, &quot;in conclusion&quot;, &quot;plays a pivotal role&quot;)
                with diverse, natural discourse patterns based on the Penn Discourse Treebank (PDTB 2.0).
              </p>
            </div>

            <div className={styles.featureBox}>
              <ShieldCheck className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>Semantic & Fact Retention</h3>
              <p>
                Guarantees numeric values, scientific names, direct quotes, and technical definitions remain untouched. Only
                surrounding sentence scaffolding is diversified.
              </p>
            </div>

            <div className={styles.featureBox}>
              <BookOpen className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>Syntactic Restructuring</h3>
              <p>
                Converts passive overuse into active voice, breaks monotonous clause lengths, and injects authentic sentence
                cadence matching human cognitive rhythm.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="three-step-workflow">
          <h2 id="three-step-workflow" className={styles.sectionTitle}>
            The 3-Step Humanizing Workflow
          </h2>
          <div className={styles.grid3}>
            <div className={styles.featureBox}>
              <div className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">01</div>
              <h3>Paste Your Draft</h3>
              <p>
                Input up to 15,000 characters per request. Work with essays, articles, blog drafts, or creative pieces.
              </p>
            </div>
            <div className={styles.featureBox}>
              <div className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">02</div>
              <h3>Choose Tone & Intensity</h3>
              <p>
                Select Natural, Academic, Professional, or Casual modes depending on your publication goals.
              </p>
            </div>
            <div className={styles.featureBox}>
              <div className="font-mono text-xl font-bold text-blue-600 dark:text-blue-400 mb-2">03</div>
              <h3>Compare & Finalize</h3>
              <p>
                Inspect real-time side-by-side diffs, check AI detection signals, and copy your polished human voice.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="false-positives-research">
          <h2 id="false-positives-research" className={styles.sectionTitle}>
            Why This Matters: Protecting Against False Positives
          </h2>
          <p className={styles.text}>
            In a landmark 2023 study published by Stanford University researchers (Liang et al.), leading AI detection software was
            found to have a <strong>false-positive rate exceeding 61%</strong> when assessing essays composed by non-native English
            speakers. Because ESL writers often rely on simpler, more standard sentence constructions, detectors wrongly label their
            authentic work as machine-generated.
          </p>
          <p className={styles.text}>
            Humanizer acts as an equalizer, restoring authentic stylistic variation and protecting honest students, writers, and
            researchers from unjust algorithmic accusations.
          </p>
        </section>

        <div className={styles.ctaContainer}>
          <h2 className="text-2xl font-bold mb-3">Ready to transform your draft?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Experience natural writing flow without restrictive word limits or paywalls.
          </p>
          <Link href="/workspace" className={styles.primaryButton}>
            Open Free Workspace <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

