"use client";

import React from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface HumanizeButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  label?: string;
}

/**
 * Premium Humanize Action Button
 * Engineered with high-contrast electric-blue/cyan styling, subtle elevation,
 * smooth hover/active transitions, directional arrow icon, and clear loading/disabled feedback.
 */
export const HumanizeButton: React.FC<HumanizeButtonProps> = ({
  isLoading = false,
  label = "Humanize text",
  disabled,
  className,
  ...props
}) => {
  const isDisabled = disabled || isLoading;

  return (
    <button
      type="submit"
      disabled={isDisabled}
      aria-busy={isLoading}
      className={cn(
        // Base structure & typography
        "group relative inline-flex min-h-12 items-center justify-center gap-3 px-6 py-2.5 text-sm font-semibold tracking-tight transition-all duration-200 select-none",
        // Proportions & shape (rounded SaaS action, not pill-like)
        "rounded-full border",
        // Match the landing page's electric-blue primary action.
        !isDisabled && [
          "border-[#4b4bff] bg-gradient-to-b from-[#2929ff] to-[#0000ff] text-white",
          "shadow-[inset_0_1px_1px_rgba(255,255,255,0.34),0_3px_0_#0000a5,0_7px_18px_rgba(0,0,255,0.18)]",
          "hover:-translate-y-0.5 hover:brightness-110 hover:shadow-[inset_0_1px_1px_rgba(255,255,255,0.38),0_4px_0_#00008f,0_11px_24px_rgba(0,0,255,0.24)]",
          "active:translate-y-px active:scale-[0.985]",
        ],
        // Disabled / Loading styling
        isDisabled && [
          "border-neutral-200 bg-neutral-100 text-neutral-400 cursor-not-allowed shadow-none dark:border-neutral-800 dark:bg-[#191919] dark:text-neutral-600",
        ],
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin text-white/90" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight className="w-4 h-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
        </>
      )}
    </button>
  );
};

