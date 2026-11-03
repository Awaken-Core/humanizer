"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCheck,
  ChevronDown,
  FileCheck2,
  Fingerprint,
  Languages,
  ListFilter,
  Mail,
  Menu,
  ScanText,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  X,
} from "lucide-react";
import { ModeToggle } from "@/components/theme-toggle";
import { HeaderAuth } from "@/components/header-auth";
import styles from "./landing.module.css";

const tools = [
  {
    name: "AI Humanizer",
    short: "Humanize",
    icon: Fingerprint,
    description:
      "Turn mechanical drafts into natural writing. Keep your meaning. Find your voice.",
    detail: "Natural rhythm. Your original meaning.",
    live: true,
  },
  {
    name: "AI Content Detector",
    short: "Detect",
    icon: ScanText,
    description:
      "Explore signals of AI-generated writing and understand where a draft needs a human touch.",
    detail: "A closer look at how your content reads.",
    live: true,
  },
  {
    name: "Summarizer",
    short: "Summarize",
    icon: ListFilter,
    description:
      "Find the essential ideas in a long document, then make every sentence work harder.",
    detail: "Less noise. More meaning.",
    live: true,
  },
  {
    name: "Plagiarism Detector",
    short: "Check originality",
    icon: ShieldCheck,
    description:
      "Review potential overlaps and give original ideas the attention and attribution they deserve.",
    detail: "Make originality part of your process.",
    live: true,
  },
  {
    name: "Grammar & Accuracy",
    short: "Refine",
    icon: FileCheck2,
    description:
      "Catch awkward phrasing, sharpen your grammar, and review claims before you hit publish.",
    detail: "Small improvements. A stronger impression.",
    live: true,
  },
  {
    name: "AI Paraphraser",
    short: "Paraphrase",
    icon: Languages,
    description:
      "Explore a fresh way to say it. Adjust your tone and structure without losing the point.",
    detail: "A different expression. The same intention.",
    live: true,
  },
];
const faqs = [
  [
    "What is Humanizer?",
    "Humanizer is a writing workspace designed to help you turn rough or AI-assisted drafts into clearer, more natural writing. Our humanizer is available now, with detection, summarization, originality, grammar, and paraphrasing tools planned.",
  ],
  [
    "Will humanizing change the meaning of my text?",
    "The humanizer is designed to preserve your meaning, facts, and numbers while improving flow and phrasing. Always review the result, especially for technical, academic, or sensitive material.",
  ],
  [
    "Can an AI detector prove who wrote something?",
    "No. AI detection can produce false positives and false negatives. Detection results should be treated as a signal for further review, never as proof of authorship.",
  ],
  [
    "Can I choose a writing style?",
    "Yes. The humanizer offers natural, academic, professional, and casual modes, with low, medium, or high rewriting intensity.",
  ],
  [
    "Are all six writing tools available?",
    "Yes! All six tools—AI Humanizer, AI Content Detector, Plagiarism Detector, Grammar & Accuracy, Paraphraser, and Summarizer—are fully available and accessible in the workspace studio.",
  ],
  [
    "Should I review AI-assisted writing before publishing?",
    "Yes. Review facts, citations, originality, and tone yourself. Writing assistance can help you edit, but it does not replace your judgment or the rules of your school or workplace.",
  ],
];
const footerGroups = [
  {
    title: "Explore",
    links: [
      ["Home", "#home"],
      ["How it works", "#how-it-works"],
      ["Our tools", "#services"],
      ["Pricing", "#pricing"],
      ["FAQs", "#faq"],
    ],
  },
  {
    title: "Writing tools",
    links: tools.map((tool) => [
      tool.name,
      tool.live ? "/workspace" : "#services",
    ]),
  },
  {
    title: "Made for",
    links: [
      ["Everyday writing", "#services"],
      ["Academic writing", "/workspace"],
      ["Professional writing", "/workspace"],
      ["Content creators", "#services"],
      ["Teams & businesses", "#pricing"],
    ],
  },
  {
    title: "Humanizer",
    links: [
      ["Our approach", "#how-it-works"],
      ["Responsible AI", "#faq"],
      ["Plans & availability", "#pricing"],
      ["Start writing", "/workspace"],
    ],
  },
];

