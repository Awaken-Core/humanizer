"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { useSession } from "@/lib/auth-client";
import styles from "@/app/landing.module.css";

const plans = [
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
];

type CreditPack = {
  enabled: true;
  packCredits: number;
  signedIn: boolean;
  balance: number;
} | { enabled: false };

export function PricingSection() {
  const { data: session } = useSession();
  const [pack, setPack] = useState<CreditPack | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/v1/credits", { signal: controller.signal, cache: "no-store" });
        if (response.ok) setPack(await response.json());
      } catch {
        // A later focus or reload can retry the balance lookup.
      }
    };
    void refresh();
    window.addEventListener("focus", refresh);
    return () => {
      controller.abort();
      window.removeEventListener("focus", refresh);
    };
  }, [session?.user.id]);

  async function buyCredits() {
    if (pack?.enabled && !pack.signedIn) {
      window.dispatchEvent(new Event("country-rank:open-sign-in"));
      return;
    }
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/v1/credits", { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      window.location.assign(data.checkoutUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout could not be started.");
      setPending(false);
    }
  }

  const [annual, setAnnual] = useState(false);

  if (!pack) return null;
  if (pack.enabled) {
    return (
      <div className={styles.pricingGrid}>
        <article className={styles.plan}>
          <h3>{pack.packCredits} credits</h3>
          <p>One-time purchase. Board AI runs use credits based on input and output tokens.</p>
          {pack.signedIn && <p aria-live="polite">Balance: {pack.balance} credits</p>}
          <button type="button" className={styles.button} disabled={pending} onClick={buyCredits}>
            {pending ? "Opening checkout…" : pack.signedIn ? "Buy credits" : "Sign in to buy credits"}
          </button>
          {error && <p role="alert">{error}</p>}
        </article>
      </div>
    );
  }

  return (
    <>
      <div
        className={styles.billingSwitch}
        aria-label="Preview billing period"
      >
        <button
          type="button"
          aria-pressed={!annual}
          className={!annual ? styles.selectedBilling : ""}
          onClick={() => setAnnual(false)}
        >
          Monthly
        </button>
        <button
          type="button"
          aria-pressed={annual}
          className={annual ? styles.selectedBilling : ""}
          onClick={() => setAnnual(true)}
        >
          Yearly
        </button>
      </div>
      <div className={styles.pricingGrid}>
        {plans.map((plan) => (
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
              href={plan.live ? "/workspace" : "/#services"}
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
    </>
  );
}

