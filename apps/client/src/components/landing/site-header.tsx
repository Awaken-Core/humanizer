"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Menu, X } from "lucide-react";
import { ModeToggle } from "@/components/theme-toggle";
import { HeaderAuth } from "@/components/header-auth";
import styles from "@/app/landing.module.css";

export function Starburst({
  size = 28,
  color = "currentColor",
  ...props
}: {
  size?: number;
  color?: string;
  [key: string]: unknown;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      viewBox="0 0 824 841"
      fill="none"
      role="img"
      aria-label="Starburst"
      style={{ display: "block", maxWidth: "100%", height: "auto" }}
      {...props}
    >
      <g stroke={color} strokeWidth="78" strokeLinecap="round">
        {Array.from({ length: 10 }, (_, index) => (
          <line
            key={index}
            x1="412"
            y1="420.5"
            x2="412"
            y2="39"
            transform={`rotate(${index * 36} 412 420.5)`}
          />
        ))}
      </g>
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" aria-label="Humanizer home" className={styles.brand}>
      <Starburst size={28} /> humanizer
      <span className={styles.brandDot}>.</span>
    </Link>
  );
}

const navLinks = [
  { label: "Home", href: "/" },
  { label: "How it works", href: "/how-it-works" },
  { label: "About", href: "/about" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQs", href: "/faq" },
];

export function SiteHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <Brand />
        <nav aria-label="Main navigation" className={styles.desktopNav}>
          {navLinks.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className={styles.headerActions}>
          <ModeToggle />
          <div className={styles.auth}>
            <HeaderAuth />
          </div>
          <Link
            className={`${styles.button} ${styles.smallButton}`}
            href="/ai-humanizer"
          >
            Get started <ArrowUpRight size={15} />
          </Link>
          <button
            className={styles.menuButton}
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen(!mobileOpen)}
            type="button"
          >
            {mobileOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>
      {mobileOpen && (
        <nav className={styles.mobileNav} aria-label="Mobile navigation">
          {[
            ...navLinks,
            { label: "Workspace Studio", href: "/ai-humanizer" },
            { label: "QuillBot Alternative", href: "/compare/quillbot-alternative" },
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}

