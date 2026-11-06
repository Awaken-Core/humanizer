import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ChevronDown, HelpCircle } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import styles from "@/app/content-page.module.css";

export const metadata: Metadata = {
  title: "Frequently Asked Questions (FAQ) | Humanizer",
  description:
    "Get clear answers about AI humanizing, AI detector bypass, privacy, pricing, word limits, academic integrity, and how Humanizer preserves original meaning.",
  alternates: {
    canonical: "/faq",
  },
};

const faqData = [
  {
    q: "What is an AI humanizer and how does it work?",
    a: "An AI humanizer is a specialized writing system that transforms text flagged as machine-generated into natural, authentic human writing. It adjusts statistical features like perplexity (word predictability) and burstiness (sentence rhythm and length variance), replacing stereotypical AI phrasing with organic discourse transitions while preserving the author's core ideas, facts, and intent.",
  },
  {
    q: "Does humanizing change the facts, data, or meaning of my text?",
    a: "No. Humanizer is built with fact-retention guardrails. All numerical figures, dates, proper nouns, citations, and core factual arguments are preserved intact. Only sentence cadence, clause connections, and diction variety are naturalized.",
  },
  {
    q: "Can AI detectors like Turnitin, GPTZero, or CopyLeaks detect humanized text?",
    a: "When text is processed through Humanizer, predictable statistical tokens and n-gram patterns that detectors rely on are restructured. Because Humanizer introduces genuine lexical diversity and variable sentence lengths, detectors typically register the text as human-written.",
  },
  {
    q: "Are AI detectors 100% accurate?",
    a: "No. AI detection tools are statistical estimators and are inherently prone to false positives and false negatives. Peer-reviewed research from Stanford University demonstrated a false-positive rate over 61% when evaluating essays by non-native English speakers. Detection results should never be treated as definitive proof of authorship.",
  },
  {
    q: "Is Humanizer free to use? Are there hidden paywalls or word limits?",
    a: "Humanizer is 100% free to use. Unlike commercial tools that cap free users at 125 or 250 words and demand $20/month subscriptions, Humanizer supports up to 15,000 characters per request with zero subscription paywalls.",
  },
  {
    q: "Is my writing private and safe? Do you store or train on user text?",
    a: "Your privacy is paramount. Humanizer processes all documents and text statelessly in-memory. We never store, log, sell, or feed your writing drafts into machine learning models or third-party datasets.",
  },
  {
    q: "What writing styles and intensity modes are supported?",
    a: "Humanizer supports four primary writing modes: Natural (everyday clarity), Academic (formal research style with citation preservation), Professional (clean business communication), and Casual (warm, conversational prose). You can also adjust rewriting intensity across Low, Medium, and High settings.",
  },
  {
    q: "What other tools are included in the workspace?",
    a: "In addition to the AI Humanizer, the workspace includes: an AI Content Detector, a Summarizer for distilling long documents, a Plagiarism Detector to ensure originality, a Grammar & Accuracy reviewer, and an AI Paraphraser.",
  },
  {
    q: "Is using an AI humanizer ethical?",
    a: "Humanizer is designed as an editing and refinement companion to help writers communicate clearly and protect innocent writers (especially non-native English speakers) from flawed detection algorithms. Writers should always adhere to their institution's academic integrity policies and take personal responsibility for the factual accuracy of their work.",
  },
  {
    q: "How does Humanizer differ from QuillBot or Grammarly?",
    a: "QuillBot relies primarily on standard synonym swapping and restricts free users to 125 words behind expensive paywalls. Grammarly provides grammar suggestions but does not target AI perplexity or burstiness signatures. Humanizer specifically addresses statistical AI markers, offers 6 integrated tools, and provides generous limits at zero cost.",
  },
];

export default function FAQPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqData.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
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
          <span className={styles.badge}>
            <HelpCircle size={14} /> Clear Answers & Transparency
          </span>
          <h1 className={styles.title}>Frequently Asked Questions</h1>
          <p className={styles.description}>
            Everything you need to know about AI detection, text naturalization, privacy guarantees,
            and our free writing workspace.
          </p>
        </div>

        <section className={styles.card} aria-labelledby="faq-list-heading">
          <h2 id="faq-list-heading" className="sr-only">
            Questions and Answers
          </h2>
          <div>
            {faqData.map((faq, index) => (
              <details key={index} className={styles.faqItem} id={index === 8 ? "responsible-ai" : undefined}>
                <summary className={styles.faqQuestion}>
                  <span>{faq.q}</span>
                  <ChevronDown className="size-5 text-muted-foreground shrink-0 transition-transform duration-200" />
                </summary>
                <p className={styles.faqAnswer}>{faq.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className={styles.ctaContainer}>
          <h2 className="text-2xl font-bold mb-3">Have more questions or ready to write?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Try the workspace now and see the difference in your drafts.
          </p>
          <Link href="/workspace" className={styles.primaryButton}>
            Start Writing for Free <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

