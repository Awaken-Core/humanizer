import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Award, Heart, Lock, ShieldCheck, Sparkles, Users } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import styles from "@/app/content-page.module.css";

export const metadata: Metadata = {
  title: "About Us | Our Mission for Fair, Natural Writing",
  description:
    "Learn about Humanizer: our mission to provide free, accessible, privacy-first writing and text naturalization tools that defend writers from false AI detection.",
  alternates: {
    canonical: "/about",
  },
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.main}>
        <div className={styles.headerSection}>
          <span className={styles.badge}>Our Mission & Values</span>
          <h1 className={styles.title}>About Humanizer</h1>
          <p className={styles.description}>
            We believe that powerful writing tools should be open, ethical, and free for all writers,
            students, and creators—without predatory paywalls or privacy compromises.
          </p>
        </div>

        <section className={styles.card} aria-labelledby="our-mission">
          <h2 id="our-mission" className={styles.sectionTitle}>
            Democratizing Writing Excellence
          </h2>
          <p className={styles.text}>
            In recent years, the explosion of generative AI has transformed how people brainstorm and draft.
            Unfortunately, it also created an ecosystem of commercial tools charging upwards of $20–$30 every month
            just to unlock basic editing or imposing harsh 125-word paywalls.
          </p>
          <p className={styles.text}>
            Simultaneously, flawed AI detectors began penalizing honest students and non-native English speakers
            whose straightforward vocabulary was mistakenly flagged as machine-written.
          </p>
          <p className={styles.text}>
            Humanizer was engineered to solve both problems: a high-powered, completely free writing studio that
            gives every writer access to advanced text naturalization, AI detection review, summarization,
            originality checking, and grammar polishing.
          </p>
        </section>

        <section className={styles.card} aria-labelledby="core-pillars">
          <h2 id="core-pillars" className={styles.sectionTitle}>
            Our Core Pillars
          </h2>

          <div className={styles.grid3}>
            <div className={styles.featureBox}>
              <Heart className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>100% Free Forever</h3>
              <p>
                We do not gate essential tools behind paywalls. Every writer deserves access to clear, confident
                expression without monthly subscription barriers.
              </p>
            </div>

            <div className={styles.featureBox}>
              <Lock className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>Strict Data Privacy</h3>
              <p>
                Your writing belongs exclusively to you. All text processing executes statelessly in memory. We never
                log, harvest, or train AI models on user drafts.
              </p>
            </div>

            <div className={styles.featureBox}>
              <Award className="text-blue-600 dark:text-blue-400 size-6" />
              <h3>Precision & Authenticity</h3>
              <p>
                Our transformations preserve factual fidelity, numerical data, and meaning while diversifying syntax
                and cadence to sound genuinely human.
              </p>
            </div>
          </div>
        </section>

        <section className={styles.card} aria-labelledby="academic-integrity" id="academic-integrity">
          <h2 id="academic-integrity" className={styles.sectionTitle}>
            Advocating for Academic Fairness
          </h2>
          <p className={styles.text}>
            Empirical research conducted by Stanford University demonstrated that leading commercial AI detectors have
            a false-positive rate exceeding 61% when evaluating TOEFL essays authored by international students.
            Standardized grammar structures and non-native phrasing are routinely misidentified as machine generation.
          </p>
          <p className={styles.text}>
            Humanizer restores organic variation and rhythm to help innocent writers protect their academic reputation
            and present their authentic ideas with clarity.
          </p>
        </section>

        <div className={styles.ctaContainer}>
          <h2 className="text-2xl font-bold mb-3">Experience Humanizer Today</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Join thousands of writers turning mechanical drafts into words that truly connect.
          </p>
          <Link href="/workspace" className={styles.primaryButton}>
            Launch Free Studio <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

