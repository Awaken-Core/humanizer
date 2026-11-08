"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  ScanText,
  WandSparkles,
} from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import { InteractivePreview } from "@/components/landing/interactive-preview";
import { tools } from "@/lib/constants/landing-data";
import { PricingSection } from "@/components/landing/pricing-section";
import styles from "./landing.module.css";

const faqs = [
  [
    "What is Humanizer?",
    "Humanizer is a zero-paywall writing workspace engineered to transform mechanical, robotic, or AI-assisted drafts into natural, human-sounding writing. It includes tools for humanizing, AI detection, summarization, originality checking, grammar refinement, and paraphrasing.",
  ],
  [
    "Will humanizing change the meaning of my text?",
    "No. Humanizer uses deterministic linguistic adjustments and tone calibration designed specifically to preserve your facts, data, core arguments, and intention while removing predictable AI syntax patterns.",
  ],
  [
    "Can an AI detector prove who wrote something?",
    "No. Scientific studies, including research from Stanford University, show that AI detectors frequently produce false positives (exceeding 60% on non-native English writing). AI detection scores are stochastic pattern indicators, not proof of authorship.",
  ],
  [
    "Can I choose a writing style and intensity?",
    "Yes. The humanizer workspace allows you to select between natural, academic, professional, and casual modes, with adjustable rewriting intensity levels to fit your publication context.",
  ],
  [
    "Are all writing tools completely free?",
    "Yes! All core tools—AI Humanizer, AI Content Detector, Plagiarism Detector, Grammar & Accuracy, Paraphraser, and Summarizer—are free to use without mandatory subscriptions or restrictive 125-word paywalls.",
  ],
  [
    "Is my draft data logged or used for model training?",
    "No. We prioritize your privacy. Document and text transformations execute statelessly in memory. Your private writing, drafts, and research are never stored, logged, or fed into machine learning datasets.",
  ],
];

function SectionTitle({
  label,
  title,
  text,
}: {
  label: string;
  title: string;
  text: string;
}) {
  return (
    <div className={styles.sectionHeading}>
      <span className={styles.eyebrow}>{label}</span>
      <h2>{title}</h2>
      <p>{text}</p>
    </div>
  );
}

export default function HomePage() {
  return (
    <div className={styles.site} id="home" suppressHydrationWarning>
      <SiteHeader />

      <main className={styles.frame}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <Link className={styles.announcement} href="/#services">
            <span className={styles.statusDot} /> Your next great draft starts
            here <ArrowRight size={14} />
          </Link>
          <h1 id="hero-title">
            Good ideas deserve
            <br />
            <span>a human voice.</span>
          </h1>
          <p className={styles.heroDescription}>
            Write clearly. Sound like yourself. Your AI writing companion for
            turning first drafts into words that connect.
          </p>
          <div className={styles.heroActions}>
            <Link className={styles.button} href="/ai-humanizer">
              Start writing for free <ArrowRight size={17} />
            </Link>
            <Link
              className={`${styles.button} ${styles.secondaryButton}`}
              href="/how-it-works"
            >
              See how it works <span className={styles.play}>▶</span>
            </Link>
          </div>
          <div className={styles.heroNotes}>
            <span>
              <Check size={13} /> Totally free writing tools
            </span>
            <span>
              <Check size={13} /> Your voice, refined
            </span>
          </div>
        </section>

        {/* Interactive Tool Tabs & Preview Stage (Client Component) */}
        <InteractivePreview />

        <section className={styles.section} id="how-it-works">
          <SectionTitle
            label="HOW IT WORKS"
            title="From first thought to final draft."
            text="A simpler writing process. More room for your ideas."
          />
          <div className={styles.steps}>
            {[
              {
                title: "Bring your words.",
                text: "Paste a rough draft, an AI-assisted paragraph, or that sentence you just can’t get right.",
                icon: ScanText,
              },
              {
                title: "Make it your own.",
                text: "Choose your tone and rewriting intensity. Let Humanizer help you find a more natural flow.",
                icon: WandSparkles,
              },
              {
                title: "Give it the final say.",
                text: "Compare, review, and copy your refined draft. Your ideas. Your judgment. Your final word.",
                icon: CheckCheck,
              },
            ].map((step, i) => (
              <article key={step.title} className={styles.step}>
                <div className={styles.stepTop}>
                  <span>0{i + 1}</span>
                  <step.icon size={23} />
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} id="services">
          <SectionTitle
            label="THE WRITING TOOLKIT"
            title="Six tools. One stronger voice."
            text="From the first rewrite to the final check, a better way to work with words."
          />
          <div className={styles.services}>
            {tools.map((tool, i) => (
              <article className={styles.service} key={tool.name}>
                <div className={styles.serviceTop}>
                  <span className={styles.serviceIcon}>
                    <tool.icon size={23} strokeWidth={1.5} />
                  </span>
                  <span
                    className={
                      tool.live ? styles.liveBadge : styles.comingBadge
                    }
                  >
                    {tool.live ? "Available now" : "Coming soon"}
                  </span>
                </div>
                <span className={styles.serviceNumber}>
                  0{i + 1} / WRITING ASSISTANT
                </span>
                <h3>{tool.name}</h3>
                <p>{tool.description}</p>
                <Link
                  href={tool.live ? tool.href : "/#faq"}
                  className={styles.textLink}
                >
                  {tool.live ? `Open ${tool.short}` : "Learn more"}
                  <ArrowUpRight size={16} />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} id="pricing">
          <SectionTitle
            label="SIMPLE PRICING"
            title="Room for every kind of writer."
            text="Start with the essentials. More possibilities are on the way."
          />
          <PricingSection />
          <p className={styles.pricingNote}>
            Only the free humanizer is available today. Paid plans and
            additional tools are not yet available for purchase.
          </p>
        </section>

        <section className={`${styles.section} ${styles.faqSection}`} id="faq">
          <div className={styles.faqIntro}>
            <span className={styles.eyebrow}>A LITTLE CLARITY</span>
            <h2>
              Good questions.
              <br />
              Straight answers.
            </h2>
            <p>Everything you need to know before your next draft.</p>
            <Link className={styles.textLink} href="/ai-humanizer">
              Get to know Humanizer <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className={styles.faqList}>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className={styles.subFooter}>
          <div className={styles.ctaCard}>
            <div className={styles.ctaBars} aria-hidden="true">
              {Array.from({ length: 14 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    height: `${Math.round(36 + Math.pow(Math.abs(i - 6.5) / 6.5, 1.8) * 180)}px`,
                  }}
                />
              ))}
            </div>
            <div className={styles.ctaContent}>
              <span className={styles.eyebrow}>YOUR NEXT CHAPTER</span>
              <h2>Make every word feel like you.</h2>
              <p>Big ideas. Clearer sentences. A more human way to write.</p>
              <div className={styles.heroActions}>
                <Link
                  className={`${styles.button} ${styles.blueButton}`}
                  href="/ai-humanizer"
                >
                  Start writing for free <ArrowRight size={17} />
                </Link>
                <Link
                  className={`${styles.button} ${styles.secondaryButton}`}
                  href="/#services"
                >
                  Explore the toolkit
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
