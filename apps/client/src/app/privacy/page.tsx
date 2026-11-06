import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Lock, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/landing/site-header";
import { SiteFooter } from "@/components/landing/site-footer";
import styles from "@/app/content-page.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy | Zero Data Retention Commitment",
  description:
    "Learn about Humanizer's strict privacy policy: in-memory stateless processing, zero user draft retention, and no training on user text.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <div className={styles.page}>
      <SiteHeader />

      <main className={styles.main}>
        <div className={styles.headerSection}>
          <span className={styles.badge}>
            <ShieldCheck size={14} /> Legal &amp; Data Protection
          </span>
          <h1 className={styles.title}>Privacy Policy</h1>
          <p className={styles.description}>
            Your privacy is our foundational principle. We do not store, log, sell, or train AI models
            on your private drafts, essays, or research.
          </p>
        </div>

        <article className={styles.card}>
          <h2 className={styles.sectionTitle}>1. Zero-Data-Retention for User Drafts</h2>
          <p className={styles.text}>
            When you submit text or documents to Humanizer for text transformation, AI detection, summarization,
            or grammar analysis, your content is processed <strong>statelessly in volatile memory (RAM)</strong>.
            Once the transformed response is returned to your browser, your draft is immediately wiped from memory.
          </p>
          <p className={styles.text}>
            We do not maintain server-side logs of your content, and we do not store your documents in any permanent
            database.
          </p>

          <h2 className={styles.sectionTitle}>2. No Model Training on Your Writing</h2>
          <p className={styles.text}>
            Under no circumstances is your writing, source code, research draft, or personal communication ever used
            to train, fine-tune, or evaluate machine learning models. Your intellectual property remains 100% yours.
          </p>

          <h2 className={styles.sectionTitle}>3. Information We Collect</h2>
          <p className={styles.text}>
            Because we do not require account registration to use our core writing features, visitors can use our
            service with near-complete anonymity. If you choose to authenticate (e.g. via Google OAuth or email sign-in),
            we store basic profile data (name, email address, and profile avatar) strictly for managing your account
            session.
          </p>

          <h2 className={styles.sectionTitle}>4. Analytics &amp; Cookies</h2>
          <p className={styles.text}>
            We use anonymized, privacy-conscious analytics tools (such as Google Analytics and PostHog) to understand
            aggregate traffic trends, page load performance, and error metrics. These tools do not record the content
            of your text submissions.
          </p>

          <h2 className={styles.sectionTitle}>5. Data Security</h2>
          <p className={styles.text}>
            All transmissions between your web browser and our servers are encrypted in transit using industry-standard
            TLS 1.3 / HTTPS encryption.
          </p>

          <h2 className={styles.sectionTitle}>6. Your Rights (GDPR &amp; CCPA)</h2>
          <p className={styles.text}>
            Depending on your location, you have rights under the General Data Protection Regulation (GDPR) or California
            Consumer Privacy Act (CCPA), including the right to request access, correction, or deletion of your account
            data. Because we do not store your text drafts, there are no draft logs to export or delete.
          </p>

          <h2 className={styles.sectionTitle}>7. Contacting Us</h2>
          <p className={styles.text}>
            If you have any questions regarding this Privacy Policy or our security practices, please contact us
            through our support channels.
          </p>
        </article>

        <div className={styles.ctaContainer}>
          <h2 className="text-2xl font-bold mb-3">Write Confidently &amp; Privately</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Experience writing tools that respect your intellectual property and confidential drafts.
          </p>
          <Link href="/workspace" className={styles.primaryButton}>
            Open Workspace <ArrowRight size={16} />
          </Link>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

