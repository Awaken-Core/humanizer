"use client";

import React, { useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { HeaderAuth } from "@/components/header-auth";
import { ModeToggle } from "@/components/theme-toggle";
import { useSession } from "@/lib/auth-client";
import { type ToolId } from "@/lib/tool-registry";
import {
  PanelsTopLeft,
  LayoutDashboard,
  Fingerprint,
  ShieldAlert,
  ScanText,
  Languages,
  ListFilter,
  FileCheck2,
} from "lucide-react";
import styles from "@/components/workspace/workspace.module.css";

const SERVICE_ICONS: Record<ToolId, React.ComponentType<{ size?: number }>> = {
  humanizer: Fingerprint,
  "plagiarism-checker": ShieldAlert,
  "ai-detector": ScanText,
  paraphraser: Languages,
  summarizer: ListFilter,
  "grammar-checker": FileCheck2,
};

const TOOL_ROUTES: { service: ToolId; path: string; label: string }[] = [
  { service: "humanizer", path: "/ai-humanizer", label: "Humanizer" },
  { service: "plagiarism-checker", path: "/plagiarism-checker", label: "Plagiarism checker" },
  { service: "ai-detector", path: "/ai-detector", label: "AI detector" },
  { service: "paraphraser", path: "/paraphraser", label: "Paraphraser" },
  { service: "summarizer", path: "/summarizer", label: "Summarizer" },
  { service: "grammar-checker", path: "/grammar-checker", label: "Grammar checker" },
];

export default function ToolsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const mainRef = useRef<HTMLElement>(null);

  // Auto-scroll to top of editor area when switching tools
  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTo({ top: 0, behavior: "instant" });
    }
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className={styles.workspacePage}>
      {/* Topbar */}
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand} aria-label="Humanizer home">
          <Image
            alt=""
            src="/image/logo.svg"
            height={28}
            width={28}
            className={styles.brandLogo}
          />
          <span>
            humanizer<span className={styles.brandDot}>.</span>
          </span>
        </Link>

        <nav className={styles.routeSwitch} aria-label="Workspace navigation">
          <Link href={pathname || "/ai-humanizer"} className={styles.activeRoute}>
            <PanelsTopLeft size={15} /> Workspace
          </Link>
          {session?.user ? (
            <Link href="/board">
              <LayoutDashboard size={15} /> Board
            </Link>
          ) : (
            <button
              type="button"
              onClick={() =>
                window.dispatchEvent(new Event("country-rank:open-sign-in"))
              }
              title="Sign in to open your board"
            >
              <LayoutDashboard size={15} /> Board
              <span className={styles.locked}>Sign in</span>
            </button>
          )}
        </nav>

        <div className={styles.topActions}>
          <ModeToggle />
        </div>
      </header>

      {/* Main Workspace Body */}
      <div className={styles.workspaceBody}>
        {/* Persistent Left Sidebar */}
        <aside className={styles.serviceRail} aria-label="Writing services">
          <div className={styles.railHeading}>Tools</div>
          <nav className={styles.serviceNav}>
            {TOOL_ROUTES.map((item) => {
              const Icon = SERVICE_ICONS[item.service];
              const isActive = pathname === item.path;
              return (
                <Link
                  key={item.service}
                  href={item.path}
                  className={`${styles.serviceNavItem} ${isActive ? styles.activeService : ""}`}
                  title={item.label}
                >
                  <Icon size={18} />
                  <span className={styles.serviceNavLabel}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className={styles.railAccount}>
            <HeaderAuth compact />
            <div className={styles.accountCopy}>
              <strong>{session?.user?.name || "Guest writer"}</strong>
              <span>{session?.user?.email || "Sign in for your board"}</span>
            </div>
          </div>
        </aside>

        {/* Scrollable Editor & Content Area */}
        <main className={styles.editorArea} ref={mainRef}>
          {children}
        </main>
      </div>
    </div>
  );
}