function Brand() {
  return (
    <Link href="/" aria-label="Humanizer home" className={styles.brand}>
      <span className={styles.brandMark}>✳</span> humanizer
      <span className={styles.brandDot}>.</span>
    </Link>
  );
}
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeTool, setActiveTool] = useState(0);
  const [annual, setAnnual] = useState(false);
  const [previewPaused, setPreviewPaused] = useState(false);

  useEffect(() => {
    if (
      previewPaused ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const timer = window.setInterval(() => {
      if (!document.hidden) {
        setActiveTool((current) => (current + 1) % tools.length);
      }
    }, 5000);

    return () => window.clearInterval(timer);
  }, [activeTool, previewPaused]);
  const active = tools[activeTool];
  return (
    <div className={styles.site} id="home">
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Brand />
          <nav aria-label="Main navigation" className={styles.desktopNav}>
            <a href="#home">Home</a>
            <a href="#how-it-works">How it works</a>
            <a href="#services">Services</a>
            <a href="#pricing">Pricing</a>
            <a href="#faq">FAQs</a>
          </nav>
          <div className={styles.headerActions}>
            <ModeToggle />
            <div className={styles.auth}>
              <HeaderAuth />
            </div>
            <Link
              className={`${styles.button} ${styles.smallButton}`}
              href="/workspace"
            >
              Get started <ArrowUpRight size={15} />
            </Link>
            <button
              className={styles.menuButton}
              aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen(!mobileOpen)}
            >
              {mobileOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {mobileOpen && (
          <nav className={styles.mobileNav} aria-label="Mobile navigation">
            {[
              ["Home", "#home"],
              ["How it works", "#how-it-works"],
              ["Services", "#services"],
              ["Pricing", "#pricing"],
              ["FAQs", "#faq"],
            ].map(([label, href]) => (
              <a key={href} href={href} onClick={() => setMobileOpen(false)}>
                {label}
                <ArrowUpRight size={16} />
              </a>
            ))}
          </nav>
        )}
      </header>
      <main className={styles.frame}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <a className={styles.announcement} href="#services">
            <span className={styles.statusDot} /> Your next great draft starts
            here <ArrowRight size={14} />
          </a>
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
            <Link className={styles.button} href="/workspace">
              Start writing for free <ArrowRight size={17} />
            </Link>
            <a
              className={`${styles.button} ${styles.secondaryButton}`}
              href="#how-it-works"
            >
              See how it works <span className={styles.play}>▶</span>
            </a>
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
        <div
          className={styles.toolTabs}
          onMouseEnter={() => setPreviewPaused(true)}
          onMouseLeave={() => setPreviewPaused(false)}
          onFocusCapture={() => setPreviewPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPreviewPaused(false);
            }
          }}
          role="tablist"
          aria-label="Explore writing tools"
        >
          {tools.map((tool, i) => (
            <button
              key={tool.name}
              id={`tool-tab-${i}`}
              type="button"
              role="tab"
              aria-selected={activeTool === i}
              aria-controls="tool-preview"
              tabIndex={activeTool === i ? 0 : -1}
              onKeyDown={(event) => {
                if (
                  ["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tools.length - 1
                        : (activeTool +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            tools.length) %
                          tools.length;
                  setActiveTool(next);
                  document.getElementById(`tool-tab-${next}`)?.focus();
                }
              }}
              onClick={() => setActiveTool(i)}
              className={activeTool === i ? styles.activeTab : ""}
            >
              <tool.icon size={17} />
              {tool.short}
            </button>
          ))}
        </div>
        <section
          className={styles.previewStage}
          onMouseEnter={() => setPreviewPaused(true)}
          onMouseLeave={() => setPreviewPaused(false)}
          onFocusCapture={() => setPreviewPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) {
              setPreviewPaused(false);
            }
          }}
          id="tool-preview"
          role="tabpanel"
          aria-labelledby={`tool-tab-${activeTool}`}
        >
          <div className={styles.previewWindow}>
            <div className={styles.windowTop}>
              <div className={styles.windowDots}>
                <i />
                <i />
                <i />
              </div>
              <span>Humanizer workspace</span>
              <span className={styles.previewBadge}>
                {active.live ? "Live workspace" : "Product preview"}
              </span>
            </div>
            <div className={styles.workspace}>
              <aside className={styles.workspaceSidebar}>
                <Brand />
                <span className={styles.sidebarLabel}>
                  YOUR WRITING TOOLKIT
                </span>
                {tools.map((tool, i) => (
                  <button
                    key={tool.name}
                    onClick={() => setActiveTool(i)}
                    className={activeTool === i ? styles.sidebarActive : ""}
                  >
                    <tool.icon size={16} />
                    <span>{tool.name}</span>
                    {!tool.live && <span className={styles.soonDot} />}
                  </button>
                ))}
                <div className={styles.sidebarBottom}>
                  <span className={styles.avatar}>Y</span>
                  <div>
                    Your workspace<small>A little help. A lot more you.</small>
                  </div>
                </div>
              </aside>
              <div key={activeTool} className={styles.editorPreview}>
                <div className={styles.editorHeading}>
                  <div>
                    <span className={styles.eyebrow}>
                      MAKE EVERY WORD COUNT
                    </span>
                    <h3>{active.name}</h3>
                  </div>
                  <span className={styles.draftBadge}>Draft 01</span>
                </div>
                <div className={styles.editorToolbar}>
                  <span>
                    <span className={styles.blueDot} />
                    {active.live ? "Natural" : "Preview"}
                  </span>
                  <span>{active.detail}</span>
                </div>
                <div className={styles.editorColumns}>
                  <div>
                    <div className={styles.editorLabel}>
                      YOUR DRAFT <span>48 words</span>
                    </div>
                    <p>
                      In today’s fast-paced digital landscape, effective
                      communication plays a pivotal role in fostering meaningful
                      connections.
                    </p>
                    <p>
                      It is imperative to leverage innovative solutions to
                      enhance the overall quality of written content and ensure
                      that the intended message resonates with the target
                      audience.
                    </p>
                    <span className={styles.sampleLabel}>
                      Illustrative example
                    </span>
                  </div>
                  <div>
                    <div className={styles.editorLabel}>
                      A HUMAN TOUCH <Sparkles size={14} />
                    </div>
                    <p>Good writing brings people together.</p>
                    <p>
                      Whether you’re sharing an idea or telling a story, the
                      right words make all the difference. A little thoughtful
                      editing can help your message feel clearer, warmer, and
                      more like you.
                    </p>
                    <div className={styles.editNote}>
                      <CheckCheck size={15} /> Clearer sentences. Same
                      intention.
                    </div>
                  </div>
                </div>
                <div className={styles.editorBottom}>
                  <span>
                    <ShieldCheck size={14} /> You stay in control of the final
                    draft.
                  </span>
                  <Link
                    href={active.live ? "/workspace" : "#services"}
                    className={`${styles.button} ${styles.blueButton}`}
                  >
                    {active.name === "AI Humanizer" ? "Humanize your text" : `Open ${active.name}`}
                    <ArrowRight size={15} />
                  </Link>
                </div>
              </div>
            </div>
          </div>
          <p className={styles.previewCaption}>
            A little less artificial. A lot more you.
          </p>
        </section>
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
                <a
                  href={tool.live ? "/workspace" : "#faq"}
                  className={styles.textLink}
                >
                  {tool.live ? `Open ${tool.short}` : "Learn more"}
                  <ArrowUpRight size={16} />
                </a>
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
          <div
            className={styles.billingSwitch}
            aria-label="Preview billing period"
          >
            <button
              aria-pressed={!annual}
              className={!annual ? styles.selectedBilling : ""}
              onClick={() => setAnnual(false)}
            >
              Monthly
            </button>
            <button
              aria-pressed={annual}
              className={annual ? styles.selectedBilling : ""}
              onClick={() => setAnnual(true)}
            >
              Yearly
            </button>
          </div>
          <div className={styles.pricingGrid}>
            {[
              {
                name: "Free",
                description: "For your next great first draft.",
                price: "$0",
                features: [
                  "AI humanizer workspace",
                  "Four writing modes",
                  "Three rewriting intensities",
                  "Up to 15,000 characters per request",
                  "Side-by-side draft comparison",
                ],
                cta: "Start writing for free",
                live: true,
              },
              {
                name: "Pro",
                description: "For the words you work on every day.",
                price: "Coming soon",
                features: [
                  "Expanded writing toolkit",
                  "Higher writing limits",
                  "Advanced style controls",
                  "Long-form writing support",
                  "Plan details announced at launch",
                ],
                cta: "Explore what’s coming",
                featured: true,
              },
              {
                name: "Teams",
                description: "For people who write better together.",
                price: "Let’s grow",
                features: [
                  "A shared writing experience",
                  "Consistent team voice",
                  "Collaborative workflows",
                  "Flexible usage options",
                  "Availability to be announced",
                ],
                cta: "View the roadmap",
              },
            ].map((plan) => (
              <article
                key={plan.name}
                className={`${styles.plan} ${plan.featured ? styles.featuredPlan : ""}`}
              >
                {plan.featured && (
                  <span className={styles.planRibbon}>THE NEXT CHAPTER</span>
                )}
                <h3>{plan.name}</h3>
                <p>{plan.description}</p>
                <div className={styles.planPrice}>
                  {plan.price}
                  {plan.live && <small>/ forever</small>}
                </div>
                <span className={styles.planBilling}>
                  {plan.live
                    ? "No subscription required"
                    : `${annual ? "Annual" : "Monthly"} pricing announced at launch`}
                </span>
                <Link
                  href={plan.live ? "/workspace" : "#services"}
                  className={`${styles.button} ${plan.featured ? styles.blueButton : styles.secondaryButton}`}
                >
                  {plan.cta}
                  <ArrowRight size={15} />
                </Link>
                <div className={styles.planDivider} />
                <span className={styles.includes}>
                  {plan.live ? "YOUR STARTING POINT" : "PLANNED FEATURES"}
                </span>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
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
            <Link className={styles.textLink} href="/workspace">
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
              {Array.from({ length: 28 }, (_, i) => (
                <span
                  key={i}
                  style={{
                    height: `${Math.round(32 + Math.pow(Math.abs(i - 13.5) / 13.5, 1.8) * 190)}px`,
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
                  href="/workspace"
                >
                  Start writing for free <ArrowRight size={17} />
                </Link>
                <a
                  className={`${styles.button} ${styles.secondaryButton}`}
                  href="#services"
                >
                  Explore the toolkit
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className={styles.footer}>
        <div className={styles.footerMain}>
          <div className={styles.footerBrand}>
            <Brand />
            <p>
              Good ideas deserve a human voice.
              <br />
              Thoughtful writing tools for clearer words,
              <br />
              stronger ideas, and a little more you.
            </p>
            <a
              href="/workspace"
              className={styles.footerMail}
              aria-label="Open your writing workspace"
            >
              <Mail size={17} />
            </a>
          </div>
          {footerGroups.map((group) => (
            <div className={styles.footerGroup} key={group.title}>
              <h3>{group.title}</h3>
              {group.links.map(([label, href]) => (
                <a key={label} href={href}>
                  {label}
                </a>
              ))}
            </div>
          ))}
        </div>
        <div className={styles.footerBottom}>
          <p>
            © {new Date().getFullYear()} Humanizer. Made for the way you write.
          </p>
          <div>
            <a href="#faq">Responsible AI</a>
            <a href="#pricing">Pricing</a>
            <a href="#services">Our tools</a>
            <span>English</span>
            <ModeToggle />
          </div>
        </div>
      </footer>
    </div>
  );
}
