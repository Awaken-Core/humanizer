"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCheck,
  FileCheck2,
  Fingerprint,
  Languages,
  ListFilter,
  ScanText,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "./site-header";
import { tools } from "@/lib/constants/landing-data";
import styles from "@/app/landing.module.css";

export function InteractivePreview() {
  const [activeTool, setActiveTool] = useState(0);
  const [previewPaused, setPreviewPaused] = useState(false);

  useEffect(() => {
    if (
      previewPaused ||
      typeof window === "undefined" ||
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
    <>
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
        tabIndex={0}
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
        {/* Semantic H2 to fix PageSpeed heading hierarchy before H3 */}
        <h2 className="sr-only">Interactive Writing Studio Preview</h2>

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
                  type="button"
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
                  href={active.live ? (active.href || "/ai-humanizer") : "/#services"}
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
    </>
  );
}
