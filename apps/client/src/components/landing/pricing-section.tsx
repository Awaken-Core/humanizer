"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
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

export function PricingSection() {
  const [annual, setAnnual] = useState(false);

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

