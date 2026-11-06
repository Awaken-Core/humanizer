import Link from "next/link";
import { Mail } from "lucide-react";
import { ModeToggle } from "@/components/theme-toggle";
import { Brand } from "./site-header";
import styles from "@/app/landing.module.css";

const footerSections = [
  {
    title: "Explore",
    links: [
      { label: "Home", href: "/" },
      { label: "How it works", href: "/how-it-works" },
      { label: "Our tools", href: "/#services" },
      { label: "Pricing", href: "/#pricing" },
      { label: "FAQs", href: "/faq" },
      { label: "About us", href: "/about" },
    ],
  },
  {
    title: "Writing tools",
    links: [
      { label: "AI Humanizer", href: "/workspace" },
      { label: "AI Content Detector", href: "/workspace" },
      { label: "Summarizer", href: "/workspace" },
      { label: "Plagiarism Detector", href: "/workspace" },
      { label: "Grammar & Accuracy", href: "/workspace" },
      { label: "AI Paraphraser", href: "/workspace" },
    ],
  },
  {
    title: "Comparisons",
    links: [
      { label: "QuillBot Alternative", href: "/compare/quillbot-alternative" },
      { label: "StealthGPT Alternative", href: "/compare/stealthgpt-alternative" },
      { label: "Free vs Paid Humanizers", href: "/compare/quillbot-alternative#comparison-table" },
      { label: "Detection Evasion Guide", href: "/how-it-works#detection-mechanics" },
    ],
  },
  {
    title: "Trust & Legal",
    links: [
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Responsible AI", href: "/faq#responsible-ai" },
      { label: "LLMs Index (AEO)", href: "/llms.txt" },
    ],
  },
];

export function SiteFooter() {
  return (
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
          <Link
            href="/workspace"
            className={styles.footerMail}
            aria-label="Open your writing workspace"
          >
            <Mail size={17} />
          </Link>
        </div>
        {footerSections.map((group) => (
          <div className={styles.footerGroup} key={group.title}>
            <h3>{group.title}</h3>
            {group.links.map((link) => (
              <Link key={link.label} href={link.href}>
                {link.label}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <div className={styles.footerBottom}>
        <p>
          © {new Date().getFullYear()} Humanizer. Made for the way you write.
        </p>
        <div>
          <Link href="/faq#responsible-ai">Responsible AI</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <span>English</span>
          <ModeToggle />
        </div>
      </div>
    </footer>
  );
}

